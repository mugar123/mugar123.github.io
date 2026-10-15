import { Color, IcosahedronGeometry, Mesh, MeshLambertMaterial } from 'three';

export const PLANET_COLOR = '#5E6B7A';

/** The classroom: a matte, faceted unit sphere (detail 2 keeps the facets readable at hero size). */
export function createPlanet(): Mesh {
  const geo = new IcosahedronGeometry(1, 2);
  const mat = new MeshLambertMaterial({ color: new Color(PLANET_COLOR), flatShading: true });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'planet';
  return mesh;
}
