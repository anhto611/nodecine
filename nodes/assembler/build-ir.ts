import type { CaptionTrack, ScenePlan, FactSheet, Voiceover } from '@/core/types/payloads';
import { readFactPath } from '@/core/types/payloads';
import { videoVars } from '@/core/visual/vars';
import { IR_VERSION, type IRCaptions, type VideoIR, type TimelineEntry } from '@/core/types/ir';
import { allocateFrames, computeTotalFrames, framesFromSegments } from './allocate';
import { assertValidIR } from '@/core/types/validate-ir';

/** Timeline Assembler node parameters (CORE_CONTRACTS §5.4). */
export interface AssemblerParams {
  fps: number;
  minTotalFrames: number;
  title: string;
}

export const DEFAULT_ASSEMBLER_PARAMS: AssemblerParams = {
  fps: 30,
  minTotalFrames: 270,
  title: 'Untitled',
};

export interface BuildIRInput {
  plan: ScenePlan;
  voiceover: Voiceover;
  facts?: FactSheet;
  captions?: CaptionTrack;
  params?: Partial<AssemblerParams>;
  /** The clock this run reads for `date` and `time`; a test passes a fixed one. */
  now?: number;
}

/**
 * The verified values a scene's `data-fact` elements take (CORE_CONTRACTS §5.4): one per binding
 * whose fact is present and says something. An empty string is a fact that says nothing (a page
 * with no description); it leaves the element as drawn rather than blanking it.
 */
export function resolveFacts(bindings: Record<string, string> | undefined, facts: FactSheet['facts'] | undefined): Record<string, unknown> | undefined {
  if (!bindings || !facts) return undefined;
  const out: Record<string, unknown> = {};
  for (const [name, factKey] of Object.entries(bindings)) {
    // A plain key, or `items.2.title` when the beat ran over a list (CORE_CONTRACTS §2.2).
    const value = readFactPath(facts, factKey);
    if (value !== undefined && value !== null && value !== '') out[name] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Seconds on the voice-over's clock → frames on the video's; a word never gets fewer than one frame. */
export function captionsToFrames(track: CaptionTrack, fps: number, totalFrames: number): IRCaptions {
  const frame = (s: number) => Math.min(totalFrames - 1, Math.max(0, Math.round(s * fps)));
  const cues = track.cues
    .map((c) => {
      const startFrame = frame(c.start);
      const durationInFrames = Math.max(1, frame(c.end) - startFrame);
      const words = c.words.map((w) => {
        const ws = frame(w.start);
        return { text: w.text, startFrame: ws, durationInFrames: Math.max(1, frame(w.end) - ws) };
      });
      return { startFrame, durationInFrames, words };
    })
    .filter((c) => c.words.length > 0);
  return { cues };
}

export function buildIR(input: BuildIRInput): VideoIR {
  const p = { ...DEFAULT_ASSEMBLER_PARAMS, ...input.params };
  const { plan, voiceover, facts, captions } = input;

  const { total, padTailFrames } = computeTotalFrames(voiceover.durationSeconds, p.fps, p.minTotalFrames);
  // The cut follows the speech when the voice-over came scene by scene; weights are for a voice-over that did not.
  const bySpeech = voiceover.segments && voiceover.segments.length === plan.scenes.length;
  const frames = bySpeech ? framesFromSegments(total, voiceover.segments!, p.fps) : allocateFrames(total, plan.scenes.map((s) => s.weight));

  let cursor = 0;
  const timeline: TimelineEntry[] = plan.scenes.map((scene, i) => {
    const resolved = resolveFacts(scene.factBindings, facts?.facts);
    const entry: TimelineEntry = {
      id: `scene-${i + 1}`,
      startFrame: cursor,
      durationInFrames: frames[i] as number,
      source: scene.source,
      ...(resolved ? { facts: resolved } : {}),
    };
    cursor += frames[i] as number;
    return entry;
  });

  const ir: VideoIR = {
    irVersion: IR_VERSION,
    meta: {
      title: p.title,
      language: plan.language,
      fps: p.fps,
      width: plan.frame.width,
      height: plan.frame.height,
      totalDurationInFrames: total,
    },
    style: plan.style,
    transition: plan.transition,
    vars: videoVars(plan.vars, plan.language, input.now ?? Date.now()),
    audioTrack: {
      voiceoverUrl: voiceover.audioUrl,
      durationSeconds: voiceover.durationSeconds,
      padTailFrames,
    },
    timeline,
    ...(captions && captions.cues.length ? { captions: captionsToFrames(captions, p.fps, total) } : {}),
  };

  assertValidIR(ir);
  return ir;
}
