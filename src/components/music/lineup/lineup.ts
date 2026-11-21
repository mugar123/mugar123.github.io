import { onPage } from '@/scripts/page';
import { FILL_HOLD, clearTextFill, measureFillLine, measureTextFill, paintTextFill, type LitLine } from '../v4/text-fill';
import type { Instrument, SurroundPose } from './instrument';
import { createTurntable } from './turntable';
import { createCopyLayer } from './copy-layer';
import { createOutlineLayer, type TurningCopy } from './outline-layer';
import { Spring, VelocityTracker } from '../v4/physics';
import { handoffDistance, lineupBridge, onJoinChange, type LineupBridge, type LineupPiece } from '../fl-studio/handoff';

/* The instruments on the music page (LineupStory.astro). The heading and both instruments share a
   pinned stage. The timeline is measured in the scroll a line takes to fill (text-fill.ts):

     title fills ─ title parts ─ bass rises ─ bass fans out ─ hold ─ the slide from the bass to the guitar ─ guitar holds its angle

   Every frame is a function of where the scroll is (smoothed, so a wheel's steps glide), so scrolling back
   plays it all backwards exactly. Motion, by Emil Kowalski's rules:

   - The bass arrives as a hand of cards fanned out: its copies come out one at a time, nearest first,
     each from behind the one before it and carried out by it, easing gently into and out of its travel, the next starting
     while the last is still moving (a stagger). The bass starts face-on and turns as its copies fan out.
   - The slide: the guitar's line-up waits to the right of the bass's, and between the blue bass and the
     green guitar stand STEPS more copies, each a step further from the bass and nearer the guitar, in
     outline and in colour: a flip book laid out along the row. The screen travels the row, eased in and
     out (smoothstep, the page's curve for scrubbed motion). Each text stays above its own instrument
     as the row passes the edges of the stage. The in-between copies fan out behind the blue bass in order.
   - The instruments have weight. Whatever moves them across the screen (a card slid out in the deal, the
     row sliding along), they lean back against the motion, the more the faster it goes, and when it slows
     they swing past upright, rock and settle, each at its own pace (a spring each, Apple's damping ratio
     and response, a little different from one to the next). The bass turns on its axis with it.
     It is driven by how things actually move, not by where the scroll is, so it is never quite the same
     twice; scrolling back sways them the other way.

   The in-between outlines: both outlines sampled into the same number of points, matched part to part
   (body, waist, neck, head), and moved between; the colours through OKLab, so blue reaches green through
   clean teal, never grey.

   Once a scene's instrument has settled, its instrument is the hand's (Apple, Designing
   Fluid Interfaces): a sideways drag turns it 1:1, even mid-spin; on release the velocity goes to a
   spring that rests where the velocity projects it, a whole number of turns from its pose. */

const DECELERATION = 0.998; // Apple's normal scroll deceleration, for projecting a flick
const THREE_QUARTER_YAW = -50; // degrees from face-on
const FRAME_WIDTH = 1.1; // matches instrument.ts: the frame's width in instrument lengths
const BODY = .27; // a body's width, in frame widths (the outlines in silhouettes.ts)
const BASS_ENTRANCE = 2.4; // lines of scroll for the title to part and the bass to rise
const HOLD = .8; // lines of scroll the lit bass waits before the move
const MOVE = 3.6; // lines of scroll the slide takes
const STEPS = 5; // copies between the blue bass and the green guitar
const VIEW = 1600; // the outlines' frame, silhouettes.ts
// The outlines as the instrument turns (scripts/instrument-outlines.mjs): every TURN_STEP degrees about its
// long axis, POINTS points each, matched part to part, Uint16 coordinates times 16.
const TURN_STEP = 10, POINTS = 720, UNITS = 16;
const FOLLOW_TURN = [.1, .16, .22]; // s: how closely the copies follow the real one's turn, nearest first

const clamp = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) ** 4; // close to the site's --ease-out, cubic-bezier(.23, 1, .32, 1)
const project = (velocity: number) => (velocity / 1000) * DECELERATION / (1 - DECELERATION);
const wrap = (angle: number) => ((angle % 360) + 360) % 360;

// ── Colour, through OKLab ────────────────────────────────────────────────────────────────────────────
type Lab = [number, number, number];
function toLab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
function fromLab([L, A, B]: Lab) {
  const l = (L + .3963377774 * A + .2158037573 * B) ** 3;
  const m = (L - .1055613458 * A - .0638541728 * B) ** 3;
  const s = (L - .0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
  const channel = (c: number) => Math.round(255 * clamp(c <= .0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - .055));
  return '#' + rgb.map(c => channel(c).toString(16).padStart(2, '0')).join('');
}

// ── Outlines as the instrument turns ─────────────────────────────────────────────────────────────────
// The outline at `yaw` degrees, between the two nearest that were drawn, into `out`.
function shapeAt(data: Uint16Array, yaw: number, out: Float32Array, stride: number) {
  const at = wrap(yaw) / TURN_STEP;
  const count = data.length / (POINTS * 2);
  const a = Math.floor(at) % count, b = (a + 1) % count, t = at - Math.floor(at);
  const start = a * POINTS * 2, end = b * POINTS * 2;
  let written = 0;
  for (let i = 0; i < POINTS * 2; i += stride * 2) {
    out[written++] = (data[start + i]! * (1 - t) + data[end + i]! * t) / UNITS;
    out[written++] = (data[start + i + 1]! * (1 - t) + data[end + i + 1]! * t) / UNITS;
  }
  return out.subarray(0, written);
}
function pathOf(points: Float32Array) {
  let d = '';
  for (let i = 0; i < points.length; i += 2) d += `${i ? 'L' : 'M'}${points[i]!.toFixed(1)} ${points[i + 1]!.toFixed(1)}`;
  return `${d}Z`;
}

interface Slot { x: number; y: number; size: number }

onPage(signal => {
  const root = document.querySelector<HTMLElement>('[data-lu]');
  if (!root) return;
  const allowed = matchMedia('(prefers-reduced-motion: no-preference) and (min-height: 500px) and (min-width: 320px) and (forced-colors: none)');
  const narrow = matchMedia('(max-width: 760px)');
  const mobileView = matchMedia('(max-width: 760px), (pointer: coarse)');

  const show = root.querySelector<HTMLElement>('[data-lu-show]')!;
  const stage = show.querySelector<HTMLElement>('[data-lu-stage]')!;

  const heading = stage.querySelector<HTMLElement>('.lu__heading')!;
  const headingRows = [...heading.querySelectorAll<HTMLElement>('.lu__heading-line')];
  const [upper, lower] = headingRows as [HTMLElement, HTMLElement];
  let headingFill: LitLine[] = [];
  let introEnd = BASS_ENTRANCE;

  const scenes = [...show.querySelectorAll<HTMLElement>('[data-lu-scene]')].map(element => ({
    element,
    cam: element.querySelector<HTMLElement>('[data-lu-cam]')!,
    words: element.querySelector<HTMLElement>('[data-lu-words]')!,
    captions: [...element.querySelectorAll<HTMLElement>('[data-fill-text]')],
    lines: [] as LitLine[],
    canvas: element.querySelector('canvas')!,
    still: element.querySelector('img')!,
    grab: element.querySelector<HTMLElement>('[data-lu-grab]')!,
    model: element.dataset.model!,
    paint: element.dataset.paint ?? '',
    copies: [...element.querySelectorAll<SVGSVGElement>('[data-lu-copy]')].map(svg => ({
      svg,
      colour: svg.style.getPropertyValue('--c').trim(),
      side: Number(svg.dataset.side),
      rank: Number(svg.dataset.rank),
      slot: { x: 0, y: 0, size: 1 } as Slot,
    })),
    lights: [...element.querySelectorAll<SVGSVGElement>('[data-lu-copy]')].map((): SurroundPose => ({ x: 0, exposure: 0, lean: 0, yaw: 0 })),
    instrument: null as Instrument | null,
    modelShown: false,
    loading: false,
    centre: { x: 0, y: 0, size: 1 } as Slot,
    standing: false,
    // The turn by hand, in degrees on top of the scroll's: where it is, how fast, where it's going.
    angle: 0, velocity: 0, rest: 0,
    yaw: 0, // degrees: where the real one is turned, all told
    spring: null as null | { damping: number; response: number },
    pointer: new VelocityTracker(),
    drag: null as null | { id: number; x: number; y: number; from: number; decided: boolean; lastSample: number; interval: number },
    perPixel: .5,
  }));
  type Scene = typeof scenes[number];
  const [bass, guitar] = scenes as [Scene, Scene];
  // The in-between copies, blue bass to green guitar, made once: outline and colour a step further each.
  const blue = bass.copies.find(copy => copy.side === 1 && copy.rank === 3)!;
  const green = guitar.copies.find(copy => copy.side === -1 && copy.rank === 3)!;
  for (const scene of scenes) {
    const front = scene.element.dataset.outline!;
    for (const copy of scene.copies) copy.svg.querySelector('path')!.setAttribute('d', front);
  }
  const steps = (() => {
    const blueLab = toLab(blue.svg.style.getPropertyValue('--c').trim());
    const greenLab = toLab(green.svg.style.getPropertyValue('--c').trim());
    return Array.from({ length: STEPS }, (_, index) => {
      const t = (index + 1) / (STEPS + 1);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${VIEW} ${VIEW}`);
      svg.setAttribute('class', 'lu__copy lu__step');
      const source = t < .5 ? blue : green;
      const path = source.svg.querySelector('path')!.cloneNode(false) as SVGPathElement;
      path.setAttribute('fill', fromLab(blueLab.map((value, i) => value + (greenLab[i]! - value) * t) as Lab));
      svg.append(path);
      bass.cam.append(svg);
      return { svg, path, t, side: 1, rank: blue.rank + index + 1, turn: { yaw: NaN, speed: 0, response: .22 + .02 * index, drawn: NaN } };
    });
  })();
  // Every copy follows its instrument's turn: a critically damped spring each (Apple's default when nothing
  // was thrown), the nearest the closest behind, so a turn spreads outward from the real one.
  type Follower = { yaw: number; speed: number; response: number; drawn: number };
  const following = new Map<SVGSVGElement, Follower & { path: SVGPathElement }>();
  for (const scene of scenes) for (const copy of scene.copies) {
    following.set(copy.svg, { yaw: NaN, speed: 0, response: FOLLOW_TURN[copy.rank - 1]!, drawn: NaN, path: copy.svg.querySelector('path')! });
  }
  const outlines = new Map<Scene, Uint16Array>();
  const scratch = [new Float32Array(POINTS * 2), new Float32Array(POINTS * 2)] as const;
  let stripTimer = 0;
  function scheduleSlideStrip() {
    if (stripTimer || stopped) return;
    stripTimer = requestAnimationFrame(() => {
      stripTimer = 0;
      if (stopped) return;
      prepareSlideStrip();
      if (near) request();
    });
  }
  async function loadOutlines(scene: Scene) {
    if (outlines.has(scene)) return;
    outlines.set(scene, new Uint16Array(0));
    try {
      const response = await fetch(scene.model.replace(/\.glb$/, '.outlines.bin'), { signal });
      if (!response.ok) return;
      const data = await response.arrayBuffer();
      if (stopped || data.byteLength !== (360 / TURN_STEP) * POINTS * 2 * Uint16Array.BYTES_PER_ELEMENT) return;
      outlines.set(scene, new Uint16Array(data));
      if (ready(bass) && ready(guitar)) {
        configureCopyLayer();
        resizeCopyLayer();
        // Rasterize the cached slide strip on the next frame so WebGL setup and 2D path
        // filling never combine into a single long main-thread task.
        scheduleSlideStrip();
      }
      invalidateOutlines();
      if (near) request();
    } catch {
      outlines.delete(scene);
    }
  }
  const ready = (scene: Scene) => (outlines.get(scene)?.length ?? 0) > 0;
  // A follower one frame on, towards `target`; true while it still moves.
  function follow(follower: Follower, target: number, dt: number, snap: boolean) {
    if (snap || Number.isNaN(follower.yaw)) { follower.yaw = target; follower.speed = 0; return false; }
    if (follower.yaw === target && follower.speed === 0) return false;
    // Exact critically damped response for this frame's duration, including on high-refresh screens.
    const omega = 2 * Math.PI / follower.response;
    const offset = follower.yaw - target;
    const slope = follower.speed + omega * offset;
    const decay = Math.exp(-omega * dt);
    follower.yaw = target + (offset + slope * dt) * decay;
    follower.speed = (follower.speed - omega * slope * dt) * decay;
    if (Math.abs(follower.yaw - target) < .12 && Math.abs(follower.speed) < 1.5) { follower.yaw = target; follower.speed = 0; return false; }
    return true;
  }
  // How far the guitar's line-up waits to the right: its green copy STEPS + 1 steps after the blue bass.
  let reach = 0;
  let spacing = 0;
  let bridgeSpacing = 0;

  let line = 1;
  let enabled = false;
  let near = false;
  let stopped = false;
  // The timeline, in lines of scroll from where the screen is first held.
  const span = { entrance: BASS_ENTRANCE, bass: 1, moveAt: 1, move: MOVE, end: 1 };
  let shown = -1; // where the screen is on the timeline, following the scroll
  let pinStart = 0;
  const scrollPosition = new Spring(0, { response: .21, damping: 1 }, .0002);

  async function liveInstrument(scene: Scene) {
    const { createInstrument } = await import('./instrument');
    return createInstrument(
      scene.canvas,
      (narrow.matches && scene.element.dataset.mobileModel) || scene.model,
      scene.paint,
      scene.copies.map(({ colour, side, rank }) => ({ colour, side, rank })),
      narrow.matches,
    );
  }

  async function load(scene: Scene) {
    if (scene.loading) return;
    scene.loading = true;
    try {
      const folder = scene.model.replace(/\.glb$/, '');
      const initialYaw = scene === bass ? 0 : THREE_QUARTER_YAW;
      const instrument = mobileView.matches
        ? await createTurntable(scene.canvas, folder, initialYaw, scene.centre.size, request, scene === bass).catch(() => liveInstrument(scene))
        : await liveInstrument(scene);
      if (stopped) return instrument.dispose();
      scene.instrument = instrument;
      instrument.resize(scene.centre.size, narrow.matches);
      if (mobileView.matches && scene === bass && shown <= introEnd) {
        scene.instrument.pose(0, scene.lights, 1);
        scene.modelShown = true;
        scene.cam.classList.add('has-model');
      }
      if (near) request();
      // A live model does its first picture's one-off work now, in the gaps between frames, so it is ready
      // before it shows: the bass as the page opens, the guitar while the bass's chapter scrolls (a piece in
      // the first idle moment after a frame, and within 80 ms regardless, to be done before the slide).
      // Safari is the exception for the guitar. Whenever its textures were sent ahead of its first picture
      // (as the page opened, or during the scroll), Safari later stood still for 600 ms at a time, in the slide
      // and twice in the hand-off, painting FL Studio's Playlist again; so there the guitar is made half way
      // through the bass's chapter and left to its first picture, as it always was. Safari has no idle
      // callback, which is how it is told apart: no idle time, no warming of what is made during a scroll.
      const idleTime = 'requestIdleCallback' in window;
      if (scene === bass || idleTime) {
        await instrument.warm?.(Math.min(devicePixelRatio || 1, 3), () => new Promise(done => {
          requestAnimationFrame(() => {
            if (idleTime) window.requestIdleCallback(() => done(), { timeout: 80 });
            else setTimeout(done, 0);
          });
        }));
      }
    } catch {
      // Keep the still if both renderers fail. Retrying on each scroll frame stalls the entrance.
    }
  }

  // Keep the composited SVG layers close to the artwork as the mobile lineup grows.
  function placeCopy(svg: SVGSVGElement, { x, y, size }: Slot) {
    const fraction = narrow.matches ? .4 : 1;
    const width = size * fraction;
    svg.setAttribute('viewBox', `${VIEW * (1 - fraction) / 2} 0 ${VIEW * fraction} ${VIEW}`);
    svg.style.width = `${width.toFixed(1)}px`;
    svg.style.height = `${size.toFixed(1)}px`;
    svg.style.left = `${(x - width / 2).toFixed(1)}px`;
    svg.style.top = `${(y - size / 2).toFixed(1)}px`;
  }

  // A scene's line-up on this screen: the instrument in the middle of the space under the words, all seven
  // the same height, a body's width and a little air apart (overlapping like a hand of cards on a phone),
  // as large as the space and the screen's width allow. Both scenes are one row (the slide runs along it),
  // so both take the space under the taller of the two blocks of words: same size, same level.
  function layoutLineup(baseWordsBottom: number) {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (narrow.matches) {
      const gapMin = Math.min(28, Math.max(16, height * .028));
      const bottomPad = parseFloat(getComputedStyle(stage).paddingBottom) || gapMin;
      const maxBand = Math.max(80, height - bottomPad - (baseWordsBottom + gapMin));
      // Cap instrument size to the viewport width so tall phones don't crush the rainbow fan.
      const frame = Math.min(maxBand * FRAME_WIDTH, width * 1.18);
      const length = frame / FRAME_WIDTH;
      // Share spare height on tall screens across the whole composition so the caption stays connected.
      const spare = Math.max(0, maxBand - length);
      const wordsShift = Math.min(spare * .42, 56);
      const gap = gapMin + Math.min(spare * .16, 20);
      show.style.setProperty('--words-shift', `${wordsShift.toFixed(1)}px`);
      const y = baseWordsBottom + wordsShift + gap + length / 2;
      const edgePad = Math.max(6, width * .018);
      const naturalSpacing = BODY * frame * .92;
      // At the fanned 50° pose, the widest outline (the guitar) extends .115 frame widths from centre.
      const fanSpacing = Math.max(0, Math.min(naturalSpacing, (width / 2 - edgePad - frame * .115) / blue.rank));
      return { width, frame, length, y, fanSpacing };
    }
    show.style.removeProperty('--words-shift');
    const top = baseWordsBottom + 22;
    const bottom = height - 84;
    const band = Math.max(80, bottom - top);
    const air = 1.14;
    const halfRow = BODY * (air * (blue.rank + 1) + .5);
    const frame = Math.min(band * FRAME_WIDTH, (width / 2 - 8) / halfRow);
    const length = frame / FRAME_WIDTH;
    const y = top + band / 2;
    return { width, frame, length, y, fanSpacing: BODY * frame * air };
  }

  function place(scene: Scene, metrics: ReturnType<typeof layoutLineup>) {
    const { width, frame, length, y, fanSpacing } = metrics;
    scene.centre = { x: width / 2, y, size: frame };
    for (const copy of scene.copies) {
      copy.slot = { x: width / 2 + copy.side * fanSpacing * copy.rank, y, size: frame };
      placeCopy(copy.svg, copy.slot);
    }
    scene.cam.style.setProperty('--frame-size', `${frame}px`);
    scene.cam.style.setProperty('--frame-top', `${(y - frame / 2).toFixed(1)}px`);
    const grab = scene.grab.style;
    const gw = narrow.matches ? Math.min(width * .72, frame * .58) : frame * .42;
    const gh = length * 1.02;
    grab.width = `${gw.toFixed(1)}px`; grab.height = `${gh.toFixed(1)}px`;
    grab.left = `${(width / 2 - gw / 2).toFixed(1)}px`; grab.top = `${(y - gh / 2).toFixed(1)}px`;
    scene.perPixel = 360 / Math.max(420, frame * .8);
    scene.instrument?.resize(frame, narrow.matches);
  }

  const writtenStyles = new WeakMap<HTMLElement | SVGElement, Record<string, string>>();
  function writeStyle(el: HTMLElement | SVGElement, prop: 'transform' | 'opacity' | 'visibility', value: string) {
    let entry = writtenStyles.get(el);
    if (!entry) {
      entry = {};
      writtenStyles.set(el, entry);
    }
    if (entry[prop] === value) return;
    entry[prop] = value;
    el.style[prop] = value;
  }

  function invalidateOutlines() {
    for (const follower of following.values()) follower.drawn = NaN;
    for (const item of steps) item.turn.drawn = NaN;
  }

  function locatePin() {
    if (enabled) pinStart = show.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(stage).top) || 0);
  }

  let lastDealProgress = -1;
  function measure() {
    // The outline sampling density can change when crossing the mobile breakpoint.
    invalidateOutlines();
    lastDealProgress = -1;
    line = measureFillLine(root!);
    // Match climb.ts's smoothing window on touch screens so iOS's 60/120 Hz scroll-event beat doesn't judder.
    scrollPosition.response = mobileView.matches ? .2 : .21;
    scrollPosition.precision = mobileView.matches ? .0004 : .0002;
    enabled = allowed.matches;
    configureCopyLayer();
    show.classList.toggle('statement', enabled);
    show.classList.toggle('is-scrubbed', enabled);
    if (!enabled) {
      prepareSlideStrip();
      headingRows.forEach(clearTextFill);
      for (const scene of scenes) scene.captions.forEach(clearTextFill);
      show.style.removeProperty('height');
      show.style.removeProperty('--words-shift');
      for (const el of [upper, lower, heading, bass.words]) {
        writtenStyles.delete(el);
        el.style.transform = el.style.opacity = '';
      }
      for (const scene of scenes) { stand(scene, false); reset(scene); }
      return;
    }
    headingFill = headingRows.flatMap(measureTextFill);
    for (const scene of scenes) {
      scene.lines = scene.captions.flatMap(measureTextFill);
      paintTextFill(scene.lines, 0);
    }
    // Measure captions at their CSS baseline before applying any tall-phone vertical centring shift.
    show.style.removeProperty('--words-shift');
    const wordsBottom = Math.max(...scenes.map(({ words }) => words.offsetTop + words.offsetHeight));
    const metrics = layoutLineup(wordsBottom);
    for (const scene of scenes) place(scene, metrics);
    resizeCopyLayer();
    bass.cam.style.transformOrigin = `${bass.centre.x}px ${bass.centre.y}px`;
    if (narrow.matches) {
      // Keep the mobile story unhurried (~4.8 screens total) without letting extra text wrapping bloat it.
      span.entrance = 1.9;
      introEnd = headingFill.length + span.entrance;
      span.bass = 4.2;
      span.moveAt = introEnd + span.bass + .75;
      span.move = 3.0;
      span.end = span.moveAt + span.move + 1.8;
    } else {
      span.entrance = BASS_ENTRANCE;
      introEnd = headingFill.length + span.entrance;
      // Allow the stagger to overlap while keeping the final guitar caption on screen.
      const guitarHold = guitar.lines.length / 2;
      span.bass = .9 * (bass.lines.length + guitarHold);
      span.moveAt = introEnd + span.bass + HOLD;
      span.move = MOVE;
      span.end = span.moveAt + span.move + guitarHold + FILL_HOLD;
    }
    // Where FL Studio follows, the screen stays held while the row is handed over to it (fl-studio/handoff.ts).
    show.style.height = `${(stage.offsetHeight + span.end * line + handoffDistance(stage.offsetHeight)).toFixed(1)}px`;
    // Every piece of the row leans on its foot.
    for (const element of [...pieces, bass.still, guitar.still]) element.style.transformOrigin = `50% ${(50 + 50 / 1.1).toFixed(2)}%`;
    still();
    spacing = (blue.slot.x - bass.centre.x) / blue.rank;
    // The two captions still need a viewport between them when the fans overlap tightly.
    const fanWidth = blue.slot.x - green.slot.x;
    bridgeSpacing = narrow.matches ? Math.max(spacing, (stage.clientWidth - fanWidth) / (STEPS + 1)) : spacing;
    reach = fanWidth + (STEPS + 1) * bridgeSpacing;
    steps.forEach(({ svg }, index) => {
      placeCopy(svg, { ...blue.slot, x: blue.slot.x + (index + 1) * bridgeSpacing });
      svg.style.zIndex = String(-2 - index); // further right, further under, as the copies at the right are
    });
    prepareSlideStrip();
    locatePin();
    shown = -1;
    if (!near) {
      paintIntro(0);
      writeStyle(bass.element, 'transform', 'translate3d(0.00px,0,0)');
      writeStyle(guitar.element, 'transform', `translate3d(${reach.toFixed(2)}px,0,0)`);
      writeStyle(guitar.element, 'visibility', narrow.matches ? '' : 'hidden');
    }
    if (near) request();
  }
  function reset(scene: Scene) {
    for (const el of [scene.still, scene.cam, scene.element, scene.canvas, ...scene.copies.map(c => c.svg), ...steps.map(s => s.svg)]) {
      writtenStyles.delete(el);
    }
    scene.still.style.transform = '';
    scene.cam.style.transform = scene.cam.style.opacity = '';
    scene.element.style.visibility = scene.element.style.clipPath = scene.element.style.transform = '';
    for (const copy of scene.copies) { copy.svg.style.transform = copy.svg.style.opacity = ''; copy.svg.style.visibility = ''; }
    scene.canvas.style.transform = scene.canvas.style.opacity = scene.canvas.style.visibility = '';
  }

  // The hand of cards: on each side, copy by copy from the nearest, each slides one step out from behind
  // the one before it, which carries it along: a copy's place is the sum of its own step and those of the
  // copies nearer the middle. Each starts while the one before is still moving.
  function stepOut(progress: number, rank: number) {
    const duration = .4;
    const start = (rank - 1) * (1 - duration) / (blue.rank + STEPS - 1);
    return smooth(clamp((progress - start) / duration));
  }
  // Each card carries its neighbours. Compute the stagger once per frame for the SVGs, springs and lights.
  const reveals = new Float64Array(blue.rank + STEPS + 1);
  const offsets = new Float64Array(reveals.length);
  function updateDeal(progress: number) {
    if (progress === lastDealProgress) return;
    lastDealProgress = progress;
    for (let rank = 1; rank < reveals.length; rank++) {
      const reveal = stepOut(progress, rank);
      reveals[rank] = reveal;
      offsets[rank] = offsets[rank - 1]! + (reveal - 1) * (rank <= blue.rank ? spacing : bridgeSpacing);
    }
  }
  function dealt(copy: { rank: number; side: number }) {
    return copy.side * offsets[copy.rank]!;
  }
  function bassOpacity(rank: number) {
    const first = reveals[1]!;
    return smooth(clamp(rank === 1 ? first * 4 : (first - .18) / .18));
  }
  function deal(scene: Scene) {
    for (const copy of scene.copies) {
      writeStyle(copy.svg, 'transform', `translate3d(${dealt(copy).toFixed(2)}px,0,0)${leaning(copy.svg)}`);
      writeStyle(copy.svg, 'opacity', bassOpacity(copy.rank).toFixed(3));
    }
  }

  function stand(scene: Scene, standing: boolean) {
    if (standing === scene.standing) return;
    scene.standing = standing;
    scene.element.classList.toggle('is-standing', standing);
    scene.grab.tabIndex = standing ? 0 : -1;
    if (!standing) {
      scene.drag = null;
      scene.element.classList.remove('is-turning');
      if (scene.angle !== 0) aim(scene, Math.round(scene.angle / 360) * 360, 1, .35);
    }
  }
  function aim(scene: Scene, rest: number, damping: number, response: number) {
    scene.rest = rest;
    scene.spring = { damping, response };
    request();
  }
  function stepSpring(scene: Scene, dt: number) {
    const spring = scene.spring;
    if (!spring) return false;
    const stiffness = (2 * Math.PI / spring.response) ** 2;
    const friction = 4 * Math.PI * spring.damping / spring.response;
    for (let left = dt; left > 0; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      scene.velocity += (-stiffness * (scene.angle - scene.rest) - friction * scene.velocity) * h;
      scene.angle += scene.velocity * h;
    }
    if (Math.abs(scene.angle - scene.rest) < .05 && Math.abs(scene.velocity) < 2) {
      scene.spring = null;
      scene.velocity = 0;
      const before = scene.angle;
      scene.angle = wrap(scene.rest) < .001 || wrap(scene.rest) > 359.999 ? 0 : scene.rest;
      scene.rest = scene.angle;
      // A whole turn dropped: the copies following it drop the same, so none unwinds.
      const dropped = scene.angle - before;
      if (dropped) for (const copy of scene.copies) following.get(copy.svg)!.yaw += dropped;
    }
    return true;
  }
  function turn(scene: Scene, baseYaw: number) {
    const yaw = baseYaw + scene.angle;
    const previous = Math.round(wrap(scene.yaw)) % 360;
    scene.yaw = yaw;
    const angle = Math.round(wrap(yaw)) % 360;
    if (angle === previous) return;
    scene.grab.setAttribute('aria-valuenow', String(angle));
    const side = angle === 0 ? 'Facing forward' : `${angle} degrees`;
    scene.grab.setAttribute('aria-valuetext', side);
  }
  // Drive each instrument's coloured surround lights from the live position, reveal, sway and turn of its copies.
  function renderInstrument(scene: Scene, pixelRatio: number) {
    if (!scene.instrument || !scene.centre.size) return;
    const scale = FRAME_WIDTH / scene.centre.size;
    const baseLean = lean.get(scene.canvas) ?? 0;
    const dealtScene = scene === bass;
    for (let i = 0; i < scene.copies.length; i++) {
      const copy = scene.copies[i]!;
      const offset = dealtScene ? dealt(copy) : 0;
      const step = dealtScene ? reveals[copy.rank]! : 1;
      const out = scene.lights[i]!;
      out.x = (copy.slot.x + offset - scene.centre.x) * scale;
      out.exposure = dealtScene
        ? (copy.rank === 1 ? smooth(clamp(step * 2.5)) : smooth(step))
        : 1;
      out.lean = usingStrip ? 0 : (lean.get(copy.svg) ?? 0) - baseLean;
      const follower = following.get(copy.svg)!;
      out.yaw = Number.isNaN(follower.yaw) ? scene.yaw : follower.yaw;
    }
    scene.instrument.pose(scene.yaw, scene.lights, pixelRatio);
    // (Once: adding a class that is there already still writes the attribute, every frame.)
    if (!scene.modelShown) {
      scene.modelShown = true;
      scene.cam.classList.add('has-model');
    }
  }

  // The rack. Every instrument on the row (the copies, the in-between ones, the two real ones) has weight:
  // a spring for how far it leans on its foot (degrees, clockwise: its head to the right), pulled towards
  // a lean set by how fast it is moving across the screen, against the motion. Cards slid out in the deal
  // lean as they go and rock to rest; the row's slide sways them all. Speed is measured in screen widths a
  // second, so it feels the same on any screen; a phone's tighter row leans less, so heads don't touch.
  // Each piece answers with its own weight (Apple's response and damping ratio, a little different from
  // one to the next): underdamped, so the swing shows, but damped enough to come to rest in a beat or two.
  const RACK = { perSpeed: 10.5, most: 10, mostNarrow: 5.5, smoothing: .06, yaw: 3.2 };
  type Piece = { element: SVGSVGElement | HTMLCanvasElement; at: () => number; lean: number; speed: number; x: number; moving: number; response: number; damping: number };
  const rowX = () => -reach * smooth(clamp((shown - span.moveAt) / span.move)); // the bass's row; the guitar's moves with it
  const bassAt = () => clamp((shown - introEnd) / span.bass);
  const sources: [Piece['element'], () => number][] = [
    ...[...bass.copies, ...steps].map(copy => [copy.svg, () => rowX() + dealt(copy)] as [Piece['element'], () => number]),
    ...guitar.copies.map(copy => [copy.svg, rowX] as [Piece['element'], () => number]),
    [bass.canvas, rowX], [guitar.canvas, rowX],
  ];
  const rack: Piece[] = sources.map(([element, at], index) => {
    const hash = (seed: number) => { const x = Math.sin((index + 1) * seed) * 43758.5453; return x - Math.floor(x); };
    return { element, at, lean: 0, speed: 0, x: NaN, moving: 0, response: .5 + .28 * hash(12.9898), damping: .38 + .12 * hash(78.233) };
  });
  const pieces = rack.map(piece => piece.element);
  const lean = new Map<Element, number>();
  function still() { for (const piece of rack) { piece.x = NaN; piece.moving = 0; } }
  function sway(dt: number) {
    const width = bass.centre.x * 2 || 1;
    const most = narrow.matches ? RACK.mostNarrow : RACK.most;
    const stepDt = Math.max(1 / 120, dt);
    const smoothing = 1 - Math.exp(-stepDt / RACK.smoothing);
    let moving = false;
    for (const piece of rack) {
      const x = piece.at();
      const speed = Number.isNaN(piece.x) ? 0 : (x - piece.x) / stepDt;
      piece.x = x;
      if (!speed && !piece.moving && !piece.speed && !piece.lean) continue;
      piece.moving += (speed - piece.moving) * smoothing;
      if (Math.abs(piece.moving) < .5) piece.moving = 0;
      else moving = true;
      const goal = Math.max(-most, Math.min(most, -piece.moving / width * RACK.perSpeed));
      const stiffness = (2 * Math.PI / piece.response) ** 2;
      const friction = 4 * Math.PI * piece.damping / piece.response;
      for (let left = dt; left > 0; left -= 1 / 240) {
        const h = Math.min(left, 1 / 240);
        piece.speed += (-stiffness * (piece.lean - goal) - friction * piece.speed) * h;
        piece.lean += piece.speed * h;
      }
      if (Math.abs(piece.lean - goal) < .01 && Math.abs(piece.speed) < .05) { piece.lean = goal; piece.speed = 0; }
      else moving = true;
      lean.set(piece.element, piece.lean);
    }
    return moving;
  }
  const leaning = (element: Element) => {
    const degrees = lean.get(element) ?? 0;
    return Math.abs(degrees) < .001 ? '' : ` rotate(${degrees.toFixed(3)}deg)`;
  };

  // Back to front, in the same stacking order as the desktop SVGs.
  const flatCopies: (TurningCopy & { restX(): number })[] = [...steps].reverse().map(item => {
    const restX = () => blue.slot.x + (item.rank - blue.rank) * bridgeSpacing;
    return {
      svg: item.svg, yaw: () => item.turn.yaw, guitarShare: item.t, colour: item.path.getAttribute('fill')!,
      restX, x: () => rowX() + restX() + dealt(item),
      opacity: () => smooth(clamp(reveals[item.rank]! * 4)),
      lean: () => lean.get(item.svg) ?? 0,
    };
  });
  for (const scene of scenes) {
    for (const copy of [...scene.copies].sort((a, b) => b.rank - a.rank)) {
      const restX = () => copy.slot.x + (scene === bass ? 0 : reach);
      flatCopies.push({
        svg: copy.svg, colour: copy.colour, yaw: () => following.get(copy.svg)!.yaw, guitarShare: Number(scene === guitar),
        restX, x: () => rowX() + restX() + (scene === bass ? dealt(copy) : 0),
        opacity: () => scene === guitar ? Number(shown > span.moveAt && !(handed >> handing.get(copy.svg)! & 1)) : bassOpacity(copy.rank),
        lean: () => lean.get(copy.svg) ?? 0,
      });
    }
  }
  // The hand-off to FL Studio (fl-studio/handoff.ts). While it plays the guitar is not the hand's (`busy`). The row
  // stays ours to draw, bar a copy the hand-off has in the air while its place is uncovered (`handed`, a bit each
  // in the row's order); covered by FL Studio, nothing here is drawn at all.
  let busy = false;
  let handed = 0;
  let covered = false;
  const handing = new Map<SVGSVGElement, number>();
  let copyLayer: ReturnType<typeof createCopyLayer> = null;

  let outlineLayer: ReturnType<typeof createOutlineLayer> = null;
  let gpuUnavailable = false;
  let slideStrip: HTMLCanvasElement | null = null;
  let usingStrip = false;

  function syncStripVisibility() {
    if (slideStrip) writeStyle(slideStrip, 'opacity', usingStrip ? '1' : '0');
    const surface = outlineLayer?.element ?? copyLayer?.element;
    if (surface) writeStyle(surface, 'opacity', usingStrip ? '0' : '1');
    else show.classList.toggle('has-slide-strip', usingStrip);
  }

  function showSlideStrip(active: boolean) {
    if (active === usingStrip) return;
    usingStrip = active;
    syncStripVisibility();
    if (!active) outlineLayer?.invalidate();
  }

  // Both ends of the fully opened row face the same angle. Where the outlines are filled on the main thread
  // (no GPU for the outline layer), paint the entire row, including the five intermediate shapes, ahead of
  // the slide: moving it then costs one transform. With the outline layer the row is never swapped for a
  // picture of itself. The picture's edges fell a fraction of a pixel from the live ones, so the whole row
  // twitched as the fan came to rest, and it leaned as one piece, where each instrument has a spring of its own.
  function prepareSlideStrip() {
    const { y, size } = bass.centre;
    const width = stage.clientWidth + reach;
    const density = Math.min(devicePixelRatio || 1, mobileView.matches ? 1.5 : 2);
    const ratio = Math.min(density, 4096 / width, 4096 / size);
    // Keep live vector edges on desktops whose complete row won't fit at native density.
    if (!enabled || outlineLayer || !ready(bass) || !ready(guitar) || (!mobileView.matches && ratio < density)) {
      showSlideStrip(false);
      slideStrip?.remove();
      slideStrip = null;
      return;
    }
    const canvas = slideStrip ?? document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(size * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${size}px`;
    canvas.style.top = `${y - size / 2}px`;
    canvas.style.transformOrigin = `0 ${size * (.5 + .5 / FRAME_WIDTH)}px`;
    const stride = mobileView.matches ? 2 : 1;
    const from = shapeAt(outlines.get(bass)!, THREE_QUARTER_YAW, scratch[0], stride);
    const to = shapeAt(outlines.get(guitar)!, THREE_QUARTER_YAW, scratch[1], stride);
    const shapes = new Map<number, Path2D>();
    for (const copy of flatCopies) {
      const share = copy.guitarShare;
      let path = shapes.get(share);
      if (!path) {
        path = new Path2D();
        for (let i = 0; i < from.length; i += 2) {
          const px = from[i]! + share * (to[i]! - from[i]!);
          const py = from[i + 1]! + share * (to[i + 1]! - from[i + 1]!);
          if (i === 0) path.moveTo(px, py);
          else path.lineTo(px, py);
        }
        path.closePath();
        shapes.set(share, path);
      }
      ctx.setTransform(size / VIEW * ratio, 0, 0, size / VIEW * ratio, (copy.restX() - size / 2) * ratio, 0);
      ctx.fillStyle = copy.colour;
      ctx.fill(path, 'evenodd');
    }
    if (!slideStrip) {
      canvas.className = 'lu__slide-strip';
      canvas.setAttribute('aria-hidden', 'true');
      stage.prepend(canvas);
      slideStrip = canvas;
    }
    syncStripVisibility();
  }

  function resizeCopyLayer() {
    const { y, size } = bass.centre;
    const ratio = Math.min(devicePixelRatio || 1, mobileView.matches ? 1.5 : 2);
    outlineLayer?.resize(stage.clientWidth, y, size, size * (.5 + .5 / FRAME_WIDTH), ratio);
    copyLayer?.resize(stage.clientWidth, stage.clientHeight);
  }
  function configureCopyLayer() {
    if (enabled && !outlineLayer && !gpuUnavailable && ready(bass) && ready(guitar)) {
      outlineLayer = createOutlineLayer(stage, flatCopies, outlines.get(bass)!, outlines.get(guitar)!,
        POINTS, VIEW * UNITS, () => {
          gpuUnavailable = true;
          outlineLayer?.dispose();
          outlineLayer = null;
          invalidateOutlines();
          configureCopyLayer();
          resizeCopyLayer();
          scheduleSlideStrip();
          request();
        });
      gpuUnavailable = !outlineLayer;
    }
    if (!enabled) {
      outlineLayer?.dispose();
      outlineLayer = null;
    }
    if (enabled && narrow.matches && !outlineLayer) copyLayer ??= createCopyLayer(stage, flatCopies, VIEW);
    else {
      copyLayer?.dispose();
      copyLayer = null;
    }
    show.classList.toggle('has-copy-layer', !!(copyLayer || outlineLayer));
    syncStripVisibility();
  }

  // Allow for the widest body and the head swinging sideways about the foot.
  function onScreen(x: number) {
    const margin = bass.centre.size * .32;
    return x >= -margin && x <= 2 * bass.centre.x + margin;
  }

  // The copies' outlines, turned as their instrument is (each through its follower), and the in-between
  // copies', bass to guitar at their step. A path is rewritten only when its turn has changed.
  function turnCopies(dt: number, snap: boolean) {
    const compact = narrow.matches;
    const stride = compact ? 4 : 1;
    const minTurn = copyLayer ? .12 : compact ? .6 : .05;
    const travel = rowX();
    let moving = false;
    for (const scene of scenes) {
      const data = outlines.get(scene);
      const paths = new Map<number, string>(); // Left and right copies at the same yaw share an outline.
      for (const copy of scene.copies) {
        const follower = following.get(copy.svg)!;
        if (follow(follower, scene.yaw, dt, snap)) moving = true;
        if (outlineLayer || !data?.length || Math.abs(follower.yaw - follower.drawn) < minTurn) continue;
        if (scene === bass && !bassOpacity(copy.rank)) continue;
        const offset = scene === bass ? dealt(copy) : reach;
        if (!onScreen(travel + copy.slot.x + offset)) continue;
        follower.drawn = follower.yaw;
        if (copyLayer) {
          copyLayer.outline(copy.svg, shapeAt(data, follower.yaw, scratch[0], stride));
          continue;
        }
        let path = paths.get(follower.yaw);
        if (path === undefined) {
          path = pathOf(shapeAt(data, follower.yaw, scratch[0], stride));
          paths.set(follower.yaw, path);
        }
        follower.path.setAttribute('d', path);
      }
    }
    if (!ready(bass) || !ready(guitar)) return moving;
    // Between the two real ones' turns, the short way round.
    const apart = ((guitar.yaw - bass.yaw) % 360 + 540) % 360 - 180;
    for (const item of steps) {
      let target = bass.yaw + apart * item.t;
      if (!Number.isNaN(item.turn.yaw)) target = item.turn.yaw + (((target - item.turn.yaw) % 360 + 540) % 360 - 180);
      if (follow(item.turn, target, dt, snap)) moving = true;
      if (outlineLayer || Math.abs(item.turn.yaw - item.turn.drawn) < minTurn) continue;
      if (reveals[item.rank] === 0 || !onScreen(travel + blue.slot.x + (item.rank - blue.rank) * bridgeSpacing + dealt(item))) continue;
      item.turn.drawn = item.turn.yaw;
      const from = shapeAt(outlines.get(bass)!, item.turn.yaw, scratch[0], stride);
      const to = shapeAt(outlines.get(guitar)!, item.turn.yaw, scratch[1], stride);
      for (let i = 0; i < from.length; i++) from[i] = from[i]! + (to[i]! - from[i]!) * item.t;
      if (copyLayer) copyLayer.outline(item.svg, from);
      else item.path.setAttribute('d', pathOf(from));
    }
    return moving;
  }

  // Two lines slip past each other while the bass rises through the space between them.
  // Use the same smoothed playhead for the lettering, instrument and caption on the way back.
  function paintIntro(at: number) {
    paintTextFill(headingFill, at);
    const t = clamp((at - headingFill.length) / span.entrance);
    const upperExit = smooth(clamp((t - .08) / .72));
    const lowerExit = smooth(clamp((t - .16) / .72));
    writeStyle(upper, 'transform', `translate3d(${(-75 * upperExit).toFixed(2)}%,0,0)`);
    writeStyle(lower, 'transform', `translate3d(${(75 * lowerExit).toFixed(2)}%,0,0)`);
    writeStyle(heading, 'opacity', (1 - smooth(clamp((t - .36) / .45))).toFixed(3));

    const rise = easeOut(clamp((t - .09) / .85));
    writeStyle(bass.cam, 'transform', rise === 1 ? '' : `translate3d(0,${((1 - rise) * 48).toFixed(2)}%,0) rotate(${((1 - rise) * -16).toFixed(2)}deg)`);
    writeStyle(bass.cam, 'opacity', smooth(clamp((t - .12) / .32)).toFixed(3));
    const caption = smooth(clamp((t - .48) / .42));
    writeStyle(bass.words, 'transform', caption === 1 ? '' : `translate3d(0,${(16 * (1 - caption)).toFixed(2)}px,0)`);
    writeStyle(bass.words, 'opacity', caption.toFixed(3));
  }

  function draw(at: number) {
    const move = clamp((at - span.moveAt) / span.move); // 0 to 1
    const bassProgress = bassAt();
    paintTextFill(bass.lines, bassProgress * bass.lines.length);
    const guitarAt = span.moveAt + span.move;
    const guitarProgress = clamp((at - guitarAt) / (span.end - guitarAt - FILL_HOLD));
    paintTextFill(guitar.lines, guitarProgress * guitar.lines.length);
    // The bass is dealt out and turned through its chapter; the guitar's line-up is whole from the move on.
    // Every piece of the row leans on its foot as the rack sways.
    if (!copyLayer && !outlineLayer) {
      deal(bass);
      for (const copy of guitar.copies) writeStyle(copy.svg, 'transform', leaning(copy.svg));
      for (const item of steps) {
        writeStyle(item.svg, 'transform', `translate3d(${dealt(item).toFixed(2)}px,0,0)${leaning(item.svg)}`);
        writeStyle(item.svg, 'opacity', smooth(clamp(reveals[item.rank]! * 4)).toFixed(3));
      }
    }
    for (const scene of scenes) {
      const tilt = leaning(scene.canvas);
      writeStyle(scene.canvas, 'transform', tilt);
      if (!scene.instrument) writeStyle(scene.still, 'transform', tilt);
    }
    // On narrow screens `reach >= stage.clientWidth`, so `guitar.element` is already clipped off-stage
    // at `move === 0`; keeping it visible avoids mid-scroll layer creation when the slide starts.
    writeStyle(guitar.element, 'visibility', !narrow.matches && move <= 0 ? 'hidden' : '');
    // The slide: the row travels left by the distance between the two line-ups.
    const e = smooth(move);
    writeStyle(bass.element, 'transform', `translate3d(${(-reach * e).toFixed(2)}px,0,0)`);
    writeStyle(guitar.element, 'transform', `translate3d(${(reach * (1 - e)).toFixed(2)}px,0,0)`);
    // The sway also turns the live model a little on its axis. The photographed one (phones) and the cached
    // slide hold the fan's angle: the photographs cover the scroll's arc, and the strip is painted at it.
    const bassSway = slideStrip || mobileView.matches ? 0 : (lean.get(bass.canvas) ?? 0) * RACK.yaw;
    turn(bass, (THREE_QUARTER_YAW + bassSway) * smooth(bassProgress));
    turn(guitar, THREE_QUARTER_YAW);

    // The hand: a scene's instrument is free when its turn is complete.
    stand(bass, bassProgress > .995 && move <= 0);
    stand(guitar, move === 1 && !busy);
  }

  // Use native detail while the phone keeps pace. Sustained late frames lower only the moving
  // render resolution. The final pose is always drawn at full detail before the loop sleeps.
  let motionPixelRatio = Math.min(devicePixelRatio || 1, 1.5);
  let frameBudget = 1000 / 60;
  let lateFrames = 0;
  let sampledFrames = 0;
  function renderPixelRatio(elapsed: number, moving: boolean) {
    const full = Math.min(devicePixelRatio || 1, 3);
    if (!narrow.matches) return full;
    if (!moving || elapsed === 0) {
      lateFrames = sampledFrames = 0;
      return moving ? motionPixelRatio : full;
    }
    if (elapsed >= 6) frameBudget = Math.min(frameBudget, Math.max(1000 / 120, elapsed));
    sampledFrames++;
    if (elapsed > frameBudget * 1.45) lateFrames++;
    if (lateFrames >= 3) {
      motionPixelRatio = Math.min(full, Math.max(1, motionPixelRatio - .5));
      lateFrames = sampledFrames = 0;
    } else if (sampledFrames >= 90) {
      if (!lateFrames) motionPixelRatio = Math.min(full, 2, motionPixelRatio + .5);
      lateFrames = sampledFrames = 0;
    }
    return motionPixelRatio;
  }

  // Resample the hand at display time. With fewer pointer events than refreshes, draw the
  // intermediate positions too. A paused finger lands on its last sample without extrapolation.
  function dragFrame(scene: Scene, now: number) {
    const drag = scene.drag;
    if (!drag?.decided) return false;
    const sampleTime = now - drag.interval;
    scene.angle = drag.from + (scene.pointer.at(sampleTime) - drag.x) * scene.perPixel;
    return sampleTime < drag.lastSample;
  }

  let queued = 0;
  let last = 0;
  let resting = false;
  function tick(now: number) {
    queued = 0;
    const elapsed = last ? now - last : 0;
    const dt = elapsed ? Math.min(.05, elapsed / 1000) : 1 / 60;
    last = now;
    let moving = false;
    if (enabled && near && !covered) {
      const raw = Math.min(span.end, Math.max(0, (scrollY - pinStart) / line));
      const snap = shown < 0;
      const repaintIntro = snap || shown < introEnd;
      for (const scene of scenes) if (!outlines.has(scene)) void loadOutlines(scene);
      if (snap) scrollPosition.set(raw);
      if (!bass.loading) void load(bass);
      if (!guitar.loading && !mobileView.matches && raw >= introEnd + span.bass * .5) void load(guitar);
      scrollPosition.to(raw);
      moving = !scrollPosition.step(dt);
      shown = scrollPosition.value;
      for (const scene of scenes) {
        if (dragFrame(scene, now) || stepSpring(scene, dt)) moving = true;
      }
      if (repaintIntro || shown < introEnd) paintIntro(shown);
      updateDeal(bassAt());
      if (sway(dt)) moving = true;
      draw(shown);
      const turning = turnCopies(dt, snap);
      if (turning) moving = true;
      const canStrip = !!slideStrip && !handed && bass.angle === 0 && guitar.angle === 0
        && bass.yaw === THREE_QUARTER_YAW && guitar.yaw === THREE_QUARTER_YAW
        && (shown >= span.moveAt || (!turning && shown >= introEnd + span.bass));
      showSlideStrip(canStrip);
      if (usingStrip && slideStrip) {
        const tilt = lean.get(bass.canvas) ?? 0;
        writeStyle(slideStrip, 'transform', `translate3d(${rowX().toFixed(2)}px,0,0) skewX(${(-tilt).toFixed(3)}deg)`);
      } else if (outlineLayer) {
        outlineLayer.paint();
      } else if (copyLayer) {
        const { y, size } = bass.centre;
        copyLayer.paint(y, size, size * (.5 + .5 / FRAME_WIDTH));
      }
      // On phones `rest-50.webp` already shows the 50° guitar at full studio detail. Its turntable is for the
      // hand, and is fetched once the guitar stands still: fetched at the touch, its first picture was decoded in
      // the middle of whatever scroll that touch began.
      if (!guitar.loading && guitar.standing && !moving) void load(guitar);
      const centre = bass.centre.x + rowX();
      const pixelRatio = renderPixelRatio(elapsed, moving);
      if (onScreen(centre)) renderInstrument(bass, pixelRatio);
      if (onScreen(centre + reach)) renderInstrument(guitar, pixelRatio);
    }
    // Leaving a chapter mid-turn can already have queued the settling spring for the next frame.
    // At rest on the last frame, with FL Studio's hand-off playing over it, a scroll changes nothing here.
    resting = !moving && enabled && near && shown === span.end;
    if (moving) request();
    else if (!queued) last = 0;
  }
  function request() { if (!queued) queued = requestAnimationFrame(tick); }

  // The hand-off to FL Studio (fl-studio/handoff.ts): the guitar's row, left to right, as it stands now.
  const row = [...guitar.copies].sort((a, b) => a.side * a.rank - b.side * b.rank);
  const lent = [...row.slice(0, 3), null, ...row.slice(3)].map((copy, index) => {
    if (copy) handing.set(copy.svg, index);
    return copy;
  }).map(copy => ({
    copy, yaw: NaN, stride: 0, buffer: new Float32Array(POINTS * 2),
    piece: { x: 0, y: 0, size: 1, colour: copy?.colour ?? null, lean: 0, points: new Float32Array(0) } as LineupPiece,
  }));
  const bridge: LineupBridge = {
    view: VIEW,
    foot: .5 + .5 / FRAME_WIDTH,
    near: () => near && enabled,
    settled: () => shown >= span.end - .002,
    pieces() {
      const data = outlines.get(guitar);
      if (!enabled || !data?.length) return [];
      const travel = rowX() + reach;
      const stride = narrow.matches ? 2 : 1;
      return lent.map(item => {
        const { copy, piece } = item;
        const follower = copy && following.get(copy.svg);
        const yaw = follower && !Number.isNaN(follower.yaw) ? follower.yaw : guitar.yaw;
        if (yaw !== item.yaw || stride !== item.stride) {
          item.yaw = yaw;
          item.stride = stride;
          piece.points = shapeAt(data, yaw, item.buffer, stride);
        }
        const slot = copy ? copy.slot : guitar.centre;
        piece.x = slot.x + travel;
        piece.y = slot.y;
        piece.size = slot.size;
        piece.lean = lean.get(copy ? copy.svg : guitar.canvas) ?? 0;
        return piece;
      });
    },
    busy(on) {
      if (on === busy) return;
      busy = on;
      if (near) request();
    },
    take(mask) {
      if (mask === handed) return;
      handed = mask;
      for (const [svg, index] of handing) svg.classList.toggle('is-handed', !!(mask >> index & 1));
      // In this same frame: a copy shown here and there at once, or in neither, is a frame the eye catches.
      if (near && enabled) {
        cancelAnimationFrame(queued);
        tick(performance.now());
      }
    },
    cover(on) {
      if (on === covered) return;
      covered = on;
      if (!on && near) request();
    },
    runway: () => span.end * line,
  };
  lineupBridge.current = bridge;
  onJoinChange(() => { size = ''; resized(); }, signal);

  // The hand.
  for (const scene of scenes) {
    const { grab, element } = scene;
    grab.addEventListener('pointerdown', event => {
      if (!scene.standing || scene.drag || event.button > 0) return; // one finger at a time
      if (!scene.loading) void load(scene);
      scene.spring = null; // caught mid-spin: from where it is on screen
      scene.velocity = 0;
      scene.pointer.reset(event.clientX, event.timeStamp);
      scene.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: scene.angle, decided: event.pointerType === 'mouse', lastSample: event.timeStamp, interval: 0 };
      grab.setPointerCapture(event.pointerId);
      if (event.pointerType === 'mouse') element.classList.add('is-turning');
    }, { signal });
    grab.addEventListener('pointermove', event => {
      const drag = scene.drag;
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      if (!drag.decided) {
        if (Math.abs(event.clientY - drag.y) > 8 && Math.abs(event.clientY - drag.y) > Math.abs(dx)) { scene.drag = null; return; }
        if (Math.abs(dx) < 8) return;
        drag.decided = true;
        drag.x += Math.sign(dx) * 8; // no jump when the turn takes over
        scene.pointer.reset(drag.x, drag.lastSample);
        element.classList.add('is-turning');
      }
      const interval = event.timeStamp - drag.lastSample;
      if (interval > 0) {
        const period = Math.min(34, interval);
        drag.interval = drag.interval ? (drag.interval + period) / 2 : period;
      }
      drag.lastSample = event.timeStamp;
      scene.pointer.push(event.clientX, event.timeStamp);
      request();
    }, { signal });
    const release = (event: PointerEvent, cancelled: boolean) => {
      const drag = scene.drag;
      if (!drag || event.pointerId !== drag.id) return;
      scene.drag = null;
      element.classList.remove('is-turning');
      if (!drag.decided) return;
      const velocity = cancelled ? 0 : scene.pointer.velocity(event.timeStamp) * scene.perPixel;
      const endAngle = drag.from + (scene.pointer.at(drag.lastSample) - drag.x) * scene.perPixel;
      scene.rest = Math.round((endAngle + project(velocity)) / 360) * 360;
      scene.velocity = velocity;
      scene.spring = Math.abs(velocity) > 60 ? { damping: .8, response: .55 } : { damping: 1, response: .45 };
      request();
    };
    grab.addEventListener('pointerup', event => release(event, false), { signal });
    grab.addEventListener('pointercancel', event => release(event, true), { signal });
    grab.addEventListener('lostpointercapture', event => release(event, true), { signal });
    grab.addEventListener('keydown', event => {
      if (!scene.standing) return;
      if (!scene.loading) void load(scene);
      const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 45 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -45 : 0;
      if (step) aim(scene, Math.round(scene.rest / 45) * 45 + step, 1, .4);
      else if (event.key === 'Home') aim(scene, Math.round(scene.angle / 360) * 360, 1, .4);
      else return;
      event.preventDefault();
    }, { signal });
  }

  // Warm outlines, WebGL shaders, the cached slide strip, stills and the bass scroll sheet during
  // idle time well ahead of the section so scrolling into #instruments hits zero setup work.
  let warmed = false;
  const idle = (fn: () => void, delay = 120) => {
    if (stopped) return;
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => { if (!stopped) fn(); }, { timeout: 1200 });
    else setTimeout(() => { if (!stopped) fn(); }, delay);
  };
  function warmAssets() {
    if (warmed || stopped || !enabled) return;
    warmed = true;
    warmWatch.disconnect();
    for (const scene of scenes) {
      scene.still.loading = 'eager';
      void scene.still.decode?.().catch(() => {});
      void loadOutlines(scene);
    }
    idle(() => { if (enabled && !bass.loading) void load(bass); }, 240);
  }
  const warmTimer = setTimeout(() => idle(warmAssets, 0), 1100);
  const warmWatch = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) warmAssets();
  }, { rootMargin: '160% 0px' });
  warmWatch.observe(show);

  const watch = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.target === show) near = entry.isIntersecting;
    if (near) {
      warmAssets();
      locatePin();
      request();
    } else {
      shown = -1;
      still();
    }
  }, { rootMargin: '64px 0px' });
  watch.observe(show);
  // The record shelf above can change height after its fonts or artwork arrive.
  const layout = new ResizeObserver(() => {
    locatePin();
    if (near) request();
  });
  layout.observe(document.body);

  let size = '';
  function resized() {
    const now = `${innerWidth}x${stage.offsetHeight}`;
    if (now === size) return near && request();
    size = now;
    measure();
  }
  resized();
  document.fonts.ready.then(() => { if (!signal.aborted) measure(); });
  window.addEventListener('scroll', () => {
    if (near && !(resting && scrollY - pinStart >= span.end * line)) request();
  }, { passive: true, signal });
  window.addEventListener('resize', resized, { passive: true, signal });
  allowed.addEventListener('change', measure, { signal });
  mobileView.addEventListener('change', measure, { signal });
  signal.addEventListener('abort', () => {
    stopped = true;
    if (lineupBridge.current === bridge) lineupBridge.current = null;
    for (const svg of handing.keys()) svg.classList.remove('is-handed');
    clearTimeout(warmTimer);
    cancelAnimationFrame(queued);
    cancelAnimationFrame(stripTimer);
    warmWatch.disconnect();
    watch.disconnect();
    layout.disconnect();
    slideStrip?.remove();
    outlineLayer?.dispose();
    copyLayer?.dispose();
    for (const scene of scenes) scene.instrument?.dispose();
  });
});
