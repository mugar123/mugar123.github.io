/**
 * Lifecycle, disposal, visibility and failure paths of mountOrbitScene, with real camera maths and a
 * stubbed renderer and DOM (adapted from impl/codex-t10:tests/unit/scene.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Object3D, Scene } from 'three';
import { DocumentStub, ElementStub, ObserverStub } from '../helpers/sceneDom';

const gpu = vi.hoisted(() => ({
  scene: null as Scene | null,
  canvas: null as unknown as import('../helpers/sceneDom').ElementStub,
  constructFails: false,
  renderFails: false,
  resizeFails: false,
  render: vi.fn(),
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
}));
vi.mock('three', async (importOriginal) => {
  const real = await importOriginal<typeof import('three')>();
  return {
    ...real,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      constructor() {
        if (gpu.constructFails) throw new Error('WebGL unavailable');
        gpu.canvas = this.domElement as unknown as ElementStub;
      }
      setPixelRatio() {}
      setClearColor() {}
      setSize(width: number, height: number) {
        if (gpu.resizeFails) throw new Error('resize failure');
        Object.assign(this.domElement, { clientWidth: width, clientHeight: height });
      }
      render(scene: Scene) {
        if (gpu.renderFails) throw new Error('GPU failure');
        gpu.scene = scene;
        gpu.render();
      }
      dispose() { gpu.dispose(); }
      forceContextLoss() { gpu.forceContextLoss(); }
    },
  };
});
import { mountOrbitScene, type MountOptions } from '@/scene/scene';
import { SCENE_LABEL, type SceneSatellite } from '@/lib/satellites';

const PAPERTOK: SceneSatellite = { id: 'paper', name: 'PaperTok', orbit: 'high', status: 'active', href: '/work/paper', phase: 0 };

let container: ElementStub;
let fallback: ElementStub;
let doc: DocumentStub;
let frameTime: number;
let frameId: number;
let frames: Map<number, FrameRequestCallback>;
let handle: ReturnType<typeof mountOrbitScene> | undefined;
const onContextLost = vi.fn();
const onFailure = vi.fn();

function frame(ms = 16) {
  frameTime += ms;
  const due = [...frames.values()];
  frames.clear();
  for (const callback of due) callback(frameTime);
}
function mount({ withFailure = true, satellites = [PAPERTOK] }: { withFailure?: boolean; satellites?: SceneSatellite[] } = {}) {
  const opts: MountOptions = { satellites, onContextLost };
  if (withFailure) opts.onFailure = onFailure;
  handle = mountOrbitScene(container as unknown as HTMLElement, opts);
  return handle;
}
const stage = () => container.querySelector('.orbit-stage');
const ro = () => ObserverStub.instances[0]!; // [0] ResizeObserver, [1] IntersectionObserver
const io = () => ObserverStub.instances[1]!;
function watchDisposal(object: Object3D) {
  const disposed = vi.fn();
  object.traverse((child) => {
    const m = child as Partial<import('three').Mesh>;
    m.geometry?.addEventListener('dispose', disposed);
    if (m.material && !Array.isArray(m.material)) m.material.addEventListener('dispose', disposed);
  });
  return disposed;
}
function expectTornDown() {
  expect(stage()).toBeNull();
  expect(container.children).toEqual([fallback]);
  for (const a of ['data-ready', 'role', 'aria-label', 'aria-describedby']) expect(container.getAttribute(a)).toBeNull();
  expect(frames.size).toBe(0);
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  expect(ObserverStub.instances.every((o) => o.disconnected)).toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  gpu.scene = null;
  gpu.constructFails = false;
  gpu.renderFails = false;
  gpu.resizeFails = false;
  doc = new DocumentStub();
  container = new ElementStub('div');
  container.setAttribute('id', 'orbit-scene');
  fallback = new ElementStub('div');
  fallback.setAttribute('data-fallback', '');
  container.append(fallback);
  frameTime = 0;
  frameId = 0;
  frames = new Map();
  ObserverStub.instances = [];
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', Object.assign(new EventTarget(), { devicePixelRatio: 1 }));
  vi.stubGlobal('ResizeObserver', ObserverStub);
  vi.stubGlobal('IntersectionObserver', ObserverStub);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++frameId, cb); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('mount and destroy', () => {
  it('marks ready only after a rendered frame; destroy is idempotent and removes everything it added', () => {
    const mounted = mount();
    expect(container.getAttribute('data-ready')).toBeNull();
    frame();
    expect(container.getAttribute('data-ready')).toBe('true');
    mounted.destroy();
    mounted.destroy();
    expectTornDown();
    expect(gpu.forceContextLoss).toHaveBeenCalledTimes(1);
  });

  it('is one still image for assistive technology: named and described like the fallback, never focusable, no launch controls', () => {
    mount(); frame();
    expect(container.getAttribute('role')).toBe('img');
    expect(container.getAttribute('aria-label')).toBe(SCENE_LABEL);
    const descId = container.getAttribute('aria-describedby');
    expect(container.querySelector(`[id="${descId}"]`)?.textContent).toBe('PaperTok in high orbit.');
    expect(container.getAttribute('tabindex')).toBeNull();
    expect(container.querySelector('[data-testid="launch-pad"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('has no description without satellites, like the fallback', () => {
    mount({ satellites: [] }); frame();
    expect(container.getAttribute('aria-label')).toBe(SCENE_LABEL);
    expect(container.getAttribute('aria-describedby')).toBeNull();
  });

  it('cleans up a partial mount when a later constructor throws', () => {
    vi.stubGlobal('ResizeObserver', class { constructor() { throw new Error('observer unavailable'); } });
    expect(() => mount()).toThrow('observer unavailable');
    expect(container.children).toEqual([fallback]);
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-label')).toBeNull();
    expect(gpu.dispose).toHaveBeenCalledTimes(1);
  });

  it('throws without leaving anything behind when the renderer cannot be created', () => {
    gpu.constructFails = true;
    expect(() => mount()).toThrow('WebGL unavailable');
    expect(container.children).toEqual([fallback]);
    expect(container.getAttribute('role')).toBeNull();
  });
});

describe('guarded frame loop (fix round 1, finding 1)', () => {
  it('a first-frame render failure destroys the scene and asks for the fallback', () => {
    mount();
    gpu.renderFails = true;
    frame();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0]![0]).toBeInstanceOf(Error);
    expectTornDown();
  });

  it('a failure after readiness also tears down: no stage, no ready flag, no queued frame, no live listeners', () => {
    mount();
    frame(); frame();
    expect(container.getAttribute('data-ready')).toBe('true');
    const canvas = gpu.canvas;
    gpu.renderFails = true;
    frame();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expectTornDown();
    gpu.renderFails = false;
    frame();
    ro().callback([]);
    io().callback([{ isIntersecting: true }]);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(frames.size).toBe(0);
    expect(onContextLost).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('an exception inside the resize handler is contained the same way', () => {
    mount(); frame();
    gpu.resizeFails = true;
    ro().callback([]);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expectTornDown();
  });

  it('falls back to onContextLost when the caller passes no onFailure', () => {
    mount({ withFailure: false });
    gpu.renderFails = true;
    frame();
    expect(onContextLost).toHaveBeenCalledTimes(1);
  });

  it('context loss restores the fallback and never forces a second loss', () => {
    mount(); frame();
    const disposed = watchDisposal(gpu.scene!);
    gpu.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expectTornDown();
    expect(gpu.forceContextLoss).not.toHaveBeenCalled();
    expect(disposed.mock.calls.length).toBeGreaterThan(0);
  });
});

describe('visibility', () => {
  it('pauses off-screen and resumes exactly one loop without a position jump', () => {
    mount(); frame(); frame();
    const satellite = gpu.scene!.getObjectByName('satellite-active')!;
    const before = satellite.position.clone();
    io().callback([{ isIntersecting: false }]);
    expect(frames.size).toBe(0);
    frame(10_000);
    io().callback([{ isIntersecting: true }]);
    io().callback([{ isIntersecting: true }]);
    expect(frames.size).toBe(1);
    frame();
    expect(satellite.position.equals(before)).toBe(true);
  });
});
