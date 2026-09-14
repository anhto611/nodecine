import { z } from 'zod';
import { MediaUrlSchema, StyleSchema, TransitionSchema, VarsSchema } from './payloads';
import { IRCaptionsSchema } from './ir-v3';

/**
 * Universal Video IR, version 2 — kept only so a film an older build made can be brought forward
 * (`migrate-ir.ts`). Nothing writes this shape any more; the job history, the tag inside an
 * exported MP4 and an open player are where it still turns up.
 *
 * One flat `timeline` of scenes, one pre-mixed voice track that is also the film's clock, one
 * transition for the whole film. What it could not say is what version 3 exists for.
 */

export const IR_V2_VERSION = 2 as const;

export const TimelineEntrySchema = z.object({
  id: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  /** The scene's HTML fragment, complete. */
  source: z.string().min(1),
  /** Verified values the scene's `data-fact` elements take, by fact key. */
  facts: z.record(z.string(), z.unknown()).optional(),
});
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

export const VideoIRV2Schema = z.object({
  irVersion: z.literal(IR_V2_VERSION),
  meta: z.object({
    title: z.string(),
    language: z.string().min(2),
    fps: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    totalDurationInFrames: z.number().int().positive(),
  }),
  style: StyleSchema,
  transition: TransitionSchema,
  audioTrack: z.object({
    voiceoverUrl: MediaUrlSchema,
    durationSeconds: z.number().positive(),
    padTailFrames: z.number().int().nonnegative(),
  }),
  timeline: z.array(TimelineEntrySchema).min(1),
  vars: VarsSchema.optional(),
  captions: IRCaptionsSchema.optional(),
});
export type VideoIRV2 = z.infer<typeof VideoIRV2Schema>;
