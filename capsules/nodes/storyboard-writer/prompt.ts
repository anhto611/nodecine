import type { BlockInfo, ComponentInfo } from '@/contracts/storyboard/blocks';
import type { Brief } from '@/contracts/types/brief';
import type { Research } from '@/contracts/types/research';
import type { WrittenFrame, WrittenStoryboard } from './output';

/**
 * The prompts the Storyboard Writer sends. The instructions are English, where models follow them
 * most closely; the narration and on-screen words are written in the language the person chose.
 */

/** What the person asked for, and what was found out about it when Research ran. */
export interface Request {
  brief: Brief;
  research?: Research;
}

export interface Picture { path: string; name: string; note: string; width?: number; height?: number }

export interface WriterMaterial {
  request: Request;
  catalog: BlockInfo[];
  /** Components a scene may mount over its block, and the named slots they go in. */
  components: ComponentInfo[];
  slots: Record<string, [number, number, number, number]>;
  guide: string;
  pictures: Picture[];
  /** Whether the pictures are attached for the model to see, in the order listed. */
  seen: boolean;
  /** The roles the first and last scene must play, from the guide's header. */
  first?: string;
  last?: string;
  /** How many scenes in a row may play the same block, from the guide's header. */
  repeat?: number;
  wordsPerSecond: number;
}

const LANGUAGE_NAMES: Record<string, string> = { vi: 'Vietnamese', en: 'English' };
const TONES: Record<string, string> = { energetic: 'energetic and upbeat', trustworthy: 'calm and trustworthy', playful: 'playful and witty', expert: 'precise, like an expert explaining' };

function describeBlocks(catalog: BlockInfo[]): string {
  return catalog.map((block) => {
    const vars = block.variables.filter((v) => v.id !== 'seconds').map((v) => {
      const extra = [
        v.type === 'string' && v.maxLength ? `at most ${v.maxLength} characters` : '',
        v.type === 'enum' ? `one of ${v.options.map((o) => `"${o.value}" (${o.label})`).join(', ')}` : '',
        v.default !== undefined && v.default !== '' ? `default ${JSON.stringify(v.default)}` : '',
      ].filter(Boolean).join('; ');
      return `    - ${v.id} (${v.type}${v.required ? ', required' : ''}): ${v.label}${extra ? ` — ${extra}` : ''}`;
    }).join('\n');
    return `- ${block.name} [role: ${block.role}]\n  ${block.description || '(no description)'}\n  values:\n${vars || '    (none)'}`;
  }).join('\n');
}

function describeComponents(m: WriterMaterial): string {
  if (!m.components.length) return '';
  const vars = (c: ComponentInfo) => c.variables.filter((v) => v.id !== 'seconds').map((v) => {
    const extra = [
      v.type === 'string' && v.maxLength ? `at most ${v.maxLength} characters` : '',
      v.type === 'enum' ? `one of ${v.options.map((o) => `"${o.value}"`).join(', ')}` : '',
    ].filter(Boolean).join('; ');
    return `    - ${v.id} (${v.type}${v.required ? ', required' : ''}): ${v.label}${extra ? ` — ${extra}` : ''}`;
  }).join('\n');
  return `\nThe components a scene may mount over its block (in "mounts"):
${m.components.map((c) => `- ${c.name} [role: ${c.role}]\n  ${c.description || '(no description)'}\n  values:\n${vars(c) || '    (none)'}`).join('\n')}

The slots a component goes in (name: left, top, width, height in pixels of the frame):
${Object.entries(m.slots).map(([name, r]) => `- ${name}: ${r.join(', ')}`).join('\n') || '(none)'}
`;
}

function describePictures(pictures: Picture[], seen: boolean): string {
  if (!pictures.length) return 'There are no pictures: use no image values.';
  return [
    seen ? 'The pictures are attached in this order; look at each before using it.' : 'The pictures are not attached; rely on their notes.',
    ...pictures.map((p, i) => `${i + 1}. ${p.path}${p.width ? ` (${p.width}×${p.height})` : ''}: ${p.note || '(no note)'}`),
  ].join('\n');
}

function describeRequest(r: Request): string {
  const { brief, research } = r;
  return [
    `What the person wrote about it:\n${brief.about.trim()}`,
    research ? [
      `What was found out about it${research.subject ? ` (${research.subject})` : ''}:`,
      research.summary,
      ...research.points.map((p) => `- ${p.text}${p.source ? ` [${p.source}]` : ''}`),
    ].filter(Boolean).join('\n') : '',
    `Length: ${brief.durationSeconds} seconds`,
    `Tone: ${TONES[brief.tone] ?? brief.tone}`,
    brief.notes.trim() ? `Must say / must not say: ${brief.notes.trim()}` : '',
  ].filter(Boolean).join('\n\n');
}

const UNDERSTAND = `First work out, from what the person wrote, what was found out and the pictures, what the film is about and what it should say, the way this workflow's guide asks. What the person wrote is the brief: follow it over the findings when they differ. Say only facts the brief or the findings give; never invent a number or a claim.`;

const OUTPUT_SHAPE = `{
  "language": "<the narration language code>",
  "subject": "<what the film is about, in a few words: the product, the event or the topic, as it is named>",
  "message": "<what the film says about it, in one sentence, in the narration language>",
  "frames": [
    {
      "title": "<a short scene name>",
      "voiceover": "<what is said over this scene>" or null for a silent scene,
      "duration_seconds": null, or seconds for a silent scene,
      "transition_in": "cut" | "crossfade" | "blur-crossfade",
      "block": "<a block name from the list>",
      "values": { "<variable id>": <value>, ... },
      "mounts": [ { "component": "<a component from the list>", "slot": "<a slot name>", "at": "@word" or null, "until": "@word" or null, "values": { ... } } ]
    }
  ],
  "layers": [
    {
      "title": "<a short name>",
      "block": "<an overlay block from the list>",
      "from_frame": <the first scene it runs over, counting from 1>,
      "to_frame": <the last scene it runs over>,
      "start": "@word" said in the first scene, or null for that scene's start,
      "end": "@word" said in the last scene, or null for that scene's end,
      "values": { "<variable id>": <value>, ... }
    }
  ]
}`;

function rules(m: WriterMaterial): string {
  const language = LANGUAGE_NAMES[m.request.brief.language] ?? m.request.brief.language;
  const words = Math.round(m.request.brief.durationSeconds * m.wordsPerSecond);
  return `Rules:
- Write the narration and every on-screen word in ${language}, unless a value's label asks for something else.
- The whole narration runs about ${words} words (${m.request.brief.durationSeconds} s at ${m.wordsPerSecond} words a second), counting silent scenes' seconds as time too.
- One idea per scene.${m.first ? ` The first scene plays a ${m.first} block.` : ''}${m.last ? ` The last scene plays a ${m.last} block.` : ''}${m.repeat ? ` Never more than ${m.repeat} scenes in a row on the same block.` : ''}
- Every scene plays exactly one block from the list, gives every value marked required, and gives only the values that block declares. Never give "seconds".
- "mounts" puts components over a scene's block, each in a slot, appearing on "at" and leaving on "until" (words said in that scene; null for the scene's start or end). Use them as the guide says, where they add to the scene and do not cover what it shows; [] when none.
- A block whose role is overlay never plays a scene: it goes in "layers", over a run of scenes, on top of their blocks, as the workflow's guide says. With no overlay blocks, or when the guide asks for none, "layers" is []. Two layers over the same scenes need the guide's leave.
- Keep every text value within its character limit, and every enum value to its listed options.
- A value that is a moment is "@word": a word (or the first words) said in that same scene's voiceover, where the thing should happen. A list of moments is "@a,@b,@c". Never write seconds for a moment.
- A picture value is one of the listed picture paths, exactly as written. Pick the picture that shows what the scene says; use each picture at most once unless there are too few.
- When the workflow guide gives a JSON list value (such as effects), write it as a JSON array, not as a string, and place every box in percent of that picture: [left, top, width, height] from its top-left corner.
- Answer with the JSON object only: no commentary, no code fence.`;
}

export function writePrompt(m: WriterMaterial, variation: number): string {
  return `You write storyboards for short portrait videos, choosing among a fixed set of scene blocks and filling their values.

${describeRequest(m.request)}

The pictures:
${describePictures(m.pictures, m.seen)}

The blocks:
${describeBlocks(m.catalog)}
${describeComponents(m)}${m.guide.trim() ? `\nHow this workflow's films are built:\n${m.guide.trim()}\n` : ''}
${UNDERSTAND}

${rules(m)}
${variation > 0 ? `\nThis is attempt ${variation + 1}: take a different angle on the story than an obvious first draft would.\n` : ''}
Answer in this shape:
${OUTPUT_SHAPE}`;
}

export function repairPrompt(m: WriterMaterial, written: WrittenStoryboard, problems: string[]): string {
  return `You wrote this storyboard for the request below, and it breaks some rules.

${describeRequest(m.request)}

The pictures:
${describePictures(m.pictures, m.seen)}

The blocks:
${describeBlocks(m.catalog)}
${describeComponents(m)}${m.guide.trim() ? `\nHow this workflow's films are built:\n${m.guide.trim()}\n` : ''}
${rules(m)}

Your storyboard:
${JSON.stringify(written, null, 2)}

What is wrong with it:
${problems.map((p) => `- ${p}`).join('\n')}

Return the whole storyboard again with these problems fixed. Change only what fixing them needs; keep everything else as it is.`;
}

export function rewriteFramePrompt(m: WriterMaterial, written: WrittenStoryboard, index: number, variation: number): string {
  return `Here is a storyboard for the request below. Rewrite scene ${index + 1} only ("${written.frames[index]?.title ?? ''}"): say its idea differently${variation > 1 ? ` (take ${variation})` : ''}, keeping it in the same place in the story and about as long.

${describeRequest(m.request)}

The pictures:
${describePictures(m.pictures, m.seen)}

The blocks:
${describeBlocks(m.catalog)}
${describeComponents(m)}${m.guide.trim() ? `\nHow this workflow's films are built:\n${m.guide.trim()}\n` : ''}
${rules(m)}

The storyboard:
${JSON.stringify(written, null, 2)}

Answer with that one scene as a JSON object in the frames' shape: { "title", "voiceover", "duration_seconds", "transition_in", "block", "values" }.`;
}

export type { WrittenFrame };
