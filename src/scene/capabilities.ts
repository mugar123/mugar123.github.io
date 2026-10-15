export interface EnvLike {
  matchMedia?: (q: string) => { matches: boolean };
  createCanvas: () => { getContext: (id: string) => unknown } | null;
  connection?: { saveData?: boolean };
}

export function canRenderScene(env: EnvLike): boolean {
  if (env.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (env.connection?.saveData) return false;
  try {
    const c = env.createCanvas();
    if (!c) return false;
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Browser adapter. */
export function browserEnv(w: Window = window): EnvLike {
  const connection = (w.navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    matchMedia: w.matchMedia?.bind(w),
    createCanvas: () => w.document.createElement('canvas'),
    ...(connection === undefined ? {} : { connection }),
  };
}
