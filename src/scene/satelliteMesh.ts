import { BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import { SATELLITE_RADIUS } from './modelConfig';

export type SatelliteKind = 'active' | 'muted';
/** Half-span, also used to keep labels clear of the solar panels. */
export const SATELLITE_SIZE: Record<SatelliteKind, number> = { active: SATELLITE_RADIUS, muted: SATELLITE_RADIUS };

/** Recognizable satellite placeholder while the shared model loads, also used on network failure. */
export function createSatelliteMesh(kind: SatelliteKind): Group {
  const group = new Group();
  group.name = `satellite-${kind}`;
  const body = new Mesh(new BoxGeometry(0.18, 0.14, 0.24), new MeshLambertMaterial({ color: '#CCD1D0' }));
  const panels = new Mesh(new BoxGeometry(SATELLITE_RADIUS * 2, 0.02, 0.18), new MeshLambertMaterial({ color: '#286AE8' }));
  group.add(body, panels);
  return group;
}
