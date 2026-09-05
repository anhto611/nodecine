import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import { blockById, duplicateBlockIds, propsSchemaFor } from '@/core/look/props';
import { detectLanguage } from '@/core/text/detect-language';
import type { BlockDef, BlockSet, StageDef } from '@/core/types/payloads';
import type { Packet } from '@/core/types/packet';
import type { BlockReason, NodeDefinition } from '@/core/nodes/definition';

const SceneRow = z.object({
  blockId: z.string().min(1),
  weight: z.number().positive(),
  props: z.record(z.string(), z.unknown()),
  tone: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
});

const Params = z.object({
  script: z.string(),
  scenes: z.array(SceneRow).min(1),
});

export const DEFAULT_STATIC_SCRIPT: z.infer<typeof Params> = {
  script:
    'Meet NodeCine. Build short videos from a node graph, not a timeline. Wire a source to a script, a voice, and an engine, and press run.',
  scenes: [
    { blockId: 'text-card', weight: 1, props: { headline: 'Ship video from a graph', body: 'NodeCine v0.1' }, fields: { kicker: 'NodeCine' } },
    { blockId: 'text-card', weight: 2, props: { headline: 'Nodes, not timelines' }, tone: 'cool', fields: { kicker: 'How' } },
    { blockId: 'text-card', weight: 1, props: { headline: 'Star on GitHub' }, tone: 'warm', fields: { kicker: 'Next' } },
  ],
};

/**
 * Hand-written scenes against a wired stage and catalogue. The scenes can only be checked once the
 * wires are known, so that check is a preflight rather than continuous validation.
 */
function scenesProblem(params: z.infer<typeof Params>, stage: StageDef | undefined, catalogue: BlockDef[]): BlockReason | null {
  const problems: string[] = [];
  const dupes = duplicateBlockIds(catalogue);
  if (dupes.length) problems.push(`two wired blocks share the id: ${dupes.join(', ')}`);
  params.scenes.forEach((s, i) => {
    const block = blockById(catalogue, s.blockId);
    if (!block) {
      problems.push(`scene ${i + 1}: no wired block named "${s.blockId}"`);
      return;
    }
    const parsed = propsSchemaFor(block).safeParse(s.props);
    if (!parsed.success) problems.push(`scene ${i + 1} (${s.blockId}): ${parsed.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join(', ')}`);
    if (s.tone !== undefined && stage && !(s.tone in stage.tones)) problems.push(`scene ${i + 1}: the stage has no tone "${s.tone}"`);
  });
  if (!problems.length) return null;
  return { kind: 'capability', code: ErrorCode.NODE_PARAMS_INVALID, message: problems.join('; '), fix: 'fix the scene, or wire the block it names' };
}

/** CORE_CONTRACTS §5.2 — hand-written script and scenes; the Phase A acceptance node. */
export const staticScript: NodeDefinition<typeof Params> = {
  type: 'core/static-script',
  version: 2,
  namespace: 'core',
  kind: 'source',
  inputs: [
    { name: 'stage', type: 'StageDef' },
    { name: 'blocks', type: 'BlockSet', multiple: true },
  ],
  outputs: [
    { name: 'plan', type: 'DirectorPlan' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: DEFAULT_STATIC_SCRIPT,
  validate: (p) => (p.script.trim() ? [] : [{ code: 'INPUT_EMPTY', message: 'Script is empty' }]),
  preflight: (inputs, params, lists) =>
    scenesProblem(params, inputs.stage?.payload as StageDef | undefined, (lists.blocks ?? []).flatMap((p: Packet) => (p.payload as BlockSet).blocks)),
  run: async ({ params, inputs, lists, log }) => {
    // The user pastes the final narration, so its language *is* the video's language: detect it
    // from the text instead of asking. Voice choice can still be overridden on the TTS Engine.
    const text = params.script.trim();
    const language = detectLanguage(text);
    log('info', `language detected: ${language}`);
    const stage = inputs.stage!.payload as StageDef;
    const blocks = (lists.blocks ?? []).flatMap((p) => (p.payload as BlockSet).blocks);
    return {
      plan: { language, stage, blocks, scenes: params.scenes.map((s) => propsParsed(s, blocks)) },
      script: { text, language },
    };
  },
};

/** Coerce typed-in props through the block's schema (numbers, arrays), keeping the row otherwise. */
function propsParsed(s: z.infer<typeof SceneRow>, blocks: BlockDef[]) {
  const block = blockById(blocks, s.blockId);
  const props = block ? propsSchemaFor(block).parse(s.props) : s.props;
  return { ...s, props };
}
