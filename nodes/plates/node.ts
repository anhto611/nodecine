import { z } from 'zod';
import { PlateSchema, SCENE_SOURCE_MAX, type ContentKey, type LLMRef, type Plate, type LayerSheet, type LayerSpec, type PlateSheet, type SceneScript, type StyleSheet } from '@/contracts/types/payloads';
import { ErrorCode, NodeError } from '@/contracts/errors';
import type { NodeDefinition } from '@/core/nodes/definition';
import { resolveLLM } from '@/contracts/resources';
import type { NodeServices } from '@/core/engine/services';
import { posed, shapeKey, signaturesOf, type Box } from '@/contracts/visual/plates';
import { getForm } from '@/contracts/forms/registry';
import { buildPlatePrompt, lintPlate } from './prompt';

export const PLATES = 'core/plates';

const Params = z.object({
  /** The language model this node draws with (§1.3). */
  llmProvider: z.string().max(60).default(''),
  llmSettings: z.record(z.string(), z.unknown()).default({}),
  /** Draw again even for a shape the sheet already holds; for trying a new look on one plate. */
  redraw: z.boolean().default(false),
});

/**
 * The plate maker: one drawing per shape of content, made once and used many times.
 *
 * The Illustrator draws every scene of every film, which is the most expensive step of the pipeline
 * and the reason two films of one workflow never look alike. This node draws instead one layout per
 * shape — a big number with a label, a title with three points — in the film's style. Pin it (§1.4)
 * and from then on making a video costs nothing here at all.
 *
 * It asks the model once per shape it has not got, so a second script that says the same shapes
 * costs nothing either.
 */
export const plates: NodeDefinition<typeof Params> = {
  type: PLATES,
  version: 2,
  kind: 'process',
  inputs: [
    { name: 'scenes', type: 'SceneScript' },
    { name: 'style', type: 'StyleSheet' },
    // What the film already puts over the scenes, so a plate leaves room for it. Drawn once and
    // poured into many times, so the room has to be left in the layout rather than per scene.
    { name: 'layers', type: 'LayerSheet', required: false },
    // Plates already drawn, from a pinned run or another workflow: only what is missing is drawn.
    { name: 'plates', type: 'PlateSheet', required: false },
  ],
  outputs: [{ name: 'plates', type: 'PlateSheet' }],
  paramsSchema: Params,
  defaultParams: { llmProvider: '', llmSettings: {}, redraw: false },
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const script = inputs.scenes!.payload as SceneScript;
    const sheet = inputs.style!.payload as StyleSheet;
    const had = (inputs.plates?.payload as PlateSheet | undefined)?.plates ?? [];
    const layers = (inputs.layers?.payload as LayerSheet | undefined)?.layers ?? [];
    // Poses live in the film's form, and the script says which form it was written for, so nothing
    // extra has to be wired in for a layout to know the box it must fit.
    // The one place the script's form and the sheet's form are both in hand. They are set on two
    // nodes with no wire between them, so this is where a disagreement can be caught at all.
    if (sheet.form && script.form && sheet.form !== script.form) {
      log('warn', `the set was drawn for "${sheet.form}" but the script was written for "${script.form}"; the layouts follow the script`);
    }
    const poses = getForm(script.form)?.poses ?? [];
    // Resolved to boxes before the shapes are counted, so poses that share a box share a layout.
    const boxOf = (id?: string) => poses.find((p) => p.id === id)?.text;
    const shapes = signaturesOf(posed(script.scenes, poses.map((p) => p.id)).map((s) => ({ ...s, box: boxOf(s.pose) })));
    if (!shapes.length) throw new NodeError(ErrorCode.INPUT_EMPTY, 'no scene says anything to draw', false).withFix('write some content into the scenes first');

    const ref = await resolveLLM(services, params);
    const kept = params.redraw ? [] : had;
    const held = new Set(kept.map((p) => shapeKey(p.keys, p.box)));
    const missing = shapes.filter((s) => !held.has(shapeKey(s.keys, s.box)));
    log('info', `${shapes.length} layout${shapes.length === 1 ? '' : 's'} needed${poses.length ? ` for ${poses.length} poses` : ''} · ${kept.length} already drawn · ${missing.length} to draw`);

    const drawn: Plate[] = [...kept];
    for (const [i, shape] of missing.entries()) {
      progress(i / missing.length, `drawing ${shapeKey(shape.keys, shape.box)}`);
      drawn.push(await drawPlate(services, ref, { ...shape, sheet, script, layers }, signal));
    }
    return { plates: { plates: drawn } as PlateSheet };
  },
};

const Answer = z.object({ source: z.string().min(1).max(SCENE_SOURCE_MAX), budget: z.record(z.string(), z.number().int().positive()).optional() }).strip();

/** Ask for one plate, check it, ask once more with the reason, else give up on that shape. */
async function drawPlate(
  services: Pick<NodeServices, 'complete'>,
  ref: LLMRef,
  b: { keys: ContentKey[]; box?: Box; sheet: StyleSheet; script: SceneScript; layers?: LayerSpec[] },
  signal: AbortSignal,
): Promise<Plate> {
  let feedback: string | undefined;
  // Three tries, not two. A layout that fails takes the whole film down with it, and the second try
  // is the first one that has the reason to work with — giving up right after it throws away the
  // only attempt that was ever well informed.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const a = await services.complete(ref, buildPlatePrompt(b, feedback), Answer, signal, { fresh: attempt > 1 });
    const source = a.source.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const lint = lintPlate(source, b.keys);
    if (!lint.length) {
      // The id carries the pose too: one shape laid out two ways is two drawings, and two plates
      // sharing an id is a catalogue nobody can read.
      // One id per box as well as per shape: two layouts sharing an id is a catalogue nobody reads.
      const id = shapeKey(b.keys, b.box).replace(/[^a-zA-Z0-9]/g, '_');
      return PlateSchema.parse({ id, keys: b.keys, source, ...(b.box ? { box: b.box } : {}), ...(a.budget ? { budget: a.budget } : {}) });
    }
    feedback = lint.join('; ');
  }
  throw new NodeError(ErrorCode.NODE_OUTPUT_INVALID, `the model could not draw a layout for ${shapeKey(b.keys, b.box)}: ${feedback}`, true).withFix('simplify the style brief, or give that pose a bigger box');
}

export const DEFAULT_PLATES = plates.defaultParams;
