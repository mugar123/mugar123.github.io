/**
 * Boot logic of the <OrbitScene> island, kept out of the .astro file so its races can be unit-tested.
 *
 * Lifecycle: `fallback` (server HTML) → `pending` (capable browser; waiting for the hero to be near the
 * viewport, then for an idle moment, then for the Three chunk) → `webgl` (mounted). Anything that rules
 * the scene out — reduced motion switched on at any point, a failed import, a capability re-check after
 * the import, a mount error, a lost context or a failure inside the running scene — ends in `fallback`
 * for good: scheduled work is cancelled and the SVG is shown again.
 */
import { canRenderScene, browserEnv } from './capabilities';
import type { MountOptions } from './scene';
import type { SceneSatellite } from '@/lib/satellites';

/** Matches the CSS cross-fade: the fallback is hidden once the scene has faded in over it. */
export const FADE_MS = 500;

type Cancel = () => void;
type SceneModule = { mountOrbitScene: (container: HTMLElement, opts: MountOptions) => { destroy(): void } };
interface MediaQueryLike { matches: boolean; addEventListener?(type: 'change', fn: (e: { matches: boolean }) => void): void }

export interface BootDeps {
  /** Capability check; run before scheduling and again after the import resolves. */
  canRender: () => boolean;
  /** Loads the scene chunk (Three included). */
  load: () => Promise<SceneModule>;
  reducedMotion: MediaQueryLike | null;
  /** Calls `fn` once the element is near the viewport. */
  whenNear: (el: HTMLElement, fn: () => void) => Cancel;
  /** Calls `fn` when the main thread is idle. */
  idle: (fn: () => void) => Cancel;
  later: (fn: () => void, ms: number) => Cancel;
  /** Calls `fn` when the scene marks its first rendered frame (`data-ready="true"`). */
  watchReady: (el: HTMLElement, fn: () => void) => Cancel;
}

const browserDeps = (): BootDeps => ({
  canRender: () => canRenderScene(browserEnv()),
  load: () => import('./scene'),
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null,
  whenNear: (el, fn) => {
    if (!('IntersectionObserver' in window)) { fn(); return () => {}; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      fn();
    }, { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  },
  idle: (fn) => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => fn(), { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(fn, 200); // Safari has no requestIdleCallback
    return () => clearTimeout(id);
  },
  later: (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
  watchReady: (el, fn) => {
    const mo = new MutationObserver(() => {
      if (el.getAttribute('data-ready') !== 'true') return;
      mo.disconnect();
      fn();
    });
    mo.observe(el, { attributes: true, attributeFilter: ['data-ready'] });
    return () => mo.disconnect();
  },
});

export function bootOrbitScene(el: HTMLElement, overrides: Partial<BootDeps> = {}): void {
  const d: BootDeps = { ...browserDeps(), ...overrides };
  if (!d.canRender()) { console.info('[orbit] static fallback'); return; }

  el.setAttribute('data-state', 'pending');
  const fallback = el.querySelector('[data-fallback]');
  let stopped = false;
  let handle: { destroy(): void } | null = null;
  const pendingWork = new Set<Cancel>();
  const track = (cancel: Cancel) => { pendingWork.add(cancel); return cancel; };

  /** Final state: the static fallback. Cancels whatever is scheduled and tears down a mounted scene. */
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const cancel of pendingWork) cancel();
    pendingWork.clear();
    const h = handle;
    handle = null;
    h?.destroy();
    fallback?.removeAttribute('hidden');
    el.setAttribute('data-state', 'fallback');
  };

  // Reduced motion switched on mid-visit — while waiting, while the chunk downloads, or while running.
  d.reducedMotion?.addEventListener?.('change', (e) => { if (e.matches) stop(); });

  const start = async () => {
    let mod: SceneModule;
    try {
      mod = await d.load();
    } catch (err) {
      if (!stopped) console.info('[orbit] scene failed to load; showing the static fallback', err);
      stop();
      return;
    }
    if (stopped) return;
    // The world may have changed during the idle wait and the download: check again before mounting.
    if (d.reducedMotion?.matches || !d.canRender()) { console.info('[orbit] static fallback'); stop(); return; }
    try {
      const satellites = JSON.parse(el.getAttribute('data-satellites') ?? '[]') as SceneSatellite[];
      track(d.watchReady(el, () => {
        track(d.later(() => {
          if (!stopped && el.getAttribute('data-ready') === 'true') fallback?.setAttribute('hidden', '');
        }, FADE_MS));
      }));
      handle = mod.mountOrbitScene(el, { satellites, onContextLost: stop, onFailure: stop });
      el.setAttribute('data-state', 'webgl');
    } catch (err) {
      console.info('[orbit] scene failed to start; showing the static fallback', err);
      stop();
    }
  };

  // Three is fetched only once the hero is (nearly) on screen and the main thread is idle.
  track(d.whenNear(el, () => {
    if (stopped) return;
    track(d.idle(() => { if (!stopped) void start(); }));
  }));
}
