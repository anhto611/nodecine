import { z } from 'zod';
import { MediaUrlSchema, StyleSchema, TransitionSchema, VarsSchema } from './payloads';

/**
 * Universal Video IR — generic and self-contained (CORE_CONTRACTS §3). Every scene carries its own
 * drawing and the film carries the style they share, so an engine needs nothing registered to draw
 * it and a saved IR replays anywhere. It knows no scene by name.
 */

export const IR_VERSION = 2 as const;

export const TimelineEntrySchema = z.object({
  id: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  /** The scene's HTML fragment, complete (CORE_CONTRACTS §2.8). */
  source: z.string().min(1),
  /** Verified values the scene's `data-fact` elements take, by fact key; resolved by the assembler. */
  facts: z.record(z.string(), z.unknown()).optional(),
});
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

export const CaptionWordSchema = z.object({ text: z.string().min(1), startFrame: z.number().int().nonnegative(), durationInFrames: z.number().int().positive() });
export const CaptionCueSchema = z.object({ startFrame: z.number().int().nonnegative(), durationInFrames: z.number().int().positive(), words: z.array(CaptionWordSchema).min(1) });
/** Captions on the frame clock, optional: an IR without them is the same video without subtitles. */
export const IRCaptionsSchema = z.object({ cues: z.array(CaptionCueSchema) });
export type IRCaptions = z.infer<typeof IRCaptionsSchema>;

export const VideoIRSchema = z.object({
  irVersion: z.literal(IR_VERSION),
  meta: z.object({
    title: z.string(),
    language: z.string().min(2),
    fps: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    totalDurationInFrames: z.number().int().positive(),
  }),
  /** What every scene shares: copied from the plan. */
  style: StyleSchema,
  transition: TransitionSchema,
  audioTrack: z.object({
    voiceoverUrl: MediaUrlSchema,
    durationSeconds: z.number().positive(),
    padTailFrames: z.number().int().nonnegative(),
  }),
  timeline: z.array(TimelineEntrySchema).min(1),
  /** Values of the whole video (CORE_CONTRACTS §2.6): the plan's `vars`, plus `date` and `time` of the run unless it sets them. */
  vars: VarsSchema.optional(),
  captions: IRCaptionsSchema.optional(),
});
export type VideoIR = z.infer<typeof VideoIRSchema>;
