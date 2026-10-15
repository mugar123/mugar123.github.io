import { Box3, Group, Texture, Vector3, type BufferGeometry, type Material, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_URLS, SATELLITE_RADIUS } from './modelConfig';
export { MODEL_URLS } from './modelConfig';

type LoadModel = (url: string, signal: AbortSignal) => Promise<Object3D>;
export type ModelState = 'ready' | 'partial' | 'fallback';

/** Dispose shared resources once, including embedded textures and decoded image bitmaps. */
export function disposeObject(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    const mesh = object as Partial<Mesh>;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => materials.add(m));
    else if (material) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  const images = new Set<{ close?: () => void }>();
  for (const texture of textures) {
    if (texture.source.data) images.add(texture.source.data as { close?: () => void });
    texture.dispose();
  }
  for (const image of images) image.close?.();
  for (const geometry of geometries) geometry.dispose();
}

/** A centered wrapper keeps source vertices intact and leaves orbit transforms on the outer host. */
export function fitModel(model: Object3D, diameter: number): Group {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('Empty orbit model');
  model.position.sub(bounds.getCenter(new Vector3()));
  const wrapper = new Group();
  wrapper.add(model);
  wrapper.scale.setScalar(diameter / extent);
  return wrapper;
}

const loadModel: LoadModel = async (url, signal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Orbit model HTTP ${response.status}: ${url}`);
  const bytes = await response.arrayBuffer();
  signal.throwIfAborted();
  // The shipped GLBs are self-contained; no remote textures or decoder requests.
  return (await new GLTFLoader().parseAsync(bytes, '')).scene;
};

/** Independent downloads: one failure keeps that placeholder; teardown cancels requests and late decodes. */
export function loadSceneModels(
  hosts: { planet: Group; satellites: Group[]; onSettled: (state: ModelState) => void },
  load: LoadModel = loadModel,
): () => void {
  const controller = new AbortController();
  let cancelled = false;
  const install = async (url: string, targets: Group[], diameter: number, satellite = false): Promise<boolean> => {
    let source: Object3D | undefined;
    try {
      source = await load(url, controller.signal);
      if (cancelled) { disposeObject(source); return false; }
      const template = fitModel(source, diameter);
      if (satellite) { template.rotation.y = -0.45; template.rotation.z = 0.08; }
      for (const target of targets) {
        // Each host starts with its own procedural placeholder; imported clones share GPU resources.
        disposeObject(target);
        target.clear();
        target.add(template.clone(true));
      }
      return true;
    } catch (error) {
      if (source) disposeObject(source);
      if (!cancelled) console.info('[orbit] model unavailable; keeping its primitive fallback', error);
      return false;
    }
  };
  const requests = [install(MODEL_URLS.planet, [hosts.planet], 2)];
  if (hosts.satellites.length) requests.push(install(MODEL_URLS.satellite, hosts.satellites, SATELLITE_RADIUS * 2, true));
  void Promise.all(requests).then((loaded) => {
    if (!cancelled) hosts.onSettled(loaded.every(Boolean) ? 'ready' : loaded.some(Boolean) ? 'partial' : 'fallback');
  });
  return () => { cancelled = true; controller.abort(); };
}
