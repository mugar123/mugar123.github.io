# Personal Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Nicolás's personal site — a static Astro site on GitHub Pages whose hero is an interactive Three.js "escape velocity" scene (planet, project satellites, drag-to-launch with real two-body physics) over a graph-paper, LaTeX-typeset page.

**Architecture:** Astro (static output) renders every page from Markdown content collections; the only client JavaScript is a vanilla Three.js island on the home hero, fed satellite data from the `work` collection at build time. Physics lives in a pure TypeScript module (`src/lib/orbit.ts`) with no DOM or Three dependency, so it is unit-tested with Vitest; the scene only draws what that module computes. A server-rendered SVG fallback of the same scene is always in the HTML and is replaced by the canvas only when WebGL is available and the visitor has not asked for reduced motion.

**Tech Stack:** Astro 7.x · TypeScript (strict) · Three.js 0.186 · plain CSS with custom properties · Vitest 5 · Playwright 1.64 + @axe-core/playwright · Lighthouse CI · GitHub Actions (`withastro/action`) → GitHub Pages · Node 24 · npm.

**Spec:** `docs/superpowers/specs/2026-10-15-personal-website-design.md`

## Global Constraints

- Site URL is `https://mugar123.github.io`, repo `mugar123/mugar123.github.io`, branch `main`, **no `base` path**.
- English only. Headlines sentence case; mono labels UPPERCASE. Sections numbered `§0`–`§4`.
- Exactly one accent color `#E2401C`; used only for active status, primary CTA, and the visitor's successful launch.
- Body text 18–19 px, line-height ≥ 1.6, color `#121412`; `#6E736D` only for mono labels ≥ 12 px.
- Fonts self-hosted: Latin Modern Roman (GUST Font License) and JetBrains Mono (OFL). No Google Fonts requests.
- Home total JS ≤ 200 KB gzip including Three; other pages ship no Three.
- Hero text server-rendered and visible with JS disabled; CLS = 0 (fixed-aspect scene container).
- All motion stops under `prefers-reduced-motion: reduce`; scene falls back to static SVG when WebGL is unavailable.
- 3D assets: code-built primitives first; any external model must be CC0/CC-BY, match the matte low-poly diagram look, be glTF ≤ 150 KB, and be listed in `public/models/CREDITS.md`.
- No React, no Tailwind, no analytics, no backend in v1.
- Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. **A click on the planet with no drag** must not launch anything or produce `NaN` in the simulation — pinned in Task 7 (`dragToLaunch` returns `null` for vectors shorter than the dead zone).
2. **`localStorage` that throws** (Safari private mode, blocked storage) must leave the scene fully working and simply not persist launches — pinned in Task 8 (throwing storage fake).
3. **WebGL unavailable** (`getContext` returns `null`, headless or old GPU) must keep the SVG fallback visible and log nothing louder than `console.info` — pinned in Task 9 (`canRenderScene` with a fake canvas).
4. **Draft posts** must never appear on the home Logbook or `/writing`, and the Logbook section must disappear entirely when there are zero published posts — pinned in Task 3 (unit tests on `publishedPosts`) and Task 14 (e2e asserts no `#logbook` and `§3` on Ground control with the shipped draft-only content).
5. **Narrow viewports (< 768 px)** must keep the hero headline and both CTAs visible above the fold and clickable, with the scene band above them — pinned in Task 14 (Playwright mobile project).

---

## File structure

```
mugar123.github.io/
├── astro.config.mjs                 site config, integrations (sitemap)
├── package.json, tsconfig.json
├── vitest.config.ts, playwright.config.ts, lighthouserc.json
├── .github/workflows/ci.yml         typecheck, unit, build, e2e, lhci on PR + push
├── .github/workflows/deploy.yml     official Astro → Pages deploy on push to main
├── scripts/
│   ├── fonts.sh                     copy + subset fonts into public/fonts
│   └── og.mjs                       render public/og.png with sharp (prebuild)
├── public/
│   ├── fonts/                       lmroman-*.woff2, jetbrains-mono-*.woff2, licenses
│   ├── models/CREDITS.md            external 3D asset ledger (empty by default)
│   ├── og.png, favicon.svg, robots.txt
├── src/
│   ├── content.config.ts            `work` and `writing` collections (Zod)
│   ├── content/work/*.md            one file per satellite
│   ├── content/writing/*.md         posts
│   ├── styles/tokens.css            color/type/space custom properties
│   ├── styles/fonts.css             @font-face declarations
│   ├── styles/global.css            reset, graph paper, typography, utilities
│   ├── lib/orbit.ts                 pure physics (simulate, elements)
│   ├── lib/launch.ts                pure: drag vector → LaunchParams | null
│   ├── lib/visitorSatellites.ts     pure: localStorage read/write with injected storage
│   ├── lib/satellites.ts            pure: work entries → scene satellites, ring radii
│   ├── lib/posts.ts                 pure: published-post filter + sort
│   ├── scene/capabilities.ts        canRenderScene(window-like) → boolean
│   ├── scene/scene.ts               mountOrbitScene(container, opts) — Three composition
│   ├── scene/planet.ts              createPlanet()
│   ├── scene/rings.ts               createRing(radius)
│   ├── scene/satelliteMesh.ts       createSatelliteMesh(kind)
│   ├── scene/OrbitScene.astro       island wrapper: data attrs, fallback, loader script
│   ├── scene/Fallback.astro         static SVG of the scene from satellite data
│   ├── layouts/Base.astro           <head>, fonts, nav, footer, grid background
│   ├── components/Nav.astro, Footer.astro, Section.astro, Hud.astro,
│   │   SatelliteCard.astro, MissionSpecs.astro, PostList.astro
│   └── pages/
│       ├── index.astro              §0–§4
│       ├── work/[slug].astro
│       ├── writing/index.astro, writing/[slug].astro
│       ├── about.astro, 404.astro, rss.xml.ts
└── tests/
    ├── unit/*.test.ts               Vitest
    └── e2e/*.spec.ts                Playwright (+ axe)
```

---

### Task 1: Scaffold the Astro project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`, `public/robots.txt`, `public/favicon.svg`, `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: an Astro project where `npm run build` writes `dist/index.html`; `npm run check` runs `astro check`.

- [ ] **Step 1: Create the project in the existing repo**

Run from `~/Developer/personal-website`:

```bash
npm create astro@latest -- . --template minimal --typescript strict --install --no-git --skip-houston
```

If the CLI refuses a non-empty directory, run it in a temp dir and move `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/`, `public/` into the repo root, keeping the existing `.claude/`, `docs/`, `.gitignore`.

- [ ] **Step 2: Pin the config**

Replace `astro.config.mjs`:

```js
// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mugar123.github.io',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'auto' },
});
```

```bash
npm i @astrojs/sitemap
npm i -D @astrojs/check typescript
```

Replace `tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strictest",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

Add scripts to `package.json`:

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check && tsc --noEmit -p tsconfig.json"
}
```

- [ ] **Step 3: Minimal page, robots, favicon, gitignore**

`src/pages/index.astro`:

```astro
---
---
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Nicolás Muñoz</title></head>
  <body><h1>Nicolás Muñoz</h1></body>
</html>
```

`public/robots.txt`:

```
User-agent: *
Allow: /
Sitemap: https://mugar123.github.io/sitemap-index.xml
```

`public/favicon.svg` (planet + ring, ink on transparent):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke="#121412" stroke-width="1.5" stroke-dasharray="2 2"/><circle cx="16" cy="16" r="6" fill="#5E6B7A"/><circle cx="30" cy="16" r="1.8" fill="#E2401C"/></svg>
```

Append to `.gitignore`:

```
.astro/
test-results/
playwright-report/
.lighthouseci/
.venv/
```

- [ ] **Step 4: Verify build and check**

```bash
npm run build && test -f dist/index.html && npm run check
```

Expected: build succeeds, `dist/index.html` exists, `astro check` reports 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro project

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Unit-test tooling (Vitest)

**Files:**
- Create: `vitest.config.ts`, `tests/unit/smoke.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` runs Vitest over `tests/unit/**/*.test.ts` with the `@/` alias.

- [ ] **Step 1: Install and configure**

```bash
npm i -D vitest
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
```

Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` scripts.

- [ ] **Step 2: Write a smoke test**

`tests/unit/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('tooling', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run**

```bash
npm test
```

Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/unit/smoke.test.ts package.json package-lock.json
git commit -m "chore: add Vitest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Content collections and seed content

**Files:**
- Create: `src/content.config.ts`, `src/content/work/papertok.md`, `src/content/work/notes-to-latex.md`, `src/content/writing/first-entry.md`, `src/lib/posts.ts`, `tests/unit/posts.test.ts`

**Interfaces:**
- Produces: collections `work` and `writing` with these schemas; `publishedPosts(entries, now)` → sorted published posts.

```ts
// work entry data
{ title: string; orbit: 'high'|'mid'|'low'; status: 'active'|'paused'|'retired';
  launched: Date; oneLiner: string; stack: string[]; links?: {label: string; url: string}[]; order: number }
// writing entry data
{ title: string; date: Date; summary: string; tags?: string[]; draft: boolean }
```

- [ ] **Step 1: Write the failing test for the post filter**

`tests/unit/posts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { publishedPosts, type PostLike } from '@/lib/posts';

const mk = (id: string, date: string, draft = false): PostLike => ({ id, data: { date: new Date(date), draft } });

describe('publishedPosts', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  it('drops drafts', () => {
    expect(publishedPosts([mk('a', '2026-01-01', true)], now)).toEqual([]);
  });
  it('drops future-dated posts', () => {
    expect(publishedPosts([mk('a', '2027-01-01')], now)).toEqual([]);
  });
  it('sorts newest first', () => {
    const r = publishedPosts([mk('old', '2026-01-01'), mk('new', '2026-09-01')], now);
    expect(r.map((p) => p.id)).toEqual(['new', 'old']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- posts
```

Expected: FAIL — cannot resolve `@/lib/posts`.

- [ ] **Step 3: Implement `posts.ts`**

`src/lib/posts.ts`:

```ts
export interface PostLike {
  id: string;
  data: { date: Date; draft: boolean };
}

export function publishedPosts<T extends PostLike>(entries: T[], now: Date = new Date()): T[] {
  return entries
    .filter((e) => !e.data.draft && e.data.date.getTime() <= now.getTime())
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- posts
```

Expected: 3 passed.

- [ ] **Step 5: Define the collections**

`src/content.config.ts`:

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string().min(1),
    orbit: z.enum(['high', 'mid', 'low']),
    status: z.enum(['active', 'paused', 'retired']),
    launched: z.coerce.date(),
    oneLiner: z.string().min(1).max(140),
    stack: z.array(z.string().min(1)).min(1),
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
    order: z.number().int(),
  }),
});

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    summary: z.string().min(1).max(200),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { work, writing };
```

- [ ] **Step 6: Seed content (copy marked for Nicolás's review)**

`src/content/work/papertok.md`:

```md
---
title: PaperTok
orbit: high
status: active
launched: 2025-06-01
oneLiner: A study app born from the way I study myself.
stack: [Product, Swift, Design]
order: 1
---

<!-- REVIEW: Nicolás to replace with the real story, dates and links. -->

## Problem

Studying from long notes is slow. I wanted the parts of my notes that matter, in a format I would actually open.

## What I built

PaperTok turns study material into short, visual cards. I designed the product, built the app and shipped it.

## Outcome

Live, with real users. Dates, numbers and store link to be added.
```

`src/content/work/notes-to-latex.md`:

```md
---
title: Notes → LaTeX pipeline
orbit: mid
status: active
launched: 2026-02-01
oneLiner: Handwritten notes transcribed to compiled LaTeX, automatically.
stack: [Python, Open + closed models, OCR, LaTeX]
order: 2
---

<!-- REVIEW: Nicolás to replace with the real architecture and examples. -->

## Problem

My physics notes live on paper. Typing them into LaTeX by hand costs more than the notes are worth.

## What I built

A Python pipeline that photographs a page, runs it through a mix of open-source and closed models, and emits LaTeX that compiles. Open models handle layout and segmentation; closed models handle the hard transcription cases.

## Outcome

My own notes, compiled and searchable. Repo link and sample output to be added.
```

`src/content/writing/first-entry.md`:

```md
---
title: Why my notes compile now
date: 2026-10-15
summary: Notes on building a notes-to-LaTeX pipeline with open and closed models.
tags: [python, latex, ml]
draft: true
---

<!-- REVIEW: draft. The Logbook stays hidden until a post has draft: false. -->

Draft.
```

- [ ] **Step 7: Verify the schemas validate at build**

```bash
npm run build
```

Expected: build succeeds. Then break it on purpose: change `orbit: high` to `orbit: geostationary` in `papertok.md`, run `npm run build`, expect a Zod error naming `orbit`; revert.

- [ ] **Step 8: Commit**

```bash
git add src/content.config.ts src/content src/lib/posts.ts tests/unit/posts.test.ts
git commit -m "feat: content collections for work and writing

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Fonts and design tokens

**Files:**
- Create: `scripts/fonts.sh`, `public/fonts/` (generated), `src/styles/tokens.css`, `src/styles/fonts.css`, `src/styles/global.css`
- Modify: `package.json`

**Interfaces:**
- Produces: CSS custom properties listed below, consumed by every component; `@font-face` for `Latin Modern` (400, 400 italic, 700) and `JetBrains Mono` (400).

- [ ] **Step 1: Install font packages**

```bash
npm i -D @typopro/web-latin-modern@3.7.5 @fontsource/jetbrains-mono@5.3.0
```

- [ ] **Step 2: Write the font script**

`scripts/fonts.sh`:

```bash
#!/usr/bin/env bash
# Copies Latin Modern Roman and JetBrains Mono into public/fonts.
# Converts Latin Modern to subsetted WOFF2 when fonttools is available; falls back to WOFF.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/fonts
mkdir -p "$OUT"
LM=node_modules/@typopro/web-latin-modern
JB=node_modules/@fontsource/jetbrains-mono/files

cp "$LM/TypoPRO-LatinModern.txt" "$OUT/LICENSE-latin-modern.txt"
cp node_modules/@fontsource/jetbrains-mono/LICENSE "$OUT/LICENSE-jetbrains-mono.txt"
cp "$JB/jetbrains-mono-latin-400-normal.woff2" "$OUT/jetbrains-mono-400.woff2"

UNICODES="U+0020-007E,U+00A0-00FF,U+00A7,U+2013-2014,U+2018-201D,U+2026,U+2192,U+221A,U+2080-2089"
declare -A MAP=( [Regular]=lmroman-400 [Italic]=lmroman-400-italic [Bold]=lmroman-700 )
for style in "${!MAP[@]}"; do
  src="$LM/TypoPRO-LatinModernRoman-$style.woff"
  dst="$OUT/${MAP[$style]}"
  if command -v pyftsubset >/dev/null 2>&1; then
    pyftsubset "$src" --flavor=woff2 --unicodes="$UNICODES" --layout-features='*' --output-file="$dst.woff2"
  else
    echo "pyftsubset not found; copying WOFF for $style (install: python3 -m venv .venv && .venv/bin/pip install fonttools brotli)"
    cp "$src" "$dst.woff"
  fi
done
ls -la "$OUT"
```

```bash
chmod +x scripts/fonts.sh
python3 -m venv .venv && .venv/bin/pip install -q fonttools brotli
PATH="$PWD/.venv/bin:$PATH" ./scripts/fonts.sh
```

Expected: `public/fonts/` contains `lmroman-400.woff2`, `lmroman-400-italic.woff2`, `lmroman-700.woff2` (each well under 100 KB), `jetbrains-mono-400.woff2`, two license files. Add `"fonts": "./scripts/fonts.sh"` to `package.json` scripts. `public/fonts/*.woff2` is committed (fonts are build inputs, not outputs).

- [ ] **Step 3: Tokens**

`src/styles/tokens.css`:

```css
:root {
  --paper: #F2F3F1;
  --grid: #DADDD8;
  --ink: #121412;
  --ink-2: #6E736D;
  --accent: #E2401C;
  --planet: #5E6B7A;
  --planet-hi: #7B8898;
  --surface: #FFFFFF;

  --font-serif: 'Latin Modern', 'Latin Modern Roman', 'CMU Serif', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  --text-body: 1.1875rem;      /* 19px */
  --text-small: 1rem;
  --text-label: 0.75rem;       /* 12px mono labels */
  --text-h1: clamp(2.25rem, 5vw + 1rem, 4.5rem);
  --text-h2: clamp(1.5rem, 2vw + 1rem, 2.25rem);
  --leading-body: 1.65;

  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 1rem; --space-4: 1.5rem;
  --space-5: 2.5rem; --space-6: 4rem; --space-7: 6rem;
  --measure: 68ch;
  --grid-cell: 24px;
  --content-max: 72rem;

  --dur: 300ms;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
}
```

- [ ] **Step 4: Font faces**

`src/styles/fonts.css`:

```css
@font-face { font-family: 'Latin Modern'; font-style: normal; font-weight: 400; font-display: swap;
  src: url('/fonts/lmroman-400.woff2') format('woff2'); }
@font-face { font-family: 'Latin Modern'; font-style: italic; font-weight: 400; font-display: swap;
  src: url('/fonts/lmroman-400-italic.woff2') format('woff2'); }
@font-face { font-family: 'Latin Modern'; font-style: normal; font-weight: 700; font-display: swap;
  src: url('/fonts/lmroman-700.woff2') format('woff2'); }
@font-face { font-family: 'JetBrains Mono'; font-style: normal; font-weight: 400; font-display: swap;
  src: url('/fonts/jetbrains-mono-400.woff2') format('woff2'); }
/* Size-adjusted fallback so the swap does not shift layout. */
@font-face { font-family: 'Latin Modern Fallback'; src: local('Georgia'); size-adjust: 104%; ascent-override: 92%; descent-override: 26%; }
```

If the script fell back to `.woff`, change the three `url()`s and `format('woff')` accordingly.

- [ ] **Step 5: Global styles**

`src/styles/global.css`:

```css
@import './tokens.css';
@import './fonts.css';

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  color: var(--ink);
  background-color: var(--paper);
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: var(--grid-cell) var(--grid-cell);
  font-family: var(--font-serif), 'Latin Modern Fallback';
  font-size: var(--text-body);
  line-height: var(--leading-body);
}
h1, h2, h3 { font-weight: 400; line-height: 1.1; margin: 0 0 var(--space-3); letter-spacing: -0.01em; }
h1 { font-size: var(--text-h1); }
h2 { font-size: var(--text-h2); }
p { margin: 0 0 var(--space-3); max-width: var(--measure); }
a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 0.15em; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.mono {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-2);
}
.mono--ink { color: var(--ink); }
.accent { color: var(--accent); }
.container { width: min(100% - 2 * var(--space-4), var(--content-max)); margin-inline: auto; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* Spec §4.3 motion: hero copy fades in (CSS only) and sections reveal on scroll via CSS scroll-driven
   animations where supported. No JavaScript involved; browsers without support show content at rest. */
@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.rise { animation: rise var(--dur) var(--ease) both; }
@supports (animation-timeline: view()) {
  .reveal { animation: rise linear both; animation-timeline: view(); animation-range: entry 0% entry 30%; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  .reveal { animation: none; }
}
```

- [ ] **Step 6: Wire into the page and verify**

In `src/pages/index.astro` frontmatter add `import '@/styles/global.css';`. Run `npm run dev`, open the page, confirm graph paper background and serif heading. Then:

```bash
npm run build && grep -c "lmroman-400.woff2" dist/index.html
```

Expected: count ≥ 1 (inlined CSS references the font).

- [ ] **Step 7: Commit**

```bash
git add scripts/fonts.sh public/fonts src/styles src/pages/index.astro package.json package-lock.json .gitignore
git commit -m "feat: self-hosted fonts and design tokens

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Layout shell — Base, Nav, Footer, Section, Hud

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`, `src/components/Section.astro`, `src/components/Hud.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Produces: `<Base title description? ogImage?>` with a default slot; `<Section num="1" id="in-orbit" title="…">`; `<Hud>` inline mono chip (slot) with optional `accent` boolean.

- [ ] **Step 1: Base layout**

`src/layouts/Base.astro`:

```astro
---
import '@/styles/global.css';
import Nav from '@/components/Nav.astro';
import Footer from '@/components/Footer.astro';

interface Props { title: string; description?: string; ogImage?: string }
const { title, description = 'Physics student at Salamanca who already ships products.', ogImage = '/og.png' } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
const buildDate = new Date().toISOString().slice(0, 10);
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="alternate" type="application/rss+xml" title="Nicolás Muñoz — Logbook" href="/rss.xml" />
    <link rel="preload" href="/fonts/lmroman-400.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/jetbrains-mono-400.woff2" as="font" type="font/woff2" crossorigin />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={new URL(ogImage, Astro.site)} />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="generator" content={Astro.generator} />
  </head>
  <body>
    <a class="skip visually-hidden" href="#main">Skip to content</a>
    <Nav />
    <main id="main">
      <slot />
    </main>
    <Footer buildDate={buildDate} />
  </body>
</html>
<style>
  .skip:focus { position: fixed; inset: var(--space-3) auto auto var(--space-3); width: auto; height: auto; clip: auto; padding: var(--space-2) var(--space-3); background: var(--surface); border: 1px solid var(--ink); z-index: 10; }
</style>
```

- [ ] **Step 2: Nav**

`src/components/Nav.astro`:

```astro
---
const path = Astro.url.pathname;
const items = [
  { href: '/#in-orbit', label: 'Work' },
  { href: '/writing', label: 'Writing' },
  { href: '/about', label: 'About' },
];
---
<nav class="nav container" aria-label="Primary">
  <a class="mono mono--ink" href="/">Nicolás Muñoz</a>
  <ul>
    {items.map((i) => (
      <li><a class="mono" href={i.href} aria-current={path.startsWith(i.href.split('#')[0]) && i.href !== '/#in-orbit' ? 'page' : undefined}>{i.label}</a></li>
    ))}
  </ul>
</nav>
<style>
  .nav { display: flex; justify-content: space-between; align-items: center; padding-block: var(--space-4); }
  ul { display: flex; gap: var(--space-4); list-style: none; margin: 0; padding: 0; }
  a { text-decoration: none; }
  a:hover, a[aria-current="page"] { color: var(--ink); text-decoration: underline; }
</style>
```

- [ ] **Step 3: Footer**

`src/components/Footer.astro`:

```astro
---
interface Props { buildDate: string }
const { buildDate } = Astro.props;
---
<footer class="container">
  <span class="mono">Salamanca · 40.96° N, 5.67° W · CET</span>
  <span class="mono">Last updated {buildDate}</span>
</footer>
<style>
  footer { display: flex; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; padding-block: var(--space-6) var(--space-5); border-top: 1px solid var(--grid); margin-top: var(--space-7); }
</style>
```

- [ ] **Step 4: Section and Hud**

`src/components/Section.astro`:

```astro
---
interface Props { num: string; id: string; title: string; label: string }
const { num, id, title, label } = Astro.props;
---
<section class="section container reveal" id={id} aria-labelledby={`${id}-title`}>
  <p class="mono">§{num} · {label}</p>
  <h2 id={`${id}-title`}>{title}</h2>
  <slot />
</section>
<style>
  .section { padding-block: var(--space-6); }
  .section > .mono { margin: 0 0 var(--space-2); }
</style>
```

`src/components/Hud.astro`:

```astro
---
interface Props { accent?: boolean; as?: 'span' | 'div' }
const { accent = false, as: Tag = 'span' } = Astro.props;
---
<Tag class:list={['hud', 'mono', { 'hud--accent': accent }]}><slot /></Tag>
<style>
  .hud { display: inline-block; padding: 0.2em 0.6em; border: 1px solid var(--ink); background: var(--surface); color: var(--ink); }
  .hud--accent { border-color: var(--accent); color: var(--accent); }
</style>
```

- [ ] **Step 5: Use the layout on the home page**

`src/pages/index.astro`:

```astro
---
import Base from '@/layouts/Base.astro';
import Section from '@/components/Section.astro';
---
<Base title="Nicolás Muñoz — Physics student at Salamanca, already in orbit">
  <Section num="0" id="abstract" label="Abstract" title="Physics student at Salamanca. Already in orbit.">
    <p>Placeholder hero; replaced in Task 11.</p>
  </Section>
</Base>
```

- [ ] **Step 6: Verify**

```bash
npm run build && grep -o '<nav[^>]*>' dist/index.html && grep -o 'Last updated [0-9-]*' dist/index.html
```

Expected: both greps print a match. Visually check at `npm run dev`: nav, graph paper, serif h2, mono §0 label, footer.

- [ ] **Step 7: Commit**

```bash
git add src/layouts src/components src/pages/index.astro
git commit -m "feat: base layout, nav, footer, section and hud components

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Orbital mechanics module (`orbit.ts`)

**Files:**
- Create: `src/lib/orbit.ts`, `tests/unit/orbit.test.ts`

**Interfaces:**
- Produces (used by Tasks 7, 9, 10):

```ts
export type Outcome = 'suborbital' | 'orbit' | 'escape';
export interface LaunchParams { angle: number; speed: number } // angle (rad) from local horizontal at launch point (1,0); 0 = prograde tangential; speed in units of circular speed at r = 1
export interface Point { x: number; y: number }
export interface Simulation { points: Point[]; outcome: Outcome; energy: number; periapsis: number; apoapsis: number | null; period: number | null }
export const ESCAPE_SPEED: number; // Math.SQRT2
export function circularSpeed(r: number): number;
export function escapeSpeed(r: number): number;
export function orbitalElements(p: LaunchParams): { energy: number; a: number | null; e: number; rp: number; ra: number | null };
export function simulate(p: LaunchParams, opts?: { dt?: number; maxSteps?: number; bound?: number }): Simulation;
```

Units: planet radius R = 1, GM = 1. Launch point is (1, 0); local horizontal is +y (counter-clockwise prograde), radial is +x.

- [ ] **Step 1: Write the failing tests**

`tests/unit/orbit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { simulate, orbitalElements, circularSpeed, escapeSpeed, ESCAPE_SPEED } from '@/lib/orbit';

const maxR = (pts: { x: number; y: number }[]) => Math.max(...pts.map((p) => Math.hypot(p.x, p.y)));
const minR = (pts: { x: number; y: number }[]) => Math.min(...pts.map((p) => Math.hypot(p.x, p.y)));

describe('speeds', () => {
  it('circular speed at r=1 is 1 and escape is sqrt(2)', () => {
    expect(circularSpeed(1)).toBeCloseTo(1, 12);
    expect(escapeSpeed(1)).toBeCloseTo(Math.SQRT2, 12);
    expect(ESCAPE_SPEED).toBeCloseTo(Math.SQRT2, 12);
    expect(circularSpeed(4)).toBeCloseTo(0.5, 12);
  });
});

describe('orbitalElements', () => {
  it('tangential launch at v=1.2 gives rp=1 and ra=2a-1', () => {
    const el = orbitalElements({ angle: 0, speed: 1.2 });
    expect(el.energy).toBeCloseTo(0.72 - 1, 12);
    expect(el.a).toBeCloseTo(1 / (2 * 0.28), 6);
    expect(el.rp).toBeCloseTo(1, 6);
    expect(el.ra).toBeCloseTo(2 * (1 / (2 * 0.28)) - 1, 6);
  });
  it('escape has non-negative energy and null a/ra', () => {
    const el = orbitalElements({ angle: 0, speed: 1.5 });
    expect(el.energy).toBeGreaterThanOrEqual(0);
    expect(el.a).toBeNull();
    expect(el.ra).toBeNull();
  });
});

describe('simulate', () => {
  it('circular speed produces a closed orbit at r≈1', () => {
    const s = simulate({ angle: 0, speed: 1 });
    expect(s.outcome).toBe('orbit');
    expect(maxR(s.points)).toBeLessThan(1.01);
    expect(minR(s.points)).toBeGreaterThan(0.99);
    expect(s.period).toBeCloseTo(2 * Math.PI, 1);
  });
  it('too slow falls back to the surface', () => {
    const s = simulate({ angle: 0, speed: 0.5 });
    expect(s.outcome).toBe('suborbital');
    expect(Math.hypot(s.points.at(-1)!.x, s.points.at(-1)!.y)).toBeLessThanOrEqual(1.001);
  });
  it('above escape speed leaves the bound', () => {
    const s = simulate({ angle: 0, speed: 1.5 }, { bound: 8 });
    expect(s.outcome).toBe('escape');
    expect(maxR(s.points)).toBeGreaterThanOrEqual(8);
  });
  it('elliptical orbit reaches the analytic apoapsis', () => {
    const s = simulate({ angle: 0, speed: 1.2 });
    expect(s.outcome).toBe('orbit');
    expect(maxR(s.points)).toBeCloseTo(2 * (1 / (2 * 0.28)) - 1, 1);
    expect(s.apoapsis).toBeCloseTo(maxR(s.points), 2);
  });
  it('radial launch straight up falls back', () => {
    const s = simulate({ angle: Math.PI / 2, speed: 1 });
    expect(s.outcome).toBe('suborbital');
  });
  it('conserves energy to 1e-6 over one orbit', () => {
    const s = simulate({ angle: 0.3, speed: 1.1 });
    expect(s.outcome).toBe('orbit');
    // energy is computed from the integrator's final state inside simulate
    expect(Math.abs(s.energy - orbitalElements({ angle: 0.3, speed: 1.1 }).energy)).toBeLessThan(1e-6);
  });
  it('never returns NaN points', () => {
    const s = simulate({ angle: -1.2, speed: 1.7 });
    expect(s.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- orbit
```

Expected: FAIL — cannot resolve `@/lib/orbit`.

- [ ] **Step 3: Implement**

`src/lib/orbit.ts`:

```ts
/**
 * Two-body motion around a planet of radius 1 with GM = 1.
 * Launch point is (1, 0). Local horizontal is +y (prograde), radial is +x.
 * Pure functions only — no DOM, no Three.
 */
export type Outcome = 'suborbital' | 'orbit' | 'escape';
export interface LaunchParams { angle: number; speed: number }
export interface Point { x: number; y: number }
export interface Simulation {
  points: Point[];
  outcome: Outcome;
  energy: number;
  periapsis: number;
  apoapsis: number | null;
  period: number | null;
}

export const ESCAPE_SPEED = Math.SQRT2;
export const circularSpeed = (r: number): number => 1 / Math.sqrt(r);
export const escapeSpeed = (r: number): number => Math.sqrt(2 / r);

interface State { x: number; y: number; vx: number; vy: number }

function initialState({ angle, speed }: LaunchParams): State {
  return { x: 1, y: 0, vx: speed * Math.sin(angle), vy: speed * Math.cos(angle) };
}

function accel(x: number, y: number): [number, number] {
  const r2 = x * x + y * y;
  const r3 = r2 * Math.sqrt(r2);
  return [-x / r3, -y / r3];
}

/** One RK4 step of the equations of motion. */
function rk4(s: State, dt: number): State {
  const k1 = deriv(s);
  const k2 = deriv(add(s, k1, dt / 2));
  const k3 = deriv(add(s, k2, dt / 2));
  const k4 = deriv(add(s, k3, dt));
  return {
    x: s.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: s.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    vx: s.vx + (dt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
    vy: s.vy + (dt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
  };
}
function deriv(s: State): State {
  const [ax, ay] = accel(s.x, s.y);
  return { x: s.vx, y: s.vy, vx: ax, vy: ay };
}
function add(s: State, d: State, h: number): State {
  return { x: s.x + d.x * h, y: s.y + d.y * h, vx: s.vx + d.vx * h, vy: s.vy + d.vy * h };
}

export function specificEnergy(s: State): number {
  return (s.vx * s.vx + s.vy * s.vy) / 2 - 1 / Math.hypot(s.x, s.y);
}

export function orbitalElements(p: LaunchParams) {
  const s = initialState(p);
  const energy = specificEnergy(s);
  const h = s.x * s.vy - s.y * s.vx; // specific angular momentum (z)
  const e = Math.sqrt(Math.max(0, 1 + 2 * energy * h * h));
  const rp = (h * h) / (1 + e);
  if (energy >= 0) return { energy, a: null, e, rp, ra: null };
  const a = -1 / (2 * energy);
  return { energy, a, e, rp, ra: a * (1 + e) };
}

export function simulate(
  p: LaunchParams,
  { dt = 0.005, maxSteps = 40000, bound = 8 }: { dt?: number; maxSteps?: number; bound?: number } = {},
): Simulation {
  let s = initialState(p);
  const points: Point[] = [{ x: s.x, y: s.y }];
  const energy = specificEnergy(s);
  let swept = 0;
  let prevTheta = Math.atan2(s.y, s.x);
  let rMin = 1;
  let rMax = 1;
  let outcome: Outcome | null = null;
  let steps = 0;

  while (outcome === null && steps < maxSteps) {
    s = rk4(s, dt);
    steps++;
    const r = Math.hypot(s.x, s.y);
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
    const theta = Math.atan2(s.y, s.x);
    let d = theta - prevTheta;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    swept += d;
    prevTheta = theta;

    if (r <= 1) {
      // Clamp the last point onto the surface so the drawn path ends on the planet.
      points.push({ x: s.x / r, y: s.y / r });
      outcome = 'suborbital';
      break;
    }
    points.push({ x: s.x, y: s.y });
    if (energy >= 0 && r >= bound) outcome = 'escape';
    else if (energy < 0 && Math.abs(swept) >= 2 * Math.PI) outcome = 'orbit';
  }

  if (outcome === null) outcome = energy >= 0 ? 'escape' : 'orbit';
  const period = outcome === 'orbit' ? steps * dt : null;
  return {
    points,
    outcome,
    energy: specificEnergy(s),
    periapsis: rMin,
    apoapsis: outcome === 'orbit' ? rMax : null,
    period,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- orbit
```

Expected: all `orbit.test.ts` tests pass. If the energy test fails by more than `1e-6`, lower `dt` to `0.002` (RK4 error ∝ dt⁴).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orbit.ts tests/unit/orbit.test.ts
git commit -m "feat(orbit): pure two-body simulation with outcome detection

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Drag-to-launch mapping (`launch.ts`)

**Files:**
- Create: `src/lib/launch.ts`, `tests/unit/launch.test.ts`

**Interfaces:**
- Consumes: `LaunchParams` from Task 6.
- Produces: `dragToLaunch(d: {tangential: number; radial: number}, opts?): LaunchParams | null`, constants `MIN_SPEED = 0.3`, `MAX_SPEED = 1.8`, `DEAD_ZONE = 0.08` (scene units), `formatSpeed(speed): string` → e.g. `"1.21 v₀"`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/launch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dragToLaunch, formatSpeed, MIN_SPEED, MAX_SPEED, DEAD_ZONE } from '@/lib/launch';

describe('dragToLaunch', () => {
  it('returns null inside the dead zone (a click is not a launch)', () => {
    expect(dragToLaunch({ tangential: 0, radial: 0 })).toBeNull();
    expect(dragToLaunch({ tangential: DEAD_ZONE / 2, radial: 0 })).toBeNull();
  });
  it('maps a unit tangential drag to angle 0, speed 1', () => {
    const p = dragToLaunch({ tangential: 1, radial: 0 })!;
    expect(p.angle).toBeCloseTo(0, 12);
    expect(p.speed).toBeCloseTo(1, 12);
  });
  it('maps a radial drag to angle π/2', () => {
    expect(dragToLaunch({ tangential: 0, radial: 1 })!.angle).toBeCloseTo(Math.PI / 2, 12);
  });
  it('allows retrograde launches (angle beyond ±π/2)', () => {
    expect(Math.abs(dragToLaunch({ tangential: -1, radial: 0 })!.angle)).toBeCloseTo(Math.PI, 12);
  });
  it('clamps speed to [MIN_SPEED, MAX_SPEED]', () => {
    expect(dragToLaunch({ tangential: 0.1, radial: 0 })!.speed).toBe(MIN_SPEED);
    expect(dragToLaunch({ tangential: 5, radial: 0 })!.speed).toBe(MAX_SPEED);
  });
  it('never yields NaN', () => {
    const p = dragToLaunch({ tangential: 1e-9, radial: 1e-9 });
    expect(p === null || (Number.isFinite(p.angle) && Number.isFinite(p.speed))).toBe(true);
  });
});

describe('formatSpeed', () => {
  it('formats to two decimals with the v₀ unit', () => {
    expect(formatSpeed(1.2149)).toBe('1.21 v₀');
    expect(formatSpeed(Math.SQRT2)).toBe('1.41 v₀');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- launch
```

Expected: FAIL — cannot resolve `@/lib/launch`.

- [ ] **Step 3: Implement**

`src/lib/launch.ts`:

```ts
import type { LaunchParams } from './orbit';

export const MIN_SPEED = 0.3;
export const MAX_SPEED = 1.8;
export const DEAD_ZONE = 0.08;

export interface DragVector { tangential: number; radial: number }

/** Maps a drag vector in the orbital plane (scene units) to launch parameters. One scene unit of drag = one unit of speed. */
export function dragToLaunch(d: DragVector, { scale = 1 }: { scale?: number } = {}): LaunchParams | null {
  const len = Math.hypot(d.tangential, d.radial);
  if (!Number.isFinite(len) || len < DEAD_ZONE) return null;
  const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, len * scale));
  const angle = Math.atan2(d.radial, d.tangential);
  return { angle, speed };
}

export function formatSpeed(speed: number): string {
  return `${speed.toFixed(2)} v₀`;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- launch
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/launch.ts tests/unit/launch.test.ts
git commit -m "feat(launch): map drag vectors to launch parameters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Visitor satellites persistence and scene data mapping

**Files:**
- Create: `src/lib/visitorSatellites.ts`, `src/lib/satellites.ts`, `tests/unit/visitorSatellites.test.ts`, `tests/unit/satellites.test.ts`

**Interfaces:**
- Consumes: `LaunchParams` (Task 6); `work` entry shape (Task 3).
- Produces:

```ts
// visitorSatellites.ts
export interface VisitorSatellite { angle: number; speed: number; launchedAt: number }
export const STORAGE_KEY = 'orbit:visitor-satellites';
export const MAX_VISITOR_SATELLITES = 3;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export function loadVisitorSatellites(storage: StorageLike | null | undefined): VisitorSatellite[];
export function saveVisitorSatellite(storage: StorageLike | null | undefined, sat: VisitorSatellite): VisitorSatellite[];

// satellites.ts
export type Orbit = 'high' | 'mid' | 'low';
export const ORBIT_RADIUS: Record<Orbit, number>; // high 3.2, mid 2.2, low 1.5
export interface SceneSatellite { id: string; name: string; orbit: Orbit; status: 'active'|'paused'|'retired'; href: string; phase: number }
export interface WorkEntryLike { id: string; data: { title: string; orbit: Orbit; status: 'active'|'paused'|'retired'; order: number } }
export function toSceneSatellites(entries: WorkEntryLike[]): SceneSatellite[];
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/visitorSatellites.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadVisitorSatellites, saveVisitorSatellite, STORAGE_KEY, MAX_VISITOR_SATELLITES } from '@/lib/visitorSatellites';

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), dump: () => Object.fromEntries(m) };
}
const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
const sat = (n: number) => ({ angle: 0.1 * n, speed: 1 + 0.1 * n, launchedAt: n });

describe('loadVisitorSatellites', () => {
  it('returns [] when storage is missing', () => expect(loadVisitorSatellites(null)).toEqual([]));
  it('returns [] when storage throws', () => expect(loadVisitorSatellites(throwing)).toEqual([]));
  it('returns [] on corrupted JSON', () => expect(loadVisitorSatellites(memoryStorage({ [STORAGE_KEY]: '{nope' }))).toEqual([]));
  it('drops malformed entries', () => {
    const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify([sat(1), { angle: 'x' }, null]) });
    expect(loadVisitorSatellites(s)).toEqual([sat(1)]);
  });
});

describe('saveVisitorSatellite', () => {
  it('prepends and caps at MAX', () => {
    const s = memoryStorage();
    for (let i = 1; i <= MAX_VISITOR_SATELLITES + 2; i++) saveVisitorSatellite(s, sat(i));
    const out = loadVisitorSatellites(s);
    expect(out).toHaveLength(MAX_VISITOR_SATELLITES);
    expect(out[0]).toEqual(sat(MAX_VISITOR_SATELLITES + 2));
  });
  it('returns the new list even when storage throws', () => {
    expect(saveVisitorSatellite(throwing, sat(1))).toEqual([sat(1)]);
  });
});
```

`tests/unit/satellites.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toSceneSatellites, ORBIT_RADIUS } from '@/lib/satellites';

const e = (id: string, orbit: 'high' | 'mid' | 'low', order: number) => ({ id, data: { title: id, orbit, status: 'active' as const, order } });

describe('toSceneSatellites', () => {
  it('ring radii decrease from high to low', () => {
    expect(ORBIT_RADIUS.high).toBeGreaterThan(ORBIT_RADIUS.mid);
    expect(ORBIT_RADIUS.mid).toBeGreaterThan(ORBIT_RADIUS.low);
    expect(ORBIT_RADIUS.low).toBeGreaterThan(1);
  });
  it('sorts by order and builds hrefs', () => {
    const out = toSceneSatellites([e('b', 'mid', 2), e('a', 'high', 1)]);
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
    expect(out[0].href).toBe('/work/a');
  });
  it('spreads satellites sharing a ring evenly in phase', () => {
    const out = toSceneSatellites([e('a', 'mid', 1), e('b', 'mid', 2), e('c', 'mid', 3)]);
    const phases = out.map((s) => s.phase);
    expect(phases[0]).toBeCloseTo(0, 12);
    expect(phases[1]).toBeCloseTo((2 * Math.PI) / 3, 12);
    expect(phases[2]).toBeCloseTo((4 * Math.PI) / 3, 12);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- visitorSatellites satellites
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/lib/visitorSatellites.ts`:

```ts
export interface VisitorSatellite { angle: number; speed: number; launchedAt: number }
export const STORAGE_KEY = 'orbit:visitor-satellites';
export const MAX_VISITOR_SATELLITES = 3;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function isSat(v: unknown): v is VisitorSatellite {
  return typeof v === 'object' && v !== null
    && Number.isFinite((v as VisitorSatellite).angle)
    && Number.isFinite((v as VisitorSatellite).speed)
    && Number.isFinite((v as VisitorSatellite).launchedAt);
}

export function loadVisitorSatellites(storage: StorageLike | null | undefined): VisitorSatellite[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSat).slice(0, MAX_VISITOR_SATELLITES) : [];
  } catch {
    return [];
  }
}

export function saveVisitorSatellite(storage: StorageLike | null | undefined, sat: VisitorSatellite): VisitorSatellite[] {
  const next = [sat, ...loadVisitorSatellites(storage)].slice(0, MAX_VISITOR_SATELLITES);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the scene still shows the satellite for this visit */
  }
  return next;
}
```

`src/lib/satellites.ts`:

```ts
export type Orbit = 'high' | 'mid' | 'low';
export type Status = 'active' | 'paused' | 'retired';
export const ORBIT_RADIUS: Record<Orbit, number> = { high: 3.2, mid: 2.2, low: 1.5 };

export interface SceneSatellite { id: string; name: string; orbit: Orbit; status: Status; href: string; phase: number }
export interface WorkEntryLike { id: string; data: { title: string; orbit: Orbit; status: Status; order: number } }

export function toSceneSatellites(entries: WorkEntryLike[]): SceneSatellite[] {
  const sorted = [...entries].sort((a, b) => a.data.order - b.data.order);
  const perRing = new Map<Orbit, number>();
  for (const e of sorted) perRing.set(e.data.orbit, (perRing.get(e.data.orbit) ?? 0) + 1);
  const seen = new Map<Orbit, number>();
  return sorted.map((e) => {
    const i = seen.get(e.data.orbit) ?? 0;
    seen.set(e.data.orbit, i + 1);
    const n = perRing.get(e.data.orbit) ?? 1;
    return { id: e.id, name: e.data.title, orbit: e.data.orbit, status: e.data.status, href: `/work/${e.id}`, phase: (2 * Math.PI * i) / n };
  });
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test
```

Expected: all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visitorSatellites.ts src/lib/satellites.ts tests/unit/visitorSatellites.test.ts tests/unit/satellites.test.ts
git commit -m "feat: visitor satellite persistence and scene data mapping

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Scene capabilities check and SVG fallback

**Files:**
- Create: `src/scene/capabilities.ts`, `tests/unit/capabilities.test.ts`, `src/scene/Fallback.astro`

**Interfaces:**
- Consumes: `SceneSatellite`, `ORBIT_RADIUS` (Task 8).
- Produces: `canRenderScene(env: EnvLike): boolean`; `<Fallback satellites={SceneSatellite[]} />` renders an inline `<svg>` with `data-fallback`.

```ts
export interface EnvLike {
  matchMedia?: (q: string) => { matches: boolean };
  createCanvas: () => { getContext: (id: string) => unknown } | null;
  connection?: { saveData?: boolean };
}
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/capabilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { canRenderScene } from '@/scene/capabilities';

const canvas = (ok: boolean) => () => ({ getContext: () => (ok ? {} : null) });
const mm = (reduce: boolean) => (q: string) => ({ matches: q.includes('reduce') ? reduce : false });

describe('canRenderScene', () => {
  it('true with WebGL, no reduced motion, no save-data', () => {
    expect(canRenderScene({ createCanvas: canvas(true), matchMedia: mm(false) })).toBe(true);
  });
  it('false when getContext returns null', () => {
    expect(canRenderScene({ createCanvas: canvas(false), matchMedia: mm(false) })).toBe(false);
  });
  it('false when createCanvas throws or returns null', () => {
    expect(canRenderScene({ createCanvas: () => null, matchMedia: mm(false) })).toBe(false);
    expect(canRenderScene({ createCanvas: () => { throw new Error('x'); }, matchMedia: mm(false) })).toBe(false);
  });
  it('false under prefers-reduced-motion', () => {
    expect(canRenderScene({ createCanvas: canvas(true), matchMedia: mm(true) })).toBe(false);
  });
  it('false when the connection asks to save data', () => {
    expect(canRenderScene({ createCanvas: canvas(true), matchMedia: mm(false), connection: { saveData: true } })).toBe(false);
  });
  it('true when matchMedia is unavailable (old browsers) but WebGL works', () => {
    expect(canRenderScene({ createCanvas: canvas(true) })).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- capabilities
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/scene/capabilities.ts`:

```ts
export interface EnvLike {
  matchMedia?: (q: string) => { matches: boolean };
  createCanvas: () => { getContext: (id: string) => unknown } | null;
  connection?: { saveData?: boolean };
}

export function canRenderScene(env: EnvLike): boolean {
  if (env.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (env.connection?.saveData) return false;
  try {
    const c = env.createCanvas();
    if (!c) return false;
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Browser adapter. */
export function browserEnv(w: Window = window): EnvLike {
  return {
    matchMedia: w.matchMedia?.bind(w),
    createCanvas: () => w.document.createElement('canvas'),
    connection: (w.navigator as Navigator & { connection?: { saveData?: boolean } }).connection,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- capabilities
```

Expected: 6 passed.

- [ ] **Step 5: SVG fallback component**

`src/scene/Fallback.astro` — same geometry as the 3D scene, projected: rings are ellipses with `ry = rx * 0.38`, planet radius 1, scene units × 40 px.

```astro
---
import type { SceneSatellite } from '@/lib/satellites';
import { ORBIT_RADIUS } from '@/lib/satellites';
interface Props { satellites: SceneSatellite[] }
const { satellites } = Astro.props;
const U = 40; const cx = 160; const cy = 150; const squash = 0.38;
const rings = (['high', 'mid', 'low'] as const).map((o) => ({ o, r: ORBIT_RADIUS[o] * U }));
const pos = (s: SceneSatellite) => {
  const r = ORBIT_RADIUS[s.orbit] * U;
  return { x: cx + r * Math.cos(s.phase), y: cy + r * squash * Math.sin(s.phase) };
};
---
<svg class="fallback" data-fallback viewBox="0 0 320 300" role="img" aria-labelledby="fb-title fb-desc">
  <title id="fb-title">Planet with project satellites in orbit</title>
  <desc id="fb-desc">{satellites.map((s) => `${s.name} in ${s.orbit} orbit`).join('; ')}.</desc>
  {rings.map(({ r }) => <ellipse cx={cx} cy={cy} rx={r} ry={r * squash} fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 4" />)}
  <circle cx={cx} cy={cy} r={U} fill="var(--planet)" />
  <circle cx={cx - 10} cy={cy - 12} r={U * 0.8} fill="var(--planet-hi)" opacity="0.45" />
  {satellites.map((s) => { const p = pos(s); return (
    <g>
      <circle cx={p.x} cy={p.y} r={s.status === 'active' ? 5 : 4} fill={s.status === 'active' ? 'var(--accent)' : 'var(--ink)'} />
      <text x={p.x + 9} y={p.y + 4} font-family="var(--font-mono)" font-size="9" fill="var(--ink-2)">{s.name.toUpperCase()}</text>
    </g>
  ); })}
</svg>
<style>
  .fallback { width: 100%; height: 100%; display: block; }
</style>
```

- [ ] **Step 6: Commit**

```bash
git add src/scene/capabilities.ts tests/unit/capabilities.test.ts src/scene/Fallback.astro
git commit -m "feat(scene): capability check and static SVG fallback

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Three.js scene — planet, rings, satellites, drag-to-launch

**Files:**
- Create: `src/scene/planet.ts`, `src/scene/rings.ts`, `src/scene/satelliteMesh.ts`, `src/scene/scene.ts`, `src/scene/OrbitScene.astro`
- Modify: `package.json`

**Interfaces:**
- Consumes: `simulate`, `orbitalElements`, `ESCAPE_SPEED` (Task 6); `dragToLaunch`, `formatSpeed` (Task 7); `loadVisitorSatellites`, `saveVisitorSatellite`, `toSceneSatellites`, `ORBIT_RADIUS`, `SceneSatellite` (Task 8); `canRenderScene`, `browserEnv` (Task 9); `Fallback` (Task 9).
- Produces: `mountOrbitScene(container: HTMLElement, opts: { satellites: SceneSatellite[]; storage: Storage | null; onOutcome?: (o: Outcome, speed: number) => void; onContextLost?: () => void }): { destroy(): void }`; `<OrbitScene satellites={SceneSatellite[]} />` Astro island. The island keeps the SVG fallback in the DOM (`hidden`) while WebGL runs and un-hides it on context loss.

Coordinate mapping: simulation plane `(x, y)` → Three `(x, 0, -y)`; orthographic camera at `(0, 6, 7)` looking at the origin; one simulation unit = one Three unit; the `#orbit-scene` container has `aspect-ratio: 16 / 9` and the frustum is sized so radius 3.8 fits vertically.

- [ ] **Step 1: Install Three**

```bash
npm i three@0.186.1 && npm i -D @types/three@0.186.0
```

- [ ] **Step 2: Planet, rings, satellite meshes**

`src/scene/planet.ts`:

```ts
import { Mesh, IcosahedronGeometry, MeshLambertMaterial, Color } from 'three';

export function createPlanet(): Mesh {
  const geo = new IcosahedronGeometry(1, 3);
  const mat = new MeshLambertMaterial({ color: new Color('#5E6B7A'), flatShading: true });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'planet';
  return mesh;
}
```

`src/scene/rings.ts`:

```ts
import { BufferGeometry, Line, LineDashedMaterial, Vector3, Color } from 'three';

export function ringPoints(radius: number, segments = 128): Vector3[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = (i / segments) * Math.PI * 2;
    return new Vector3(radius * Math.cos(t), 0, -radius * Math.sin(t));
  });
}

export function createRing(radius: number): Line {
  const geo = new BufferGeometry().setFromPoints(ringPoints(radius));
  const mat = new LineDashedMaterial({ color: new Color('#121412'), dashSize: 0.12, gapSize: 0.1 });
  const line = new Line(geo, mat);
  line.computeLineDistances();
  line.name = `ring-${radius}`;
  return line;
}

/** A dashed path from simulation points (x, y) → (x, 0, -y). */
export function createPath(points: { x: number; y: number }[], color = '#121412'): Line {
  const geo = new BufferGeometry().setFromPoints(points.map((p) => new Vector3(p.x, 0, -p.y)));
  const line = new Line(geo, new LineDashedMaterial({ color: new Color(color), dashSize: 0.08, gapSize: 0.06 }));
  line.computeLineDistances();
  return line;
}
```

`src/scene/satelliteMesh.ts`:

```ts
import { Mesh, IcosahedronGeometry, OctahedronGeometry, MeshLambertMaterial, Color } from 'three';

export type SatelliteKind = 'active' | 'muted' | 'visitor';

export function createSatelliteMesh(kind: SatelliteKind): Mesh {
  const size = kind === 'visitor' ? 0.07 : 0.11;
  const geo = kind === 'visitor' ? new OctahedronGeometry(size) : new IcosahedronGeometry(size, 0);
  const color = kind === 'active' ? '#E2401C' : kind === 'muted' ? '#121412' : '#6E736D';
  const mesh = new Mesh(geo, new MeshLambertMaterial({ color: new Color(color), flatShading: true }));
  mesh.name = `satellite-${kind}`;
  return mesh;
}
```

- [ ] **Step 3: Scene composition**

`src/scene/scene.ts`:

```ts
import {
  Scene, OrthographicCamera, WebGLRenderer, HemisphereLight, DirectionalLight, Color,
  Vector2, Vector3, Plane, Raycaster, Group, Object3D,
} from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { simulate, type Outcome, type LaunchParams } from '@/lib/orbit';
import { dragToLaunch, formatSpeed } from '@/lib/launch';
import { ORBIT_RADIUS, type SceneSatellite } from '@/lib/satellites';
import { loadVisitorSatellites, saveVisitorSatellite } from '@/lib/visitorSatellites';
import { createPlanet } from './planet';
import { createRing, createPath } from './rings';
import { createSatelliteMesh } from './satelliteMesh';

export interface MountOptions {
  satellites: SceneSatellite[];
  storage: Storage | null;
  onOutcome?: (outcome: Outcome, speed: number) => void;
  onContextLost?: () => void;
}

const VIEW_RADIUS = 3.8;
const LAUNCH_POINT = new Vector3(1, 0, 0);

function label(text: string, cls = 'scene-label'): CSS2DObject {
  const el = document.createElement('div');
  el.className = `mono ${cls}`;
  el.textContent = text;
  return new CSS2DObject(el);
}

function orbiter(radius: number, phase: number, mesh: Object3D, name?: string) {
  const g = new Group();
  g.add(mesh);
  if (name) { const l = label(name.toUpperCase()); l.position.set(0.18, 0, 0); g.add(l); }
  const omega = Math.pow(radius, -1.5); // Kepler: ω ∝ r^-3/2
  return {
    group: g,
    update(t: number) {
      const a = phase + omega * t * 0.15;
      g.position.set(radius * Math.cos(a), 0, -radius * Math.sin(a));
    },
  };
}

export function mountOrbitScene(container: HTMLElement, opts: MountOptions): { destroy(): void } {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 6, 7);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(new Color('#000000'), 0);
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'scene-labels';
  container.appendChild(labels.domElement);

  scene.add(new HemisphereLight('#ffffff', '#c9ccc6', 1.1));
  const sun = new DirectionalLight('#ffffff', 0.9); sun.position.set(-3, 5, 2); scene.add(sun);

  scene.add(createPlanet());
  for (const r of Object.values(ORBIT_RADIUS)) scene.add(createRing(r));

  const orbiters = opts.satellites.map((s) => {
    const o = orbiter(ORBIT_RADIUS[s.orbit], s.phase, createSatelliteMesh(s.status === 'active' ? 'active' : 'muted'), s.name);
    scene.add(o.group);
    return o;
  });

  // Visitor satellites: recompute their paths deterministically from stored params.
  const visitorGroup = new Group(); scene.add(visitorGroup);
  const visitorUpdaters: ((t: number) => void)[] = [];
  function addVisitor(p: LaunchParams) {
    const sim = simulate(p);
    if (sim.outcome !== 'orbit') return;
    const path = createPath(sim.points, '#6E736D'); visitorGroup.add(path);
    const mesh = createSatelliteMesh('visitor'); visitorGroup.add(mesh);
    const n = sim.points.length;
    visitorUpdaters.push((t) => { const i = Math.floor((t * 0.3 * n) / (sim.period ?? 6)) % n; const pt = sim.points[i]!; mesh.position.set(pt.x, 0, -pt.y); });
  }
  for (const v of loadVisitorSatellites(opts.storage)) addVisitor({ angle: v.angle, speed: v.speed });

  // Launch interaction.
  const plane = new Plane(new Vector3(0, 1, 0), 0);
  const ray = new Raycaster();
  const ndc = new Vector2();
  const hit = new Vector3();
  let dragging = false;
  let preview: ReturnType<typeof createPath> | null = null;
  const outcomeLabel = label('DRAG TO LAUNCH ↗', 'scene-label scene-label--hint');
  outcomeLabel.position.set(1.25, 0, 0.4);
  scene.add(outcomeLabel);

  function pointToPlane(ev: PointerEvent): Vector3 | null {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  function paramsFrom(ev: PointerEvent): LaunchParams | null {
    const p = pointToPlane(ev);
    if (!p) return null;
    const d = p.clone().sub(LAUNCH_POINT);
    // tangential = +y in sim = -z in Three; radial = +x
    return dragToLaunch({ tangential: -d.z, radial: d.x });
  }
  function clearPreview() { if (preview) { scene.remove(preview); preview.geometry.dispose(); preview = null; } }

  const onDown = (ev: PointerEvent) => { dragging = true; renderer.domElement.setPointerCapture(ev.pointerId); };
  const onMove = (ev: PointerEvent) => {
    if (!dragging) return;
    const p = paramsFrom(ev);
    clearPreview();
    if (!p) return;
    const sim = simulate(p, { maxSteps: 6000 });
    preview = createPath(sim.points, sim.outcome === 'orbit' ? '#E2401C' : '#121412');
    scene.add(preview);
    outcomeLabel.element.textContent = `${formatSpeed(p.speed)} · ${sim.outcome.toUpperCase()}`;
  };
  const onUp = (ev: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const p = paramsFrom(ev);
    clearPreview();
    if (!p) { outcomeLabel.element.textContent = 'DRAG TO LAUNCH ↗'; return; }
    const sim = simulate(p);
    const text = sim.outcome === 'orbit' ? 'ORBIT ACHIEVED' : sim.outcome === 'escape' ? 'ESCAPE' : 'SUBORBITAL';
    outcomeLabel.element.textContent = `${formatSpeed(p.speed)} · ${text}`;
    outcomeLabel.element.classList.toggle('scene-label--accent', sim.outcome === 'orbit');
    if (sim.outcome === 'orbit') { saveVisitorSatellite(opts.storage, { ...p, launchedAt: Date.now() }); addVisitor(p); }
    else { const fly = createPath(sim.points, '#121412'); scene.add(fly); setTimeout(() => { scene.remove(fly); fly.geometry.dispose(); }, 1800); }
    opts.onOutcome?.(sim.outcome, p.speed);
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onUp);
  renderer.domElement.style.touchAction = 'none';

  // Spec §6.5: on a lost WebGL context, degrade to the static fallback instead of a blank box.
  const onContextLost = (ev: Event) => {
    ev.preventDefault();
    console.info('[orbit] WebGL context lost; showing static fallback');
    handle.destroy();
    opts.onContextLost?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    const aspect = w / h;
    camera.left = -VIEW_RADIUS * aspect; camera.right = VIEW_RADIUS * aspect;
    camera.top = VIEW_RADIUS; camera.bottom = -VIEW_RADIUS;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  let raf = 0; let running = true; const t0 = performance.now();
  const io = new IntersectionObserver(([e]) => { running = Boolean(e?.isIntersecting); if (running) loop(); }, { threshold: 0.05 });
  io.observe(container);
  function loop() {
    if (!running) return;
    const t = (performance.now() - t0) / 1000;
    for (const o of orbiters) o.update(t);
    for (const u of visitorUpdaters) u(t);
    renderer.render(scene, camera);
    labels.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  const handle = {
    destroy() {
      running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
  return handle;
}
```

- [ ] **Step 4: Island wrapper**

`src/scene/OrbitScene.astro`:

```astro
---
import type { SceneSatellite } from '@/lib/satellites';
import Fallback from './Fallback.astro';
interface Props { satellites: SceneSatellite[] }
const { satellites } = Astro.props;
---
<div id="orbit-scene" class="orbit-scene" data-satellites={JSON.stringify(satellites)} data-state="fallback">
  <Fallback satellites={satellites} />
</div>

<script>
  import { canRenderScene, browserEnv } from '@/scene/capabilities';

  const el = document.getElementById('orbit-scene');
  if (el && canRenderScene(browserEnv())) {
    const start = async () => {
      const { mountOrbitScene } = await import('@/scene/scene');
      const satellites = JSON.parse(el.dataset.satellites ?? '[]');
      let storage: Storage | null = null;
      try { storage = window.localStorage; } catch { storage = null; }
      const fallback = el.querySelector<SVGElement>('[data-fallback]');
      const showFallback = () => { if (fallback) fallback.hidden = false; el.dataset.state = 'fallback'; };
      if (fallback) fallback.hidden = true;
      el.dataset.state = 'webgl';
      try {
        mountOrbitScene(el, { satellites, storage, onContextLost: showFallback });
      } catch (err) {
        console.info('[orbit] scene failed to start; showing static fallback', err);
        showFallback();
      }
    };
    'requestIdleCallback' in window ? requestIdleCallback(() => start(), { timeout: 1500 }) : setTimeout(start, 200);
  } else {
    console.info('[orbit] static fallback');
  }
</script>

<style is:global>
  .orbit-scene { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
  .orbit-scene canvas { display: block; width: 100% !important; height: 100% !important; cursor: grab; }
  .orbit-scene canvas:active { cursor: grabbing; }
  .scene-labels { position: absolute; inset: 0; pointer-events: none; }
  .scene-label { white-space: nowrap; color: var(--ink-2); background: var(--paper); padding: 0 0.3em; }
  .scene-label--hint { border: 1px solid var(--ink); color: var(--ink); background: var(--surface); padding: 0.2em 0.6em; }
  .scene-label--accent { border-color: var(--accent); color: var(--accent); }
  .orbit-scene [data-fallback][hidden] { display: none; }
  @media (max-width: 767px) { .orbit-scene { aspect-ratio: 4 / 3; } }
</style>
```

- [ ] **Step 5: Mount it temporarily on the home page and verify by hand**

In `src/pages/index.astro` import `OrbitScene` and `toSceneSatellites`, `getCollection`:

```astro
---
import { getCollection } from 'astro:content';
import Base from '@/layouts/Base.astro';
import OrbitScene from '@/scene/OrbitScene.astro';
import { toSceneSatellites } from '@/lib/satellites';
const satellites = toSceneSatellites(await getCollection('work'));
---
<Base title="Nicolás Muñoz">
  <div class="container"><OrbitScene satellites={satellites} /></div>
</Base>
```

Run `npm run dev`. Checklist (hand verification): rings dashed, planet faceted matte, PaperTok red on the outer ring, pipeline black on the mid ring, names in mono next to them; drag from the planet shows a live dashed preview and the `v · OUTCOME` label; release at ≈1.0–1.3 v₀ tangential yields `ORBIT ACHIEVED` and a small grey satellite that persists on reload; `DevTools → Rendering → Emulate prefers-reduced-motion` + reload shows the SVG fallback; in the console run `document.querySelector('#orbit-scene canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` and confirm the SVG fallback reappears with `data-state="fallback"`. Then:

```bash
npm run build && ls -la dist/_astro/*.js | sort -k5 -n | tail -3 && gzip -c $(ls -S dist/_astro/*.js | head -1) | wc -c
```

Expected: largest chunk (Three) gzips to ≤ 170 KB; sum of home chunks ≤ 200 KB gzip. If over budget, check that only named imports from `three` are used (no `import * as THREE`).

- [ ] **Step 6: Commit**

```bash
git add src/scene src/pages/index.astro package.json package-lock.json
git commit -m "feat(scene): Three.js orbit scene with drag-to-launch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Home page §0–§4 with components

**Files:**
- Create: `src/components/SatelliteCard.astro`, `src/components/MissionSpecs.astro`, `src/components/PostList.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `Section`, `Hud` (Task 5); `OrbitScene` (Task 10); `toSceneSatellites` (Task 8); `publishedPosts` (Task 3).
- Produces: `<SatelliteCard entry index />`, `<MissionSpecs compact? />`, `<PostList posts limit? />`.

- [ ] **Step 1: SatelliteCard**

`src/components/SatelliteCard.astro`:

```astro
---
import type { CollectionEntry } from 'astro:content';
import Hud from './Hud.astro';
interface Props { entry: CollectionEntry<'work'>; index: number }
const { entry, index } = Astro.props;
const { title, orbit, status, oneLiner, stack } = entry.data;
const num = String(index + 1).padStart(2, '0');
---
<article class="card">
  <p class="mono card__meta">
    SAT-{num} · {orbit} orbit · <Hud accent={status === 'active'}>{status}</Hud>
  </p>
  <h3><a href={`/work/${entry.id}`}>{title}</a></h3>
  <p class="card__line">{oneLiner}</p>
  <ul class="mono card__stack" aria-label="Stack">{stack.map((s) => <li>{s}</li>)}</ul>
</article>
<style>
  .card { background: var(--surface); border: 1px solid var(--grid); padding: var(--space-4); display: grid; gap: var(--space-2); }
  .card__meta { margin: 0; display: flex; gap: 0.5em; align-items: center; flex-wrap: wrap; }
  h3 { font-size: 1.5rem; margin: 0; }
  h3 a { text-decoration: none; } h3 a:hover { text-decoration: underline; }
  .card__line { margin: 0; }
  .card__stack { list-style: none; display: flex; flex-wrap: wrap; gap: 0.75em; margin: var(--space-2) 0 0; padding: 0; }
</style>
```

- [ ] **Step 2: MissionSpecs**

`src/components/MissionSpecs.astro`:

```astro
---
interface Props { compact?: boolean }
const { compact = false } = Astro.props;
const specs = [
  { k: 'Propulsion', v: 'Building things end to end' },
  { k: 'Guidance', v: 'Product design' },
  { k: 'Core', v: 'Python' },
  { k: 'Payload', v: 'Neural networks' },
  { k: 'Tooling', v: 'Cursor · Codex · Claude Code' },
];
---
<dl class:list={['specs', { 'specs--compact': compact }]}>
  {specs.map((s) => (<div><dt class="mono">{s.k}</dt><dd>{s.v}</dd></div>))}
</dl>
<style>
  .specs { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); margin: 0; }
  .specs div { background: var(--surface); border: 1px solid var(--grid); padding: var(--space-3); }
  dt { margin: 0 0 var(--space-1); } dd { margin: 0; font-size: var(--text-small); }
  .specs--compact { gap: var(--space-1); grid-template-columns: 1fr; }
  .specs--compact div { background: none; border: 0; padding: 0; display: flex; gap: 0.6em; align-items: baseline; }
  .specs--compact dd { font-family: var(--font-mono); font-size: var(--text-label); color: var(--ink); }
</style>
```

- [ ] **Step 3: PostList**

`src/components/PostList.astro`:

```astro
---
import type { CollectionEntry } from 'astro:content';
interface Props { posts: CollectionEntry<'writing'>[] }
const { posts } = Astro.props;
const fmt = (d: Date) => d.toISOString().slice(0, 10);
---
<ol class="posts">
  {posts.map((p) => (
    <li>
      <a href={`/writing/${p.id}`}>{p.data.title}</a>
      <span class="mono">{fmt(p.data.date)}</span>
      <p>{p.data.summary}</p>
    </li>
  ))}
</ol>
<style>
  .posts { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  li { background: var(--surface); border: 1px solid var(--grid); padding: var(--space-3) var(--space-4); display: grid; gap: var(--space-1); }
  li a { font-size: 1.25rem; text-decoration: none; } li a:hover { text-decoration: underline; }
  li p { margin: 0; font-size: var(--text-small); }
</style>
```

- [ ] **Step 4: Home page**

`src/pages/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import Base from '@/layouts/Base.astro';
import Section from '@/components/Section.astro';
import Hud from '@/components/Hud.astro';
import SatelliteCard from '@/components/SatelliteCard.astro';
import MissionSpecs from '@/components/MissionSpecs.astro';
import PostList from '@/components/PostList.astro';
import OrbitScene from '@/scene/OrbitScene.astro';
import { toSceneSatellites } from '@/lib/satellites';
import { publishedPosts } from '@/lib/posts';

const work = (await getCollection('work')).sort((a, b) => a.data.order - b.data.order);
const satellites = toSceneSatellites(work);
const posts = publishedPosts(await getCollection('writing')).slice(0, 3);
---
<Base title="Nicolás Muñoz — Physics student at Salamanca, already in orbit">
  <section class="hero" id="abstract" aria-labelledby="hero-title">
    <div class="hero__scene"><OrbitScene satellites={satellites} /></div>
    <div class="hero__copy container rise">
      <p class="mono">§0 · Abstract</p>
      <h1 id="hero-title">Physics student at Salamanca.<br /><em>Already in orbit.</em></h1>
      <p class="hero__lede">I build products from my own problems: a study app with real users, and a pipeline that turns my handwritten notes into LaTeX. Second year, still building.</p>
      <p class="hero__cta">
        <a class="btn" href="#in-orbit">See what's in orbit</a>
        <a class="btn btn--accent" href="mailto:nicolas@papertok.app">Contact</a>
      </p>
    </div>
    <aside class="hero__specs container" aria-label="Mission specs"><MissionSpecs compact /></aside>
  </section>

  <Section num="1" id="in-orbit" label="In orbit" title="Two satellites, both launched from the classroom.">
    <div class="grid-2">{work.map((e, i) => <SatelliteCard entry={e} index={i} />)}</div>
  </Section>

  <Section num="2" id="mission-specs" label="Mission specs" title="What I bring aboard.">
    <MissionSpecs />
    <p class="specs__note">I work with AI coding agents every day — Cursor, Codex and Claude Code — the way a physicist works with a good lab partner: I set the problem, check the derivation, and keep the parts that survive. It makes me ship faster without shipping things I do not understand.</p>
  </Section>

  {posts.length > 0 && (
    <Section num="3" id="logbook" label="Logbook" title="Latest entries.">
      <PostList posts={posts} />
      <p><a class="mono mono--ink" href="/writing">All entries →</a></p>
    </Section>
  )}

  <Section num={posts.length > 0 ? '4' : '3'} id="ground-control" label="Ground control" title="Open to internships and junior roles.">
    <p class="mono links">
      <a class="accent" href="mailto:nicolas@papertok.app">Email</a> ·
      <a href="https://www.linkedin.com/in/REVIEW">LinkedIn</a> ·
      <a href="https://github.com/mugar123">GitHub</a> ·
      <a href="/cv.pdf">CV (PDF)</a>
    </p>
  </Section>
</Base>

<style>
  .hero { position: relative; min-height: 80vh; display: grid; align-items: end; }
  .hero__scene { position: absolute; inset: 0; display: flex; justify-content: flex-end; align-items: center; pointer-events: none; }
  .hero__scene :global(.orbit-scene) { width: min(68vw, 60rem); pointer-events: auto; }
  .hero__copy { position: relative; padding-block: var(--space-6) var(--space-5); max-width: 40rem; margin-inline: 0; margin-left: max(var(--space-4), calc((100% - var(--content-max)) / 2)); }
  .hero__copy h1 em { font-style: italic; }
  .hero__lede { font-size: var(--text-body); }
  .hero__cta { display: flex; gap: var(--space-3); flex-wrap: wrap; }
  .btn { font-family: var(--font-mono); font-size: var(--text-label); text-transform: uppercase; letter-spacing: 0.04em; text-decoration: none; border: 1px solid var(--ink); padding: 0.6em 1em; background: var(--surface); }
  .btn--accent { border-color: var(--accent); color: var(--accent); }
  .btn:hover { background: var(--ink); color: var(--paper); }
  .btn--accent:hover { background: var(--accent); color: var(--paper); }
  .hero__specs { position: absolute; right: 0; bottom: var(--space-5); width: auto; margin-right: max(var(--space-4), calc((100% - var(--content-max)) / 2)); }
  .grid-2 { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }
  .specs__note { margin-top: var(--space-4); }
  .links a { font-size: var(--text-small); }
  @media (max-width: 767px) {
    .hero { min-height: 0; display: block; }
    .hero__scene { position: static; display: block; }
    .hero__scene :global(.orbit-scene) { width: 100%; }
    .hero__copy { padding-block: var(--space-4); margin-left: var(--space-4); }
    .hero__specs { position: static; margin: 0 var(--space-4) var(--space-4); }
  }
</style>
```

Replace `REVIEW` in the LinkedIn URL with the real handle when Nicolás provides it (tracked in spec §8).

- [ ] **Step 5: Verify**

```bash
npm run build && grep -c 'id="in-orbit"' dist/index.html && grep -c 'id="logbook"' dist/index.html || true
```

Expected: `in-orbit` count 1; `logbook` count 0 (the only post is a draft), and Ground control shows `§3`. Open `npm run dev`: hero scene fills the right, copy bottom-left, specs bottom-right; at 375 px width the scene is a top band and both CTAs are visible without scrolling past the hero.

- [ ] **Step 6: Commit**

```bash
git add src/components src/pages/index.astro
git commit -m "feat: home page sections and components

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Work, writing, about, 404 and RSS pages

**Files:**
- Create: `src/pages/work/[slug].astro`, `src/pages/writing/index.astro`, `src/pages/writing/[slug].astro`, `src/pages/about.astro`, `src/pages/404.astro`, `src/pages/rss.xml.ts`
- Modify: `package.json`

- [ ] **Step 1: Install RSS**

```bash
npm i @astrojs/rss
```

- [ ] **Step 2: Work page**

`src/pages/work/[slug].astro`:

```astro
---
import { getCollection, render } from 'astro:content';
import Base from '@/layouts/Base.astro';
import Hud from '@/components/Hud.astro';

export async function getStaticPaths() {
  const work = await getCollection('work');
  return work.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}
const { entry } = Astro.props;
const { Content } = await render(entry);
const { title, orbit, status, launched, oneLiner, stack, links } = entry.data;
---
<Base title={`${title} — Nicolás Muñoz`} description={oneLiner}>
  <article class="container prose">
    <p class="mono">Satellite · {orbit} orbit · <Hud accent={status === 'active'}>{status}</Hud> · launched {launched.toISOString().slice(0, 10)}</p>
    <h1>{title}</h1>
    <p class="lede">{oneLiner}</p>
    <p class="mono">Stack · {stack.join(' · ')}</p>
    {links && <p class="mono">{links.map((l) => <a href={l.url} rel="noopener">{l.label}</a>)}</p>}
    <Content />
    <p><a class="mono mono--ink" href="/#in-orbit">← Back to orbit</a></p>
  </article>
</Base>
<style>
  .prose { padding-block: var(--space-5) var(--space-6); }
  .prose :global(h2) { margin-top: var(--space-5); }
  .lede { font-size: 1.375rem; }
</style>
```

- [ ] **Step 3: Writing index and post**

`src/pages/writing/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import Base from '@/layouts/Base.astro';
import PostList from '@/components/PostList.astro';
import { publishedPosts } from '@/lib/posts';
const posts = publishedPosts(await getCollection('writing'));
---
<Base title="Logbook — Nicolás Muñoz" description="Notes on building things while studying physics.">
  <div class="container page">
    <p class="mono">Logbook</p>
    <h1>Entries.</h1>
    {posts.length > 0 ? <PostList posts={posts} /> : <p>No entries yet. The first one is being written.</p>}
  </div>
</Base>
<style>.page { padding-block: var(--space-5) var(--space-6); }</style>
```

`src/pages/writing/[slug].astro`:

```astro
---
import { getCollection, render } from 'astro:content';
import Base from '@/layouts/Base.astro';
import { publishedPosts } from '@/lib/posts';

export async function getStaticPaths() {
  const posts = publishedPosts(await getCollection('writing'));
  return posts.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}
const { entry } = Astro.props;
const { Content } = await render(entry);
---
<Base title={`${entry.data.title} — Nicolás Muñoz`} description={entry.data.summary}>
  <article class="container prose">
    <p class="mono">Logbook · {entry.data.date.toISOString().slice(0, 10)}</p>
    <h1>{entry.data.title}</h1>
    <p class="lede">{entry.data.summary}</p>
    <Content />
    <p><a class="mono mono--ink" href="/writing">← All entries</a></p>
  </article>
</Base>
<style>
  .prose { padding-block: var(--space-5) var(--space-6); }
  .prose :global(p), .prose :global(li) { max-width: var(--measure); }
  .prose :global(h2) { margin-top: var(--space-5); }
  .lede { font-size: 1.375rem; }
</style>
```

- [ ] **Step 4: About and 404**

`src/pages/about.astro`:

```astro
---
import Base from '@/layouts/Base.astro';
import MissionSpecs from '@/components/MissionSpecs.astro';
---
<Base title="About — Nicolás Muñoz" description="Physics student at the Universidad de Salamanca, founder of PaperTok.">
  <article class="container prose">
    <p class="mono">About</p>
    <h1>Nicolás Muñoz García.</h1>
    <!-- REVIEW: Nicolás to edit the bio. -->
    <p>I am a second-year physics student at the Universidad de Salamanca. I started building software because the tools I wanted for studying did not exist: PaperTok, a study app, and a pipeline that turns my handwritten notes into LaTeX.</p>
    <p>I care about product as much as code. I design what I build, I ship it, and I keep what people actually use.</p>
    <p>I work with AI coding agents — Cursor, Codex and Claude Code — every day, and I treat them the way a physicist treats a derivation: useful only once I have checked it.</p>
    <h2>Mission specs</h2>
    <MissionSpecs />
    <p class="mono"><a class="accent" href="mailto:nicolas@papertok.app">Email</a> · <a href="/cv.pdf">CV (PDF)</a></p>
  </article>
</Base>
<style>.prose { padding-block: var(--space-5) var(--space-6); } .prose h2 { margin-top: var(--space-5); }</style>
```

`src/pages/404.astro`:

```astro
---
import Base from '@/layouts/Base.astro';
---
<Base title="Trajectory decayed — Nicolás Muñoz">
  <div class="container page">
    <p class="mono">404 · Suborbital</p>
    <h1>Trajectory decayed.</h1>
    <p>This page never reached orbit. <a href="/">Return to the launch site →</a></p>
  </div>
</Base>
<style>.page { padding-block: var(--space-6); min-height: 50vh; }</style>
```

- [ ] **Step 5: RSS**

`src/pages/rss.xml.ts`:

```ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { publishedPosts } from '@/lib/posts';

export async function GET(context: APIContext) {
  const posts = publishedPosts(await getCollection('writing'));
  return rss({
    title: 'Nicolás Muñoz — Logbook',
    description: 'Notes on building things while studying physics.',
    site: context.site!,
    items: posts.map((p) => ({ title: p.data.title, pubDate: p.data.date, description: p.data.summary, link: `/writing/${p.id}/` })),
  });
}
```

- [ ] **Step 6: Verify**

```bash
npm run build && ls dist/work dist/writing dist/about dist/404.html dist/rss.xml dist/sitemap-index.xml
```

Expected: `dist/work/papertok/index.html`, `dist/work/notes-to-latex/index.html`, `dist/writing/index.html` (no post subfolder: the only post is a draft), `dist/about/index.html`, `dist/404.html`, `dist/rss.xml`, sitemap. Then `npm run check` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages package.json package-lock.json
git commit -m "feat: work, writing, about, 404 and RSS pages

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Open Graph image and asset ledger

**Files:**
- Create: `scripts/og.mjs`, `public/og.png` (generated, committed), `public/models/CREDITS.md`
- Modify: `package.json`

- [ ] **Step 1: Install sharp and write the script**

```bash
npm i -D sharp
```

`scripts/og.mjs`:

```js
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const W = 1200, H = 630, cell = 32;
const grid = Array.from({ length: Math.ceil(W / cell) }, (_, i) => `<line x1="${i * cell}" y1="0" x2="${i * cell}" y2="${H}" stroke="#DADDD8"/>`).join('')
  + Array.from({ length: Math.ceil(H / cell) }, (_, i) => `<line x1="0" y1="${i * cell}" x2="${W}" y2="${i * cell}" stroke="#DADDD8"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#F2F3F1"/>${grid}
  <ellipse cx="900" cy="315" rx="230" ry="88" fill="none" stroke="#121412" stroke-dasharray="6 8" stroke-width="2"/>
  <ellipse cx="900" cy="315" rx="150" ry="57" fill="none" stroke="#121412" stroke-dasharray="6 8" stroke-width="2"/>
  <circle cx="900" cy="315" r="70" fill="#5E6B7A"/><circle cx="1130" cy="315" r="11" fill="#E2401C"/>
  <text x="80" y="300" font-family="serif" font-size="64" fill="#121412">Nicolás Muñoz</text>
  <text x="80" y="360" font-family="serif" font-size="34" fill="#121412">Physics student at Salamanca.</text>
  <text x="80" y="404" font-family="serif" font-style="italic" font-size="34" fill="#121412">Already in orbit.</text>
  <text x="80" y="560" font-family="monospace" font-size="18" fill="#6E736D" letter-spacing="2">MUGAR123.GITHUB.IO · §0 ABSTRACT</text>
</svg>`;
await writeFile('public/og.png', await sharp(Buffer.from(svg)).png().toBuffer());
console.log('wrote public/og.png');
```

Add `"og": "node scripts/og.mjs"` to scripts and run `npm run og`. Open `public/og.png` and check it reads well at thumbnail size.

- [ ] **Step 2: Asset ledger**

`public/models/CREDITS.md`:

```md
# 3D asset credits

Every external model used by the scene is listed here with license and source. Code-built primitives (planet, rings, satellites) need no entry.

| file | source | author | license | notes |
|---|---|---|---|---|
| — | — | — | — | No external models in use. |
```

- [ ] **Step 3: Commit**

```bash
git add scripts/og.mjs public/og.png public/models/CREDITS.md package.json package-lock.json
git commit -m "feat: Open Graph image and 3D asset ledger

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: End-to-end tests (Playwright + axe)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/home.spec.ts`, `tests/e2e/pages.spec.ts`, `tests/e2e/a11y.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install and configure**

```bash
npm i -D @playwright/test @axe-core/playwright
npx playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  webServer: { command: 'npm run preview -- --port 4321', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://localhost:4321' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'no-js', use: { ...devices['Desktop Chrome'], javaScriptEnabled: false } },
  ],
});
```

Add scripts: `"e2e": "playwright test"`, `"pretest:e2e": "npm run build"` is not needed — CI builds first; locally run `npm run build` before `npm run e2e`.

- [ ] **Step 2: Write the tests**

`tests/e2e/home.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('home', () => {
  test('hero text, CTAs and sections render', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Already in orbit');
    await expect(page.getByRole('link', { name: /see what's in orbit/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^contact$/i }).first()).toBeVisible();
    await expect(page.locator('#in-orbit')).toBeVisible();
    await expect(page.locator('#mission-specs')).toBeVisible();
    await expect(page.locator('#ground-control')).toBeVisible();
  });

  test('logbook is hidden while there are no published posts', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#logbook')).toHaveCount(0);
    await expect(page.locator('#ground-control .mono').first()).toContainText('§3');
  });

  test('scene mounts WebGL or keeps the SVG fallback, never neither', async ({ page, javaScriptEnabled }) => {
    await page.goto('/');
    const scene = page.locator('#orbit-scene');
    await expect(scene).toBeVisible();
    if (!javaScriptEnabled) { await expect(scene.locator('[data-fallback]')).toBeVisible(); return; }
    await page.waitForTimeout(2500);
    const state = await scene.getAttribute('data-state');
    if (state === 'webgl') await expect(scene.locator('canvas')).toBeVisible();
    else await expect(scene.locator('[data-fallback]')).toBeVisible();
  });

  test('a drag on the canvas produces an outcome label', async ({ page, javaScriptEnabled, isMobile }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await page.waitForTimeout(2500);
    const canvas = page.locator('#orbit-scene canvas');
    if ((await canvas.count()) === 0) test.skip(true, 'WebGL unavailable in this runner');
    const box = (await canvas.boundingBox())!;
    const sx = box.x + box.width * 0.62, sy = box.y + box.height * 0.5;
    await page.mouse.move(sx, sy); await page.mouse.down();
    await page.mouse.move(sx + (isMobile ? 40 : 90), sy - 20, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.scene-label--hint')).toContainText(/v₀ · (ORBIT ACHIEVED|SUBORBITAL|ESCAPE)/);
  });

  test('mobile: headline and both CTAs are within the first two viewports', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/');
    const vh = page.viewportSize()!.height;
    for (const loc of [page.getByRole('heading', { level: 1 }), page.getByRole('link', { name: /see what's in orbit/i }), page.getByRole('link', { name: /^contact$/i }).first()]) {
      const b = (await loc.boundingBox())!;
      expect(b.y + b.height).toBeLessThan(vh * 2);
    }
  });
});
```

`tests/e2e/pages.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

for (const path of ['/work/papertok', '/work/notes-to-latex', '/writing', '/about']) {
  test(`${path} renders with a heading`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  });
}

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
```

`tests/e2e/a11y.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const path of ['/', '/work/papertok', '/about']) {
  test(`axe: ${path}`, async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, 'axe needs JS');
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
```

- [ ] **Step 3: Run**

```bash
npm run build && npm run e2e
```

Expected: all pass (the drag test may skip on runners without WebGL — that is acceptable; it must pass locally on the Mac). Fix any axe violation (most likely: contrast of `--ink-2` labels if used at < 12 px, or a missing accessible name) in the component that owns it.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e package.json package-lock.json
git commit -m "test: Playwright e2e with axe accessibility checks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: CI and GitHub Pages deployment

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `lighthouserc.json`
- Modify: `package.json`, `README.md`

- [ ] **Step 1: Lighthouse budget**

```bash
npm i -D @lhci/cli
```

`lighthouserc.json`:

```json
{
  "ci": {
    "collect": { "staticDistDir": "./dist", "url": ["http://localhost/index.html", "http://localhost/about/index.html"], "numberOfRuns": 2, "settings": { "preset": "desktop" } },
    "assert": {
      "assertions": {
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.01 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 2500 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.95 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

Add `"lhci": "lhci autorun"` to scripts.

- [ ] **Step 2: CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v4   # bump to the latest major if the Actions log warns about a deprecated runtime
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
        env: { CI: true }
      - run: npm run lhci
        env: { CI: true }
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report }
```

- [ ] **Step 3: Deploy workflow (from the official Astro docs)**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: withastro/action@v6
        with: { node-version: 24 }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 4: README**

`README.md`:

```md
# mugar123.github.io

Personal site of Nicolás Muñoz García. Astro + Three.js, deployed to GitHub Pages.

- `npm run dev` — local dev
- `npm run check` / `npm test` / `npm run e2e` / `npm run lhci` — quality gates (CI runs all four)
- `npm run fonts` — regenerate `public/fonts` (needs `pyftsubset` for WOFF2)
- `npm run og` — regenerate `public/og.png`

Content lives in `src/content/work` (satellites) and `src/content/writing` (logbook). Adding a project = adding a Markdown file.
Design spec: `docs/superpowers/specs/2026-10-15-personal-website-design.md`.
```

- [ ] **Step 5: Verify locally**

```bash
npm run build && npm run lhci
```

Expected: assertions pass (LCP may warn). Fix a CLS error by checking the scene container has `aspect-ratio` and fonts have `size-adjust` fallbacks.

- [ ] **Step 6: Commit, create the GitHub repo, push, enable Pages**

```bash
git add .github lighthouserc.json package.json package-lock.json README.md
git commit -m "ci: verification workflow and GitHub Pages deploy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
gh repo create mugar123/mugar123.github.io --public --source=. --remote=origin --push
```

Then in GitHub → Settings → Pages → Source: **GitHub Actions**. Wait for the `Deploy to GitHub Pages` run, open `https://mugar123.github.io/`, and run the manual checklist from spec §6.7 (iPhone, low-end Android, keyboard navigation, reduced motion).

---

### Task 16: Spec touch-up and launch checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-personal-website-design.md`

- [ ] **Step 1: Record the version deviation**

In spec §6.1 change `**Astro 5**` to `**Astro 7.x** (spec originally said 5; the content-collections API used is unchanged)`. In spec §6.2 note that the optional `cover` image field was left out of the `work` schema in v1 (no cover images exist yet; add the field when the first one does).

- [ ] **Step 2: Mark the open items**

In spec §8, add the current state of each item: copy (drafted in Task 11, marked REVIEW), PaperTok/pipeline assets (pending from Nicolás), CV PDF at `public/cv.pdf` (pending), LinkedIn handle (pending), visitor ship (code-built octahedron chosen; no external model needed).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-15-personal-website-design.md
git commit -m "docs: update spec with implementation outcomes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```
