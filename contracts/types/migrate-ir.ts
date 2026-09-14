import { ErrorCode } from '@/contracts/errors';
import { IR_V2_VERSION, VideoIRV2Schema, type VideoIRV2 } from './ir-v2';
import { IR_V3_VERSION, VideoIRV3Schema, secondsToFrames, type VideoIRV3 } from './ir-v3';
import { SCENE_FORMAT } from './payloads';

/**
 * Bringing an IR forward. An IR is not in a workflow file; it lives in the job
 * history, in the tag inside an exported MP4, and in an open player. Each of those reads through
 * here, so a film made by an older build still plays in this one.
 *
 * Pure, and lossless in effect: a version-2 IR has exactly one version-3 equivalent, and the two
 * draw the same film. `padTailFrames` is the one field with no direct home; it is the difference
 * between the film's length and the voice's, and comes back from those two.
 */

export class IRVersionUnsupportedError extends Error {
  readonly code = ErrorCode.IR_VERSION_UNSUPPORTED;
  constructor(public readonly found: unknown) {
    super(`this video plan is version ${String(found)}; this build reads ${IR_V2_VERSION} and ${IR_V3_VERSION}`);
    this.name = 'IRVersionUnsupportedError';
  }
}

/** Any IR this build knows, brought to the current shape. Throws for a version it does not. */
export function migrateIR(ir: unknown): VideoIRV3 {
  const version = (ir as { irVersion?: unknown } | null | undefined)?.irVersion;
  if (version === IR_V3_VERSION) return VideoIRV3Schema.parse(ir);
  if (version === IR_V2_VERSION) return fromV2(VideoIRV2Schema.parse(ir));
  throw new IRVersionUnsupportedError(version);
}

/** The version-2 film as version 3: one track of code clips, one voice track, one default transition. */
export function fromV2(v2: VideoIRV2): VideoIRV3 {
  const total = v2.meta.totalDurationInFrames;
  const voiceFrames = Math.max(1, secondsToFrames(v2.audioTrack.durationSeconds, v2.meta.fps));
  return VideoIRV3Schema.parse({
    irVersion: IR_V3_VERSION,
    meta: v2.meta,
    style: v2.style,
    ...(v2.vars ? { vars: v2.vars } : {}),
    tracks: [
      {
        id: 'scenes',
        clips: v2.timeline.map((scene) => ({
          id: scene.id,
          kind: 'code',
          startFrame: scene.startFrame,
          durationInFrames: scene.durationInFrames,
          format: SCENE_FORMAT,
          source: scene.source,
          ...(scene.facts ? { facts: scene.facts } : {}),
        })),
      },
    ],
    beats: v2.timeline.map((scene, index) => ({ index, startFrame: scene.startFrame, durationInFrames: scene.durationInFrames, clipId: scene.id })),
    audio: [
      {
        id: 'voice',
        role: 'voice',
        url: v2.audioTrack.voiceoverUrl,
        startFrame: 0,
        // The voice never outlasts the film; the film may outlast the voice (that is padTailFrames).
        durationInFrames: Math.min(voiceFrames, total),
        gain: 1,
      },
    ],
    transitions: { default: { name: v2.transition.type, seconds: v2.transition.seconds } },
    ...(v2.captions ? { captions: v2.captions } : {}),
  } satisfies Record<string, unknown>);
}

/**
 * A film off a wire or out of a store, in today's shape, or nothing. For the bodies: a packet made
 * by an older build can still sit in a runtime when this build's code first draws it, and a body
 * that reads `beats` off it takes the whole canvas down with it. The executor re-runs the assembler
 * (its version moved), so the old packet is short-lived; it must not be fatal while it lasts.
 */
export function readIR(payload: unknown): VideoIRV3 | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  try { return migrateIR(payload); } catch { return undefined; }
}
