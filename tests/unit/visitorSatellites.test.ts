import { describe, it, expect } from 'vitest';
import { loadVisitorSatellites, saveVisitorSatellite, STORAGE_KEY, MAX_VISITOR_SATELLITES } from '@/lib/visitorSatellites';

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), dump: () => Object.fromEntries(m) };
}
const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
const sat = (n: number) => ({ angle: 0.1 * n, speed: 1 + 0.1 * n, launchedAt: n });

describe('loadVisitorSatellites', () => {
  it('returns [] when storage is missing', () => expect(loadVisitorSatellites(null)).toEqual([]));
  it('returns [] when storage throws', () => expect(loadVisitorSatellites(throwing)).toEqual([]));
  it('returns [] on corrupted JSON', () => expect(loadVisitorSatellites(memoryStorage({ [STORAGE_KEY]: '{nope' }))).toEqual([]));
  it('drops malformed entries', () => {
    const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify([sat(1), { angle: 'x' }, null]) });
    expect(loadVisitorSatellites(s)).toEqual([sat(1)]);
  });
});

describe('saveVisitorSatellite', () => {
  it('prepends and caps at MAX', () => {
    const s = memoryStorage();
    for (let i = 1; i <= MAX_VISITOR_SATELLITES + 2; i++) saveVisitorSatellite(s, sat(i));
    const out = loadVisitorSatellites(s);
    expect(out).toHaveLength(MAX_VISITOR_SATELLITES);
    expect(out[0]).toEqual(sat(MAX_VISITOR_SATELLITES + 2));
  });
  it('returns the new list even when storage throws', () => {
    expect(saveVisitorSatellite(throwing, sat(1))).toEqual([sat(1)]);
  });
});
