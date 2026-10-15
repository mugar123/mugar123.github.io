/**
 * Lifecycle, input, disposal, visibility and failure paths of mountOrbitScene, with real camera maths and
 * physics and a stubbed renderer and DOM (adapted from impl/codex-t10:tests/unit/scene.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Object3D, Scene } from 'three';
import { DocumentStub, ElementStub, ObserverStub } from '../helpers/sceneDom';
import { STORAGE_KEY } from '@/lib/visitorSatellites';
import { VIEW_RADIUS, CAMERA_POSITION } from '@/scene/projection';
import { LAUNCH_RADIUS } from '@/lib/orbit';
import { PAD_HIT_RADIUS, MIN_PAD_HIT_PX, padHitReach } from '@/scene/interaction';

const gpu = vi.hoisted(() => ({
  scene: null as Scene | null,
  canvas: null as unknown as import('../helpers/sceneDom').ElementStub,
  constructFails: false,
  renderFails: false,
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
      setSize(width: number, height: number) { Object.assign(this.domElement, { clientWidth: width, clientHeight: height }); }
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
vi.mock('@/lib/orbit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/orbit')>();
  return { ...real, simulate: vi.fn(real.simulate) };
});
import { simulate } from '@/lib/orbit';
import { mountOrbitScene, type MountOptions } from '@/scene/scene';
import { SCENE_LABEL } from '@/lib/satellites';

let container: ElementStub;
let fallback: ElementStub;
let doc: DocumentStub;
let storage: Storage;
let frameTime: number;
let frameId: number;
let frames: Map<number, FrameRequestCallback>;
let handle: ReturnType<typeof mountOrbitScene> | undefined;
const onOutcome = vi.fn();
const onContextLost = vi.fn();
const onFailure = vi.fn();
const SQUASH = CAMERA_POSITION[1] / Math.hypot(CAMERA_POSITION[1], CAMERA_POSITION[2]);

function frame(ms = 16) {
  frameTime += ms;
  const due = [...frames.values()];
  frames.clear();
  for (const callback of due) callback(frameTime);
}
function mount({ withFailure = true } = {}) {
  const opts: MountOptions = {
    satellites: [{ id: 'paper', name: 'PaperTok', orbit: 'high', status: 'active', href: '/work/paper', phase: 0 }],
    storage, onOutcome, onContextLost,
  };
  if (withFailure) opts.onFailure = onFailure;
  handle = mountOrbitScene(container as unknown as HTMLElement, opts);
  return handle;
}
const stage = () => container.querySelector('.orbit-stage');
const status = () => container.querySelector('[data-testid="launch-status"]')!;
const pad = () => container.querySelector('[data-testid="launch-pad"]')!;
const io = () => ObserverStub.instances[1]!; // [0] ResizeObserver, [1] IntersectionObserver
const countSaved = () => (JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as unknown[]).length;
const groups = (name: string) => gpu.scene!.children.filter((o) => o.name === name);

/** Dispatches a pointer event on the pad at orbital-plane point (x, y). */
function pointer(type: string, x: number, y: number, extra: Record<string, unknown> = {}) {
  const ppu = container.clientHeight / (2 * VIEW_RADIUS);
  return pad().dispatchEvent(Object.assign(new Event(type, { cancelable: true }), {
    pointerId: 1, button: 0, isPrimary: true, pointerType: 'mouse',
    clientX: 20 + container.clientWidth / 2 + x * ppu,
    clientY: 10 + container.clientHeight / 2 - y * ppu * SQUASH,
    ...extra,
  }));
}
function key(k: string, opts: { repeat?: boolean; shiftKey?: boolean } = {}) {
  container.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), {
    key: k, repeat: false, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...opts,
  }));
}
/** A drag from the pad offset by (ox, oy), moving `tangential` plane units prograde. */
function drag(tangential: number, ox = 0, oy = 0) {
  pointer('pointerdown', LAUNCH_RADIUS + ox, oy);
  pointer('pointermove', LAUNCH_RADIUS + ox, oy + tangential);
  pointer('pointerup', LAUNCH_RADIUS + ox, oy + tangential);
}
/** 1 v₀ is 2.5 plane units of drag (DRAG_SCALE 0.4). */
const units = (speed: number) => speed / 0.4;
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
  expect(container.getAttribute('data-ready')).toBeNull();
  expect(container.getAttribute('role')).toBeNull();
  expect(container.getAttribute('tabindex')).toBeNull();
  expect(frames.size).toBe(0);
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  expect(ObserverStub.instances.every((o) => o.disconnected)).toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  gpu.scene = null;
  gpu.constructFails = false;
  gpu.renderFails = false;
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
  const items = new Map<string, string>();
  storage = {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => { items.set(k, v); },
    removeItem: (k) => { items.delete(k); },
    clear: () => items.clear(),
    key: (i) => [...items.keys()][i] ?? null,
    get length() { return items.size; },
  };
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
    container.setAttribute('aria-label', 'kept?');
    const mounted = mount();
    expect(container.getAttribute('data-ready')).toBeNull();
    expect(container.tabIndex).toBe(0);
    expect(container.getAttribute('role')).toBe('application');
    expect(status().getAttribute('role')).toBe('status');
    expect(status().textContent).toBe('DRAG TO LAUNCH ↗');
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

  it('cleans up a partial mount when a later constructor throws', () => {
    vi.stubGlobal('ResizeObserver', class { constructor() { throw new Error('observer unavailable'); } });
    expect(() => mount()).toThrow('observer unavailable');
    expect(container.children).toEqual([fallback]);
    expect(container.getAttribute('role')).toBeNull();
    expect(gpu.dispose).toHaveBeenCalledTimes(1);
    key('Enter');
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('throws without leaving anything behind when the renderer cannot be created', () => {
    gpu.constructFails = true;
    expect(() => mount()).toThrow('WebGL unavailable');
    expect(container.children).toEqual([fallback]);
    expect(container.getAttribute('tabindex')).toBeNull();
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
    key('Enter');
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('a failure after readiness also tears down: no stage, no ready flag, no queued frame, no live listeners', () => {
    mount();
    frame(); frame();
    expect(container.getAttribute('data-ready')).toBe('true');
    const detachedPad = pad();
    gpu.renderFails = true;
    frame();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expectTornDown();
    gpu.renderFails = false;
    frame();
    key('ArrowUp'); key('Enter');
    detachedPad.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1, button: 0, isPrimary: true, clientX: 0, clientY: 0 }));
    expect(detachedPad.captures.size).toBe(0);
    expect(simulate).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('an exception inside an input handler is contained the same way', () => {
    mount(); frame();
    vi.mocked(simulate).mockImplementationOnce(() => { throw new Error('boom'); });
    key('Enter');
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

describe('plane-space pad gate (finding 4)', () => {
  const e = 1e-3;
  const starts = () => pad().captures.size === 1;
  // The default 960 × 540 scene: radially the plain PAD_HIT_RADIUS; tangentially widened to 22 px on screen.
  const reach = padHitReach(540 / (2 * VIEW_RADIUS));
  it('the default scene gates radially at PAD_HIT_RADIUS and tangentially beyond it', () => {
    expect(reach.radial).toBe(PAD_HIT_RADIUS);
    expect(reach.tangential).toBeGreaterThan(PAD_HIT_RADIUS);
  });
  it.each([
    ['radial out', reach.radial, 0], ['radial in', -reach.radial, 0],
    ['prograde', 0, reach.tangential], ['retrograde', 0, -reach.tangential],
  ])('%s: a drag starts just inside the gate and not just outside', (_name, dx, dy) => {
    mount(); frame();
    const ux = Math.sign(dx), uy = Math.sign(dy);
    pointer('pointerdown', LAUNCH_RADIUS + dx - ux * e, dy - uy * e);
    expect(starts()).toBe(true);
    pointer('pointercancel', 0, 0);
    expect(starts()).toBe(false);
    pointer('pointerdown', LAUNCH_RADIUS + dx + ux * e, dy + uy * e);
    expect(starts()).toBe(false);
  });

  it('a press one full plane unit tangentially from the pad launches nothing', () => {
    mount(); frame();
    drag(units(1.1), 0, 1);
    frame();
    expect(simulate).not.toHaveBeenCalled();
    expect(onOutcome).not.toHaveBeenCalled();
    expect(status().textContent).toBe('DRAG TO LAUNCH ↗');
  });

  it('measures the drag from the accepted down point, not from the pad', () => {
    mount(); frame();
    drag(units(1.1), 0.3, 0.2);
    expect(onOutcome).toHaveBeenCalledExactlyOnceWith('orbit', expect.closeTo(1.1, 9));
    expect(status().textContent).toBe('1.10 v₀ · ORBIT ACHIEVED');
    expect(status().classList.contains('is-success')).toBe(true);
    expect(countSaved()).toBe(1);
    expect(pad().captures.size).toBe(0);
  });

  it('on a phone-sized scene the radius widens to a 44 px target (22 px radial reach) and no further', () => {
    container.clientWidth = 320; container.clientHeight = 180;
    mount(); frame();
    const ppu = 180 / (2 * VIEW_RADIUS);
    const reach = MIN_PAD_HIT_PX / ppu;
    expect(reach).toBeGreaterThan(PAD_HIT_RADIUS);
    pointer('pointerdown', LAUNCH_RADIUS + reach - e, 0);
    expect(starts()).toBe(true);
    pointer('pointercancel', 0, 0);
    pointer('pointerdown', LAUNCH_RADIUS + reach + e, 0);
    expect(starts()).toBe(false);
    expect(parseFloat(pad().style['width']!)).toBeCloseTo(2 * MIN_PAD_HIT_PX, 6);
  });

  it('on a 375-px-wide phone scene the pad is at least 44 px in both axes, and the gate matches it', () => {
    container.clientWidth = 375; container.clientHeight = Math.round((375 * 9) / 16);
    mount(); frame();
    const w = parseFloat(pad().style['width']!), h = parseFloat(pad().style['height']!);
    expect(w).toBeGreaterThanOrEqual(2 * MIN_PAD_HIT_PX - 1e-6);
    expect(h).toBeGreaterThanOrEqual(2 * MIN_PAD_HIT_PX - 1e-6);
    // The DOM pad's vertical edge is the gate's tangential edge: just inside starts a drag, just outside does not.
    const { tangential } = padHitReach(container.clientHeight / (2 * VIEW_RADIUS));
    pointer('pointerdown', LAUNCH_RADIUS, tangential - e);
    expect(starts()).toBe(true);
    pointer('pointercancel', 0, 0);
    pointer('pointerdown', LAUNCH_RADIUS, tangential + e);
    expect(starts()).toBe(false);
  });

  it('right clicks, secondary pointers and a click that never moves launch nothing', () => {
    mount(); frame();
    pointer('pointerdown', LAUNCH_RADIUS, 0, { button: 2 }); pointer('pointerup', LAUNCH_RADIUS, units(1.1));
    pointer('pointerdown', LAUNCH_RADIUS, 0, { isPrimary: false }); pointer('pointerup', LAUNCH_RADIUS, units(1.1));
    pointer('pointerdown', LAUNCH_RADIUS, 0); pointer('pointerup', LAUNCH_RADIUS, units(1.1)); // no move: a click
    frame();
    expect(simulate).not.toHaveBeenCalled();
    expect(onOutcome).not.toHaveBeenCalled();
  });
});

describe('coalesced previews (finding 3)', () => {
  it('pointer moves and key repeats cost at most one simulation per frame', () => {
    mount(); frame();
    pointer('pointerdown', LAUNCH_RADIUS, 0);
    for (let i = 0; i < 20; i++) pointer('pointermove', LAUNCH_RADIUS, units(1 + i * 0.005));
    expect(simulate).not.toHaveBeenCalled();
    frame();
    expect(simulate).toHaveBeenCalledTimes(1);
    pointer('pointercancel', 0, 0);
    key('ArrowUp'); key('ArrowUp'); key('ArrowRight'); key('ArrowLeft');
    expect(simulate).toHaveBeenCalledTimes(1);
    frame();
    expect(simulate).toHaveBeenCalledTimes(2);
    expect(status().textContent).toBe('1.10 v₀ · 0° · ORBIT');
  });

  it('off-screen: input never simulates or renders inline, the drag ends, and the queued aim shows on resume', () => {
    mount(); frame();
    const renders = gpu.render.mock.calls.length;
    pointer('pointerdown', LAUNCH_RADIUS, 0);
    pointer('pointermove', LAUNCH_RADIUS, units(1.1));
    io().callback([{ isIntersecting: false }]);
    expect(frames.size).toBe(0);
    expect(pad().captures.size).toBe(0);
    expect(status().textContent).toBe('DRAG TO LAUNCH ↗');
    for (let i = 0; i < 5; i++) pointer('pointermove', LAUNCH_RADIUS, units(1.1 + i * 0.01));
    pointer('pointerup', LAUNCH_RADIUS, units(1.2));
    key('ArrowUp'); key('ArrowUp');
    ObserverStub.instances[0]!.callback([]); // a resize while paused
    pointer('pointerdown', LAUNCH_RADIUS, 0); // no new drags while paused
    expect(pad().captures.size).toBe(0);
    expect(simulate).not.toHaveBeenCalled();
    expect(gpu.render.mock.calls.length).toBe(renders);
    expect(onOutcome).not.toHaveBeenCalled();
    io().callback([{ isIntersecting: true }]);
    frame();
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(status().textContent).toBe('1.10 v₀ · 0° · ORBIT');
  });
});

describe('cancelling (finding 5 and the drag contract)', () => {
  it.each(['Escape', 'blur'])('%s clears a queued keyboard aim before it is ever rendered', (how) => {
    mount(); frame();
    key('ArrowUp');
    if (how === 'Escape') key('Escape'); else container.dispatchEvent(new Event('blur'));
    frame();
    expect(simulate).not.toHaveBeenCalled();
    expect(status().textContent).toBe('DRAG TO LAUNCH ↗');
  });

  it('keyboard focus queues the current aim; Escape before the frame clears it', () => {
    mount(); frame();
    container.focused = true; container.focusVisible = true;
    container.dispatchEvent(new Event('focus'));
    key('Escape');
    frame();
    expect(simulate).not.toHaveBeenCalled();
    container.dispatchEvent(new Event('focus'));
    frame();
    expect(status().textContent).toBe('1.00 v₀ · 0° · ORBIT');
  });

  it.each(['pointercancel', 'lostpointercapture', 'Escape', 'blur'])('%s cancels a drag and its queued preview without launching', (how) => {
    mount(); frame();
    pointer('pointerdown', LAUNCH_RADIUS, 0);
    pointer('pointermove', LAUNCH_RADIUS, units(1.1));
    if (how === 'Escape') key('Escape');
    else if (how === 'blur') container.dispatchEvent(new Event('blur'));
    else pointer(how, LAUNCH_RADIUS, units(1.1));
    pointer('pointerup', LAUNCH_RADIUS, units(1.1));
    frame();
    expect(simulate).not.toHaveBeenCalled();
    expect(onOutcome).not.toHaveBeenCalled();
    expect(countSaved()).toBe(0);
    expect(status().textContent).toBe('DRAG TO LAUNCH ↗');
    expect(pad().captures.size).toBe(0);
  });
});

describe('launches, visitors and disposal', () => {
  it('keyboard: 5° and 0.05 v₀ steps, clamped speed, held Enter launches once', () => {
    mount(); frame();
    key('ArrowRight'); frame();
    expect(simulate).toHaveBeenLastCalledWith({ angle: expect.closeTo((5 * Math.PI) / 180, 12), speed: 1 }, { dt: 0.005 });
    for (let i = 0; i < 40; i++) key('ArrowUp');
    frame();
    expect(status().textContent).toBe('1.80 v₀ · +5° · ESCAPE');
    for (let i = 0; i < 40; i++) key('ArrowDown');
    key('ArrowLeft');
    frame();
    expect(status().textContent).toBe('0.30 v₀ · 0° · SUBORBITAL');
    for (let i = 0; i < 14; i++) key('ArrowUp'); // 1.00 v₀
    key('Enter'); key('Enter', { repeat: true }); key('Enter', { repeat: true });
    expect(onOutcome).toHaveBeenCalledExactlyOnceWith('orbit', 1);
    expect(countSaved()).toBe(1);
  });

  it('caps live visitors at three, disposing the oldest; restores only closed orbits from storage', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify([
      { angle: 0, speed: 1.1, launchedAt: 1 },
      { angle: 0, speed: 1.37, launchedAt: 2 }, // long period: never restored
      { angle: 0, speed: 10, launchedAt: 3 },   // escape
    ]));
    mount(); frame();
    expect(groups('visitor-orbit')).toHaveLength(1);
    const oldest = groups('visitor-orbit')[0]!;
    const disposed = watchDisposal(oldest);
    for (let i = 0; i < 5; i++) key('Enter');
    frame();
    expect(groups('visitor-orbit')).toHaveLength(3);
    expect(groups('visitor-orbit')).not.toContain(oldest);
    expect(disposed).toHaveBeenCalledTimes(4); // path geometry + material, mesh geometry + material
    expect(countSaved()).toBe(3);
  });

  it('a truncated (long-period) orbit is neither saved, accented nor kept as a satellite', () => {
    mount(); frame();
    drag(units(1.36));
    expect(status().textContent).toBe('1.36 v₀ · ORBIT · LONG PERIOD');
    expect(status().classList.contains('is-success')).toBe(false);
    frame();
    expect(groups('visitor-orbit')).toHaveLength(0);
    expect(groups('flight')).toHaveLength(1);
    expect(countSaved()).toBe(0);
  });

  it('keeps a successful visitor for the visit when storage throws', () => {
    storage.setItem = () => { throw new Error('blocked'); };
    mount(); frame(); key('Enter'); frame();
    expect(groups('visitor-orbit')).toHaveLength(1);
    expect(status().textContent).toBe('1.00 v₀ · ORBIT ACHIEVED');
  });

  it('flights fade out and are disposed; at most two exist at once', () => {
    mount(); frame();
    drag(units(0.6));
    frame();
    const first = groups('flight')[0]!;
    const disposed = watchDisposal(first);
    drag(units(1.6)); drag(units(1.7));
    frame();
    expect(groups('flight')).toHaveLength(2);
    expect(disposed).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 200; i++) frame(100);
    expect(groups('flight')).toHaveLength(0);
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
