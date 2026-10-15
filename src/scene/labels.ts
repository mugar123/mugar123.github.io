/**
 * Pure geometry for the orbit scene's satellite labels: which side of its satellite each label sits on,
 * and whether a satellite is hidden behind the planet. No DOM, no Three — unit-tested.
 */

/** Label side, the SVG fallback's rule: right of the satellite unless it sits in the right 38 % of the frame. */
export const labelOnRight = (xFraction: number): boolean => xFraction < 0.62;

export interface LabelItem {
  /** Satellite on screen (px) and its radius, label chip size (px), and the gap from satellite centre to chip edge. */
  x: number; y: number; r: number; w: number; h: number; gap: number;
  /** Side the label is on now (for hysteresis). */
  right: boolean;
}
/** Extra clearance required before a label moves to a different side, so it never flickers. */
const SWITCH_CLEARANCE = 8;

/**
 * Chooses a side for each label in priority order. A side costs the area by which its chip would cover
 * other satellites or already placed chips, plus the area it would stick out of the frame. The
 * fallback's preferred side wins unless the other side costs strictly less; the side a label is not on
 * yet is measured with SWITCH_CLEARANCE px of margin, so labels never flicker between sides. Returns
 * `true` for "right" per item.
 */
export function placeLabels(items: readonly LabelItem[], frameWidth: number): boolean[] {
  const taken = items.map((it) => ({ l: it.x - it.r, r: it.x + it.r, t: it.y - it.r, b: it.y + it.r }));
  const box = (it: LabelItem, right: boolean) => ({
    l: right ? it.x + it.gap : it.x - it.gap - it.w,
    r: right ? it.x + it.gap + it.w : it.x - it.gap,
    t: it.y - it.h / 2,
    b: it.y + it.h / 2,
  });
  const cost = (it: LabelItem, right: boolean) => {
    const m = right === it.right ? 0 : SWITCH_CLEARANCE;
    const a = box(it, right);
    let c = (Math.max(0, -a.l) + Math.max(0, a.r - frameWidth)) * it.h;
    for (const q of taken) {
      const w = Math.min(a.r + m, q.r) - Math.max(a.l - m, q.l);
      const h = Math.min(a.b + m, q.b) - Math.max(a.t - m, q.t);
      if (w > 0 && h > 0) c += w * h;
    }
    return c;
  };
  return items.map((it) => {
    const pref = labelOnRight(it.x / frameWidth);
    const keep = cost(it, pref);
    const right = keep > 0 && cost(it, !pref) < keep ? !pref : pref;
    taken.push(box(it, right));
    return right;
  });
}

/**
 * Whether a world point is hidden behind the unit planet for an orthographic camera at `camera` looking
 * at the origin: within the planet's silhouette and farther than its centre.
 */
export function behindPlanet(p: { x: number; y: number; z: number }, camera: readonly [number, number, number], radius = 1): boolean {
  const len = Math.hypot(camera[0], camera[1], camera[2]);
  const along = -(p.x * camera[0] + p.y * camera[1] + p.z * camera[2]) / len; // > 0: beyond the centre
  const perp2 = p.x * p.x + p.y * p.y + p.z * p.z - along * along;
  return along > 0 && perp2 < radius * radius;
}
