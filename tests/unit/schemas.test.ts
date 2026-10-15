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
