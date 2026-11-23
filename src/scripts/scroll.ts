/**
 * Scroll-linked pieces of the page, driven by one passive listener and one rAF per frame:
 * the statement that lights up word by word, the notes scan, the separation pages and the timeline.
 * Each frame reads every position first and only then writes, so the page is laid out once per frame,
 * and a part that is off screen costs nothing.
 *
 * Progress through a pinned page is measured against the pinned element's own height (100svh), never
 * innerHeight: on phones innerHeight grows when the browser's toolbar collapses, mid-scroll, which made
 * the fills jump forward and finish before their page was released.
 *
 * The home page calls initScroll each time it is shown (scripts/page.ts); everything it starts stops
 * when the page is swapped out.
 */
import type { Replay } from './goto';
import { statementProgress } from './statement-progress';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const onScreen = (r: DOMRect, vh: number) => r.bottom >= 0 && r.top <= vh;
// Progress through a pinned hold: 0 when the pinned child reaches the top, 1 when the section starts to take it away.
const held = (r: DOMRect, pinned: number) => clamp(-r.top / Math.max(1, r.height - pinned));

export function initScroll(signal: AbortSignal) {
  let reduced = reduce.matches;
  root.classList.toggle('reduce', reduced);

  // Statement: a slide held on screen while its words light up, one by one, as the section scrolls past.
  const statements = [...document.querySelectorAll<HTMLElement>('[data-statement]')].map((section) => {
    const el = section.querySelector<HTMLElement>('[data-words]')!;
    return { section, el, pin: section.querySelector<HTMLElement>('.statement__slide')!, words: [...el.querySelectorAll<HTMLElement>('.w')], pinH: 0, lit: 0 };
  });

  function writeStatements(rects: (DOMRect | null)[]) {
    statements.forEach((s, i) => {
      const rect = rects[i];
      if (!rect) return;
      // Nothing is lit when the slide arrives; the last word lights before it leaves.
      const lit = Math.round(statementProgress(rect.top, rect.height - s.pinH) * s.words.length);
      if (lit === s.lit) return;
      for (let j = Math.min(s.lit, lit); j < Math.max(s.lit, lit); j++) {
        s.words[j]!.classList.toggle('on', j < lit);
      }
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
  let scanAnimation: Animation | undefined;

  function readScan(vh: number) {
    if (!scan || !scanRun || reduced) return null;
    const rect = scanRun.getBoundingClientRect();
    if (scanned !== -1 && !onScreen(rect, vh)) return null;
    if (scanAnimation) return { s: clamp(Number(scanAnimation.effect?.getComputedTiming().progress ?? 0)), css: true };
    return { s: clamp((held(rect, scanH) - 0.18) / 0.62), css: false };
  }

  function writeScan(read: { s: number; css: boolean } | null) {
    if (!scan || !sheet || !reveal || !tex || !beam) return;
    if (reduced) { sheet.classList.add('is-done'); return; } // shown compiled, no scrub
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

  // Sticky positioning handles the whole hold. Only the light needs a scroll-timeline fallback.
  const dividers = [...document.querySelectorAll<HTMLElement>('[data-divider]')].map((section) => ({
    section,
    pin: section.querySelector<HTMLElement>('.divider__pin')!,
    light: section.querySelector<HTMLElement>('.divider__light')!,
    pinH: 0,
    fill: -1,
  }));
  let dividersCss = false;

  function writeDividers(rects: (DOMRect | null)[], vh: number) {
    rects.forEach((rect, i) => {
      if (!rect || !onScreen(rect, vh)) return;
      const d = dividers[i]!;
      const hold = held(rect, d.pinH);
      const fill = clamp(hold / 0.7);
      if (fill !== d.fill) {
        d.light.style.transform = `translate3d(${(fill - 1) * 100}%, 0, 0)`;
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
  let fillAnimation: Animation | undefined;

  function readTimeline(vh: number) {
    if (!timeline || reduced) return null;
    const { section, dots, now, stage } = timeline;
    const rect = section.getBoundingClientRect();
    if (!onScreen(rect, vh)) return null;
    if (stage) return { p: clamp(-rect.top / (rect.height - vh)), css: false };
    if (fillAnimation) return { p: clamp(Number(fillAnimation.effect?.getComputedTiming().progress ?? 0)), css: true };
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
    if (reduced) {
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
    for (const s of statements) {
      s.el.classList.toggle('is-armed', !reduced);
      s.pinH = s.pin.offsetHeight;
    }
    scanAnimation = reveal?.getAnimations().find((a) => (a as CSSAnimation).animationName === 'lc-reveal');
    fillAnimation = timeline?.fill?.getAnimations().find((a) => (a as CSSAnimation).animationName === 'tl-fill');
    dividersCss = !!dividers[0]?.light.getAnimations().some((a) => (a as CSSAnimation).animationName === 'divider-fill');
    for (const d of dividers) {
      if (dividersCss || reduced) {
        visibility.unobserve(d.section);
        nearby.delete(d.section);
      } else {
        visibility.observe(d.section);
        d.pinH = d.pin.getBoundingClientRect().height;
        d.fill = -1;
      }
    }
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
  }, { signal });

  // The citation trail is dashed in its drawing's own units, so while it draws, its stroke scales with the
  // drawing; --unit is one screen pixel in those units, which keeps the line a hairline at any width.
  const units = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const svg = entry.target as SVGSVGElement;
      const w = entry.contentRect.width;
      if (w > 0) svg.style.setProperty('--unit', (svg.viewBox.baseVal.width / w).toFixed(4));
    }
  });
  document.querySelectorAll<SVGSVGElement>('[data-trail] svg').forEach((svg) => units.observe(svg));
  signal.addEventListener('abort', () => { once.disconnect(); away.disconnect(); units.disconnect(); });

  let queued = 0;
  let dirty = true;
  function update() {
    queued = 0;
    const all = dirty;
    if (dirty) { measure(); dirty = false; }
    const vh = innerHeight;
    const needsRead = (section: HTMLElement) => all || nearby.has(section);
    const rectFor = ({ section }: { section: HTMLElement }) =>
      needsRead(section) ? section.getBoundingClientRect() : null;
    const statementRects = reduced ? [] : statements.map(rectFor);
    const scanRead = scan && needsRead(scan) ? readScan(vh) : null;
    const dividerRects = dividersCss || reduced ? [] : dividers.map(rectFor);
    const tl = timeline && needsRead(timeline.section) ? readTimeline(vh) : null;
    // ...then write.
    writeStatements(statementRects);
    writeScan(scanRead);
    writeDividers(dividerRects, vh);
    writeTimeline(tl);
  }
  function queue() {
    if (queued) return;
    queued = requestAnimationFrame(update);
  }
  // Wake a little before entry, including when a link jumps straight to another section.
  const nearby = new Set<Element>();
  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) nearby.add(entry.target);
      else nearby.delete(entry.target);
    }
    onScroll();
  }, { rootMargin: '300px 0px' });
  function onScroll() {
    if (nearby.size && !reduced) queue();
  }
  addEventListener('scroll', onScroll, { passive: true, signal });
  function resized() { dirty = true; queue(); }
  addEventListener('resize', resized, { signal });
  reduce.addEventListener('change', (event) => {
    reduced = event.matches;
    root.classList.toggle('reduce', reduced);
    if (reduced) [reveal, tex, beam].forEach((el) => { el?.style.removeProperty('transform'); el?.style.removeProperty('opacity'); });
    if (reduced) dividers.forEach((d) => d.light.style.removeProperty('transform'));
    if (timeline) timeline.p = -1;
    dirty = true;
    queue();
  }, { signal });
  signal.addEventListener('abort', () => {
    visibility.disconnect();
    cancelAnimationFrame(queued);
  });
  update();
  for (const s of statements) visibility.observe(s.section);
  if (scan) visibility.observe(scan);
  if (timeline) visibility.observe(timeline.section);
}
