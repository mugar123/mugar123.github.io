/**
 * Circular orbits around a planet of radius 1 with GM = 1: where a satellite is, and how fast it goes
 * round. Pure functions only: no DOM, no Three. The scene draws what this module computes.
 */
export interface Point { x: number; y: number }

/** Kepler's third law: angular speed on a circular orbit of radius r. */
export function angularSpeed(r: number): number {
  return r ** -1.5;
}
export function circularPosition(r: number, phase: number): Point {
  return { x: r * Math.cos(phase), y: r * Math.sin(phase) };
}
