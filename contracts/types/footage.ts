import { z } from 'zod';
import { AssetUrlSchema } from './payloads';

/**
 * A clip somebody recorded, brought into a workflow as it is: the file this machine now holds, and
 * what it turned out to be when it was read. Everything a film does with it — cutting it by what is
 * said, putting it in a frame, laying pictures over it — is measured against these.
 *
 * The clip's own sound is not here: it leaves the Footage node as a Voiceover, because that is what
 * it is once a film is built around it, and every node that already knows how to time words against a
 * voice then works on it unchanged.
 */
export const FootageSchema = z.object({
  /** The clip itself, in this machine's asset store. */
  url: AssetUrlSchema,
  /** What the file was called when it was chosen: what a person recognises it by. */
  name: z.string().min(1).max(200),
  durationSeconds: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  /** Whether anything was said on it: a silent clip can still be shown, never transcribed. */
  hasAudio: z.boolean(),
  /**
   * Whether the picture is clear anywhere the speaker is not — a clip the Matte node cut out. Such a
   * clip is laid over a film's own graphics, which is how type comes to sit behind somebody's head;
   * an ordinary recording would cover them. Clips made before there was a Matte node say nothing, and
   * nothing means no.
   */
  hasAlpha: z.boolean().default(false),
});
export type Footage = z.infer<typeof FootageSchema>;
