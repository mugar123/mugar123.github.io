# Mission PowerShell

Status: DONE

## Owner brief

Move the skills block out from under the planet to below the hero and above “Two satellites…”. Present the exact six skills in a fictional PowerShell console with a 1990s aesthetic, designed animation, and launch-status details consistent with the existing UI.

## Design plan and result

- Palette: existing paper `#F2F3F1`, frame/grid `#DADDD8`, ink/screen `#121412`, secondary ink `#6A6F69`, surface `#FFFFFF`, and sole accent `#E2401C`. The accent marks active launch status; body text stays high contrast.
- Type: existing JetBrains Mono for the entire console; Latin Modern and the surrounding page typography remain unchanged.
- Layout: hero → framed console → project cards → working-method prose. Inside the console: title bar; left-aligned profile and a narrower launch-status panel; footer with a real replay control. On mobile the two panels stack.
- Character: square, beveled desktop-window frame, recessed dark screen, segmented progress indicator, a PowerShell-style prompt, and a finite cursor blink. No extra font, framework, color theme, or texture asset.
- Review against the brief: the window treatment supplies the requested retro personality while retaining the site's palette, mono HUD language, content width, and graph paper. No decorative close/minimize controls or editable shell prompt imply functionality that does not exist.

## Implementation

- Added `MissionConsole.astro`, with semantic headings, definition lists, and a manifest populated from the existing satellite data. Active-satellite count and orbit/status labels reflect the actual collection.
- Preserved all six skill values verbatim in `MissionSpecs.astro` and removed the duplicate skills cards below the projects. The retained working-method prose now has the heading “How I work.”
- A small native custom element plays a 1.8-second boot sequence once on entering the viewport. Staggered row highlights, a segmented-meter reveal, status illumination, and cursor blink stop after the sequence. Replay works by mouse and keyboard.
- All profile content is server-rendered and remains visible during animation. Without JavaScript it is a finished static console; reduced-motion preference stops animation immediately and hides the replay control. Disconnecting the element clears timers, observer, and event listeners.

## Validation

- `npm run check`: zero errors, warnings, and hints.
- `npm run build`: passed; the existing large raw Three chunk warning remains.
- `npm test`: 96 passed.
- `npm run e2e`: 84 passed, 15 expected skips. Includes axe, console placement, unique skills profile, no-JS content, keyboard replay, finite boot, dynamic reduced-motion changes, and 320px overflow checks.
- Visual review at 1280 × 720 and 390 × 844: readable, no console overflow, status panel stacks correctly, and the console precedes the project heading.
- Home JavaScript: 165,258 bytes gzip including external and inline scripts, approximately 161.4 KiB, below 200 KB.
- Local Lighthouse collect/assert: all configured assertions passed across six runs. Home median performance 98, accessibility/best-practices/SEO 100; median LCP 1.54 seconds and CLS 0.00045. No report upload was run.
- `git diff --check`: passed.

## Alternative approach and specification amendment

The direct owner request supersedes spec §5.1's compact skills block beneath the planet and repeated skills cards below the project section. A single console between hero and projects now carries the skills. The console uses CSS animation with a small visibility/replay controller instead of a terminal emulator or simulated command input; it preserves semantic, immediately available content and keeps the script budget small.

## Scope

No changes to planet/satellite assets, orbital behavior, project content, or global design tokens. Pre-existing changes in `.claude/SKILLS.md` and `.claude/launch.json` are excluded. No push or deployment is part of this change.

## Commit

`feat(home): add a retro mission console below the hero`, with the required Codex co-author trailer.
