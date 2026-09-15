import { formatVariableValidationIssue, parseCompositionVariables, validateVariables, type CompositionVariable } from '@hyperframes/core/variables';

/**
 * A workflow's blocks, read from its composition the way HyperFrames reads them: the scenes a
 * storyboard can play, what each is for, and the values each takes. The Storyboard Writer offers
 * them to a model, the Assemble node plays them, and both hold a frame's values to the same rules.
 */

/** What a block is for in a film. */
export const BLOCK_ROLES = ['scene', 'hook', 'feature', 'proof', 'outro'] as const;
export type BlockRole = (typeof BLOCK_ROLES)[number];

/** A block lives at the top of `compositions/`; components and frames live below it. */
export const blockPath = (name: string) => `compositions/${name}.html`;
const BLOCK_FILE = /^compositions\/([a-z][a-z0-9-]{1,40})\.html$/;

/** A block's variable as NodeCine reads it: HyperFrames' declaration, plus two keys it keeps and ignores. */
export type BlockVariable = CompositionVariable & {
  /** The scene is incomplete without it: a writer must give it. */
  required?: boolean;
  /** The label in other languages, by language code; `label` is the English one. */
  labels?: Record<string, string>;
};

/** A variable's label in a locale, falling back to its own. */
export const labelOf = (v: BlockVariable, locale: string): string => v.labels?.[locale] ?? v.labels?.[locale.split('-')[0]!] ?? v.label;

export interface BlockInfo {
  name: string;
  role: BlockRole;
  /** What the block shows, from its `<meta name="description">`: written for whoever picks it. */
  description: string;
  variables: BlockVariable[];
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(tag)?.[2];
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** What a block's `<html>` declares, parsed by HyperFrames: a declaration it would drop is dropped here too. */
export function declaredVariables(html: string): BlockVariable[] {
  const raw = /<html\b[^>]*\bdata-composition-variables\s*=\s*(['"])([\s\S]*?)\1/i.exec(html)?.[2] ?? null;
  const decoded = raw === null ? null : unescape(raw);
  return parseCompositionVariables({ getAttribute: (name: string) => (name === 'data-composition-variables' ? decoded : null) } as unknown as Element);
}

/** One block's entry: its role from `<html data-role>`, its description from `<meta name="description">`. */
export function readBlock(name: string, html: string): BlockInfo {
  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? '';
  const role = attr(htmlTag, 'data-role');
  const meta = /<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/i.exec(html)?.[0] ?? '';
  return {
    name,
    role: (BLOCK_ROLES as readonly string[]).includes(role ?? '') ? role as BlockRole : 'scene',
    description: unescape(attr(meta, 'content') ?? '').trim(),
    variables: declaredVariables(html),
  };
}

/** Every block a composition holds, by name. */
export function readBlockCatalog(files: Record<string, string>): BlockInfo[] {
  return Object.entries(files)
    .map(([path, html]) => [BLOCK_FILE.exec(path)?.[1], html] as const)
    .filter((entry): entry is readonly [string, string] => !!entry[0])
    .map(([name, html]) => readBlock(name, html))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A frame's values as the block will be given them, and what is wrong with them. HyperFrames'
 * variables hold no lists or objects, so a string variable given one (a list of effects) carries it
 * as JSON, and a string variable given a number (a cue list of one cue) carries it as text.
 */
export function checkBlockValues(label: string, values: Record<string, unknown>, declared: BlockVariable[]): { values: Record<string, unknown>; problems: string[] } {
  const out = { ...values };
  for (const v of declared) {
    if (v.type !== 'string') continue;
    if (out[v.id] !== null && typeof out[v.id] === 'object') out[v.id] = JSON.stringify(out[v.id]);
    else if (typeof out[v.id] === 'number') out[v.id] = String(out[v.id]);
  }
  const problems = validateVariables(out, declared).map((issue) => `${label}: ${formatVariableValidationIssue(issue)}`);
  for (const v of declared) {
    const value = out[v.id];
    if (v.required && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) problems.push(`${label}: ${v.id} is required (${v.label})`);
  }
  for (const v of declared) {
    const value = out[v.id];
    if (v.type === 'string' && v.maxLength && typeof value === 'string' && value.length > v.maxLength) problems.push(`${label}: ${v.id} is ${value.length} characters, the block allows ${v.maxLength}`);
  }
  return { values: out, problems };
}
