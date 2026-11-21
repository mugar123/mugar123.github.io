import type { Instrument } from './instrument';

const TILE_COUNT = 30;
const STEPS = 6; // Six 2° intervals, with a seventh view shared by the next tile.
const SCROLL_COLS = 14, SCROLL_ROWS = 2, SCROLL_FRAMES = SCROLL_COLS * SCROLL_ROWS; // 0° to -54° every 2°
const SCROLL_HEIGHT = 700;
const DETAIL_HEIGHT = 1600;
const ASPECT = .32;
const wrapTile = (tile: number) => (tile + TILE_COUNT) % TILE_COUNT;
// How wide the instrument stands when turned `degrees` about its long axis, against face-on: a slab's face
// narrows with the cosine while its side comes round with the sine (the bodies are about a fifth as deep as wide).
const DEPTH = .18;
const breadth = (degrees: number) => {
  const turn = degrees * Math.PI / 180;
  return Math.abs(Math.cos(turn)) + DEPTH * Math.abs(Math.sin(turn));
};

type Photograph = ImageBitmap | HTMLImageElement;

// `fit`: the sheet's size on this screen, when that is smaller than it was photographed. The decoder then hands
// over a picture already that size, made off the main thread. Left at full size, the first frame drawn from a
// sheet scaled the whole of it down on the main thread (12 ms on a laptop for one strip of the guitar): a hitch
// every twelve degrees of a turn by hand.
async function photograph(url: string, fit?: { width: number; height: number }): Promise<Photograph> {
  if (typeof createImageBitmap === 'function') {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Missing instrument view');
    const blob = await response.blob();
    if (fit) {
      try {
        return await createImageBitmap(blob, { resizeWidth: fit.width, resizeHeight: fit.height, resizeQuality: 'high' });
      } catch {
        // No resizing in this browser: the picture as it was taken.
      }
    }
    return createImageBitmap(blob);
  }
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
}

function release(image: Photograph | undefined) {
  if (image && 'close' in image) image.close();
}

// A single pre-scaled sheet (`scroll.webp`) covers the bass's entire 0° to -50° scroll arc with
// zero mid-scroll network requests, decodes or GPU texture uploads. Full-circle detail strips and
// the overview sheet load only when the reader grabs an instrument and spins it past that arc.
export async function createTurntable(
  canvas: HTMLCanvasElement,
  folder: string,
  initialYaw: number,
  initialSize: number,
  repaint: () => void,
  hasScrollSheet = false,
): Promise<Instrument> {
  const positionAt = (yaw: number) => ((-yaw % 360 + 360) % 360) / 2;
  const initialPosition = positionAt(initialYaw);
  const initialTile = Math.floor(initialPosition / STEPS);
  // A sheet of `columns` by `rows` views, each `tall` px as photographed, at the size the canvas shows them.
  const fit = (columns: number, rows: number, tall: number) =>
    canvas.height > 1 && canvas.height < tall ? { width: columns * canvas.width, height: rows * canvas.height } : undefined;
  const loadTile = (index: number) => photograph(folder + '/detail/' + index + '.webp', fit(STEPS + 1, 1, DETAIL_HEIGHT));
  const overviewUrl = folder + '/turntable.webp';
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('2D canvas unavailable');

  function sizeCanvas(size: number) {
    if (size <= 0) return false;
    const cap = hasScrollSheet ? SCROLL_HEIGHT : DETAIL_HEIGHT;
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    const height = Math.min(cap, Math.max(1, Math.ceil(size * dpr)));
    const width = Math.max(1, Math.round(height * ASPECT));
    canvas.style.width = `${size * ASPECT}px`;
    canvas.style.height = `${size}px`;
    if (canvas.height === height && canvas.width === width) return false;
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  sizeCanvas(initialSize);

  const tiles = new Map<number, Photograph>();
  const failed = new Set<number>();
  let scrollSheet: Photograph | undefined;
  let overview: Photograph | undefined;

  if (hasScrollSheet && initialPosition <= SCROLL_FRAMES - 1) {
    try {
      scrollSheet = await photograph(folder + '/scroll.webp', fit(SCROLL_COLS, SCROLL_ROWS, SCROLL_HEIGHT));
    } catch {
      // Fall back to the per-angle detail strips if the scroll sheet is missing.
    }
  }
  if (!scrollSheet) {
    try {
      tiles.set(initialTile, await loadTile(initialTile));
    } catch {
      failed.add(initialTile);
      overview = await photograph(overviewUrl);
    }
  }

  let disposed = false;
  let fetchingTile = false;
  let pendingTile: number | null = null;
  let requestedOverview = !!overview;
  let previousYaw = NaN;
  let drawnYaw = NaN;
  let direction = 0;
  let dirty = true;
  let painted = false;

  function invalidate() {
    if (disposed) return;
    dirty = true;
    repaint();
  }

  function fetchDetail(index: number) {
    if (tiles.has(index) || failed.has(index)) return;
    if (fetchingTile) {
      pendingTile = index;
      return;
    }
    fetchingTile = true;
    loadTile(index).then(image => {
      if (disposed) return release(image);
      tiles.set(index, image);
      if (tiles.size > 3) {
        const oldest = tiles.keys().next().value!;
        release(tiles.get(oldest));
        tiles.delete(oldest);
      }
      invalidate();
    }, () => failed.add(index)).finally(() => {
      fetchingTile = false;
      if (!disposed && pendingTile !== null) {
        const next = pendingTile;
        pendingTile = null;
        fetchDetail(next);
      }
    });
  }

  function fetchOverview() {
    if (requestedOverview) return;
    requestedOverview = true;
    photograph(overviewUrl).then(image => {
      if (disposed) return release(image);
      overview = image;
      invalidate();
    }, () => {});
  }

  // The instrument at `position` frames into a sheet whose frames are `step` degrees apart, the first at `from`.
  // Between two photographs it is both, each brought to the angle asked for before they are mixed: turned a
  // degree on, the instrument is the same picture a little narrower (or wider) about its axis. Mixed as they
  // were taken, two poses read as a double exposure; shown one at a time (the nearest), the instrument turned
  // in two-degree jumps, at half the frame rate of the copies beside it.
  function paint(image: Photograph, position: number, columns: number, rows: number, wrapFrames: boolean, from: number, step: number) {
    painted = true;
    const total = columns * rows;
    const width = image.width / columns, height = image.height / rows;
    const wide = breadth(from + position * step);
    function draw(frame: number, taken: number) {
      // Never stretched far: near edge-on the two photographs are simply mixed.
      const scale = Math.min(1.12, Math.max(.89, wide / breadth(from + taken * step)));
      const across = canvas.width * scale;
      context!.drawImage(image, frame % columns * width, Math.floor(frame / columns) * height,
        width, height, (canvas.width - across) / 2, 0, across, canvas.height);
    }
    context!.clearRect(0, 0, canvas.width, canvas.height);
    context!.globalCompositeOperation = 'source-over';
    const first = Math.floor(position);
    const blend = position - first;
    const second = wrapFrames ? (first + 1) % total : Math.min(total - 1, first + 1);
    if (blend <= .005 || second === first) {
      context!.globalAlpha = 1;
      draw(first, first);
    } else if (blend >= .995) {
      context!.globalAlpha = 1;
      draw(second, first + 1);
    } else {
      context!.globalAlpha = 1 - blend;
      draw(first, first);
      context!.globalCompositeOperation = 'lighter';
      context!.globalAlpha = blend;
      draw(second, first + 1);
    }
  }

  // Upload the decoded bitmap to the GPU backing texture ahead of scroll.
  if (canvas.width > 1 && canvas.height > 1) {
    if (scrollSheet) paint(scrollSheet, initialPosition, SCROLL_COLS, SCROLL_ROWS, false, 0, 2);
    else if (tiles.has(initialTile)) paint(tiles.get(initialTile)!, initialPosition - initialTile * STEPS, STEPS + 1, 1, false, initialTile * STEPS * 2, 2);
    drawnYaw = previousYaw = initialYaw;
    dirty = false;
  }

  return {
    pose(yaw) {
      const exactRest = yaw === 0 || yaw === -50;
      // (A turn too small to move a pixel shares the last picture.)
      if (!dirty && (yaw === drawnYaw || (!exactRest && Math.abs(yaw - drawnYaw) < .03))) return;
      if (Number.isFinite(previousYaw) && previousYaw !== yaw) direction = Math.sign(previousYaw - yaw);
      previousYaw = yaw;
      drawnYaw = yaw;
      dirty = false;
      const position = positionAt(yaw);
      if (scrollSheet && position <= SCROLL_FRAMES - 1) {
        paint(scrollSheet, position, SCROLL_COLS, SCROLL_ROWS, false, 0, 2);
        return;
      }
      const tile = Math.floor(position / STEPS);
      const local = position - tile * STEPS;
      const image = tiles.get(tile);
      if (image) {
        tiles.delete(tile);
        tiles.set(tile, image);
        paint(image, local, STEPS + 1, 1, false, tile * STEPS * 2, 2);
        if ((direction > 0 && local >= 2) || (direction < 0 && local <= 4)) fetchDetail(wrapTile(tile + direction));
      } else {
        fetchDetail(tile);
        fetchOverview();
        if (overview) paint(overview, ((yaw % 360 + 360) % 360) / 4, 15, 6, true, 0, 4);
        else if (!painted) {
          const firstAvailable = tiles.entries().next().value;
          if (firstAvailable) {
            const [index, sheet] = firstAvailable;
            paint(sheet, Math.max(0, Math.min(STEPS, position - index * STEPS)), STEPS + 1, 1, false, index * STEPS * 2, 2);
          }
        }
      }
    },
    resize(size) {
      if (!sizeCanvas(size)) return;
      painted = false;
      dirty = true;
    },
    dispose() {
      disposed = true;
      pendingTile = null;
      release(scrollSheet);
      scrollSheet = undefined;
      for (const tile of tiles.values()) release(tile);
      tiles.clear();
      release(overview);
      overview = undefined;
      canvas.width = canvas.height = 1;
    },
  };
}
