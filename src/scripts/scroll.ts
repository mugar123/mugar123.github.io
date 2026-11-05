/**
 * Scroll-linked pieces of the page, driven by one passive listener and one rAF per frame:
 * the statement that lights up word by word, the notes scan, the separation pages and the timeline.
 * Each frame reads every position first and only then writes, so the page is laid out once per frame,
 * and a part that is off screen costs nothing.
 *
 * Progress through a pinned page is measured against the pinned element's own height (100svh), never
 * innerHeight: on phones innerHeight grows when the browser's toolbar collapses, mid-scroll, which made
 * the fills jump forward and finish before their page was released.
 */
import type { Replay } from './goto';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
root.classList.toggle('reduce', reduce.matches);

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const onScreen = (r: DOMRect, vh: number) => r.bottom >= 0 && r.top <= vh;
// Progress through a pinned hold: 0 when the pinned child reaches the top, 1 when the section starts to take it away.
const held = (r: DOMRect, pinned: number) => clamp(-r.top / Math.max(1, r.height - pinned));

// Statement: a slide held on screen while its words light up, one by one, as the section scrolls past.
const statements = [...document.querySelectorAll<HTMLElement>('[data-statement]')].map((section) => {
  const el = section.querySelector<HTMLElement>('[data-words]')!;
  if (!reduce.matches) el.classList.add('is-armed');
  return { section, el, pin: el.parentElement!, words: [...el.querySelectorAll<HTMLElement>('.w')], pinH: 0, lit: -1 };
});

function writeStatements(rects: DOMRect[]) {
  statements.forEach((s, i) => {
    s.el.classList.toggle('is-armed', !reduce.matches);
    if (reduce.matches) return;
    // Nothing is lit when the slide arrives; the last word lights before it leaves.
    const lit = Math.round(clamp(held(rects[i]!, s.pinH) / 0.8) * s.words.length);
    if (lit === s.lit) return;
    s.words.forEach((w, j) => w.classList.toggle('on', j < lit));
    s.lit = lit;
  });
}

// Notes scan: the compiled page is uncovered behind a beam as the section is scrolled. Where the browser
// runs the scan as a scroll-driven animation (see NotesScan.astro), this only follows its progress to
// light the steps; otherwise it moves the same layers itself. The hold is measured on what is pinned:
// the whole stage on wide screens, only the sheet and the steps (inside their run) on phones.
const scan = document.querySelector<HTMLElement>('[data-scan]');
const scanStage = scan?.querySelector<HTMLElement>('.lc__stage');
const scanRunEl = scan?.querySelector<HTMLElement>('[data-scan-run]');
const scanPinEl = scan?.querySelector<HTMLElement>('[data-scan-pin]');
const sheet = scan?.querySelector<HTMLElement>('[data-sheet]');
const reveal = scan?.querySelector<HTMLElement>('[data-reveal]');
const tex = scan?.querySelector<HTMLElement>('[data-tex]');
const beam = scan?.querySelector<HTMLElement>('[data-beam]');
const steps = scan ? [...scan.querySelectorAll<HTMLElement>('[data-steps] li')] : [];
let scanRun: HTMLElement | undefined = scan ?? undefined;
let scanH = 0;
let scanned = -1;
const cssScan = () => reveal?.getAnimations().find((a) => (a as CSSAnimation).animationName === 'lc-reveal');

function readScan(vh: number) {
  if (!scan || !scanRun || reduce.matches) return null;
  const rect = scanRun.getBoundingClientRect();
  if (scanned !== -1 && !onScreen(rect, vh)) return null;
  const css = cssScan();
  if (css) return { s: clamp(Number(css.effect?.getComputedTiming().progress ?? 0)), css: true };
  return { s: clamp((held(rect, scanH) - 0.18) / 0.62), css: false };
}

function writeScan(read: { s: number; css: boolean } | null) {
  if (!scan || !sheet || !reveal || !tex || !beam) return;
  if (reduce.matches) { sheet.classList.add('is-done'); return; } // shown compiled, no scrub
  if (!read || read.s === scanned) return;
  const { s, css } = read;
  scanned = s;
  if (!css) {
    reveal.style.transform = `translate3d(0, ${(s - 1) * 100}%, 0)`;
    tex.style.transform = `translate3d(0, ${(1 - s) * 100}%, 0)`;
    beam.style.transform = `translate3d(0, ${s * 100}%, 0)`;
    beam.style.opacity = s > 0 && s < 1 ? '1' : '0';
  }
  sheet.classList.toggle('is-done', s >= 1);
  const step = s >= 1 ? 2 : s > 0 ? 1 : 0;
  steps.forEach((li, i) => li.classList.toggle('is-on', i === step));
}

// Separation pages: the name fills with light from left to right while its page is held on screen,
// and is lit before the page leaves. Where the browser runs this as a scroll-driven animation (see
// .divider__lit), there is nothing to do here; otherwise the script moves the same two layers.
// Set on the elements themselves, never inherited through a parent.
const dividers = [...document.querySelectorAll<HTMLElement>('[data-divider]')].map((section) => {
  const lit = section.querySelector<HTMLElement>('.divider__lit')!;
  return {
    section,
    pin: section.querySelector<HTMLElement>('.divider__pin')!,
    lit,
    words: lit.firstElementChild as HTMLElement,
    pinH: 0,
    fill: -1,
  };
});
const cssDividers = () => !!dividers[0]?.lit.getAnimations().some((a) => (a as CSSAnimation).animationName === 'divider-window');

function writeDividers(rects: DOMRect[], vh: number, css: boolean) {
  if (reduce.matches || css) return;
  dividers.forEach((d, i) => {
    const rect = rects[i]!;
    if (!onScreen(rect, vh)) return;
    const hold = held(rect, d.pinH);
    const fill = clamp(hold / 0.7);
    if (fill !== d.fill) {
      d.lit.style.transform = `translate3d(${(fill - 1) * 100}%, 0, 0)`;
      d.words.style.transform = `translate3d(${(1 - fill) * 125}%, 0, 0)`;
      d.fill = fill;
    }
  });
}

// Studies: the timeline's line fills as the reader scrolls, and each milestone lights the moment the
// fill reaches its dot. The fill follows the scroll exactly (no easing: it is the reader's own motion,
// so it can be stopped or reversed at any instant); only the lit state itself transitions, in CSS.
// Where the browser can tie an animation to the scroll (see .tl__fill), it draws the fill itself, on the
// scrolling thread, and this script only reads that animation's progress to light the milestones.
// Two layouts share the logic: a vertical rail, where the fill tracks a reading line 60% down the
// viewport, and a pinned stage, where it tracks progress through the section's scroll length.
const timeline = (() => {
  const root = document.querySelector<HTMLElement>('[data-timeline]');
  if (!root) return null;
  const section = root.closest<HTMLElement>('section') ?? root;
  const dots = [...root.querySelectorAll<HTMLElement>('[data-ms]')].map((ms) => ({
    ms,
    dot: ms.querySelector<HTMLElement>('[data-dot]') ?? ms,
    next: ms.classList.contains('ms--next'),
    at: 0,
  }));
  const now = dots.find((d) => d.ms.classList.contains('ms--now')) ?? dots[dots.length - 1]!;
  const stage = root.dataset.timeline === 'stage';
  const track = root.querySelector<HTMLElement>('[data-track]');
  const fill = root.querySelector<HTMLElement>('.tl__fill');
  return { root, section, dots, now, stage, track, fill, p: -1 };
})();

// Each dot's place along the line, as a fraction of the way from the first dot to the "now" dot.
function measureTimeline() {
  if (!timeline) return;
  const { dots, now, stage, root, track } = timeline;
  const centre = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return stage ? r.left + r.width / 2 : r.top + r.height / 2;
  };
  // Measure the stage untranslated, so positions along the track are the track's own.
  const saved = root.style.getPropertyValue('--p');
  if (stage) root.style.setProperty('--p', '0');
  const first = centre(dots[0]!.dot);
  const end = centre(now.dot);
  for (const d of dots) d.at = end === first ? 0 : (centre(d.dot) - first) / (end - first);
  if (stage && track) root.style.setProperty('--travel', `${Math.max(0, track.scrollWidth - root.clientWidth)}px`);
  if (stage) root.style.setProperty('--p', saved);
  timeline.p = -1;
}

// The browser's own scroll-driven fill, when it runs one.
const cssFill = () => timeline?.fill?.getAnimations().find((a) => (a as CSSAnimation).animationName === 'tl-fill');

function readTimeline(vh: number) {
  if (!timeline || reduce.matches) return null;
  const { section, dots, now, stage } = timeline;
  const rect = section.getBoundingClientRect();
  if (!onScreen(rect, vh)) return null;
  if (stage) return { p: clamp(-rect.top / (rect.height - vh)), css: false };
  const css = cssFill();
  if (css) return { p: clamp(Number(css.effect?.getComputedTiming().progress ?? 0)), css: true };
  const line = vh * 0.6;
  const first = dots[0]!.dot.getBoundingClientRect();
  const end = now.dot.getBoundingClientRect();
  const a = first.top + first.height / 2;
  const b = end.top + end.height / 2;
  return { p: clamp((line - a) / (b - a)), css: false };
}

function writeTimeline(read: { p: number; css: boolean } | null) {
  if (!timeline) return;
  const { root, dots, fill, stage } = timeline;
  if (reduce.matches) {
    if (timeline.p !== 1) {
      root.style.removeProperty('--p');
      fill?.style.removeProperty('transform');
      dots.forEach((d) => d.ms.classList.toggle('is-reached', !d.next));
      timeline.p = 1;
    }
    return;
  }
  if (!read || read.p === timeline.p) return;
  const { p, css } = read;
  timeline.p = p;
  // The fill's own transform, never a variable its whole subtree would inherit and restyle every frame.
  if (stage) root.style.setProperty('--p', p.toFixed(4));
  else if (fill && !css) fill.style.transform = `scaleY(${p.toFixed(4)})`;
  for (const d of dots) d.ms.classList.toggle('is-reached', !d.next && d.at <= p + 1e-6);
}

// Heights the progress is measured against, read once per resize rather than every frame.
function measure() {
  for (const s of statements) { s.pinH = s.pin.offsetHeight; s.lit = -1; }
  for (const d of dividers) { d.pinH = d.pin.offsetHeight; d.fill = -1; d.shown = -1; }
  // Phones pin only the sheet and the steps; there the hold runs through their run, not the section.
  const pinOnly = !!scanPinEl && getComputedStyle(scanPinEl).position === 'sticky';
  scanRun = (pinOnly ? scanRunEl : scan) ?? undefined;
  scanH = (pinOnly ? scanPinEl?.offsetHeight : scanStage?.offsetHeight) ?? 0;
  scanned = -1;
  measureTimeline();
}

// Drawings that play once, the first time they are mostly on screen (the 748 chart, the citation trail).
const once = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('is-in');
    once.unobserve(entry.target);
  }
}, { threshold: 0.6 });
document.querySelectorAll('[data-draw], [data-trail]').forEach((el) => once.observe(el));
// Reached again from the island, they draw again (scripts/goto.ts). Each is undrawn once it is off
// screen, so one still in view as the trip begins doesn't replay unseen while the page travels away,
// and is drawn again when it is next mostly on screen.
const away = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) continue;
    away.unobserve(entry.target);
    entry.target.classList.remove('is-in');
    once.observe(entry.target);
  }
});
document.addEventListener('replay', (e) => {
  const { has } = (e as Replay).detail;
  document.querySelectorAll('[data-draw].is-in, [data-trail].is-in').forEach((el) => { if (has(el)) away.observe(el); });
});

// The citation trail is dashed in its drawing's own units, so while it draws, its stroke scales with the
// drawing; --unit is one screen pixel in those units, which keeps the line a hairline at any width.
document.querySelectorAll<SVGSVGElement>('[data-trail] svg').forEach((svg) => {
  new ResizeObserver(([entry]) => {
    const w = entry?.contentRect.width ?? 0;
    if (w > 0) svg.style.setProperty('--unit', (svg.viewBox.baseVal.width / w).toFixed(4));
  }).observe(svg);
});

let queued = false;
let dirty = true;
function update() {
  queued = false;
  if (dirty) { measure(); dirty = false; }
  const vh = innerHeight;
  // Read...
  const statementRects = statements.map((s) => s.section.getBoundingClientRect());
  const scanRead = readScan(vh);
  const dividersCss = cssDividers();
  const dividerRects = dividersCss ? [] : dividers.map((d) => d.section.getBoundingClientRect());
  const tl = readTimeline(vh);
  // ...then write.
  writeStatements(statementRects);
  writeScan(scanRead);
  writeDividers(dividerRects, vh, dividersCss);
  writeTimeline(tl);
}
function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(update);
}
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', () => { dirty = true; queue(); });
reduce.addEventListener('change', () => {
  root.classList.toggle('reduce', reduce.matches);
  if (reduce.matches) [reveal, tex, beam].forEach((el) => { el?.style.removeProperty('transform'); el?.style.removeProperty('opacity'); });
  if (reduce.matches) dividers.forEach((d) => { d.lit.style.transform = ''; d.words.style.transform = ''; d.sub.style.opacity = ''; });
  if (timeline) timeline.p = -1;
  dirty = true;
  queue();
});
update();
