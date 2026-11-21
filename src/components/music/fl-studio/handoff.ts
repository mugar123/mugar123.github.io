import { Spring, clamp } from '../v4/physics';

/* The hand-off from the instruments to FL Studio (LineupStory.astro → StudioStory.astro): the guitar's
   line-up is recorded.

   The two chapters share one held screen for a stretch of scroll: FL Studio's stage lies exactly over
   the instruments', see-through. A playhead (FL's green one) crosses the screen left to right, and
   whatever it passes becomes FL Studio's: the black turns into the Playlist, the guitar's caption into
   FL's, the piano roll's window appears, and each instrument is left behind as a flat shape in the
   colour of a note. One after the other, in the order the playhead reached them, the shapes come away
   from the row, turn to lie along the grid and settle into the piano roll as the first notes of the
   melody, each pressing its key as it lands. From there the chapter goes on as it always did: the
   pencil writes the rest.

   How it moves (Emil Kowalski's rules):
   - It is told by the scroll, so the playhead moves at the scroll's own pace (linear: constant motion)
     and everything plays backwards exactly.
   - The wipe is two opposite transforms (a window and its content, as the page's text fill is), so the
     whole of FL Studio is painted once and only composited after.
   - The shapes are objects, not keyframes: each follows the scroll through a spring (Apple's response
     and damping ratio), and turns on a looser one, so a fast scroll throws them and they rock into
     their slots; a slow one lays them down. Nothing appears from nothing: a shape is the instrument
     that stood there, and the note it becomes takes over under it, in the same place and colour.
   - The row stays the instruments' own. Ahead of the playhead nothing here is drawn at all; behind it FL
     Studio covers the row, and this canvas holds only what the playhead has already passed: at most a few
     shapes a frame, and none of them changes hands on a still screen.
   - Nothing in FL Studio's picture is repainted while it plays, bar a note appearing or a key going down. */

/** What the instruments chapter lends to the hand-off (set by lineup.ts while its page is shown). */
export interface LineupPiece {
  /** Centre of its frame on the stage, px. */
  x: number;
  y: number;
  /** The frame's side, px: the outline's 0..view box is drawn this large. */
  size: number;
  /** Its colour; null for the real instrument, which is not a flat copy until the playhead passes it. */
  colour: string | null;
  /** Degrees it leans on its foot right now. */
  lean: number;
  /** Its outline as it is turned now: x, y pairs in the view box, foot first, up one side and down the other. */
  points: Float32Array;
}
export interface LineupBridge {
  /** The guitar's line-up, left to right. Empty until its outlines have loaded. */
  pieces(): LineupPiece[];
  /** The outlines' view box, and where the foot is in it (a share of its height). */
  view: number;
  foot: number;
  /** The chapter is on screen and has come to rest on its last frame. */
  near(): boolean;
  settled(): boolean;
  /** The hand-off is playing: the instrument is not the hand's for now. */
  busy(on: boolean): void;
  /** The copies the hand-off is drawing itself, a bit each in the order of `pieces()`. The rest stay the row's:
      what the playhead has passed is under FL Studio anyway, so in an ordinary pass nothing is ever taken. */
  take(mask: number): void;
  /** FL Studio covers the stage completely: nothing needs drawing under it. */
  cover(on: boolean): void;
}
export const lineupBridge: { current: LineupBridge | null } = { current: null };

const joinable = matchMedia('(prefers-reduced-motion: no-preference) and (min-height: 580px) and (min-width: 320px) and (forced-colors: none)');
const narrow = matchMedia('(max-width: 760px)');
/** The scroll the hand-off takes, px, for a stage this tall; 0 where the two chapters are not joined. */
export function handoffDistance(stageHeight: number) {
  if (!joinable.matches || !document.querySelector('[data-studio]') || !document.querySelector('[data-lu]')) return 0;
  return Math.round(stageHeight * (narrow.matches ? 2 : 2.2));
}
export const onJoinChange = (listener: () => void, signal: AbortSignal) => joinable.addEventListener('change', listener, { signal });

const smooth = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
// A note as the piano roll draws it (StudioStory.astro, .note): its face, flat, inside a darker edge. The edge keeps
// shapes that overlap apart, as it does notes; the glint is the face's top highlight, for the moment a shape lands.
const NOTE = [195, 245, 204], GLINT = [240, 255, 243], EDGE = '#83ab89', FACE = `rgb(${NOTE.join()})`;
const LEVEL = .92; // from here to its slot a shape only gives way to its note
const SWEEP = { from: .04, to: .95 }; // the share of the hand-off the playhead takes
const FLIGHT = .34; // screen widths the playhead travels while a shape flies
const GAP = .012; // screen widths the playhead is past a shape before it comes away

interface Job {
  shape: Path2D; x: number; y: number; cos: number; sin: number; alpha: number; colour: string | null; edge: number; face: string;
  away: boolean; // off its place in the row: its own colour is this canvas's to draw ahead of the playhead
  left: number; right: number; // how far it reaches on the stage, px: a shape wholly on one side of the playhead is drawn once
}
/** A piece's outline as it stands, kept between frames: it is only made again when the instrument has turned. */
interface Standing { points: Float32Array | null; path: Path2D | null; cx: number; cy: number; length: number; reach: number }
type Cut = Pick<Job, 'shape' | 'x' | 'y' | 'cos' | 'sin'>;
interface Flyer {
  target: HTMLElement;
  key: HTMLElement | null;
  slot: { x: number; y: number; w: number; h: number }; // the note's box on the stage
  u: Spring; // 0 standing in the row, 1 in its slot
  turn: Spring; // 0 upright, 1 lying along the grid
  swing: number; // its own response, s
  landed: boolean | null; // the note itself is on the grid, under the shape
  down: boolean;
  standing: Standing;
  hold: number; // frames it is still drawn here after it was given back to the row
}

export function createHandoff(stage: HTMLElement, fl: HTMLElement, targets: HTMLElement[]) {
  const wipe = stage.querySelector<HTMLElement>('[data-studio-wipe]')!;
  const world = stage.querySelector<HTMLElement>('[data-studio-world]')!;
  const scan = stage.querySelector<HTMLElement>('[data-studio-scan]')!;
  const canvas = stage.querySelector<HTMLCanvasElement>('[data-studio-flight]')!;
  const ctx = canvas.getContext('2d');
  const flyers: Flyer[] = targets.map((target, index) => ({
    target,
    key: fl.querySelector<HTMLElement>(`.fl__keys [data-key="${target.dataset.key}"]`),
    slot: { x: 0, y: 0, w: 1, h: 1 },
    u: new Spring(0, { response: .26, damping: 1 }, .0004),
    // Each turns at its own pace, as the instruments on the rack sway at theirs.
    turn: new Spring(0, { response: .4, damping: .58 }, .0004),
    swing: .4 + .05 * ((index * 5) % 4),
    landed: null,
    down: false,
    standing: { points: null, path: null, cx: 0, cy: 0, length: 1, reach: 1 },
    hold: 0,
  }));
  // Back to front: the copies furthest from the middle first, the real one last, as they stand in the row.
  const order = flyers.map((_, index) => index).sort((a, b) => Math.abs(b - 3) - Math.abs(a - 3));
  let width = 1, height = 1, ratio = 1;
  let drawn = false;
  let playing = false;
  let taken = 0;
  let covered = false;
  const written = { reveal: -1, faint: null as boolean | null, line: NaN, lineOpacity: -1 };

  function measure() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(6e6 / Math.max(1, width * height)));
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    drawn = true; // a resized canvas is empty
    // The notes' boxes with nothing moved: the wipe's transforms cancel out, the window's own is put back by its painter.
    const transform = fl.style.transform;
    fl.style.transform = 'none';
    const origin = stage.getBoundingClientRect();
    for (const flyer of flyers) {
      const box = flyer.target.getBoundingClientRect();
      flyer.slot = { x: box.left - origin.left, y: box.top - origin.top, w: box.width, h: box.height };
    }
    fl.style.transform = transform;
    written.reveal = -1;
    written.faint = null;
    written.line = NaN;
  }

  function reveal(share: number, lineX: number) {
    // Closed, a hair of FL Studio stays on screen at next to no opacity. Nothing of it can be seen, but its
    // picture is painted and kept: hidden outright, the browser paints the whole Playlist in the frame the
    // playhead sets off (and restyles every element in it), which is a frame the reader sees drop.
    const shown = Math.max(1, Math.round(clamp(share, 0, 1) * width * 100) / 100);
    if (shown !== written.reveal) {
      written.reveal = shown;
      const hidden = width - shown;
      wipe.style.transform = hidden <= 0 ? '' : `translate3d(${(-hidden).toFixed(2)}px,0,0)`;
      world.style.transform = hidden <= 0 ? '' : `translate3d(${hidden.toFixed(2)}px,0,0)`;
    }
    const faint = share * width < 1;
    if (faint !== written.faint) wipe.style.opacity = (written.faint = faint) ? '.01' : '';
    // The playhead fades in over its first steps and is gone once it has left the screen.
    const opacity = lineX <= -8 || lineX >= width + 8 ? 0 : Math.round(smooth((lineX + 8) / 40) * 100) / 100;
    if (opacity !== written.lineOpacity) scan.style.opacity = String(written.lineOpacity = opacity);
    if (opacity && lineX !== written.line) scan.style.transform = `translate3d(${(written.line = lineX).toFixed(2)}px,0,0)`;
  }

  // The note is put on the grid once, under its shape, and the shape fades away over it on the canvas: one
  // repaint of FL Studio's picture per note, not one a frame.
  function land(flyer: Flyer, landed: boolean, down: boolean) {
    if (landed !== flyer.landed) flyer.target.style.visibility = (flyer.landed = landed) ? '' : 'hidden';
    if (down !== flyer.down) flyer.key?.classList.toggle('is-down', flyer.down = down);
  }

  function standingOf(flyer: Flyer, points: Float32Array) {
    const standing = flyer.standing;
    if (standing.points === points) return standing;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i]!, y = points[i + 1]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    standing.points = points;
    standing.cx = (minX + maxX) / 2;
    standing.cy = (minY + maxY) / 2;
    standing.length = maxY - minY;
    standing.reach = Math.hypot(maxX - minX, maxY - minY) / 2;
    standing.path = path(points, standing.cx, standing.cy, 0, 0);
    return standing;
  }

  function path(points: Float32Array, cx: number, cy: number, half: number, inflate: number) {
    // Seen along its length, a shape swells (or thins) sideways into the note's bar; its length is the note's already.
    const shape = new Path2D();
    const sides = points.length / 2;
    for (let i = 0; i < points.length; i += 2) {
      const lateral = points[i]! - cx;
      const edge = i < sides ? -half : half;
      const x = lateral + (edge - lateral) * inflate, y = points[i + 1]! - cy;
      if (i) shape.lineTo(x, y);
      else shape.moveTo(x, y);
    }
    shape.closePath();
    return shape;
  }

  /** One frame at `t` (0 the row as the instruments left it, 1 FL Studio's screen). True while anything still moves.
      `lift`: how far this stage still is below the instruments' (px), when a scroll is thrown back past the start. */
  function paint(t: number, dt: number, snap: boolean, lift = 0) {
    const bridge = lineupBridge.current;
    const pieces = bridge?.pieces() ?? [];
    const live = pieces.length === flyers.length && !!ctx;
    // Where the playhead is, in screen widths. It keeps going past the right edge, so the last shapes land on its count.
    let last = 1;
    if (live) { last = 0; for (const piece of pieces) last = Math.max(last, (piece.x + piece.size * .13) / width); }
    const end = Math.max(1.03, last + GAP + FLIGHT + .01);
    const at = -.03 + (end + .03) * clamp((t - SWEEP.from) / (SWEEP.to - SWEEP.from), 0, 1);
    const lineX = at * width;
    reveal(at, lineX);

    // It plays across the hand-off's stretch of scroll, and until the last shape thrown by a fast scroll has come to rest.
    // (At rest for the eye is enough: the last of a spring's ringing is not worth holding the row for.
    // A shape in its slot is held level whatever its spring is doing, so only one still on its way counts.)
    const flying = flyers.some(flyer => Math.abs(flyer.u.value - flyer.u.target) > .002 || (flyer.u.value < LEVEL
      && (Math.abs(flyer.turn.value - flyer.turn.target) * 90 > .4 || Math.abs(flyer.turn.velocity) * 90 > 6)));
    // (Nor does it stop while a copy is still its own to draw, or just given back: the row needs a frame to show it.)
    const take = live && ((t > 0 && t < 1) || ((flying || taken !== 0 || flyers.some(flyer => flyer.hold > 0)) && !snap));
    if (take !== playing) bridge?.busy(playing = take);
    const cover = t >= 1 && !take;
    if (cover !== covered) bridge?.cover(covered = cover);

    let moving = false;
    let mask = 0;
    const scale = live ? pieces[0]!.size / bridge!.view : 1;
    if (ctx && (take || drawn)) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawn = false;
    }
    const jobs: Job[] = [];
    // Ahead of the playhead, back to front: a copy in the air (drawn), or something standing in the row (cut out of those).
    const ahead: (Job | Cut)[] = [];
    for (const index of order) {
      const flyer = flyers[index]!;
      const piece = pieces[index];
      // Without the row to draw from (its outlines never came), the notes still arrive on the playhead's count.
      const right = piece ? (piece.x + piece.size * .13) / width : (index + 1) / (flyers.length + 1);
      const goal = t >= 1 ? 1 : clamp((at - right - GAP) / FLIGHT, 0, 1);
      // Thrown back past the start, the row is the instruments' again and may scroll away: whatever is still in the
      // air stands up at once, without a swing. (Thrown forward, the shapes keep theirs: they rock into their slots.)
      const over = t <= 0;
      flyer.u.to(goal, { response: over ? .18 : .26 });
      flyer.turn.to(smooth(goal / .7), over ? { response: .2, damping: 1 } : { response: flyer.swing, damping: .58 });
      if (snap) { flyer.u.set(goal); flyer.turn.set(flyer.turn.target); }
      const still = flyer.u.step(dt);
      const stood = flyer.turn.step(dt);
      if (!still || !stood) moving = true;
      const u = clamp(flyer.u.value, 0, 1);
      // Its last stretch is the note taking over, in place: by then it is the note's bar, in its slot and level.
      const fade = !live || !take ? Number(goal >= 1) : smooth((u - LEVEL) / (1 - LEVEL));
      land(flyer, fade > 0, u > .78 && fade < .6 && take);
      if (!take || !piece) continue;
      // Off its place while the playhead is not past it (a scroll thrown back): the row must not show it standing too.
      // (Within a pixel of where it stands, and upright, it is standing: the row has it back before a spring's last breath.)
      const away = flyer.u.value > .02 || Math.abs(flyer.turn.value) * 90 > .5;
      if (away && piece.colour && lineX < piece.x + piece.size * .2) mask |= 1 << index;
      // Given back, a copy is drawn by the row again on its next frame or the one after: it stays here until then.
      else if (taken >> index & 1) flyer.hold = 4;
      else if (flyer.hold > 0 && dt > 0) flyer.hold--;
      if (flyer.hold > 0) moving = true;
      const held = away || flyer.hold > 0;
      const { points, size, colour } = piece;
      const view = bridge!.view;
      const standing = standingOf(flyer, points);
      const { cx, cy } = standing;
      // Standing: on its foot, leaning as the rack has it.
      const lean = piece.lean * Math.PI / 180 * (1 - smooth(u * 5));
      const footX = view / 2 - cx, footY = view * bridge!.foot - cy; // the foot, seen from the shape's centre
      const startX = piece.x - (Math.cos(lean) * footX - Math.sin(lean) * footY) * scale;
      const startY = piece.y - lift - size / 2 + size * bridge!.foot - (Math.sin(lean) * footX + Math.cos(lean) * footY) * scale;
      // What stands in the row (a copy in its place; the real instrument always) is drawn by the row, under this
      // canvas. A copy in the air ahead of the playhead passes behind the ones standing nearer the middle, as it
      // stood behind them: their shapes are cut out of it.
      if (!held || !colour) {
        const rest = piece.lean * Math.PI / 180;
        const restX = piece.x - (Math.cos(rest) * footX - Math.sin(rest) * footY) * scale;
        const restY = piece.y - lift - size / 2 + size * bridge!.foot - (Math.sin(rest) * footX + Math.cos(rest) * footY) * scale;
        ahead.push({ shape: standing.path!, x: restX * ratio, y: restY * ratio, cos: Math.cos(rest) * scale * ratio, sin: Math.sin(rest) * scale * ratio });
      }
      if (fade >= 1) continue;
      // Standing with the playhead still short of it, there is nothing of it to draw here.
      if (!held && colour && lineX <= piece.x - size * .2) continue;
      // Lying: its length the note's, its centre the note's.
      const slot = flyer.slot;
      const lying = slot.w / standing.length;
      const travel = smooth(u / LEVEL);
      const grow = smooth(u / .86);
      const size1 = scale * (lying / scale) ** grow;
      // It comes away upwards before it comes down into its slot: a small hop, bigger for the ones that go far.
      const hop = Math.min(height * .09, Math.hypot(slot.x - startX, slot.y - startY) * .16) * Math.sin(Math.PI * travel);
      const x = startX + (slot.x + slot.w / 2 - startX) * travel;
      const y = startY + (slot.y + slot.h / 2 - startY) * travel - hop;
      // It rocks on its spring in the air and is brought level as it comes in, so it never lands askew.
      const turned = flyer.turn.value + (1 - flyer.turn.value) * smooth((u - .7) / (LEVEL - .7));
      const angle = lean + turned * Math.PI / 2;
      const inflate = smooth((u - .48) / .44);
      const half = slot.h / 2 / lying;
      const shape = inflate ? path(points, cx, cy, half, inflate) : standing.path!;
      const glint = smooth((u - .7) / .2);
      const reach = Math.max(standing.reach, half * 1.5) * size1 + 2;
      const job: Job = {
        shape, x: x * ratio, y: y * ratio, cos: Math.cos(angle) * size1 * ratio, sin: Math.sin(angle) * size1 * ratio,
        alpha: 1 - fade, colour, edge: 2 / size1, // half the edge lies under the fill: a pixel shows
        face: glint ? `rgb(${NOTE.map((channel, i) => Math.round(channel + (GLINT[i]! - channel) * glint)).join()})` : FACE,
        left: x - reach, right: x + reach, away: held,
      };
      jobs.push(job);
      if (held && colour) ahead.push(job);
    }
    if (mask !== taken) {
      bridge?.take(taken = mask);
      moving = true;
    }
    if (ctx && jobs.length) {
      // One clip a side, and each shape only on the side (or sides) of the playhead it is on.
      const side = (from: number, to: number) => {
        ctx.save();
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.beginPath();
        ctx.rect(from, 0, to - from, height);
        ctx.clip();
      };
      const front = Math.max(0, lineX), behind = Math.min(width, lineX);
      // Ahead of the playhead a copy is still its own colour. Only one off its place is drawn here: the rest stand
      // in the row underneath.
      if (front < width && ahead.some(item => 'colour' in item && item.right > front)) {
        side(front, width);
        let any = false;
        for (const item of ahead) {
          const flown = 'colour' in item;
          if (flown ? item.right <= front : !any) continue;
          ctx.setTransform(item.cos, item.sin, -item.sin, item.cos, item.x, item.y);
          ctx.globalCompositeOperation = flown ? 'source-over' : 'destination-out';
          ctx.globalAlpha = flown ? item.alpha : 1;
          if (flown) ctx.fillStyle = item.colour!;
          ctx.fill(item.shape);
          any = true;
        }
        ctx.restore();
      }
      // Behind it they are a note's colour already, each inside its edge.
      if (behind > 0) {
        side(0, behind);
        ctx.strokeStyle = EDGE;
        for (const job of jobs) {
          if (job.left >= behind) continue;
          ctx.setTransform(job.cos, job.sin, -job.sin, job.cos, job.x, job.y);
          ctx.globalAlpha = job.alpha;
          ctx.fillStyle = job.face;
          ctx.lineWidth = job.edge;
          ctx.stroke(job.shape);
          ctx.fill(job.shape);
        }
        ctx.restore();
      }
      drawn = true;
    }
    // Whatever is left on the canvas once the row has its copies back is wiped on the next frame.
    if (drawn && !take) moving = true;
    // Past either end with the shapes still the hand-off's: one more frame gives them back and releases the keys.
    if (take && (t >= 1 || t <= 0)) moving = true;
    return moving;
  }

  function clear() {
    playing = covered = false;
    taken = 0;
    lineupBridge.current?.busy(false);
    lineupBridge.current?.take(0);
    lineupBridge.current?.cover(false);
    wipe.style.opacity = wipe.style.transform = world.style.transform = '';
    scan.style.opacity = '0';
    written.reveal = written.lineOpacity = -1;
    written.faint = null;
    written.line = NaN;
    for (const flyer of flyers) {
      flyer.u.set(1);
      flyer.turn.set(1);
      flyer.landed = null;
      flyer.hold = 0;
      flyer.target.style.visibility = '';
      if (flyer.down) flyer.key?.classList.remove('is-down');
      flyer.down = false;
    }
    ctx?.setTransform(1, 0, 0, 1, 0, 0);
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    drawn = false;
  }

  return { measure, paint, clear, flown: new Set(targets) };
}
