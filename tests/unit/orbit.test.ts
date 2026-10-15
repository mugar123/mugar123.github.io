import { describe, it, expect } from 'vitest';
import { angularSpeed, circularPosition } from '@/lib/orbit';

describe('circular orbits', () => {
  it('angular speed follows Kepler and circularPosition is on the ring', () => {
    expect(angularSpeed(4)).toBeCloseTo(0.125, 12);
    const p = circularPosition(2, Math.PI / 2);
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(2, 12);
  });
});
