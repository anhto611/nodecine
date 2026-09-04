import type { DirectorPlan, FactSheet, Voiceover } from '../types/payloads';
import { IR_VERSION, type VideoIR, type TimelineEntry } from '../types/ir';
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
  params?: Partial<AssemblerParams>;
  /** Test-only: skip the registry check when no scenes are registered. */
  checkRegistry?: boolean;
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

export function buildIR(input: BuildIRInput): VideoIR {
  const p = { ...DEFAULT_ASSEMBLER_PARAMS, ...input.params };
  const { plan, voiceover, facts } = input;

  const { total, padTailFrames } = computeTotalFrames(voiceover.durationSeconds, p.fps, p.minTotalFrames);
  const frames = allocateFrames(
    total,
    plan.scenes.map((s) => s.weight),
  );

  let cursor = 0;
  const timeline: TimelineEntry[] = plan.scenes.map((scene, i) => {
    const entry: TimelineEntry = {
      id: `scene-${i + 1}-${scene.sceneType.replace('/', '-')}`,
      sceneType: scene.sceneType,
      startFrame: cursor,
      durationInFrames: frames[i] as number,
      props: applyFactBindings(scene.props, scene.factBindings, facts?.facts),
    };
    cursor += frames[i] as number;
    return entry;
  });

  const ir: VideoIR = {
    irVersion: IR_VERSION,
    meta: {
      title: p.title,
      language: plan.language,
      theme: plan.theme,
      fps: p.fps,
      width: p.width,
      height: p.height,
      totalDurationInFrames: total,
    },
    audioTrack: {
      voiceoverUrl: voiceover.audioUrl,
      durationSeconds: voiceover.durationSeconds,
      padTailFrames,
    },
    timeline,
  };

  assertValidIR(ir, { checkRegistry: input.checkRegistry });
  return ir;
}
