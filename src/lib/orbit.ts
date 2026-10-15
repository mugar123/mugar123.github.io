/**
 * Two-body motion around a planet of radius 1 with GM = 1.
 *
 * The launch pad sits at (LAUNCH_RADIUS, 0). At the pad, local horizontal is +y (counter-clockwise,
 * prograde) and radial is +x. A launch `angle` is measured from local horizontal towards radial-out,
 * so `angle = 0` is a prograde tangential launch; `speed` is in units of circular speed at r = 1.
 *
 * Pure functions only: no DOM, no Three. The scene draws what this module computes.
 */
export type Outcome = 'suborbital' | 'orbit' | 'escape';
export interface LaunchParams { angle: number; speed: number }
export interface Point { x: number; y: number }
export interface Simulation {
  /**
   * Positions one `dt` apart in time, starting at the pad. An impact ends exactly on the surface (r = 1),
   * whether it was sampled or the conic grazed below the surface between samples; a truncated path that
   * has not reached its periapsis yet ends mid-flight.
   */
  points: Point[];
  outcome: Outcome;
  /** Specific energy of the last integrated state (the integrator's own conservation check). */
  energy: number;
  /** Analytic periapsis for an orbit; otherwise the closest approach along `points`. */
  periapsis: number;
  /** Analytic apoapsis for an orbit, `null` otherwise. */
  apoapsis: number | null;
  /** Analytic period 2π·a^1.5 for an orbit, `null` otherwise. */
  period: number | null;
  /** `maxSteps` ran out before the outcome was measured; the outcome is then inferred from the launch conic. */
  truncated: boolean;
}
export interface OrbitalElements {
  energy: number;
  a: number | null;
  e: number;
  rp: number;
  ra: number | null;
  period: number | null;
}
export interface SimulateOptions { dt?: number; maxSteps?: number; bound?: number }

export const LAUNCH_RADIUS = 1.05;
export const ESCAPE_SPEED = Math.SQRT2;

const SURFACE = 1;
const TWO_PI = 2 * Math.PI;
/**
 * A periapsis within this distance of the surface touches it without crossing. It absorbs rounding in
 * `rp` (a launch whose exact periapsis is 1 can compute as 1 − 2e-16) and is far below anything the
 * fixed-step samples could resolve.
 */
const GRAZE_TOLERANCE = 1e-12;

export function circularSpeed(r: number): number {
  return 1 / Math.sqrt(r);
}
export function escapeSpeed(r: number): number {
  return Math.sqrt(2 / r);
}
/** Kepler's third law: angular speed on a circular orbit of radius r. */
export function angularSpeed(r: number): number {
  return r ** -1.5;
}
export function circularPosition(r: number, phase: number): Point {
  return { x: r * Math.cos(phase), y: r * Math.sin(phase) };
}

function assertLaunch({ angle, speed }: LaunchParams): void {
  if (!Number.isFinite(angle) || !Number.isFinite(speed)) {
    throw new RangeError(`launch angle and speed must be finite, got angle=${angle} speed=${speed}`);
  }
}

/** Conic elements of the launch from the pad (GM = 1). `a`, `ra` and `period` are `null` when unbound. */
export function orbitalElements(p: LaunchParams): OrbitalElements {
  assertLaunch(p);
  const R = LAUNCH_RADIUS;
  const vx = p.speed * Math.sin(p.angle); // radial
  const vy = p.speed * Math.cos(p.angle); // tangential
  const energy = (p.speed * p.speed) / 2 - 1 / R;
  const h = R * vy; // specific angular momentum, z component
  // Eccentricity vector (v² − 1/r)·r − (r·v)·v at r = (R, 0). Unlike √(1 + 2Eh²), it does not cancel
  // catastrophically near e = 0: the circular pad orbit gives 2e-16 instead of 1.5e-8.
  const e = Math.hypot(R * vy * vy - 1, -R * vx * vy);
  const rp = (h * h) / (1 + e);
  if (energy >= 0) return { energy, a: null, e, rp, ra: null, period: null };
  const a = -1 / (2 * energy);
  return { energy, a, e, rp, ra: a * (1 + e), period: TWO_PI * a ** 1.5 };
}

/**
 * Whether the launch conic crosses the surface ahead of the craft: its periapsis lies below r = 1 and
 * the craft still has to pass it. A bound craft always does within one period; an unbound one only
 * while heading inwards, since an unbound craft moving outwards is past periapsis and only climbs.
 */
function conicHitsSurface(el: OrbitalElements, radialSpeed: number): boolean {
  return el.rp < SURFACE - GRAZE_TOLERANCE && (el.energy < 0 || radialSpeed < 0);
}

function onSurface(x: number, y: number): Point {
  const r = Math.sqrt(x * x + y * y);
  return { x: (x / r) * SURFACE, y: (y / r) * SURFACE };
}

interface State { x: number; y: number; vx: number; vy: number }

/** 1 / r³ at (x, y): the gravitational acceleration is -(x, y) / r³. */
function invR3(x: number, y: number): number {
  const r2 = x * x + y * y;
  return 1 / (r2 * Math.sqrt(r2));
}

/** Advances `s` in place by one classical Runge–Kutta step. Position stages use the stage velocities. */
function rk4Step(s: State, h: number): void {
  const { x, y, vx, vy } = s;
  const half = h / 2;
  let k = invR3(x, y);
  const ax1 = -x * k, ay1 = -y * k;

  const x2 = x + half * vx, y2 = y + half * vy;
  const vx2 = vx + half * ax1, vy2 = vy + half * ay1;
  k = invR3(x2, y2);
  const ax2 = -x2 * k, ay2 = -y2 * k;

  const x3 = x + half * vx2, y3 = y + half * vy2;
  const vx3 = vx + half * ax2, vy3 = vy + half * ay2;
  k = invR3(x3, y3);
  const ax3 = -x3 * k, ay3 = -y3 * k;

  const x4 = x + h * vx3, y4 = y + h * vy3;
  const vx4 = vx + h * ax3, vy4 = vy + h * ay3;
  k = invR3(x4, y4);
  const ax4 = -x4 * k, ay4 = -y4 * k;

  const w = h / 6;
  s.x = x + w * (vx + 2 * vx2 + 2 * vx3 + vx4);
  s.y = y + w * (vy + 2 * vy2 + 2 * vy3 + vy4);
  s.vx = vx + w * (ax1 + 2 * ax2 + 2 * ax3 + ax4);
  s.vy = vy + w * (ay1 + 2 * ay2 + 2 * ay3 + ay4);
}

/**
 * Where the step from (ax, ay), above the surface, to (bx, by), on or below it, crosses r = 1.
 * The first root of |a + t(b - a)|² = 1 lies in (0, 1]; the result is normalised onto the surface.
 */
function surfaceCrossing(ax: number, ay: number, bx: number, by: number): Point {
  const dx = bx - ax, dy = by - ay;
  const qa = dx * dx + dy * dy;
  const qb = ax * dx + ay * dy;
  const qc = ax * ax + ay * ay - SURFACE * SURFACE;
  const t = qa > 0 ? (-qb - Math.sqrt(Math.max(0, qb * qb - qa * qc))) / qa : 1;
  return onSurface(ax + t * dx, ay + t * dy);
}

/**
 * Integrates the launch with fixed-step RK4 and records one point per step (uniform in time, which
 * the scene relies on to animate a satellite along `points`).
 *
 * Outcomes: `suborbital` when a sample reaches r ≤ 1 (a measured impact always wins); `escape` when
 * energy ≥ 0 and r reaches `bound`; `orbit` when energy < 0 and the swept angle reaches 2π. Step
 * endpoints can straddle a grazing dip below the surface, so the conic has the last word: when its
 * periapsis is below the surface and still ahead of the craft (see `conicHitsSurface`), a completed
 * revolution or a reached bound is `suborbital` too, with the path cut at its lowest sample and clamped
 * onto the surface. If `maxSteps` runs out first, `truncated` is true and the outcome is inferred from the
 * conic the same way: `suborbital` if it hits the surface, otherwise `escape` (energy ≥ 0) or `orbit`.
 */
export function simulate(p: LaunchParams, opts: SimulateOptions = {}): Simulation {
  const { dt = 0.005, maxSteps = 40000, bound = 8 } = opts;
  const el = orbitalElements(p); // also rejects a non-finite launch
  if (!(dt > 0) || !Number.isFinite(dt)) throw new RangeError(`dt must be positive and finite, got ${dt}`);
  if (!Number.isInteger(maxSteps) || maxSteps < 0) throw new RangeError(`maxSteps must be a non-negative integer, got ${maxSteps}`);
  if (!(bound > SURFACE)) throw new RangeError(`bound must lie above the surface, got ${bound}`);

  const isBound = el.energy < 0;
  const s: State = { x: LAUNCH_RADIUS, y: 0, vx: p.speed * Math.sin(p.angle), vy: p.speed * Math.cos(p.angle) };
  const radialSpeed = s.vx;
  const points: Point[] = [{ x: s.x, y: s.y }];
  let rMin = LAUNCH_RADIUS;
  let iMin = 0; // index of the lowest sample in `points`
  let swept = 0;
  let measured: Outcome | null = null;

  for (let step = 0; step < maxSteps && measured === null; step++) {
    const px = s.x, py = s.y;
    rk4Step(s, dt);
    const r = Math.sqrt(s.x * s.x + s.y * s.y);
    if (r <= SURFACE) {
      points.push(surfaceCrossing(px, py, s.x, s.y));
      rMin = SURFACE;
      measured = 'suborbital';
      break;
    }
    points.push({ x: s.x, y: s.y });
    if (r < rMin) { rMin = r; iMin = points.length - 1; }
    swept += Math.atan2(px * s.y - py * s.x, px * s.x + py * s.y); // signed angle between consecutive positions
    if (isBound) {
      if (Math.abs(swept) >= TWO_PI) measured = 'orbit';
    } else if (r >= bound) {
      measured = 'escape';
    }
  }

  let outcome: Outcome;
  if (measured === 'suborbital') {
    outcome = 'suborbital';
  } else if (conicHitsSurface(el, radialSpeed)) {
    outcome = 'suborbital';
    // An interior lowest sample means the craft already passed periapsis, grazing below the surface
    // between two samples: end the path there, on the planet.
    if (iMin > 0 && iMin < points.length - 1) {
      const low = points[iMin]!;
      points.length = iMin + 1;
      points[iMin] = onSurface(low.x, low.y);
      rMin = SURFACE;
    }
  } else {
    outcome = measured ?? (isBound ? 'orbit' : 'escape');
  }
  const orbit = outcome === 'orbit';
  return {
    points,
    outcome,
    energy: (s.vx * s.vx + s.vy * s.vy) / 2 - 1 / Math.sqrt(s.x * s.x + s.y * s.y),
    periapsis: orbit ? el.rp : rMin,
    apoapsis: orbit ? el.ra : null,
    period: orbit ? el.period : null,
    truncated: measured === null,
  };
}
