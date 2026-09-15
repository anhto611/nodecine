import { z } from 'zod';

/**
 * What one video is about, as the person asking for it says it: a link, a few sentences, or both. A
 * workflow is a template; the brief is what changes from one video to the next, and every node that needs
 * to know what the video is about reads it from here. How long the video runs and what language its
 * narration is in are the Storyboard Writer's to say: it writes everything again.
 */

export const BriefSchema = z.object({
  /** Links, a few sentences, or both. */
  about: z.string().min(1).max(3000),
  /** The language the brief is written in, read from it; English when it cannot be told. */
  language: z.string().min(2).max(35),
});
export type Brief = z.infer<typeof BriefSchema>;

/** Every web address in a brief, in order, once each. */
export const linksIn = (about: string): string[] =>
  [...new Set([...about.matchAll(/https?:\/\/[^\s<>"')]+/gi)].map((m) => m[0].replace(/[.,;!?]+$/, '')))];
