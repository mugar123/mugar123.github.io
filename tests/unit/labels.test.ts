import { describe, it, expect } from 'vitest';
import { labelOnRight, placeLabels, behindPlanet } from '@/scene/labels';
import { CAMERA_POSITION } from '@/scene/projection';

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
});
