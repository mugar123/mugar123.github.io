import { describe, it, expect } from 'vitest';
import { publishedPosts, type PostLike } from '@/lib/posts';

const mk = (id: string, date: string, draft = false): PostLike => ({ id, data: { date: new Date(date), draft } });

describe('publishedPosts', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  it('drops drafts', () => {
    expect(publishedPosts([mk('a', '2026-01-01', true)], now)).toEqual([]);
  });
  it('drops future-dated posts', () => {
    expect(publishedPosts([mk('a', '2027-01-01')], now)).toEqual([]);
  });
  it('sorts newest first', () => {
    const r = publishedPosts([mk('old', '2026-01-01'), mk('new', '2026-09-01')], now);
    expect(r.map((p) => p.id)).toEqual(['new', 'old']);
  });
});
