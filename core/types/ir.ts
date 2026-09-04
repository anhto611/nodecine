import { z } from 'zod';
import { MediaUrlSchema } from './payloads';

/** Universal Video IR — generic; knows no scene type by name (CORE_CONTRACTS §3). */

export const IR_VERSION = 1 as const;

export const TimelineEntrySchema = z.object({
  id: z.string().min(1),
  sceneType: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  props: z.record(z.string(), z.unknown()),
});
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

export const VideoIRSchema = z.object({
  irVersion: z.literal(IR_VERSION),
  meta: z.object({
    title: z.string(),
    language: z.string().min(2),
    theme: z.string().min(1),
    fps: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    totalDurationInFrames: z.number().int().positive(),
  }),
  audioTrack: z.object({
    voiceoverUrl: MediaUrlSchema,
    durationSeconds: z.number().positive(),
    padTailFrames: z.number().int().nonnegative(),
  }),
  timeline: z.array(TimelineEntrySchema).min(1),
});
export type VideoIR = z.infer<typeof VideoIRSchema>;
