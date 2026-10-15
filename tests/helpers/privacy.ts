import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * A Spanish phone number in any common spelling: the +34 prefix, or a nine-digit mobile/landline
 * starting 6–9 with optional space, dot or dash separators. Must not match scores like "12.501/14".
 */
export const PHONE_PATTERN = /\+34|\b[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/;

const EXCLUSIONS_FILE = fileURLToPath(new URL('../../.private-exclusions.json', import.meta.url));

/**
 * Words the owner keeps private, so they are not committed. Read from the untracked
 * `.private-exclusions.json` (array of lowercase strings) when present, else from the comma-separated
 * env var `PRIVATE_EXCLUSIONS`. Empty when neither is set; callers skip their assertions then.
 */
export function privateExclusions(): string[] {
  if (existsSync(EXCLUSIONS_FILE)) {
    const parsed: unknown = JSON.parse(readFileSync(EXCLUSIONS_FILE, 'utf8'));
    if (!Array.isArray(parsed) || !parsed.every((w) => typeof w === 'string')) {
      throw new Error('.private-exclusions.json must be a JSON array of strings');
    }
    return parsed.map((w) => w.trim().toLowerCase()).filter(Boolean);
  }
  return (process.env['PRIVATE_EXCLUSIONS'] ?? '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
}

export const NO_EXCLUSIONS_MESSAGE =
  'No private exclusion words: create .private-exclusions.json (see .private-exclusions.json.example) or set PRIVATE_EXCLUSIONS';
