import { describe, it, expect } from 'vitest';
import { parsePost, classify, published, drafts } from '../e2e/content';

const NOW = new Date('2026-10-15T12:00:00Z');
const post = (front: string) => `---\ntitle: A post\nsummary: Something.\n${front}\n---\n\nBody.\n`;
const state = (front: string) => {
  const { published: p } = classify([parsePost('x', post(front))], NOW);
  return p.length === 1 ? 'published' : 'not published';
};

describe('e2e content helper (mirrors the Astro build)', () => {
  it.each([
    ['an inline comment after the date', 'date: 2026-10-01 # publication date\ndraft: false'],
    ['an inline comment after draft: false', 'date: 2026-10-01\ndraft: false # ready'],
    ['a double-quoted date', 'date: "2026-10-01"\ndraft: false'],
    ["a single-quoted date and a commented draft", "date: '2026-10-01' # quoted\ndraft: false # ready"],
    ['draft omitted (schema default false)', 'date: 2026-10-01'],
    ['a post dated today', 'date: 2026-10-15'],
  ])('%s → published', (_name, front) => {
    expect(state(front)).toBe('published');
  });

  it.each([
    ['draft: true', 'date: 2026-10-01\ndraft: true'],
    ['draft: true with an inline comment', 'date: 2026-10-01\ndraft: true # not ready'],
    ['a future date', 'date: 2026-12-01\ndraft: false'],
    ['a non-ISO date the schema rejects', 'date: 01/10/2026\ndraft: false'],
    ['a quoted non-boolean draft the schema rejects', 'date: 2026-10-01\ndraft: "false"'],
  ])('%s → not published', (_name, front) => {
    expect(state(front)).toBe('not published');
  });

  it('keeps the title and the exact date, and a hash inside quotes is not a comment', () => {
    const [p] = classify([parsePost('x', post('date: 2026-10-01 # c').replace('title: A post', 'title: "C# notes # 1"'))], NOW).published;
    expect(p).toMatchObject({ slug: 'x', title: 'C# notes # 1', draft: false });
    expect(p!.date.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('splits every shipped writing file into published or draft, never both', () => {
    const slugs = [...published, ...drafts].map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(drafts.every((d) => !published.some((p) => p.slug === d.slug))).toBe(true);
  });
});
