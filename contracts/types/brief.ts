import { z } from 'zod';

/**
 * What one video is about, as the person asking for it says it: a link, a few sentences, or both, and
 * a few choices. A workflow is a template; the brief is what changes from one video to the next, and
 * every node that needs to know what the video is about reads it from here.
 */

export const TONES = ['energetic', 'trustworthy', 'playful', 'expert'] as const;
export const DURATIONS = [15, 30, 45, 60, 90] as const;

export const BriefSchema = z.object({
  /** Links, a few sentences, or both. */
  about: z.string().min(1).max(3000),
  durationSeconds: z.number().int().min(10).max(120),
  tone: z.enum(TONES),
  language: z.string().min(2).max(35),
  /** What must be said or must not be. */
  notes: z.string().max(1000).default(''),
});
export type Brief = z.infer<typeof BriefSchema>;

/** Every web address in a brief, in order, once each. */
export const linksIn = (about: string): string[] =>
  [...new Set([...about.matchAll(/https?:\/\/[^\s<>"')]+/gi)].map((m) => m[0].replace(/[.,;!?]+$/, '')))];
