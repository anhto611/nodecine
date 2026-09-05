import { z, type ZodTypeAny } from 'zod';
import { languageName } from '../text/languages';
import type { FactSheet } from '../types/payloads';
import { modelSchemaFor, type ExpandedScene } from './slots';

/**
 * The prompt a director sends. The user's brief carries the intent; the scene schemas carry the
 * shape; the facts carry what is true. Nothing here is about any particular kind of video.
 */

/** A one-line hint for one field, read off its Zod definition, so the shape in the prompt is honest. */
export function describeField(schema: ZodTypeAny): string {
  const def = schema._def as { typeName?: string; innerType?: ZodTypeAny; checks?: { kind: string; value?: unknown; regex?: RegExp }[]; type?: ZodTypeAny; values?: string[]; minLength?: { value: number } | null; maxLength?: { value: number } | null; exactLength?: { value: number } | null };
  switch (def.typeName) {
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
      return describeField(def.innerType!);
    case 'ZodString': {
      const checks = def.checks ?? [];
      // Zod keeps a regex check under `regex`, not `value`.
      if (checks.some((c) => c.kind === 'regex' && String(c.regex).includes('[0-9a-fA-F]{6}'))) return '#rrggbb';
      const min = checks.find((c) => c.kind === 'min')?.value as number | undefined;
      const max = checks.find((c) => c.kind === 'max')?.value as number | undefined;
      if (max !== undefined) return `text, ${min && min > 1 ? `${min}–` : 'up to '}${max} characters`;
      return 'text';
    }
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'true or false';
    case 'ZodEnum':
      return `one of: ${(def.values ?? []).join(', ')}`;
    case 'ZodArray': {
      const item = describeField(def.type!);
      const exact = def.exactLength?.value;
      const min = def.minLength?.value;
      const max = def.maxLength?.value;
      const count = exact !== undefined ? `exactly ${exact}` : min !== undefined && max !== undefined ? `${min} to ${max}` : min !== undefined ? `at least ${min}` : max !== undefined ? `up to ${max}` : 'any number of';
      return `[${count} × ${item}]`;
    }
    case 'ZodObject':
      return describeObject(schema as z.ZodObject<z.ZodRawShape>);
    default:
      return 'value';
  }
}

export function describeObject(schema: z.ZodObject<z.ZodRawShape>): string {
  const parts = Object.entries(schema.shape).map(([k, v]) => `"${k}": "${describeField(v as ZodTypeAny)}"`);
  return `{ ${parts.join(', ')} }`;
}

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

export interface PromptInput {
  brief: string;
  /** What the video is about, when it arrived on the Source port rather than in the brief. */
  subject?: string;
  facts?: FactSheet;
  excludeFacts: Set<string>;
  scenes: ExpandedScene[];
  language: string;
  strict: boolean;
}

export function buildDirectorPrompt(p: PromptInput): string {
  const lang = languageName(p.language);
  const n = p.scenes.length;
  const facts = factsForPrompt(p.facts, p.excludeFacts);
  const boundFields = [...new Set(p.scenes.flatMap((s) => Object.keys(s.factBindings)))];
  const shape = p.scenes.map((s, i) => `    ${describeField(modelSchemaFor(s))}${i < n - 1 ? ',' : ''}  // scene ${i + 1}: ${s.sceneType}`);

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
    `Return ONLY a JSON object, no prose, no markdown fence, with exactly this shape:`,
    `{`,
    `  "language": "${p.language}",`,
    `  "audioScript": "voice-over narration read over the whole video, ${n * 10} to ${n * 14} words, no URLs, no numbers you were not given",`,
    `  "scenes": [`,
    ...shape,
    `  ]`,
    `}`,
    `Rules: exactly ${n} scenes in that order; do not invent facts, numbers, names or links that are not in the brief or the facts` +
      (boundFields.length ? `; the fields ${boundFields.map((f) => `"${f}"`).join(', ')} are filled in later from verified data, so do not write them` : '') +
      `.`,
  ].join('\n');
}
