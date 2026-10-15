# Personal website — design spec

**Date:** 2026-10-15
**Owner:** Nicolás Muñoz García
**Status:** approved in conversation; pending implementation plan
**Revised:** 2026-10-16 — the drag-to-launch toy was removed; the hero scene is ambient (§3, §9).

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

The site tells one story: **the student who is already leaving the classroom's gravity**. One memorable 3D object carries it, over a calm, readable base — the pattern shared by the reference sites (mikes.cv, cindyly.design, tomjohn.design, meliketurgut.com).

- **The planet** is the classroom (Salamanca).
- **Satellites in orbit** are things actually launched: projects. Higher orbit = bigger project.
- **The scene is ambient.** The satellites go round at their Kepler rates and nothing in the scene responds to the pointer or the keyboard. A drag-to-launch toy shipped first and was removed by the owner on 2026-10-16: it did not read as intended (§9).
- **Skills are not satellites.** A satellite is something launched, not an ability. Skills live in a text panel called *Mission specs*.

### 3.1 Content in orbit (initial)

| id | name | orbit | status | one-liner |
|---|---|---|---|---|
| `papertok` | PaperTok | high | active | A short-form, swipeable feed for discovering arXiv papers (papertok.app, github.com/mugar123/papertok; React, Vite, Firebase, KaTeX, Transformers.js, Python; ~100 users). |
| `notes-to-latex` | Notes → LaTeX pipeline | mid | active | Handwritten lecture notes transcribed into compiled LaTeX automatically, mixing open-source and closed models. Grew out of hand-typeset course notes; code not public. |

Facts that must never appear on the site: two facts the owner keeps private (owner's decision). No phone number anywhere.

### 3.2 Mission specs (strengths to highlight)

Building things · Product design · Python · Neural networks · LaTeX (advanced) · MATLAB (intermediate) · Advanced use of AI coding tools (Cursor, Codex, Claude Code). The AI-tooling point also gets one explicit sentence in prose, not just a label — it is a differentiator for recruiters right now.

## 4. Visual direction

### 4.1 Palette (approved: "graph paper + vermilion")

| token | value | role |
|---|---|---|
| `--paper` | `#F2F3F1` | page background |
| `--grid` | `#DADDD8` | graph-paper lines (CSS gradients, 20–24 px cell) |
| `--ink` | `#121412` | text, orbit lines, borders |
| `--ink-2` | `#6A6F69` | secondary text, mono labels (4.6:1 on paper; the earlier #6E736D measured 4.35:1 and failed AA at 12 px) |
| `--accent` | `#E2401C` | the only accent: active satellite, primary CTA, live status |
| `--planet` | `#5E6B7A` | matte planet; highlight `#7B8898` |
| `--surface` | `#FFFFFF` | cards on top of the grid |

Rules: exactly one accent, used only for what is "alive" (PaperTok/active status, the primary CTA). All text/background pairs pass WCAG AA; `--ink-2` on `--paper` is for labels ≥ 12 px mono only, never body text.

### 4.2 Typography (approved: "paper")

- **Latin Modern** (the LaTeX font; GUST Font License, free) for headings and body. Self-hosted WOFF2, subset to Latin.
- **JetBrains Mono** (OFL) for labels, dates, section numbers, Mission specs and all scene annotations. Self-hosted, subset.
- Because Latin Modern is thin on screen: body text **18–19 px**, line-height ≥ 1.6, never lighter than `--ink`; measure 60–70 characters; headings use regular weight with italics for emphasis, no faux bold.
- Sections are numbered like a paper: `§0 ABSTRACT`, `§1 IN ORBIT`, …

### 4.3 Components and motion

- Cards are white, 1 px `--grid` border, square corners, sitting on the graph paper.
- Motion is purposeful and sparse: hero text fades in (CSS only); section reveals on scroll with ~300 ms ease-out; the home mission console (§5.1) plays its boot once, in time and not tied to the scroll, when it first comes into view, then rests; continuous motion is limited to the orbiting satellites, the custom cursor's inertia, and the `/cv` live background. Everything stops under `prefers-reduced-motion`.
- The 3D style is a **physics diagram**: matte/clay planet, dashed orbit lines, small polyhedral satellites, mono labels with leader lines, no textures, no bloom, no starfield.

## 5. Information architecture

### 5.1 Home (`/`) — order approved

| § | block | content |
|---|---|---|
| 0 | **Abstract / hero** — full-bleed | 3D scene fills the hero width, planet offset right. Bottom-left: headline *"Physics student at Salamanca. Already in orbit."* (final copy TBD in implementation, same shape), one sentence, two CTAs: `SEE WHAT'S IN ORBIT` (secondary) and `CONTACT` (accent). |
| 1 | **In orbit** | A dark **mission console** (ground-control terminal). Its boot log types itself when it first comes into view: `uplink`, then `specs --vehicle` printing the six Mission specs (real content, the only place they appear on the home page), a radar scan of the orbit bands, a handshake with each satellite, `deploy --panels`. Then one panel per satellite from the `work` collection powers on: `SAT-0n · ORBIT · STATUS`, name, one-liner, launch month and stack in mono; the whole panel links to its page. The log is decoration (hidden from assistive tech); the specs and panels are not. Without JS, under reduced motion, or when already on screen at load, it is the finished console. |
| 2 | **How I work** | The owner's own account of how he works (needs → ranking → validating the top three → UI inspiration first → build and test → Claude Code and Codex in parallel), rewritten in English but adding nothing he did not say. |
| 3 | **Logbook** | Latest 3 posts from `writing`, link to `/writing`. Hidden automatically if there are no posts; when hidden, Ground control becomes §3 so the numbering stays contiguous. |
| 4 | **Ground control** | Contact and social: "Open to internships and junior roles." Email `nicomg60@gmail.com` (accent), GitHub `mugar123`, `papertok.app`, and a link to the native CV page `/cv`. Only networks the owner actually lists; no LinkedIn until he has one. |
| — | footer | `SALAMANCA · 40.96° N, 5.67° W · CET` · `LAST UPDATED <build date>` |

Hero behaviour: text is server-rendered and visible immediately; the scene mounts afterwards on top. On viewports < 768 px the scene becomes a full-width 16:9 band on top (the scene container is 16:9 on every viewport so the SVG fallback and its labels share one frame) and text stacks below: the headline is within the first viewport and both CTAs within the first 1.5 viewports. The scene takes no pointer or keyboard input and is not in the tab order; assistive technology gets one image, named and described like the SVG fallback.

### 5.2 Other pages

- `/work/<slug>` — one page per satellite: problem, what was built, stack, outcome, screenshots/links. Rendered from `work` Markdown.
- `/writing` — all posts, newest first. `/writing/<slug>` — post page, same type rules, 65–70 ch measure.
- `/about` — longer bio, the Salamanca/physics story, his working method in his own words, link to `/cv`.
- `/cv` — the CV rendered natively, not a PDF, designed as a **mission dossier**: typed data in `src/data/cv.ts` (education, projects, skills, activities, achievements — without the two facts the owner keeps private); huge serif name, mono contact row, sections numbered `§1 EDUCATION`…, each entry a row with a mono date column and a leader line that lights up in the accent on hover. The page has a **live background**: the graph paper drifts slowly and three dashed orbit rings rotate behind the content at low opacity (CSS only, no JavaScript, frozen under reduced motion). A "Print / save as PDF" button uses a print stylesheet (no nav, footer, cursor or background; black on white, 11 pt). No phone number. The Ground control CV link points here.
- **Custom cursor (site-wide):** on fine-pointer devices a small accent dot plus an ink ring that follows the pointer with inertia; the ring grows and fills over links and buttons. Off on touch devices and under reduced motion; the native cursor stays available for text inputs. Under 1.5 KB of JavaScript.
- `/rss.xml`, `/sitemap-index.xml`, `robots.txt`, Open Graph image (static, graph paper + title).
- `404` — a suborbital joke: "Trajectory decayed." with a link home.

## 6. Technical architecture

### 6.1 Stack

- **Astro 7.x** (current major at implementation time; the content-collections API used is unchanged since 5), `output: 'static'`, `site: 'https://mugar123.github.io'`, no `base` (repo named `mugar123.github.io`).
- **Three.js** (no React Three Fiber) inside an Astro island `<OrbitScene />`, hydrated with `client:visible`. React is not required anywhere in v1.
- **Plain CSS** with custom properties; no Tailwind. Global tokens in `src/styles/tokens.css`.
- **TypeScript** everywhere, `strict`.

### 6.2 Content model (`src/content/`)

```ts
// work  (the entry id — derived from the file name — is the URL slug; no separate `slug` field)
{ title, orbit: 'high' | 'mid' | 'low', status: 'active' | 'paused' | 'retired',
  launched: Date, oneLiner, stack: string[], links?: {label, url}[], order: number }
// writing
{ title, date: Date, summary, tags?: string[], draft?: boolean }
// `cover?: image` for work entries is deferred until the first cover image exists.
```

Validated with Zod via content collections. Invalid frontmatter fails the build. The scene reads `work` at build time and receives satellites as serialized props, so adding a project is adding one Markdown file.

### 6.3 Modules

| module | responsibility | depends on |
|---|---|---|
| `src/lib/orbit.ts` | Pure functions: `circularPosition(r, phase)` and `angularSpeed(r)` (Kepler's third law). Normalized units (planet radius = 1, GM = 1). No DOM, no Three. | nothing |
| `src/scene/OrbitScene.astro` + `scene.ts` | Builds the Three.js scene from props: planet, dashed orbit rings per band, satellites placed on their ring and animated along it, mono DOM labels placed every frame. Resizes, pauses when off-screen. No input handling. | `orbit.ts`, three |
| `src/scene/fallback.astro` | Static SVG of the same scene (planet, rings, satellites). Shown when WebGL is unavailable, `prefers-reduced-motion` is set, or `saveData`/low-end heuristics trigger. Always present in HTML as `<noscript>`/pre-hydration content. | content |
| layouts & components | `Base.astro` (head, fonts, grid background, nav, footer), `Section.astro` (§ number + title), `SatelliteCard.astro`, `MissionSpecs.astro`, `PostList.astro`. | content |

### 6.4 3D assets

Planet, rings and satellites are **code-built primitives** (sphere with `MeshStandardMaterial` flat-ish shading, `LineDashedMaterial` rings, small icosahedra). Any external model comes from an open repository (Poly Pizza, Kenney, Quaternius; CC0 or CC-BY) and is used **only if it matches the matte low-poly diagram look**. Every external asset is listed with license and source in `public/models/CREDITS.md`. Models are glTF, Draco-compressed, ≤ 150 KB each.

### 6.5 Performance and fallbacks

- Budgets: hero text LCP < 2.5 s on 4G; CLS = 0 (scene container has fixed aspect); total JS on home ≤ 200 KB gzip including Three.
- Three is loaded only on the home hero; other pages ship no Three.
- Fonts: `font-display: swap` with size-adjusted fallbacks to avoid layout shift.
- If the WebGL context is lost or a model fails to load, the scene degrades to primitives, then to the SVG fallback. Errors are logged to console only.

### 6.6 Deployment

GitHub repo `mugar123/mugar123.github.io`, branch `main`. GitHub Actions workflow using `withastro/action` → `actions/deploy-pages`. Build on every push to `main`; PR builds run checks without deploying.

### 6.7 Quality

- **Vitest**: `orbit.ts` (circular positions, Kepler rates), the scene's lifecycle and label placement, content schema fixtures.
- **Playwright** smoke: home renders hero text with JS disabled; canvas mounts with JS; the scene is one named image outside the tab order; nav works; each content page renders.
- **CI**: typecheck, tests, build, Lighthouse CI against budgets, axe accessibility scan on home and one post.
- Manual checklist before launch: real device test on iPhone and a low-end Android, keyboard navigation, reduced-motion mode.

## 7. Copy and tone

English, first person, short sentences, physics vocabulary used lightly and correctly (never a pun that would make a physicist wince). Headlines are sentence case. Labels are UPPERCASE mono. Nicolás reviews all copy before launch.

## 7.1 References

Personal sites that set the pattern (calm base + one memorable interactive object): mikes.cv, shubhu.site, cindyly.design, tomjohn.design, meliketurgut.com, ysuriadesign.com. Ongoing inspiration feed: inspora.design (filters *3D* and *Web*).

Notes taken from Inspora for implementation, not changing any decision:

- Matte, light-on-light 3D objects with a single colored detail validate the "physics diagram" style — keep the planet untextured and let the accent do the work.
- A huge serif name as the opening line of §0 (paper-title scale, above the scene) is a composition option to try alongside the approved headline.
- HUD-style mono panels (1 px border, small, no color except the accent) are the shape for *Mission specs*.

## 8. Open items after implementation (2026-10-15)

- Owner to review the copy marked `<!-- REVIEW -->` in `src/content/work/*.md` and `src/pages/about.astro`, and the launch months (`launched:` in both work entries are placeholders).
- PaperTok screenshots (optional); the `work` schema has no `cover` field yet — add it with the first image.
- Done: CV content rendered at `/cv` from `src/data/cv.ts`; contact email, GitHub and papertok.app; working-method text in the owner's words; neural-networks course (BISITE/USAL) in the CV.
- No external 3D model is used (`public/models/CREDITS.md` is empty by design).
- Deployment: workflows committed; the GitHub repository `mugar123/mugar123.github.io` and the first push are the owner's call; after the first deploy, set Pages → Source to GitHub Actions.
- Custom domain: later — `site` in `astro.config.mjs` plus a `CNAME` file.

## 8.1 Implementation outcomes that refined this spec

- Astro 7.x (not 5); TypeScript 5.x (`@astrojs/check` peer); Latin Modern from the DTP package (the web package lacks typographic punctuation).
- The drag-to-launch toy (launch pad at r = 1.05 with tangent snapping, RK4 trajectories with conic-based outcomes, up to three visitor satellites in `localStorage`) shipped and was removed on 2026-10-16 (§9); its code is in the git history before that date.
- `--ink-2` darkened to `#6A6F69` for AA at 12 px; the accent never carries small text (borders, dots, underlines and fills only).
- The scene container is always 16:9; satellite labels are hidden in scenes narrower than 480 px; the SVG fallback uses HTML labels at a real 12 px.
- Rings start at staggered base phases so satellites on different rings never line up.
- Scroll reveals animate transform only (no opacity), after a CSS-minifier bug was found folding `animation-timeline` into an invalid shorthand.
- The mission console (2026-10-16) replaced the project cards and the separate skills terminal shipped earlier that day. Its schedule is computed at build time (`src/lib/bootSchedule.ts`) and written into the markup; each step's waiting state is a plain CSS rule and its animation only holds the arrived state, because Chrome can stop a 1 ms step animation at progress 0.99999.

## 9. Decisions log

| decision | choice | rejected |
|---|---|---|
| Framework | Astro | Next.js static export, Eleventy |
| Hosting | GitHub Pages at root | Vercel, Netlify |
| Content | Markdown in repo | CMS |
| Direction | calm base + one 3D object (reference pattern) | neo-brutalist (misclick) |
| Metaphor | escape velocity, planet + satellites | chalkboard, lab notebook |
| 3D style | physics diagram (matte, dashed, mono labels) | glossy, pixel, realistic |
| Story mapping | projects as satellites | milestones on one trajectory; visitor launches joining low orbit (shipped, removed 2026-10-16) |
| Projects block | mission console with a timed boot log (owner, 2026-10-16) | cards; a scroll-scrubbed, pinned console (prototyped: the owner wanted it to play, not follow the scroll); a separate skills terminal above the projects (shipped, merged into the console) |
| Interaction | none: an ambient scene (owner, 2026-10-16) | drag to set a launch with real physics (shipped, then removed: it did not read as intended), scroll-driven, orbit camera only |
| Palette | graph paper + vermilion | warm paper + blue, lab white + orange |
| Type | Latin Modern + JetBrains Mono | Geist + mono, Instrument Serif + Inter |
| Hero | full-bleed scene, text bottom-left | split |
| 3D stack | Three.js vanilla island | React Three Fiber |
| Styling | plain CSS tokens | Tailwind |
