# Satellite orientation correction

Status: DONE

## Result

Direct owner follow-up: the satellites must point toward the planet. The imported antenna's forward axis is +Z (verified against the source mesh and existing static render). Removed the decorative fixed yaw/roll from the imported template. Each orbit host now looks at the planet origin every frame, keeping its up axis perpendicular to the orbital plane. Position, speed, scale, and labels are unchanged.

The static SVG rotates each existing satellite preview so its projected antenna also points inward. This retains the baked image's perspective and lighting; it does not claim to be a new physically rendered view for every orbital phase.

## Validation

- TDD: the new scene alignment check and template-axis assertion both failed before the correction and passed afterward.
- Regression checks cover four orbital quadrants over 60 advancing frames, preservation of upright orientation, and projected static alignment at 16 phases using Three's actual camera projection.
- `npm test`: 96 passed across 14 files.
- `npm run check`: zero errors, warnings, and hints.
- `npm run build`: passed; the existing raw chunk size warning remains.
- `npm run e2e`: 76 passed, 14 expected skips.
- `git diff --check`: passed.
- Interactive visual review was unavailable: the browser tool rejected access to the current local preview under its URL policy. No alternate browser surface was used to bypass that denial. The existing repository test suite ran normally.

## Alternative approach

Rotating only once at load would become incorrect as the satellites advance. Tracking the origin on every frame makes orientation follow the existing orbital position. The static fallback uses a projected rotation of its existing render instead of adding phase-specific image assets.

## Commit

`fix(scene): keep satellite antennas pointing toward the planet`, with the required Codex co-author trailer. No deployment.
