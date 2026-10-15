import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const opacity = (loc: Locator) => loc.evaluate((el) => getComputedStyle(el).opacity);
const transform = (loc: Locator) => loc.evaluate((el) => getComputedStyle(el).transform);
/** A finished reveal (identity matrix) or no reveal at all (no scroll-driven animation support). */
const AT_REST = /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/;

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
  await expect.poll(() => opacity(scene.locator('.orbit-stage'))).toBe('1');
}

const audit = (page: Page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

for (const path of ['/', '/work/papertok', '/about', '/cv']) {
  test(`axe: ${path}`, async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, 'axe needs JS');
    await page.goto(path);
    if (path === '/') await sceneAtRest(page);
    const results = await audit(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

/**
 * Sections reveal on scroll with a view-timeline animation that moves them (transform only; opacity
 * stays 1, so a section resting mid-reveal at load never fails contrast). Here each section is
 * scrolled into view until its reveal has finished, then the whole page is audited again.
 */
test('axe: / with every section revealed', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'axe needs JS');
  await page.goto('/');
  await sceneAtRest(page);
  const sections = page.locator('section.reveal');
  const count = await sections.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await sections.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(() => transform(sections.nth(i))).toMatch(AT_REST);
  }
  // Past its range the reveal fills forwards, so scrolling on leaves the earlier sections revealed.
  for (let i = 0; i < count; i++) {
    await expect.poll(() => transform(sections.nth(i))).toMatch(AT_REST);
    expect(await opacity(sections.nth(i))).toBe('1');
  }
  const results = await audit(page);
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
