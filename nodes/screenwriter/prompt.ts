import { languageName } from '@/contracts/text/languages';
import type { FactSheet } from '@/contracts/types/payloads';
import { CONTENT_GUIDE } from '@/contracts/content-guide';
import { wordBudget, type ExpandedBeat } from '@/nodes/screenwriter/beats';

/**
 * The prompt a screenwriter sends. The user's brief carries the intent; the beats carry the structure;
 * the content vocabulary carries the shape; the facts carry what is true. Nothing here is about a
 * drawing instructions or any particular kind of video: the Illustrator comes after the script.
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
export interface PromptInput {
  brief: string;
  /** What the video is about, when it arrived on the Source port rather than in the brief. */
  subject?: string;
  facts?: FactSheet;
  excludeFacts: Set<string>;
  scenes: ExpandedBeat[];
  language: string;
  strict: boolean;
  /** What kind of film this is (§6): how it should be written, which keys it is made of, how long a scene speaks. */
  form?: { guidance: string; keys?: readonly string[]; words?: { min: number; max: number } };
  /** The length the whole narration should take, when somebody asked for one. */
  targetSeconds?: number;
  /**
   * The layouts this film can be drawn in, when a plate catalogue reached this node (docs §5.23).
   *
   * Cutdown's rule, worth copying whole: the prompt prints only the layouts the running film really
   * has. What the model sees is what it writes, so offering a shape nobody drew is inviting a scene
   * nothing can draw — and a scene like that stops the film at the scene builder, after the
   * expensive half of the run has already been paid for.
   */
  shapes?: { keys: readonly string[]; budget?: Record<string, number> }[];
}

/** One layout as the model reads it: the keys it must write, and how long each may be. */
const shapeLine = (shape: { keys: readonly string[]; budget?: Record<string, number> }, i: number): string =>
  `  ${String.fromCharCode(65 + i)}. ${shape.keys.map((k) => `${k}${shape.budget?.[k] ? ` (≤${shape.budget[k]} chars)` : ''}`).join(', ')}`;

export function buildScreenwriterPrompt(p: PromptInput): string {
  const lang = languageName(p.language);
  const n = p.scenes.length;
  const facts = factsForPrompt(p.facts, p.excludeFacts);
  const boundKeys = [...new Set(p.scenes.flatMap((s) => Object.keys(s.factBindings)))];

  // The form's shape of scene wins; then a length asked for, shared out by weight; then the old way.
  const weightSum = p.scenes.reduce((n, s) => n + s.weight, 0);
  const budget = { ...(p.form?.words ? { words: p.form.words } : {}), ...(p.targetSeconds ? { totalSeconds: p.targetSeconds, weightSum } : {}) };
  const sceneLines = p.scenes.flatMap((s, i) => {
    const bound = Object.keys(s.factBindings);
    const words = wordBudget(s.weight, budget);
    const head = `  ${i + 1}. ${s.role}${s.brief.trim() ? ` — ${s.brief.trim()}` : ''} (say ${words.min}–${words.max} words${bound.length ? `; do not write: ${bound.join(', ')}` : ''})`;
    // A scene taken from a list is about one thing: the model needs that thing to narrate it, even
    // though the words on screen come from the same data without passing through the model.
    if (!s.item) return [head];
    const fields = Object.entries(s.item)
      .filter(([, v]) => v !== null && v !== '' && !/^\/api\/assets\//.test(String(v)))
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
    ...(p.form ? [`This film's form — how it has to be written:`, p.form.guidance.trim(), ``] : []),
    ...(p.targetSeconds ? [`The whole film should take about ${p.targetSeconds} seconds to read aloud, which is what the word counts below add up to. Stay inside them: they are the film's length.`, ``] : []),
    `Each scene is a JSON object. "narration" is what the voice says over that scene — spoken language, one thought, the word count given per scene; it must not repeat the on-screen text word for word. The other keys are what is on screen; write what the scene needs and leave the rest out:`,
    ...Object.entries(CONTENT_GUIDE)
      // A form is made of some of the vocabulary, not all of it: offering the rest invites a scene
      // of paragraphs into a film that has nowhere to put one. A catalogue narrows it further, to
      // the keys some layout in it actually draws.
      .filter(([k]) => !p.form?.keys?.length || p.form.keys.includes(k))
      .filter(([k]) => !p.shapes?.length || p.shapes.some((s) => s.keys.includes(k)))
      .map(([k, v]) => `- ${k}: ${v}`),
    ``,
    ...(p.shapes?.length
      ? [
          `This film is drawn from a fixed set of layouts. Every scene must use EXACTLY ONE of them: write every key that layout lists and no other key at all. Choose the layout that fits what the scene has to say — a figure belongs in a layout with a number, three parallel points in one with points.`,
          ...p.shapes.map(shapeLine),
          `A scene whose keys match none of these cannot be drawn and the film stops there.`,
          ``,
        ]
      : []),
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
