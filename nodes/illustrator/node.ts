import { z } from 'zod';
import { AssetUrlSchema, type LLMRef, type ScenePlan, type SceneScript } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { FRAME_PRESETS } from '@/core/visual/frame';
import { drawScene } from './scene';
import { drawStyle } from './style';

export const ILLUSTRATOR = 'core/illustrator';

const Params = z.object({
  /** The video's visual direction in the user's words; the only visual instruction a template carries. */
  brief: z.string().max(600).default(''),
  frame: z.enum(['9:16', '16:9', '1:1', '4:5']).default('9:16'),
  /** A picture fixed for the whole video — a character, a logo — that every scene makes room for. */
  character: z.union([z.literal(''), AssetUrlSchema]).default(''),
});
export type IllustratorParams = z.infer<typeof Params>;

/** Scenes drawn at once: a model call is slow, and the scenes do not depend on one another. */
const PARALLEL = 3;

/**
 * The Illustrator (CORE_CONTRACTS §5.9): the visual step of the pipeline, drawn by a model every
 * run. It takes the script's scenes and a brief, has the model design a style (one style sheet
 * every scene shares), then draws every scene as its own HTML fragment in that style — one scene,
 * one drawing — checks each against the rules, and emits the plan. Nothing is kept: the plan is
 * this run's, the next run draws again. The model's answers are cached by prompt, so the same brief
 * on the same script costs nothing and looks the same; a forced run asks afresh.
 */
export const illustrator: NodeDefinition<typeof Params> = {
  type: ILLUSTRATOR,
  version: 2,
  kind: 'process',
  inputs: [
    { name: 'scenes', type: 'SceneScript' },
    { name: 'llm', type: 'LLMRef', requires: ['installed', 'authenticated'] },
  ],
  outputs: [{ name: 'plan', type: 'ScenePlan' }],
  paramsSchema: Params,
  defaultParams: { brief: '', frame: '9:16', character: '' },
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const script = inputs.scenes!.payload as SceneScript;
    const ref = inputs.llm!.payload as LLMRef;
    const preset = FRAME_PRESETS.find((f) => f.id === params.frame) ?? FRAME_PRESETS[0]!;
    const frame = { width: preset.width, height: preset.height };
    const vars: Record<string, string> = params.character ? { character: params.character } : {};

    progress(0.05, 'drawing the style');
    const drawn = await drawStyle(services, ref, { brief: params.brief, frame, language: script.language, character: !!params.character }, signal);
    for (const w of drawn.warnings) log('warn', `style: ${w}`);
    log('info', `style "${drawn.style.name}"${drawn.attempts > 1 ? ' on the second try' : ''}`);

    const count = script.scenes.length;
    const sources: string[] = new Array(count);
    let done = 0;
    let next = 0;
    const worker = async () => {
      while (next < count) {
        const i = next++;
        const scene = script.scenes[i]!;
        const r = await drawScene(services, ref, { style: drawn.style, guide: drawn.guide, frame, language: script.language, scene, index: i, count, vars }, signal);
        sources[i] = r.source;
        for (const w of r.warnings) log('warn', `scene ${i + 1}: ${w}`);
        done++;
        progress(0.15 + (0.8 * done) / count, `drew scene ${i + 1} of ${count}${r.attempts > 1 ? ' on the second try' : ''}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, count) }, worker));

    const plan: ScenePlan = {
      language: script.language,
      frame,
      style: drawn.style,
      transition: { type: 'fade', seconds: 0.4 },
      vars,
      scenes: script.scenes.map((s, i) => ({ weight: s.weight, source: sources[i]!, ...(s.factBindings && Object.keys(s.factBindings).length ? { factBindings: s.factBindings } : {}) })),
    };
    log('info', `${count} scene${count === 1 ? '' : 's'} drawn in "${drawn.style.name}"`);
    return { plan };
  },
};

export const DEFAULT_ILLUSTRATOR: IllustratorParams = illustrator.defaultParams;
