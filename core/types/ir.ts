import { z } from 'zod';
import { BlockDefSchema, MediaUrlSchema, StageDefSchema } from './payloads';

/**
 * Universal Video IR — generic and self-contained (CORE_CONTRACTS §3). It carries the stage and the
 * blocks its scenes use, so an engine needs nothing registered to draw it and a saved IR replays
 * anywhere. It knows no scene by name: a scene is a block id into its own catalogue.
 */

export const IR_VERSION = 1 as const;

export const TimelineEntrySchema = z.object({
  id: z.string().min(1),
  blockId: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  props: z.record(z.string(), z.unknown()),
  tone: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
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
  stage: StageDefSchema,
  blocks: z.array(BlockDefSchema).min(1),
  audioTrack: z.object({
    voiceoverUrl: MediaUrlSchema,
    durationSeconds: z.number().positive(),
    padTailFrames: z.number().int().nonnegative(),
  }),
  timeline: z.array(TimelineEntrySchema).min(1),
  /** What the stage draws for the whole video (CORE_CONTRACTS §2.6): its own `vars`, plus `date` and `time` of the run unless it declares them. */
  vars: z.record(z.string(), z.string()).optional(),
  captions: IRCaptionsSchema.optional(),
});
export type VideoIR = z.infer<typeof VideoIRSchema>;
