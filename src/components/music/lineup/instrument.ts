/* Live WebGL studio for the instruments' line-ups (LineupStory.astro). The exported models are one unit
   long, upright along +Y and facing +Z (scripts/export-instruments.py). A photographed lighting
   environment supplies reflections at every viewing angle, while each surrounding SVG copy acts as a
   live coloured area light that moves, sways and dims with the row. The canvas is clear where the
   instrument is not, so the flat copies of the line-up show around it. */
import {
  AgXToneMapping, Color, DirectionalLight, EquirectangularReflectionMapping, Material, MathUtils,
  Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, PCFSoftShadowMap,
  RectAreaLight, Scene, SRGBColorSpace, Texture, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

export interface SurroundLight {
  colour: string;
  side: number; // -1 left, +1 right
  rank: number; // 1 nearest .. 3 farthest
}

export interface SurroundPose {
  x: number; // horizontal offset from the instrument's centre, in model units
  exposure: number; // 0 (hidden behind instrument/neighbour) to 1 (fully revealed)
  lean: number; // degrees, relative clockwise tilt from the rack spring
  yaw: number; // degrees, the copy's current turned angle
}

export interface Instrument {
  pose(degrees: number, surround: readonly SurroundPose[], pixelRatio: number): void; // turned about its own long axis; 0 faces you
  resize(size: number, compact: boolean): void;
  /** Get the first picture's one-off work done ahead of it, a piece at a time: `pause` resolves when the next piece may go. */
  warm?(pixelRatio: number, pause: () => Promise<void>): Promise<void>;
  dispose(): void;
}

RectAreaLightUniformsLib.init();

const FRAME_WIDTH = 1.1; // the view's width at the instrument, in instrument lengths
const LENS = 85; // mm, on a 36 mm frame

// Layered depth and height for each rank (1 nearest .. 3 farthest), mirroring the CSS stacking and
// spreading the rainbow across body, waist and neck instead of averaging into neutral white.
const SURROUND_RANK = [
  { z: .10, y: -.14, aimY: -.16, width: .25, height: .90, intensity: 1.75, pad: .10, minX: .30 },
  { z: -.12, y: .06, aimY: .02, width: .28, height: 1.00, intensity: 2.75, pad: 0, minX: .42 },
  { z: -.32, y: .24, aimY: .16, width: .34, height: 1.08, intensity: 4.30, pad: 0, minX: .58 },
] as const;

// Keep highlights restrained on paint and plastics in the dark room, preserving metal hardware.
function satin(material: Material) {
  if (!(material instanceof MeshStandardMaterial)) return;
  if (material instanceof MeshPhysicalMaterial) {
    material.clearcoat = .05;
    material.clearcoatRoughness = .38;
  }
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', `
      #include <metalnessmap_fragment>
      float nonMetal = 1.0 - step(.5, metalnessFactor);
      diffuseColor.rgb *= mix(1.0, .9, nonMetal * smoothstep(.45, .88, max(diffuseColor.r, diffuseColor.b)));
      roughnessFactor = mix(max(roughnessFactor, .46), roughnessFactor, step(.5, metalnessFactor));
    `);
  };
  material.customProgramCacheKey = () => 'satin-dark';
  material.needsUpdate = true;
}

function hardware(material: MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', `
      #include <metalnessmap_fragment>
      float bareMetal = metalnessFactor * smoothstep(0.065, 0.30, diffuseColor.g);
      float nonMetal = 1.0 - step(0.5, metalnessFactor);
      diffuseColor.rgb = mix(diffuseColor.rgb * mix(1.0, 0.92, nonMetal * smoothstep(0.45, 0.85, max(diffuseColor.r, diffuseColor.b))), min(vec3(.74), diffuseColor.rgb * 1.1), bareMetal);
      roughnessFactor = mix(max(roughnessFactor, .36 * nonMetal), clamp(roughnessFactor, .22, .38), bareMetal);
    `);
  };
  material.customProgramCacheKey = () => 'nickel-hardware-dark';
  material.needsUpdate = true;
}

export async function createInstrument(
  canvas: HTMLCanvasElement,
  url: string,
  paint: string,
  surround: readonly SurroundLight[],
  compact: boolean,
): Promise<Instrument> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = .92;
  // On phones rely on the contact shading in the materials and render each mesh once.
  renderer.shadowMap.enabled = !compact;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const key = new DirectionalLight(0xfff2e2, .72);
  key.position.set(-.48, 1.22, 1);
  key.castShadow = !compact;
  // A tight frustum resolves the narrow shadows under the strings and bridge saddles.
  Object.assign(key.shadow.camera, { left: -.21, right: .21, top: .51, bottom: -.51, near: .65, far: 2.35 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.mapSize.setScalar(1024);
  key.shadow.autoUpdate = false;
  key.shadow.normalBias = .00022;
  key.shadow.bias = -.00012;
  // A quiet strip across the body contour and pickups, restrained so black finishes stay deep on #000.
  const strip = new RectAreaLight(0xfff3e6, .95, .26, 1.15);
  strip.position.set(-.92, .66, .74);
  strip.lookAt(0, -.14, 0);
  strip.rotateZ(.48);
  scene.add(key, strip);

  const surroundLights = surround.map(({ colour, side, rank }) => {
    const spec = SURROUND_RANK[Math.min(SURROUND_RANK.length, Math.max(1, rank)) - 1]!;
    const color = new Color(colour);
    // Gently compensate darker saturated hues (red, purple, blue) so both sides balance perceptually.
    const lum = .2126 * color.r + .7152 * color.g + .0722 * color.b;
    const balance = Math.min(1.85, (.28 / Math.max(.1, lum)) ** .55);
    const light = new RectAreaLight(color, 0, spec.width, spec.height);
    light.position.set(side * (spec.minX + spec.pad), spec.y, spec.z);
    light.lookAt(0, spec.aimY, 0);
    scene.add(light);
    return { ...spec, side, intensity: spec.intensity * balance, light };
  });

  const camera = new PerspectiveCamera(2 * MathUtils.radToDeg(Math.atan(18 / LENS)), 1, .1, 20);
  camera.position.set(0, 0, FRAME_WIDTH * LENS / 36);
  camera.lookAt(0, 0, 0);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [gltf, environment] = await Promise.all([
    loader.loadAsync(url),
    new HDRLoader().loadAsync('/music/instruments/studio-small-09.hdr'),
  ]);
  environment.mapping = EquirectangularReflectionMapping;
  scene.environment = environment;
  scene.environmentIntensity = .14;
  scene.environmentRotation.y = 5.3;
  const model = gltf.scene;
  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const textures = new Set<Texture>();
  const meshes: Mesh[] = [];
  model.traverse(node => {
    if (!(node instanceof Mesh)) return;
    meshes.push(node);
    node.castShadow = node.receiveShadow = true;
    for (const material of [node.material].flat()) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
      if (material.name === paint || material.name === 'Ebony lacquer') satin(material);
      if (!(material instanceof MeshStandardMaterial)) continue;
      if (material.map) material.map.anisotropy = anisotropy;
      if (material.name === 'NeckMaterial' || material.name === 'SmallbitsBake') hardware(material);
      if ((material.name === 'NeckMaterial' || material.name === 'Black top hat') && material instanceof MeshPhysicalMaterial) {
        material.clearcoat = .1;
        material.clearcoatRoughness = .36;
      }
      if (material.name === 'Black top hat') material.roughness = .38;
      if (material.name === 'StringMaterial' || material.name === 'Strings' || material.name === 'Nickel silver') {
        material.roughness = .32;
      }
    }
  });
  const holder = new Object3D();
  holder.add(model);
  scene.add(holder);
  await renderer.compileAsync(scene, camera);

  let shown = NaN;
  let size = 0;
  let width = 0;
  let disposed = false;
  let partial = false; // warming up: only some of the meshes are switched on
  function whole() {
    if (!partial) return;
    partial = false;
    for (const mesh of meshes) mesh.visible = true;
  }
  // On mobile, subpixel changes to the pose or the reflected light can share the last render.
  const desktopThreshold = { angle: 1e-4, x: 1e-4, exposure: 1e-4, lean: 1e-3, yaw: 1e-2 };
  const mobileThreshold = { angle: .04, x: .001, exposure: .002, lean: .08, yaw: .15 };
  let threshold = compact ? mobileThreshold : desktopThreshold;
  let shadowYaw = NaN;
  const lastSurround = new Float32Array(surroundLights.length * 4).fill(NaN);

  return {
    pose(degrees, states, pixelRatio) {
      if (!size) return;
      const turned = Math.abs(degrees - shown) >= threshold.angle || Number.isNaN(shown);
      let dirty = turned;
      for (let i = 0; i < surroundLights.length; i++) {
        const spec = surroundLights[i]!;
        const state = states?.[i];
        const exposure = state ? MathUtils.clamp(state.exposure, 0, 1) : 1;
        const rawX = state ? state.x : spec.side * spec.minX;
        const lean = state ? state.lean : 0;
        const yaw = state ? state.yaw : degrees;
        const base = i * 4;
        const changed =
          Number.isNaN(lastSurround[base]!) ||
          Math.abs(rawX - lastSurround[base]!) >= threshold.x ||
          Math.abs(exposure - lastSurround[base + 1]!) >= threshold.exposure ||
          Math.abs(lean - lastSurround[base + 2]!) >= threshold.lean ||
          Math.abs(yaw - lastSurround[base + 3]!) >= threshold.yaw;
        if (!changed) continue;
        dirty = true;
        lastSurround[base] = rawX;
        lastSurround[base + 1] = exposure;
        lastSurround[base + 2] = lean;
        lastSurround[base + 3] = yaw;
        // Leaning around the copy's foot (y = -0.5) swings the coloured silhouette towards or away from the instrument.
        const leanRad = MathUtils.degToRad(lean);
        const arm = spec.y + .5;
        const swungX = rawX + arm * Math.sin(leanRad);
        const x = spec.side * Math.max(spec.minX, spec.side * swungX + spec.pad);
        const y = -.5 + arm * Math.cos(leanRad);
        // As a copy turns edge-on (±90°), its apparent emitting width narrows.
        const spread = .42 + .58 * Math.abs(Math.cos(MathUtils.degToRad(yaw)));
        spec.light.position.set(x, y, spec.z);
        spec.light.lookAt(0, spec.aimY - Math.sin(leanRad) * spec.side * .2, 0);
        spec.light.width = spec.width * spread;
        spec.light.intensity = spec.intensity * exposure * (.68 + .32 * spread);
      }
      const ratio = Math.min(devicePixelRatio || 1, pixelRatio);
      if (Number.isNaN(shown) || (ratio !== renderer.getPixelRatio() && (dirty || ratio > renderer.getPixelRatio()))) {
        renderer.setDrawingBufferSize(width, size, ratio);
        dirty = true;
      }
      if (!dirty) return;
      whole();
      shown = degrees;
      holder.rotation.y = MathUtils.degToRad(degrees);
      // The coloured lights and the CSS sway do not move the model relative to the shadow caster.
      // Reuse the depth pass until the body has moved by about one shadow texel.
      if (renderer.shadowMap.enabled && (!Number.isFinite(shadowYaw) || Math.abs(degrees - shadowYaw) >= .2)) {
        key.shadow.needsUpdate = true;
        shadowYaw = degrees;
      }
      renderer.render(scene, camera);
    },
    resize(css, compact) {
      if (css === size && key.castShadow === !compact) return;
      size = css;
      key.castShadow = renderer.shadowMap.enabled = !compact;
      threshold = compact ? mobileThreshold : desktopThreshold;
      if (compact && key.shadow.map) {
        key.shadow.dispose();
        key.shadow.map = null;
      }
      // Keep the square camera framing, but only allocate the strip containing the turning model.
      width = css * .32;
      camera.setViewOffset(css, css, (css - width) / 2, 0, width, css);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${css}px`;
      // Allocate once, when the next visible pose supplies its actual pixel ratio.
      shown = shadowYaw = NaN;
      lastSurround.fill(NaN);
    },
    // The first picture of a model sends every texture to the GPU, readies each material's program and the
    // shadow pass, and waits for it all: some 60 ms on a laptop, in whichever frame the instrument first shows
    // (the reader arriving at the chapter, the slide setting off). Done here ahead of that, in pieces small
    // enough to fit between frames: a texture at a time, then a material at a time, in pictures nobody sees.
    async warm(pixelRatio, pause) {
      for (const texture of textures) {
        if (disposed) return;
        renderer.initTexture(texture);
        await pause();
      }
      const drawn = () => disposed || !size || !Number.isNaN(shown); // gone, or already drawn for real
      if (drawn()) return;
      renderer.setDrawingBufferSize(width, size, Math.min(devicePixelRatio || 1, pixelRatio));
      for (const material of new Set(meshes.flatMap(mesh => [mesh.material].flat()))) {
        partial = true;
        for (const mesh of meshes) mesh.visible = [mesh.material].flat().includes(material);
        key.shadow.needsUpdate = renderer.shadowMap.enabled;
        renderer.render(scene, camera);
        await pause();
        if (drawn()) return whole();
      }
      whole();
      key.shadow.needsUpdate = renderer.shadowMap.enabled;
      renderer.render(scene, camera);
      await pause();
    },
    dispose() {
      disposed = true;
      environment.dispose();
      key.shadow.dispose();
      scene.traverse(node => {
        if (!(node instanceof Mesh)) return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) material.dispose();
      });
      renderer.dispose();
    },
  };
}
