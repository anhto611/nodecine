/**
 * Universal Video IR (CORE_CONTRACTS §3, docs/IR_V3.md) — the current shape, by its plain names.
 * Everything that writes or reads a film imports from here; the versioned modules behind it are for
 * the migration only. `ir-v3.ts` is what this is today; `ir-v2.ts` is what a film made by an older
 * build looks like on its way in.
 */

export {
  IR_V3_VERSION as IR_VERSION,
  VideoIRV3Schema as VideoIRSchema,
  CodeClipSchema,
  MediaClipSchema,
  ClipSchema,
  TrackSchema,
  BeatSchema,
  AudioTrackSchema,
  TransitionRefSchema,
  CaptionWordSchema,
  CaptionCueSchema,
  IRCaptionsSchema,
  REQUIRED_TRANSITIONS,
  allClips,
  beatClipsOf,
  voiceTrackOf,
  padTailFramesOf,
  hasTracksUnderBeats,
  speechWindowsOf,
  secondsToFrames,
} from './ir-v3';

export type {
  VideoIRV3 as VideoIR,
  CodeClip,
  MediaClip,
  Clip,
  Track,
  Beat,
  AudioTrack,
  TransitionRef,
  IRCaptions,
} from './ir-v3';
