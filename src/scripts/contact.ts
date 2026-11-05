/**
 * The contact section: an iMessage exchange that plays once, and a greeting that says hi in one language
 * after another.
 *
 * The exchange: the thread is armed on load (its pieces hidden), plays the first time it is mostly on
 * screen (the typing bubble, the message growing out of it, the reply sent, "Delivered"), and then the
 * classes come off, so the end state is exactly the state without this script. Someone tabbing to the
 * reply never waits for it.
 *
 * The greeting: "Say" stays, and the word after it changes, hi, hola, bonjour…, the way iOS changes a
 * number in place: the old letters lift and blur away, the new ones rise into place one after another,
 * and the line glides to its new centre when the new word is a different width (measured, then played
 * back as a transform, so the layout changes once and the motion is all on the compositor). It runs while
 * the section is on screen, rests under the pointer or keyboard focus and while the tab is hidden, and
 * never moves with reduced motion.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
// A spring sampled into a linear() easing: damping ratio 0.9, response 0.5s, so it settles without a
// visible bounce (nothing was flung). Browsers without linear() get the site's strong ease-out.
const SPRING_MS = 455;
const SPRING = CSS.supports('animation-timing-function', 'linear(0, 1)')
  ? 'linear(0.0, 0.014 3.1%, 0.052 6.2%, 0.104 9.4%, 0.167 12.5%, 0.235 15.6%, 0.305 18.8%, 0.375 21.9%, 0.443 25.0%, 0.507 28.1%, 0.567 31.2%, 0.622 34.4%, 0.673 37.5%, 0.718 40.6%, 0.759 43.8%, 0.795 46.9%, 0.826 50.0%, 0.854 53.1%, 0.878 56.2%, 0.899 59.4%, 0.917 62.5%, 0.932 65.6%, 0.945 68.8%, 0.956 71.9%, 0.965 75.0%, 0.972 78.1%, 0.978 81.2%, 0.983 84.4%, 0.988 87.5%, 0.991 90.6%, 0.994 93.8%, 0.996 96.9%, 1)'
  : 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

export function initContact(section: HTMLElement) {
  const thread = section.querySelector<HTMLElement>('[data-thread]');
  const reply = section.querySelector<HTMLElement>('[data-reply]');
  const receipt = section.querySelector<HTMLElement>('[data-receipt]');
  if (thread && reply && receipt && 'IntersectionObserver' in window) {
    const finish = () => { io.disconnect(); section.classList.remove('is-armed', 'is-playing'); };
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      section.classList.add('is-playing');
    }, { threshold: 0.6 });
    section.classList.add('is-armed');
    io.observe(thread);
    receipt.addEventListener('animationend', finish, { once: true });
    reply.addEventListener('focus', finish, { once: true });
  }

  const greet = section.querySelector<HTMLElement>('[data-greet]');
  if (!greet) return;
  const words = [...greet.querySelectorAll<HTMLElement>('[data-word]')];
  // Each glyph in its own box, split by grapheme so an accent stays on its letter.
  const seg = 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  for (const w of words) {
    const text = w.textContent ?? '';
    const glyphs = seg ? [...seg.segment(text)].map((g) => g.segment) : Array.from(text);
    w.replaceChildren(...glyphs.map((g) => Object.assign(document.createElement('span'), { textContent: g })));
  }
  const HOLD = 2400;
  let current = 0;
  let timer = 0;
  let inView = false;
  let resting = false;

  const settle = (w: HTMLElement) => {
    w.classList.remove('is-leaving');
    w.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  };

  const show = (n: number, animate: boolean) => {
    const next = n % words.length;
    if (next === current) return;
    const old = words[current]!;
    const neu = words[next]!;
    if (!animate) {
      greet.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      words.forEach((w) => w.classList.remove('is-on', 'is-leaving'));
      neu.classList.add('is-on');
      current = next;
      return;
    }
    // Where the line is now, mid-glide included; then the new word takes the old one's place in it.
    const first = greet.getBoundingClientRect().left;
    greet.getAnimations().forEach((a) => a.cancel());
    words.forEach((w) => { if (w.classList.contains('is-leaving')) settle(w); });
    old.classList.remove('is-on');
    old.classList.add('is-leaving');
    neu.classList.add('is-on');
    current = next;
    const dx = first - greet.getBoundingClientRect().left;
    if (Math.abs(dx) > 0.5) {
      greet.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: SPRING_MS, easing: SPRING });
    }
    // Out: the old letters lift and blur away, quickly, first letter first.
    const outs = [...old.children] as HTMLElement[];
    let left = outs.length;
    outs.forEach((g, i) => {
      g.animate(
        [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-0.3em)', filter: 'blur(5px)' }],
        { duration: 220, delay: i * 12, easing: 'ease', fill: 'forwards' },
      ).onfinish = () => { if (--left === 0 && !old.classList.contains('is-on')) settle(old); };
    });
    // In: the new letters rise into place one after another, sharpening as they come.
    ([...neu.children] as HTMLElement[]).forEach((g, i) => {
      const delay = 60 + i * 26;
      g.animate([{ transform: 'translateY(0.35em)' }, { transform: 'none' }], { duration: SPRING_MS, delay, easing: SPRING, fill: 'backwards' });
      g.animate([{ opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 300, delay, easing: EASE_OUT, fill: 'backwards' });
    });
  };

  const schedule = () => {
    clearTimeout(timer);
    if (!inView || resting || document.hidden || reduce.matches) return;
    timer = window.setTimeout(() => { show(current + 1, true); schedule(); }, HOLD);
  };

  new IntersectionObserver(([entry]) => {
    inView = !!entry?.isIntersecting;
    if (!inView) show(0, false); // every arrival starts from "hi"
    schedule();
  }).observe(section);
  greet.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { resting = true; schedule(); } });
  greet.addEventListener('pointerleave', () => { resting = false; schedule(); });
  section.addEventListener('focusin', () => { resting = true; schedule(); });
  section.addEventListener('focusout', (e) => { if (!section.contains(e.relatedTarget as Node | null)) { resting = false; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  reduce.addEventListener('change', () => { if (reduce.matches) show(0, false); schedule(); });
}
