/**
 * The hero's greeting, written the way a Mac says hello the first time it starts: Apple's lettering drawn as
 * two pen strokes, then the name and the rest of the hero arrive. Paths use pathLength="1", so CSS can hide
 * them before this runs; each stroke's delay and duration come from src/data/hello.ts.
 */
const START = 350; // ms, let the page settle first
const PEN_EASE = 'cubic-bezier(0.42, 0, 0.58, 1)'; // ease-in-out, as in the original effect
const ARRIVE_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

export function playHello(svg: SVGSVGElement, after: HTMLElement[]) {
  const paths = [...svg.querySelectorAll<SVGPathElement>('path')];
  // The script owns these from here: drop the CSS failsafe.
  [...paths, ...after].forEach((el) => { el.style.animation = 'none'; });

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    paths.forEach((p) => { p.style.strokeDashoffset = '0'; });
    after.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease', fill: 'both' }));
    return;
  }

  let end = 0;
  paths.forEach((path) => {
    const delay = START + Number(path.dataset.delay) * 1000;
    const duration = Number(path.dataset.duration) * 1000;
    path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration, delay, easing: PEN_EASE, fill: 'both' });
    // The pen's round cap would show as a dot before the stroke starts moving; fade it in with the line.
    path.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(duration / 2, 700), delay, easing: 'ease', fill: 'both' });
    end = Math.max(end, delay + duration);
  });

  // Name first, as the pen lifts off the "o", then the lede and the buttons: each materialises from a blur.
  after.forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(1rem)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
    { duration: 900, delay: end - 300 + i * 120, easing: ARRIVE_EASE, fill: 'both' },
  ));
}
