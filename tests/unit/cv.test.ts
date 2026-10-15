import { describe, it, expect } from 'vitest';
import { cv } from '@/data/cv';
import { PHONE_PATTERN, privateExclusions, NO_EXCLUSIONS_MESSAGE } from '../helpers/privacy';

const everything = JSON.stringify(cv).toLowerCase();

describe('cv data', () => {
  it('has the owner facts and no phone number', () => {
    expect(cv.name).toBe('Nicolás Muñoz García');
    expect(cv.contacts.map((c) => c.value)).toEqual(['nicomg60@gmail.com', 'github.com/mugar123', 'papertok.app']);
    expect(everything).not.toMatch(PHONE_PATTERN);
  });
  it('the phone pattern catches Spanish numbers but not the CV scores', () => {
    for (const phone of ['+34 600 000 000', '600 000 000', '700-000-000', '911.000.000', '600000000']) expect(phone).toMatch(PHONE_PATTERN);
    for (const score of ['12.501/14', '9.06/10', '2025 – 2026', '2024, 2025']) expect(score).not.toMatch(PHONE_PATTERN);
  });
  it('mentions none of the facts the owner keeps private', (ctx) => {
    const words = privateExclusions();
    if (words.length === 0) ctx.skip(NO_EXCLUSIONS_MESSAGE);
    for (const word of words) expect(everything).not.toContain(word);
  });
  it('has the four sections in order, each non-empty, plus the skills block', () => {
    expect(cv.sections.map((s) => s.id)).toEqual(['education', 'projects', 'activities', 'achievements']);
    for (const s of cv.sections) expect(s.entries.length).toBeGreaterThan(0);
    expect(cv.skills.length).toBeGreaterThanOrEqual(5);
  });
  it('every entry has a period and a title', () => {
    for (const s of cv.sections) for (const e of s.entries) { expect(e.title).toBeTruthy(); expect(e.period).toMatch(/\d{4}/); }
  });
});
