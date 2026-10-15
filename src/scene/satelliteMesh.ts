import { Color, IcosahedronGeometry, Mesh, MeshLambertMaterial } from 'three';
import { ACCENT, INK } from './rings';

export type SatelliteKind = 'active' | 'muted';

/** Scene-unit radius of each kind; the overlay uses it to start leader lines clear of the mesh. */
export const SATELLITE_SIZE: Record<SatelliteKind, number> = { active: 0.11, muted: 0.11 };
const COLOR: Record<SatelliteKind, string> = { active: ACCENT, muted: INK };

/** Small matte icosahedra: the accent marks an active project. */
export function createSatelliteMesh(kind: SatelliteKind): Mesh<IcosahedronGeometry, MeshLambertMaterial> {
  const mesh = new Mesh(new IcosahedronGeometry(SATELLITE_SIZE[kind], 0), new MeshLambertMaterial({ color: new Color(COLOR[kind]), flatShading: true }));
  mesh.name = `satellite-${kind}`;
  return mesh;
}
