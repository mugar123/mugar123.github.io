/**
 * Timing for the home mission console: when each line of its boot log appears, how long each command
 * takes to type, and how the project panels power on afterwards. Pure: the component computes the
 * schedule at build time and writes it into the markup as `--t` (start) and `--d` (length), in ms.
 */

/** Base timings in ms, at speed 1. Commands type at a steady {@link BOOT.charMs} per character. */
export const BOOT = {
  startMs: 120,       // before the first prompt
  promptMs: 240,      // caret blinks at an empty prompt before typing starts
  charMs: 18,
  caretTailMs: 160,   // caret lingers after the last character
  afterCmdMs: 150,    // pause between a typed command and its output
  outMs: 120,         // between plain output lines
  afterOutsMs: 160,
  rowMs: 95,          // between spec rows
  afterRowsMs: 220,
  scanMs: 230,        // the sweep has to find something before each band reports
  afterScansMs: 200,
  satMs: 140,         // between satellite lines
  fillMs: 460,        // a signal meter filling
  afterSatsMs: 200,
  readyTailMs: 200,
  radarTailMs: 250,   // the radar stays up a moment after the log ends
  sweepMs: 520,       // deploy: the scan line crossing the screen
  panelGapMs: 230,    // between panels powering on
  firstPanelMs: 120,
  openMs: 460,        // a panel's power-on
  panelRowMs: 75,     // between a panel's rows
  flashMs: 900,       // a panel's border settling from the accent
} as const;

export type BootLine =
  | { kind: 'cmd'; text: string; opensRadar?: boolean }
  | { kind: 'out'; linksUp?: boolean }
  | { kind: 'rows'; count: number }
  | { kind: 'scan' }
  | { kind: 'sat' }
  | { kind: 'ready' };

export interface Span { t: number; d: number }
export interface LineTiming { at: number; type?: Span; caret?: Span; rows?: number[]; fill?: Span }
export interface BootSchedule { lines: LineTiming[]; link: number; radar: Span | null; total: number }
export interface PanelTiming { open: Span; flash: Span; rows: number[] }
export interface DeploySchedule { scan: Span; panels: PanelTiming[]; total: number }

const span = (t: number, d: number): Span => ({ t: Math.round(t), d: Math.round(d) });

/** The boot log, line by line. Consecutive lines of one kind form a group with a pause after it. */
export function scheduleBoot(lines: readonly BootLine[], speed = 1): BootSchedule {
  const ms = (n: number) => n * speed;
  let t = ms(BOOT.startMs);
  let link = 0;
  let radarStart: number | null = null;
  const out: LineTiming[] = lines.map((line, i) => {
    const groupEnds = lines[i + 1]?.kind !== line.kind;
    switch (line.kind) {
      case 'cmd': {
        const at = t;
        const type = span(at + ms(BOOT.promptMs), ms(line.text.length * BOOT.charMs));
        const typed = at + ms(BOOT.promptMs + line.text.length * BOOT.charMs);
        if (line.opensRadar) radarStart = typed;
        t = typed + ms(BOOT.afterCmdMs);
        return { at: Math.round(at), type, caret: span(at, typed + ms(BOOT.caretTailMs) - at) };
      }
      case 'out': {
        const at = t;
        if (line.linksUp) link = Math.round(at);
        t += ms(groupEnds ? BOOT.afterOutsMs : BOOT.outMs);
        return { at: Math.round(at) };
      }
      case 'rows': {
        const rows = Array.from({ length: line.count }, (_, r) => Math.round(t + ms(r * BOOT.rowMs)));
        const at = t;
        t += ms((line.count - 1) * BOOT.rowMs + BOOT.afterRowsMs);
        return { at: Math.round(at), rows };
      }
      case 'scan': {
        t += ms(BOOT.scanMs);
        const at = t;
        if (groupEnds) t += ms(BOOT.afterScansMs);
        return { at: Math.round(at) };
      }
      case 'sat': {
        if (i > 0 && lines[i - 1]!.kind === 'sat') t += ms(BOOT.satMs);
        const at = t;
        if (groupEnds) t += ms(BOOT.fillMs + BOOT.afterSatsMs);
        return { at: Math.round(at), fill: span(at, ms(BOOT.fillMs)) };
      }
      case 'ready': {
        const at = t;
        t += ms(BOOT.readyTailMs);
        return { at: Math.round(at) };
      }
    }
  });
  const total = Math.round(t);
  const radar = radarStart === null ? null : span(radarStart, t + ms(BOOT.radarTailMs) - radarStart);
  return { lines: out, link, radar, total };
}

/** The panels, relative to the moment the log has finished and the screen is in view. */
export function scheduleDeploy(panels: number, rowsPerPanel: number, speed = 1): DeploySchedule {
  const ms = (n: number) => n * speed;
  const scan = span(0, ms(BOOT.sweepMs));
  const timings = Array.from({ length: panels }, (_, i): PanelTiming => {
    const start = ms(BOOT.firstPanelMs + i * BOOT.panelGapMs);
    const opened = start + ms(BOOT.openMs);
    return {
      open: span(start, ms(BOOT.openMs)),
      flash: span(opened, ms(BOOT.flashMs)),
      rows: Array.from({ length: rowsPerPanel }, (_, r) => Math.round(opened + ms(r * BOOT.panelRowMs))),
    };
  });
  const ends = timings.flatMap((p) => [p.rows.at(-1) ?? p.open.t + p.open.d, p.flash.t + p.flash.d]);
  return { scan, panels: timings, total: Math.max(scan.t + scan.d, ...ends) };
}
