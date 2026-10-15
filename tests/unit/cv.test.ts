import { describe, it, expect } from 'vitest';
import { cv } from '@/data/cv';

const everything = JSON.stringify(cv).toLowerCase();

describe('cv data', () => {
  it('has the owner facts and nothing excluded', () => {
    expect(cv.name).toBe('Nicolás Muñoz García');
    expect(cv.contacts.map((c) => c.value)).toEqual(['nicomg60@gmail.com', 'github.com/mugar123', 'papertok.app']);
    expect(everything).not.toMatch(/\+34|623 ?409 ?632/);
    expect(everything).not.toContain('a-private-grant');
    expect(everything).not.toContain('application');
  });
  it('has the five sections in order, each non-empty', () => {
    expect(cv.sections.map((s) => s.id)).toEqual(['education', 'projects', 'activities', 'achievements']);
    for (const s of cv.sections) expect(s.entries.length).toBeGreaterThan(0);
    expect(cv.skills.length).toBeGreaterThanOrEqual(5);
  });
  it('every entry has a period and a title', () => {
    for (const s of cv.sections) for (const e of s.entries) { expect(e.title).toBeTruthy(); expect(e.period).toMatch(/\d{4}/); }
  });
});
