import { z, type ZodTypeAny } from 'zod';
import { CONTENT_KEYS, SceneContentSchema, type AudioScript, type ContentKey, type SceneContent, type SceneScript } from '@/core/types/payloads';

/**
 * A director's beat list is configuration, not code (CORE_CONTRACTS §5.8). Each beat says what a
 * stretch of the video is for, how many scenes it takes, and which content comes from verified
 * facts rather than the model. The model writes each scene in the content vocabulary; which block
 * shows it is the Look's decision, later.
 */

export const BeatSchema = z.object({
  /** A short name for the stretch: hook, quote, cta. Shown to the model, and what the Look casts by. */
  role: z.string().min(1).max(40),
  /** What this stretch should do, in the user's words. May be empty. */
  brief: z.string().max(600).default(''),
  /** Relative duration of each scene, the unit the Timeline Assembler splits frames by. */
  weight: z.number().positive().default(1),
  /** How many scenes in a row. The model must write exactly this many. */
  count: z.number().int().min(1).max(12).default(1),
  /** content key → fact key. Never asked of the model; the assembler fills them. */
  factBindings: z.record(z.enum(CONTENT_KEYS), z.string()).default({}),
});
export type Beat = z.infer<typeof BeatSchema>;

/** One scene the model must write: a beat unrolled by its count. */
export interface ExpandedBeat {
  role: string;
  brief: string;
  weight: number;
  factBindings: Partial<Record<ContentKey, string>>;
}

export function expandBeats(beats: Beat[]): ExpandedBeat[] {
  const out: ExpandedBeat[] = [];
  for (const b of beats) for (let i = 0; i < b.count; i++) out.push({ role: b.role, brief: b.brief, weight: b.weight, factBindings: b.factBindings });
  return out;
}

/** What the model returns for one scene: the content vocabulary minus the fact-bound keys, unknown keys dropped. */
export function sceneSchemaFor(scene: ExpandedBeat): ZodTypeAny {
  const bound = Object.keys(scene.factBindings) as ContentKey[];
  return bound.length ? SceneContentSchema.omit(Object.fromEntries(bound.map((k) => [k, true])) as Record<ContentKey, true>) : SceneContentSchema;
}

/** The whole answer: language, narration, and one content object per expanded beat, in order. */
export function outputSchemaFor(scenes: ExpandedBeat[]) {
  if (scenes.length === 0) throw new Error('a director needs at least one beat');
  const items = scenes.map((s) => sceneSchemaFor(s));
  return z
    .object({
      language: z.string().min(2).max(35),
      audioScript: z.string().min(20).max(2400),
      scenes: z.tuple(items as [ZodTypeAny, ...ZodTypeAny[]]),
    })
    .strip();
}
export type DirectorOutput = { language: string; audioScript: string; scenes: SceneContent[] };

/** Fact keys the beats read; they go to the assembler, never into the prompt. */
export function boundFactKeys(beats: Beat[]): Set<string> {
  const keys = new Set<string>();
  for (const b of beats) for (const factKey of Object.values(b.factBindings)) if (factKey) keys.add(factKey);
  return keys;
}

/** Two packets with their own hashes. Role, weight and bindings come from the beats; the content from the model. */
export function toPackets(out: DirectorOutput, scenes: ExpandedBeat[]): { scenes: SceneScript; script: AudioScript } {
  const language = out.language.toLowerCase();
  return {
    script: { text: out.audioScript.trim(), language },
    scenes: {
      language,
      scenes: scenes.map((s, i) => ({
        role: s.role,
        weight: s.weight,
        content: out.scenes[i] ?? {},
        ...(Object.keys(s.factBindings).length ? { factBindings: s.factBindings } : {}),
      })),
    },
  };
}
