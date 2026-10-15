import { z } from 'astro/zod';

export const workSchema = z.object({
  title: z.string().min(1),
  orbit: z.enum(['high', 'mid', 'low']),
  status: z.enum(['active', 'paused', 'retired']),
  launched: z.coerce.date(),
  oneLiner: z.string().min(1).max(140),
  stack: z.array(z.string().min(1)).min(1),
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
  order: z.number().int(),
});

export const writingSchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  summary: z.string().min(1).max(200),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().default(false),
});
