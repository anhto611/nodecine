import { z } from 'zod';

/**
 * A storyboard as it travels on a wire: HyperFrames' `STORYBOARD.md` (its frames, one per scene, in
 * order) as that format's own parser reads it, plus what NodeCine adds per frame — the workflow's
 * block the frame plays and the values it plays it with, or the components it shows and where, and
 * on which spoken word each thing happens. The words are the cues; seconds are worked out once the
 * voice exists.
 */

/** A value that is a moment: seconds from the frame's start, or `@word` — when the voiceover says it. */
export const CueSchema = z.union([z.number().nonnegative(), z.string().min(1).max(200)]);
export type Cue = z.infer<typeof CueSchema>;

export const MountSchema = z.object({
  /** A component of the composition: the name of a file under `compositions/components/`. */
  component: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
  /** A named slot of the composition's layout, or `[left, top, width, height]` in pixels. */
  box: z.union([z.string().min(1).max(40), z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()])]),
  /** The component's variables. A string `@word` (or a comma list of them) becomes seconds from this mount's start. */
  values: z.record(z.string(), z.unknown()).default({}),
  /** When it appears; the frame's start when absent. */
  at: CueSchema.optional(),
  /** When it leaves; the frame's end when absent. */
  until: CueSchema.optional(),
  /** Stacking inside the frame: higher is in front. */
  layer: z.number().int().min(0).max(20).optional(),
});
export type Mount = z.infer<typeof MountSchema>;

export const StoryboardFrameSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().max(200).default(''),
  scene: z.string().max(2000).optional(),
  /** What is said over this frame. A frame without it is silent and lasts `durationSeconds`. */
  voiceover: z.string().max(4000).optional(),
  durationSeconds: z.number().positive().optional(),
  transitionIn: z.string().max(60).optional(),
  /** The block this frame plays: the name of a file under `compositions/`. */
  block: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/).optional(),
  /** The block's variables for this frame. A string `@word` (or a comma list of them) becomes seconds from the frame's start. */
  values: z.record(z.string(), z.unknown()).default({}),
  /** Components placed by hand, for a frame that plays no block. */
  mounts: z.array(MountSchema).max(24).default([]),
  /** Every other field of the frame, kept as written. */
  extra: z.record(z.string(), z.string()).default({}),
});
export type StoryboardFrame = z.infer<typeof StoryboardFrameSchema>;

/**
 * A block that runs over several frames on a track of its own, above the frames' blocks: a mark, a
 * progress bar, a phone that stays while the scenes change. NodeCine's addition to the file, written
 * after the frames under `## Layers`.
 */
export const StoryboardLayerSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().max(200).default(''),
  /** A block of the composition whose role is `overlay`. */
  block: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
  /** The first and the last frame it runs over, by their numbers. */
  from: z.number().int().positive(),
  to: z.number().int().positive(),
  /** When it appears, in its first frame, and when it leaves, in its last; those frames' edges when absent. */
  start: CueSchema.optional(),
  end: CueSchema.optional(),
  /** Its track, above the frames' (1 and 2) and below the film's own overlays; the next free one when absent. */
  track: z.number().int().min(3).max(9).optional(),
  /** The block's variables. A string `@word` (or a comma list of them) becomes seconds from the layer's start. */
  values: z.record(z.string(), z.unknown()).default({}),
});
export type StoryboardLayer = z.infer<typeof StoryboardLayerSchema>;

/** The track a layer plays on: its own, or 3 and up in the order the layers are written. */
export const layerTrack = (layer: StoryboardLayer, index: number): number => layer.track ?? Math.min(9, 3 + index);

export const StoryboardSchema = z.object({
  format: z.string().max(40).optional(),
  /** The product or subject the film is about, as its writer understood it. */
  subject: z.string().max(120).optional(),
  message: z.string().max(400).optional(),
  arc: z.string().max(200).optional(),
  frames: z.array(StoryboardFrameSchema).min(1).max(60),
  layers: z.array(StoryboardLayerSchema).max(12).default([]),
  /** The file as written, so it can be shown, saved or handed on unchanged. */
  markdown: z.string().max(200_000),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;
