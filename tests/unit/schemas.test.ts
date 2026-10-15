import { describe, it, expect } from 'vitest';
import { workSchema, writingSchema } from '@/content/schemas';

const work = { title: 'PaperTok', orbit: 'high', status: 'active', launched: '2025-06-01', oneLiner: 'A study app.', stack: ['Swift'], order: 1 };

describe('workSchema', () => {
  it('accepts a valid entry and coerces the date', () => {
    const r = workSchema.parse(work);
    expect(r.launched).toBeInstanceOf(Date);
  });
  it('rejects an unknown orbit', () => {
    expect(workSchema.safeParse({ ...work, orbit: 'geostationary' }).success).toBe(false);
  });
  it('rejects a missing title and an empty stack', () => {
    expect(workSchema.safeParse({ ...work, title: '' }).success).toBe(false);
    expect(workSchema.safeParse({ ...work, stack: [] }).success).toBe(false);
  });
});

describe('writingSchema', () => {
  it('defaults draft to false', () => {
    expect(writingSchema.parse({ title: 'T', date: '2026-10-15', summary: 'S' }).draft).toBe(false);
  });
  it('rejects an over-long summary', () => {
    expect(writingSchema.safeParse({ title: 'T', date: '2026-10-15', summary: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('date fields reject invalid frontmatter', () => {
  const writing = { title: 'T', summary: 'S' };
  const invalid: [string, unknown][] = [
    ['null (blank YAML value)', null],
    ['false', false],
    ['a bare number', 20270101],
    ['a non-ISO string', 'yesterday'],
  ];
  const valid: [string, unknown][] = [
    ['a Date object (unquoted YAML date)', new Date('2026-10-15')],
    ['an ISO YYYY-MM-DD string', '2026-10-15'],
  ];

  for (const [label, value] of invalid) {
    it(`writing.date rejects ${label}`, () => {
      expect(writingSchema.safeParse({ ...writing, date: value }).success).toBe(false);
    });
    it(`work.launched rejects ${label}`, () => {
      expect(workSchema.safeParse({ ...work, launched: value }).success).toBe(false);
    });
  }

  for (const [label, value] of valid) {
    it(`writing.date accepts ${label} and yields a Date`, () => {
      const d = writingSchema.parse({ ...writing, date: value }).date;
      expect(d).toBeInstanceOf(Date);
      expect(d.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    });
    it(`work.launched accepts ${label} and yields a Date`, () => {
      const d = workSchema.parse({ ...work, launched: value }).launched;
      expect(d).toBeInstanceOf(Date);
      expect(d.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    });
  }
});
