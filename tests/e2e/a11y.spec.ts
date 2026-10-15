import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Axe audits the home page at rest: once the island has settled and, if WebGL mounted, the 500 ms
 * cross-fade from the SVG fallback has finished. Mid-fade, both layers are partly transparent and axe
 * measures blended colours, so an audit started at an arbitrary moment would be flaky.
 */
async function sceneAtRest(page: Page) {
  const scene = page.locator('#orbit-scene');
  await expect(scene).toHaveAttribute('data-state', /^(webgl|fallback)$/, { timeout: 10_000 });
  if ((await scene.getAttribute('data-state')) !== 'webgl') return;
  await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 10_000 });
  await expect(scene.locator('[data-fallback]')).toBeHidden();
  await expect.poll(() => scene.locator('.orbit-stage').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
}

for (const path of ['/', '/work/papertok', '/about', '/cv']) {
  test(`axe: ${path}`, async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, 'axe needs JS');
    await page.goto(path);
    if (path === '/') await sceneAtRest(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
