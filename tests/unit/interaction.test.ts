import { describe, it, expect } from 'vitest';
import {
  HINT, DEFAULT_AIM, stepAim, formatAngle, outcomeLabel, statusText, isSuccess,
  AMBIENT_RATE, FLIGHT_RATE, flightTime, packPoints, sampleTrajectory, simplifyPath,
  labelOnRight, placeLabels, behindPlanet, padHitRadius, withinPad, PAD_HIT_RADIUS, MIN_PAD_HIT_PX, exceedsSlop,
} from '@/scene/interaction';
import { simulate, circularPosition, type Point } from '@/lib/orbit';
import { MIN_SPEED, MAX_SPEED } from '@/lib/launch';
import { CAMERA_POSITION } from '@/scene/projection';

const deg = (d: number) => (d * Math.PI) / 180;

describe('stepAim', () => {
  it('arrows step speed by 0.05 v₀ and angle by 5°; Shift steps 0.01 v₀ and 1°', () => {
    expect(stepAim(DEFAULT_AIM, 'ArrowUp')).toEqual({ angle: 0, speed: 1.05 });
    expect(stepAim(DEFAULT_AIM, 'ArrowDown')).toEqual({ angle: 0, speed: 0.95 });
    expect(stepAim(DEFAULT_AIM, 'ArrowUp', true)).toEqual({ angle: 0, speed: 1.01 });
    expect(stepAim(DEFAULT_AIM, 'ArrowRight')!.angle).toBeCloseTo(deg(5), 12);
    expect(stepAim(DEFAULT_AIM, 'ArrowLeft')!.angle).toBeCloseTo(deg(-5), 12);
    expect(stepAim(DEFAULT_AIM, 'ArrowRight', true)!.angle).toBeCloseTo(deg(1), 12);
  });
  it('ArrowRight tilts the launch outward (positive angle = towards radial-out)', () => {
    expect(stepAim(DEFAULT_AIM, 'ArrowRight')!.angle).toBeGreaterThan(0);
  });
  it('two ArrowUp presses from the default aim give exactly 1.10 v₀ (no float drift)', () => {
    const a = stepAim(stepAim(DEFAULT_AIM, 'ArrowUp')!, 'ArrowUp')!;
    expect(a.speed).toBe(1.1);
  });
  it('clamps speed to [MIN_SPEED, MAX_SPEED]', () => {
    expect(stepAim({ angle: 0, speed: MAX_SPEED }, 'ArrowUp')!.speed).toBe(MAX_SPEED);
    expect(stepAim({ angle: 0, speed: MIN_SPEED }, 'ArrowDown')!.speed).toBe(MIN_SPEED);
  });
  it('wraps the angle into (−180°, 180°]', () => {
    const a = stepAim({ angle: deg(180), speed: 1 }, 'ArrowRight')!;
    expect(a.angle).toBeCloseTo(deg(-175), 12);
    const b = stepAim({ angle: deg(-180), speed: 1 }, 'ArrowLeft')!;
    expect(b.angle).toBeCloseTo(deg(175), 12);
  });
  it('snaps a free (pointer) aim onto the keyboard grid on the first step', () => {
    const a = stepAim({ angle: deg(12.4), speed: 1.137 }, 'ArrowUp')!;
    expect(a.speed).toBe(1.19);
    expect(a.angle).toBeCloseTo(deg(12), 12);
  });
  it('returns null for keys that do not aim', () => {
    expect(stepAim(DEFAULT_AIM, 'Enter')).toBeNull();
    expect(stepAim(DEFAULT_AIM, 'a')).toBeNull();
  });
});

describe('status text', () => {
  it('formats signed whole-degree angles', () => {
    expect(formatAngle(0)).toBe('0°');
    expect(formatAngle(deg(10))).toBe('+10°');
    expect(formatAngle(deg(-5))).toBe('−5°');
    expect(formatAngle(deg(-0.3))).toBe('0°');
  });
  it('launched text matches the contract `<speed> v₀ · OUTCOME`', () => {
    const re = /^\d\.\d\d v₀ · (ORBIT ACHIEVED|SUBORBITAL|ESCAPE)$/;
    for (const speed of [0.5, 1.1, 1.6]) {
      const p = { angle: 0, speed };
      expect(statusText(p, simulate(p), true)).toMatch(re);
    }
    expect(statusText({ angle: 0, speed: 1.1 }, simulate({ angle: 0, speed: 1.1 }), true)).toBe('1.10 v₀ · ORBIT ACHIEVED');
  });
  it('a preview names the predicted outcome and the angle but never says ACHIEVED', () => {
    const p = { angle: deg(5), speed: 1.1 };
    expect(statusText(p, simulate(p), false)).toBe('1.10 v₀ · +5° · ORBIT');
  });
  it('a truncated orbit is LONG PERIOD and never a success', () => {
    const sim = { outcome: 'orbit' as const, truncated: true };
    expect(outcomeLabel(sim, true)).toBe('ORBIT · LONG PERIOD');
    expect(outcomeLabel(sim, false)).toBe('ORBIT · LONG PERIOD');
    expect(isSuccess(sim)).toBe(false);
    expect(statusText({ angle: 0, speed: 1.36 }, sim, true)).toBe('1.36 v₀ · ORBIT · LONG PERIOD');
  });
  it('only a closed orbit is a success', () => {
    expect(isSuccess({ outcome: 'orbit', truncated: false })).toBe(true);
    expect(isSuccess({ outcome: 'escape', truncated: false })).toBe(false);
    expect(isSuccess({ outcome: 'suborbital', truncated: false })).toBe(false);
  });
  it('the hint is the contract text', () => {
    expect(HINT).toBe('DRAG TO LAUNCH ↗');
  });
});

describe('flightTime', () => {
  it('a flight that does not settle plays at FLIGHT_RATE', () => {
    expect(flightTime(2, false)).toBeCloseTo(2 * FLIGHT_RATE, 12);
  });
  it('an orbit starts at FLIGHT_RATE and eases to AMBIENT_RATE, monotonically', () => {
    const h = 1e-4;
    expect((flightTime(h, true) - flightTime(0, true)) / h).toBeCloseTo(FLIGHT_RATE, 3);
    expect((flightTime(60 + h, true) - flightTime(60, true)) / h).toBeCloseTo(AMBIENT_RATE, 3);
    expect(flightTime(0, true)).toBe(0);
    let prev = -1;
    for (let t = 0; t < 30; t += 0.25) { const v = flightTime(t, true); expect(v).toBeGreaterThan(prev); prev = v; }
  });
});

describe('sampleTrajectory', () => {
  const pts: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }];
  const xy = packPoints(pts);
  it('packs points as interleaved x, y', () => {
    expect(Array.from(xy)).toEqual([0, 0, 1, 0, 1, 2]);
  });
  it('interpolates linearly between samples dt apart', () => {
    const out = { x: NaN, y: NaN };
    expect(sampleTrajectory(xy, 0.5, 0.25, null, out)).toBe(true);
    expect(out).toEqual({ x: 0.5, y: 0 });
    sampleTrajectory(xy, 0.5, 0.75, null, out);
    expect(out).toEqual({ x: 1, y: 1 });
  });
  it('holds the last sample and reports the end of a non-periodic path', () => {
    const out = { x: NaN, y: NaN };
    expect(sampleTrajectory(xy, 0.5, 5, null, out)).toBe(false);
    expect(out).toEqual({ x: 1, y: 2 });
  });
  it('wraps a periodic path by its period', () => {
    const a = { x: NaN, y: NaN }; const b = { x: NaN, y: NaN };
    sampleTrajectory(xy, 0.5, 0.25, 1, a);
    expect(sampleTrajectory(xy, 0.5, 3.25, 1, b)).toBe(true);
    expect(b).toEqual(a);
  });
  it('follows a simulated orbit: one period later the craft is back at the pad', () => {
    const sim = simulate({ angle: 0, speed: 1.1 });
    const out = { x: NaN, y: NaN };
    sampleTrajectory(packPoints(sim.points), 0.005, sim.period!, sim.period, out);
    expect(Math.hypot(out.x - sim.points[0]!.x, out.y - sim.points[0]!.y)).toBeLessThan(1e-3);
  });
});

describe('simplifyPath', () => {
  it('keeps the endpoints and bounds the segment count', () => {
    const pts = Array.from({ length: 1000 }, (_, i) => circularPosition(2, (i / 999) * Math.PI));
    const out = simplifyPath(pts, 0.05, 2000);
    expect(out[0]).toEqual(pts[0]);
    expect(out.at(-1)).toEqual(pts.at(-1));
    expect(out.length).toBeLessThan(pts.length);
    for (let i = 1; i < out.length - 1; i++) {
      expect(Math.hypot(out[i]!.x - out[i - 1]!.x, out[i]!.y - out[i - 1]!.y)).toBeGreaterThanOrEqual(0.05);
    }
  });
  it('coarsens the step when the path would exceed maxPoints', () => {
    const pts = Array.from({ length: 5000 }, (_, i) => ({ x: i * 0.01, y: 0 }));
    expect(simplifyPath(pts, 0.01, 100).length).toBeLessThanOrEqual(100);
  });
  it('returns short paths unchanged', () => {
    const pts = [{ x: 0, y: 0 }];
    expect(simplifyPath(pts, 0.05, 10)).toEqual(pts);
  });
});

describe('overlay geometry', () => {
  it('labels sit to the right unless the satellite is in the right 38 % of the frame (like the fallback)', () => {
    expect(labelOnRight(0.3)).toBe(true);
    expect(labelOnRight(0.61)).toBe(true);
    expect(labelOnRight(0.62)).toBe(false);
    expect(labelOnRight(0.9)).toBe(false);
  });
  it('placeLabels keeps the preferred side when labels do not collide', () => {
    const sides = placeLabels([
      { x: 100, y: 50, w: 80, h: 18, r: 5, gap: 20, right: true },
      { x: 100, y: 150, w: 80, h: 18, r: 5, gap: 20, right: true },
    ], 1000);
    expect(sides).toEqual([true, true]);
  });
  it('placeLabels flips a later label to the free side when two would overlap', () => {
    // Two satellites in the right 38 % of the frame, close together: both prefer the left.
    const sides = placeLabels([
      { x: 800, y: 100, w: 120, h: 18, r: 5, gap: 20, right: false },
      { x: 900, y: 104, w: 150, h: 18, r: 5, gap: 20, right: false }, // its left chip would cover the first label
    ], 1200);
    expect(sides).toEqual([false, true]);
  });
  it('placeLabels keeps a flipped label flipped until the preferred side is clearly free (no flicker)', () => {
    // The second label prefers the right (x = 0.6 W) but sits on the left after an earlier collision.
    // Its right-hand box would clear the first label by only 3 px: it stays where it is…
    const first = { x: 800, y: 100, w: 100, h: 18, r: 5, gap: 20, right: false };
    expect(placeLabels([first, { x: 600, y: 100, w: 57, h: 18, r: 5, gap: 20, right: false }], 1000)).toEqual([false, false]);
    // …and returns once the gap is comfortable.
    expect(placeLabels([first, { x: 600, y: 100, w: 45, h: 18, r: 5, gap: 20, right: false }], 1000)).toEqual([false, true]);
  });
  it('placeLabels never lets a chip cover another satellite', () => {
    // The outer satellite's preferred (left) chip would sit on the inner satellite: it goes right.
    const sides = placeLabels([
      { x: 850, y: 100, r: 6, w: 80, h: 18, gap: 20, right: false },
      { x: 780, y: 100, r: 6, w: 80, h: 18, gap: 20, right: false },
    ], 1000);
    expect(sides).toEqual([true, false]);
  });
  it('placeLabels keeps chips inside the frame when the other side is free', () => {
    // At x = 0.57 W the fallback prefers the right, but a 300 px chip would leave the 700 px frame.
    expect(placeLabels([{ x: 400, y: 100, r: 5, w: 300, h: 18, gap: 20, right: true }], 700)).toEqual([false]);
    // When neither side fits, the preferred side wins (the chip's ellipsis handles it).
    expect(placeLabels([{ x: 300, y: 100, r: 5, w: 300, h: 18, gap: 20, right: true }], 600)).toEqual([true]);
  });
  it('placeLabels takes the cheaper side when neither is free (phone-sized frame)', () => {
    // PAPERTOK's left chip would cover the inner satellite; its right chip sticks out of the frame by 1 px.
    const sides = placeLabels([
      { x: 241, y: 92, r: 4, w: 69, h: 18, gap: 18, right: true },
      { x: 216, y: 92, r: 4, w: 131, h: 18, gap: 18, right: true },
    ], 327);
    expect(sides).toEqual([true, false]);
  });
  it('a point on the far side of the planet, within its silhouette, is hidden', () => {
    expect(behindPlanet({ x: 0, y: 0, z: -1.5 }, CAMERA_POSITION)).toBe(true);   // low ring, far side
    expect(behindPlanet({ x: 0, y: 0, z: 1.5 }, CAMERA_POSITION)).toBe(false);   // low ring, near side
    expect(behindPlanet({ x: 0, y: 0, z: -3.2 }, CAMERA_POSITION)).toBe(false);  // high ring clears the limb
    expect(behindPlanet({ x: 1.5, y: 0, z: 0 }, CAMERA_POSITION)).toBe(false);   // beside the planet
  });
  it('the pad hit radius is PAD_HIT_RADIUS orbital-plane units, widened to a 44 px target on small scenes', () => {
    expect(padHitRadius(100)).toBe(PAD_HIT_RADIUS);                    // 60 px across the plane: no widening
    expect(padHitRadius(10)).toBeCloseTo(MIN_PAD_HIT_PX / 10, 12);       // 2.2 units = 22 px at 10 px/unit
    expect(padHitRadius(10) * 10).toBeCloseTo(MIN_PAD_HIT_PX, 12);
  });
  it('withinPad gates on orbital-plane distance from the pad, radially and tangentially, on both sides', () => {
    const pad = { x: 1.05, y: 0 };
    const r = PAD_HIT_RADIUS, e = 1e-6;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      expect(withinPad({ x: pad.x + dx * (r - e), y: pad.y + dy * (r - e) }, pad, r)).toBe(true);
      expect(withinPad({ x: pad.x + dx * (r + e), y: pad.y + dy * (r + e) }, pad, r)).toBe(false);
    }
    // One full plane unit "behind" the pad (tangential) is far outside, however close it looks on screen.
    expect(withinPad({ x: pad.x, y: pad.y + 1 }, pad, r)).toBe(false);
  });
  it('a press that barely moves is a click, not a drag', () => {
    expect(exceedsSlop(2, 2, 'mouse')).toBe(false);
    expect(exceedsSlop(6, 0, 'mouse')).toBe(true);
    expect(exceedsSlop(6, 0, 'touch')).toBe(false);
    expect(exceedsSlop(0, 11, 'touch')).toBe(true);
  });
});
