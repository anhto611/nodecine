import { z } from 'zod';
import { ResearchPointSchema } from '@/contracts/types/research';

/** What the model answers. */
export const FindingsSchema = z.object({
  language: z.string().min(2).max(35),
  subject: z.string().max(120),
  summary: z.string().max(2000),
  points: z.array(z.object({ text: z.string().min(1).max(600), source: z.string().max(2000).nullable().default(null) })).max(40),
  sources: z.array(z.object({ url: z.string().max(2000), title: z.string().max(300).nullable().default(null) })).max(40).default([]),
});
export type Findings = z.infer<typeof FindingsSchema>;

/** What a person changed in the findings: each field replaces the model's when set. */
export const ResearchEditsSchema = z.object({
  subject: z.string().max(120).optional(),
  summary: z.string().max(2000).optional(),
  points: z.array(ResearchPointSchema).max(40).optional(),
});
export type ResearchEdits = z.infer<typeof ResearchEditsSchema>;
