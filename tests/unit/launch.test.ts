import { describe, it, expect } from 'vitest';
import { dragToLaunch, formatSpeed, MIN_SPEED, MAX_SPEED, DEAD_ZONE, SNAP_ANGLE } from '@/lib/launch';

describe('dragToLaunch', () => {
  it('returns null inside the dead zone (a click is not a launch)', () => {
    expect(dragToLaunch({ tangential: 0, radial: 0 })).toBeNull();
    expect(dragToLaunch({ tangential: DEAD_ZONE / 2, radial: 0 })).toBeNull();
  });
  it('accepts a drag exactly DEAD_ZONE long (the dead zone is open at its edge)', () => {
    expect(dragToLaunch({ tangential: DEAD_ZONE, radial: 0 })).toEqual({ angle: 0, speed: MIN_SPEED });
  });
  it('maps a unit tangential drag to angle 0, speed 1', () => {
    const p = dragToLaunch({ tangential: 1, radial: 0 })!;
    expect(p.angle).toBe(0);
    expect(p.speed).toBeCloseTo(1, 12);
  });
  it('maps a radial drag to angle π/2', () => {
    expect(dragToLaunch({ tangential: 0, radial: 1 })!.angle).toBeCloseTo(Math.PI / 2, 12);
  });
  it('allows retrograde launches (angle π)', () => {
    expect(dragToLaunch({ tangential: -1, radial: 0 })!.angle).toBe(Math.PI);
  });
  it('snaps aims within SNAP_ANGLE of the horizontal, and leaves others alone', () => {
    expect(SNAP_ANGLE).toBeCloseTo((3 * Math.PI) / 180, 12);
    expect(dragToLaunch({ tangential: 1, radial: Math.tan(0.02) })!.angle).toBe(0);
    expect(dragToLaunch({ tangential: -1, radial: 0.02 })!.angle).toBe(Math.PI);
    // atan2 of a negative radial is near −π; the snap must still return +π, not −π.
    expect(dragToLaunch({ tangential: -1, radial: -0.02 })!.angle).toBe(Math.PI);
    expect(dragToLaunch({ tangential: 1, radial: Math.tan(0.1) })!.angle).toBeCloseTo(0.1, 12);
  });
  it('snaps inclusively at SNAP_ANGLE and not beyond it', () => {
    // atan2(Math.tan(SNAP_ANGLE), 1) rounds one ulp above SNAP_ANGLE, so the exact-boundary drag is the double
    // just below Math.tan(SNAP_ANGLE): its aim is exactly SNAP_ANGLE, which pins `<=` (not `<`).
    const edge = Math.tan(SNAP_ANGLE);
    const bits = new Float64Array([edge]);
    new BigInt64Array(bits.buffer)[0]! -= 1n;
    const exact = bits[0]!;
    expect(Math.atan2(exact, 1)).toBe(SNAP_ANGLE);
    expect(dragToLaunch({ tangential: 1, radial: exact })!.angle).toBe(0);
    expect(dragToLaunch({ tangential: 1, radial: -exact })!.angle).toBe(0);
    expect(dragToLaunch({ tangential: -1, radial: exact })!.angle).toBe(Math.PI);
    expect(dragToLaunch({ tangential: 1, radial: edge * (1 + 1e-9) })!.angle).toBeGreaterThan(SNAP_ANGLE);
    expect(dragToLaunch({ tangential: -1, radial: edge * (1 + 1e-9) })!.angle).toBeLessThan(Math.PI - SNAP_ANGLE);
  });
  it('clamps speed to [MIN_SPEED, MAX_SPEED]', () => {
    expect(dragToLaunch({ tangential: 0.1, radial: 0 })!.speed).toBe(MIN_SPEED);
    expect(dragToLaunch({ tangential: 5, radial: 0 })!.speed).toBe(MAX_SPEED);
  });
  it('rejects a non-finite or non-positive scale', () => {
    expect(dragToLaunch({ tangential: 1, radial: 0 }, { scale: 0 })).toBeNull();
    expect(dragToLaunch({ tangential: 1, radial: 0 }, { scale: Number.NaN })).toBeNull();
    expect(dragToLaunch({ tangential: 1, radial: 0 }, { scale: -1 })).toBeNull();
    expect(dragToLaunch({ tangential: 1, radial: 0 }, { scale: Infinity })).toBeNull();
  });
  it('multiplies the drag length by a positive scale', () => {
    expect(dragToLaunch({ tangential: 0.5, radial: 0 }, { scale: 2 })).toEqual({ angle: 0, speed: 1 });
  });
  it('never yields NaN', () => {
    const p = dragToLaunch({ tangential: 1e-9, radial: 1e-9 });
    expect(p === null || (Number.isFinite(p.angle) && Number.isFinite(p.speed))).toBe(true);
  });
});

describe('formatSpeed', () => {
  it('formats to two decimals with the v₀ unit', () => {
    expect(formatSpeed(1.2149)).toBe('1.21 v₀');
    expect(formatSpeed(Math.SQRT2)).toBe('1.41 v₀');
  });
});
