export type Orbit = 'high' | 'mid' | 'low';
export type Status = 'active' | 'paused' | 'retired';
export const ORBIT_RADIUS: Record<Orbit, number> = { high: 3.2, mid: 2.2, low: 1.5 };
/** Each ring starts at its own phase so satellites on different rings never line up (labels would collide). */
export const RING_PHASE: Record<Orbit, number> = { high: 0, mid: (2 * Math.PI) / 3, low: (4 * Math.PI) / 3 };

export interface SceneSatellite { id: string; name: string; orbit: Orbit; status: Status; href: string; phase: number }
export interface WorkEntryLike { id: string; data: { title: string; orbit: Orbit; status: Status; order: number } }

/** Accessible name of the hero scene: the SVG fallback's title and the live scene's label. */
export const SCENE_LABEL = 'Planet with project satellites in orbit';
/** Accessible description of the hero scene (empty without satellites). */
export const describeSatellites = (satellites: readonly SceneSatellite[]): string =>
  satellites.length ? `${satellites.map((s) => `${s.name} in ${s.orbit} orbit`).join('; ')}.` : '';

export function toSceneSatellites(entries: WorkEntryLike[]): SceneSatellite[] {
  const sorted = [...entries].sort((a, b) => a.data.order - b.data.order);
  const perRing = new Map<Orbit, number>();
  for (const e of sorted) perRing.set(e.data.orbit, (perRing.get(e.data.orbit) ?? 0) + 1);
  const seen = new Map<Orbit, number>();
  return sorted.map((e) => {
    const i = seen.get(e.data.orbit) ?? 0;
    seen.set(e.data.orbit, i + 1);
    const n = perRing.get(e.data.orbit) ?? 1;
    return { id: e.id, name: e.data.title, orbit: e.data.orbit, status: e.data.status, href: `/work/${e.id}`, phase: RING_PHASE[e.data.orbit] + (2 * Math.PI * i) / n };
  });
}
