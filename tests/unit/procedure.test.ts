import { describe, it, expect } from 'vitest';
import { reachedStep, railFill } from '@/lib/procedure';

/** Marker centres, px from the top of the viewport; the gate (GO) is the third. */
const MARKERS = [100, 200, 300, 400, 500];
const GATE = 2;

describe('reachedStep', () => {
  it('is −1 before the first marker reaches the line', () => {
    expect(reachedStep(MARKERS, 99)).toBe(-1);
  });
  it('counts a marker exactly on the line as reached', () => {
    expect(reachedStep(MARKERS, 200)).toBe(1);
  });
  it('is the last marker above the line', () => {
    expect(reachedStep(MARKERS, 350)).toBe(2);
  });
  it('is the last step once every marker has passed', () => {
    expect(reachedStep(MARKERS, 9999)).toBe(4);
  });
  it('is −1 without markers', () => {
    expect(reachedStep([], 500)).toBe(-1);
  });
});

describe('railFill', () => {
  it('draws nothing before the first marker', () => {
    expect(railFill(MARKERS, GATE, 50)).toEqual({ explore: { top: 100, height: 0 }, commit: { top: 300, height: 0 } });
  });
  it('draws the dashed exploring part down to the line before the gate', () => {
    expect(railFill(MARKERS, GATE, 250)).toEqual({ explore: { top: 100, height: 150 }, commit: { top: 300, height: 0 } });
  });
  it('turns solid at the gate', () => {
    expect(railFill(MARKERS, GATE, 420)).toEqual({ explore: { top: 100, height: 200 }, commit: { top: 300, height: 120 } });
  });
  it('stops at the last marker', () => {
    expect(railFill(MARKERS, GATE, 9999)).toEqual({ explore: { top: 100, height: 200 }, commit: { top: 300, height: 200 } });
  });
});
