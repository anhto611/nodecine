import { z, type ZodTypeAny } from 'zod';
import { getScene } from '../scenes/registry';
import type { AudioScript, DirectorPlan } from '../types/payloads';

/**
 * A director's scene list is configuration, not code (CORE_CONTRACTS §5.8). The user picks scene
 * types from the registry, says how many of each and in what order, and names which props are to
 * be filled from verified facts rather than written by the model. Everything a model must produce
 * is then derived from the registry's own schemas — no scene type has a hand-written output shape.
 */

export const SlotSchema = z.object({
  sceneType: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'sceneType must look like <namespace>/<name>'),
  /** Relative duration, the same unit the Timeline Assembler splits frames by. */
  weight: z.number().positive().default(1),
  /** How many scenes of this type in a row. The model must write exactly this many. */
  count: z.number().int().min(1).max(12).default(1),
  /** prop key → fact key. These props are never asked of the model; the assembler fills them. */
  factBindings: z.record(z.string(), z.string()).default({}),
});
export type Slot = z.infer<typeof SlotSchema>;

/** One scene the model must write: a slot unrolled by its count. */
export interface ExpandedScene {
  sceneType: string;
  weight: number;
  factBindings: Record<string, string>;
}

export function expandSlots(slots: Slot[]): ExpandedScene[] {
  const out: ExpandedScene[] = [];
  for (const s of slots) {
    for (let i = 0; i < s.count; i++) out.push({ sceneType: s.sceneType, weight: s.weight, factBindings: s.factBindings });
  }
  return out;
}

/** Scene types in the slots that nothing has registered; the node blocks on these before running. */
export function unknownSceneTypes(slots: Slot[]): string[] {
  return [...new Set(slots.map((s) => s.sceneType))].filter((t) => !getScene(t));
}

/**
 * What the model must write for one scene: the registered props schema minus the fact-bound keys.
 * `.strip()` drops anything the model invents. A schema that is not an object is used as it is.
 */
export function modelSchemaFor(scene: ExpandedScene): ZodTypeAny {
  const def = getScene(scene.sceneType);
  if (!def) throw new Error(`scene type ${scene.sceneType} is not registered`);
  const schema = def.propsSchema;
  if (!(schema instanceof z.ZodObject)) return schema;
  const bound = Object.keys(scene.factBindings).filter((k) => k in schema.shape);
  const mask = Object.fromEntries(bound.map((k) => [k, true as const]));
  return (bound.length ? schema.omit(mask) : schema).strip();
}

/** The whole answer: language, narration, and one object per expanded scene, in order. */
export function outputSchemaFor(scenes: ExpandedScene[]) {
  const items = scenes.map(modelSchemaFor);
  if (items.length === 0) throw new Error('a director needs at least one scene');
  return z
    .object({
      language: z.string().min(2).max(35),
      audioScript: z.string().min(20).max(2400),
      scenes: z.tuple(items as [ZodTypeAny, ...ZodTypeAny[]]),
    })
    .strip();
}
export type DirectorOutput = { language: string; audioScript: string; scenes: unknown[] };

/** Fact keys the slots read; they go to the assembler, never into the prompt. */
export function boundFactKeys(slots: Slot[]): Set<string> {
  const keys = new Set<string>();
  for (const s of slots) for (const factKey of Object.values(s.factBindings)) keys.add(factKey);
  return keys;
}

/** Two packets with their own hashes; sceneType, weight and factBindings come from the slots. */
export function toPackets(out: DirectorOutput, scenes: ExpandedScene[], theme: string): { plan: DirectorPlan; script: AudioScript } {
  const language = out.language.toLowerCase();
  return {
    script: { text: out.audioScript.trim(), language },
    plan: {
      language,
      theme,
      scenes: scenes.map((s, i) => ({
        sceneType: s.sceneType,
        weight: s.weight,
        props: (out.scenes[i] ?? {}) as Record<string, unknown>,
        ...(Object.keys(s.factBindings).length ? { factBindings: s.factBindings } : {}),
      })),
    },
  };
}
