import { readdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const SPECS = [
  'Building things end to end', 'Product design', 'Python', 'Neural networks',
  'LaTeX (advanced) · MATLAB (intermediate)', 'Cursor · Codex · Claude Code',
];
const WORK = readdirSync(new URL('../../src/content/work/', import.meta.url)).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));

/** Scrolls the console into view and waits for its boot to finish (with JS), or returns at once (without). */
async function finishedConsole(page: Page, javaScriptEnabled: boolean) {
  const console = page.locator('mission-console');
  if (!javaScriptEnabled) return console;
  await console.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  // The panels power on once the log is done *and* they are in view: on a tall phone they sit below it.
  await expect(console).not.toHaveAttribute('data-boot', 'armed');
  await console.locator('.screen').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(console).toHaveAttribute('data-boot', /^(done|static)$/, { timeout: 15_000 });
  return console;
}

/** A definition whose whole text is `text` ("Python" is also inside the panels' longer stacks). */
const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
/** Nothing animating, polled: under reduced motion the site's 0.01 ms transitions settle a frame later. */
const stillness = (page: Page) => expect.poll(() => page.locator('mission-console').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
const clipOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).clipPath);

test('one console, inside In orbit: the Mission specs once and a panel per satellite linking to its page', async ({ page, javaScriptEnabled }) => {
  await page.goto('/');
  await expect(page.locator('mission-console')).toHaveCount(1);
  await expect(page.locator('#in-orbit mission-console')).toHaveCount(1);
  const console = await finishedConsole(page, javaScriptEnabled);
  for (const text of SPECS) {
    await expect(console.getByRole('definition').filter({ hasText: exactly(text) })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: exactly(text) })).toHaveCount(1);
  }
  const panels = console.getByRole('list', { name: 'Satellites in orbit' }).getByRole('listitem');
  await expect(panels).toHaveCount(WORK.length);
  for (const slug of WORK) await expect(console.locator(`a[href="/work/${slug}"]`)).toBeVisible();
  // The boot log is decoration: assistive tech gets the specs and the panels, not the typed commands.
  expect(await console.getByText('uplink --station classroom').evaluate((el) => el.closest('[aria-hidden="true"]') !== null)).toBe(true);
});

test('below the fold it waits armed, boots when scrolled to, and then rests with nothing animating', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'the boot is a JS enhancement');
  await page.goto('/');
  const console = page.locator('mission-console');
  await expect(console).toHaveAttribute('data-boot', 'armed');
  expect(await clipOf(page, 'mission-console .panel')).not.toBe('none'); // panels wait, folded shut
  await console.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(console).toHaveAttribute('data-boot', /^(booting|deploying)$/);
  await console.locator('.screen').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(console).toHaveAttribute('data-boot', 'done', { timeout: 15_000 });
  expect(await clipOf(page, 'mission-console .panel')).toBe('none');
  await stillness(page);
});

test('reduced motion: the console is finished from the start and never animates', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'without JS the console is always static');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const console = page.locator('mission-console');
  await console.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(console).toHaveAttribute('data-boot', 'static');
  for (const text of SPECS) await expect(console.getByRole('definition').filter({ hasText: exactly(text) })).toBeVisible();
  expect(await clipOf(page, 'mission-console .panel')).toBe('none');
  await stillness(page);
});

test('switching to reduced motion mid-boot finishes the console at once', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'the boot is a JS enhancement');
  await page.goto('/');
  const console = page.locator('mission-console');
  await console.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(console).toHaveAttribute('data-boot', 'booting');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(console).toHaveAttribute('data-boot', 'done');
  await stillness(page);
});

test('tabbing to a project before the boot reaches it shows its panel whole', async ({ page, javaScriptEnabled, isMobile }) => {
  test.skip(!javaScriptEnabled || isMobile, 'keyboard focus during the boot');
  await page.goto('/');
  const link = page.locator(`mission-console a[href="/work/${WORK[0]}"]`);
  await link.focus();
  await expect(link).toBeFocused();
  expect(await link.evaluate((el) => getComputedStyle(el.closest('.panel')!).clipPath)).toBe('none');
  expect(await link.evaluate((el) => getComputedStyle(el.closest('h3')!).clipPath)).toBe('none');
});

test('already on screen at load (a link back to #in-orbit), it does not hide what is being read', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'the boot is a JS enhancement');
  await page.goto('/#in-orbit');
  await expect(page.locator('mission-console')).toHaveAttribute('data-boot', 'static');
});

test('the console fits a 320px phone without horizontal scrolling', async ({ page, javaScriptEnabled }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  const console = await finishedConsole(page, javaScriptEnabled);
  const box = (await console.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const text of SPECS) await expect(console.getByRole('definition').filter({ hasText: exactly(text) })).toBeVisible();
});
