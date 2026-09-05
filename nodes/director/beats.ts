import { z, type ZodTypeAny } from 'zod';
import { blockById, propsSchemaFor, sceneFieldsSchema, toneNames } from '@/core/look/props';
import type { AudioScript, BlockDef, DirectorPlan, StageDef } from '@/core/types/payloads';

/**
 * A director's beat list is configuration, not code (CORE_CONTRACTS §5.8). Each beat says what a
 * stretch of the video is for, how many scenes it takes, which blocks of the wired catalogue may
 * carry it, and which props come from verified facts rather than the model. The model picks one
 * block per scene from the beat's list and writes that block's props; the shape it must return is
 * derived from the blocks themselves.
 */

export const BeatSchema = z.object({
  /** A short name for the stretch: hook, quote, cta. Shown to the model and in the node. */
  role: z.string().min(1).max(40),
  /** What this stretch should do, in the user's words. May be empty. */
  brief: z.string().max(600).default(''),
  /** Relative duration of each scene, the unit the Timeline Assembler splits frames by. */
  weight: z.number().positive().default(1),
  /** How many scenes in a row. The model must write exactly this many. */
  count: z.number().int().min(1).max(12).default(1),
  /** Block ids the model may pick from; empty means every block wired into the director. */
  blocks: z.array(z.string()).default([]),
  /** prop key → fact key. Never asked of the model; the assembler fills them. */
  factBindings: z.record(z.string(), z.string()).default({}),
});
export type Beat = z.infer<typeof BeatSchema>;

/** One scene the model must write: a beat unrolled by its count, with its allowed blocks resolved. */
export interface ExpandedBeat {
  role: string;
  brief: string;
  weight: number;
  allowed: BlockDef[];
  factBindings: Record<string, string>;
}

export function expandBeats(beats: Beat[], catalogue: BlockDef[]): ExpandedBeat[] {
  const out: ExpandedBeat[] = [];
  for (const b of beats) {
    const allowed = b.blocks.length ? b.blocks.map((id) => blockById(catalogue, id)).filter((x): x is BlockDef => !!x) : catalogue;
    for (let i = 0; i < b.count; i++) out.push({ role: b.role, brief: b.brief, weight: b.weight, allowed, factBindings: b.factBindings });
  }
  return out;
}

/** Block ids the beats name that are not wired in; the node blocks on these before running. */
export function unknownBlocks(beats: Beat[], catalogue: BlockDef[]): string[] {
  const have = new Set(catalogue.map((b) => b.id));
  return [...new Set(beats.flatMap((b) => b.blocks))].filter((id) => !have.has(id));
}

/**
 * What the model returns for one scene: the block it chose, an optional tone, the stage's fields,
 * and that block's props minus the fact-bound keys. One object schema per allowed block, joined on
 * `block`. Tone and fields are read leniently — a name the stage lacks is dropped, not retried.
 */
export function sceneSchemaFor(scene: ExpandedBeat, stage: StageDef): ZodTypeAny {
  const options = scene.allowed.map((b) =>
    z
      .object({
        block: z.literal(b.id),
        tone: z.string().optional(),
        fields: z.record(z.string(), z.unknown()).optional(),
        props: propsSchemaFor(b, Object.keys(scene.factBindings)),
      })
      .strip(),
  );
  if (options.length === 0) throw new Error(`beat "${scene.role}" has no block to choose from`);
  if (options.length === 1) return options[0]!;
  return z.discriminatedUnion('block', options as [(typeof options)[number], (typeof options)[number], ...(typeof options)[number][]]);
}

/** The whole answer: language, narration, and one scene object per expanded beat, in order. */
export function outputSchemaFor(scenes: ExpandedBeat[], stage: StageDef) {
  if (scenes.length === 0) throw new Error('a director needs at least one beat');
  const items = scenes.map((s) => sceneSchemaFor(s, stage));
  return z
    .object({
      language: z.string().min(2).max(35),
      audioScript: z.string().min(20).max(2400),
      scenes: z.tuple(items as [ZodTypeAny, ...ZodTypeAny[]]),
    })
    .strip();
}
export type DirectorScene = { block: string; tone?: string; fields?: Record<string, unknown>; props: Record<string, unknown> };
export type DirectorOutput = { language: string; audioScript: string; scenes: DirectorScene[] };

/** Fact keys the beats read; they go to the assembler, never into the prompt. */
export function boundFactKeys(beats: Beat[]): Set<string> {
  const keys = new Set<string>();
  for (const b of beats) for (const factKey of Object.values(b.factBindings)) keys.add(factKey);
  return keys;
}

/** Two packets with their own hashes. Weight and bindings come from the beats; block, tone, fields and props from the model. */
export function toPackets(out: DirectorOutput, scenes: ExpandedBeat[], stage: StageDef, catalogue: BlockDef[]): { plan: DirectorPlan; script: AudioScript } {
  const language = out.language.toLowerCase();
  const tones = new Set(toneNames(stage));
  const fieldsSchema = sceneFieldsSchema(stage);
  return {
    script: { text: out.audioScript.trim(), language },
    plan: {
      language,
      stage,
      blocks: catalogue,
      scenes: scenes.map((s, i) => {
        const written = out.scenes[i] ?? { block: s.allowed[0]!.id, props: {} };
        const fields = fieldsSchema.safeParse(written.fields ?? {});
        const cleanFields = fields.success ? (Object.fromEntries(Object.entries(fields.data).filter(([, v]) => typeof v === 'string' && v)) as Record<string, string>) : {};
        return {
          blockId: written.block,
          weight: s.weight,
          props: written.props,
          ...(written.tone && tones.has(written.tone) ? { tone: written.tone } : {}),
          ...(Object.keys(cleanFields).length ? { fields: cleanFields } : {}),
          ...(Object.keys(s.factBindings).length ? { factBindings: s.factBindings } : {}),
        };
      }),
    },
  };
}
