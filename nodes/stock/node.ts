import { z } from 'zod';
import type { LLMRef, SceneScript } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { STOCK_PROVIDERS } from './providers';
import { STOCK_STYLE_IDS } from './styles';
import { buildStockPrompt, StockQueriesSchema } from './prompt';

const Params = z.object({
  provider: z.enum(STOCK_PROVIDERS).default('pexels'),
  /** Which kind of place the pictures come from. Steers the model; without one wired in it does nothing. */
  style: z.enum(STOCK_STYLE_IDS).default('auto'),
  orientation: z.enum(['landscape', 'portrait', 'square']).default('landscape'),
  /** The frame's long edge: the picture is asked for at the size it will be shown, not enlarged into it. */
  longEdge: z.number().int().min(480).max(4096).default(1920),
  /** A scene that already carries footage keeps it: the person's choice outranks the library's. */
  replaceExisting: z.boolean().default(false),
  /**
   * What a scene may be filled with. `auto` takes a clip and settles for a photograph when no clip
   * fits, which can leave one film holding both; `clip` and `still` keep every scene the same kind
   * and leave a scene empty rather than mix.
   */
  media: z.enum(['auto', 'clip', 'still']).default('auto'),
});

export const STOCK_MEDIA = 'core/stock-media';

/**
 * CORE_CONTRACTS §5.19 — SceneScript → SceneScript, with footage on every scene.
 *
 * **A clip first, a photograph only if no clip fits.** A still held for four seconds reads as a
 * frozen frame however carefully it drifts; Ken Burns is the apology for having no footage, not the
 * goal. That is the order cutdown's `still` frames settled on, and the frames this feeds are ports
 * of them.
 *
 * A scene may only show a file this machine holds (§2.7), so this does not hand out a link: it
 * searches, picks the first candidate that fills the frame, downloads it and puts the asset it
 * became into the scene's `image`. From there the Art Director and the assembler cannot tell a
 * stock photograph from one the person chose by hand.
 *
 * The `llm` port is optional and it is what makes the node useful in a language the libraries do
 * not index. With it, a model writes one short English phrase per scene from the narration; without
 * it the narration itself is the query.
 */
export const stockMedia: NodeDefinition<typeof Params> = {
  type: STOCK_MEDIA,
  version: 1,
  kind: 'process',
  inputs: [
    { name: 'scenes', type: 'SceneScript' },
    { name: 'llm', type: 'LLMRef', required: false, requires: ['installed', 'authenticated'] },
  ],
  outputs: [{ name: 'scenes', type: 'SceneScript' }],
  paramsSchema: Params,
  defaultParams: { provider: 'pexels', style: 'auto', orientation: 'landscape', longEdge: 1920, replaceExisting: false, media: 'auto' },
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const script = inputs.scenes!.payload as SceneScript;
    const ref = inputs.llm?.payload as LLMRef | undefined;

    const has = (i: number) => !!script.scenes[i]!.content.image || !!script.scenes[i]!.content.clip;
    const wanted = script.scenes.map((_, i) => (params.replaceExisting || !has(i) ? i : -1)).filter((i) => i >= 0);
    if (wanted.length === 0) {
      log('info', 'every scene already has its footage');
      return { scenes: script };
    }

    let queries = script.scenes.map((s) => s.narration);
    if (ref) {
      const answer = await services.complete(ref, buildStockPrompt(script, params.style), StockQueriesSchema, signal);
      // One phrase per scene, in order. A short answer falls back to the narration for the rest,
      // rather than shifting every later scene onto the wrong picture.
      queries = script.scenes.map((s, i) => answer.queries[i]?.trim() || s.narration);
      log('info', `search phrases: ${queries.filter((_, i) => wanted.includes(i)).join(' · ')}`);
    } else {
      const ignored = params.style === 'auto' ? '' : ` — and the ${params.style} style does nothing, since it steers the model`;
      log('warn', `no language model wired in: searching with the narration itself, which only works for English${ignored}`);
    }

    const used: string[] = [];
    const scenes = [...script.scenes];
    for (const [n, i] of wanted.entries()) {
      progress(n / wanted.length, `${n + 1}/${wanted.length}`);
      const found = await services.fetchStockMedia({ provider: params.provider, query: queries[i]!, orientation: params.orientation, longEdge: params.longEdge, want: params.media, used }, signal);
      if (!found) {
        const only = params.media === 'clip' ? ' clip' : params.media === 'still' ? ' still' : '';
        log('warn', `no${only} in the library fits the frame for "${queries[i]}" — scene ${i + 1} keeps no footage`);
        continue;
      }
      used.push(found.page);
      // A clip and a photograph are different content keys, and the block that fits follows from
      // which one is there: nothing needs to be cast by hand.
      const key = found.kind === 'clip' ? 'clip' : 'image';
      scenes[i] = { ...scenes[i]!, content: { ...scenes[i]!.content, [key]: found.assetUrl } };
      log('info', `scene ${i + 1}: ${found.kind} ${found.width}×${found.height}${found.durationSec ? ` · ${found.durationSec}s` : ''} by ${found.author}`);
    }
    return { scenes: { ...script, scenes } };
  },
};
