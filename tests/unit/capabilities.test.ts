import { describe, it, expect } from 'vitest';
import { canRenderScene } from '@/scene/capabilities';
import { CAMERA_POSITION, SQUASH } from '@/scene/projection';

const canvas = (ok: boolean) => () => ({ getContext: () => (ok ? {} : null) });
const mm = (reduce: boolean) => (q: string) => ({ matches: q.includes('reduce') ? reduce : false });

describe('canRenderScene', () => {
  it('true with WebGL, no reduced motion, no save-data', () => {
    expect(canRenderScene({ createCanvas: canvas(true), matchMedia: mm(false) })).toBe(true);
  });
  it('false when getContext returns null', () => {
    expect(canRenderScene({ createCanvas: canvas(false), matchMedia: mm(false) })).toBe(false);
  });
  it('false when createCanvas throws or returns null', () => {
    expect(canRenderScene({ createCanvas: () => null, matchMedia: mm(false) })).toBe(false);
    expect(canRenderScene({ createCanvas: () => { throw new Error('x'); }, matchMedia: mm(false) })).toBe(false);
  });
  it('false under prefers-reduced-motion', () => {
    expect(canRenderScene({ createCanvas: canvas(true), matchMedia: mm(true) })).toBe(false);
  });
  it('false when matchMedia throws', () => {
    expect(canRenderScene({ createCanvas: canvas(true), matchMedia: () => { throw new Error('x'); } })).toBe(false);
  });
  it('false when matchMedia returns null', () => {
    expect(canRenderScene({ createCanvas: canvas(true), matchMedia: () => null as never })).toBe(false);
  });
  it('false when the connection asks to save data', () => {
    expect(canRenderScene({ createCanvas: canvas(true), matchMedia: mm(false), connection: { saveData: true } })).toBe(false);
  });
  it('true when matchMedia is unavailable (old browsers) but WebGL works', () => {
    expect(canRenderScene({ createCanvas: canvas(true) })).toBe(true);
  });
});

describe('projection constants', () => {
  it('SQUASH matches the camera elevation so the SVG and the scene agree', () => {
    const [, y, z] = CAMERA_POSITION;
    expect(SQUASH).toBeCloseTo(Math.sin(Math.atan2(y, z)), 2);
  });
});
