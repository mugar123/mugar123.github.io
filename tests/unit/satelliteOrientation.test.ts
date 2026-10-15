import { expect, it } from 'vitest';
import { Euler, OrthographicCamera, Vector3 } from 'three';
import { CAMERA_POSITION, satellitePreviewRotation } from '@/scene/projection';

it('aims the static preview antenna at the projected planet in every orbital quadrant', () => {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const origin = new Vector3().project(camera);
  // Match the existing preview render's source antenna axis and Euler rotation.
  const tip = new Vector3(0, 0, 1).applyEuler(new Euler(0, -0.45, 0.08)).project(camera);
  const dx = tip.x - origin.x, dy = origin.y - tip.y;
  for (let i = 0; i < 16; i++) {
    const phase = i * Math.PI / 8;
    const position = { x: 3.2 * Math.cos(phase), y: 3.2 * Math.sin(phase) };
    const projected = new Vector3(position.x, 0, -position.y).project(camera);
    const inward = new Vector3(origin.x - projected.x, projected.y - origin.y, 0).normalize();
    const angle = satellitePreviewRotation(position) * Math.PI / 180;
    const antenna = new Vector3(dx * Math.cos(angle) - dy * Math.sin(angle), dx * Math.sin(angle) + dy * Math.cos(angle), 0).normalize();
    expect(antenna.dot(inward)).toBeCloseTo(1, 10);
  }
});
