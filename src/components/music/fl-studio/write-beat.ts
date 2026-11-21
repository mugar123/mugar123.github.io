import { onPage } from '@/scripts/page';
import { clamp, Spring } from '../v4/physics';
import { createHandoff, handoffDistance, lineupBridge, onJoinChange } from './handoff';
import { FILL_HOLD, clearTextFill, measureFillLine, measureTextFill, paintTextFill, type LitLine } from '../v4/text-fill';

const ease = (n: number) => {
  const t = clamp(n, 0, 1);
  return t * t * (3 - 2 * t);
};

/* The held scroll, 0 to 1: the story lights up, the window arrives, the notes are drawn, the velocities rise. */
const ARRIVE = { start: .12, each: .16 };
const WRITE = { start: .3, sweep: .42, each: .06 };
const STEMS = { start: .78, sweep: .09, each: .08 };

onPage(signal => {
  const section = document.querySelector<HTMLElement>('[data-studio]');
  if (!section) return;
  const stage = section.querySelector<HTMLElement>('.studio__stage')!;
  const passages = [...section.querySelectorAll<HTMLElement>('[data-fill-text]')];
  const fl = section.querySelector<HTMLElement>('[data-fl]')!;
  // What follows the chapter stands on the rest of its Playlist, and the window's shadow falls on it too.
  const after = section.nextElementSibling instanceof HTMLElement && section.nextElementSibling.matches('[data-studio-after]')
    ? section.nextElementSibling : null;
  const startOf = (el: HTMLElement, { start, sweep }: { start: number; sweep: number }) =>
    start + Number(el.dataset.step) / 32 * sweep;
  const notes = [...section.querySelectorAll<HTMLElement>('.note')].map(el => ({
    el, key: el.dataset.key!, start: startOf(el, WRITE), k: 1, shown: -1,
  }));
  // Joined to the instruments, the guitar's row lands as the notes that start the melody, left to right
  // (handoff.ts): step and key of each, the real guitar's the long note under the first three.
  const FLOWN = [[0, 72], [3, 67], [6, 75], [0, 63], [8, 74], [12, 67], [14, 68]] as const;
  const flown = FLOWN.map(([step, key]) => notes.find(note => Number(note.el.dataset.step) === step && Number(note.key) === key)!.el);
  const handoff = createHandoff(stage, fl, flown);
  let joined = 0; // the scroll the hand-off takes, px; 0 when this chapter stands alone
  let snap = true;
  let lit = 0; // lines of the words already lit when the chapter's own scroll begins
  const keys = [...section.querySelectorAll<HTMLElement>('.fl__keys [data-key]')]
    .map(el => ({ el, notes: notes.filter(note => note.key === el.dataset.key), down: false }))
    .filter(key => key.notes.length);
  const stems = [...section.querySelectorAll<HTMLElement>('.vel')].map(el => ({
    el, stem: el.querySelector<HTMLElement>('.vel__stem')!, head: el.querySelector<HTMLElement>('.vel__head')!,
    start: startOf(el, STEMS), height: 0, shown: -1,
  }));
  const motion = matchMedia('(prefers-reduced-motion: no-preference) and (min-height: 580px) and (forced-colors: none)');
  const progress = new Spring(0, { response: .19, damping: 1 }, .0002);
  let lines: LitLine[] = [];
  let lineDistance = 1;
  let nearby = false;
  let frame = 0;
  let lastFrame = 0;
  let travel = 0;
  let lead = 0;

  function measure() {
    joined = motion.matches ? handoffDistance(stage.offsetHeight) : 0;
    section!.toggleAttribute('data-joined', joined > 0);
    section!.style.setProperty('--studio-handoff', `${joined}px`);
    section!.style.setProperty('--studio-overlap', `${joined ? stage.offsetHeight + joined : 0}px`);
    // The pencil starts where the flown notes end: the rest of the two bars, over the same stretch of scroll.
    for (const note of notes) {
      const step = Number(note.el.dataset.step);
      note.start = joined ? WRITE.start + Math.max(0, step - 8) / 24 * WRITE.sweep : startOf(note.el, WRITE);
      note.shown = -1;
      if (joined && handoff.flown.has(note.el)) { note.k = 1; note.el.style.clipPath = ''; }
    }
    if (joined) handoff.measure();
    else handoff.clear();
    snap = true;
    if (motion.matches) {
      const filled = passages.map(measureTextFill);
      lines = filled.flat();
      // Joined, the playhead lights the title as it passes it; the scroll then fills the story.
      lit = joined ? filled[0]!.length : 0;
      lineDistance = measureFillLine(stage);
      section!.style.setProperty('--studio-fill-travel', `${(lines.length - lit + FILL_HOLD) * lineDistance}px`);
    } else {
      passages.forEach(clearTextFill);
      lines = [];
      lit = 0;
      section!.style.removeProperty('--studio-fill-travel');
    }
    travel = section!.offsetHeight - stage.offsetHeight;
    placeAfter();
    lead = Math.min(innerHeight * .66, stage.offsetHeight * .66);
    for (const stem of stems) {
      stem.height = stem.el.offsetHeight;
      stem.shown = -1;
    }
  }

  // Where the window rests in its screen, from layout (the arrival's and the hand-off's transforms left out).
  function placeAfter() {
    if (!after) return;
    let x = 0;
    let y = 0;
    for (let el: HTMLElement | null = fl; el && el !== stage; el = el.offsetParent as HTMLElement | null) {
      x += el.offsetLeft;
      y += el.offsetTop;
    }
    const set = (name: string, px: number) => after.style.setProperty(name, `${px}px`);
    set('--studio-screen', stage.offsetHeight);
    set('--fl-x', x);
    set('--fl-y', y);
    set('--fl-w', fl.offsetWidth);
    set('--fl-h', fl.offsetHeight);
    after.toggleAttribute('data-placed', true);
  }

  // Joined, the screen is held from the hand-off's first frame: progress runs over the hand-off and then the chapter.
  function readProgress() {
    if (joined) return clamp(-section!.getBoundingClientRect().top / Math.max(1, travel), 0, 1);
    return clamp((lead - section!.getBoundingClientRect().top) / Math.max(1, lead + travel), 0, 1);
  }

  function paint(progress: number, dt = 0) {
    let p = progress;
    let moving = false;
    if (joined) {
      // The playhead's pass first; then the chapter as it is told alone, from the moment its screen was held.
      const scrolled = progress * travel;
      const t = scrolled / joined;
      moving = handoff.paint(t, dt, snap, Math.max(0, section!.getBoundingClientRect().top));
      p = (lead + scrolled - joined) / Math.max(1, lead + travel - joined);
      fl.style.opacity = fl.style.transform = '';
    } else {
      // The window arrives as a thing: a little smaller and lower, growing into its place as it fades in.
      const here = ease((p - ARRIVE.start) / ARRIVE.each);
      fl.style.opacity = String(here);
      fl.style.transform = here >= 1 ? '' : `translate3d(0,${((1 - here) * 28).toFixed(2)}px,0) scale(${(.955 + .045 * here).toFixed(4)})`;
    }
    snap = false;
    // The roll starts arriving on approach. The text starts filling when the stage pins.
    const pinnedScroll = p * (lead + travel - joined) - lead;
    paintTextFill(lines, lit + Math.max(0, pinnedScroll / lineDistance));
    // Each note is drawn from its left edge, like dragging the pencil out to its length.
    for (const note of notes) {
      if (joined && handoff.flown.has(note.el)) continue; // the hand-off's
      const k = note.k = Math.round(ease((p - note.start) / WRITE.each) * 1000) / 1000;
      if (k === note.shown) continue;
      note.shown = k;
      note.el.style.clipPath = k >= 1 ? '' : `inset(-2px ${((1 - k) * 100).toFixed(1)}% -2px -2px)`;
      note.el.style.visibility = k > 0 ? '' : 'hidden';
    }
    // While a note is being drawn its key is held down, as the piano roll previews it.
    for (const key of keys) {
      const down = key.notes.some(note => note.k > 0 && note.k < 1);
      if (down !== key.down) key.el.classList.toggle('is-down', key.down = down);
    }
    // Then each note's velocity rises from the floor of the editor, in the order the notes were written.
    for (const stem of stems) {
      const k = Math.round(ease((p - stem.start) / STEMS.each) * 1000) / 1000;
      if (k === stem.shown) continue;
      stem.shown = k;
      stem.el.style.opacity = k > 0 ? '' : '0';
      stem.stem.style.transform = k >= 1 ? '' : `scaleY(${k})`;
      stem.head.style.transform = k >= 1 ? '' : `translate3d(0,${((1 - k) * stem.height).toFixed(2)}px,0)`;
    }
    return moving;
  }

  function tick(now: number) {
    frame = 0;
    const dt = lastFrame ? Math.min(.05, (now - lastFrame) / 1000) : 1 / 60;
    lastFrame = now;
    // Not before the instruments have come to rest on their last frame: the row is handed over standing still.
    const bridge = joined ? lineupBridge.current : null;
    const target = readProgress();
    const waiting = !!bridge?.near() && !bridge.settled() && target * travel < joined;
    progress.to(waiting ? 0 : target);
    const settled = progress.step(dt);
    const moving = paint(progress.value, dt);
    if (!settled || moving || waiting) frame = requestAnimationFrame(tick);
    else lastFrame = 0;
  }

  function scroll() {
    if (motion.matches && nearby && !frame) frame = requestAnimationFrame(tick);
  }

  function reset() {
    cancelAnimationFrame(frame);
    frame = lastFrame = 0;
    section!.toggleAttribute('data-held', motion.matches);
    measure();
    progress.set(motion.matches ? readProgress() : 1);
    paint(progress.value);
  }

  // Coming near, the chapter only finds its place in the scroll again. Nothing is measured: its sizes change
  // with the stage (the observer below), the fonts and the join, and each of those measures. Measuring here
  // laid the whole Playlist out again (a 35 ms task on a laptop) in the middle of the instruments' slide,
  // which is what is on screen when this chapter comes within reach.
  function arrive() {
    cancelAnimationFrame(frame);
    frame = lastFrame = 0;
    snap = true;
    progress.set(readProgress());
    paint(progress.value);
  }

  const visibility = new IntersectionObserver(([entry]) => {
    nearby = !!entry?.isIntersecting;
    if (nearby && motion.matches) arrive();
  }, { rootMargin: '30% 0px' });
  const resize = new ResizeObserver(reset);
  visibility.observe(section);
  resize.observe(stage);
  reset();
  void document.fonts.ready.then(() => { if (!signal.aborted) reset(); });
  // A direct link lands before the record shelf and instruments measure their
  // scroll distances. Realign once their first layout and font pass are done.
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (location.hash === '#fl-studio' && navigation?.type !== 'back_forward') {
    let moved = false;
    const keepPosition = () => { moved = true; };
    for (const event of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
      window.addEventListener(event, keepPosition, { once: true, passive: true, signal });
    }
    const land = async () => {
      await document.fonts.ready;
      requestAnimationFrame(() => {
        if (!moved && !signal.aborted && location.hash === '#fl-studio') {
          // Joined to the instruments, the chapter's own first frame is where the hand-off ends.
          window.scrollTo({ top: scrollY + section.getBoundingClientRect().top + (joined && joined + 1), behavior: 'instant' });
        }
      });
    };
    if (document.readyState === 'complete') void land();
    else window.addEventListener('load', land, { once: true, signal });
  }
  window.addEventListener('scroll', scroll, { passive: true, signal });
  motion.addEventListener('change', reset, { signal });
  onJoinChange(reset, signal);
  signal.addEventListener('abort', () => {
    visibility.disconnect();
    resize.disconnect();
    cancelAnimationFrame(frame);
    handoff.clear();
    passages.forEach(clearTextFill);
  }, { once: true });
});
