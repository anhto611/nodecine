import { z } from 'zod';
import { detectLanguage } from '@/core/text/detect-language';
import { SceneContentSchema } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';

const SceneRow = z.object({
  role: z.string().min(1).max(40),
  weight: z.number().positive(),
  content: SceneContentSchema,
});

const Params = z.object({
  script: z.string(),
  scenes: z.array(SceneRow).min(1),
});

export const DEFAULT_STATIC_SCRIPT: z.infer<typeof Params> = {
  script:
    'Meet NodeCine. Build short videos from a node graph, not a timeline. Wire a source to a script, a voice, and an engine, and press run.',
  scenes: [
    { role: 'title', weight: 1, content: { kicker: 'NodeCine', title: 'Ship video from a graph', body: 'NodeCine v0.1' } },
    { role: 'how', weight: 2, content: { kicker: 'How', title: 'Nodes, not timelines' } },
    { role: 'next', weight: 1, content: { kicker: 'Next', title: 'Star on GitHub' } },
  ],
};

/**
 * Hand-written narration and scenes (CORE_CONTRACTS §5.2): the script stage of the pipeline without
 * a model. Scenes are written in the content vocabulary, the same as the director writes them; the
 * Look casts blocks for them afterwards, so this node needs no look and no network.
 */
export const staticScript: NodeDefinition<typeof Params> = {
  type: 'core/static-script',
  version: 3,
  namespace: 'core',
  kind: 'source',
  inputs: [],
  outputs: [
    { name: 'scenes', type: 'SceneScript' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: DEFAULT_STATIC_SCRIPT,
  validate: (p) => (p.script.trim() ? [] : [{ code: 'INPUT_EMPTY', message: 'Script is empty' }]),
  run: async ({ params, log }) => {
    // The user pastes the final narration, so its language *is* the video's language: detect it
    // from the text instead of asking. Voice choice can still be overridden on the TTS Engine.
    const text = params.script.trim();
    const language = detectLanguage(text);
    log('info', `language detected: ${language}`);
    return {
      scenes: { language, scenes: params.scenes.map((s) => ({ role: s.role, weight: s.weight, content: s.content })) },
      script: { text, language },
    };
  },
};
