import { test, expect } from '@playwright/test';

const profile = [
  'Building things end to end', 'Product design', 'Python', 'Neural networks',
  'LaTeX (advanced) · MATLAB (intermediate)', 'Cursor · Codex · Claude Code',
];

test('mission console sits between the hero and projects, with one complete skills profile', async ({ page, javaScriptEnabled }) => {
  await page.goto('/');
  const console = page.locator('mission-console');
  await expect(console.getByRole('heading', { name: 'Mission PowerShell' })).toBeVisible();
  for (const text of profile) {
    await expect(console.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: text })).toHaveCount(1);
  }
  const hero = (await page.locator('#abstract').boundingBox())!;
  const terminal = (await console.boundingBox())!;
  const projects = (await page.locator('#in-orbit').boundingBox())!;
  expect(terminal.y).toBeGreaterThanOrEqual(hero.y + hero.height);
  expect(projects.y).toBeGreaterThanOrEqual(terminal.y + terminal.height);
  await expect(console.locator('input, textarea')).toHaveCount(0);
  await expect(console.getByText('IN ORBIT', { exact: true })).toBeVisible();
  if (!javaScriptEnabled) await expect(console.getByRole('button', { name: /Replay boot/ })).toBeHidden();
});

test('boot is finite, replayable by keyboard, and respects changing reduced-motion preferences', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'animation enhancement requires JS');
  await page.goto('/');
  const console = page.locator('mission-console');
  await console.scrollIntoViewIfNeeded();
  await expect(console).toHaveAttribute('data-boot', 'complete');
  const replay = console.getByRole('button', { name: /Replay boot/ });
  await replay.focus(); await replay.press('Enter');
  await expect(console).toHaveAttribute('data-boot', 'running');
  for (const text of profile) await expect(console.getByText(text, { exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(console).toHaveAttribute('data-boot', 'complete');
  await expect(replay).toBeHidden();
  expect(await console.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(console).toHaveAttribute('data-boot', 'running');
  await expect(console).toHaveAttribute('data-boot', 'complete');
});

test('console fits a narrow phone without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  const console = page.locator('mission-console');
  const bounds = (await console.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(await console.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  for (const text of profile) await expect(console.getByText(text, { exact: true })).toBeVisible();
});
