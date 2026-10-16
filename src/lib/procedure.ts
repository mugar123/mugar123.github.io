/**
 * The "How I work" countdown follows the reader: a step is reached when its marker crosses the reading
 * line, and the rail is drawn from the first marker down to that line, dashed up to the GO gate and
 * solid after it. Pure geometry on marker centres; the component measures them and applies the result.
 */

/** The reading line, as a fraction of the viewport's height from its top. */
export const READING_LINE = 0.55;

/** Index of the last step whose marker has crossed `line` (same coordinates), or −1 before the first. */
export function reachedStep(markers: readonly number[], line: number): number {
  let reached = -1;
  markers.forEach((y, i) => { if (y <= line) reached = i; });
  return reached;
}

export interface Segment { top: number; height: number }
export interface RailFill { explore: Segment; commit: Segment }

/** The drawn part of the rail: `explore` from the first marker to the gate, `commit` from the gate on. */
export function railFill(markers: readonly number[], gate: number, line: number): RailFill {
  const first = markers[0] ?? 0;
  const last = markers.at(-1) ?? first;
  const gateY = markers[gate] ?? last;
  const y = Math.min(Math.max(line, first), last);
  return {
    explore: { top: first, height: Math.min(y, gateY) - first },
    commit: { top: gateY, height: Math.max(0, y - gateY) },
  };
}
