export interface VisitorSatellite { angle: number; speed: number; launchedAt: number }
export const STORAGE_KEY = 'orbit:visitor-satellites';
export const MAX_VISITOR_SATELLITES = 3;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function isSat(v: unknown): v is VisitorSatellite {
  return typeof v === 'object' && v !== null
    && Number.isFinite((v as VisitorSatellite).angle)
    && Number.isFinite((v as VisitorSatellite).speed)
    && Number.isFinite((v as VisitorSatellite).launchedAt);
}

export function loadVisitorSatellites(storage: StorageLike | null | undefined): VisitorSatellite[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Rebuild each entry from its three fields so extra keys in tampered storage are never kept or re-saved.
    return parsed.filter(isSat).slice(0, MAX_VISITOR_SATELLITES)
      .map(({ angle, speed, launchedAt }) => ({ angle, speed, launchedAt }));
  } catch {
    return [];
  }
}

export function saveVisitorSatellite(storage: StorageLike | null | undefined, sat: VisitorSatellite): VisitorSatellite[] {
  const next = [sat, ...loadVisitorSatellites(storage)].slice(0, MAX_VISITOR_SATELLITES);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the scene still shows the satellite for this visit */
  }
  return next;
}
