import { z } from 'zod';
import { ErrorCode, NodeError } from '@/core/errors';
import { runDirector } from '@/nodes/director/loop';
import { buildDirectorPrompt } from '@/nodes/director/prompt';
import { BeatSchema, boundFactKeys, expandBeats, outputSchemaFor, toPackets, unknownBlocks } from '@/nodes/director/beats';
import { duplicateBlockIds } from '@/core/look/props';
import { resolveOutputLanguage } from '@/core/text/languages';
import type { BlockDef, BlockSet, FactSheet, LLMRef, SourceRef, StageDef } from '@/core/types/payloads';
import type { Packet } from '@/core/types/packet';
import type { BlockReason, NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({
  /** What the video is about and how it should feel. The one thing only the user can say. */
  prompt: z.string().min(1).max(4000),
  /** `auto` = the language of the brief and the facts; otherwise a BCP 47 primary subtag. */
  outputLanguage: z.string().min(2).max(35).default('auto'),
  beats: z.array(BeatSchema).min(1).max(24),
});

export const AI_DIRECTOR = 'core/ai-director';

export const DEFAULT_AI_DIRECTOR: z.infer<typeof Params> = {
  prompt: 'A short, warm introduction to the subject. Plain language, one idea per scene.',
  outputLanguage: 'auto',
  beats: [
    { role: 'opening', brief: 'Say what this is in one line.', weight: 1, count: 1, blocks: [], factBindings: {} },
    { role: 'body', brief: 'One idea per scene, building on the last.', weight: 1, count: 2, blocks: [], factBindings: {} },
    { role: 'closing', brief: 'Leave the viewer with one thing to do or remember.', weight: 1, count: 1, blocks: [], factBindings: {} },
  ],
};

/** The union of every Blocks node on the wire, in wire order. */
const catalogueOf = (packets: Packet[] | undefined): BlockDef[] => (packets ?? []).flatMap((p) => (p.payload as BlockSet).blocks);

/** The wired catalogue must be usable before a model call is spent: unique ids, and every id a beat names. */
function catalogueProblem(beats: z.infer<typeof Params>['beats'], catalogue: BlockDef[]): BlockReason | null {
  const dupes = duplicateBlockIds(catalogue);
  if (dupes.length) {
    return { kind: 'capability', code: ErrorCode.NODE_PARAMS_INVALID, message: `two wired blocks share the id: ${dupes.join(', ')}`, fix: 'give each block a different id' };
  }
  const missing = unknownBlocks(beats, catalogue);
  if (missing.length) {
    return { kind: 'capability', code: ErrorCode.NODE_PARAMS_INVALID, message: `no wired block named: ${missing.join(', ')}`, fix: 'add a block with that id to a wired Blocks node, or clear the beat\'s block list' };
  }
  return null;
}

/**
 * The one director (CORE_CONTRACTS §5.8). It asks a language model for a narration and, for every
 * scene of every beat, which block of the wired catalogue to use and what to put in it, then hands
 * the Timeline Assembler a self-contained plan: stage, blocks, scenes.
 *
 * Nothing about any particular kind of video lives here. The brief and the beats are parameters, the
 * look arrives on wires as data, the output shape is derived from the blocks' own props tables, and
 * any prop bound to a fact is left out of the prompt entirely — checkable data reaches the video
 * through the Facts port, never through the model. That is what lets a user build a GitHub showcase,
 * a quote reel or anything else from a blank canvas, and share the result as a template that is only data.
 */
export const aiDirector: NodeDefinition<typeof Params> = {
  type: AI_DIRECTOR,
  version: 2,
  namespace: 'core',
  kind: 'process',
  inputs: [
    // A line the user typed, for videos with no fact source: it becomes the subject of the brief.
    { name: 'source', type: 'SourceRef', required: false },
    { name: 'facts', type: 'FactSheet', required: false },
    { name: 'stage', type: 'StageDef' },
    { name: 'blocks', type: 'BlockSet', multiple: true },
    { name: 'llm', type: 'LLMRef', requires: ['installed', 'authenticated'] },
  ],
  outputs: [
    { name: 'plan', type: 'DirectorPlan' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: DEFAULT_AI_DIRECTOR,

  preflight: (_inputs, params, lists) => catalogueProblem(params.beats, catalogueOf(lists.blocks)),

  run: async ({ params, inputs, lists, services, signal, log, progress }) => {
    const facts = inputs.facts?.payload as FactSheet | undefined;
    const subject = (inputs.source?.payload as SourceRef | undefined)?.value.trim() || undefined;
    const ref = inputs.llm!.payload as LLMRef;
    const stage = inputs.stage!.payload as StageDef;
    const catalogue = catalogueOf(lists.blocks);
    const scenes = expandBeats(params.beats, catalogue);
    const excludeFacts = boundFactKeys(params.beats);

    // The source for "auto" is whatever the model will read: the brief, and the facts it may see.
    const factText = facts ? Object.entries(facts.facts).filter(([k]) => !excludeFacts.has(k)).map(([, v]) => (typeof v === 'string' ? v : '')).join('\n') : '';
    const language = resolveOutputLanguage(params.outputLanguage, `${subject ?? ''}\n${params.prompt}\n${factText}`);
    log('info', `${scenes.length} scenes · ${catalogue.length} blocks · stage ${stage.id} · output language ${language}${params.outputLanguage === 'auto' ? ' (detected)' : ''} · provider ${ref.providerId}`);

    let outputSchema;
    try {
      outputSchema = outputSchemaFor(scenes, stage);
    } catch (e) {
      throw new NodeError(ErrorCode.NODE_PARAMS_INVALID, e instanceof Error ? e.message : String(e), false);
    }

    const out = await runDirector({ services, signal, log, progress }, ref, {
      outputSchema,
      buildPrompt: (lang, strict) => buildDirectorPrompt({ brief: params.prompt, subject, facts, excludeFacts, stage, scenes, language: lang, strict }),
      languageOf: (o) => o.language,
    }, language);

    const packets = toPackets({ ...out, language }, scenes, stage, catalogue);
    log('info', `narration ${packets.script.text.split(/\s+/).length} words · ${packets.plan.scenes.map((s) => s.blockId).join(', ')}`);
    return packets;
  },
};
