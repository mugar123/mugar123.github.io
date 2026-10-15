/**
 * The <OrbitScene> island's boot sequence (src/scene/island.ts): scheduling, the reduced-motion race
 * during lazy loading (fix round 1, finding 2), and every route back to the fallback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElementStub } from '../helpers/sceneDom';
import { bootOrbitScene, FADE_MS, type BootDeps } from '@/scene/island';
import type { MountOptions } from '@/scene/scene';

type Fn = () => void;
let el: ElementStub;
let fallback: ElementStub;
let motion: { matches: boolean; listeners: ((e: { matches: boolean }) => void)[]; addEventListener(t: 'change', f: (e: { matches: boolean }) => void): void; set(on: boolean): void };
let near: Fn | null, idle: Fn | null, ready: Fn | null;
let timers: { fn: Fn; ms: number; cancelled: boolean }[];
let cancelled: string[];
let capable: boolean;
let mountOpts: MountOptions | null;
const destroy = vi.fn();
const mountOrbitScene = vi.fn((_el: HTMLElement, opts: MountOptions) => { mountOpts = opts; return { destroy }; });

/** An import whose promise the test settles. */
function deferredLoad() {
  let resolve!: () => void, reject!: (e: Error) => void;
  const promise = new Promise<{ mountOrbitScene: typeof mountOrbitScene }>((res, rej) => {
    resolve = () => res({ mountOrbitScene });
    reject = rej;
  });
  return { load: vi.fn(() => promise), resolve, reject };
}
function boot(extra: Partial<BootDeps> = {}) {
  const deps: Partial<BootDeps> = {
    canRender: () => capable && !motion.matches,
    load: async () => ({ mountOrbitScene }),
    reducedMotion: motion,
    whenNear: (_e, fn) => { near = fn; return () => { cancelled.push('near'); near = null; }; },
    idle: (fn) => { idle = fn; return () => { cancelled.push('idle'); idle = null; }; },
    later: (fn, ms) => { const t = { fn, ms, cancelled: false }; timers.push(t); return () => { t.cancelled = true; }; },
    watchReady: (_e, fn) => { ready = fn; return () => { cancelled.push('ready'); ready = null; }; },
    ...extra,
  };
  bootOrbitScene(el as unknown as HTMLElement, deps);
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const state = () => el.getAttribute('data-state');

beforeEach(() => {
  vi.clearAllMocks();
  el = new ElementStub('div');
  el.setAttribute('data-state', 'fallback');
  el.setAttribute('data-satellites', '[{"id":"p","name":"PaperTok","orbit":"high","status":"active","href":"/work/p","phase":0}]');
  fallback = new ElementStub('div');
  fallback.setAttribute('data-fallback', '');
  el.append(fallback);
  motion = {
    matches: false, listeners: [],
    addEventListener(_t, f) { this.listeners.push(f); },
    set(on) { this.matches = on; for (const f of this.listeners) f({ matches: on }); },
  };
  near = idle = ready = null;
  timers = [];
  cancelled = [];
  capable = true;
  mountOpts = null;
  vi.stubGlobal('window', {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('bootOrbitScene', () => {
  it('leaves an incapable browser on the fallback and schedules nothing', () => {
    capable = false;
    boot();
    expect(state()).toBe('fallback');
    expect(near).toBeNull();
  });

  it('mounts once near and idle, then hides the fallback only after the first frame and the fade', async () => {
    boot();
    expect(state()).toBe('pending');
    near!(); idle!();
    await flush();
    expect(mountOrbitScene).toHaveBeenCalledTimes(1);
    expect(mountOpts!.satellites[0]!.name).toBe('PaperTok');
    expect(state()).toBe('webgl');
    expect(fallback.hasAttribute('hidden')).toBe(false);
    el.setAttribute('data-ready', 'true');
    ready!();
    expect(timers[0]!.ms).toBe(FADE_MS);
    timers[0]!.fn();
    expect(fallback.hasAttribute('hidden')).toBe(true);
  });

  it('reduced motion switched on during the idle wait cancels the idle work and never loads Three', async () => {
    const d = deferredLoad();
    boot({ load: d.load });
    near!();
    motion.set(true);
    expect(cancelled).toContain('idle');
    expect(idle).toBeNull();
    await flush();
    expect(d.load).not.toHaveBeenCalled();
    expect(state()).toBe('fallback');
    expect(fallback.hasAttribute('hidden')).toBe(false);
  });

  it('reduced motion switched on before the import resolves: nothing mounts', async () => {
    const d = deferredLoad();
    boot({ load: d.load });
    near!(); idle!();
    expect(d.load).toHaveBeenCalledTimes(1);
    motion.set(true);
    expect(state()).toBe('fallback');
    d.resolve();
    await flush();
    expect(mountOrbitScene).not.toHaveBeenCalled();
    expect(state()).toBe('fallback');
  });

  it('re-checks the capability after the import resolves and before mounting', async () => {
    const d = deferredLoad();
    boot({ load: d.load });
    near!(); idle!();
    capable = false; // e.g. WebGL went away, or save-data switched on, while downloading
    d.resolve();
    await flush();
    expect(mountOrbitScene).not.toHaveBeenCalled();
    expect(state()).toBe('fallback');
  });

  it('a failed import keeps the fallback', async () => {
    const d = deferredLoad();
    boot({ load: d.load });
    near!(); idle!();
    d.reject(new Error('offline'));
    await flush();
    expect(state()).toBe('fallback');
    expect(mountOrbitScene).not.toHaveBeenCalled();
  });

  it('a throwing mount keeps the fallback visible', async () => {
    mountOrbitScene.mockImplementationOnce(() => { throw new Error('no GPU'); });
    boot();
    near!(); idle!();
    await flush();
    expect(state()).toBe('fallback');
    expect(fallback.hasAttribute('hidden')).toBe(false);
  });

  it.each(['onFailure', 'onContextLost'] as const)('%s from the running scene restores the fallback and cancels the pending fade', async (cb) => {
    boot();
    near!(); idle!();
    await flush();
    el.setAttribute('data-ready', 'true');
    ready!();
    const fade = timers[0]!;
    if (cb === 'onFailure') mountOpts!.onFailure!(new Error('GPU')); else mountOpts!.onContextLost!();
    el.removeAttribute('data-ready');
    expect(state()).toBe('fallback');
    expect(fade.cancelled).toBe(true);
    expect(fallback.hasAttribute('hidden')).toBe(false);
    expect(destroy).toHaveBeenCalledTimes(1); // idempotent on the scene side
  });

  it('reduced motion switched on while running destroys the scene and shows the fallback', async () => {
    boot();
    near!(); idle!();
    await flush();
    el.setAttribute('data-ready', 'true');
    ready!(); timers[0]!.fn();
    expect(fallback.hasAttribute('hidden')).toBe(true);
    motion.set(true);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(state()).toBe('fallback');
    expect(fallback.hasAttribute('hidden')).toBe(false);
  });
});
