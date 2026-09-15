import { z } from 'zod';

/**
 * What was found out about a video's subject before anything is written: what it is, the points worth
 * saying, and where each came from. The pictures found go out on their own wire, as assets.
 */

export const ResearchSourceSchema = z.object({ url: z.string().max(2000), title: z.string().max(300).default('') });
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const ResearchPointSchema = z.object({
  text: z.string().min(1).max(600),
  /** The address it was read at; empty for what the brief itself says. */
  source: z.string().max(2000).default(''),
});
export type ResearchPoint = z.infer<typeof ResearchPointSchema>;

export const ResearchSchema = z.object({
  language: z.string().min(2).max(35),
  /** What the video is about, named as its sources name it. */
  subject: z.string().max(120),
  summary: z.string().max(2000),
  points: z.array(ResearchPointSchema).max(40),
  sources: z.array(ResearchSourceSchema).max(40),
});
export type Research = z.infer<typeof ResearchSchema>;
