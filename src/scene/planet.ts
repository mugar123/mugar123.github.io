import { Color, Group, IcosahedronGeometry, Mesh, MeshLambertMaterial } from 'three';

export const PLANET_COLOR = '#B88746';

/** Warm matte placeholder, retained if the selected planet cannot be downloaded. */
export function createPlanet(): Group {
  const group = new Group();
  group.name = 'planet';
  group.add(new Mesh(
    new IcosahedronGeometry(1, 2),
    new MeshLambertMaterial({ color: new Color(PLANET_COLOR), flatShading: true }),
  ));
  return group;
}
