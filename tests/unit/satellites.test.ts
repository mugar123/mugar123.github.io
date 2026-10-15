import { describe, it, expect } from 'vitest';
import { toSceneSatellites, ORBIT_RADIUS, RING_PHASE } from '@/lib/satellites';

const e = (id: string, orbit: 'high' | 'mid' | 'low', order: number) => ({ id, data: { title: id, orbit, status: 'active' as const, order } });

describe('toSceneSatellites', () => {
  it('ring radii decrease from high to low', () => {
    expect(ORBIT_RADIUS.high).toBeGreaterThan(ORBIT_RADIUS.mid);
    expect(ORBIT_RADIUS.mid).toBeGreaterThan(ORBIT_RADIUS.low);
    expect(ORBIT_RADIUS.low).toBeGreaterThan(1);
  });
  it('sorts by order and builds hrefs', () => {
    const out = toSceneSatellites([e('b', 'mid', 2), e('a', 'high', 1)]);
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
    expect(out[0]?.href).toBe('/work/a');
  });
  it('spreads satellites sharing a ring evenly in phase, starting at the ring base phase', () => {
    const out = toSceneSatellites([e('a', 'mid', 1), e('b', 'mid', 2), e('c', 'mid', 3)]);
    const phases = out.map((s) => s.phase);
    expect(phases[0]).toBeCloseTo(RING_PHASE.mid, 12);
    expect(phases[1]).toBeCloseTo(RING_PHASE.mid + (2 * Math.PI) / 3, 12);
    expect(phases[2]).toBeCloseTo(RING_PHASE.mid + (4 * Math.PI) / 3, 12);
  });
  it('gives different rings different base phases so single satellites never line up', () => {
    const out = toSceneSatellites([e('a', 'high', 1), e('b', 'mid', 2), e('c', 'low', 3)]);
    const [h, m, l] = out.map((s) => s.phase % (2 * Math.PI));
    expect(Math.abs(h! - m!)).toBeGreaterThan(1);
    expect(Math.abs(m! - l!)).toBeGreaterThan(1);
    expect(Math.abs(h! - l!)).toBeGreaterThan(1);
  });
});
