/**
 * In-page navigation (the island's links, the hero's pills): the page travels to the target instead of
 * teleporting, so the reader keeps their place in it. One easing from the site's tokens, the strong
 * ease-in-out for things that move on screen; the duration grows with the distance so a short hop is
 * quick and a long one never drags. The reader owns the scroll: a wheel, a touch or a key stops the
 * trip where it is. Under reduced motion the jump is instant. The browser's own smooth scrolling stays
 * on for everything else.
 *
 * On a touch screen the page scrolls on a thread of its own, at the display's rate; a script that moves
 * it frame by frame lands a frame behind and stutters, and a long trip outruns the painting of the page.
 * There the browser's own smooth scroll makes the trip, and never more than a screen and a half of it:
 * a farther target is first approached by a jump, so the reader still sees the page travel into place
 * without flashing through every section on the way.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const touch = matchMedia('(hover: none) and (pointer: coarse)');

// cubic-bezier(0.77, 0, 0.175, 1), solved for x → y as the browser does it.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
  const b = (a1: number, a2: number) => 3 * a2 - 6 * a1;
  const c = (a1: number) => 3 * a1;
  const calc = (t: number, a1: number, a2: number) => ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t;
  const slope = (t: number, a1: number, a2: number) => 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2);
      if (s === 0) break;
      t -= (calc(t, x1, x2) - x) / s;
    }
    return calc(t, y1, y2);
  };
}
const easeInOut = bezier(0.77, 0, 0.175, 1);

let frame = 0;
const stop = () => { if (frame) { cancelAnimationFrame(frame); frame = 0; } };
// The reader taking the wheel, a finger or a key ends the trip at once.
addEventListener('wheel', stop, { passive: true });
addEventListener('touchstart', stop, { passive: true });
addEventListener('pointerdown', stop, { passive: true });
addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) stop(); });

function settle(target: HTMLElement, hash: string) {
  frame = 0;
  if (location.hash !== hash) history.pushState(null, '', hash);
  // Keyboard users continue from where they landed.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

export function goTo(hash: string) {
  const target = document.querySelector<HTMLElement>(hash);
  if (!target) return false;
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
  // 450ms for a hop, up to 900ms across the whole page.
  const duration = Math.min(900, 450 + distance * 0.05);
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / duration);
    scrollTo({ top: start + (end - start) * easeInOut(p), behavior: 'instant' });
    if (p < 1) frame = requestAnimationFrame(step);
    else settle(target, hash);
  };
  frame = requestAnimationFrame(step);
  return true;
}

// Every in-page link on the page, including those added later.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a || a.getAttribute('href') === '#') return;
  if (goTo(a.getAttribute('href')!)) e.preventDefault();
});
