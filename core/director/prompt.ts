import { describeBlockField } from '../look/props';
import { languageName } from '../text/languages';
import type { BlockDef, FactSheet, StageDef } from '../types/payloads';
import type { ExpandedBeat } from './beats';

/**
 * The prompt a director sends. The user's brief carries the intent; the beats carry the structure;
 * the blocks carry the shape and say when to use themselves; the stage carries the tones and fields
 * it can draw; the facts carry what is true. Nothing here is about any particular kind of video.
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

/** One block as the model sees it: when to use it, what to write, and one worked example. */
export function describeBlock(block: BlockDef, bound: Set<string>): string[] {
  const props = Object.entries(block.props)
    .filter(([k]) => !bound.has(k))
    .map(([k, f]) => `"${k}": "${describeBlockField(f)}"`);
  return [
    `- ${block.id} — ${block.doc.when.trim()}`,
    `  props: { ${props.join(', ')} }`,
    ...(block.doc.example.trim() ? [`  example: ${block.doc.example.trim()}`] : []),
  ];
}

export interface PromptInput {
  brief: string;
  /** What the video is about, when it arrived on the Source port rather than in the brief. */
  subject?: string;
  facts?: FactSheet;
  excludeFacts: Set<string>;
  stage: StageDef;
  scenes: ExpandedBeat[];
  language: string;
  strict: boolean;
}

export function buildDirectorPrompt(p: PromptInput): string {
  const lang = languageName(p.language);
  const n = p.scenes.length;
  const facts = factsForPrompt(p.facts, p.excludeFacts);
  const boundFields = [...new Set(p.scenes.flatMap((s) => Object.keys(s.factBindings)))];
  const boundSet = new Set(boundFields);
  const tones = Object.keys(p.stage.tones);
  const fields = p.stage.sceneFields;

  // Every block any scene may use, once, in first-use order.
  const catalogue: BlockDef[] = [];
  for (const s of p.scenes) for (const b of s.allowed) if (!catalogue.includes(b)) catalogue.push(b);

  const sceneLines = p.scenes.map((s, i) => {
    const choice = s.allowed.length === 1 ? `block: ${s.allowed[0]!.id}` : `block: one of ${s.allowed.map((b) => b.id).join(' | ')}`;
    return `  ${i + 1}. ${s.role}${s.brief.trim() ? ` — ${s.brief.trim()}` : ''} (${choice})`;
  });

  return [
    `You are the director of a short vertical (9:16) video with ${n} scene${n === 1 ? '' : 's'}.`,
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
    `Blocks you may use — when to use each, and the props to write for it:`,
    ...catalogue.flatMap((b) => describeBlock(b, boundSet)),
    ``,
    `Stage "${p.stage.name}".` +
      (tones.length ? ` Per scene you may set "tone" to one of: ${tones.join(', ')} — or leave it out to keep the base look.` : ''),
    ...(fields.length ? [`Per scene, under "fields", you may write:`, ...fields.map((f) => `- ${f.name}: ${f.rule}${f.options?.length ? ` (one of: ${f.options.join(', ')})` : ''}`)] : []),
    ``,
    `Scenes, in order:`,
    ...sceneLines,
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence, with exactly this shape:`,
    `{`,
    `  "language": "${p.language}",`,
    `  "audioScript": "voice-over narration read over the whole video, ${n * 13} to ${n * 17} words (about five seconds of speech per scene), no URLs, no numbers you were not given",`,
    `  "scenes": [`,
    `    { "block": "<the block id chosen for scene 1>", ${tones.length ? '"tone": "<tone or omit>", ' : ''}${fields.length ? '"fields": { <the fields above> }, ' : ''}"props": { <the props of that block> } }${n > 1 ? ',' : ''}`,
    ...(n > 1 ? [`    … one object per scene, ${n} in total`] : []),
    `  ]`,
    `}`,
    `Rules: exactly ${n} scenes in that order; each scene's "block" must come from that scene's list; do not invent facts, numbers, names or links that are not in the brief or the facts` +
      (boundFields.length ? `; the props ${boundFields.map((f) => `"${f}"`).join(', ')} are filled in later from verified data, so do not write them` : '') +
      `.`,
  ].join('\n');
}
