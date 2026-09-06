import type { CaptionTrack, DirectorPlan, FactSheet, Voiceover } from '../types/payloads';
import { IR_VERSION, type IRCaptions, type VideoIR, type TimelineEntry } from '../types/ir';
import { allocateFrames, computeTotalFrames } from './allocate';
import { assertValidIR } from './validate-ir';

/** Timeline Assembler node parameters (CORE_CONTRACTS §5.4). */
export interface AssemblerParams {
  fps: number;
  width: number;
  height: number;
  minTotalFrames: number;
  title: string;
}

export const DEFAULT_ASSEMBLER_PARAMS: AssemblerParams = {
  fps: 30,
  width: 1080,
  height: 1920,
  minTotalFrames: 270,
  title: 'Untitled',
};

export interface BuildIRInput {
  plan: DirectorPlan;
  voiceover: Voiceover;
  facts?: FactSheet;
  captions?: CaptionTrack;
  params?: Partial<AssemblerParams>;
}

/** Overlay facts onto props via factBindings; facts always win; missing keys leave props untouched. */
export function applyFactBindings(
  props: Record<string, unknown>,
  bindings: Record<string, string> | undefined,
  facts: FactSheet['facts'] | undefined,
): Record<string, unknown> {
  if (!bindings || !facts) return { ...props };
  const out: Record<string, unknown> = { ...props };
  for (const [propName, factKey] of Object.entries(bindings)) {
    if (Object.prototype.hasOwnProperty.call(facts, factKey)) out[propName] = facts[factKey];
  }
  return out;
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
  const frames = allocateFrames(
    total,
    plan.scenes.map((s) => s.weight),
  );

  let cursor = 0;
  const timeline: TimelineEntry[] = plan.scenes.map((scene, i) => {
    const entry: TimelineEntry = {
      id: `scene-${i + 1}-${scene.blockId}`,
      blockId: scene.blockId,
      startFrame: cursor,
      durationInFrames: frames[i] as number,
      props: applyFactBindings(scene.props, scene.factBindings, facts?.facts),
      ...(scene.tone !== undefined ? { tone: scene.tone } : {}),
      ...(scene.fields && Object.keys(scene.fields).length ? { fields: scene.fields } : {}),
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
      width: p.width,
      height: p.height,
      totalDurationInFrames: total,
    },
    stage: plan.stage,
    blocks: plan.blocks,
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
