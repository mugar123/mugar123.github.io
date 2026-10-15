import { describe, it, expect } from 'vitest';
import {
  simulate, orbitalElements, circularSpeed, escapeSpeed, angularSpeed, circularPosition,
  ESCAPE_SPEED, LAUNCH_RADIUS, type Point,
} from '@/lib/orbit';

const R0 = LAUNCH_RADIUS;
const r = (p: Point) => Math.hypot(p.x, p.y);
const maxR = (pts: Point[]) => Math.max(...pts.map(r));
const minR = (pts: Point[]) => Math.min(...pts.map(r));

describe('speeds and positions', () => {
  it('circular speed at r=1 is 1 and escape is sqrt(2)', () => {
    expect(circularSpeed(1)).toBeCloseTo(1, 12);
    expect(escapeSpeed(1)).toBeCloseTo(Math.SQRT2, 12);
    expect(ESCAPE_SPEED).toBeCloseTo(Math.SQRT2, 12);
    expect(circularSpeed(4)).toBeCloseTo(0.5, 12);
  });
  it('angular speed follows Kepler and circularPosition is on the ring', () => {
    expect(angularSpeed(4)).toBeCloseTo(0.125, 12);
    const p = circularPosition(2, Math.PI / 2);
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(2, 12);
  });
  it('the pad is just above the surface', () => {
    expect(LAUNCH_RADIUS).toBeGreaterThan(1);
    expect(LAUNCH_RADIUS).toBeLessThan(1.1);
  });
});

describe('orbitalElements', () => {
  it('tangential launch at v=1.2 has periapsis at the pad and ra = 2a - rp', () => {
    const el = orbitalElements({ angle: 0, speed: 1.2 });
    const energy = 0.72 - 1 / R0;
    const a = -1 / (2 * energy);
    expect(el.energy).toBeCloseTo(energy, 12);
    expect(el.a).toBeCloseTo(a, 6);
    expect(el.rp).toBeCloseTo(R0, 6);
    expect(el.ra).toBeCloseTo(2 * a - R0, 6);
    expect(el.period).toBeCloseTo(2 * Math.PI * Math.pow(a, 1.5), 6);
  });
  it('escape has non-negative energy and null a/ra/period', () => {
    const el = orbitalElements({ angle: 0, speed: 1.5 });
    expect(el.energy).toBeGreaterThanOrEqual(0);
    expect(el.a).toBeNull();
    expect(el.ra).toBeNull();
    expect(el.period).toBeNull();
  });
  it('a steep outward launch from the pad has periapsis below the surface', () => {
    expect(orbitalElements({ angle: 0.6, speed: 1.2 }).rp).toBeLessThan(1);
  });
});

describe('simulate', () => {
  it('circular speed at the pad produces a closed orbit at r≈R0', () => {
    const s = simulate({ angle: 0, speed: circularSpeed(R0) });
    expect(s.outcome).toBe('orbit');
    expect(s.truncated).toBe(false);
    expect(maxR(s.points)).toBeLessThan(R0 + 0.01);
    expect(minR(s.points)).toBeGreaterThan(R0 - 0.01);
    expect(s.period).toBeCloseTo(2 * Math.PI * Math.pow(R0, 1.5), 6);
  });
  it('too slow falls back to the surface', () => {
    const s = simulate({ angle: 0, speed: 0.5 });
    expect(s.outcome).toBe('suborbital');
    expect(r(s.points.at(-1)!)).toBeLessThanOrEqual(1.001);
  });
  it('above escape speed leaves the bound', () => {
    const s = simulate({ angle: 0, speed: 1.5 }, { bound: 8 });
    expect(s.outcome).toBe('escape');
    expect(maxR(s.points)).toBeGreaterThanOrEqual(8);
  });
  it('elliptical orbit reaches the analytic apoapsis', () => {
    const s = simulate({ angle: 0, speed: 1.2 });
    const el = orbitalElements({ angle: 0, speed: 1.2 });
    expect(s.outcome).toBe('orbit');
    expect(maxR(s.points)).toBeCloseTo(el.ra!, 1);
    expect(s.apoapsis).toBeCloseTo(el.ra!, 6);
  });
  it('a slightly outward launch still orbits from the pad', () => {
    const s = simulate({ angle: 0.1, speed: 1.2 });
    expect(s.outcome).toBe('orbit');
    expect(minR(s.points)).toBeGreaterThan(1);
  });
  it('a steeper outward launch dips below the surface and is suborbital', () => {
    expect(simulate({ angle: 0.6, speed: 1.2 }).outcome).toBe('suborbital');
  });
  it('radial launch straight up falls back', () => {
    expect(simulate({ angle: Math.PI / 2, speed: 1 }).outcome).toBe('suborbital');
  });
  it('an inward launch above escape speed still hits the surface, with finite points', () => {
    const s = simulate({ angle: -1.2, speed: 1.7 });
    expect(s.outcome).toBe('suborbital');
    expect(s.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
  it('conserves energy to 1e-6 over one orbit', () => {
    const p = { angle: 0.1, speed: 1.2 };
    const s = simulate(p);
    expect(s.outcome).toBe('orbit');
    expect(Math.abs(s.energy - orbitalElements(p).energy)).toBeLessThan(1e-6);
  });
  it('reports truncation instead of inventing a closed orbit', () => {
    const s = simulate({ angle: 0, speed: 1.2 }, { maxSteps: 10 });
    expect(s.truncated).toBe(true);
    expect(s.outcome).toBe('orbit');
    expect(s.points).toHaveLength(11);
  });
});

// Added beyond the brief: properties the scene relies on.
import type { LaunchParams, Outcome } from '@/lib/orbit';

/** Physics oracle: the outcome implied by the launch conic (periapsis vs surface, energy sign, heading). */
const conicOutcome = (p: LaunchParams): Outcome => {
  const el = orbitalElements(p);
  if (el.rp <= 1 && (el.energy < 0 || Math.sin(p.angle) < 0)) return 'suborbital';
  return el.energy < 0 ? 'orbit' : 'escape';
};

describe('simulate: properties the scene relies on', () => {
  it('samples one point per dt, so a measured orbit spans one period and closes on itself', () => {
    const s = simulate({ angle: 0, speed: 1.2 });
    expect(Math.abs(s.points.length - 1 - s.period! / 0.005)).toBeLessThanOrEqual(1);
    const first = s.points[0]!, last = s.points.at(-1)!;
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeLessThan(0.01);
  });
  it('a retrograde launch mirrors the prograde one', () => {
    const pro = simulate({ angle: 0, speed: 1.2 });
    const retro = simulate({ angle: Math.PI, speed: 1.2 });
    expect(retro.outcome).toBe('orbit');
    expect(retro.points).toHaveLength(pro.points.length);
    const drift = Math.max(...retro.points.map((q, i) => Math.hypot(q.x - pro.points[i]!.x, q.y + pro.points[i]!.y)));
    expect(drift).toBeLessThan(1e-9);
  });
  it('ends a suborbital path exactly on the surface, with every earlier point above it', () => {
    const s = simulate({ angle: 0, speed: 0.5 });
    expect(r(s.points.at(-1)!)).toBeCloseTo(1, 12);
    expect(minR(s.points.slice(0, -1))).toBeGreaterThan(1);
    expect(s.periapsis).toBeCloseTo(1, 12);
  });
  it('reports analytic apsides for orbits, matching the drawn path, and none for escapes', () => {
    const p = { angle: 0.1, speed: 1.2 };
    const s = simulate(p);
    const el = orbitalElements(p);
    expect(s.periapsis).toBeCloseTo(el.rp, 12);
    expect(minR(s.points)).toBeCloseTo(el.rp, 4);
    const esc = simulate({ angle: 0, speed: 1.5 });
    expect(esc).toMatchObject({ apoapsis: null, period: null });
    expect(esc.periapsis).toBeCloseTo(R0, 12);
  });
  it('never reports an orbit for a truncated bound path that must still hit the planet', () => {
    const p = { angle: 0.3, speed: 1.3 }; // rp < 1, crash after ~50 time units
    expect(simulate(p, { maxSteps: 6000 })).toMatchObject({ truncated: true, outcome: 'suborbital' });
    expect(simulate(p)).toMatchObject({ truncated: false, outcome: 'suborbital' });
    // Period ≈ 485 is beyond the default step budget, yet the conic dips below the surface.
    expect(simulate({ angle: 0.26, speed: 1.36 })).toMatchObject({ truncated: true, outcome: 'suborbital' });
  });
  it('matches the launch conic across the playable range, conserves energy, and the preview agrees with the launch', () => {
    const problems: string[] = [];
    for (let k = -12; k < 12; k++) {
      for (let v = 0.3; v <= 1.8001; v += 0.1) {
        const p = { angle: (k * Math.PI) / 12, speed: v };
        const full = simulate(p);
        const preview = simulate(p, { maxSteps: 6000 });
        const tag = `angle=${p.angle.toFixed(3)} speed=${v.toFixed(1)}`;
        if (full.outcome !== conicOutcome(p)) problems.push(`${tag}: ${full.outcome} vs conic ${conicOutcome(p)}`);
        if (preview.outcome !== full.outcome) problems.push(`${tag}: preview ${preview.outcome} vs launch ${full.outcome}`);
        if (Math.abs(full.energy - orbitalElements(p).energy) >= 1e-6) problems.push(`${tag}: energy drift`);
      }
    }
    expect(problems).toEqual([]);
  });
  it('rejects non-finite launches and invalid options instead of returning NaN paths', () => {
    expect(() => simulate({ angle: Number.NaN, speed: 1 })).toThrow(RangeError);
    expect(() => orbitalElements({ angle: 0, speed: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => simulate({ angle: 0, speed: 1 }, { dt: 0 })).toThrow(RangeError);
    expect(() => simulate({ angle: 0, speed: 1 }, { maxSteps: 1.5 })).toThrow(RangeError);
    expect(() => simulate({ angle: 0, speed: 1 }, { bound: 1 })).toThrow(RangeError);
  });
});

// Fix round 1: the conic, not the samples, decides grazing and truncated outcomes.
describe('simulate: grazing and truncated outcomes follow the conic', () => {
  it('a grazing bound launch whose samples straddle the dip is suborbital and ends on the surface', () => {
    const p = { angle: 0.20604394405222665, speed: 1.3 }; // analytic periapsis 0.999999
    expect(orbitalElements(p).rp).toBeLessThan(1);
    expect(simulate(p, { maxSteps: 6000 }).outcome).toBe('suborbital');
    const s = simulate(p);
    expect(s.outcome).toBe('suborbital');
    expect(s.truncated).toBe(false);
    expect(r(s.points.at(-1)!)).toBeLessThanOrEqual(1.001);
    expect(r(s.points.at(-1)!)).toBeCloseTo(1, 12);
  });
  it('a grazing inward escape whose samples straddle the dip is suborbital and ends on the surface', () => {
    const p = { angle: -0.22297098334254384, speed: 1.4 }; // unbound, analytic periapsis 0.99999956
    expect(orbitalElements(p).energy).toBeGreaterThanOrEqual(0);
    expect(orbitalElements(p).rp).toBeLessThan(1);
    const s = simulate(p);
    expect(s.outcome).toBe('suborbital');
    expect(r(s.points.at(-1)!)).toBeCloseTo(1, 12);
    expect(maxR(s.points)).toBeLessThan(R0 + 1e-9);
  });
  it('a truncated inward unbound launch with periapsis below the surface is suborbital', () => {
    expect(simulate({ angle: -1.2, speed: 1.7 }, { maxSteps: 1 })).toMatchObject({ truncated: true, outcome: 'suborbital' });
  });
  it('a truncated outward unbound launch is already past periapsis and escapes', () => {
    expect(orbitalElements({ angle: 0.6, speed: 1.5 }).rp).toBeLessThan(1);
    expect(simulate({ angle: 0.6, speed: 1.5 }, { maxSteps: 1 })).toMatchObject({ truncated: true, outcome: 'escape' });
  });
  it('a periapsis exactly on the surface counts as clearing it', () => {
    expect(simulate({ angle: 0.14743138583910761, speed: 1.1 }, { maxSteps: 0 })).toMatchObject({ truncated: true, outcome: 'orbit' });
  });
});

describe('orbitalElements: eccentricity vector', () => {
  it('resolves the circular pad orbit to rounding', () => {
    expect(orbitalElements({ angle: 0, speed: circularSpeed(LAUNCH_RADIUS) }).e).toBeLessThan(1e-12);
  });
  it('resolves a tiny flight-path angle on the circular orbit (e ≈ angle)', () => {
    const e = orbitalElements({ angle: 1e-10, speed: circularSpeed(LAUNCH_RADIUS) }).e;
    expect(Math.abs(e - 1e-10) / 1e-10).toBeLessThan(1e-6);
  });
});
