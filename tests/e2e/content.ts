import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { writingSchema } from '../../src/content/schemas';
import { publishedPosts } from '../../src/lib/posts';

/**
 * What the built site should show for the Logbook, derived from `src/content/writing/*.md` exactly the
 * way the build decides it: the frontmatter is parsed with the `yaml` package and the options Astro uses
 * (@astrojs/internal-helpers/yaml: core schema plus timestamps, so inline `#` comments, quoting and dates
 * behave the same), validated with the collection's own `writingSchema`, and filtered by `publishedPosts`.
 * A file the schema rejects fails the build, so it is never counted as published here.
 */
const DIR = fileURLToPath(new URL('../../src/content/writing/', import.meta.url));
const FRONTMATTER = /(?:^﻿?|^\s*\n)---([\s\S]*?\n)---/; // Astro's own fence pattern

/** A post as the specs use it: `slug` is the collection id (the file name), as in `/writing/<slug>`. */
export interface PostFile { slug: string; title: string; date: Date; draft: boolean }
type Parsed = { id: string; data: { title: string; date: Date; draft: boolean } } | { id: string; data: null; error: string };

export function parsePost(slug: string, text: string): Parsed {
  const raw = FRONTMATTER.exec(text)?.[1] ?? '';
  const doc = parseDocument(raw, { customTags: ['timestamp'], merge: true, schema: 'core' });
  if (doc.errors.length > 0) return { id: slug, data: null, error: doc.errors[0]!.message };
  const result = writingSchema.safeParse(doc.toJS() ?? {});
  if (!result.success) return { id: slug, data: null, error: result.error.message };
  const { title, date, draft } = result.data;
  return { id: slug, data: { title, date, draft } };
}

/** Published posts, newest first, exactly as `publishedPosts` computes them at `now`; every other file is a draft. */
export function classify(files: Parsed[], now: Date = new Date()): { published: PostFile[]; drafts: PostFile[] } {
  const toFile = (f: Parsed): PostFile => ({ slug: f.id, title: f.data?.title ?? '', date: f.data?.date ?? new Date(NaN), draft: f.data?.draft ?? true });
  const valid = files.filter((f): f is Extract<Parsed, { data: object }> => f.data !== null);
  const published = publishedPosts(valid, now);
  return { published: published.map(toFile), drafts: files.filter((f) => !published.includes(f as never)).map(toFile) };
}

export const posts = readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => parsePost(f.replace(/\.md$/, ''), readFileSync(DIR + f, 'utf8')));
export const { published, drafts } = classify(posts);
