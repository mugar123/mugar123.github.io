/**
 * Scroll-linked pieces of the page, driven by one passive listener and one rAF per frame:
 * the statement that lights up word by word, the notes scan and the separation pages.
 */
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
root.classList.toggle('reduce', reduce.matches);

const clamp = (x: number) => Math.min(1, Math.max(0, x));

// Statement: a slide held on screen while its words light up, one by one, as the section scrolls past.
const statements = [...document.querySelectorAll<HTMLElement>('[data-statement]')].map((section) => {
  const el = section.querySelector<HTMLElement>('[data-words]')!;
  if (!reduce.matches) el.classList.add('is-armed');
  return { section, el, words: [...el.querySelectorAll<HTMLElement>('.w')], lit: -1 };
});

function updateStatements(vh: number) {
  for (const s of statements) {
    s.el.classList.toggle('is-armed', !reduce.matches);
    if (reduce.matches) continue;
    const rect = s.section.getBoundingClientRect();
    const p = clamp(-rect.top / (rect.height - vh));
    // Nothing is lit when the slide arrives; the last word lights before it leaves.
    const lit = Math.round(clamp(p / 0.8) * s.words.length);
    if (lit === s.lit) continue;
    s.words.forEach((w, i) => w.classList.toggle('on', i < lit));
    s.lit = lit;
  }
}

// Notes scan: the compiled page is uncovered behind a beam as the section is scrolled.
const scan = document.querySelector<HTMLElement>('[data-scan]');
const sheet = scan?.querySelector<HTMLElement>('[data-sheet]');
const tex = scan?.querySelector<HTMLElement>('[data-tex]');
const beam = scan?.querySelector<HTMLElement>('[data-beam]');
const steps = scan ? [...scan.querySelectorAll<HTMLElement>('[data-steps] li')] : [];

function updateScan(vh: number) {
  if (!scan || !sheet || !tex || !beam) return;
  if (reduce.matches) { sheet.classList.add('is-done'); return; } // shown compiled, no scrub
  const rect = scan.getBoundingClientRect();
  const p = clamp(-rect.top / (rect.height - vh));
  const s = clamp((p - 0.18) / 0.62);
  tex.style.clipPath = `inset(0 0 ${(1 - s) * 100}% 0)`;
  beam.style.transform = `translate3d(0, ${s * sheet.clientHeight}px, 0)`;
  beam.style.opacity = s > 0 && s < 1 ? '1' : '0';
  sheet.classList.toggle('is-done', s >= 1);
  const step = s >= 1 ? 2 : s > 0 ? 1 : 0;
  steps.forEach((li, i) => li.classList.toggle('is-on', i === step));
}

// Separation pages: the name fills with light from left to right while its page is held on screen,
// then the line under it fades in. Set on the elements themselves, never inherited through a parent.
const dividers = [...document.querySelectorAll<HTMLElement>('[data-divider]')].map((section) => ({
  section,
  title: section.querySelector<HTMLElement>('.divider__title')!,
  sub: section.querySelector<HTMLElement>('.divider__sub')!,
}));

function updateDividers(vh: number) {
  if (reduce.matches) return;
  for (const d of dividers) {
    const rect = d.section.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) continue;
    // Progress through the hold: 0 when the page pins at the top, 1 when it starts to leave.
    const hold = clamp(-rect.top / (rect.height - vh));
    const fill = clamp(hold / 0.7);
    d.title.style.backgroundPositionX = `${(1 - fill) * 100}%`;
    d.sub.style.opacity = clamp((hold - 0.7) / 0.2).toFixed(3);
  }
}

// Studies: the timeline's line fills as the reader scrolls, and each milestone lights the moment the
// fill reaches its dot. The fill follows the scroll exactly (no easing: it is the reader's own motion,
// so it can be stopped or reversed at any instant); only the lit state itself transitions, in CSS.
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
  return { root, section, dots, now, stage, track, p: -1 };
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

function updateTimeline(vh: number) {
  if (!timeline) return;
  const { root, section, dots, now, stage } = timeline;
  if (reduce.matches) {
    if (timeline.p !== 1) { root.style.removeProperty('--p'); dots.forEach((d) => d.ms.classList.toggle('is-reached', !d.next)); timeline.p = 1; }
    return;
  }
  const rect = section.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > vh) return;
  let p: number;
  if (stage) {
    p = clamp(-rect.top / (rect.height - vh));
  } else {
    const line = vh * 0.6;
    const first = dots[0]!.dot.getBoundingClientRect();
    const end = now.dot.getBoundingClientRect();
    const a = first.top + first.height / 2;
    const b = end.top + end.height / 2;
    p = clamp((line - a) / (b - a));
  }
  if (p === timeline.p) return;
  timeline.p = p;
  root.style.setProperty('--p', p.toFixed(4));
  for (const d of dots) d.ms.classList.toggle('is-reached', !d.next && d.at <= p + 1e-6);
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

let queued = false;
function update() {
  queued = false;
  const vh = innerHeight;
  updateStatements(vh);
  updateScan(vh);
  updateDividers(vh);
  updateTimeline(vh);
}
function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(update);
}
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', () => { measureTimeline(); queue(); });
reduce.addEventListener('change', () => {
  root.classList.toggle('reduce', reduce.matches);
  if (reduce.matches && tex) tex.style.clipPath = '';
  if (reduce.matches) dividers.forEach((d) => { d.title.style.backgroundPositionX = ''; d.sub.style.opacity = ''; });
  if (reduce.matches && timeline) timeline.p = -1;
  queue();
});
measureTimeline();
update();
