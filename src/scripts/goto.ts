/**
 * In-page navigation (the island's links, the hero's pills): the page travels to the target instead of
 * teleporting. The browser animates the trip at the display's rate. On touch screens, approach a distant
 * target first so the final glide covers at most a screen and a half. Reduced motion jumps directly.
 *
 * The home page calls initGoto each time it is shown (scripts/page.ts); its listeners go with the page.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const touch = matchMedia('(hover: none) and (pointer: coarse)');

let trip: AbortController | undefined;
function stop() {
  if (!trip) return;
  trip.abort();
  trip = undefined;
  scrollTo({ top: scrollY, behavior: 'instant' });
}

function settle(target: HTMLElement, hash: string) {
  // The entry carries the router's state (the page it is on, where it was scrolled), so Back from
  // another page finds its way here; Back within the page is scripts/page.ts.
  if (hash === '#top') {
    if (location.hash) history.pushState(history.state, '', location.pathname + location.search);
  } else if (location.hash !== hash) {
    history.pushState(history.state, '', hash);
  }
  // Keyboard users continue from where they landed.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/**
 * Asked for from the island or a pill, a part of the page plays its one-time animations again, even if
 * they have already played: everything from the target up to the next separation page hears a 'replay'
 * event, resets, and plays again when it is next on screen (scripts/scroll.ts, scripts/contact.ts,
 * NotesPipeline.astro).
 */
export type Replay = CustomEvent<{ has: (el: Element) => boolean }>;
const after = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
function replay(target: HTMLElement) {
  const next = [...document.querySelectorAll('[data-divider]')].find((d) => after(target, d) && !target.contains(d));
  const has = (el: Element) => (target.contains(el) || after(target, el)) && (!next || after(el, next));
  document.dispatchEvent(new CustomEvent('replay', { detail: { has } }) satisfies Replay);
}

export function goTo(hash: string) {
  const target = document.querySelector<HTMLElement>(hash);
  if (!target) return false;
  if (hash !== '#top') replay(target);
  stop();
  const start = scrollY;
  const max = document.scrollingElement!.scrollHeight - innerHeight;
  const end = Math.min(max, Math.max(0, target.getBoundingClientRect().top + start));
  const distance = Math.abs(end - start);
  if (reduce.matches || distance < 2) {
    scrollTo({ top: end, behavior: 'instant' });
    settle(target, hash);
    return true;
  }
  if (touch.matches) {
    const reach = innerHeight * 1.5;
    if (distance > reach) scrollTo({ top: end - Math.sign(end - start) * reach, behavior: 'instant' });
    scrollTo({ top: end, behavior: 'smooth' });
    settle(target, hash);
    return true;
  }
  // Commit focus and history only when a desktop trip arrives. User input can interrupt it.
  trip = new AbortController();
  const finish = () => {
    if (Math.abs(scrollY - end) > 1) return;
    trip?.abort();
    trip = undefined;
    settle(target, hash);
  };
  addEventListener('scroll', finish, { passive: true, signal: trip.signal });
  scrollTo({ top: end, behavior: 'smooth' });
  finish();
  return true;
}

export function initGoto(signal: AbortSignal) {
  // The reader taking the wheel, a finger or a key ends the trip at once.
  addEventListener('wheel', stop, { passive: true, signal });
  addEventListener('touchstart', stop, { passive: true, signal });
  addEventListener('pointerdown', stop, { passive: true, signal });
  addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) stop(); }, { signal });
  signal.addEventListener('abort', stop);

  // Every in-page link on the page, including those added later. Heard on the way down, before the
  // client router (which hears clicks on the way up) takes the link for a jump of its own.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    if (goTo(a.getAttribute('href')!)) e.preventDefault();
  }, { capture: true, signal });
}
