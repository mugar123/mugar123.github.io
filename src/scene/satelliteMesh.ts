import { Color, IcosahedronGeometry, Mesh, MeshLambertMaterial, OctahedronGeometry } from 'three';
import { ACCENT, INK, INK_2 } from './rings';

export type SatelliteKind = 'active' | 'muted' | 'visitor';

/** Scene-unit radius of each kind; the overlay uses it to start leader lines clear of the mesh. */
export const SATELLITE_SIZE: Record<SatelliteKind, number> = { active: 0.11, muted: 0.11, visitor: 0.07 };
const COLOR: Record<SatelliteKind, string> = { active: ACCENT, muted: INK, visitor: INK_2 };

/** Small matte polyhedra: project satellites are icosahedra, visitor launches smaller octahedra. */
export function createSatelliteMesh(kind: SatelliteKind, transparent = false): Mesh<IcosahedronGeometry | OctahedronGeometry, MeshLambertMaterial> {
  const size = SATELLITE_SIZE[kind];
  const geo = kind === 'visitor' ? new OctahedronGeometry(size) : new IcosahedronGeometry(size, 0);
  const mesh = new Mesh(geo, new MeshLambertMaterial({ color: new Color(COLOR[kind]), flatShading: true, transparent }));
  mesh.name = `satellite-${kind}`;
  return mesh;
}
