/** Framing shared by the Three.js scene and the SVG fallback. Plain numbers: no Three import. */
export const CAMERA_POSITION = [0, 4, 8] as const; // orthographic camera looking at the origin; elevation ≈ 26.6°
export const VIEW_RADIUS = 3.8;                     // half-height of the orthographic frustum, scene units
/** sin(elevation): on-screen foreshortening of the orbital plane's depth axis (≈ 0.447), exact so touch targets measure true. */
export const SQUASH = CAMERA_POSITION[1] / Math.hypot(CAMERA_POSITION[1], CAMERA_POSITION[2]);

// The static WebP was rendered with yaw -0.45; its +Z antenna projects down and left.
const PREVIEW_ANTENNA_ANGLE = Math.atan2(SQUASH * Math.cos(-0.45), Math.sin(-0.45));
/** Rotate the baked preview so its projected antenna faces the planet (SVG clockwise degrees). */
export function satellitePreviewRotation(position: { x: number; y: number }): number {
  return (Math.atan2(position.y * SQUASH, -position.x) - PREVIEW_ANTENNA_ANGLE) * 180 / Math.PI;
}
