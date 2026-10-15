# Personal website — design spec

**Date:** 2026-10-15
**Owner:** Nicolás Muñoz García
**Status:** approved in conversation; pending implementation plan

## 1. Purpose

A personal website that works as portfolio, presentation and blog, aimed primarily at **recruiters and companies** evaluating Nicolás for internships and junior roles. It must do three things, in this order:

1. In under 10 seconds, make clear who he is: a 2nd-year physics student at the Universidad de Salamanca who already ships products.
2. Show the two projects with enough substance that a technical recruiter trusts them.
3. Make contact and the CV one click away.

Success looks like: a recruiter lands, understands the pitch, scrolls through two projects and the skills, and clicks email or LinkedIn.

## 2. Non-goals (v1)

- No dark mode. The graph-paper identity *is* the light theme. Colors are tokens, so it can come later.
- No contact form, newsletter, comments or analytics requiring a backend. GitHub Pages is static.
- No CMS. Content is Markdown in the repo.
- No Spanish version. English only.
- No custom domain yet. `https://mugar123.github.io/` first; a domain is a later config change plus `CNAME`.

## 3. Concept: escape velocity

The site tells one story: **the student who is already leaving the classroom's gravity**. One memorable interactive 3D object carries it, over a calm, readable base — the pattern shared by the reference sites (mikes.cv, cindyly.design, tomjohn.design, meliketurgut.com).

- **The planet** is the classroom (Salamanca).
- **Satellites in orbit** are things actually launched: projects. Higher orbit = bigger project.
- **The toy:** the visitor drags to set launch angle and speed from the planet's surface. The trajectory is computed with real two-body physics. Too slow → falls back. Fast enough → stays in a low orbit as a small satellite of their own (persisted per visitor in `localStorage`). Faster than escape velocity → leaves the scene. The three outcomes are labelled in mono type (`SUBORBITAL` / `ORBIT ACHIEVED` / `ESCAPE`).
- **Skills are not satellites.** A satellite is something launched, not an ability. Skills live in a text panel called *Mission specs*.

### 3.1 Content in orbit (initial)

| id | name | orbit | status | one-liner |
|---|---|---|---|---|
| `papertok` | PaperTok | high | active | Study app born from how he studies himself. |
| `notes-to-latex` | Notes → LaTeX pipeline | mid | active | Handwritten notes transcribed to compiled LaTeX automatically, combining open-source and closed models. |

Visitor launches that reach orbit occupy the **low** orbit band and are visually smaller and lighter than real satellites.

### 3.2 Mission specs (strengths to highlight)

Building things · Product design · Python · Neural networks · Advanced use of AI coding tools (Cursor, Codex, Claude Code). The AI-tooling point also gets one explicit sentence in prose, not just a label — it is a differentiator for recruiters right now.

## 4. Visual direction

### 4.1 Palette (approved: "graph paper + vermilion")

| token | value | role |
|---|---|---|
| `--paper` | `#F2F3F1` | page background |
| `--grid` | `#DADDD8` | graph-paper lines (CSS gradients, 20–24 px cell) |
| `--ink` | `#121412` | text, orbit lines, borders |
| `--ink-2` | `#6E736D` | secondary text, mono labels |
| `--accent` | `#E2401C` | the only accent: active satellite, primary CTA, live status |
| `--planet` | `#5E6B7A` | matte planet; highlight `#7B8898` |
| `--surface` | `#FFFFFF` | cards on top of the grid |

Rules: exactly one accent, used only for what is "alive" (PaperTok/active status, the primary CTA, the visitor's successful launch). All text/background pairs pass WCAG AA; `--ink-2` on `--paper` is for labels ≥ 12 px mono only, never body text.

### 4.2 Typography (approved: "paper")

- **Latin Modern** (the LaTeX font; GUST Font License, free) for headings and body. Self-hosted WOFF2, subset to Latin.
- **JetBrains Mono** (OFL) for labels, dates, section numbers, Mission specs and all scene annotations. Self-hosted, subset.
- Because Latin Modern is thin on screen: body text **18–19 px**, line-height ≥ 1.6, never lighter than `--ink`; measure 60–70 characters; headings use regular weight with italics for emphasis, no faux bold.
- Sections are numbered like a paper: `§0 ABSTRACT`, `§1 IN ORBIT`, …

### 4.3 Components and motion

- Cards are white, 1 px `--grid` border, square corners, sitting on the graph paper.
- Motion is purposeful and sparse: hero text fades in (CSS only); section reveals on scroll with ~300 ms ease-out; the only continuous motion is the orbiting satellites. Everything stops under `prefers-reduced-motion`.
- The 3D style is a **physics diagram**: matte/clay planet, dashed orbit lines, small polyhedral satellites, mono labels with leader lines, no textures, no bloom, no starfield.

## 5. Information architecture

### 5.1 Home (`/`) — order approved

| § | block | content |
|---|---|---|
| 0 | **Abstract / hero** — full-bleed | 3D scene fills the hero width, planet offset right. Bottom-left: headline *"Physics student at Salamanca. Already in orbit."* (final copy TBD in implementation, same shape), one sentence, two CTAs: `SEE WHAT'S IN ORBIT` (secondary) and `CONTACT` (accent). Bottom-right: compact Mission specs in mono. Hint label `drag to launch ↗` near the planet. |
| 1 | **In orbit** | One card per satellite from the `work` collection: `SAT-0n · ORBIT · STATUS`, name, one-liner, stack tags in mono, link to its page. |
| 2 | **Mission specs** | The five strengths as short items, plus one paragraph on how he works with AI coding agents. |
| 3 | **Logbook** | Latest 3 posts from `writing`, link to `/writing`. Hidden automatically if there are no posts. |
| 4 | **Ground control** | "Open to internships and junior roles." Email (accent), LinkedIn, GitHub, CV (PDF). |
| — | footer | `SALAMANCA · 40.96° N, 5.67° W · CET` · `LAST UPDATED <build date>` |

Hero behaviour: text is server-rendered and visible immediately; the scene mounts afterwards on top. On viewports < 768 px the scene becomes a shorter top band (≈ 45 vh) and text stacks below; the launch interaction works with touch.

### 5.2 Other pages

- `/work/<slug>` — one page per satellite: problem, what was built, stack, outcome, screenshots/links. Rendered from `work` Markdown.
- `/writing` — all posts, newest first. `/writing/<slug>` — post page, same type rules, 65–70 ch measure.
- `/about` — longer bio, the Salamanca/physics story, how he works with AI tools, CV link.
- `/rss.xml`, `/sitemap-index.xml`, `robots.txt`, Open Graph image (static, graph paper + title).
- `404` — a suborbital joke: "Trajectory decayed." with a link home.

## 6. Technical architecture

### 6.1 Stack

- **Astro 5**, `output: 'static'`, `site: 'https://mugar123.github.io'`, no `base` (repo named `mugar123.github.io`).
- **Three.js** (no React Three Fiber) inside an Astro island `<OrbitScene />`, hydrated with `client:visible`. React is not required anywhere in v1.
- **Plain CSS** with custom properties; no Tailwind. Global tokens in `src/styles/tokens.css`.
- **TypeScript** everywhere, `strict`.

### 6.2 Content model (`src/content/`)

```ts
// work
{ title, slug, orbit: 'high' | 'mid' | 'low', status: 'active' | 'paused' | 'retired',
  launched: Date, oneLiner, stack: string[], links?: {label, url}[], cover?: image, order: number }
// writing
{ title, slug, date: Date, summary, tags?: string[], draft?: boolean }
```

Validated with Zod via content collections. Invalid frontmatter fails the build. The scene reads `work` at build time and receives satellites as serialized props, so adding a project is adding one Markdown file.

### 6.3 Modules

| module | responsibility | depends on |
|---|---|---|
| `src/lib/orbit.ts` | Pure functions. `simulate({angle, speed, steps})` → trajectory points and outcome (`suborbital` / `orbit` / `escape`); `escapeSpeed(r)`, `circularSpeed(r)`. Normalized units (planet radius = 1, GM = 1). No DOM, no Three. | nothing |
| `src/scene/OrbitScene.astro` + `scene.ts` | Builds the Three.js scene from props: planet, dashed orbit rings per band, satellites placed on their ring and animated along it, labels (CSS2D or sprites). Pointer/touch drag → calls `orbit.ts`, draws the trajectory, spawns a visitor satellite on success. Resizes, pauses when off-screen. | `orbit.ts`, three |
| `src/scene/fallback.astro` | Static SVG of the same scene (planet, rings, satellites). Shown when WebGL is unavailable, `prefers-reduced-motion` is set, or `saveData`/low-end heuristics trigger. Always present in HTML as `<noscript>`/pre-hydration content. | content |
| `src/lib/visitorSatellites.ts` | Read/write the visitor's successful launches to `localStorage` (cap 3, try/catch, no PII). | nothing |
| layouts & components | `Base.astro` (head, fonts, grid background, nav, footer), `Section.astro` (§ number + title), `SatelliteCard.astro`, `MissionSpecs.astro`, `PostList.astro`. | content |

### 6.4 3D assets

Planet, rings and satellites are **code-built primitives** (sphere with `MeshStandardMaterial` flat-ish shading, `LineDashedMaterial` rings, small icosahedra). The visitor's ship is sourced from an open repository (Poly Pizza, Kenney, Quaternius; CC0 or CC-BY) **only if it matches the matte low-poly diagram look**; otherwise it is a code-built capsule. Every external asset is listed with license and source in `public/models/CREDITS.md`. Models are glTF, Draco-compressed, ≤ 150 KB each.

### 6.5 Performance and fallbacks

- Budgets: hero text LCP < 2.5 s on 4G; CLS = 0 (scene container has fixed aspect); total JS on home ≤ 200 KB gzip including Three.
- Three is loaded only on the home hero; other pages ship no Three.
- Fonts: `font-display: swap` with size-adjusted fallbacks to avoid layout shift.
- If the WebGL context is lost or a model fails to load, the scene degrades to primitives, then to the SVG fallback. Errors are logged to console only.

### 6.6 Deployment

GitHub repo `mugar123/mugar123.github.io`, branch `main`. GitHub Actions workflow using `withastro/action` → `actions/deploy-pages`. Build on every push to `main`; PR builds run checks without deploying.

### 6.7 Quality

- **Vitest**: `orbit.ts` (circular speed yields orbit, below yields suborbital, above escape yields escape; energy conservation within tolerance), `visitorSatellites.ts`, content schema fixtures.
- **Playwright** smoke: home renders hero text with JS disabled; canvas mounts with JS; drag produces a trajectory; nav works; each content page renders.
- **CI**: typecheck, tests, build, Lighthouse CI against budgets, axe accessibility scan on home and one post.
- Manual checklist before launch: real device test on iPhone and a low-end Android, keyboard navigation, reduced-motion mode.

## 7. Copy and tone

English, first person, short sentences, physics vocabulary used lightly and correctly (never a pun that would make a physicist wince). Headlines are sentence case. Labels are UPPERCASE mono. Nicolás reviews all copy before launch.

## 7.1 References

Personal sites that set the pattern (calm base + one memorable interactive object): mikes.cv, shubhu.site, cindyly.design, tomjohn.design, meliketurgut.com, ysuriadesign.com. Ongoing inspiration feed: inspora.design (filters *3D* and *Web*).

Notes taken from Inspora for implementation, not changing any decision:

- Matte, light-on-light 3D objects with a single colored detail validate the "physics diagram" style — keep the planet untextured and let the accent do the work.
- A huge serif name as the opening line of §0 (paper-title scale, above the scene) is a composition option to try alongside the approved headline.
- HUD-style mono panels (1 px border, small, no color except the accent) are the shape for *Mission specs* and the launch outcome labels.

## 8. Open items for the implementation plan

- Final headline and one-liner copy.
- PaperTok and pipeline assets (screenshots, App Store link, repo links if public).
- CV PDF and social links.
- Whether the visitor ship comes from a repository or code (decided during implementation per §6.4).

## 9. Decisions log

| decision | choice | rejected |
|---|---|---|
| Framework | Astro | Next.js static export, Eleventy |
| Hosting | GitHub Pages at root | Vercel, Netlify |
| Content | Markdown in repo | CMS |
| Direction | calm base + one 3D object (reference pattern) | neo-brutalist (misclick) |
| Metaphor | escape velocity, planet + satellites | chalkboard, lab notebook |
| 3D style | physics diagram (matte, dashed, mono labels) | glossy, pixel, realistic |
| Story mapping | projects as satellites; visitor launches join low orbit | milestones on one trajectory |
| Interaction | drag to set launch; real physics | scroll-driven, orbit camera only |
| Palette | graph paper + vermilion | warm paper + blue, lab white + orange |
| Type | Latin Modern + JetBrains Mono | Geist + mono, Instrument Serif + Inter |
| Hero | full-bleed scene, text bottom-left | split |
| 3D stack | Three.js vanilla island | React Three Fiber |
| Styling | plain CSS tokens | Tailwind |
