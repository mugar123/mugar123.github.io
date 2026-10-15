export interface EnvLike {
  matchMedia?: (q: string) => { matches: boolean };
  createCanvas: () => { getContext: (id: string) => unknown } | null;
  connection?: { saveData?: boolean };
  /** `navigator.deviceMemory` (GiB, rounded down by the browser; Chromium only). */
  deviceMemory?: number;
}

/** Below this many GiB of device memory the scene falls back to the SVG. */
export const MIN_DEVICE_MEMORY = 2;

export function canRenderScene(env: EnvLike): boolean {
  try {
    if (env.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    if (env.connection?.saveData) return false;
    if (typeof env.deviceMemory === 'number' && env.deviceMemory < MIN_DEVICE_MEMORY) return false;
    const c = env.createCanvas();
    if (!c) return false;
    const context = (c.getContext('webgl2') ?? c.getContext('webgl')) as {
      getExtension?: (name: string) => { loseContext: () => void } | null;
    } | null;
    if (!context) return false;
    context.getExtension?.('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Browser adapter. */
export function browserEnv(w: Window = window): EnvLike {
  const nav = w.navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  const { connection, deviceMemory } = nav;
  return {
    matchMedia: w.matchMedia?.bind(w),
    createCanvas: () => w.document.createElement('canvas'),
    ...(connection === undefined ? {} : { connection }),
    ...(typeof deviceMemory === 'number' ? { deviceMemory } : {}),
  };
}
