/** Shared framing for the live models and their static previews. No Three dependency. */
export const MODEL_URLS = {
  planet: '/models/planet-06.glb',
  satellite: '/models/satellite-01.glb',
} as const;
export const SATELLITE_RADIUS = 0.35;
export const MIN_SATELLITE_PX = 10;
// Orthographic frame radii used when rendering the transparent static previews.
export const PREVIEW_RADIUS = { planet: 1.02, satellite: 0.4 } as const;
