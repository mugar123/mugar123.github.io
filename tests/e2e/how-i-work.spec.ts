import { test, expect, type Page } from '@playwright/test';

const STEPS = ['T−6', 'T−5', 'T−4', 'T−3', 'T−2', 'T−1', 'T−0', 'T+'];

/** Scrolls so that step `k`'s marker sits just past the reading line (55% down the viewport). */
async function readStep(page: Page, k: number) {
  await page.locator('work-procedure .step .marker').nth(k).evaluate((m) => {
    const r = m.getBoundingClientRect();
    scrollBy(0, r.top + r.height / 2 - innerHeight * 0.55 + 4);
  });
}
const readout = (page: Page) => page.locator('work-procedure .count__item.is-current .count__t');
const reached = (page: Page) => page.locator('work-procedure .step[data-reached]');

test('How I work lists the eight steps of the procedure, in order, in the owner\'s words', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('#how-i-work');
  await expect(section.getByRole('heading', { level: 2, name: 'How I work.' })).toBeVisible();
  const steps = section.getByRole('list', { name: 'Pre-launch procedure' }).locator(':scope > li');
  await expect(steps).toHaveCount(STEPS.length);
  for (const [i, t] of STEPS.entries()) await expect(steps.nth(i).locator('.step__t')).toHaveText(t);
  await expect(section.getByText('I look hard at the top three:')).toBeVisible();
  await expect(section.getByText('Then I work with Claude Code and Codex in parallel.')).toBeVisible();
});

test('the countdown follows the scroll down and back up', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'the countdown is a JS enhancement');
  await page.goto('/');
  await expect(page.locator('work-procedure')).toHaveClass(/is-live/);
  await readStep(page, 2);
  await expect(readout(page)).toHaveText('T−4');
  await expect(reached(page)).toHaveCount(3);
  await readStep(page, 7);
  await expect(readout(page)).toHaveText('T+');
  await expect(reached(page)).toHaveCount(8);
  await readStep(page, 1);
  await expect(readout(page)).toHaveText('T−5');
  await expect(reached(page)).toHaveCount(2);
});

test('without JS or under reduced motion it is the finished procedure', async ({ page, javaScriptEnabled }) => {
  if (javaScriptEnabled) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const el = page.locator('work-procedure');
  await expect(el).not.toHaveClass(/is-live/);
  await expect(el.locator('.count__item').last()).toBeVisible(); // the readout rests on T+
  await expect(el.locator('.count__step')).toHaveText(`Step ${STEPS.length} / ${STEPS.length}`);
  const filled = await el.locator('.marker').evaluateAll((ms) => ms.every((m) => getComputedStyle(m).backgroundColor !== 'rgb(255, 255, 255)'));
  expect(filled).toBe(true);
});

test('How I work fits a 320px phone without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.locator('#how-i-work').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
