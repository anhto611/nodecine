import { z } from 'zod';
import { labelOf, type BlockInfo, type ComponentInfo } from '@/contracts/storyboard/blocks';
import type { StoryboardFrame } from '@/contracts/types/storyboard';

/**
 * What to ask a model that is dressing a film it did not write.
 *
 * The scenes are settled before this runs: the recording was cut where the speech stops, and those
 * cuts are not up for discussion. What is open is what each scene *shows* — the person filling the
 * frame, or moved into a corner with a picture of what they are talking about beside them — and the
 * few words that go on screen. So the prompt hands over the scenes as given and asks only for that.
 */

export const CoverageAnswerSchema = z.object({
  language: z.string().min(2).max(35),
  scenes: z.array(z.object({
    number: z.number().int().positive(),
    block: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
    why: z.string().max(200).optional(),
    values: z.record(z.string(), z.unknown()).default({}),
    /** One thing thrown over the scene, on the word it belongs to. */
    mount: z.object({
      component: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
      box: z.string().min(1).max(40),
      at: z.union([z.string().min(1).max(60), z.number().nonnegative()]),
      values: z.record(z.string(), z.unknown()).default({}),
    }).optional(),
  })).min(1).max(60),
});
export type CoverageAnswer = z.infer<typeof CoverageAnswerSchema>;

export interface CoverageMaterial {
  frames: StoryboardFrame[];
  catalog: BlockInfo[];
  /** The pieces that can be thrown over a scene, and the named boxes they can go in. */
  components: ComponentInfo[];
  slots: string[];
  /** Pictures the film may show, as the composition will name them. */
  pictures: { path: string; name: string; note?: string }[];
  /** What the film is cut from, for the model to picture it. */
  subject: string;
  /** Whether the model can look at the pictures rather than read their names. */
  seen: boolean;
}

const variableLine = (v: BlockInfo['variables'][number]): string =>
  `    - ${v.id} (${v.type}${v.required ? ', required' : ''}): ${labelOf(v, 'en')}${
    Array.isArray((v as { options?: { value: string }[] }).options) && (v as { options?: { value: string }[] }).options!.length
      ? ` — one of ${(v as { options?: { value: string }[] }).options!.map((o) => o.value).join(', ')}`
      : ''}`;

export function buildCoveragePrompt(m: CoverageMaterial, language: string, strict: boolean): string {
  const blocks = m.catalog.map((b) => [
    `  - ${b.name} [${b.role}]: ${b.description}`,
    ...b.variables.filter((v) => v.id !== 'seconds' && v.id !== 'from').map(variableLine),
  ].join('\n')).join('\n');

  const pictures = m.pictures.length
    ? m.pictures.map((p) => `  - ${p.path}${p.note ? ` — ${p.note}` : ''}`).join('\n')
    : '  (none: every scene must use a block that needs no picture)';

  const scenes = m.frames.map((f) => `  ${f.number}. "${(f.voiceover ?? '').replace(/\s+/g, ' ').trim()}"`).join('\n');

  const pieces = m.components.length
    ? m.components.map((c) => [
      `  - ${c.name}: ${c.description}`,
      ...c.variables.filter((v) => v.id !== 'seconds').map(variableLine),
    ].join('\n')).join('\n')
    : '  (none)';

  return `You are cutting the pictures for a film somebody has already recorded and already cut into scenes.

The film is one person talking to camera about: ${m.subject}
What they say, scene by scene, in order:
${scenes}

The blocks this workflow can play, and the values each takes:
${blocks}

The pictures this film may show, named exactly as you must write them:
${pictures}

Decide, for each scene and no other scene, which block shows it and with which values.

- The recording is the film. Most scenes are the person talking and nothing else; reach for a block
  that shows something only when they are naming a thing a picture would settle faster than words.
- Never invent a picture path. Use one from the list, exactly as written, at most once in the film
  unless there are fewer pictures than the scenes that need one.
- Words on screen are not the sentence being said: three to six words, the point of that scene, in
  ${language}. Leave them out rather than repeat the captions, which already show every word.
- Do not write \`from\` or \`seconds\`: the cut and the clock are already settled.
- Keep the film's own rhythm: at most one scene in three shows a picture, and never two in a row.
${strict ? `\nWrite every word on screen in ${language}. Answer in ${language}.` : ''}

You may also throw one thing over a scene, on the word it belongs to:
${pieces}
Boxes it can go in: ${m.slots.join(', ') || '(none)'}
- \`at\` is a word from that scene's own narration, written as \`"@word"\`, or seconds from the scene's start.
- At most one per scene, and in no more than a quarter of the scenes. A film where something is always
  being thrown at the viewer is a film nobody finishes.

Answer as JSON: { "language": "<the language of the words on screen>", "scenes": [ { "number": 1, "block": "<name>", "why": "<a few words>", "values": { }, "mount": { "component": "<name>", "box": "<slot>", "at": "@word", "values": { } } } ] }`;
}
