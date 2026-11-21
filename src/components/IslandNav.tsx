import { useCallback, useEffect, useRef, useState } from 'react';

import { useIslandNudge } from '@/components/IslandNudge';
import { warm } from '@/scripts/warm';
import { defaultClock, IslandView, islandMetrics, type IslandMetricsOverrides, type IslandMotionOverrides, type IslandPresentation } from '@/lib/island';

/**
 * The navigation as the island, drawn by the islandcn engine (src/lib/island), paired with a
 * detached music bubble that leads straight to /music.
 *
 * At rest it is the pill with the music bubble beside it (IslandNudge.tsx). Hovering (fine
 * pointers), tapping (touch) or focusing the pill opens the navigation links; hovering or pressing
 * the music bubble leaves the menu closed and navigates straight to the music page.
 */
const links = [
  { href: '#top', label: 'Home' },
  { href: '#projects', label: 'Projects' },
  { href: '#studies', label: 'Studies' },
  { href: '#how-i-work', label: 'How I work' },
  { href: '#contact', label: 'Contact' },
] as const;

/**
 * Hover intent, for fine pointers: the pointer has to rest on the pill a moment before it opens,
 * so a mouse crossing the top of the page on its way to the tab bar or the music bubble doesn't
 * set it off, and it can slip off the edge for a moment without the island closing.
 */
const hoverOpenDelay = 70;
const hoverCloseDelay = 180;

/**
 * Desktop clamps the expanded card to 452 pt (just above Pro Max width) so all five links sit on
 * one airy row without crowding the continuous corners; smaller viewports use their own width and
 * wrap cleanly onto two balanced rows. The keyline stays on dark pages even at idle so the pill
 * never melts into black.
 */
const metrics = {
  screen: { width: 452 },
  expanded: { minHeight: 72, maxHeight: 200, rowGap: 0 },
  keyline: { idle: 1 },
} as const satisfies IslandMetricsOverrides;

/**
 * The open and the close, tuned on islandcn's iOS-fitted springs so each reads as one motion on a
 * phone: critically damped collapse without overshoot or tail lean, damped expand, no blur skirts,
 * and steady keyline strength through collapse.
 */
const motion = {
  viaIdle: { collapse: 0 },
  shape: { pressExpand: { dampingFraction: 0.86 }, expand: { dampingFraction: 0.86 }, collapse: { response: 0.4, dampingFraction: 0.9 }, split: { response: 0.42, dampingFraction: 1 } },
  body: { pressExpand: { dampingFraction: 0.86 }, expand: { dampingFraction: 0.86 }, collapse: { response: 0.38, dampingFraction: 0.92 }, split: { response: 0.42, dampingFraction: 1 } },
  corner: { collapse: { response: 0.38, dampingFraction: 0.92, delay: 0 } },
  tail: { collapse: { width: { lean: { by: 0 }, settle: { at: 0 } }, height: { lean: { by: 0 }, settle: { at: 0 } }, top: { settle: { at: 0 } } } },
  contentTiming: {
    pressExpand: { exit: { response: 0.2 }, exitFade: 0.7 },
    expand: { exit: { response: 0.2 }, exitFade: 0.7 },
    collapse: { exit: { response: 0.3 }, exitFade: 0.6, enter: { response: 0.36, delay: 0.06 } },
  },
  blurSkirt: { max: 0 },
  keyline: { dip: 1 },
} as const satisfies IslandMotionOverrides;

/**
 * When the menu opens while the music bubble is out, a brief join pulls the bubble back into the
 * pill just ahead of expansion (the note leaves 23 ms before it).
 */
const joinSoon = 50;
/**
 * After a close, how long the island heads for the bare pill before the music bubble buds off it
 * again, so the bubble emerges from the capsule end rather than the shrinking card's taller corner.
 */
const budAfterClose = 330;

/** The page colour just below the island, so the engine's keyline knows how dark it is. */
const backdropUnder = (y: number): string | undefined => {
  const x = Math.round(innerWidth / 2);
  for (const el of document.elementsFromPoint(x, Math.min(innerHeight - 1, y))) {
    if (el.closest('[data-island-nav]')) continue;
    const colour = getComputedStyle(el).backgroundColor;
    const parts = colour.match(/\d+(\.\d+)?/g);
    if (!parts || (parts.length > 3 && Number(parts[3]) === 0)) continue;
    return colour;
  }
  return undefined;
};

const luma = (colour: string | undefined) => {
  const [r, g, b] = (colour?.match(/\d+(\.\d+)?/g) ?? ['255', '255', '255']).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Where the music page lives. */
const musicPage = '/music';

const normalizePath = (p: string) => p.replace(/\/+$/, '') || '/';

export const IslandNav = ({ home = '', current = '/' }: {
  /** Prefix for the section links: "" on the home page, "/" anywhere else. Defaults to "". */
  home?: string;
  /** Current page pathname, used for aria-current on the music bubble. */
  current?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [bubblePressed, setBubblePressed] = useState(false);
  const [backdrop, setBackdrop] = useState<string | undefined>(undefined);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const fine = useRef(false);

  useEffect(() => {
    const media = matchMedia('(hover: hover) and (pointer: fine)');
    fine.current = media.matches;
    const onChange = () => { fine.current = media.matches; };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // What is under the island: as the page scrolls, and once more when it settles.
  useEffect(() => {
    const below = islandMetrics.idle.height + 14 + 6;
    let ticking = false;
    let settle: number | undefined;
    // Nothing found is no reading: while a view transition runs, its layer takes every hit and only
    // the transparent <html> comes back, which would clear the keyline on dark pages.
    const read = () => {
      const colour = backdropUnder(below);
      if (colour) setBackdrop(colour);
    };
    // Reading it is a hit test of the whole page, and a page that animates with the scroll has just changed its
    // styles when it runs: on the music page it was the largest cost of every scrolled frame. Ten readings a
    // second while the page moves follow the ground closely enough, and one more is taken when it stops.
    let readAt = 0;
    const sense = () => {
      clearTimeout(settle);
      settle = window.setTimeout(read, 120);
      if (ticking || performance.now() - readAt < 100) return;
      ticking = true;
      requestAnimationFrame(() => { readAt = performance.now(); read(); ticking = false; });
    };
    read();
    addEventListener('scroll', sense, { passive: true });
    addEventListener('resize', sense);
    // The island persists across page changes (Island.astro); a new page is new ground, readable
    // once its view transition settles (scripts/page.ts).
    let gone = false;
    const swapped = () => {
      void import('@/scripts/page').then(({ arrived }) => arrived()).then(() => { if (!gone) sense(); });
    };
    document.addEventListener('astro:after-swap', swapped);
    return () => {
      gone = true;
      clearTimeout(settle);
      removeEventListener('scroll', sense);
      removeEventListener('resize', sense);
      document.removeEventListener('astro:after-swap', swapped);
    };
  }, []);

  // The bubble (IslandNudge.tsx): whether it is out and the brief join before the menu expands.
  const bubbleOut = useRef(false);
  const openNow = useRef(open);
  openNow.current = open;
  const [joining, setJoining] = useState<number | null>(null);
  const joinCancel = useRef<(() => void) | null>(null);
  const clearJoin = useCallback(() => {
    joinCancel.current?.();
    joinCancel.current = null;
    setJoining(null);
  }, []);

  const [budAgain, setBudAgain] = useState(false);
  const budCancel = useRef<(() => void) | null>(null);
  useEffect(() => () => budCancel.current?.(), []);

  // Every open and close goes through here, so a pending hover change never overrides a click,
  // a key or a link.
  const hoverTimer = useRef<number | undefined>(undefined);
  const setNow = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    clearTimeout(hoverTimer.current);
    const want = typeof next === 'function' ? next(openNow.current) : next;
    if (!want) {
      clearJoin();
      if (openNow.current) {
        // Close to idle in this same render. Showing the split for even one frame
        // would send the bubble out and then immediately pull it back in.
        budCancel.current?.();
        setBudAgain(true);
        const clock = defaultClock();
        budCancel.current = clock.at(clock.now() + budAfterClose, () => {
          budCancel.current = null;
          setBudAgain(false);
        });
      }
      setOpen(false);
      return;
    }
    if (openNow.current || joinCancel.current) return;
    setBubblePressed(false);
    if (!bubbleOut.current) {
      setOpen(true);
      return;
    }
    // Pull the music bubble into the pill before expanding the navigation links.
    const clock = defaultClock();
    const at = clock.now() + joinSoon;
    setJoining(at);
    joinCancel.current = clock.at(at, () => {
      joinCancel.current = null;
      setJoining(null);
      setOpen(true);
    });
  }, [clearJoin]);

  const setSoon = (next: boolean, ms: number) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setNow(next), ms);
  };
  useEffect(() => () => { clearTimeout(hoverTimer.current); joinCancel.current?.(); }, []);

  // A press outside, Escape, or focus moving elsewhere closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      setNow(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const inside = root.current?.contains(document.activeElement) ?? false;
      setNow(false);
      if (inside) trigger.current?.blur();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, setNow]);

  const close = useCallback(() => setNow(false), [setNow]);

  // A press inside the island, under way or just over (prevents Safari's null-relatedTarget blur
  // from closing the island mid-tap).
  const pressInside = useRef({ down: false, liftedAt: Number.NEGATIVE_INFINITY });
  useEffect(() => {
    const lift = () => {
      if (pressInside.current.down) pressInside.current = { down: false, liftedAt: performance.now() };
    };
    addEventListener('pointerup', lift, true);
    addEventListener('pointercancel', lift, true);
    return () => {
      removeEventListener('pointerup', lift, true);
      removeEventListener('pointercancel', lift, true);
    };
  }, []);

  // When a touch on the trigger closed the island (its click is then spent).
  const pressClosed = useRef<number | null>(null);

  const nudge = useIslandNudge();
  const bubble = budAgain ? null : nudge;
  const bubbleVisible = !open && bubble !== null;
  bubbleOut.current = bubbleVisible;

  const onMusicPage = normalizePath(current) === musicPage;

  const presentation: IslandPresentation = open
    ? {
        kind: 'expanded',
        bottom: (
          <nav className="island-nav__links" aria-label="Primary">
            {links.map((l) => (
              <a
                key={l.label}
                className="island-nav__link"
                href={l.href === '#top' ? (home || '#top') : `${home}${l.href}`}
                onClick={close}
              >
                {l.label}
              </a>
            ))}
          </nav>
        ),
      }
    : bubble ?? { kind: 'idle' };

  const dark = luma(backdrop) < 80;

  return (
    <div
      ref={root}
      className="island-nav"
      data-island-nav=""
      data-open={open || undefined}
      data-dark={dark || undefined}
      data-nudge={bubbleVisible ? '' : undefined}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse' && fine.current && openNow.current) clearTimeout(hoverTimer.current);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && fine.current) setSoon(false, hoverCloseDelay);
      }}
      onPointerDownCapture={() => { pressInside.current.down = true; }}
      onBlur={(e) => {
        if (root.current?.contains(e.relatedTarget as Node | null)) return;
        // On a phone the blur comes with the click, a moment after the finger lifts.
        if (e.relatedTarget === null && (pressInside.current.down || performance.now() - pressInside.current.liftedAt < 400)) return;
        setNow(false);
      }}
    >
      <button
        ref={trigger}
        className="island-nav__hit"
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse' && fine.current) setSoon(true, hoverOpenDelay);
        }}
        onPointerLeave={(e) => {
          setPressed(false);
          if (e.pointerType === 'mouse' && fine.current && !openNow.current) {
            clearTimeout(hoverTimer.current);
            if (!e.currentTarget.matches(':focus-visible')) clearJoin();
          }
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          // Open, a touch on it closes it as it lands, rather than swelling the card first.
          if (open) { pressClosed.current = e.timeStamp; setNow(false); return; }
          setPressed(true);
        }}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onClick={(e) => {
          const spent = pressClosed.current;
          pressClosed.current = null;
          if (spent !== null && e.timeStamp - spent < 1000) return;
          // A mouse that hovers has already opened it; a click then keeps it open.
          if (e.detail > 0 && fine.current) { setNow(true); return; }
          setNow((v) => !v);
        }}
        onFocus={(e) => { if (e.target.matches(':focus-visible')) setNow(true); }}
      />
      {/* After the button, so Tab goes from it into the links. */}
      <IslandView
        presentation={presentation}
        placement="viewport"
        label="Navigation and music"
        pressTarget={bubblePressed ? 'bubble' : pressed ? 'pill' : null}
        pressStyle={bubblePressed ? 'swell' : 'squish'}
        joining={joining}
        backdrop={backdrop}
        metrics={metrics}
        motion={motion}
      />
      {nudge !== null && (
        <a
          className="island-nav__music"
          href={musicPage}
          aria-label="Music"
          aria-current={onMusicPage ? 'page' : undefined}
          onPointerEnter={() => {
            clearTimeout(hoverTimer.current);
            clearJoin();
            warm(musicPage);
          }}
          onPointerLeave={() => {
            setBubblePressed(false);
          }}
          onPointerDown={() => {
            clearTimeout(hoverTimer.current);
            clearJoin();
            warm(musicPage);
            setBubblePressed(true);
          }}
          onPointerUp={() => setBubblePressed(false)}
          onPointerCancel={() => setBubblePressed(false)}
          onFocus={() => {
            warm(musicPage);
            if (openNow.current) setNow(false);
          }}
          onClick={(e) => {
            clearJoin();
            setBubblePressed(false);
            if (normalizePath(location.pathname) === musicPage) {
              e.preventDefault();
              scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />
      )}
    </div>
  );
};

export default IslandNav;
