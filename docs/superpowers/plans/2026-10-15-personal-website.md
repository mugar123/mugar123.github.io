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
- Every commit message ends with the implementing agent's attribution line (see `AGENTS.md`): `Co-Authored-By: Codex <noreply@openai.com>` for Codex, `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` or the Claude model actually used for Claude. The `git commit -m` lines in the tasks omit the trailer; add yours.
- The launch pad sits at `LAUNCH_RADIUS = 1.05` planet radii; aims within 3° of the horizontal snap to tangential (spec §3).
- Owner facts: public email `nicomg60@gmail.com`; GitHub `mugar123`; site `papertok.app`; no phone number anywhere; never mention the a-private-grant grant or a private application; PaperTok is a swipeable discovery feed for arXiv papers (not a study app); the notes→LaTeX pipeline is private (no links). The CV is rendered natively at `/cv`, never shipped as a PDF file.

## Review Focus

1. **A click on the planet with no drag** must not launch anything or produce `NaN` in the simulation — pinned in Task 7 (`dragToLaunch` returns `null` for vectors shorter than the dead zone).
2. **`localStorage` that throws** (Safari private mode, blocked storage) must leave the scene fully working and simply not persist launches — pinned in Task 8 (throwing storage fake).
3. **WebGL unavailable** (`getContext` returns `null`, headless or old GPU) must keep the SVG fallback visible and log nothing louder than `console.info` — pinned in Task 9 (`canRenderScene` with a fake canvas).
4. **Draft posts** must never appear on the home Logbook or `/writing`, and the Logbook section must disappear entirely when there are zero published posts — pinned in Task 3 (unit tests on `publishedPosts`) and Task 14 (e2e asserts no `#logbook` and `§3` on Ground control with the shipped draft-only content).
5. **Narrow viewports (< 768 px)** must keep the hero headline within the first viewport and both CTAs within the first 1.5 viewports, clickable, with the scene band above them — pinned in Task 14 (Playwright mobile project).
6. **A visitor who cannot use a pointer** must still be able to launch: the scene is focusable and arrow keys + Enter drive it, with the outcome announced through `role="status"` — pinned in Task 10 (DOM hooks) and Task 14 (keyboard test).

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
│   ├── content.config.ts            registers the `work` and `writing` collections
│   ├── content/schemas.ts           Zod schemas (plain module so Vitest can test them)
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
│   ├── scene/projection.ts          camera position, view radius, squash — shared by scene and SVG
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
│       ├── about.astro, cv.astro, 404.astro, rss.xml.ts
│   ├── data/cv.ts                   typed CV data (single source for /cv)
│   ├── components/CvEntry.astro, LiveBackground.astro, Cursor.astro
│   ├── styles/print.css             print stylesheet for /cv
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
npm i astro@7 @astrojs/sitemap@3
npm i -D @astrojs/check typescript@5
```

TypeScript stays on 5.x: `@astrojs/check` declares a `^5` peer, and TypeScript 7 removes `baseUrl`. `paths` works without `baseUrl` when the targets are relative to the tsconfig.

Replace `tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strictest",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules"],
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
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
- Create: `src/content.config.ts`, `src/content/schemas.ts`, `src/content/work/papertok.md`, `src/content/work/notes-to-latex.md`, `src/content/writing/first-entry.md`, `src/lib/posts.ts`, `tests/unit/posts.test.ts`, `tests/unit/schemas.test.ts`

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

- [ ] **Step 5: Define the schemas in a testable module and register the collections**

`src/content/schemas.ts` (plain Zod, importable from Vitest — `astro:content` is not):

```ts
import { z } from 'astro/zod';

export const workSchema = z.object({
  title: z.string().min(1),
  orbit: z.enum(['high', 'mid', 'low']),
  status: z.enum(['active', 'paused', 'retired']),
  launched: z.coerce.date(),
  oneLiner: z.string().min(1).max(140),
  stack: z.array(z.string().min(1)).min(1),
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
  order: z.number().int(),
});

export const writingSchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  summary: z.string().min(1).max(200),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().default(false),
});
```

`src/content.config.ts`:

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { workSchema, writingSchema } from './content/schemas';

const work = defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/work' }), schema: workSchema });
const writing = defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/writing' }), schema: writingSchema });

export const collections = { work, writing };
```

Schema unit test, `tests/unit/schemas.test.ts` (write it before the schemas; run `npm test -- schemas`, see it fail, then pass):

```ts
import { describe, it, expect } from 'vitest';
import { workSchema, writingSchema } from '@/content/schemas';

const work = { title: 'PaperTok', orbit: 'high', status: 'active', launched: '2025-06-01', oneLiner: 'A study app.', stack: ['Swift'], order: 1 };

describe('workSchema', () => {
  it('accepts a valid entry and coerces the date', () => {
    const r = workSchema.parse(work);
    expect(r.launched).toBeInstanceOf(Date);
  });
  it('rejects an unknown orbit', () => {
    expect(workSchema.safeParse({ ...work, orbit: 'geostationary' }).success).toBe(false);
  });
  it('rejects a missing title and an empty stack', () => {
    expect(workSchema.safeParse({ ...work, title: '' }).success).toBe(false);
    expect(workSchema.safeParse({ ...work, stack: [] }).success).toBe(false);
  });
});

describe('writingSchema', () => {
  it('defaults draft to false', () => {
    expect(writingSchema.parse({ title: 'T', date: '2026-10-15', summary: 'S' }).draft).toBe(false);
  });
  it('rejects an over-long summary', () => {
    expect(writingSchema.safeParse({ title: 'T', date: '2026-10-15', summary: 'x'.repeat(201) }).success).toBe(false);
  });
});
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

- [ ] **Step 7: Verify the build validates the seed content**

```bash
npm test && npm run build
```

Expected: all unit tests pass and the build succeeds (the schema tests already prove invalid frontmatter is rejected; no need to break the build by hand).

- [ ] **Step 8: Commit**

```bash
git add src/content.config.ts src/content src/lib/posts.ts tests/unit/posts.test.ts tests/unit/schemas.test.ts
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
# Portable loop (macOS ships bash 3.2, which has no associative arrays).
for pair in Regular:lmroman-400 Italic:lmroman-400-italic Bold:lmroman-700; do
  style="${pair%%:*}"
  src="$LM/TypoPRO-LatinModernRoman-$style.woff"
  dst="$OUT/${pair#*:}"
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
  --ink-2: #6A6F69;
  --accent: #E2401C;
  --planet: #5E6B7A;
  --planet-hi: #7B8898;
  --surface: #FFFFFF;

  /* The size-adjusted fallback must come right after the web font, before any generic family, or it is never used. */
  --font-serif: 'Latin Modern', 'Latin Modern Fallback', Georgia, serif;
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
  font-family: var(--font-serif);
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
  .hud { display: inline-flex; align-items: center; gap: 0.45em; padding: 0.2em 0.6em; border: 1px solid var(--ink); background: var(--surface); color: var(--ink); }
  /* Accent as a live dot and the border; the 12px text stays ink for AA contrast. */
  .hud--accent { border-color: var(--accent); }
  .hud--accent::before { content: ''; width: 0.5em; height: 0.5em; border-radius: 50%; background: var(--accent); }
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
export interface LaunchParams { angle: number; speed: number } // angle (rad) from local horizontal at the launch pad; 0 = prograde tangential; speed in units of circular speed at r = 1
export interface Point { x: number; y: number }
export interface Simulation {
  points: Point[]; outcome: Outcome; energy: number; periapsis: number;
  apoapsis: number | null; period: number | null; truncated: boolean;
}
export const LAUNCH_RADIUS: number;   // 1.05 — the pad sits just above the surface
export const ESCAPE_SPEED: number;    // Math.SQRT2 (at r = 1)
export function circularSpeed(r: number): number;
export function escapeSpeed(r: number): number;
export function angularSpeed(r: number): number;            // Kepler: r^-1.5
export function circularPosition(r: number, phase: number): Point;
export function orbitalElements(p: LaunchParams): { energy: number; a: number | null; e: number; rp: number; ra: number | null; period: number | null };
export function simulate(p: LaunchParams, opts?: { dt?: number; maxSteps?: number; bound?: number }): Simulation;
```

Units: planet radius R = 1, GM = 1. The launch pad is at `(LAUNCH_RADIUS, 0)`; local horizontal is +y (counter-clockwise prograde), radial is +x. **Why a pad and not the surface:** a launch from exactly r = 1 with any outward radial component has periapsis < 1 and falls back, so only a perfectly tangential launch could ever orbit. From r = 1.05 there is a cone of angles whose periapsis stays above the surface, which is what makes the toy winnable.

Outcome rules: `suborbital` when the path reaches r ≤ 1; `escape` when energy ≥ 0 and r reaches `bound`; `orbit` when energy < 0 and the swept angle reaches 2π without touching the surface. A completed revolution counts as `orbit` only if the analytic periapsis is ≥ 1: step endpoints can straddle a grazing dip below the surface, so the conic decides, not the samples (periapsis < 1 ⇒ `suborbital`, with the path cut at its lowest sample and clamped onto the surface). If `maxSteps` runs out first, `truncated` is `true` and the outcome is inferred from the conic: periapsis < 1 and the body still has to pass periapsis (always true for bound orbits; for unbound ones when the launch has an inward radial component) → `suborbital`; otherwise energy ≥ 0 → `escape`, energy < 0 → `orbit`. A measured impact always wins over inference. Never pretend a truncated path is a measured orbit. `period` is analytic (2π·a^1.5) for bound orbits and `null` otherwise. Consumers (Task 10) must not persist a truncated `orbit`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/orbit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  simulate, orbitalElements, circularSpeed, escapeSpeed, angularSpeed, circularPosition,
  ESCAPE_SPEED, LAUNCH_RADIUS, type Point,
} from '@/lib/orbit';

const R0 = LAUNCH_RADIUS;
const r = (p: Point) => Math.hypot(p.x, p.y);
const maxR = (pts: Point[]) => Math.max(...pts.map(r));
const minR = (pts: Point[]) => Math.min(...pts.map(r));

describe('speeds and positions', () => {
  it('circular speed at r=1 is 1 and escape is sqrt(2)', () => {
    expect(circularSpeed(1)).toBeCloseTo(1, 12);
    expect(escapeSpeed(1)).toBeCloseTo(Math.SQRT2, 12);
    expect(ESCAPE_SPEED).toBeCloseTo(Math.SQRT2, 12);
    expect(circularSpeed(4)).toBeCloseTo(0.5, 12);
  });
  it('angular speed follows Kepler and circularPosition is on the ring', () => {
    expect(angularSpeed(4)).toBeCloseTo(0.125, 12);
    const p = circularPosition(2, Math.PI / 2);
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(2, 12);
  });
  it('the pad is just above the surface', () => {
    expect(LAUNCH_RADIUS).toBeGreaterThan(1);
    expect(LAUNCH_RADIUS).toBeLessThan(1.1);
  });
});

describe('orbitalElements', () => {
  it('tangential launch at v=1.2 has periapsis at the pad and ra = 2a - rp', () => {
    const el = orbitalElements({ angle: 0, speed: 1.2 });
    const energy = 0.72 - 1 / R0;
    const a = -1 / (2 * energy);
    expect(el.energy).toBeCloseTo(energy, 12);
    expect(el.a).toBeCloseTo(a, 6);
    expect(el.rp).toBeCloseTo(R0, 6);
    expect(el.ra).toBeCloseTo(2 * a - R0, 6);
    expect(el.period).toBeCloseTo(2 * Math.PI * Math.pow(a, 1.5), 6);
  });
  it('escape has non-negative energy and null a/ra/period', () => {
    const el = orbitalElements({ angle: 0, speed: 1.5 });
    expect(el.energy).toBeGreaterThanOrEqual(0);
    expect(el.a).toBeNull();
    expect(el.ra).toBeNull();
    expect(el.period).toBeNull();
  });
  it('a steep outward launch from the pad has periapsis below the surface', () => {
    expect(orbitalElements({ angle: 0.6, speed: 1.2 }).rp).toBeLessThan(1);
  });
});

describe('simulate', () => {
  it('circular speed at the pad produces a closed orbit at r≈R0', () => {
    const s = simulate({ angle: 0, speed: circularSpeed(R0) });
    expect(s.outcome).toBe('orbit');
    expect(s.truncated).toBe(false);
    expect(maxR(s.points)).toBeLessThan(R0 + 0.01);
    expect(minR(s.points)).toBeGreaterThan(R0 - 0.01);
    expect(s.period).toBeCloseTo(2 * Math.PI * Math.pow(R0, 1.5), 6);
  });
  it('too slow falls back to the surface', () => {
    const s = simulate({ angle: 0, speed: 0.5 });
    expect(s.outcome).toBe('suborbital');
    expect(r(s.points.at(-1)!)).toBeLessThanOrEqual(1.001);
  });
  it('above escape speed leaves the bound', () => {
    const s = simulate({ angle: 0, speed: 1.5 }, { bound: 8 });
    expect(s.outcome).toBe('escape');
    expect(maxR(s.points)).toBeGreaterThanOrEqual(8);
  });
  it('elliptical orbit reaches the analytic apoapsis', () => {
    const s = simulate({ angle: 0, speed: 1.2 });
    const el = orbitalElements({ angle: 0, speed: 1.2 });
    expect(s.outcome).toBe('orbit');
    expect(maxR(s.points)).toBeCloseTo(el.ra!, 1);
    expect(s.apoapsis).toBeCloseTo(el.ra!, 6);
  });
  it('a slightly outward launch still orbits from the pad', () => {
    const s = simulate({ angle: 0.1, speed: 1.2 });
    expect(s.outcome).toBe('orbit');
    expect(minR(s.points)).toBeGreaterThan(1);
  });
  it('a steeper outward launch dips below the surface and is suborbital', () => {
    expect(simulate({ angle: 0.6, speed: 1.2 }).outcome).toBe('suborbital');
  });
  it('radial launch straight up falls back', () => {
    expect(simulate({ angle: Math.PI / 2, speed: 1 }).outcome).toBe('suborbital');
  });
  it('an inward launch above escape speed still hits the surface, with finite points', () => {
    const s = simulate({ angle: -1.2, speed: 1.7 });
    expect(s.outcome).toBe('suborbital');
    expect(s.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
  it('conserves energy to 1e-6 over one orbit', () => {
    const p = { angle: 0.1, speed: 1.2 };
    const s = simulate(p);
    expect(s.outcome).toBe('orbit');
    expect(Math.abs(s.energy - orbitalElements(p).energy)).toBeLessThan(1e-6);
  });
  it('reports truncation instead of inventing a closed orbit', () => {
    const s = simulate({ angle: 0, speed: 1.2 }, { maxSteps: 10 });
    expect(s.truncated).toBe(true);
    expect(s.outcome).toBe('orbit');
    expect(s.points).toHaveLength(11);
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
 * The launch pad is at (LAUNCH_RADIUS, 0). Local horizontal is +y (prograde), radial is +x.
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
  truncated: boolean;
}

export const LAUNCH_RADIUS = 1.05;
export const ESCAPE_SPEED = Math.SQRT2;
export const circularSpeed = (r: number): number => 1 / Math.sqrt(r);
export const escapeSpeed = (r: number): number => Math.sqrt(2 / r);
export const angularSpeed = (r: number): number => Math.pow(r, -1.5);
export const circularPosition = (r: number, phase: number): Point => ({ x: r * Math.cos(phase), y: r * Math.sin(phase) });

interface State { x: number; y: number; vx: number; vy: number }

function initialState({ angle, speed }: LaunchParams): State {
  return { x: LAUNCH_RADIUS, y: 0, vx: speed * Math.sin(angle), vy: speed * Math.cos(angle) };
}

function deriv(s: State): State {
  const r2 = s.x * s.x + s.y * s.y;
  const r3 = r2 * Math.sqrt(r2);
  return { x: s.vx, y: s.vy, vx: -s.x / r3, vy: -s.y / r3 };
}
function add(s: State, d: State, h: number): State {
  return { x: s.x + d.x * h, y: s.y + d.y * h, vx: s.vx + d.vx * h, vy: s.vy + d.vy * h };
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

function specificEnergy(s: State): number {
  return (s.vx * s.vx + s.vy * s.vy) / 2 - 1 / Math.hypot(s.x, s.y);
}

export function orbitalElements(p: LaunchParams) {
  const s = initialState(p);
  const energy = specificEnergy(s);
  const h = s.x * s.vy - s.y * s.vx; // specific angular momentum (z)
  const e = Math.sqrt(Math.max(0, 1 + 2 * energy * h * h));
  const rp = (h * h) / (1 + e);
  if (energy >= 0) return { energy, a: null, e, rp, ra: null, period: null };
  const a = -1 / (2 * energy);
  return { energy, a, e, rp, ra: a * (1 + e), period: 2 * Math.PI * Math.pow(a, 1.5) };
}

export function simulate(
  p: LaunchParams,
  { dt = 0.005, maxSteps = 40000, bound = 8 }: { dt?: number; maxSteps?: number; bound?: number } = {},
): Simulation {
  let s = initialState(p);
  const el = orbitalElements(p);
  const points: Point[] = [{ x: s.x, y: s.y }];
  let swept = 0;
  let prevTheta = Math.atan2(s.y, s.x);
  let rMin = LAUNCH_RADIUS;
  let rMax = LAUNCH_RADIUS;
  let outcome: Outcome | null = null;
  let steps = 0;

  while (outcome === null && steps < maxSteps) {
    s = rk4(s, dt);
    steps++;
    const rr = Math.hypot(s.x, s.y);
    rMin = Math.min(rMin, rr);
    rMax = Math.max(rMax, rr);
    const theta = Math.atan2(s.y, s.x);
    let d = theta - prevTheta;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    swept += d;
    prevTheta = theta;

    if (rr <= 1) {
      // Clamp the last point onto the surface so the drawn path ends on the planet.
      points.push({ x: s.x / rr, y: s.y / rr });
      outcome = 'suborbital';
      break;
    }
    points.push({ x: s.x, y: s.y });
    if (el.energy >= 0 && rr >= bound) outcome = 'escape';
    else if (el.energy < 0 && Math.abs(swept) >= 2 * Math.PI) outcome = 'orbit';
  }

  const truncated = outcome === null;
  if (outcome === null) outcome = el.energy >= 0 ? 'escape' : 'orbit';
  return {
    points,
    outcome,
    energy: specificEnergy(s),
    periapsis: rMin,
    apoapsis: outcome === 'orbit' ? (el.ra ?? rMax) : null,
    period: outcome === 'orbit' ? el.period : null,
    truncated,
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
git commit -m "feat(orbit): pure two-body simulation with launch pad and outcome detection"
```

---

### Task 7: Drag-to-launch mapping (`launch.ts`)

**Files:**
- Create: `src/lib/launch.ts`, `tests/unit/launch.test.ts`

**Interfaces:**
- Consumes: `LaunchParams` from Task 6.
- Produces: `dragToLaunch(d: {tangential: number; radial: number}, opts?: {scale?: number}): LaunchParams | null`, constants `MIN_SPEED = 0.3`, `MAX_SPEED = 1.8`, `DEAD_ZONE = 0.08` (scene units), `SNAP_ANGLE = 3° in radians`, `formatSpeed(speed): string` → e.g. `"1.21 v₀"`.

Aiming within `SNAP_ANGLE` of the horizontal snaps to exactly prograde (`0`) or retrograde (`Math.PI`): a small visible aiming assist, because near-tangential launches are where orbits live and a pointer cannot hold 0.00 rad.

- [ ] **Step 1: Write the failing tests**

`tests/unit/launch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dragToLaunch, formatSpeed, MIN_SPEED, MAX_SPEED, DEAD_ZONE, SNAP_ANGLE } from '@/lib/launch';

describe('dragToLaunch', () => {
  it('returns null inside the dead zone (a click is not a launch)', () => {
    expect(dragToLaunch({ tangential: 0, radial: 0 })).toBeNull();
    expect(dragToLaunch({ tangential: DEAD_ZONE / 2, radial: 0 })).toBeNull();
  });
  it('maps a unit tangential drag to angle 0, speed 1', () => {
    const p = dragToLaunch({ tangential: 1, radial: 0 })!;
    expect(p.angle).toBe(0);
    expect(p.speed).toBeCloseTo(1, 12);
  });
  it('maps a radial drag to angle π/2', () => {
    expect(dragToLaunch({ tangential: 0, radial: 1 })!.angle).toBeCloseTo(Math.PI / 2, 12);
  });
  it('allows retrograde launches (angle π)', () => {
    expect(Math.abs(dragToLaunch({ tangential: -1, radial: 0 })!.angle)).toBe(Math.PI);
  });
  it('snaps aims within SNAP_ANGLE of the horizontal, and leaves others alone', () => {
    expect(SNAP_ANGLE).toBeCloseTo((3 * Math.PI) / 180, 12);
    expect(dragToLaunch({ tangential: 1, radial: Math.tan(0.02) })!.angle).toBe(0);
    expect(Math.abs(dragToLaunch({ tangential: -1, radial: 0.02 })!.angle)).toBe(Math.PI);
    expect(dragToLaunch({ tangential: 1, radial: Math.tan(0.1) })!.angle).toBeCloseTo(0.1, 12);
  });
  it('clamps speed to [MIN_SPEED, MAX_SPEED]', () => {
    expect(dragToLaunch({ tangential: 0.1, radial: 0 })!.speed).toBe(MIN_SPEED);
    expect(dragToLaunch({ tangential: 5, radial: 0 })!.speed).toBe(MAX_SPEED);
  });
  it('rejects a non-finite or non-positive scale', () => {
    expect(dragToLaunch({ tangential: 1, radial: 0 }, { scale: 0 })).toBeNull();
    expect(dragToLaunch({ tangential: 1, radial: 0 }, { scale: Number.NaN })).toBeNull();
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
export const SNAP_ANGLE = (3 * Math.PI) / 180;

export interface DragVector { tangential: number; radial: number }

/** Maps a drag vector in the orbital plane (scene units) to launch parameters. One scene unit of drag = one unit of speed. */
export function dragToLaunch(d: DragVector, { scale = 1 }: { scale?: number } = {}): LaunchParams | null {
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const len = Math.hypot(d.tangential, d.radial);
  if (!Number.isFinite(len) || len < DEAD_ZONE) return null;
  const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, len * scale));
  let angle = Math.atan2(d.radial, d.tangential);
  if (Math.abs(angle) <= SNAP_ANGLE) angle = 0;
  else if (Math.PI - Math.abs(angle) <= SNAP_ANGLE) angle = Math.PI;
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

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/launch.ts tests/unit/launch.test.ts
git commit -m "feat(launch): map drag vectors to launch parameters with tangent snapping"
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
import { toSceneSatellites, ORBIT_RADIUS, RING_PHASE } from '@/lib/satellites';

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
  it('spreads satellites sharing a ring evenly in phase, starting at the ring base phase', () => {
    const out = toSceneSatellites([e('a', 'mid', 1), e('b', 'mid', 2), e('c', 'mid', 3)]);
    const phases = out.map((s) => s.phase);
    expect(phases[0]).toBeCloseTo(RING_PHASE.mid, 12);
    expect(phases[1]).toBeCloseTo(RING_PHASE.mid + (2 * Math.PI) / 3, 12);
    expect(phases[2]).toBeCloseTo(RING_PHASE.mid + (4 * Math.PI) / 3, 12);
  });
  it('gives different rings different base phases so single satellites never line up', () => {
    const out = toSceneSatellites([e('a', 'high', 1), e('b', 'mid', 2), e('c', 'low', 3)]);
    const [h, m, l] = out.map((s) => s.phase % (2 * Math.PI));
    expect(Math.abs(h! - m!)).toBeGreaterThan(1);
    expect(Math.abs(m! - l!)).toBeGreaterThan(1);
    expect(Math.abs(h! - l!)).toBeGreaterThan(1);
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
/** Each ring starts at its own phase so satellites on different rings never line up (labels would collide). */
export const RING_PHASE: Record<Orbit, number> = { high: 0, mid: (2 * Math.PI) / 3, low: (4 * Math.PI) / 3 };

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
    return { id: e.id, name: e.data.title, orbit: e.data.orbit, status: e.data.status, href: `/work/${e.id}`, phase: RING_PHASE[e.data.orbit] + (2 * Math.PI * i) / n };
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

### Task 9: Scene capabilities check, shared projection constants and SVG fallback

**Files:**
- Create: `src/scene/capabilities.ts`, `tests/unit/capabilities.test.ts`, `src/scene/projection.ts`, `src/scene/Fallback.astro`

**Interfaces:**
- Consumes: `SceneSatellite`, `ORBIT_RADIUS` (Task 8); `LAUNCH_RADIUS`, `circularPosition` (Task 6).
- Produces: `canRenderScene(env: EnvLike): boolean`, `browserEnv(w?): EnvLike`; `CAMERA_POSITION`, `VIEW_RADIUS`, `SQUASH` from `projection.ts` (plain numbers, no Three import — shared by the Three scene and the SVG so both frame the orbits the same way); `<Fallback satellites={SceneSatellite[]} />` renders an inline `<svg data-fallback>`.

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
import { CAMERA_POSITION, SQUASH } from '@/scene/projection';

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

describe('projection constants', () => {
  it('SQUASH matches the camera elevation so the SVG and the scene agree', () => {
    const [, y, z] = CAMERA_POSITION;
    expect(SQUASH).toBeCloseTo(Math.sin(Math.atan2(y, z)), 2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- capabilities
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement capabilities and projection**

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

`src/scene/projection.ts`:

```ts
/** Framing shared by the Three.js scene and the SVG fallback. Plain numbers: no Three import. */
export const CAMERA_POSITION = [0, 4, 8] as const; // orthographic camera looking at the origin; elevation ≈ 26.6°
export const VIEW_RADIUS = 3.8;                     // half-height of the orthographic frustum, scene units
export const SQUASH = 0.45;                         // ≈ sin(elevation): foreshortening of the orbital plane
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- capabilities
```

Expected: 7 passed.

- [ ] **Step 5: SVG fallback component**

`src/scene/Fallback.astro` — same framing as the 3D scene: the SVG holds only geometry (rings, planet, pad, satellite dots) in a 16:9 viewBox whose half-height is exactly `VIEW_RADIUS` scene units (`U = H / (2 · VIEW_RADIUS)` px per unit). The scene container (`.orbit-scene`, Task 10) is **always 16:9, on every viewport**, so the SVG fills it exactly (`xMidYMid meet`) and HTML labels positioned in percentages of the same box land precisely on their satellites. Labels are **HTML**, at a real 12 px in every viewport (the spec's minimum), matching the scene's CSS2D labels; the ellipsis lives on an inner span so the leader line drawn by `::before` is never clipped. Depth is modelled: the far half of each ring (sim y > 0, which the camera sees beyond the planet) and far-side satellites are drawn before the planet, the near half after it.

```astro
---
import type { SceneSatellite } from '@/lib/satellites';
import { ORBIT_RADIUS } from '@/lib/satellites';
import { LAUNCH_RADIUS, circularPosition } from '@/lib/orbit';
import { SQUASH, VIEW_RADIUS } from '@/scene/projection';
interface Props { satellites: SceneSatellite[] }
const { satellites } = Astro.props;

const H = 304; const W = (H * 16) / 9;          // 16:9 drawing — the .orbit-scene container is always 16:9 too
const U = H / (2 * VIEW_RADIUS);                // px per scene unit — identical framing to the Three camera
const cx = W / 2; const cy = H / 2;
const project = (p: { x: number; y: number }) => ({ x: cx + p.x * U, y: cy - p.y * U * SQUASH });
const pct = (p: { x: number; y: number }) => ({ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` });
const pad = project({ x: LAUNCH_RADIUS, y: 0 });
const rings = (['high', 'mid', 'low'] as const).map((o) => {
  const r = ORBIT_RADIUS[o] * U; const ry = r * SQUASH;
  // Far half (above centre) and near half (below centre) as two arcs so the planet can sit between them.
  return {
    far: `M ${cx - r} ${cy} A ${r} ${ry} 0 0 1 ${cx + r} ${cy}`,
    near: `M ${cx + r} ${cy} A ${r} ${ry} 0 0 1 ${cx - r} ${cy}`,
  };
});
const placed = satellites.map((s) => {
  const sim = circularPosition(ORBIT_RADIUS[s.orbit], s.phase);
  const p = project(sim);
  return { s, p, far: sim.y > 0, right: p.x / W < 0.62 };   // flip the label inward when it sits in the right 38 % of the frame
});
const dot = (s: SceneSatellite) => (s.status === 'active' ? 'var(--accent)' : 'var(--ink)');
const uid = `fb-${Math.random().toString(36).slice(2, 8)}`;
---
<div class="fallback" data-fallback>
  <svg class="fallback__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby={`${uid}-title`} aria-describedby={satellites.length ? `${uid}-desc` : undefined}>
    <title id={`${uid}-title`}>Planet with project satellites in orbit</title>
    {satellites.length > 0 && <desc id={`${uid}-desc`}>{satellites.map((s) => `${s.name} in ${s.orbit} orbit`).join('; ')}.</desc>}
    {rings.map((r) => <path d={r.far} fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 4" />)}
    {placed.filter((x) => x.far).map(({ s, p }) => <circle cx={p.x} cy={p.y} r={s.status === 'active' ? 5 : 4} fill={dot(s)} />)}
    <circle cx={cx} cy={cy} r={U} fill="var(--planet)" />
    <circle cx={cx - U * 0.25} cy={cy - U * 0.3} r={U * 0.8} fill="var(--planet-hi)" opacity="0.45" />
    {rings.map((r) => <path d={r.near} fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 4" />)}
    <circle cx={pad.x} cy={pad.y} r="2.5" fill="none" stroke="var(--ink)" />
    {placed.filter((x) => !x.far).map(({ s, p }) => <circle cx={p.x} cy={p.y} r={s.status === 'active' ? 5 : 4} fill={dot(s)} />)}
  </svg>
  {placed.map(({ s, p, right }) => (
    <span class:list={['fallback__label', 'mono', { 'fallback__label--left': !right }]} style={`left:${pct(p).left};top:${pct(p).top}`} aria-hidden="true"><span class="fallback__text">{s.name.toUpperCase()}</span></span>
  ))}
</div>
<style>
  .fallback { position: relative; width: 100%; height: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
  .fallback__svg { width: 100%; height: 100%; display: block; }
  .fallback__label {
    position: absolute; transform: translate(14px, -50%); width: max-content; max-width: 40%; font-size: 12px; letter-spacing: 0.04em;
    color: var(--ink-2); background: var(--paper); padding: 0 0.3em;
  }
  .fallback__text { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fallback__label::before { content: ''; position: absolute; left: -12px; top: 50%; width: 10px; border-top: 1px solid var(--ink-2); }
  .fallback__label--left { transform: translate(calc(-100% - 14px), -50%); }
  .fallback__label--left::before { left: auto; right: -12px; }
</style>
```

Also harden `src/scene/capabilities.ts`: every probe — `matchMedia`, `connection`, canvas creation and `getContext` — runs inside the `try`, so a `matchMedia` that throws or returns `null` yields `false` instead of an exception; release the probe context with `WEBGL_lose_context` when available. Add tests: `matchMedia: () => { throw new Error('x'); }` → `false`; `matchMedia: () => null as never` → `false`.

- [ ] **Step 6: Commit**

```bash
git add src/scene/capabilities.ts src/scene/projection.ts tests/unit/capabilities.test.ts src/scene/Fallback.astro
git commit -m "feat(scene): capability check, shared projection constants and static SVG fallback"
```

---

### Task 10: Three.js scene — planet, rings, satellites, drag-to-launch

**Files:**
- Create: `src/scene/planet.ts`, `src/scene/rings.ts`, `src/scene/satelliteMesh.ts`, `src/scene/scene.ts`, `src/scene/OrbitScene.astro`
- Modify: `package.json`

**Interfaces:**
- Consumes: `simulate`, `angularSpeed`, `circularPosition`, `LAUNCH_RADIUS`, `Outcome`, `LaunchParams` (Task 6); `dragToLaunch`, `formatSpeed`, `MIN_SPEED`, `MAX_SPEED` (Task 7); `loadVisitorSatellites`, `saveVisitorSatellite`, `MAX_VISITOR_SATELLITES`, `toSceneSatellites`, `ORBIT_RADIUS`, `SceneSatellite` (Task 8); `canRenderScene`, `browserEnv`, `CAMERA_POSITION`, `VIEW_RADIUS`, `Fallback` (Task 9).
- Produces: `mountOrbitScene(container: HTMLElement, opts: { satellites: SceneSatellite[]; storage: Storage | null; onOutcome?: (o: Outcome, speed: number) => void; onContextLost?: () => void }): { destroy(): void }`; `<OrbitScene satellites={SceneSatellite[]} />` Astro island. DOM hooks consumed by Task 14: the container `#orbit-scene` carries `data-state` (`fallback` | `pending` | `webgl`) and `data-ready="true"` after the first rendered frame; `[data-testid="launch-pad"]` marks the pad on screen; `[data-testid="launch-status"]` (`role="status"`) carries the hint and the outcome text.

Coordinate mapping: simulation plane `(x, y)` → Three `(x, 0, -y)`; orthographic camera at `CAMERA_POSITION` looking at the origin; one simulation unit = one Three unit; the frustum is sized so `VIEW_RADIUS` fits vertically. The scene never computes motion itself: satellite positions come from `circularPosition`/`angularSpeed`, trajectories from `simulate`.

Interaction contract: a drag starts only on `pointerdown` within `PAD_HIT_RADIUS` of the pad; the drag vector is measured from the pointer-down point on the orbital plane (so a click elsewhere can never launch); the preview is recomputed at most once per animation frame; `pointercancel` or lost capture cancels without launching. Keyboard: the container is focusable (`tabindex="0"`, `role="application"`), arrow keys aim (±5°) and set speed (±0.05 v₀), Enter launches, Escape clears. Live visitor satellites are capped at `MAX_VISITOR_SATELLITES` in memory as well as in storage; removed objects are disposed.

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
import type { Point } from '@/lib/orbit';

export const toThree = (p: Point): Vector3 => new Vector3(p.x, 0, -p.y);

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

/** A dashed path from simulation points. */
export function createPath(points: Point[], color = '#121412'): Line {
  const geo = new BufferGeometry().setFromPoints(points.map(toThree));
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
  Vector2, Vector3, Plane, Raycaster, Group, Mesh, Line, type Object3D,
} from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { simulate, angularSpeed, circularPosition, LAUNCH_RADIUS, type Outcome, type LaunchParams } from '@/lib/orbit';
import { dragToLaunch, formatSpeed, MIN_SPEED, MAX_SPEED } from '@/lib/launch';
import { ORBIT_RADIUS, type SceneSatellite } from '@/lib/satellites';
import { loadVisitorSatellites, saveVisitorSatellite, MAX_VISITOR_SATELLITES } from '@/lib/visitorSatellites';
import { CAMERA_POSITION, VIEW_RADIUS } from './projection';
import { createPlanet } from './planet';
import { createRing, createPath, toThree } from './rings';
import { createSatelliteMesh } from './satelliteMesh';

export interface MountOptions {
  satellites: SceneSatellite[];
  storage: Storage | null;
  onOutcome?: (outcome: Outcome, speed: number) => void;
  onContextLost?: () => void;
}

const LAUNCH_POINT = new Vector3(LAUNCH_RADIUS, 0, 0);
const PAD_HIT_RADIUS = 0.6;
const KEY_ANGLE_STEP = (5 * Math.PI) / 180;
const KEY_SPEED_STEP = 0.05;
const ORBIT_TIME_SCALE = 0.15;
const HINT = 'DRAG TO LAUNCH ↗';
const OUTCOME_TEXT: Record<Outcome, string> = { orbit: 'ORBIT ACHIEVED', escape: 'ESCAPE', suborbital: 'SUBORBITAL' };

function label(text: string, cls: string, attrs: Record<string, string> = {}): CSS2DObject {
  const el = document.createElement('div');
  el.className = `mono ${cls}`;
  el.textContent = text;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return new CSS2DObject(el);
}

function disposeTree(obj: Object3D) {
  obj.traverse((o) => {
    if (o instanceof Mesh || o instanceof Line) {
      o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose();
    }
  });
}

export function mountOrbitScene(container: HTMLElement, opts: MountOptions): { destroy(): void } {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(...CAMERA_POSITION);
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

  // Project satellites: position comes from orbit.ts, the scene only places meshes.
  const orbiters = opts.satellites.map((s) => {
    const radius = ORBIT_RADIUS[s.orbit];
    const g = new Group();
    g.add(createSatelliteMesh(s.status === 'active' ? 'active' : 'muted'));
    const l = label(s.name.toUpperCase(), 'scene-label'); l.position.set(0.18, 0, 0); g.add(l);
    scene.add(g);
    return { update(t: number) { const p = circularPosition(radius, s.phase + angularSpeed(radius) * t * ORBIT_TIME_SCALE); g.position.copy(toThree(p)); } };
  });

  // Visitor satellites: recomputed deterministically from stored params; capped in memory too.
  const visitors: { group: Group; update(t: number): void }[] = [];
  function addVisitor(p: LaunchParams) {
    const sim = simulate(p);
    if (sim.outcome !== 'orbit') return;
    const g = new Group();
    g.add(createPath(sim.points, '#6E736D'));
    const mesh = createSatelliteMesh('visitor'); g.add(mesh);
    scene.add(g);
    const n = sim.points.length; const period = sim.period ?? 6;
    visitors.push({ group: g, update(t) { const i = Math.floor(((t * 0.3) / period) * n) % n; mesh.position.copy(toThree(sim.points[i]!)); } });
    while (visitors.length > MAX_VISITOR_SATELLITES) { const old = visitors.shift()!; scene.remove(old.group); disposeTree(old.group); }
  }
  for (const v of loadVisitorSatellites(opts.storage)) addVisitor({ angle: v.angle, speed: v.speed });

  // Pad marker and status label (DOM, so tests and screen readers can see them).
  const padMarker = label('', 'scene-pad', { 'data-testid': 'launch-pad', 'aria-hidden': 'true' });
  padMarker.position.copy(LAUNCH_POINT); scene.add(padMarker);
  const status = label(HINT, 'scene-label scene-label--hint', { role: 'status', 'data-testid': 'launch-status' });
  status.position.set(LAUNCH_RADIUS + 0.25, 0, 0.45); scene.add(status);
  const setStatus = (text: string, accent = false) => { status.element.textContent = text; status.element.classList.toggle('scene-label--accent', accent); };

  // Launch interaction.
  const plane = new Plane(new Vector3(0, 1, 0), 0);
  const ray = new Raycaster();
  const ndc = new Vector2();
  let dragOrigin: Vector3 | null = null;
  let activePointer: number | null = null;
  let pendingPreview: LaunchParams | null | undefined; // undefined = nothing pending
  let preview: Line | null = null;
  let flyTimer: ReturnType<typeof setTimeout> | null = null;
  let aim: LaunchParams = { angle: 0, speed: 1 };

  function pointToPlane(ev: PointerEvent): Vector3 | null {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = new Vector3();
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  }
  function paramsFrom(ev: PointerEvent): LaunchParams | null {
    const p = pointToPlane(ev);
    if (!p || !dragOrigin) return null;
    const d = p.sub(dragOrigin);
    return dragToLaunch({ tangential: -d.z, radial: d.x }); // sim +y is Three -z
  }
  function clearPreview() { if (preview) { scene.remove(preview); disposeTree(preview); preview = null; } }
  function showPreview(p: LaunchParams | null) {
    clearPreview();
    if (!p) { setStatus(HINT); return; }
    const sim = simulate(p, { maxSteps: 6000 });
    preview = createPath(sim.points, sim.outcome === 'orbit' ? '#E2401C' : '#121412');
    scene.add(preview);
    setStatus(`${formatSpeed(p.speed)} · ${OUTCOME_TEXT[sim.outcome]}`);
  }
  function launch(p: LaunchParams) {
    clearPreview();
    const sim = simulate(p);
    setStatus(`${formatSpeed(p.speed)} · ${OUTCOME_TEXT[sim.outcome]}`, sim.outcome === 'orbit');
    if (sim.outcome === 'orbit') {
      saveVisitorSatellite(opts.storage, { ...p, launchedAt: Date.now() });
      addVisitor(p);
    } else {
      const fly = createPath(sim.points, '#121412'); scene.add(fly);
      if (flyTimer) clearTimeout(flyTimer);
      flyTimer = setTimeout(() => { scene.remove(fly); disposeTree(fly); flyTimer = null; }, 1800);
    }
    opts.onOutcome?.(sim.outcome, p.speed);
  }
  function cancelDrag() { dragOrigin = null; activePointer = null; pendingPreview = undefined; clearPreview(); setStatus(HINT); }

  const onDown = (ev: PointerEvent) => {
    if (activePointer !== null) return;
    const hit = pointToPlane(ev);
    if (!hit || hit.distanceTo(LAUNCH_POINT) > PAD_HIT_RADIUS) return;
    dragOrigin = hit; activePointer = ev.pointerId;
    renderer.domElement.setPointerCapture(ev.pointerId);
  };
  const onMove = (ev: PointerEvent) => { if (ev.pointerId === activePointer) pendingPreview = paramsFrom(ev); };
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== activePointer) return;
    const p = paramsFrom(ev);
    renderer.domElement.releasePointerCapture(ev.pointerId);
    dragOrigin = null; activePointer = null; pendingPreview = undefined;
    if (p) launch(p); else { clearPreview(); setStatus(HINT); }
  };
  const onCancel = (ev: PointerEvent) => { if (ev.pointerId === activePointer) cancelDrag(); };
  const onKey = (ev: KeyboardEvent) => {
    const step = (da: number, dv: number) => {
      aim = { angle: aim.angle + da, speed: Math.min(MAX_SPEED, Math.max(MIN_SPEED, aim.speed + dv)) };
      showPreview(aim);
    };
    switch (ev.key) {
      case 'ArrowLeft': step(KEY_ANGLE_STEP, 0); break;
      case 'ArrowRight': step(-KEY_ANGLE_STEP, 0); break;
      case 'ArrowUp': step(0, KEY_SPEED_STEP); break;
      case 'ArrowDown': step(0, -KEY_SPEED_STEP); break;
      case 'Enter': launch(aim); break;
      case 'Escape': clearPreview(); setStatus(HINT); break;
      default: return;
    }
    ev.preventDefault();
  };
  const el = renderer.domElement;
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('lostpointercapture', onCancel);
  el.style.touchAction = 'none';
  container.tabIndex = 0;
  container.setAttribute('role', 'application');
  container.setAttribute('aria-label', 'Launch toy: arrow keys aim and set speed, Enter launches, Escape clears');
  container.addEventListener('keydown', onKey);

  // Spec §6.5: on a lost WebGL context, degrade to the static fallback instead of a blank box.
  const onContextLost = (ev: Event) => {
    ev.preventDefault();
    console.info('[orbit] WebGL context lost; showing static fallback');
    handle.destroy();
    opts.onContextLost?.();
  };
  el.addEventListener('webglcontextlost', onContextLost);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    camera.left = -VIEW_RADIUS * aspect; camera.right = VIEW_RADIUS * aspect;
    camera.top = VIEW_RADIUS; camera.bottom = -VIEW_RADIUS;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // One resumable loop: visibility toggles `running`; `raf !== 0` guards against duplicate loops.
  let raf = 0; let running = true; let destroyed = false; const t0 = performance.now();
  function loop() {
    raf = 0;
    if (!running || destroyed) return;
    const t = (performance.now() - t0) / 1000;
    if (pendingPreview !== undefined) { showPreview(pendingPreview); pendingPreview = undefined; }
    for (const o of orbiters) o.update(t);
    for (const v of visitors) v.update(t);
    renderer.render(scene, camera);
    labels.render(scene, camera);
    if (container.dataset.ready !== 'true') container.dataset.ready = 'true';
    raf = requestAnimationFrame(loop);
  }
  function start() { if (raf === 0 && running && !destroyed) raf = requestAnimationFrame(loop); }
  const io = new IntersectionObserver(([e]) => { running = Boolean(e?.isIntersecting); if (running) start(); }, { threshold: 0.05 });
  io.observe(container);
  start();

  const handle = {
    destroy() {
      if (destroyed) return;
      destroyed = true; running = false;
      if (raf) cancelAnimationFrame(raf); raf = 0;
      if (flyTimer) clearTimeout(flyTimer);
      ro.disconnect(); io.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('lostpointercapture', onCancel);
      el.removeEventListener('webglcontextlost', onContextLost);
      container.removeEventListener('keydown', onKey);
      disposeTree(scene);
      renderer.dispose();
      el.remove();
      labels.domElement.remove();
      delete container.dataset.ready;
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
    el.dataset.state = 'pending';
    const fallback = el.querySelector<SVGElement>('[data-fallback]');
    const showFallback = () => { if (fallback) fallback.hidden = false; el.dataset.state = 'fallback'; };
    const start = async () => {
      try {
        const { mountOrbitScene } = await import('@/scene/scene');
        const satellites = JSON.parse(el.dataset.satellites ?? '[]');
        let storage: Storage | null = null;
        try { storage = window.localStorage; } catch { storage = null; }
        if (fallback) fallback.hidden = true;
        el.dataset.state = 'webgl';
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
  .orbit-scene:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
  .orbit-scene canvas { display: block; width: 100% !important; height: 100% !important; cursor: grab; }
  .orbit-scene canvas:active { cursor: grabbing; }
  .orbit-scene [data-fallback][hidden] { display: none; }
  .scene-labels { position: absolute; inset: 0; pointer-events: none; }
  .scene-label { position: relative; white-space: nowrap; color: var(--ink-2); background: var(--paper); padding: 0 0.3em; }
  .scene-label::before { content: ''; position: absolute; left: -12px; top: 50%; width: 10px; border-top: 1px solid var(--ink-2); }
  .scene-label--hint { border: 1px solid var(--ink); color: var(--ink); background: var(--surface); padding: 0.2em 0.6em; }
  .scene-label--hint::before { display: none; }
  .scene-label--accent { border-color: var(--accent); border-width: 2px; color: var(--ink); } /* accent border, ink text: 12px accent text fails AA */
  .scene-pad { width: 22px; height: 22px; border: 1px solid var(--ink); border-radius: 50%; background: transparent; }
  /* The scene stays 16:9 on every viewport: the SVG fallback and its HTML labels share this exact frame. */
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

Run `npm run dev`. Checklist (hand verification): rings dashed, planet faceted matte, both active projects in the accent on their rings (accent = active status), names in mono with a short leader line; a small circle marks the pad just outside the planet; dragging from the pad shows a live dashed preview and the `v · OUTCOME` label, dragging from anywhere else does nothing; release at ≈0.95–1.25 v₀ near tangential yields `ORBIT ACHIEVED` and a small grey satellite that persists on reload; Tab to the scene, press ArrowUp twice and Enter → an outcome; `DevTools → Rendering → Emulate prefers-reduced-motion` + reload shows the SVG fallback; in the console run `document.querySelector('#orbit-scene canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` and confirm the SVG fallback reappears with `data-state="fallback"`. Then check the home JS budget over **all** chunks the page loads:

```bash
npm run build && find dist/_astro -name '*.js' | while read f; do gzip -c "$f" | wc -c; done | awk '{s+=$1} END {print s " bytes gzip total (all chunks: the Three chunk is a dynamic import and never appears in index.html)"}'
```

Expected: ≤ 204800. If over budget, check that only named imports from `three` are used (no `import * as THREE`).

- [ ] **Step 6: Commit**

```bash
git add src/scene src/pages/index.astro package.json package-lock.json
git commit -m "feat(scene): Three.js orbit scene with drag-to-launch and keyboard controls"
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
  { k: 'Instruments', v: 'LaTeX (advanced) · MATLAB (intermediate)' },
  { k: 'Tooling', v: 'Cursor · Codex · Claude Code' },
];
---
<dl class:list={['specs', { 'specs--compact': compact }]}>
  {specs.map((s) => (<div><dt class="mono">{s.k}</dt><dd>{s.v}</dd></div>))}
</dl>
<style>
  /* Six items read as 3 × 2, not 4 + 2. */
  .specs { display: grid; gap: var(--space-3); grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
  @media (max-width: 899px) { .specs { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 599px) { .specs { grid-template-columns: 1fr; } }
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
      <p class="hero__lede">I build products from my own problems: a swipeable feed for discovering arXiv papers, with real users, and a pipeline that turns my handwritten notes into LaTeX. Second year, still building.</p>
      <p class="hero__cta">
        <a class="btn" href="#in-orbit">See what's in orbit</a>
        <a class="btn btn--accent" href="mailto:nicomg60@gmail.com">Contact</a>
      </p>
    </div>
    <aside class="hero__specs container" aria-label="Mission specs"><MissionSpecs compact /></aside>
  </section>

  <Section num="1" id="in-orbit" label="In orbit" title="Two satellites, both launched from the classroom.">
    <div class="grid-2">{work.map((e, i) => <SatelliteCard entry={e} index={i} />)}</div>
  </Section>

  <Section num="2" id="mission-specs" label="Mission specs" title="What I bring aboard.">
    <MissionSpecs />
    <div class="specs__note">
      <p>My way of working is simple. First I look for a need: while I work on other projects or on my degree, I run into plenty of needs nobody is covering. I write them down and ask who else has them. I rank the list from most to least pressing and look hard at the top three: do other people really have this need? Is it really uncovered, or is it covered and I just didn't know?</p>
      <p>If it is real, and I don't like the alternatives out there, I start the project and give it my time. I begin by looking for UI inspiration, then I build. I spend hours programming, but just as many testing and checking that the result is really what I wanted. Then I work with Claude Code and Codex in parallel.</p>
    </div>
  </Section>

  {posts.length > 0 && (
    <Section num="3" id="logbook" label="Logbook" title="Latest entries.">
      <PostList posts={posts} />
      <p><a class="mono mono--ink" href="/writing">All entries →</a></p>
    </Section>
  )}

  <Section num={posts.length > 0 ? '4' : '3'} id="ground-control" label="Ground control" title="Open to internships and junior roles.">
    <ul class="links mono" aria-label="Contact and social">
      <li><span>Email</span><a class="links__primary" href="mailto:nicomg60@gmail.com">nicomg60@gmail.com</a></li>
      <li><span>GitHub</span><a href="https://github.com/mugar123" rel="me">github.com/mugar123</a></li>
      <li><span>Building</span><a href="https://papertok.app" rel="me">papertok.app</a></li>
      <li><span>CV</span><a href="/cv">Read it on this site →</a></li>
    </ul>
  </Section>
</Base>

<style>
  .hero { position: relative; min-height: clamp(34rem, 78vh, 54rem); display: grid; align-items: end; }
  .hero__scene { position: absolute; inset: 0; display: flex; justify-content: flex-end; align-items: center; pointer-events: none; }
  .hero__scene :global(.orbit-scene) { width: min(62vw, 60rem); pointer-events: auto; }
  /* The copy never runs under the scene: on mid-size desktops it is capped by viewport width. */
  .hero__copy { position: relative; padding-block: var(--space-6) var(--space-5); max-width: min(40rem, 56vw); margin-inline: 0; margin-left: max(var(--space-4), calc((100% - var(--content-max)) / 2)); }
  .hero__copy h1 em { font-style: italic; }
  .hero__lede { font-size: var(--text-body); }
  .hero__cta { display: flex; gap: var(--space-3); flex-wrap: wrap; }
  .btn { font-family: var(--font-mono); font-size: var(--text-label); text-transform: uppercase; letter-spacing: 0.04em; text-decoration: none; border: 1px solid var(--ink); padding: 0.6em 1em; background: var(--surface); }
  /* Accent never carries 12px text (4.2:1 on white fails AA): it marks the border, text stays ink. */
  .btn--accent { border-color: var(--accent); border-width: 2px; color: var(--ink); }
  .btn:hover { background: var(--ink); color: var(--paper); }
  .btn--accent:hover { background: var(--ink); color: var(--paper); border-color: var(--accent); }
  .hero__specs { position: absolute; right: 0; bottom: var(--space-5); width: auto; margin-right: max(var(--space-4), calc((100% - var(--content-max)) / 2)); }
  /* Below 1100px the compact specs would sit on the scene's launch hint; §2 repeats them in full anyway. */
  @media (max-width: 1099px) { .hero__specs { display: none; } }
  .grid-2 { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); }
  .specs__note { margin-top: var(--space-4); }
  .links { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .links li { display: grid; grid-template-columns: 6rem 1fr; gap: var(--space-3); align-items: baseline; }
  .links a { font-size: var(--text-small); text-transform: none; letter-spacing: 0; }
  .links__primary { text-decoration-color: var(--accent); text-decoration-thickness: 2px; } /* accent as underline, text stays ink (AA) */
  @media (max-width: 767px) {
    .hero { min-height: 0; display: block; }
    .hero__scene { position: static; display: block; }
    .hero__scene :global(.orbit-scene) { width: 100%; }
    .hero__copy { padding-block: var(--space-4); margin-left: var(--space-4); }
    .hero__specs { position: static; margin: 0 var(--space-4) var(--space-4); }
  }
</style>
```

The two `specs__note` paragraphs are the owner's own account of his method, translated; do not add to them.

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
    {links && <p class="mono links">{links.map((l, i) => <>{i > 0 && ' · '}<a href={l.url}>{l.label}</a></>)}</p>}
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
    <!-- REVIEW: Nicolás to edit the bio. Facts below come from his CV; the method paragraphs are his own words, translated. -->
    <p>I am a second-year physics student at the Universidad de Salamanca (BSc, 2025–2029). I build software around needs I run into myself: PaperTok, a swipeable feed for discovering arXiv papers that about a hundred people use, and a pipeline that turns my handwritten lecture notes into compiled LaTeX.</p>
    <h2>How I work</h2>
    <p>My way of working is simple. First I look for a need: while I work on other projects or on my degree, I run into plenty of needs nobody is covering. I write them down and ask who else has them. I rank the list from most to least pressing and look hard at the top three: do other people really have this need? Is it really uncovered, or is it covered and I just didn't know?</p>
    <p>If it is real, and I don't like the alternatives out there, I start the project and give it my time. I begin by looking for UI inspiration, then I build. I spend hours programming, but just as many testing and checking that the result is really what I wanted. Then I work with Claude Code and Codex in parallel.</p>
    <h2>Mission specs</h2>
    <MissionSpecs />
    <p class="mono contact"><a class="links__primary" href="mailto:nicomg60@gmail.com">nicomg60@gmail.com</a> · <a href="https://github.com/mugar123">GitHub</a> · <a href="/cv">CV</a></p>
  </article>
</Base>
<style>
  .prose { padding-block: var(--space-5) var(--space-6); } .prose h2 { margin-top: var(--space-5); }
  .contact a { text-transform: none; letter-spacing: 0; }
  .links__primary { color: var(--ink); text-decoration-color: var(--accent); text-decoration-thickness: 2px; } /* accent as underline only (AA) */
</style>
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

### Task 12b: Native CV page, live background and custom cursor

**Files:**
- Create: `src/data/cv.ts`, `src/pages/cv.astro`, `src/components/CvEntry.astro`, `src/components/LiveBackground.astro`, `src/components/Cursor.astro`, `src/styles/print.css`, `tests/unit/cv.test.ts`
- Modify: `src/layouts/Base.astro` (mount `<Cursor />`, import print.css), `src/components/Nav.astro` (add `CV`)

**Interfaces:**
- Consumes: `Base`, `Hud` (Task 5); tokens and `.mono` utilities (Task 4).
- Produces: `cv` data object (typed, see below); `/cv` route; `<LiveBackground />` (CSS-only animated grid + rotating orbit rings, used by `/cv`); `<Cursor />` mounted once in `Base.astro`.

Design intent (spec §5.2): the CV is a *mission dossier* — big serif name, mono contact row, `§`-numbered sections, entries as rows with a mono date column and a leader line that lights up in the accent on hover. No phone, no grant, no a private application. Print gives a clean black-on-white A4.

```ts
// src/data/cv.ts shape
export interface CvEntry { title: string; subtitle?: string; period: string; where?: string; bullets?: string[]; href?: string }
export interface CvSection { id: string; label: string; entries: CvEntry[] }
export interface CvSkillGroup { label: string; items: string[] }
export const cv: { name: string; degree: string; faculty: string; location: string;
  contacts: { label: string; value: string; href: string }[]; sections: CvSection[]; skills: CvSkillGroup[] };
```

- [ ] **Step 1: Write the failing data tests**

`tests/unit/cv.test.ts` — the data file is the single source of truth for the CV, so its invariants are tested:

```ts
import { describe, it, expect } from 'vitest';
import { cv } from '@/data/cv';

const everything = JSON.stringify(cv).toLowerCase();

describe('cv data', () => {
  it('has the owner facts and nothing excluded', () => {
    expect(cv.name).toBe('Nicolás Muñoz García');
    expect(cv.contacts.map((c) => c.value)).toEqual(['nicomg60@gmail.com', 'github.com/mugar123', 'papertok.app']);
    expect(everything).not.toMatch(/\+34|623 ?409 ?632/);
    expect(everything).not.toContain('a-private-grant');
    expect(everything).not.toContain('application');
  });
  it('has the five sections in order, each non-empty', () => {
    expect(cv.sections.map((s) => s.id)).toEqual(['education', 'projects', 'activities', 'achievements']);
    for (const s of cv.sections) expect(s.entries.length).toBeGreaterThan(0);
    expect(cv.skills.length).toBeGreaterThanOrEqual(5);
  });
  it('every entry has a period and a title', () => {
    for (const s of cv.sections) for (const e of s.entries) { expect(e.title).toBeTruthy(); expect(e.period).toMatch(/\d{4}/); }
  });
});
```

(The "five" in the test name counts skills as the fifth block; the `sections` array holds four.)

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- cv
```

Expected: FAIL — cannot resolve `@/data/cv`.

- [ ] **Step 3: Write the data**

`src/data/cv.ts` (facts from the owner's CV, October 2026; the LaTeX lecture notes project became the pipeline, so it is described as such):

```ts
export interface CvEntry { title: string; subtitle?: string; period: string; where?: string; bullets?: string[]; href?: string }
export interface CvSection { id: string; label: string; entries: CvEntry[] }
export interface CvSkillGroup { label: string; items: string[] }

export const cv = {
  name: 'Nicolás Muñoz García',
  degree: 'BSc in Physics (2025–2029)',
  faculty: 'Faculty of Sciences, Universidad de Salamanca',
  location: 'Salamanca, Spain',
  contacts: [
    { label: 'Email', value: 'nicomg60@gmail.com', href: 'mailto:nicomg60@gmail.com' },
    { label: 'GitHub', value: 'github.com/mugar123', href: 'https://github.com/mugar123' },
    { label: 'Building', value: 'papertok.app', href: 'https://papertok.app' },
  ],
  sections: [
    {
      id: 'education', label: 'Education',
      entries: [
        { title: 'Universidad de Salamanca (USAL)', subtitle: 'BSc in Physics — expected June 2029', period: '2025 – present', where: 'Salamanca, Spain' },
        { title: 'Artificial neural networks: current models and deep learning', subtitle: 'Online course, BISITE Research Group · Universidad de Salamanca (September – October 2026)', period: '2026', href: 'https://bisite.usal.es/es/formacion/cursos/RNA' },
        { title: 'Upper secondary education (Bachillerato), science and technology track', subtitle: 'University entrance examination (PAU): 12.501/14 · average 9.06/10', period: '2023 – 2025' },
      ],
    },
    {
      id: 'projects', label: 'Projects',
      entries: [
        {
          title: 'PaperTok — papertok.app', subtitle: 'Founder and sole developer of a short-form discovery feed for arXiv papers', period: '2025 – present', href: 'https://github.com/mugar123/papertok',
          bullets: [
            'Built and shipped a full web application that reformats arXiv preprints into a swipeable, TikTok-style feed, so that students and researchers discover relevant literature outside their existing reading habits; around 100 users since launch.',
            'React, Vite, Firebase (authentication, Firestore, hosting), KaTeX for in-browser mathematical notation, Transformers.js (Xenova) for client-side embeddings, and a Python proxy service for the arXiv API.',
            'Designed and iterated on the recommendation engine, which builds a semantic profile from user interactions and ranks incoming preprints against it; refactored the recommendation hook and hardened the Firebase configuration after an internal security review.',
          ],
        },
        {
          title: 'Notes → LaTeX pipeline', subtitle: 'Handwritten lecture notes transcribed into compiled LaTeX, automatically', period: '2025 – present',
          bullets: [
            'Started as self-authored, typeset course notes shared with classmates: full documents on multivariable integration and on linear transformations and determinants, with original TikZ figures illustrating diffeomorphisms as deformations of a coordinate grid.',
            'Grew into a Python pipeline that photographs a page, runs it through a mix of open-source and closed models, and emits LaTeX that compiles. Code private for now.',
            'LaTeX (MacTeX, VS Code), TikZ, custom theorem environments and page styling.',
          ],
        },
      ],
    },
    {
      id: 'activities', label: 'Extracurricular activities',
      entries: [
        { title: 'Member, Supernova', subtitle: 'Student association, Universidad de Salamanca', period: '2025 – present' },
        { title: 'Participant, astronomy outreach activities organised by Supernova', period: '2025 – 2026' },
      ],
    },
    {
      id: 'achievements', label: 'Achievements',
      entries: [
        { title: 'PAU score of 12.501/14', subtitle: 'Spanish university entrance examination', period: '2025' },
        { title: 'Participant, Spanish Physics Olympiad (Olimpiada de Física)', subtitle: 'Two consecutive editions', period: '2024, 2025' },
      ],
    },
  ] satisfies CvSection[],
  skills: [
    { label: 'Programming languages', items: ['Python', 'MATLAB (intermediate)', 'JavaScript'] },
    { label: 'Frameworks and libraries', items: ['React', 'Vite', 'Transformers.js', 'KaTeX'] },
    { label: 'Cloud and databases', items: ['Firebase (Firestore, Authentication, Hosting)'] },
    { label: 'Developer tools', items: ['Git', 'GitHub', 'VS Code', 'LaTeX (advanced)', 'TikZ', 'macOS', 'Claude Code', 'Codex', 'Cursor'] },
    { label: 'Languages', items: ['Spanish (native)', 'English (B2, certified by the Escuela Oficial de Idiomas)'] },
    { label: 'Coursework', items: ['Mathematical analysis (multivariable calculus, measure theory and Lebesgue integration, vector calculus)', 'Linear and multilinear algebra (Jordan canonical form, tensor products, bilinear and quadratic forms)', 'Electromagnetism'] },
    { label: 'Areas of interest', items: ['Computational physics', 'Machine learning applied to scientific literature', 'Recommender systems', 'Astronomy'] },
  ] satisfies CvSkillGroup[],
};
```

Note: "Claude Code, Codex, Cursor" under developer tools is the one addition to the PDF's list; the owner stated this in conversation (Mission specs), so it is not invented.

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- cv
```

Expected: 3 passed.

- [ ] **Step 5: CvEntry and LiveBackground components**

`src/components/CvEntry.astro`:

```astro
---
import type { CvEntry } from '@/data/cv';
interface Props { entry: CvEntry }
const { entry } = Astro.props;
---
<li class="entry">
  <span class="entry__period mono">{entry.period}</span>
  <div class="entry__body">
    <h3>{entry.href ? <a href={entry.href} rel="noopener">{entry.title}</a> : entry.title}</h3>
    {entry.subtitle && <p class="entry__sub">{entry.subtitle}</p>}
    {entry.where && <p class="entry__where mono">{entry.where}</p>}
    {entry.bullets && <ul class="entry__bullets">{entry.bullets.map((b) => <li>{b}</li>)}</ul>}
  </div>
</li>
<style>
  .entry { display: grid; grid-template-columns: 9rem 1fr; gap: var(--space-4); padding: var(--space-3) 0; position: relative; }
  .entry + .entry { border-top: 1px solid var(--grid); }
  .entry__period { padding-top: 0.35em; position: relative; }
  .entry__period::after { content: ''; position: absolute; top: 0.95em; right: -1.25rem; width: 1rem; border-top: 1px solid var(--grid); transition: border-color var(--dur) var(--ease), width var(--dur) var(--ease); }
  /* The 12px date stays ink (accent text that small fails AA); the leader line carries the accent. */
  .entry:hover .entry__period { color: var(--ink); }
  .entry:hover .entry__period::after { border-color: var(--accent); border-top-width: 2px; width: 1.5rem; }
  h3 { font-size: 1.25rem; margin: 0; }
  h3 a { text-decoration: none; } h3 a:hover { text-decoration: underline; }
  .entry__sub { margin: 0.15em 0 0; font-style: italic; }
  .entry__where { margin: 0.25em 0 0; }
  .entry__bullets { margin: var(--space-2) 0 0; padding-left: 1.1em; font-size: var(--text-small); display: grid; gap: var(--space-1); }
  @media (max-width: 767px) { .entry { grid-template-columns: 1fr; gap: var(--space-1); } .entry__period::after { display: none; } }
</style>
```

`src/components/LiveBackground.astro` — CSS only; sits behind the page, never intercepts pointer events:

```astro
---
---
<div class="live" aria-hidden="true">
  <svg class="live__orbits" viewBox="0 0 800 800">
    <ellipse cx="400" cy="400" rx="380" ry="150" />
    <ellipse cx="400" cy="400" rx="260" ry="102" />
    <ellipse cx="400" cy="400" rx="150" ry="59" />
    <circle cx="400" cy="400" r="26" />
  </svg>
</div>
<style>
  .live { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden;
    background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
    background-size: var(--grid-cell) var(--grid-cell);
    animation: drift 90s linear infinite; }
  .live__orbits { position: absolute; right: -12vw; top: 50%; width: min(70vw, 56rem); translate: 0 -50%; opacity: 0.22;
    fill: none; stroke: var(--ink); stroke-width: 1; stroke-dasharray: 4 6; animation: spin 180s linear infinite; }
  .live__orbits circle { fill: var(--planet); stroke: none; opacity: 0.6; }
  @keyframes drift { to { background-position: var(--grid-cell) var(--grid-cell); } }
  @keyframes spin { to { rotate: 360deg; } }
  @media (prefers-reduced-motion: reduce) { .live, .live__orbits { animation: none; } }
  @media print { .live { display: none; } }
</style>
```

- [ ] **Step 6: Custom cursor**

`src/components/Cursor.astro` — mounted once in `Base.astro`. Fine pointers only; off under reduced motion; the native cursor stays on text inputs.

```astro
---
---
<div class="cursor" aria-hidden="true" hidden>
  <span class="cursor__dot"></span>
  <span class="cursor__ring"><span class="cursor__label mono">LAUNCH</span></span>
</div>

<script>
  // Guarded: no matchMedia → native cursor, no error. Preferences are live: enabling reduced motion or
  // losing the fine pointer mid-visit disables the custom cursor without a reload.
  const root = document.querySelector<HTMLElement>('.cursor');
  const mm = typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;
  const fineQ = mm?.('(pointer: fine)');
  const motionQ = mm?.('(prefers-reduced-motion: no-preference)');
  const allowed = () => Boolean(root && fineQ?.matches && motionQ?.matches);
  let enabled = false;
  const enable = () => { /* body as below, registering listeners and starting the loop */ };
  const disable = () => { /* remove has-cursor, hide root, remove listeners, cancelAnimationFrame */ };
  const sync = () => { const ok = allowed(); if (ok && !enabled) enable(); else if (!ok && enabled) disable(); };
  fineQ?.addEventListener?.('change', sync);
  motionQ?.addEventListener?.('change', sync);
  sync();
  // Implementation note: structure `enable`/`disable` so the pointermove/leave/enter listeners and the
  // rAF handle are stored in closure variables that `disable` can remove and cancel; the original body:
  if (false && root) {
    root.hidden = false;
    document.documentElement.classList.add('has-cursor');
    const dot = root.querySelector<HTMLElement>('.cursor__dot')!;
    const ring = root.querySelector<HTMLElement>('.cursor__ring')!;
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      dot.style.transform = `translate(${x}px, ${y}px)`;
      const t = e.target as Element | null;
      root.classList.toggle('is-link', Boolean(t?.closest('a, button, [role="button"]')));
      root.classList.toggle('is-launch', Boolean(t?.closest('#orbit-scene')));
      root.classList.toggle('is-text', Boolean(t?.closest('input, textarea, [contenteditable]')));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(tick) : 0;
    };
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerleave', () => root.classList.add('is-out'));
    addEventListener('pointerenter', () => root.classList.remove('is-out'));
  }
</script>

<style is:global>
  html.has-cursor, html.has-cursor a, html.has-cursor button { cursor: none; }
  html.has-cursor input, html.has-cursor textarea { cursor: auto; }
  .cursor { position: fixed; inset: 0; pointer-events: none; z-index: 1000; }
  .cursor[hidden] { display: none; }
  .cursor__dot, .cursor__ring { position: absolute; top: 0; left: 0; border-radius: 50%; will-change: transform; }
  .cursor__dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; background: var(--accent); }
  .cursor__ring { width: 28px; height: 28px; margin: -14px 0 0 -14px; border: 1px solid var(--ink); display: grid; place-items: center;
    transition: width var(--dur) var(--ease), height var(--dur) var(--ease), margin var(--dur) var(--ease), background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), opacity var(--dur) var(--ease); }
  .cursor__label { font-size: 12px; color: var(--ink); opacity: 0; transition: opacity var(--dur) var(--ease); } /* ink, 12px: AA + spec minimum */
  .cursor.is-link .cursor__ring { width: 40px; height: 40px; margin: -20px 0 0 -20px; background: rgba(226, 64, 28, 0.12); border-color: var(--accent); }
  .cursor.is-launch .cursor__ring { width: 56px; height: 56px; margin: -28px 0 0 -28px; border-style: dashed; border-color: var(--accent); }
  .cursor.is-launch .cursor__label { opacity: 1; }
  .cursor.is-text .cursor__ring, .cursor.is-text .cursor__dot, .cursor.is-out .cursor__ring, .cursor.is-out .cursor__dot { opacity: 0; }
  @media print { .cursor { display: none; } }
</style>
```

In `src/layouts/Base.astro`: import `Cursor` and render `<Cursor />` as the last child of `<body>`; import `@/styles/print.css`.

- [ ] **Step 7: Print stylesheet**

`src/styles/print.css`:

```css
@media print {
  @page { size: A4; margin: 16mm; }
  body { background: #fff !important; color: #000; font-size: 11pt; line-height: 1.4; }
  nav, footer, .skip, .cursor, .no-print { display: none !important; }
  main { padding: 0; }
  a { color: #000; text-decoration: none; }
  a[href^='http']::after { content: ' (' attr(href) ')'; font-size: 0.85em; color: #444; }
  .mono { color: #333; }
  h1 { font-size: 22pt; } h2 { font-size: 14pt; margin-top: 10pt; } h3 { font-size: 11.5pt; }
  .entry { break-inside: avoid; }
}
```

- [ ] **Step 8: The page**

`src/pages/cv.astro`:

```astro
---
import Base from '@/layouts/Base.astro';
import CvEntry from '@/components/CvEntry.astro';
import LiveBackground from '@/components/LiveBackground.astro';
import { cv } from '@/data/cv';
---
<Base title="CV — Nicolás Muñoz García" description="Physics student at the Universidad de Salamanca; founder of PaperTok.">
  <LiveBackground />
  <article class="cv container">
    <header class="cv__head">
      <p class="mono">Mission dossier · updated 2026-10</p>
      <h1>{cv.name}</h1>
      <p class="cv__degree">{cv.degree} · {cv.faculty}<br />{cv.location}</p>
      <ul class="cv__contacts mono" aria-label="Contact">
        {cv.contacts.map((c) => <li><span>{c.label}</span><a href={c.href} rel={c.href.startsWith('http') ? 'me noopener' : undefined}>{c.value}</a></li>)}
      </ul>
      <p class="no-print"><button class="btn" type="button" id="print">Print / save as PDF</button></p>
    </header>

    {cv.sections.map((s, i) => (
      <section class="cv__section" aria-labelledby={`cv-${s.id}`}>
        <p class="mono">§{i + 1} · {s.label}</p>
        <h2 id={`cv-${s.id}`} class="visually-hidden">{s.label}</h2>
        <ol class="cv__entries">{s.entries.map((e) => <CvEntry entry={e} />)}</ol>
      </section>
    ))}

    <section class="cv__section" aria-labelledby="cv-skills">
      <p class="mono">§{cv.sections.length + 1} · Technical skills and interests</p>
      <h2 id="cv-skills" class="visually-hidden">Technical skills and interests</h2>
      <dl class="cv__skills">
        {cv.skills.map((g) => (<div><dt class="mono">{g.label}</dt><dd>{g.items.join(' · ')}</dd></div>))}
      </dl>
    </section>
  </article>
</Base>

<script>
  document.getElementById('print')?.addEventListener('click', () => window.print());
</script>

<style>
  .cv { padding-block: var(--space-5) var(--space-7); max-width: 56rem; }
  .cv__head { margin-bottom: var(--space-6); }
  .cv__head h1 { font-size: var(--text-h1); margin: var(--space-2) 0 var(--space-3); }
  .cv__degree { font-size: 1.125rem; }
  .cv__contacts { list-style: none; margin: var(--space-3) 0 var(--space-4); padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-3) var(--space-5); }
  .cv__contacts li { display: flex; gap: 0.6em; align-items: baseline; }
  .cv__contacts a { text-transform: none; letter-spacing: 0; color: var(--ink); }
  .btn { font-family: var(--font-mono); font-size: var(--text-label); text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid var(--ink); padding: 0.6em 1em; background: var(--surface); color: var(--ink); }
  .btn:hover { background: var(--ink); color: var(--paper); }
  .cv__section { margin-top: var(--space-5); background: var(--surface); border: 1px solid var(--grid); padding: var(--space-4); }
  .cv__section > .mono { margin: 0 0 var(--space-2); }
  .cv__entries { list-style: none; margin: 0; padding: 0; }
  .cv__skills { display: grid; gap: var(--space-3); margin: 0; }
  .cv__skills div { display: grid; grid-template-columns: 9rem 1fr; gap: var(--space-4); }
  dd { margin: 0; font-size: var(--text-small); }
  @media (max-width: 767px) { .cv__skills div { grid-template-columns: 1fr; gap: var(--space-1); } }
</style>
```

Add `{ href: '/cv', label: 'CV' }` to the `items` array in `src/components/Nav.astro`.

- [ ] **Step 9: Verify**

```bash
npm test && npm run build && npm run check && ls dist/cv/index.html && grep -c 'nicomg60@gmail.com' dist/cv/index.html && ! grep -qi 'a-private-grant\|application\|[redacted]' dist/cv/index.html && echo "CV CLEAN"
```

Expected: tests pass, build and check clean, `CV CLEAN`. In `npm run dev` on a laptop: the grid drifts slowly and the rings rotate behind the content; the cursor ring lags the dot and grows over links; on `/`, hovering the scene shows `LAUNCH` in the ring; with `prefers-reduced-motion` emulated, the background is static and the native cursor is back; `Cmd+P` preview shows a clean black-on-white CV with no nav, footer or background and with URLs printed after links.

- [ ] **Step 10: Commit**

```bash
git add src/data/cv.ts src/pages/cv.astro src/components/CvEntry.astro src/components/LiveBackground.astro src/components/Cursor.astro src/styles/print.css src/layouts/Base.astro src/components/Nav.astro tests/unit/cv.test.ts
git commit -m "feat: native CV page with live background and custom cursor"
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
```

`tests/e2e/pages.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

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

test('cv page: no phone number, no grant, print action present', async ({ page }) => {
  await page.goto('/cv');
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/\+34|623 ?409 ?632/);
  expect(text.toLowerCase()).not.toContain('a-private-grant');
  expect(text.toLowerCase()).not.toContain('application');
  await expect(page.getByRole('button', { name: /print|save as pdf/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nicolás Muñoz García');
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
```

`tests/e2e/a11y.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const path of ['/', '/work/papertok', '/about', '/cv']) {
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

`lighthouserc.json` — mobile emulation (Lighthouse's default, with 4G-class throttling) so the LCP budget is the spec's "4G" budget, three runs with the median:

```json
{
  "ci": {
    "collect": { "staticDistDir": "./dist", "url": ["http://localhost/index.html", "http://localhost/about/index.html"], "numberOfRuns": 3 },
    "assert": {
      "aggregationMethod": "median",
      "assertions": {
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.01 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
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

- [ ] **Step 3: Deploy workflow (official Astro action, gated on CI)**

Deployment runs only after the `CI` workflow succeeds on `main`, so a red build can never publish.

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with: { ref: main }
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

- [ ] **Step 1: Confirm the spec amendments made during pre-flight**

Spec §6.1 (Astro 7.x), §6.2 (no `slug` field, `cover` deferred), §3 (launch pad at 1.05, tangent snapping), §5.1 (contiguous numbering, mobile and keyboard behaviour) were amended before implementation started. Re-read them against the shipped code and fix any drift.

- [ ] **Step 2: Mark the open items**

In spec §8, add the current state of each item: copy (drafted in Task 11, marked REVIEW), PaperTok/pipeline assets (pending from Nicolás), CV PDF at `public/cv.pdf` (pending), LinkedIn handle (pending), visitor ship (code-built octahedron chosen; no external model needed).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-15-personal-website-design.md
git commit -m "docs: update spec with implementation outcomes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```
