import { test, expect } from '@playwright/test';

const root = '#orbit-scene';
async function requireWebGL(page: import('@playwright/test').Page) {
  test.skip(!(await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext(); return true;
  })), 'WebGL unavailable');
}

test('selected models load and share a single satellite download', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'needs JS');
  const requests: string[] = [];
  page.on('request', r => { if (r.url().endsWith('.glb')) requests.push(r.url()); });
  await page.goto('/'); await requireWebGL(page);
  await expect(page.locator(root)).toHaveAttribute('data-models', 'ready');
  await expect(page.locator(root)).toHaveAttribute('data-ready', 'true');
  expect(requests.filter(url => url.endsWith('/satellite-01.glb'))).toHaveLength(1);
  expect(requests.filter(url => url.endsWith('/planet-06.glb'))).toHaveLength(1);
});

test('failed downloads leave a visible primitive scene', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'needs JS');
  await page.route('**/models/*.glb', route => route.abort());
  await page.goto('/'); await requireWebGL(page);
  await expect(page.locator(root)).toHaveAttribute('data-models', 'fallback');
  await expect(page.locator(root)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator(`${root} canvas`)).toBeVisible();
});

test('static scene shows the selected planet and satellites with no JavaScript', async ({ page, javaScriptEnabled }) => {
  test.skip(javaScriptEnabled, 'no-js project');
  await page.goto('/');
  await expect(page.locator('[data-fallback] image[data-model="planet"]')).toHaveAttribute('href', '/models/planet-fallback.webp');
  await expect(page.locator('[data-fallback] image[data-model="satellite"]')).toHaveCount(2);
  await expect(page.getByRole('link', { name: '3D credits' })).toBeVisible();
});

test('reduced motion uses static models without downloading GLBs', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'needs JS');
  const requests: string[] = [];
  page.on('request', r => { if (r.url().endsWith('.glb')) requests.push(r.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await expect(page.locator(root)).toHaveAttribute('data-state', 'fallback');
  await expect(page.locator('[data-fallback] image[data-model="planet"]')).toBeVisible();
  expect(requests).toEqual([]);
});

test('other pages do not request the models or scene bundle', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', r => { if (r.url().includes('/models/') || /\/scene\.[^/]+\.js/.test(r.url())) requests.push(r.url()); });
  await page.goto('/about'); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(requests).toEqual([]);
});
