import type { LaunchParams } from './orbit';

export const MIN_SPEED = 0.3;
export const MAX_SPEED = 1.8;
export const DEAD_ZONE = 0.08;
export const SNAP_ANGLE = (3 * Math.PI) / 180;

export interface DragVector { tangential: number; radial: number }

/** Maps a drag vector in the orbital plane (scene units) to launch parameters. One scene unit of drag = one unit of speed. */
export function dragToLaunch(d: DragVector, { scale = 1 }: { scale?: number } = {}): LaunchParams | null {
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const len = Math.hypot(d.tangential, d.radial);
  if (!Number.isFinite(len) || len < DEAD_ZONE) return null;
  const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, len * scale));
  let angle = Math.atan2(d.radial, d.tangential);
  if (Math.abs(angle) <= SNAP_ANGLE) angle = 0;
  else if (Math.PI - Math.abs(angle) <= SNAP_ANGLE) angle = Math.PI;
  return { angle, speed };
}

export function formatSpeed(speed: number): string {
  return `${speed.toFixed(2)} v₀`;
}
