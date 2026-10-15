import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * What the built site should show for the Logbook, derived from `src/content/writing/*.md` the way
 * `publishedPosts` decides it (not a draft, dated no later than now), so the e2e expectations hold
 * before and after the first post is published. A regex over the frontmatter is enough here: the
 * collection schema already validates `draft` (boolean, default false) and `date` (YYYY-MM-DD).
 */
const DIR = fileURLToPath(new URL('../../src/content/writing/', import.meta.url));

export interface PostFile { slug: string; title: string; date: Date; draft: boolean }

function read(file: string): PostFile {
  const text = readFileSync(DIR + file, 'utf8');
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  const field = (name: string) => new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm').exec(front)?.[1]?.replace(/^(['"])(.*)\1$/, '$2');
  const date = field('date');
  if (!date) throw new Error(`${file}: no date in the frontmatter`);
  return { slug: file.replace(/\.md$/, ''), title: field('title') ?? '', date: new Date(date), draft: field('draft') === 'true' };
}

export const posts: PostFile[] = readdirSync(DIR).filter((f) => f.endsWith('.md')).map(read);
export const published = posts.filter((p) => !p.draft && p.date.getTime() <= Date.now());
export const drafts = posts.filter((p) => !published.includes(p));
