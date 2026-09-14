import { z, type ZodTypeAny } from 'zod';
import { CONTENT_KEYS, EntryContentSchema, SceneContentSchema, factListAt, type AudioScript, type ContentKey, type FactItem, type FactSheet, type SceneContent, type SceneScript, type WrittenKey } from '@/contracts/types/payloads';

/**
 * What the model says over one scene: its narration plus what is on screen. Files are not its to
 * write — not at the top level and not inside an entry, since a model cannot know which files this
 * machine holds; those come from a person or from a fact binding.
 */
const SpokenEntrySchema = EntryContentSchema.omit({ image: true, clip: true });
const SpokenSceneSchema = SceneContentSchema.omit({ image: true, clip: true })
  .extend({ entries: z.array(SpokenEntrySchema).max(12).optional(), narration: z.string().min(1).max(600) });

/**
 * A director's beat list is configuration, not code (CORE_CONTRACTS §5.8). Each beat says what a
 * stretch of the video is for, how many scenes it takes, and which content comes from verified
 * facts rather than the model. The model writes each scene in the content vocabulary; how it is
 * drawn is the Illustrator's, later.
 */

export const BeatSchema = z.object({
  /** A short name for the stretch: hook, quote, cta. Shown to the model and later to the Illustrator. */
  role: z.string().min(1).max(40),
  /** What this stretch should do, in the user's words. May be empty. */
  brief: z.string().max(600).default(''),
  /** Relative duration of each scene, the unit the Timeline Assembler splits frames by. */
  weight: z.number().positive().default(1),
  /** How many scenes in a row. The model must write exactly this many. */
  count: z.number().int().min(1).max(12).default(1),
  /**
   * A fact key holding a **list** of things (CORE_CONTRACTS §2.2): the beat then runs once per item,
   * up to `count`, and its bindings name a field of the item rather than a top-level fact.
   */
  factList: z.string().max(60).optional(),
  /** content key → fact key, or a field of the item when the beat runs over a list. Never asked of the model. */
  factBindings: z.record(z.enum(CONTENT_KEYS), z.string()).default({}),
});
export type Beat = z.infer<typeof BeatSchema>;

/** One scene the model must write: a beat unrolled by its count, or by the list it runs over. */
export interface ExpandedBeat {
  role: string;
  brief: string;
  weight: number;
  /** content key → the path the assembler reads, already resolved to this scene's item. */
  factBindings: Partial<Record<ContentKey, string>>;
  /** The item this scene is about, so the prompt can show the model what to narrate. */
  item?: FactItem;
}

/**
 * Beats to scenes. A plain beat gives `count` scenes. A beat naming a list gives one scene per
 * item, capped at `count`, and each scene's bindings point at that item — so five news items
 * become five scenes with their own title, source and picture, none of it through the model.
 */
export function expandBeats(beats: Beat[], facts?: FactSheet['facts']): ExpandedBeat[] {
  const out: ExpandedBeat[] = [];
  for (const b of beats) {
    const list = b.factList && facts ? factListAt(facts, b.factList) : null;
    if (b.factList && !list) continue; // the list is not there: no scenes rather than empty cards
    const n = list ? Math.min(b.count, list.length) : b.count;
    for (let i = 0; i < n; i++) {
      const bindings = list
        ? Object.fromEntries(Object.entries(b.factBindings).map(([key, field]) => [key, `${b.factList}.${i}.${field}`]))
        : b.factBindings;
      out.push({ role: b.role, brief: b.brief, weight: b.weight, factBindings: bindings, ...(list ? { item: list[i]! } : {}) });
    }
  }
  return out;
}

/** Beats that name a list, with what that list turned out to be; for the log and for a clear failure. */
export function listBeats(beats: Beat[], facts?: FactSheet['facts']): { role: string; key: string; found: number | null }[] {
  return beats.filter((b) => b.factList).map((b) => ({ role: b.role, key: b.factList!, found: facts ? (factListAt(facts, b.factList!)?.length ?? null) : null }));
}

/** What the model returns for one scene: its narration and the content vocabulary minus the fact-bound keys, unknown keys dropped. */
export function sceneSchemaFor(scene: ExpandedBeat): ZodTypeAny {
  // `image` is not in the spoken schema to begin with, so only the written keys are omitted from it.
  const bound = (Object.keys(scene.factBindings) as ContentKey[]).filter((k): k is WrittenKey => k !== 'image');
  return bound.length ? SpokenSceneSchema.omit(Object.fromEntries(bound.map((k) => [k, true])) as Record<WrittenKey, true>) : SpokenSceneSchema;
}

/** The whole answer: the language and one spoken scene per expanded beat, in order. */
export function outputSchemaFor(scenes: ExpandedBeat[]) {
  if (scenes.length === 0) throw new Error('a screenwriter needs at least one beat');
  const items = scenes.map((s) => sceneSchemaFor(s));
  return z
    .object({
      language: z.string().min(2).max(35),
      scenes: z.tuple(items as [ZodTypeAny, ...ZodTypeAny[]]),
    })
    .strip();
}
export type SpokenScene = SceneContent & { narration: string };
export type DirectorOutput = { language: string; scenes: SpokenScene[] };

/** Words a scene of this weight gets to say: about five seconds of speech per unit of weight. */
/**
 * Roughly how fast a voice reads, in words a second. Used only to turn a length somebody asked for
 * into a number of words to write; the film's real clock is still measured off the audio that comes
 * back (CORE_CONTRACTS §5.4). Around 2.6 holds for both English and Vietnamese at normal speed.
 */
export const WORDS_PER_SECOND = 2.6;

/**
 * How many words a scene says. By weight, as it always was — but a form may ask for a different
 * shape of scene, and a film may have a length to hit.
 *
 * The length is the reason this has options at all: a scene's duration comes from how long its
 * narration takes to read, so "make it twenty seconds" is not a note anybody downstream can act on.
 * Written as a word count, the model can act on it — and a form of four-word phrases can stop
 * inheriting a budget meant for a paragraph, which is what kept kinetic type at seven seconds a scene.
 */
export const wordBudget = (weight: number, o: { words?: { min: number; max: number }; totalSeconds?: number; weightSum?: number } = {}): { min: number; max: number } => {
  if (o.words) return { min: Math.max(1, Math.round(o.words.min * weight)), max: Math.max(2, Math.round(o.words.max * weight)) };
  if (o.totalSeconds && o.weightSum) {
    const share = (o.totalSeconds * WORDS_PER_SECOND * weight) / o.weightSum;
    return { min: Math.max(2, Math.round(share * 0.85)), max: Math.max(4, Math.round(share * 1.15)) };
  }
  return { min: Math.max(6, Math.round(13 * weight)), max: Math.max(10, Math.round(17 * weight)) };
};

/** Fact keys the beats read; they go to the assembler, never into the prompt. */
export function boundFactKeys(beats: Beat[]): Set<string> {
  const keys = new Set<string>();
  for (const b of beats) for (const factKey of Object.values(b.factBindings)) if (factKey) keys.add(factKey);
  return keys;
}

/** Two packets with their own hashes. Role, weight and bindings come from the beats; narration and content from the model. */
export function toPackets(out: DirectorOutput, scenes: ExpandedBeat[]): { scenes: SceneScript; script: AudioScript } {
  const language = out.language.toLowerCase();
  const spoken = scenes.map((_, i) => out.scenes[i] ?? { narration: '' });
  const narrations = spoken.map((s) => s.narration.trim());
  return {
    script: { text: narrations.join('\n'), language, segments: narrations },
    scenes: {
      language,
      scenes: scenes.map((s, i) => {
        const { narration, ...content } = spoken[i]!;
        return {
          role: s.role,
          weight: s.weight,
          narration: narration.trim(),
          content,
          ...(Object.keys(s.factBindings).length ? { factBindings: s.factBindings } : {}),
        };
      }),
    },
  };
}
