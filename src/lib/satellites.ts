export type Orbit = 'high' | 'mid' | 'low';
export type Status = 'active' | 'paused' | 'retired';
export const ORBIT_RADIUS: Record<Orbit, number> = { high: 3.2, mid: 2.2, low: 1.5 };

export interface SceneSatellite { id: string; name: string; orbit: Orbit; status: Status; href: string; phase: number }
export interface WorkEntryLike { id: string; data: { title: string; orbit: Orbit; status: Status; order: number } }

export function toSceneSatellites(entries: WorkEntryLike[]): SceneSatellite[] {
  const sorted = [...entries].sort((a, b) => a.data.order - b.data.order);
  const perRing = new Map<Orbit, number>();
  for (const e of sorted) perRing.set(e.data.orbit, (perRing.get(e.data.orbit) ?? 0) + 1);
  const seen = new Map<Orbit, number>();
  return sorted.map((e) => {
    const i = seen.get(e.data.orbit) ?? 0;
    seen.set(e.data.orbit, i + 1);
    const n = perRing.get(e.data.orbit) ?? 1;
    return { id: e.id, name: e.data.title, orbit: e.data.orbit, status: e.data.status, href: `/work/${e.id}`, phase: (2 * Math.PI * i) / n };
  });
}
