# Project skills

Installed into `.claude/skills/` (project scope) on 2026-10-15. Folder names match each skill's `name:` frontmatter.

| Source | Commit | Skills |
|---|---|---|
| https://github.com/anthropics/skills (frontend-design only) | dbd4588 | 1 |
| https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | 56ea9cf | 7 |
| https://github.com/Leonxlnx/taste-skill | f624f37 | 13 |
| https://github.com/pbakaus/impeccable | 8a0e198 | 1 |
| https://github.com/Owl-Listener/designer-skills | 9a6930c | 112 |

To update, re-clone the source repo and replace the skill folders.

## Second batch (2026-10-15)

Real agent skills, copied as-is:

| Source | Commit | Skills |
|---|---|---|
| https://github.com/superdesigndev/superdesign-skill (the `superdesign` repo is the VS Code extension; the skill lives here) | f9f05cd | 1 (`superdesign`) |
| https://github.com/marvkr/better-design | e146625 | 2 (`better-design`, `animate-text`). `better-design` needs its MCP connected — see the repo's setup section. |
| https://github.com/madebymustafa/design-taste | c4a6bff | 24 (`design-taste` core + genre packs + `taste-*` craft skills) |

Component libraries without a skill of their own. For each, a short reference skill was written in-project with install commands plus the library's `llms.txt`/README under `reference/`:

| Skill | Source | Commit |
|---|---|---|
| `canvas-ui` | https://github.com/DavidHDev/canvas-ui | a04a99b |
| `paper-shaders` | https://github.com/paper-design/shaders | 43cd68d |
| `ui-layouts` | https://github.com/ui-layouts/ui-layouts | 88d827d |
| `motion-primitives` | https://github.com/ibelick/motion-primitives | 120f64f |
| `cursify` | https://github.com/ui-layouts/cursify | b3a173c |
| `hyperiux` | https://github.com/Hyperiux-Immersion-Labs/hyperiux-components (the given URL `Hyperiux-Immersive/Hyperiux` is a 404) | 71f7398 |
| `trickle` | https://github.com/akaieuan/trickle-UI-kit (the given URL `akaieuan/trickle` is a 404) | 4112907 |

> Note (2026-10-15): the skill packs themselves are kept out of git (`.claude/skills/` and `.agents/` are ignored) because most third-party packs ship without a license file. They stay on disk for the agents; this file records where they came from.
