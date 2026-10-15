import { Color, InstancedInterleavedBuffer, InterleavedBufferAttribute, Vector3 } from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { circularPosition, type Point } from '@/lib/orbit';

export const INK = '#121412';
export const INK_2 = '#6E736D';
export const ACCENT = '#E2401C';

/** Simulation plane (x, y) → Three (x, 0, −y). */
export const toThree = (p: Point, out = new Vector3()): Vector3 => out.set(p.x, 0, -p.y);

export interface TraceStyle {
  color: string;
  /** CSS px (screen space, so lines stay 1 px on every display, like the SVG fallback's strokes). */
  width?: number;
  /** Dash and gap lengths in scene units; omit `dash` for a solid line. */
  dash?: number;
  gap?: number;
  /** Fading traces need blending; static ones stay opaque. */
  transparent?: boolean;
}

/**
 * A polyline in the orbital plane drawn with screen-space width (`Line2`), with a fixed vertex capacity
 * so it can be rewritten every frame without reallocating GPU buffers. Plain WebGL lines are always one
 * device pixel — a 0.5 px hairline on a 2× display — which would not match the 1 px SVG fallback.
 */
export class Trace {
  readonly line: Line2;
  readonly material: LineMaterial;
  private readonly geometry: LineGeometry;
  private readonly seg: Float32Array;
  private readonly dist: Float32Array;
  private readonly segBuf: InstancedInterleavedBuffer;
  private readonly distBuf: InstancedInterleavedBuffer;
  private readonly period: number;

  constructor(readonly capacity: number, style: TraceStyle) {
    this.geometry = new LineGeometry();
    this.seg = new Float32Array(capacity * 6);
    this.dist = new Float32Array(capacity * 2);
    this.segBuf = new InstancedInterleavedBuffer(this.seg, 6, 1);
    this.distBuf = new InstancedInterleavedBuffer(this.dist, 2, 1);
    this.geometry.setAttribute('instanceStart', new InterleavedBufferAttribute(this.segBuf, 3, 0));
    this.geometry.setAttribute('instanceEnd', new InterleavedBufferAttribute(this.segBuf, 3, 3));
    this.geometry.setAttribute('instanceDistanceStart', new InterleavedBufferAttribute(this.distBuf, 1, 0));
    this.geometry.setAttribute('instanceDistanceEnd', new InterleavedBufferAttribute(this.distBuf, 1, 1));
    this.geometry.instanceCount = 0;
    const dashed = style.dash !== undefined;
    this.period = dashed ? style.dash! + (style.gap ?? style.dash!) : 0;
    this.material = new LineMaterial({
      color: new Color(style.color),
      linewidth: style.width ?? 1,
      worldUnits: false,
      dashed,
      dashSize: style.dash ?? 1,
      gapSize: style.gap ?? style.dash ?? 1,
      transparent: style.transparent ?? false,
    });
    this.line = new Line2(this.geometry, this.material);
    this.line.frustumCulled = false; // the bounding volume would be stale between rewrites
  }

  /**
   * Draws `points` (simulation plane, at most `capacity + 1` of them; extra points are dropped). A
   * `closed` dashed path has its dash period stretched so a whole number of dashes fits — no seam.
   */
  set(points: readonly Point[], closed = false): void {
    const n = Math.min(points.length, this.capacity + 1);
    const segments = Math.max(0, n - 1);
    let total = 0;
    for (let i = 0; i < segments; i++) {
      const a = points[i]!, b = points[i + 1]!;
      const o = i * 6;
      this.seg[o] = a.x; this.seg[o + 1] = 0; this.seg[o + 2] = -a.y;
      this.seg[o + 3] = b.x; this.seg[o + 4] = 0; this.seg[o + 5] = -b.y;
      this.dist[i * 2] = total;
      total += Math.hypot(b.x - a.x, b.y - a.y);
      this.dist[i * 2 + 1] = total;
    }
    if (closed && this.period > 0 && total > 0) {
      const k = (Math.max(1, Math.round(total / this.period)) * this.period) / total;
      for (let i = 0; i < segments * 2; i++) this.dist[i] = this.dist[i]! * k;
    }
    this.segBuf.addUpdateRange(0, segments * 6);
    this.distBuf.addUpdateRange(0, segments * 2);
    this.segBuf.needsUpdate = true;
    this.distBuf.needsUpdate = true;
    this.geometry.instanceCount = segments;
  }

  clear(): void { this.geometry.instanceCount = 0; }

  dispose(): void {
    this.line.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

export function ringPoints(radius: number, segments = 160): Point[] {
  return Array.from({ length: segments + 1 }, (_, i) => circularPosition(radius, (i / segments) * Math.PI * 2));
}

/** A dashed ink orbit ring of the given radius. */
export function createRing(radius: number): Trace {
  const pts = ringPoints(radius);
  const t = new Trace(pts.length - 1, { color: INK, width: 1, dash: 0.07, gap: 0.09 });
  t.set(pts, true);
  t.line.name = `ring-${radius}`;
  return t;
}
