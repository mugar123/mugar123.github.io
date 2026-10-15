import { z } from 'astro/zod';

// Frontmatter dates: YAML parses an unquoted `2026-10-15` as a Date; a quoted one stays a string.
// Accept only those two forms. Unlike z.coerce.date(), this rejects null (blank value),
// booleans and bare numbers, which would otherwise silently become 1970 dates.
const frontmatterDate = z.union([z.date(), z.iso.date().transform((s) => new Date(s))]);

export const workSchema = z.object({
  title: z.string().min(1),
  orbit: z.enum(['high', 'mid', 'low']),
  status: z.enum(['active', 'paused', 'retired']),
  launched: frontmatterDate,
  oneLiner: z.string().min(1).max(140),
  stack: z.array(z.string().min(1)).min(1),
  links: z.array(z.object({ label: z.string(), url: z.url() })).optional(),
  order: z.number().int(),
});

export const writingSchema = z.object({
  title: z.string().min(1),
  date: frontmatterDate,
  summary: z.string().min(1).max(200),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().default(false),
});
