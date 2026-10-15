import { test, expect, type Page } from '@playwright/test';

/** Waits for the island to decide between WebGL and the fallback; returns the final state. */
async function settledSceneState(page: Page) {
  const scene = page.locator('#orbit-scene');
  await expect(scene).toHaveAttribute('data-state', /^(webgl|fallback)$/, { timeout: 10_000 });
  const state = await scene.getAttribute('data-state');
  if (state === 'webgl') await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 10_000 });
  return state;
}

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
    const state = await settledSceneState(page);
    test.skip(state !== 'webgl', 'WebGL unavailable in this runner — run locally for the interaction test');
    const pad = (await page.getByTestId('launch-pad').boundingBox())!;
    const status = page.getByTestId('launch-status');
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
    const state = await settledSceneState(page);
    test.skip(state !== 'webgl', 'WebGL unavailable in this runner');
    await page.locator('#orbit-scene').focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('launch-status')).toContainText(/v₀ · (ORBIT ACHIEVED|SUBORBITAL|ESCAPE)/);
  });

  test('losing the WebGL context restores the SVG fallback', async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    const state = await settledSceneState(page);
    test.skip(state !== 'webgl', 'WebGL unavailable in this runner');
    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#orbit-scene canvas')!;
      const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    });
    const scene = page.locator('#orbit-scene');
    await expect(scene).toHaveAttribute('data-state', 'fallback');
    await expect(scene.locator('[data-fallback]')).toBeVisible();
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
