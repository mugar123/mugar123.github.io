import { describe, expect, it, vi } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { disposeObject, fitModel, loadSceneModels, MODEL_URLS } from '@/scene/models';

function model() {
  const root = new Group();
  const texture = new Texture();
  const mesh = new Mesh(new BoxGeometry(40, 10, 20), new MeshStandardMaterial({ map: texture }));
  mesh.position.set(12, 9, -5);
  root.add(mesh);
  return { root, mesh, texture };
}
function slot() { const host = new Group(); host.add(model().root); return host; }
const settle = async () => { await new Promise((resolve) => setTimeout(resolve, 0)); };

describe('scene model assets', () => {
  it('centers and scales imported geometry without changing its vertices', () => {
    const { root, mesh } = model();
    const positions = [...mesh.geometry.attributes.position!.array];
    const fitted = fitModel(root, 2);
    const box = new Box3().setFromObject(fitted);
    expect(box.getCenter(new Vector3()).length()).toBeCloseTo(0);
    expect(box.getSize(new Vector3()).x).toBeCloseTo(2);
    expect([...mesh.geometry.attributes.position!.array]).toEqual(positions);
  });

  it('loads the satellite once, replaces all placeholders, and preserves orbit transforms', async () => {
    const planet = slot(); const satellites = [slot(), slot()];
    satellites[1]!.position.set(2, 0, 1); satellites[1]!.scale.setScalar(2);
    const fallbackDispose = vi.spyOn((planet.children[0]!.children[0] as Mesh).geometry, 'dispose');
    const load = vi.fn(async () => model().root); const onSettled = vi.fn();
    const cancel = loadSceneModels({ planet, satellites, onSettled }, load);
    await settle();
    expect(load.mock.calls).toHaveLength(2);
    expect(load.mock.calls.map((args: unknown[]) => args[0])).toEqual([MODEL_URLS.planet, MODEL_URLS.satellite]);
    expect(fallbackDispose).toHaveBeenCalledOnce();
    expect(planet.children).toHaveLength(1);
    expect(satellites[0]!.children[0]).not.toBe(satellites[1]!.children[0]);
    expect(satellites[1]!.position.toArray()).toEqual([2, 0, 1]);
    expect(satellites[1]!.scale.x).toBe(2);
    // The source dish points along +Z; a decorative rotation would break the host's planet tracking.
    expect(new Vector3(0, 0, 1).applyQuaternion(satellites[0]!.children[0]!.quaternion).toArray()).toEqual([0, 0, 1]);
    expect(onSettled).toHaveBeenCalledWith('ready');
    cancel(); disposeObject(planet); satellites.forEach(disposeObject);
  });

  it('retains the affected placeholder if a model fails and still installs the other model', async () => {
    const planet = slot(); const satellite = slot(); const placeholder = satellite.children[0];
    const onSettled = vi.fn();
    const cancel = loadSceneModels({ planet, satellites: [satellite], onSettled }, async (url) => {
      if (url === MODEL_URLS.satellite) throw new Error('offline');
      return model().root;
    });
    await settle();
    expect(satellite.children[0]).toBe(placeholder);
    expect(onSettled).toHaveBeenCalledWith('partial');
    cancel(); disposeObject(planet); disposeObject(satellite);
  });

  it('aborts pending requests and disposes models decoded after teardown instead of attaching them', async () => {
    const planet = slot(); const original = planet.children[0]; const onSettled = vi.fn();
    const late = model(); const geometryDispose = vi.spyOn(late.mesh.geometry, 'dispose');
    const textureDispose = vi.spyOn(late.texture, 'dispose');
    let resolve!: (root: Group) => void; let signal!: AbortSignal;
    const cancel = loadSceneModels({ planet, satellites: [], onSettled }, (_url, abortSignal) => {
      signal = abortSignal;
      return new Promise<Group>((r) => { resolve = r; });
    });
    cancel(); expect(signal.aborted).toBe(true);
    resolve(late.root); await settle();
    expect(planet.children[0]).toBe(original);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(onSettled).not.toHaveBeenCalled();
    disposeObject(planet);
  });

  it('disposes shared geometry, materials, and textures only once', () => {
    const { root, mesh, texture } = model(); root.add(mesh.clone());
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(mesh.material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');
    disposeObject(root);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
});
