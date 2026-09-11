import { z } from 'zod';
import { detectLanguage } from '@/core/text/detect-language';
import { SceneContentSchema, StageSchema, TransitionSchema } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';

const SceneRow = z.object({
  role: z.string().min(1).max(40),
  weight: z.number().positive(),
  /** What the voice says over this scene; the scene lasts as long as it. */
  narration: z.string().min(1).max(600),
  content: SceneContentSchema,
  /** Where this scene wants the film's spanning layers (docs/IR_V3.md §5.2); set in the graph, no editor field yet. */
  stage: StageSchema.optional(),
  /** How this scene gives way to the next, when not the film's default; set in the graph, no editor field yet. */
  transitionAfter: TransitionSchema.optional(),
});

const Params = z.object({
  scenes: z.array(SceneRow).min(1),
});

export const DEFAULT_STATIC_SCRIPT: z.infer<typeof Params> = {
  scenes: [
    { role: 'title', weight: 1, narration: 'Meet NodeCine.', content: { kicker: 'NodeCine', title: 'Ship video from a graph', body: 'NodeCine v0.1' } },
    { role: 'how', weight: 2, narration: 'Build short videos from a node graph, not a timeline.', content: { kicker: 'How', title: 'Nodes, not timelines' } },
    { role: 'next', weight: 1, narration: 'Wire a source to a script, a voice, and an engine, and press run.', content: { kicker: 'Next', title: 'Star on GitHub' } },
  ],
};

/**
 * Hand-written scenes (CORE_CONTRACTS §5.2): the script step of the pipeline without a model.
 * Each scene carries its own narration and its content in the vocabulary, the same as the screenwriter
 * writes them; the Illustrator draws them afterwards, so this node needs no visual definition and no network.
 */
export const staticScript: NodeDefinition<typeof Params> = {
  type: 'core/static-script',
  version: 4,
  kind: 'source',
  inputs: [],
  outputs: [
    { name: 'scenes', type: 'SceneScript' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: DEFAULT_STATIC_SCRIPT,
  validate: (p) => (p.scenes.every((s) => s.narration.trim()) ? [] : [{ code: 'INPUT_EMPTY', message: 'A scene has no narration' }]),
  run: async ({ params, log }) => {
    // The user pastes the final narration, so its language *is* the video's language: detect it
    // from the text instead of asking. Voice choice can still be overridden on the TTS Engine.
    const narrations = params.scenes.map((s) => s.narration.trim());
    const text = narrations.join('\n');
    const language = detectLanguage(text);
    log('info', `language detected: ${language}`);
    return {
      scenes: { language, scenes: params.scenes.map((s, i) => ({ role: s.role, weight: s.weight, narration: narrations[i]!, content: s.content, ...(s.stage ? { stage: s.stage } : {}), ...(s.transitionAfter ? { transitionAfter: s.transitionAfter } : {}) })) },
      script: { text, language, segments: narrations },
    };
  },
};
