import {
  Color, DirectionalLight, HemisphereLight, OrthographicCamera, Scene, Vector3, WebGLRenderer,
  type BufferGeometry, type Material, type Mesh, type Object3D,
} from 'three';
import { angularSpeed, circularPosition } from '@/lib/orbit';
import { ORBIT_RADIUS, SCENE_LABEL, describeSatellites, type SceneSatellite } from '@/lib/satellites';
import { CAMERA_POSITION, VIEW_RADIUS } from './projection';
import { createPlanet } from './planet';
import { createRing, toThree } from './rings';
import { createSatelliteMesh, SATELLITE_SIZE } from './satelliteMesh';
import { placeLabels, behindPlanet, type LabelItem } from './labels';

export interface MountOptions {
  satellites: SceneSatellite[];
  onContextLost?: () => void;
  /**
   * The running scene hit an unexpected error (a frame or the resize handler) and destroyed itself;
   * the caller should show its fallback. Without it, `onContextLost` is called instead.
   */
  onFailure?: (error: unknown) => void;
}

/** Simulation time units per second: the pace at which the satellites go round. */
const AMBIENT_RATE = 0.15;
/** On-screen radius floor (CSS px) so satellites stay legible when the scene is phone-sized. */
const MIN_SATELLITE_PX = 4;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const m = o as Partial<Mesh<BufferGeometry, Material | Material[]>>;
    m.geometry?.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}

/**
 * Mounts the orbit scene into `container`: planet, dashed rings and the project satellites with their
 * labels. Every position on screen is read off `orbit.ts` (circular positions at Kepler's angular speed);
 * the scene only chooses the playback rate. Nothing in it is interactive: assistive technology gets one
 * still image, named and described like the SVG fallback. Throws (after cleaning up) if anything fails
 * to build, so the caller can keep the SVG fallback.
 */
export function mountOrbitScene(container: HTMLElement, opts: MountOptions): { destroy(): void } {
  const cleanups: (() => void)[] = [];
  let destroyed = false;
  let contextLost = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    while (cleanups.length) {
      try { cleanups.pop()!(); } catch { /* keep tearing down */ }
    }
  };
  /** After mount, any error tears the scene down and hands back to the fallback instead of freezing it. */
  const fail = (error: unknown) => {
    if (destroyed) return;
    console.info('[orbit] scene failed; showing the static fallback', error);
    destroy();
    if (opts.onFailure) opts.onFailure(error); else opts.onContextLost?.();
  };
  /** Runs a callback unless the scene is gone; an exception becomes `fail`. */
  const guard = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A): void => {
    if (destroyed) return;
    try { fn(...args); } catch (error) { fail(error); }
  };
  const listen = <E extends Event>(target: EventTarget, type: string, fn: (ev: E) => void, options?: AddEventListenerOptions) => {
    const h = guard(fn) as EventListener;
    target.addEventListener(type, h, options);
    cleanups.push(() => target.removeEventListener(type, h, options));
  };

  // Frame-loop state, declared first: the resize and visibility observers consult it.
  let raf = 0, running = true, last = 0, clock = 0;

  try {
    // ── Renderer, stage and overlay ──────────────────────────────────────────────────────────
    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    cleanups.push(() => { renderer.dispose(); if (!contextLost) renderer.forceContextLoss(); });
    renderer.setClearColor(new Color('#000000'), 0);
    const canvas = renderer.domElement;
    canvas.className = 'orbit-canvas';

    const stage = el('div', 'orbit-stage');
    const overlay = el('div', 'orbit-overlay');
    stage.append(canvas, overlay);
    container.append(stage);
    cleanups.push(() => stage.remove());

    // One still image for assistive technology (its children, the fallback included, are presentational).
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', SCENE_LABEL);
    const description = describeSatellites(opts.satellites);
    if (description) {
      const descId = `orbit-desc-${Math.random().toString(36).slice(2, 8)}`;
      const desc = el('p', 'visually-hidden', { id: descId });
      desc.textContent = description;
      overlay.append(desc);
      container.setAttribute('aria-describedby', descId);
    }
    cleanups.push(() => {
      for (const a of ['role', 'aria-label', 'aria-describedby', 'data-ready']) container.removeAttribute(a);
    });

    // ── Scene ────────────────────────────────────────────────────────────────────────────────
    const scene = new Scene();
    cleanups.push(() => disposeTree(scene));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    scene.add(new HemisphereLight('#ffffff', '#d8dbd5', 2.4));
    const sun = new DirectionalLight('#ffffff', 1.9);
    sun.position.set(-3, 5, 2);
    scene.add(sun);
    scene.add(createPlanet());
    for (const r of Object.values(ORBIT_RADIUS)) scene.add(createRing(r).line);

    const tmp = new Vector3();
    let width = 0, height = 0;
    /** World → container px. */
    const toScreen = (world: Vector3, out: { x: number; y: number }): void => {
      tmp.copy(world).project(camera);
      out.x = (tmp.x + 1) * 0.5 * width;
      out.y = (1 - tmp.y) * 0.5 * height;
    };

    // Project satellites: positions from circularPosition/angularSpeed; labels are DOM, placed per frame.
    const projects = opts.satellites.flatMap((s) => {
      const radius = ORBIT_RADIUS[s.orbit];
      if (!radius) return [];
      const kind = s.status === 'active' ? 'active' : 'muted';
      const mesh = createSatelliteMesh(kind);
      scene.add(mesh);
      const label = el('span', 'orbit-label mono', { 'aria-hidden': 'true' });
      const text = el('span', 'orbit-label__text');
      text.textContent = s.name.toUpperCase();
      label.append(text);
      label.style.setProperty('--sat-r', '0px');
      overlay.prepend(label);
      const item: LabelItem = { x: 0, y: 0, r: 0, w: 0, h: 0, gap: 14, right: true };
      return [{ s, radius, omega: angularSpeed(radius), mesh, label, text, item, size: SATELLITE_SIZE[kind], hidden: false }];
    });
    const labelItems = projects.map((p) => p.item);
    /** Chip sizes, for collision checks (re-measured on resize and once web fonts are in). */
    const measureLabels = () => {
      for (const p of projects) { p.item.w = p.text.offsetWidth; p.item.h = p.text.offsetHeight; }
    };
    document.fonts?.ready.then(() => { if (!destroyed) measureLabels(); }, () => {});

    // ── Context loss: hand back to the static fallback (spec §6.5) ──────────────────────────
    listen(canvas, 'webglcontextlost', (ev) => {
      ev.preventDefault();
      contextLost = true;
      console.info('[orbit] WebGL context lost; showing the static fallback');
      destroy();
      opts.onContextLost?.();
    });

    // ── Layout ───────────────────────────────────────────────────────────────────────────────
    function layout() {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      width = w; height = h;
      const pxPerUnit = h / (2 * VIEW_RADIUS);
      const aspect = w / h;
      camera.left = -VIEW_RADIUS * aspect; camera.right = VIEW_RADIUS * aspect;
      camera.top = VIEW_RADIUS; camera.bottom = -VIEW_RADIUS;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      overlay.style.setProperty('--label-max', `${Math.round(w * 0.4)}px`);
      for (const p of projects) {
        const rPx = Math.max(p.size * pxPerUnit, MIN_SATELLITE_PX);
        p.mesh.scale.setScalar(rPx / (p.size * pxPerUnit));
        p.label.style.setProperty('--sat-r', `${rPx.toFixed(1)}px`);
        p.item.r = rPx;
        p.item.gap = rPx + 14;
      }
      measureLabels();
    }
    const ro = new ResizeObserver(guard(() => layout())); // the next frame redraws; nothing renders inline
    ro.observe(container);
    cleanups.push(() => ro.disconnect());
    layout();

    // ── Frame loop: pauses off-screen; one loop at most ──────────────────────────────────────
    const satWorld = new Vector3();

    function update() {
      for (const p of projects) {
        const pos = circularPosition(p.radius, p.s.phase + p.omega * AMBIENT_RATE * clock);
        toThree(pos, satWorld);
        p.mesh.position.copy(satWorld);
        toScreen(satWorld, p.item);
        p.label.style.transform = `translate(${p.item.x.toFixed(1)}px, ${p.item.y.toFixed(1)}px)`;
        const hidden = behindPlanet(satWorld, CAMERA_POSITION);
        if (hidden !== p.hidden) { p.hidden = hidden; p.label.classList.toggle('is-occluded', hidden); }
      }
      const sides = placeLabels(labelItems, width);
      projects.forEach((p, i) => {
        const right = sides[i]!;
        if (right !== p.item.right) { p.item.right = right; p.label.classList.toggle('is-left', !right); }
      });
    }

    function flush() {
      if (destroyed) return;
      update();
      renderer.render(scene, camera);
      // Ready = a real frame is on screen; a zero-size container (not laid out yet) keeps the fallback.
      if (width > 0 && container.getAttribute('data-ready') !== 'true') container.setAttribute('data-ready', 'true');
    }

    /** One frame; any exception (render or update) destroys the scene and restores the fallback. */
    function frame(now: number) {
      raf = 0;
      if (destroyed || !running) return;
      try {
        clock += last ? Math.min((now - last) / 1000, 0.1) : 0;
        last = now;
        flush();
      } catch (error) {
        fail(error);
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    function setRunning(on: boolean) {
      running = on;
      if (!on) {
        // Off-screen: stop the loop; the clock holds, so the satellites resume where they were.
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      if (!raf && !destroyed) { last = 0; raf = requestAnimationFrame(frame); }
    }
    cleanups.push(() => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; });

    const io = new IntersectionObserver(guard((entries: IntersectionObserverEntry[]) => {
      const e = entries[entries.length - 1];
      if (e) setRunning(e.isIntersecting);
    }), { threshold: 0.02 });
    io.observe(container);
    cleanups.push(() => io.disconnect());
    setRunning(true);
  } catch (err) {
    destroy();
    throw err;
  }

  return { destroy };
}
