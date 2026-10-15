# Selected orbit models

Status: DONE_WITH_CONCERNS

## Request and result

Direct owner request in the chat, without a task brief: replace the central blue sphere with Quaternius Planet 06 and the project dots with the approved, recolored Satellite 01. Implemented on top of the ambient-scene change in `06509a9`; no launch interaction was reintroduced.

- Planet 06 keeps its original ochre bands and low-poly geometry. Project satellites use the approved brighter blue/silver texture.
- The two self-contained GLBs are hosted locally. One satellite download supplies shared geometry, materials, and textures to all project instances.
- Asynchronous model loading preserves the existing orbit transforms, label placement, visibility pausing, and progressive enhancement. Abort and late-decode cleanup prevent resources attaching after teardown. Shared GPU resources and decoded image bitmaps are disposed once per scene.
- Failed downloads retain recognizable procedural placeholders. No JavaScript, reduced motion, and WebGL failure use transparent static renders of the selected models inside the existing SVG scene.
- Credits include author, original source, license, and modifications, with a home-footer link for the CC-BY satellite.

## Validation

- TDD: the new loader tests failed on the missing module before implementation, then passed.
- `npm test`: 94 passed across 13 files.
- `npm run check`: no errors, warnings, or hints.
- `npm run build`: passed. Vite reports the existing-style raw chunk size warning; compressed JavaScript remains within budget.
- `npm run e2e`: 76 passed, 14 expected skips across desktop, mobile, and no-JavaScript projects. After simplifying static label spacing, the model-specific suite passed again: 10 passed, 5 expected skips.
- `npx lhci collect` and `npx lhci assert`: all configured assertions passed over three home and three about runs. No report upload was run. Home median LCP: 1.52 s; CLS: 0.00044; accessibility, best practices, and SEO: 100. Performance scores ranged from 74 to 100, median 100; these are local measurements, not field results.
- Home JavaScript including Three and GLTFLoader: 164,177 bytes gzip (160.3 KiB), below 200 KB. Other pages request neither the scene nor the models.
- Planet GLB: 58,764 bytes / 1,598 triangles. Satellite GLB: 149,888 bytes / 914 triangles. Static WebPs: 11,822 and 6,600 bytes.
- Browser visual review at desktop and 390 × 844 mobile sizes: both chosen models render. `git diff --check` passed.

## Alternative approach

Spec §6.4 prescribes Draco-compressed external glTF models. These GLBs are deliberately uncompressed: both already fit the stricter 150,000-byte per-file limit, preserve source geometry, and avoid shipping or fetching a Draco decoder. The satellite uses its approved texture encoded as a 1024 × 1024 JPEG to fit that budget. Trade-off: geometry transfer could shrink further with Draco, at the cost of decoder transfer and initialization. This is a documented implementation deviation, not a claim of literal Draco compliance.

## Concerns and specification conflicts

The owner's latest explicit selection supersedes the older spec's blue untextured planet, single-color primitive satellites, and statement that no external assets are used. The rest of the page palette is unchanged. The spec still contains those older statements and the Draco requirement; this report records the discrepancy. No deployment was performed.

## Commit

Conventional commit: `feat(scene): integrate selected planet and vivid satellite models`, authored with the required Codex co-author trailer. Includes only this integration; the ambient-scene removal is its preceding commit.
