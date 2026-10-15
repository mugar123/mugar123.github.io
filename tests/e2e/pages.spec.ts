import { test, expect } from '@playwright/test';
import { PHONE_PATTERN, privateExclusions, NO_EXCLUSIONS_MESSAGE } from '../helpers/privacy';

for (const path of ['/work/papertok', '/work/notes-to-latex', '/writing', '/about', '/cv']) {
  test(`${path} renders with a heading and ships no Three`, async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()); });
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    expect(scripts.filter((u) => /three|scene/i.test(u))).toEqual([]);
  });
}

test('cv page: no phone number, print action present', async ({ page }) => {
  await page.goto('/cv');
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(PHONE_PATTERN);
  await expect(page.getByRole('button', { name: /print|save as pdf/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nicolás Muñoz García');
});

test('no page mentions the facts the owner keeps private', async ({ page }) => {
  const words = privateExclusions();
  test.skip(words.length === 0, NO_EXCLUSIONS_MESSAGE);
  for (const path of ['/', '/cv', '/about', '/work/papertok', '/work/notes-to-latex', '/writing']) {
    await page.goto(path);
    const html = (await page.content()).toLowerCase();
    for (const word of words) expect(html, `${path} contains a private word`).not.toContain(word);
  }
});

test('writing index shows the empty state while every post is a draft, and draft routes do not exist', async ({ page }) => {
  await page.goto('/writing');
  await expect(page.getByText(/no entries yet/i)).toBeVisible();
  const res = await page.goto('/writing/first-entry');
  expect(res?.status()).toBe(404);
});

test('404 page', async ({ page }) => {
  // `astro preview` serves dist/404.html for unknown routes; GitHub Pages does the same in production.
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Trajectory decayed');
});

test('rss and sitemap exist', async ({ request }) => {
  expect((await request.get('/rss.xml')).ok()).toBe(true);
  expect((await request.get('/sitemap-index.xml')).ok()).toBe(true);
});
