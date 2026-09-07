import { languageName } from '@/core/text/languages';
import type { FactSheet, WrittenKey } from '@/core/types/payloads';
import { wordBudget, type ExpandedBeat } from '@/nodes/screenwriter/beats';

/**
 * The prompt a screenwriter sends. The user's brief carries the intent; the beats carry the structure;
 * the content vocabulary carries the shape; the facts carry what is true. Nothing here is about a
 * block, a stage or any particular kind of video: the look comes after the script.
 */

const str = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v));

/** Facts the model may see: everything except what is bound straight into a scene by the assembler. */
export function factsForPrompt(sheet: FactSheet | undefined, exclude: Set<string>, maxChars = 4000): string[] {
  if (!sheet) return [];
  const lines: string[] = [];
  let budget = maxChars;
  for (const [k, v] of Object.entries(sheet.facts)) {
    if (exclude.has(k)) continue;
    const text = str(v).trim();
    if (!text) continue;
    const line = `- ${k}: ${text.length > budget ? `${text.slice(0, Math.max(0, budget))}…` : text}`;
    budget -= line.length;
    lines.push(line);
    if (budget <= 0) break;
  }
  return lines;
}

/** The content vocabulary as the model sees it: one line per key, what it is and how long. */
export const CONTENT_GUIDE: Record<WrittenKey, string> = {
  kicker: 'one to three words above the content: a section name, a category',
  title: 'the headline, at most 60 characters; every scene has one; wrap the one phrase that matters most in *asterisks* (at most one per title, never the whole title)',
  body: 'one or two plain sentences, at most 200 characters',
  points: 'two to four short lines, as a JSON array of strings',
  number: 'one figure exactly as it should be shown ("4,321", "3×", "98%")',
  label: 'what the number is, two to five words',
  quote: 'a quotation, verbatim',
  attribution: 'who said the quote',
  code: 'one command or one line of code',
  source: 'where the content comes from: a site, a handle, a name',
};

export interface PromptInput {
  brief: string;
  /** What the video is about, when it arrived on the Source port rather than in the brief. */
  subject?: string;
  facts?: FactSheet;
  excludeFacts: Set<string>;
  scenes: ExpandedBeat[];
  language: string;
  strict: boolean;
}

export function buildScreenwriterPrompt(p: PromptInput): string {
  const lang = languageName(p.language);
  const n = p.scenes.length;
  const facts = factsForPrompt(p.facts, p.excludeFacts);
  const boundKeys = [...new Set(p.scenes.flatMap((s) => Object.keys(s.factBindings)))];

  const sceneLines = p.scenes.flatMap((s, i) => {
    const bound = Object.keys(s.factBindings);
    const words = wordBudget(s.weight);
    const head = `  ${i + 1}. ${s.role}${s.brief.trim() ? ` — ${s.brief.trim()}` : ''} (say ${words.min}–${words.max} words${bound.length ? `; do not write: ${bound.join(', ')}` : ''})`;
    // A scene taken from a list is about one thing: the model needs that thing to narrate it, even
    // though the words on screen come from the same data without passing through the model.
    if (!s.item) return [head];
    const fields = Object.entries(s.item)
      .filter(([k, v]) => v !== null && v !== '' && !/^\/api\/assets\//.test(String(v)))
      .map(([k, v]) => `${k}: ${String(v).slice(0, 400)}`);
    return [head, ...fields.map((f) => `     ${f}`)];
  });

  return [
    `You are the screenwriter of a short video with ${n} scene${n === 1 ? '' : 's'}.`,
    `Write ALL text in ${lang} (language code "${p.language}").` +
      (p.strict ? ` This is mandatory: every field must be ${lang}; do not use any other language.` : ''),
    ``,
    ...(p.subject ? [`Subject: ${p.subject}`, ``] : []),
    `Brief from the user:`,
    `"""`,
    p.brief.trim(),
    `"""`,
    ...(facts.length ? [``, `Facts about the subject — use them, do not change them:`, ...facts] : []),
    ``,
    `Each scene is a JSON object. "narration" is what the voice says over that scene — spoken language, one thought, the word count given per scene; it must not repeat the on-screen text word for word. The other keys are what is on screen; write what the scene needs and leave the rest out:`,
    ...Object.entries(CONTENT_GUIDE).map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `Scenes, in order:`,
    ...sceneLines,
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence, with exactly this shape:`,
    `{`,
    `  "language": "${p.language}",`,
    `  "scenes": [`,
    `    { "narration": "what the voice says over scene 1", "title": "…", "body": "…" }${n > 1 ? ',' : ''}`,
    ...(n > 1 ? [`    … one object per scene, ${n} in total`] : []),
    `  ]`,
    `}`,
    `Rules: exactly ${n} scenes in that order; a scene given facts is about those facts and nothing else, and its narration must not contradict them; the narrations read in sequence as one voice-over, so no greeting twice and no URLs; when a scene has points, its narration goes through them in the same order, naming each; do not invent facts, numbers, names or links that are not in the brief or the facts` +
      (boundKeys.length ? `; the keys ${boundKeys.map((f) => `"${f}"`).join(', ')} are filled in later from verified data, so do not write them` : '') +
      `.`,
  ].join('\n');
}
