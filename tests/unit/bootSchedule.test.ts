import { describe, it, expect } from 'vitest';
import { scheduleBoot, scheduleDeploy, BOOT, type BootLine } from '@/lib/bootSchedule';

/** The log the home console ships with: uplink, specs, scan, handshake, deploy. */
const LOG: BootLine[] = [
  { kind: 'cmd', text: 'uplink --station classroom' },
  { kind: 'out' }, { kind: 'out', linksUp: true },
  { kind: 'cmd', text: 'specs --vehicle' },
  { kind: 'rows', count: 6 },
  { kind: 'cmd', text: 'telemetry scan --bands low,mid,high', opensRadar: true },
  { kind: 'scan' }, { kind: 'scan' }, { kind: 'scan' },
  { kind: 'cmd', text: 'handshake SAT-01 SAT-02' },
  { kind: 'sat' }, { kind: 'sat' },
  { kind: 'cmd', text: 'deploy --panels' },
  { kind: 'ready' },
];

const numbers = (value: unknown): number[] =>
  typeof value === 'number' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(numbers) : [];

describe('scheduleBoot', () => {
  const s = scheduleBoot(LOG);

  it('types each command one character at a time, after the caret has blinked at the prompt', () => {
    const first = s.lines[0]!;
    expect(first.type).toEqual({ t: first.at + BOOT.promptMs, d: 'uplink --station classroom'.length * BOOT.charMs });
    expect(first.caret!.t).toBe(first.at);
    expect(first.caret!.t + first.caret!.d).toBeGreaterThan(first.type!.t + first.type!.d);
  });

  it('never shows a line before the command above it has finished typing', () => {
    let free = 0;
    for (const line of s.lines) {
      expect(line.at).toBeGreaterThanOrEqual(free);
      free = line.type ? line.type.t + line.type.d : line.at;
    }
  });

  it('prints the spec rows one after another', () => {
    const rows = s.lines[4]!.rows!;
    expect(rows).toHaveLength(6);
    expect(rows[0]).toBeGreaterThanOrEqual(s.lines[4]!.at);
    rows.slice(1).forEach((row, i) => expect(row - rows[i]!).toBe(BOOT.rowMs));
  });

  it('fills each satellite meter from the moment its line appears', () => {
    for (const line of [s.lines[10]!, s.lines[11]!]) expect(line.fill).toEqual({ t: line.at, d: BOOT.fillMs });
  });

  it('brings the link up with the line that reports it', () => {
    expect(s.link).toBe(s.lines[2]!.at);
  });

  it('opens the radar once the scan command is typed and keeps it until the log ends', () => {
    const scan = s.lines[5]!;
    expect(s.radar!.t).toBe(scan.type!.t + scan.type!.d);
    expect(s.radar!.t + s.radar!.d).toBeGreaterThanOrEqual(s.total);
  });

  it('has no radar when no command opens one', () => {
    expect(scheduleBoot([{ kind: 'cmd', text: 'ls' }]).radar).toBeNull();
  });

  it('ends after its last line, in whole milliseconds', () => {
    expect(s.total).toBeGreaterThan(s.lines.at(-1)!.at);
    for (const n of numbers(s)) expect(Number.isInteger(n)).toBe(true);
  });

  it('plays the shipped log in under eight seconds', () => {
    expect(s.total).toBeLessThan(8000);
  });

  it('scales every time with the speed factor', () => {
    const fast = scheduleBoot(LOG, 0.5);
    expect(Math.abs(fast.total - s.total / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(fast.lines[4]!.at - s.lines[4]!.at / 2)).toBeLessThanOrEqual(1);
  });
});

describe('scheduleDeploy', () => {
  const d = scheduleDeploy(2, 5);

  it('sweeps the screen, then powers the panels on one after another', () => {
    expect(d.scan.t).toBe(0);
    expect(d.panels).toHaveLength(2);
    expect(d.panels[1]!.open.t).toBeGreaterThan(d.panels[0]!.open.t);
  });

  it('prints a panel only once it is open, row by row, and flashes its border as it opens', () => {
    for (const p of d.panels) {
      const opened = p.open.t + p.open.d;
      expect(p.rows).toHaveLength(5);
      expect(p.rows[0]).toBe(opened);
      p.rows.slice(1).forEach((row, i) => expect(row).toBeGreaterThan(p.rows[i]!));
      expect(p.flash.t).toBe(opened);
    }
  });

  it('ends when the last row has printed and the last flash has faded', () => {
    const ends = d.panels.flatMap((p) => [p.rows.at(-1)!, p.flash.t + p.flash.d]);
    expect(d.total).toBe(Math.max(d.scan.t + d.scan.d, ...ends));
  });
});
