/**
 * The contact section: an iMessage exchange that plays once, and a greeting that says hi in one language
 * after another.
 *
 * The exchange: the thread is armed on load (its pieces hidden), plays the first time it is mostly on
 * screen (the typing bubble, the message growing out of it, the reply sent, "Delivered"), and then the
 * classes come off, so the end state is exactly the state without this script. Someone tabbing to the
 * reply never waits for it.
 *
 * The greeting: "Say hi." cross-fades to hola, bonjour, ciao… while the section is on screen, the way the
 * Mac's setup screen does; it rests while the pointer is on it or focus is in the section, stops while the
 * tab is hidden, and never moves with reduced motion.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

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
  const HOLD = 2200;
  let current = 0;
  let timer = 0;
  let inView = false;
  let resting = false;

  const show = (n: number) => {
    words[current]!.classList.remove('is-on');
    current = n % words.length;
    words[current]!.classList.add('is-on');
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!inView || resting || document.hidden || reduce.matches) return;
    timer = window.setTimeout(() => { show(current + 1); schedule(); }, HOLD);
  };

  new IntersectionObserver(([entry]) => {
    inView = !!entry?.isIntersecting;
    if (!inView) show(0); // every arrival starts from "hi"
    schedule();
  }).observe(section);
  greet.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { resting = true; schedule(); } });
  greet.addEventListener('pointerleave', () => { resting = false; schedule(); });
  section.addEventListener('focusin', () => { resting = true; schedule(); });
  section.addEventListener('focusout', (e) => { if (!section.contains(e.relatedTarget as Node | null)) { resting = false; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  reduce.addEventListener('change', () => { if (reduce.matches) show(0); schedule(); });
}
