import { z } from 'zod';
import { WRITTEN_KEYS, type LLMRef, type SceneContent, type SceneScript } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { runScreenwriter } from '@/core/ai/structured-completion';
import { DENSITIES, buildBreakdownPrompt, hasWritten, outputSchemaFor, type WrittenScene } from './prompt';

const Params = z.object({
  /** A scene the person already wrote for keeps its words: their choice outranks the model's. */
  overwrite: z.boolean().default(false),
  /** How much goes on screen per scene. `auto` lets each narration decide. */
  density: z.enum(DENSITIES).default('auto'),
});

export const SCENE_BREAKDOWN = 'core/scene-breakdown';

/**
 * CORE_CONTRACTS §5.20 — SceneScript → SceneScript, with something on screen in every scene.
 *
 * A finished script does not go back to a screenwriter; what it still needs is a breakdown: someone
 * reads each line and decides what is shown while it is spoken. That is the step a pasted script
 * lacks — the Static Script carries narration and, unless typed by hand, nothing else — and it is
 * not the Screenwriter's job, which would rewrite the words. This node writes only the content
 * keys, in the screenwriter's vocabulary, and the narration goes through untouched: the model is
 * never asked for it, so there is nothing to check afterwards.
 *
 * Only empty scenes are written unless `overwrite` says otherwise, the way the stock node keeps a
 * picture the person chose. Files stay whatever happens; a model cannot write them (§2.11).
 */
export const sceneBreakdown: NodeDefinition<typeof Params> = {
  type: SCENE_BREAKDOWN,
  version: 1,
  kind: 'process',
  inputs: [
    { name: 'scenes', type: 'SceneScript' },
    { name: 'llm', type: 'LLMRef', requires: ['installed', 'authenticated'] },
  ],
  outputs: [{ name: 'scenes', type: 'SceneScript' }],
  paramsSchema: Params,
  defaultParams: { overwrite: false, density: 'auto' },
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const script = inputs.scenes!.payload as SceneScript;
    const ref = inputs.llm!.payload as LLMRef;

    const wanted = script.scenes.map((s, i) => (params.overwrite || !hasWritten(s.content) ? i : -1)).filter((i) => i >= 0);
    if (wanted.length === 0) {
      log('info', 'every scene already has something on screen');
      return { scenes: script };
    }
    log('info', `${wanted.length} of ${script.scenes.length} scenes to write · language ${script.language} · provider ${ref.providerId}`);

    const out = await runScreenwriter({ services, signal, log, progress }, ref, {
      outputSchema: outputSchemaFor(script.scenes.length),
      buildPrompt: (language, strict) => buildBreakdownPrompt({ script, wanted, density: params.density, language, strict }),
      languageOf: (o) => o.language,
    }, script.language);

    const scenes = script.scenes.map((s, i) => (wanted.includes(i) ? { ...s, content: merge(s, out.scenes[i] ?? {}) } : s));
    log('info', scenes.map((s, i) => `${i + 1}: ${s.content.title ?? Object.keys(s.content).join('+') ?? '—'}`).join(' | '));
    return { scenes: { ...script, scenes } };
  },
};

/**
 * What the model wrote, over what the scene keeps: its files, and nothing for a key a fact fills
 * later. An empty value is no value — a model that answers `"title": ""` has not written a title.
 */
function merge(scene: SceneScript['scenes'][number], written: WrittenScene): SceneContent {
  const bound = new Set(Object.keys(scene.factBindings ?? {}));
  const content: Record<string, unknown> = {};
  for (const k of WRITTEN_KEYS) {
    const v = written[k];
    if (bound.has(k) || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    content[k] = v;
  }
  if (scene.content.image) content.image = scene.content.image;
  if (scene.content.clip) content.clip = scene.content.clip;
  return content as SceneContent;
}
