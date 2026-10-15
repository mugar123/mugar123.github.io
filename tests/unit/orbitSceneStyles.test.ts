import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** The scene's global stylesheet, read from the component (the scene itself only toggles classes). */
const css = readFileSync(new URL('../../src/scene/OrbitScene.astro', import.meta.url), 'utf8');

/** Declarations of the rule whose selector is exactly `selector`. */
function rule(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  if (!match) throw new Error(`no rule for ${selector}`);
  return Object.fromEntries(
    match[1]!.split(';').map((d) => d.split(':').map((s) => s.trim())).filter(([k, v]) => k && v).map(([k, v]) => [k!, v!]),
  );
}

describe('orbit scene styles', () => {
  it('a satellite label behind the planet is hidden completely, not faded', () => {
    const occluded = rule('.orbit-label.is-occluded');
    expect(occluded['visibility'] === 'hidden' || occluded['display'] === 'none').toBe(true);
    if ('opacity' in occluded) expect(occluded['opacity']).toBe('0');
  });
});
