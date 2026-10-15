import { test, expect, type Locator, type Page } from '@playwright/test';

/** Waits for the island to decide between WebGL and the fallback; returns the final state. */
async function settledSceneState(page: Page) {
  const scene = page.locator('#orbit-scene');
  await expect(scene).toHaveAttribute('data-state', /^(webgl|fallback)$/, { timeout: 10_000 });
  const state = await scene.getAttribute('data-state');
  if (state === 'webgl') await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 10_000 });
  return state;
}

/** Whether this browser can create a WebGL context at all, checked independently of the island. */
async function webglAvailable(page: Page) {
  return page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  });
}

/**
 * For the interaction tests: skips only when the runner has no WebGL. Otherwise the scene must have
 * mounted and drawn — a fallback here means the island failed (import, mount or runtime error), and
 * that is a failure, not a reason to skip.
 */
async function requireMountedScene(page: Page) {
  test.skip(!(await webglAvailable(page)), 'WebGL unavailable in this runner — run locally for the interaction tests');
  const scene = page.locator('#orbit-scene');
  await expect(scene).toHaveAttribute('data-state', 'webgl', { timeout: 10_000 });
  await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 10_000 });
}

/** The launch HUD, located by test id and by its live-region role, so dropping role="status" fails. */
const launchStatus = (page: Page) => page.getByTestId('launch-status').and(page.getByRole('status'));

const opacity = (loc: Locator) => loc.evaluate((el) => getComputedStyle(el).opacity);

test.describe('home', () => {
  test('hero text, CTAs and sections render', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Already in orbit');
    const hero = page.locator('#abstract');
    await expect(hero.getByRole('link', { name: /see what's in orbit/i })).toBeVisible();
    await expect(hero.getByRole('link', { name: /^contact$/i })).toBeVisible();
    await expect(page.locator('#in-orbit')).toBeVisible();
    await expect(page.locator('#mission-specs')).toBeVisible();
    await expect(page.locator('#ground-control')).toBeVisible();
  });

  test('logbook is hidden while there are no published posts, and numbering stays contiguous', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#logbook')).toHaveCount(0);
    await expect(page.locator('#ground-control .mono').first()).toContainText('§3');
  });

  // Guards the built CSS: the minifier once folded animation-timeline into an invalid `animation` shorthand
  // and browsers dropped the whole reveal (animation-name: none), which only the built site shows.
  test('sections reveal on scroll by transform only (built CSS keeps the view timeline)', async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, 'computed-style checks need page evaluation');
    await page.goto('/');
    test.skip(!(await page.evaluate(() => CSS.supports('animation-timeline: view()'))), 'no scroll-driven animations in this browser');
    const section = page.locator('section.reveal').last();
    const style = () => section.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, opacity: cs.opacity, transform: cs.transform, below: el.getBoundingClientRect().top > innerHeight };
    });
    expect(await style()).toEqual({ name: 'rise-transform', opacity: '1', transform: 'matrix(1, 0, 0, 1, 0, 8)', below: true });
    await section.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect.poll(async () => (await style()).transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect((await style()).opacity).toBe('1');
  });

  test('scene mounts WebGL or keeps the SVG fallback, never neither', async ({ page, javaScriptEnabled }) => {
    await page.goto('/');
    const scene = page.locator('#orbit-scene');
    await expect(scene).toBeVisible();
    if (!javaScriptEnabled) { await expect(scene.locator('[data-fallback]')).toBeVisible(); return; }
    const state = await settledSceneState(page);
    if (state === 'webgl') await expect(scene.locator('canvas')).toBeVisible();
    else await expect(scene.locator('[data-fallback]')).toBeVisible();
  });

  test('a drag from the pad produces a trajectory outcome; a click does not', async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await requireMountedScene(page);
    const pad = (await page.getByTestId('launch-pad').boundingBox())!;
    const status = launchStatus(page);
    const cx = pad.x + pad.width / 2, cy = pad.y + pad.height / 2;
    // A stationary click is not a launch.
    await page.mouse.click(cx, cy);
    await expect(status).toHaveText(/DRAG TO LAUNCH/);
    // A drag is.
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx + 80, cy - 25, { steps: 8 });
    await page.mouse.up();
    await expect(status).toContainText(/v₀ · (ORBIT ACHIEVED|SUBORBITAL|ESCAPE)/);
  });

  test('the toy is keyboard operable', async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await requireMountedScene(page);
    await page.locator('#orbit-scene').focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(launchStatus(page)).toContainText(/v₀ · (ORBIT ACHIEVED|SUBORBITAL|ESCAPE)/);
  });

  test('losing the WebGL context restores the SVG fallback', async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await requireMountedScene(page);
    const scene = page.locator('#orbit-scene');
    const fallback = scene.locator('[data-fallback]');
    // Lose the context only once the cross-fade is over, so the restoration path (un-hiding) is exercised.
    await expect(fallback).toHaveAttribute('hidden');
    await expect.poll(() => opacity(scene.locator('.orbit-stage'))).toBe('1');
    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#orbit-scene canvas')!;
      const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    });
    await expect(scene).toHaveAttribute('data-state', 'fallback');
    await expect(fallback).not.toHaveAttribute('hidden');
    await expect(fallback).toBeVisible();
    await expect.poll(() => opacity(fallback)).toBe('1');
  });

  test('mobile: headline in the first viewport, CTAs within 1.5 viewports', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/');
    const vh = page.viewportSize()!.height;
    const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(h1.y + h1.height).toBeLessThan(vh);
    const hero = page.locator('#abstract');
    for (const loc of [hero.getByRole('link', { name: /see what's in orbit/i }), hero.getByRole('link', { name: /^contact$/i })]) {
      const b = (await loc.boundingBox())!;
      expect(b.y + b.height).toBeLessThan(vh * 1.5);
    }
  });
});
