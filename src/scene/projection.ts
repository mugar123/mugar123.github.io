/** Framing shared by the Three.js scene and the SVG fallback. Plain numbers: no Three import. */
export const CAMERA_POSITION = [0, 4, 8] as const; // orthographic camera looking at the origin; elevation ≈ 26.6°
export const VIEW_RADIUS = 3.8;                     // half-height of the orthographic frustum, scene units
export const SQUASH = 0.45;                         // ≈ sin(elevation): foreshortening of the orbital plane
