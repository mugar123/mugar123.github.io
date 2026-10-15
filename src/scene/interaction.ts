/**
 * Pure helpers for the orbit scene's launch toy and its DOM overlay: keyboard aiming, status text,
 * playback of simulated trajectories, and overlay geometry. No DOM, no Three — unit-tested.
 *
 * Motion is never computed here: positions are read off the `points` that `simulate` produced
 * (uniform in time), only the playback rate is chosen.
 */
import { formatSpeed, MIN_SPEED, MAX_SPEED } from '@/lib/launch';
import type { LaunchParams, Point, Simulation } from '@/lib/orbit';

export const HINT = 'DRAG TO LAUNCH ↗';
export const DEFAULT_AIM: Readonly<LaunchParams> = { angle: 0, speed: 1 };

const DEG = Math.PI / 180;

/**
 * Keyboard aiming. ArrowUp/Down change speed by 0.05 v₀ and ArrowRight/Left tilt the launch by 5°
 * outward/inward (positive angle = towards radial-out, which is screen-right at the pad); with Shift the
 * steps are 0.01 v₀ and 1°. The aim snaps onto that grid, so repeated steps never drift. Returns `null`
 * for keys that do not aim.
 */
export function stepAim(aim: LaunchParams, key: string, fine = false): LaunchParams | null {
  const dDeg = fine ? 1 : 5;
  const dV = fine ? 1 : 5; // hundredths of v₀
  let deg = Math.round(aim.angle / DEG);
  let hundredths = Math.round(aim.speed * 100);
  switch (key) {
    case 'ArrowRight': deg += dDeg; break;
    case 'ArrowLeft': deg -= dDeg; break;
    case 'ArrowUp': hundredths += dV; break;
    case 'ArrowDown': hundredths -= dV; break;
    default: return null;
  }
  deg = ((((deg + 180) % 360) + 360) % 360) - 180; // [−180, 180)
  if (deg === -180) deg = 180;                       // (−180, 180]
  const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, hundredths / 100));
  return { angle: deg * DEG, speed };
}

export function formatAngle(angle: number): string {
  const d = Math.round(angle / DEG);
  return d === 0 ? '0°' : `${d > 0 ? '+' : '−'}${Math.abs(d)}°`;
}

type Verdict = Pick<Simulation, 'outcome' | 'truncated'>;

/** Only an orbit that closed within the simulation is a success: the one result that is celebrated and saved. */
export const isSuccess = (sim: Verdict): boolean => sim.outcome === 'orbit' && !sim.truncated;

export function outcomeLabel(sim: Verdict, launched: boolean): string {
  if (sim.outcome === 'orbit') return sim.truncated ? 'ORBIT · LONG PERIOD' : launched ? 'ORBIT ACHIEVED' : 'ORBIT';
  return sim.outcome === 'escape' ? 'ESCAPE' : 'SUBORBITAL';
}

/**
 * Status line. After a launch: `<speed> v₀ · OUTCOME` (the contract Task 14 asserts). While aiming, the
 * angle is included too — keyboard and screen-reader users have no other readout of it.
 */
export function statusText(p: LaunchParams, sim: Verdict, launched: boolean): string {
  return launched
    ? `${formatSpeed(p.speed)} · ${outcomeLabel(sim, true)}`
    : `${formatSpeed(p.speed)} · ${formatAngle(p.angle)} · ${outcomeLabel(sim, false)}`;
}

/** Simulation time units per second for everything at rest (project satellites, settled visitors). */
export const AMBIENT_RATE = 0.15;
/** Playback rate of a launch: fast enough that a suborbital hop or an escape reads in a second or two. */
export const FLIGHT_RATE = 1.5;
/** Time constant (s) with which a new orbit eases from FLIGHT_RATE down to AMBIENT_RATE. */
export const SETTLE_SECONDS = 1.2;

/**
 * Simulation time elapsed `age` seconds after a launch. A flight plays at FLIGHT_RATE; an orbit starts
 * there and eases exponentially into AMBIENT_RATE (closed form of ∫ rate dt, so it never drifts).
 */
export function flightTime(age: number, settles: boolean): number {
  if (!settles) return FLIGHT_RATE * age;
  return AMBIENT_RATE * age + (FLIGHT_RATE - AMBIENT_RATE) * SETTLE_SECONDS * (1 - Math.exp(-age / SETTLE_SECONDS));
}

/** Interleaved `x, y` samples: a compact copy of a trajectory for playback. */
export function packPoints(points: readonly Point[]): Float32Array {
  const xy = new Float32Array(points.length * 2);
  points.forEach((p, i) => { xy[2 * i] = p.x; xy[2 * i + 1] = p.y; });
  return xy;
}

/**
 * Writes into `out` the position at simulation time `tau` along `xy` (samples `dt` apart, as `simulate`
 * records them), interpolating between samples. A periodic path wraps every `period`. Returns `false`
 * once a non-periodic path has ended (`out` then holds its last sample).
 */
export function sampleTrajectory(xy: ArrayLike<number>, dt: number, tau: number, period: number | null, out: Point): boolean {
  const n = xy.length / 2;
  if (n === 0) return false;
  const last = n - 1;
  let t = tau;
  let running = true;
  if (period !== null && period > 0) t = ((tau % period) + period) % period;
  else if (tau >= last * dt) { t = last * dt; running = false; }
  const f = Math.max(0, t / dt);
  const i = Math.min(last, Math.floor(f));
  const j = Math.min(last, i + 1);
  const k = j === i ? 0 : f - i;
  out.x = xy[2 * i]! + (xy[2 * j]! - xy[2 * i]!) * k;
  out.y = xy[2 * i + 1]! + (xy[2 * j + 1]! - xy[2 * i + 1]!) * k;
  return running;
}

/**
 * Drops samples closer than `minSegment` to the last kept one (the path is for drawing only; playback
 * uses every sample). Endpoints are always kept; the step grows until at most `maxPoints` remain.
 */
export function simplifyPath(points: readonly Point[], minSegment: number, maxPoints: number): Point[] {
  if (points.length <= 2) return [...points];
  let step = minSegment;
  for (;;) {
    const out: Point[] = [points[0]!];
    let last = points[0]!;
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i]!;
      if (Math.hypot(p.x - last.x, p.y - last.y) >= step) { out.push(p); last = p; }
    }
    out.push(points[points.length - 1]!);
    if (out.length <= maxPoints) return out;
    step *= out.length / maxPoints + 0.05;
  }
}

/** Label side, the SVG fallback's rule: right of the satellite unless it sits in the right 38 % of the frame. */
export const labelOnRight = (xFraction: number): boolean => xFraction < 0.62;

export interface LabelItem {
  /** Satellite on screen (px) and its radius, label chip size (px), and the gap from satellite centre to chip edge. */
  x: number; y: number; r: number; w: number; h: number; gap: number;
  /** Side the label is on now (for hysteresis). */
  right: boolean;
}
/** Extra clearance required before a label moves to a different side, so it never flickers. */
const SWITCH_CLEARANCE = 8;

/**
 * Chooses a side for each label in priority order. A side costs the area by which its chip would cover
 * other satellites or already placed chips, plus the area it would stick out of the frame. The
 * fallback's preferred side wins unless the other side costs strictly less; the side a label is not on
 * yet is measured with SWITCH_CLEARANCE px of margin, so labels never flicker between sides. Returns
 * `true` for "right" per item.
 */
export function placeLabels(items: readonly LabelItem[], frameWidth: number): boolean[] {
  const taken = items.map((it) => ({ l: it.x - it.r, r: it.x + it.r, t: it.y - it.r, b: it.y + it.r }));
  const box = (it: LabelItem, right: boolean) => ({
    l: right ? it.x + it.gap : it.x - it.gap - it.w,
    r: right ? it.x + it.gap + it.w : it.x - it.gap,
    t: it.y - it.h / 2,
    b: it.y + it.h / 2,
  });
  const cost = (it: LabelItem, right: boolean) => {
    const m = right === it.right ? 0 : SWITCH_CLEARANCE;
    const a = box(it, right);
    let c = (Math.max(0, -a.l) + Math.max(0, a.r - frameWidth)) * it.h;
    for (const q of taken) {
      const w = Math.min(a.r + m, q.r) - Math.max(a.l - m, q.l);
      const h = Math.min(a.b + m, q.b) - Math.max(a.t - m, q.t);
      if (w > 0 && h > 0) c += w * h;
    }
    return c;
  };
  return items.map((it) => {
    const pref = labelOnRight(it.x / frameWidth);
    const keep = cost(it, pref);
    const right = keep > 0 && cost(it, !pref) < keep ? !pref : pref;
    taken.push(box(it, right));
    return right;
  });
}

/**
 * Whether a world point is hidden behind the unit planet for an orthographic camera at `camera` looking
 * at the origin: within the planet's silhouette and farther than its centre.
 */
export function behindPlanet(p: { x: number; y: number; z: number }, camera: readonly [number, number, number], radius = 1): boolean {
  const len = Math.hypot(camera[0], camera[1], camera[2]);
  const along = -(p.x * camera[0] + p.y * camera[1] + p.z * camera[2]) / len; // > 0: beyond the centre
  const perp2 = p.x * p.x + p.y * p.y + p.z * p.z - along * along;
  return along > 0 && perp2 < radius * radius;
}

/** Drags start within this distance of the pad (scene units, measured on screen). */
export const PAD_HIT_RADIUS = 0.6;
/** …but never within less than this many CSS px: a 44 px touch target on small scenes. */
export const MIN_PAD_HIT_PX = 22;
export const padHitRadiusPx = (pxPerUnit: number): number => Math.max(PAD_HIT_RADIUS * pxPerUnit, MIN_PAD_HIT_PX);

/** Movement (CSS px) below which a press is a click, not a drag; fingers jitter more than mice. */
export function exceedsSlop(dx: number, dy: number, pointerType: string): boolean {
  const slop = pointerType === 'touch' ? 10 : 4;
  return dx * dx + dy * dy > slop * slop;
}
