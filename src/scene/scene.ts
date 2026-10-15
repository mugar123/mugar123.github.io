import {
  Color, DirectionalLight, Group, HemisphereLight, OrthographicCamera, Scene, Vector3, WebGLRenderer,
  type BufferGeometry, type Material, type Mesh, type MeshLambertMaterial, type Object3D,
} from 'three';
import { simulate, angularSpeed, circularPosition, LAUNCH_RADIUS, type LaunchParams, type Outcome, type Point, type Simulation } from '@/lib/orbit';
import { dragToLaunch } from '@/lib/launch';
import { ORBIT_RADIUS, type SceneSatellite } from '@/lib/satellites';
import { loadVisitorSatellites, saveVisitorSatellite, MAX_VISITOR_SATELLITES } from '@/lib/visitorSatellites';
import { CAMERA_POSITION, VIEW_RADIUS } from './projection';
import { createPlanet } from './planet';
import { ACCENT, INK, INK_2, Trace, createRing, toThree } from './rings';
import { createSatelliteMesh, SATELLITE_SIZE } from './satelliteMesh';
import {
  HINT, DEFAULT_AIM, stepAim, statusText, isSuccess, AMBIENT_RATE, flightTime, packPoints, sampleTrajectory,
  simplifyPath, placeLabels, behindPlanet, padHitRadius, withinPad, exceedsSlop, type LabelItem,
} from './interaction';

export interface MountOptions {
  satellites: SceneSatellite[];
  storage: Storage | null;
  onOutcome?: (outcome: Outcome, speed: number) => void;
  onContextLost?: () => void;
  /**
   * The running scene hit an unexpected error (a frame, an input or resize handler) and destroyed
   * itself; the caller should show its fallback. Without it, `onContextLost` is called instead.
   */
  onFailure?: (error: unknown) => void;
}

/** Time step of every simulation the scene runs; playback relies on samples being exactly this far apart. */
const SIM_DT = 0.005;
/** v₀ per scene unit of drag. Below 1 so a tangential drag (foreshortened to ~45 % on screen) is not twitchy. */
const DRAG_SCALE = 0.4;
/** Drawn paths keep a vertex every PATH_STEP scene units (playback still uses every sample). */
const PATH_STEP = 0.035;
const PATH_CAPACITY = 1536;
const MAX_FLIGHTS = 2;
const IMPACT_HOLD = 0.35;
const FADE_SECONDS = 0.8;
const SETTLE_COLOR_SECONDS = 2.5;
/** A settled visitor's orbit is drawn lighter than the project rings: it is the visitor's, not the owner's. */
const VISITOR_PATH_OPACITY = 0.55;
/** On-screen radius floors (CSS px) so satellites stay legible when the scene is phone-sized. */
const MIN_SATELLITE_PX = 4;
const MIN_VISITOR_PX = 3;
const PAD: Point = { x: LAUNCH_RADIUS, y: 0 };
const DESCRIPTION = 'Arrow keys aim and set the launch speed, Shift for fine steps, Enter launches, Escape clears.';
const KEYS_HINT = '← → AIM · ↑ ↓ SPEED · ENTER LAUNCH · ESC CLEAR';

interface Craft {
  group: Group;
  trace: Trace;
  mesh: Mesh<BufferGeometry, MeshLambertMaterial>;
  xy: Float32Array;
  /** Orbits wrap every period; flights (suborbital, escape, long period) end. */
  period: number | null;
  /** Scene clock at launch, and simulation time already elapsed by then. */
  born: number;
  tau0: number;
  /** Launched during this visit: plays fast, then eases into the ambient rate. */
  fresh: boolean;
  /** Accent → grey settling finished (fresh orbits only). */
  settled: boolean;
  fadeFrom: number | null;
}

interface Drag { id: number; type: string; sx: number; sy: number; origin: Point; moved: boolean }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (tag: string, attrs: Record<string, string> = {}): SVGElement => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const m = o as Partial<Mesh<BufferGeometry, Material | Material[]>>;
    m.geometry?.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}

/**
 * Mounts the orbit scene into `container`: planet, dashed rings, project satellites, the visitor's saved
 * satellites, and the drag-to-launch toy. Every position on screen is read off `orbit.ts` (circular
 * positions, or `simulate` samples); the scene only chooses playback rates. Throws (after cleaning up)
 * if anything fails to build, so the caller can keep the SVG fallback.
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

  // Frame-loop state, declared first: input handlers and the resize observer consult it.
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

    const aimSvg = svg('svg', { class: 'orbit-aim', 'aria-hidden': 'true' });
    const aimLine = svg('line', { class: 'orbit-aim__line' });
    const aimHead = svg('path', { class: 'orbit-aim__head' });
    const aimText = svg('text', { class: 'orbit-aim__label', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    aimText.textContent = 'v₀';
    aimSvg.append(aimLine, aimHead, aimText);
    const pad = el('div', 'orbit-pad', { 'data-testid': 'launch-pad', 'aria-hidden': 'true' });
    const status = el('div', 'orbit-status mono', { role: 'status', 'data-testid': 'launch-status' });
    status.textContent = HINT;
    const keys = el('div', 'orbit-keys mono', { 'aria-hidden': 'true' });
    keys.textContent = KEYS_HINT;
    const descId = `orbit-desc-${Math.random().toString(36).slice(2, 8)}`;
    const desc = el('p', 'visually-hidden', { id: descId });
    desc.textContent = [
      opts.satellites.map((s) => `${s.name} in ${s.orbit} orbit`).join('; '),
      DESCRIPTION,
    ].filter(Boolean).join('. ');
    overlay.append(aimSvg, pad, status, keys, desc);

    // The container becomes the toy's focus target only while the scene runs.
    container.tabIndex = 0;
    container.setAttribute('role', 'application');
    container.setAttribute('aria-label', 'Orbit scene with a launch toy');
    container.setAttribute('aria-describedby', descId);
    cleanups.push(() => {
      for (const a of ['tabindex', 'role', 'aria-label', 'aria-describedby', 'data-ready']) container.removeAttribute(a);
      container.classList.remove('is-aiming');
    });

    // ── Scene ────────────────────────────────────────────────────────────────────────────────
    const scene = new Scene();
    cleanups.push(() => disposeTree(scene));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const forward = camera.getWorldDirection(new Vector3());

    scene.add(new HemisphereLight('#ffffff', '#d8dbd5', 2.4));
    const sun = new DirectionalLight('#ffffff', 1.9);
    sun.position.set(-3, 5, 2);
    scene.add(sun);
    scene.add(createPlanet());
    for (const r of Object.values(ORBIT_RADIUS)) scene.add(createRing(r).line);

    const tmp = new Vector3();
    const tmpP: Point = { x: 0, y: 0 };
    let width = 0, height = 0, pxPerUnit = 1;
    const padPx = { x: 0, y: 0 };
    /** World → container px; returns false when outside the frame (with a margin). */
    const toScreen = (world: Vector3, out: { x: number; y: number }, margin = 0.1): boolean => {
      tmp.copy(world).project(camera);
      out.x = (tmp.x + 1) * 0.5 * width;
      out.y = (1 - tmp.y) * 0.5 * height;
      return Math.abs(tmp.x) <= 1 + margin && Math.abs(tmp.y) <= 1 + margin;
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
    let visitorScale = 1;

    // ── Visitor satellites and flights ───────────────────────────────────────────────────────
    const visitors: Craft[] = [];
    const flights: Craft[] = [];
    const accent = new Color(ACCENT), grey = new Color(INK_2);

    function removeCraft(c: Craft) { scene.remove(c.group); disposeTree(c.group); }
    cleanups.push(() => { visitors.splice(0).forEach(removeCraft); flights.splice(0).forEach(removeCraft); });

    /** One full revolution, closed back onto the pad, for drawing an orbit. */
    function revolution(sim: Simulation): Point[] {
      const n = Math.min(sim.points.length, Math.floor(sim.period! / SIM_DT) + 1);
      return [...sim.points.slice(0, n), sim.points[0]!];
    }

    function createCraft(sim: Simulation, orbit: boolean, fresh: boolean, tau0: number): Craft {
      const path = simplifyPath(orbit ? revolution(sim) : sim.points, PATH_STEP, PATH_CAPACITY + 1);
      const color = orbit ? (fresh ? ACCENT : INK_2) : INK;
      const trace = new Trace(Math.max(1, path.length - 1), { color, width: 1, dash: 0.05, gap: 0.07, transparent: true });
      trace.set(path, orbit);
      const mesh = createSatelliteMesh('visitor', true);
      mesh.material.color.set(color);
      mesh.scale.setScalar(visitorScale);
      if (orbit && !fresh) trace.material.opacity = VISITOR_PATH_OPACITY;
      const group = new Group();
      group.name = orbit ? 'visitor-orbit' : 'flight';
      group.add(trace.line, mesh);
      scene.add(group);
      const c: Craft = { group, trace, mesh, xy: packPoints(sim.points), period: orbit ? sim.period : null, born: clock, tau0, fresh, settled: !fresh, fadeFrom: null };
      updateCraft(c);
      return c;
    }

    function addVisitor(sim: Simulation, fresh: boolean, tau0 = 0) {
      visitors.push(createCraft(sim, true, fresh, tau0));
      while (visitors.length > MAX_VISITOR_SATELLITES) removeCraft(visitors.shift()!);
    }

    function addFlight(sim: Simulation) {
      flights.push(createCraft(sim, false, true, 0));
      while (flights.length > MAX_FLIGHTS) removeCraft(flights.shift()!);
    }

    /** Places a craft for the current clock; returns false once a finished flight has faded out. */
    function updateCraft(c: Craft): boolean {
      const age = clock - c.born;
      const tau = c.tau0 + (c.period === null ? flightTime(age, false) : c.fresh ? flightTime(age, true) : AMBIENT_RATE * age);
      const moving = sampleTrajectory(c.xy, SIM_DT, tau, c.period, tmpP);
      toThree(tmpP, c.mesh.position);
      if (c.period !== null) {
        if (!c.settled) {
          const k = Math.exp(-age / SETTLE_COLOR_SECONDS);
          if (k < 0.01) c.settled = true;
          const color = c.trace.material.color.copy(grey);
          if (!c.settled) color.lerp(accent, k);
          c.mesh.material.color.copy(color);
          c.trace.material.opacity = c.settled ? VISITOR_PATH_OPACITY : VISITOR_PATH_OPACITY + (1 - VISITOR_PATH_OPACITY) * k;
        }
        return true;
      }
      if (c.fadeFrom === null) {
        if (!moving) c.fadeFrom = clock + IMPACT_HOLD;
        else if (!toScreen(c.mesh.position, tmpP)) c.fadeFrom = clock;
      }
      if (c.fadeFrom !== null && clock > c.fadeFrom) {
        const k = 1 - (clock - c.fadeFrom) / FADE_SECONDS;
        if (k <= 0) return false;
        c.trace.material.opacity = k;
        c.mesh.material.opacity = k;
      }
      return true;
    }

    // Saved launches: re-simulated from their parameters, oldest first so eviction matches storage.
    for (const v of loadVisitorSatellites(opts.storage).reverse()) {
      try {
        const sim = simulate({ angle: v.angle, speed: v.speed }, { dt: SIM_DT });
        if (!isSuccess(sim)) continue;
        addVisitor(sim, false, (AMBIENT_RATE * Math.max(0, Date.now() - v.launchedAt)) / 1000);
      } catch { /* a corrupt entry is skipped */ }
    }

    // ── Aim preview: dashed predicted path + screen-space velocity arrow ────────────────────
    const preview = new Trace(PATH_CAPACITY, { color: INK, width: 1, dash: 0.06, gap: 0.06 });
    preview.line.visible = false;
    scene.add(preview.line);
    let shownAim: LaunchParams | null = null;
    let statusMode: 'hint' | 'preview' | 'result' = 'hint';

    function setStatus(text: string, mode: typeof statusMode, success = false) {
      if (status.textContent !== text) status.textContent = text;
      status.classList.toggle('is-success', success);
      statusMode = mode;
    }

    function drawArrow(p: LaunchParams) {
      const len = p.speed / DRAG_SCALE; // the tip lands where the pointer is (offset by the grab point)
      const tip = { x: PAD.x + len * Math.sin(p.angle), y: PAD.y + len * Math.cos(p.angle) };
      const end = { x: 0, y: 0 };
      toScreen(toThree(tip, tmp.clone()), end, Infinity);
      const dx = end.x - padPx.x, dy = end.y - padPx.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const hx = end.x - ux * 9, hy = end.y - uy * 9;
      aimLine.setAttribute('x1', `${padPx.x}`); aimLine.setAttribute('y1', `${padPx.y}`);
      aimLine.setAttribute('x2', `${hx}`); aimLine.setAttribute('y2', `${hy}`);
      aimHead.setAttribute('d', `M${end.x} ${end.y} L${hx - uy * 4.5} ${hy + ux * 4.5} L${hx + uy * 4.5} ${hy - ux * 4.5} Z`);
      aimText.setAttribute('x', `${end.x + ux * 14}`); aimText.setAttribute('y', `${end.y + uy * 14}`);
      aimSvg.classList.add('is-on');
    }

    function showAim(p: LaunchParams | null) {
      if (!p) { hideAim(); setStatus(HINT, 'hint'); return; }
      const sim = simulate(p, { dt: SIM_DT });
      preview.material.color.set(isSuccess(sim) ? ACCENT : INK);
      preview.set(simplifyPath(sim.points, PATH_STEP, PATH_CAPACITY + 1));
      preview.line.visible = true;
      shownAim = p;
      drawArrow(p);
      setStatus(statusText(p, sim, false), 'preview');
    }

    function hideAim() {
      preview.line.visible = false;
      preview.clear();
      aimSvg.classList.remove('is-on');
      shownAim = null;
    }

    let aim: LaunchParams = { ...DEFAULT_AIM };
    function launch(p: LaunchParams) {
      hideAim();
      aim = { angle: p.angle, speed: p.speed };
      const sim = simulate(p, { dt: SIM_DT });
      const success = isSuccess(sim);
      setStatus(statusText(p, sim, true), 'result', success);
      if (success) {
        // Only a closed orbit is saved and celebrated; a truncated (long-period) one flies off like an escape.
        saveVisitorSatellite(opts.storage, { angle: p.angle, speed: p.speed, launchedAt: Date.now() });
        addVisitor(sim, true);
      } else {
        addFlight(sim);
      }
      opts.onOutcome?.(sim.outcome, p.speed);
    }

    // At most one preview per animation frame: input only records the latest request, and only the frame
    // loop applies it. While paused (off-screen) the request waits for the next frame; nothing runs inline.
    let pending: LaunchParams | null | undefined;
    function requestAim(p: LaunchParams | null) {
      pending = p;
    }

    // ── Pointer: a drag starts only at the pad; the vector is measured on the orbital plane ──
    let drag: Drag | null = null;
    function planeAt(clientX: number, clientY: number, out: Point): boolean {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height || Math.abs(forward.y) < 1e-6) return false;
      tmp.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1, -1).unproject(camera);
      const t = -tmp.y / forward.y;
      out.x = tmp.x + forward.x * t;
      out.y = -(tmp.z + forward.z * t);
      return Number.isFinite(out.x) && Number.isFinite(out.y);
    }
    function paramsAt(ev: PointerEvent): LaunchParams | null {
      const p = { x: 0, y: 0 };
      if (!drag || !planeAt(ev.clientX, ev.clientY, p)) return null;
      // At the pad, sim +x is radial-out and sim +y is prograde (tangential).
      return dragToLaunch({ tangential: p.y - drag.origin.y, radial: p.x - drag.origin.x }, { scale: DRAG_SCALE });
    }
    function endDrag() {
      if (!drag) return;
      const id = drag.id;
      drag = null;
      pending = undefined;
      container.classList.remove('is-aiming');
      status.removeAttribute('aria-busy');
      if (pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
    }
    function cancelDrag() { endDrag(); hideAim(); setStatus(HINT, 'hint'); }

    listen<PointerEvent>(pad, 'pointerdown', (ev) => {
      if (drag || !running || !ev.isPrimary || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      // The gate is the orbital plane: the down point must lie within the effective pad radius of the
      // pad there (see padHitRadius), and the drag vector is then measured from that accepted point.
      const origin = { x: 0, y: 0 };
      if (!planeAt(ev.clientX, ev.clientY, origin) || !withinPad(origin, PAD, padHitRadius(pxPerUnit))) return;
      // Set before the browser's own mousedown focuses the container, so focus does not preview the keyboard aim.
      drag = { id: ev.pointerId, type: ev.pointerType, sx: ev.clientX, sy: ev.clientY, origin, moved: false };
      pad.setPointerCapture(ev.pointerId);
      container.classList.add('is-aiming');
      status.setAttribute('aria-busy', 'true'); // don't announce every intermediate preview
    });
    listen<PointerEvent>(pad, 'pointermove', (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      if (!drag.moved && !exceedsSlop(ev.clientX - drag.sx, ev.clientY - drag.sy, drag.type)) return;
      drag.moved = true;
      requestAim(paramsAt(ev));
    });
    listen<PointerEvent>(pad, 'pointerup', (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      const p = drag.moved ? paramsAt(ev) : null; // a click, however long, never launches
      endDrag();
      if (p) launch(p); else { hideAim(); setStatus(HINT, 'hint'); }
    });
    const onCancel = (ev: PointerEvent) => { if (drag && ev.pointerId === drag.id) cancelDrag(); };
    listen<PointerEvent>(pad, 'pointercancel', onCancel);
    listen<PointerEvent>(pad, 'lostpointercapture', onCancel);

    // ── Keyboard ─────────────────────────────────────────────────────────────────────────────
    listen<KeyboardEvent>(container, 'keydown', (ev) => {
      if (ev.target !== container || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === 'Escape') {
        const queued = pending !== undefined;
        pending = undefined; // a queued, not yet rendered aim is cleared too
        if (drag) cancelDrag();
        else if (queued || statusMode !== 'hint') { hideAim(); setStatus(HINT, 'hint'); }
        else return;
        ev.preventDefault();
        return;
      }
      if (drag) return;
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (ev.repeat) return; // holding Enter must not machine-gun launches into storage
        pending = undefined;
        launch(aim);
        return;
      }
      const next = stepAim(aim, ev.key, ev.shiftKey);
      if (!next) return;
      ev.preventDefault();
      aim = next;
      requestAim(aim);
    });
    // Keyboard focus shows the current aim, so Enter is never a blind launch; leaving clears an unlaunched aim.
    listen(container, 'focus', () => {
      let keyboard = false;
      try { keyboard = container.matches(':focus-visible'); } catch { keyboard = false; }
      if (keyboard && !drag && statusMode !== 'preview') requestAim(aim);
    });
    listen(container, 'blur', () => {
      const queued = pending !== undefined;
      pending = undefined;
      if (drag) cancelDrag();
      else if (queued || statusMode === 'preview') { hideAim(); setStatus(HINT, 'hint'); }
    });

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
      pxPerUnit = h / (2 * VIEW_RADIUS);
      const aspect = w / h;
      camera.left = -VIEW_RADIUS * aspect; camera.right = VIEW_RADIUS * aspect;
      camera.top = VIEW_RADIUS; camera.bottom = -VIEW_RADIUS;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);

      // The pad's DOM hit target is the gate itself: the plane circle around the pad, an ellipse on screen.
      toScreen(toThree(PAD, new Vector3()), padPx);
      const reach = padHitRadius(pxPerUnit);
      const edge = { x: 0, y: 0 };
      toScreen(toThree({ x: PAD.x, y: PAD.y + reach }, new Vector3()), edge);
      const rx = reach * pxPerUnit, ry = Math.abs(edge.y - padPx.y);
      pad.style.width = `${2 * rx}px`;
      pad.style.height = `${2 * ry}px`;
      pad.style.transform = `translate(${padPx.x - rx}px, ${padPx.y - ry}px)`;
      overlay.style.setProperty('--label-max', `${Math.round(w * 0.4)}px`);
      for (const p of projects) {
        const rPx = Math.max(p.size * pxPerUnit, MIN_SATELLITE_PX);
        p.mesh.scale.setScalar(rPx / (p.size * pxPerUnit));
        p.label.style.setProperty('--sat-r', `${rPx.toFixed(1)}px`);
        p.item.r = rPx;
        p.item.gap = rPx + 14;
      }
      visitorScale = Math.max(1, MIN_VISITOR_PX / (SATELLITE_SIZE.visitor * pxPerUnit));
      for (const c of [...visitors, ...flights]) c.mesh.scale.setScalar(visitorScale);
      measureLabels();
      // Status: below-right of the pad when it fits, otherwise along the bottom edge of the frame.
      const roomRight = w - padPx.x - 24;
      container.classList.toggle('is-narrow', roomRight < 300);
      if (roomRight >= 300) status.style.transform = `translate(${Math.round(padPx.x + 14)}px, ${Math.round(padPx.y + 16)}px)`;
      else status.style.removeProperty('transform');
      if (shownAim) drawArrow(shownAim);
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
      for (const v of visitors) updateCraft(v);
      for (let i = flights.length - 1; i >= 0; i--) {
        if (!updateCraft(flights[i]!)) removeCraft(flights.splice(i, 1)[0]!);
      }
    }

    function flush() {
      if (destroyed) return;
      if (pending !== undefined) { showAim(pending); pending = undefined; }
      update();
      renderer.render(scene, camera);
      // Ready = a real frame is on screen; a zero-size container (not laid out yet) keeps the fallback.
      if (width > 0 && container.getAttribute('data-ready') !== 'true') container.setAttribute('data-ready', 'true');
    }

    /** One frame; any exception (render, preview, update) destroys the scene and restores the fallback. */
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
        // Off-screen: stop the loop, and end any drag rather than let it run (or launch) unseen.
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (drag) cancelDrag();
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
