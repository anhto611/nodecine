import { z, type ZodTypeAny } from 'zod';
import { languageName } from '@/core/text/languages';
import { EntryContentSchema, SceneContentSchema, WRITTEN_KEYS, type SceneContent, type SceneScript } from '@/core/types/payloads';
import { CONTENT_GUIDE } from '@/core/content-guide';

/**
 * The prompt a scene breakdown sends (CORE_CONTRACTS §5.20). The narration is finished and is not
 * the model's to touch, so it is never asked for: the model returns only what is on screen, one
 * object per scene, and the node copies the narration through from the input. The vocabulary and
 * its guide are the screenwriter's, so the two nodes cannot drift apart on what a `title` is.
 */

export const DENSITIES = ['auto', 'sparse', 'rich'] as const;
export type Density = (typeof DENSITIES)[number];

/** What the model writes for one scene: the vocabulary minus the files, which only a person can point at. */
const WrittenEntrySchema = EntryContentSchema.omit({ image: true, clip: true });
export const WrittenSceneSchema = SceneContentSchema.omit({ image: true, clip: true }).extend({ entries: z.array(WrittenEntrySchema).max(12).optional() });
export type WrittenScene = z.infer<typeof WrittenSceneSchema>;

/** Exactly one object per scene, in order: a short answer shifts every later scene onto the wrong words. */
export function outputSchemaFor(count: number) {
  if (count < 1) throw new Error('a breakdown needs at least one scene');
  const items: ZodTypeAny[] = Array.from({ length: count }, () => WrittenSceneSchema);
  return z.object({ language: z.string().min(2).max(35), scenes: z.tuple(items as [ZodTypeAny, ...ZodTypeAny[]]) }).strip();
}
export type BreakdownOutput = { language: string; scenes: WrittenScene[] };

/** Whether a scene already says something on screen: any written key carrying a value. Files do not count; they are not words. */
export function hasWritten(content: SceneContent): boolean {
  return WRITTEN_KEYS.some((k) => {
    const v = content[k];
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  });
}

const DENSITY_RULE: Record<Density, string> = {
  auto: 'Let the narration decide how much is on screen: a lone thought gets a title, a list gets points, things side by side get entries, a figure gets number and label.',
  sparse: 'Keep it spare: a title on every scene and at most one other key; no points and no entries.',
  rich: 'Show what the narration lists, compares or counts: points for a list, entries for things side by side, number and label for a figure. A scene that does none of these still gets only a title.',
};

export interface BreakdownPromptInput {
  script: SceneScript;
  /** Indexes of the scenes to write; the others are shown for context and answered with `{}`. */
  wanted: number[];
  density: Density;
  language: string;
  strict: boolean;
}

export function buildBreakdownPrompt(p: BreakdownPromptInput): string {
  const lang = languageName(p.language);
  const n = p.script.scenes.length;
  const wanted = new Set(p.wanted);
  const keeps = n - wanted.size;
  return [
    `You break a finished script down into scenes for a short video with ${n} scene${n === 1 ? '' : 's'}.`,
    `The narration is written and final. For each scene you decide what is on screen while its narration is spoken.`,
    `Write ALL on-screen text in ${lang} (language code "${p.language}").` +
      (p.strict ? ` This is mandatory: every field must be ${lang}; do not use any other language.` : ''),
    ``,
    `Each scene is a JSON object of what is on screen. Write what the scene needs and leave the rest out:`,
    ...Object.entries(CONTENT_GUIDE).map(([k, v]) => `- ${k}: ${v}`),
    ``,
    DENSITY_RULE[p.density],
    ``,
    `Scenes, in order. The narration is what the voice says; it is not yours to change and you do not return it:`,
    ...p.script.scenes.map((s, i) => `  ${i + 1}. [${s.role}] "${s.narration}"${wanted.has(i) ? '' : ' — already written by hand: keep, answer {}'}`),
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence, with exactly this shape:`,
    `{`,
    `  "language": "${p.language}",`,
    `  "scenes": [`,
    `    { "title": "…", "body": "…" }${n > 1 ? ',' : ''}`,
    ...(n > 1 ? [`    … one object per scene, ${n} in total`] : []),
    `  ]`,
    `}`,
    `Rules: exactly ${n} objects in that order` +
      (keeps ? `; a scene marked keep is answered with an empty object {}` : '') +
      `; the on-screen text names, condenses or shows what the narration says and must not repeat it word for word; do not invent facts, numbers, names or links that are not in the narration; the scenes read as one video, so no two titles say the same thing.`,
  ].join('\n');
}
