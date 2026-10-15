import { test, expect } from '@playwright/test';
import { PHONE_PATTERN, privateExclusions, NO_EXCLUSIONS_MESSAGE } from '../helpers/privacy';
import { published, drafts } from './content';

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

test(`writing index: ${published.length > 0 ? 'lists the published posts' : 'shows the empty state'}`, async ({ page }) => {
  await page.goto('/writing');
  const empty = page.getByText(/no entries yet/i);
  if (published.length === 0) { await expect(empty).toBeVisible(); return; }
  await expect(empty).toHaveCount(0);
  for (const p of published) await expect(page.locator(`a[href="/writing/${p.slug}"]`)).toHaveText(p.title);
});

test('draft routes 404 and published routes render', async ({ page }) => {
  for (const p of drafts) expect((await page.goto(`/writing/${p.slug}`))?.status(), `draft ${p.slug}`).toBe(404);
  for (const p of published) {
    expect((await page.goto(`/writing/${p.slug}`))?.status(), `post ${p.slug}`).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.title);
  }
});

test(`the Writing nav item and the feed link appear only with published posts (${published.length})`, async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Writing' })).toHaveCount(published.length > 0 ? 1 : 0);
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(published.length > 0 ? 1 : 0);
});

test('404 page', async ({ page }) => {
  // `astro preview` serves dist/404.html for unknown routes; GitHub Pages does the same in production.
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Trajectory decayed');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test('content pages keep their canonical link and stay indexable', async ({ page }) => {
  await page.goto('/about');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/about\/?$/);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('rss has one item per published post, and the sitemap exists', async ({ request }) => {
  const rss = await request.get('/rss.xml');
  expect(rss.ok()).toBe(true);
  expect((await rss.text()).match(/<item>/g) ?? []).toHaveLength(published.length);
  expect((await request.get('/sitemap-index.xml')).ok()).toBe(true);
});
