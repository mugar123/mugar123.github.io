# AGENTS.md — project context for coding agents

This repository is the personal website of Nicolás Muñoz García (`https://mugar123.github.io`). Three agents work on it: **Claude Fable 5.1** orchestrates (it wrote the spec and plan, owns design taste, and decides between competing implementations); **Codex (gpt-6-astra)** and **Claude Opus 5.5** implement. For tasks with design or engineering room, both implement the same brief independently in separate worktrees, Fable picks the better one and integrates it, and the other agent reviews the integrated result. For mechanical tasks (scaffolding, CI, docs) Codex implements and Opus reviews. The human owner decides anything the documents below leave open.

## Read these first

1. `docs/superpowers/specs/2026-10-15-personal-website-design.md` — the design spec. It is the binding authority.
2. `docs/superpowers/plans/2026-10-15-personal-website.md` — the implementation plan: 16 tasks with exact code, tests and commands. The plan argues from the spec; where they disagree, the spec wins and the disagreement must be reported, not silently resolved.

## The product in one paragraph

A static Astro site on GitHub Pages. Graph-paper background, LaTeX typography (Latin Modern + JetBrains Mono), one accent color. The home hero is an interactive Three.js scene: a matte planet (the classroom), dashed orbit rings, the owner's projects as satellites, and a drag-to-launch toy driven by real two-body physics (`src/lib/orbit.ts`, pure functions, unit-tested). Everything else is calm, server-rendered content from Markdown collections.

## Hard rules

- No React, no Tailwind, no analytics, no backend. Plain CSS with custom properties.
- Exactly one accent color `#E2401C`; see the plan's Global Constraints for the rest of the palette and type rules.
- Hero text must be readable with JavaScript disabled; the 3D scene is progressive enhancement with an SVG fallback.
- Home JS budget ≤ 200 KB gzip including Three; other pages ship no Three.
- Physics stays in `src/lib/orbit.ts` with no DOM or Three imports. The scene only draws what that module computes.
- 3D assets: code-built primitives first. Any external model must be CC0/CC-BY, match the matte low-poly look, and be listed in `public/models/CREDITS.md`.
- Tests: Vitest for pure modules (TDD: failing test first), Playwright for pages. Run the focused test while iterating and the full suite before committing.
- Commit per task with a conventional message. Commits authored by Codex end with `Co-Authored-By: Codex <noreply@openai.com>`; commits authored by Claude end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never dispatch sub-agents or reviewers of your own; review is scheduled by the controller after each task.

## Working protocol

- Each task arrives as a brief file under `.superpowers/sdd/<plan>/task-N-brief.md` with a report path next to it. The brief is the single source of requirements; use its exact values verbatim.
- Write the full report to the report file; reply with status (`DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`), commits, a one-line test summary and concerns.
- If you would do something differently from the plan, say so explicitly in the report under **"Alternative approach"** with the trade-off. The pair compares approaches; silent deviations are not allowed.

## Commands

`npm run dev` · `npm run build` · `npm run check` · `npm test` · `npm run e2e` · `npm run lhci` · `npm run fonts` · `npm run og`
