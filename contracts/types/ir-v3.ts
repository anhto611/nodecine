import { z } from 'zod';
import { AssetUrlSchema, MediaUrlSchema, SCENE_FORMAT, SCENE_SOURCE_MAX, StyleSchema, VarsSchema } from './payloads';

/**
 * Universal Video IR, version 3. One idea over version 2: the flat `timeline[]`
 * becomes tracks of clips, and a clip may be as long as the film. Version 2 could say nothing that
 * outlived a scene; this is where a background that runs under every scene, a device that flies
 * from one pose to the next, and a second audio track get their place.
 *
 * Still engine-blind and still self-contained: nothing here names an engine, and a saved IR replays
 * anywhere. What an engine needs beyond this goes through a registry the engine fills — the code
 * renderer table for `format`, and the transition table for `transitions[].name`.
 *
 * This is the shape the assembler writes and every engine reads; `ir.ts` re-exports it under the
 * plain names. `migrate-ir.ts` brings a version-2 IR here without loss.
 */

export const IR_V3_VERSION = 3 as const;

export const CaptionWordSchema = z.object({ text: z.string().min(1), startFrame: z.number().int().nonnegative(), durationInFrames: z.number().int().positive() });
export const CaptionCueSchema = z.object({ startFrame: z.number().int().nonnegative(), durationInFrames: z.number().int().positive(), words: z.array(CaptionWordSchema).min(1) });
/** Captions on the frame clock, optional: an IR without them is the same film without subtitles. */
export const IRCaptionsSchema = z.object({ cues: z.array(CaptionCueSchema) });
export type IRCaptions = z.infer<typeof IRCaptionsSchema>;

/**
 * How many frames a sound of `seconds` occupies: rounded up, so a film never ends before its audio
 * does. The assembler counts with this when it writes an IR and the migration when it reads a
 * version-2 one; the two have to agree to the frame or `padTailFrames` comes back off by one.
 */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.ceil(seconds * fps);
}

const Id = z.string().min(1).max(120);
const Frame = z.number().int().nonnegative();
const Frames = z.number().int().positive();

/** A drawn clip: the scene of version 2, plus the format its source is written in. */
export const CodeClipSchema = z.object({
  id: Id,
  kind: z.literal('code'),
  startFrame: Frame,
  durationInFrames: Frames,
  /** An engine without a renderer for this format blocks the output node; `html-gsap` is the one every engine must have. */
  format: z.string().min(1).max(60).default(SCENE_FORMAT),
  /** The clip's HTML fragment, complete. */
  source: z.string().min(1).max(SCENE_SOURCE_MAX),
  /** Verified values the clip's `data-fact` elements take, by fact key. */
  facts: z.record(z.string(), z.unknown()).optional(),
  /**
   * Start the drawing over when it runs out. Only means anything for a format with a length of its
   * own — a Lottie file — where the clip may be longer than the animation; `html-gsap` has no such
   * length. Left off, such a drawing holds its last frame rather than disappearing.
   */
  loop: z.boolean().optional(),
});
export type CodeClip = z.infer<typeof CodeClipSchema>;

/** A file on a track with no drawing around it: raw footage, a gameplay loop under the film, a still. */
export const MediaClipSchema = z.object({
  id: Id,
  kind: z.literal('media'),
  startFrame: Frame,
  durationInFrames: Frames,
  url: z.union([MediaUrlSchema, AssetUrlSchema]),
  /** Seconds into the file the clip starts taking frames from. */
  offsetSeconds: z.number().nonnegative().default(0),
  fit: z.enum(['cover', 'contain']).default('cover'),
  /** The file's own length in seconds, measured. An engine that repeats the file needs it. */
  sourceSeconds: z.number().positive().optional(),
  /** A file shorter than the clip starts over; what a background loop is. */
  loop: z.boolean().default(false),
  /** The file's own sound. Zero by default: a film with a voice does not want its footage talking over it. */
  gain: z.number().min(0).max(1).default(0),
});
export type MediaClip = z.infer<typeof MediaClipSchema>;

export const ClipSchema = z.discriminatedUnion('kind', [CodeClipSchema, MediaClipSchema]);
export type Clip = z.infer<typeof ClipSchema>;

/** One layer. Order in `tracks` is stacking order, the first at the bottom; no separate z field. */
export const TrackSchema = z.object({ id: Id, clips: z.array(ClipSchema) });
export type Track = z.infer<typeof TrackSchema>;

/**
 * A scene as the script sees it: a window of frames, the code clip that draws it, and direction for
 * any clip that spans the film. `stage` is a free map the plan writes and the core only carries —
 * `stage.device = {x, y, scale, rot}` is the spanning device's business, not the core's.
 */
export const BeatSchema = z.object({
  index: Frame,
  startFrame: Frame,
  durationInFrames: Frames,
  /** Captions pour into this clip's `captions` slot, as they did into the scene's. */
  clipId: Id,
  stage: z.record(z.string(), z.unknown()).optional(),
});
export type Beat = z.infer<typeof BeatSchema>;

export const AudioTrackSchema = z.object({
  id: Id,
  url: MediaUrlSchema,
  startFrame: Frame,
  durationInFrames: Frames,
  gain: z.number().min(0).max(1).default(1),
  /** A hint, not logic: `voice` is the track `words`, `when` and captions belong to. At most one. */
  role: z.enum(['voice', 'music', 'ambient']).optional(),
  /** Seconds into the file to start from, and whether to start over when it runs out. */
  offsetSeconds: z.number().nonnegative().optional(),
  loop: z.boolean().optional(),
  /** A ramp in and a ramp out, in seconds, drawn by the engine on the track's volume. */
  fadeInSeconds: z.number().nonnegative().optional(),
  fadeOutSeconds: z.number().nonnegative().optional(),
  /** Lower this track to `to` while track `by` has sound; the mixing node or the engine does it. */
  duck: z.object({ by: Id, to: z.number().min(0).max(1) }).optional(),
  /** Per-frame frequency bands extracted ahead of time, for clips that move to the music. */
  analysisUrl: MediaUrlSchema.optional(),
});
export type AudioTrack = z.infer<typeof AudioTrackSchema>;

/** The four transitions every engine registers, so any migrated version-2 IR plays everywhere. */
export const REQUIRED_TRANSITIONS = ['cut', 'fade', 'slide', 'zoom'] as const;

export const TransitionRefSchema = z.object({
  /** A name in the transition registry; an engine without it blocks the output node. */
  name: z.string().min(1).max(60),
  seconds: z.number().min(0.1).max(2),
});
export type TransitionRef = z.infer<typeof TransitionRefSchema>;

export const VideoIRV3Schema = z.object({
  irVersion: z.literal(IR_V3_VERSION),
  meta: z.object({
    title: z.string(),
    language: z.string().min(2),
    fps: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /** Authoritative. Never derived from a track when reading: a silent film has no track to derive it from. */
    totalDurationInFrames: Frames,
  }),
  style: StyleSchema,
  vars: VarsSchema.optional(),
  tracks: z.array(TrackSchema).min(1),
  beats: z.array(BeatSchema).min(1),
  audio: z.array(AudioTrackSchema),
  transitions: z.object({
    default: TransitionRefSchema,
    /** Overrides at one boundary: after the beat clip named. */
    at: z.array(TransitionRefSchema.extend({ afterClipId: Id })).optional(),
  }),
  captions: IRCaptionsSchema.optional(),
});
export type VideoIRV3 = z.infer<typeof VideoIRV3Schema>;

/** Every clip of the IR, whatever track it sits on. */
export function allClips(ir: Pick<VideoIRV3, 'tracks'>): Clip[] {
  return ir.tracks.flatMap((t) => t.clips);
}

/** The scenes as the script sees them: the beat clips, in beat order. What version 2 called the timeline. */
export function beatClipsOf(ir: Pick<VideoIRV3, 'tracks' | 'beats'>): CodeClip[] {
  const byId = new Map(allClips(ir).map((c) => [c.id, c] as const));
  return ir.beats.flatMap((b) => {
    const c = byId.get(b.clipId);
    return c && c.kind === 'code' ? [c] : [];
  });
}

/** The track the words and the captions belong to, when the film has one. */
export function voiceTrackOf(ir: Pick<VideoIRV3, 'audio'>): AudioTrack | undefined {
  return ir.audio.find((a) => a.role === 'voice');
}

/**
 * When the voice is speaking, as frame windows, for a track that ducks under it: the caption lines
 * when the film has them, merged across gaps shorter than a third of a second; else the whole span
 * of the voice track; nothing without a voice. Both engines draw `duck` from this.
 */
export function speechWindowsOf(ir: Pick<VideoIRV3, 'audio' | 'captions' | 'meta'>): { startFrame: number; endFrame: number }[] {
  const voice = voiceTrackOf(ir);
  if (!voice) return [];
  const cues = ir.captions?.cues ?? [];
  if (cues.length === 0) return [{ startFrame: voice.startFrame, endFrame: voice.startFrame + voice.durationInFrames }];
  const gap = Math.round(ir.meta.fps / 3);
  const out: { startFrame: number; endFrame: number }[] = [];
  for (const cue of [...cues].sort((a, b) => a.startFrame - b.startFrame)) {
    const last = out[out.length - 1];
    const end = cue.startFrame + cue.durationInFrames;
    if (last && cue.startFrame - last.endFrame <= gap) last.endFrame = Math.max(last.endFrame, end);
    else out.push({ startFrame: cue.startFrame, endFrame: end });
  }
  return out;
}

/**
 * Whether a track with clips lies under the scenes' track. Then the scenes are drawn without their
 * ground (`TRANSPARENT_GROUND_CSS`), so what is under them shows through: gameplay under a story,
 * a screen recording under its annotations. A style sheet's `.nc-scene { background }` is for a
 * film that has nothing under it.
 */
export function hasTracksUnderBeats(ir: Pick<VideoIRV3, 'tracks' | 'beats'>): boolean {
  const beatIds = new Set(ir.beats.map((b) => b.clipId));
  const beatTrack = ir.tracks.findIndex((t) => t.clips.some((c) => beatIds.has(c.id)));
  return beatTrack > 0 && ir.tracks.slice(0, beatTrack).some((t) => t.clips.length > 0);
}

/** Frames the film runs on after the voice has stopped; zero for a film without a voice. Version 2's `padTailFrames`. */
export function padTailFramesOf(ir: Pick<VideoIRV3, 'audio' | 'meta'>): number {
  const voice = voiceTrackOf(ir);
  return voice ? Math.max(0, ir.meta.totalDurationInFrames - (voice.startFrame + voice.durationInFrames)) : 0;
}
