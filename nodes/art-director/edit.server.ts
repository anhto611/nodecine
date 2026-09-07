import { z, type ZodTypeAny } from 'zod';
import { BlockDefSchema, BlockFieldSchema, StageDefSchema, type BlockDef, type StageDef } from '@/core/types/payloads';
import { describeBlockField } from '@/core/look/props';
import { describeSafeZones, safeZonesFor } from '@/core/look/safe-zones';
import { DEFAULT_FRAME, describeFrame } from '@/core/look/frame';
import { STAGE_ROLES } from '@/core/look/stage-elements';

/**
 * "Edit by words" for a stage or a block (CORE_CONTRACTS §2.8): the user says what should change,
 * a language model rewrites the code, the modal shows the result as a draft. The model gets the
 * same rules a person gets in the editor's cheat line, spelled out, plus the tokens and fields the
 * code may rely on. The answer is the whole source, never a patch, so nothing has to be applied.
 */

export const LookEditRequestSchema = z.object({
  kind: z.enum(['stage', 'block']),
  source: z.string().max(200_000),
  instruction: z.string().min(1).max(4_000),
  /** The stage the code belongs to (its own, or the one a block is previewed on). */
  stage: StageDefSchema.omit({ code: true }).optional(),
  block: BlockDefSchema.omit({ code: true }).optional(),
  providerId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  settings: z.record(z.string(), z.unknown()).default({}),
  /** The interface language, only so the summary comes back in it; the instruction may be in any language. */
  locale: z.string().min(2).max(35).default('en'),
  /** The workflow's frame (the assembler's size); portrait 1080×1920 when absent. */
  frame: z.object({ width: z.number().int().min(16).max(8192), height: z.number().int().min(16).max(8192) }).default(DEFAULT_FRAME),
});
export type LookEditRequest = z.infer<typeof LookEditRequestSchema>;

const IDENT = /^[a-zA-Z][a-zA-Z0-9_]*$/;
/**
 * What comes back: the code, always; and, when the instruction called for it, the other parts of
 * the definition in full — so "make it pastel" can change the palette, and "let the model pick a
 * mood" can add a scene field. Each part replaces its old value wholesale; an omitted part is kept.
 */
export const LookEditAnswerSchema = z.object({
  source: z.string().min(1),
  summary: z.string().max(600).default(''),
  tokens: z.object({ palette: z.record(z.string().regex(IDENT), z.string()), fonts: z.record(z.string().regex(IDENT), z.string()) }).optional(),
  tones: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/i), z.record(z.string(), z.string())).optional(),
  sceneFields: z.array(z.object({ name: z.string().regex(IDENT), rule: z.string().max(300), options: z.array(z.string()).optional() })).optional(),
  props: z.record(z.string().regex(IDENT), BlockFieldSchema).optional(),
  doc: z.object({ example: z.string().max(2000), when: z.string().max(1000) }).optional(),
});
export type LookEditAnswer = z.infer<typeof LookEditAnswerSchema>;

/** The rules any scene code must follow, for editing and for writing a block from nothing. */
export const codeRules = (frame: { width: number; height: number }) => [
  'Output format: a single HTML fragment made of an optional <style> block, the markup, and an optional <script> block. No <html>, <head> or <body>.',
  'Styles are scoped to this stage or block by the engine; write plain selectors, never !important.',
  'Colours and fonts come from CSS variables the stage tokens provide: var(--bg), var(--fg), var(--accent), var(--line), var(--muted), var(--font-display), var(--font-body) and any other palette key listed below. Prefer them over literal colours so tones keep working.',
  `The frame is ${describeFrame(frame)}. Safe zones: keep content inside ${describeSafeZones(safeZonesFor(frame.width, frame.height))} (the platform UI covers the rest).`,
  'Animation uses the gsap that the script receives, scoped to this scene: register with nodecine.timeline(gsap.timeline().fromTo(...)). Use fromTo only, never from (from desyncs on seek).',
  'A scene lasts as long as its narration (nodecine.duration seconds), often five to ten seconds: keep something moving for the whole length — a slow drift or zoom of a background glow — so no frame is dead; move it with transform or a CSS variable read by a transform (as the stage does with --drift), never by animating background-size or filters, which repaint every frame. Never a loop that jumps.',
  'A number that should count up: tl.add(nodecine.count("<selector of the number element>", { duration: 1.2 }), <time>) counts it from zero to the value shown, keeping its grouping.',
  'A *phrase in asterisks* inside a text prop is the emphasised phrase: the engine wraps it in <em class="nc-emph"> in the accent colour; style .nc-emph in the block if the default is not right.',
];

export const BLOCK_RULES = [
  'A block is one scene archetype. Every prop listed below is filled by the engine into an element with data-prop="<name>" (text content; string[] props render one child per item into the first child element as a template). Use data-if="<name>" on an element that should disappear when the prop is empty.',
  'The block markup is dropped into the stage\'s content slot, so it should not paint its own full-frame background.',
  'Items of a string[] prop appear when the voice reaches them: animate them with a tween positioned at 0 whose stagger is nodecine.stagger("<prop>") (a function of the item index), never a fixed stagger. nodecine.at(i, "<prop>") is the i-th item\'s time in seconds and nodecine.duration the scene length, for anything else that should follow the voice.',
];

const RULES_COMMON = (frame: { width: number; height: number }) => [
  'Output format: a single HTML fragment made of an optional <style> block, the markup, and an optional <script> block. No <html>, <head> or <body>.',
  'Styles are scoped to this stage or block by the engine; write plain selectors, never !important.',
  'Colours and fonts come from CSS variables the stage tokens provide: var(--bg), var(--fg), var(--accent), var(--line), var(--muted), var(--font-display), var(--font-body) and any other palette key listed below. Prefer them over literal colours so tones keep working.',
  `The frame is ${describeFrame(frame)}. Safe zones: keep content inside ${describeSafeZones(safeZonesFor(frame.width, frame.height))} (the platform UI covers the rest).`,
  'Animation uses the gsap that the script receives, scoped to this scene: register with nodecine.timeline(gsap.timeline().fromTo(...)). Use fromTo only, never from (from desyncs on seek).',
  'Keep every data-* hook that exists in the current code unless the instruction says to remove it.',
  'Answer with JSON only. Required: {"source": "<the complete new source>", "summary": "<one or two sentences on what changed>"}. Escape the source as a JSON string.',
  'When the instruction calls for it (and only then), also return the full replacement for one or more of these keys — omit the ones that do not change: for a stage, "tokens" ({"palette": {...}, "fonts": {...}}, keys are identifiers; the code refers to them as var(--key) / var(--font-key)), "tones" ({"<name>": {"<paletteKey>": "<colour>"}}, only palette keys), "sceneFields" ([{"name", "rule", "options"?}], each drawn by a data-field element in the code); for a block, "props" ({"<name>": {"type": "string|text|number|boolean|color|string[]", "hint"?, "required"?, "max"?, "min"?}}, each filled through a data-prop element) and "doc" ({"example", "when"}).',
];

const RULES_STAGE = [
  'A stage is the shell every scene plays on. It must contain exactly one element with data-slot="content" (the block goes there) and should contain one with data-slot="captions" (subtitle lines go there; add data-caption-style="karaoke" or "reveal").',
  'Per-scene text the stage draws itself uses data-field="<name>" for each scene field listed below; the engine fills the text.',
  `A stage's elements are the catalogue roles, each recognised by its class name: ${STAGE_ROLES.map((r) => `${r.id} (${r.kind})`).join(', ')}. Keep those class names on the elements that play those roles; do not invent new top-level elements unless the instruction asks for one.`,
];

const RULES_BLOCK = BLOCK_RULES;

function describeStage(stage: NonNullable<LookEditRequest['stage']>): string[] {
  const out = [`Stage "${stage.name}".`];
  out.push(`Palette keys (CSS variables --<key>): ${Object.entries(stage.tokens.palette).map(([k, v]) => `${k}=${v}`).join(', ')}.`);
  out.push(`Fonts (--font-<key>): ${Object.entries(stage.tokens.fonts).map(([k, v]) => `${k}=${v}`).join('; ')}.`);
  const tones = Object.keys(stage.tones);
  if (tones.length) out.push(`Tones (palette overrides a scene may switch to): ${tones.join(', ')}.`);
  if (stage.sceneFields.length) out.push(`Scene fields (data-field): ${stage.sceneFields.map((f) => `${f.name} — ${f.rule}${f.options ? ` (one of ${f.options.join(', ')})` : ''}`).join('; ')}.`);
  return out;
}

function describeBlock(block: NonNullable<LookEditRequest['block']>): string[] {
  const out = [`Block "${block.name}" (id ${block.id}). When to use: ${block.doc.when || '—'}.`];
  const props = Object.entries(block.props);
  out.push(props.length ? `Props (data-prop): ${props.map(([k, f]) => `${k}: ${describeBlockField(f)}`).join('; ')}.` : 'This block has no props.');
  return out;
}

export function buildLookEditPrompt(req: LookEditRequest): string {
  const lines: string[] = [];
  lines.push(`You are editing the ${req.kind} code of a NodeCine video look. Apply the user's instruction to the current code and return the complete new code.`);
  lines.push('', 'Rules:', ...RULES_COMMON(req.frame).map((r) => `- ${r}`), ...(req.kind === 'stage' ? RULES_STAGE : RULES_BLOCK).map((r) => `- ${r}`));
  lines.push('', 'Context:');
  if (req.stage) lines.push(...describeStage(req.stage).map((s) => `- ${s}`));
  if (req.block) lines.push(...describeBlock(req.block).map((s) => `- ${s}`));
  lines.push('', `Instruction (any language; write the summary in the user's interface language "${req.locale}"; keep any visible text in the language the current code uses unless told otherwise):`, req.instruction.trim());
  lines.push('', 'Current code:', '```html', req.source, '```');
  lines.push('', 'Return the JSON now.');
  return lines.join('\n');
}

/** Things the rules forbid that a model still does; reported next to the draft, never blocking. */
export function lintLookSource(kind: 'stage' | 'block', source: string, block?: Pick<BlockDef, 'props'>): string[] {
  const warnings: string[] = [];
  if (/\.from\(/.test(source)) warnings.push('uses gsap .from(); use fromTo so seeking stays in sync');
  if (/<(html|body|head)\b/i.test(source)) warnings.push('contains <html>/<head>/<body>; only a fragment belongs here');
  if (/!important/.test(source)) warnings.push('uses !important');
  if (kind === 'stage') {
    const slots = source.match(/data-slot=["']content["']/g)?.length ?? 0;
    if (slots !== 1) warnings.push(slots === 0 ? 'no data-slot="content": blocks have nowhere to go' : 'more than one data-slot="content"');
    if (!/data-slot=["']captions["']/.test(source)) warnings.push('no data-slot="captions": subtitles fall back to the default band');
  } else if (block) {
    for (const name of Object.keys(block.props)) {
      if (!new RegExp(`data-prop=["']${name}["']`).test(source)) warnings.push(`prop "${name}" has no data-prop element`);
    }
  }
  return warnings;
}

export type Complete = <S extends ZodTypeAny>(prompt: string, schema: S, signal: AbortSignal) => Promise<z.infer<S>>;

export interface LookEditResult extends LookEditAnswer { warnings: string[]; changes: string[] }

/** What changed besides the code, as short labels for the modal. */
export function describeChanges(req: LookEditRequest, a: LookEditAnswer): string[] {
  const out: string[] = [];
  const diffKeys = (before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) => {
    if (!after) return null;
    const b = before ?? {};
    const added = Object.keys(after).filter((k) => !(k in b)).length;
    const removed = Object.keys(b).filter((k) => !(k in after)).length;
    const changed = Object.keys(after).filter((k) => k in b && JSON.stringify(after[k]) !== JSON.stringify(b[k])).length;
    return { added, removed, changed, any: added + removed + changed > 0 };
  };
  const fmt = (label: string, d: { added: number; removed: number; changed: number } | null) => d && (d.added || d.removed || d.changed) ? `${label}: ${[d.changed ? `${d.changed} changed` : '', d.added ? `+${d.added}` : '', d.removed ? `−${d.removed}` : ''].filter(Boolean).join(' ')}` : null;
  if (req.kind === 'stage') {
    for (const x of [fmt('palette', diffKeys(req.stage?.tokens.palette, a.tokens?.palette)), fmt('fonts', diffKeys(req.stage?.tokens.fonts, a.tokens?.fonts)), fmt('tones', diffKeys(req.stage?.tones, a.tones))]) if (x) out.push(x);
    if (a.sceneFields) { const before = new Set((req.stage?.sceneFields ?? []).map((f) => f.name)); const after = new Set(a.sceneFields.map((f) => f.name)); const added = [...after].filter((n) => !before.has(n)); const removed = [...before].filter((n) => !after.has(n)); if (added.length || removed.length) out.push(`fields: ${[added.length ? `+${added.join(', ')}` : '', removed.length ? `−${removed.join(', ')}` : ''].filter(Boolean).join(' ')}`); }
  } else {
    const p = fmt('props', diffKeys(req.block?.props, a.props)); if (p) out.push(p);
    if (a.doc && JSON.stringify(a.doc) !== JSON.stringify(req.block?.doc)) out.push('doc');
  }
  return out;
}

export async function editLook(req: LookEditRequest, complete: Complete, signal: AbortSignal): Promise<LookEditResult> {
  const answer = await complete(buildLookEditPrompt(req), LookEditAnswerSchema, signal);
  // A fenced answer is still an answer.
  const source = answer.source.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  const warnings = lintLookSource(req.kind, source, req.block ? { props: answer.props ?? req.block.props } : undefined);
  // A tone may only override palette keys; anything else is dropped and said.
  let tones = answer.tones;
  if (tones) {
    const palette = answer.tokens?.palette ?? req.stage?.tokens.palette ?? {};
    tones = Object.fromEntries(Object.entries(tones).map(([name, ov]) => [name, Object.fromEntries(Object.entries(ov).filter(([k]) => { const ok = k in palette; if (!ok) warnings.push(`tone "${name}" overrides "${k}", which is not a palette key; dropped`); return ok; }))]));
  }
  // A scene field the answer adds should be drawn by the answer's code.
  for (const f of answer.sceneFields ?? []) if (!new RegExp(`data-field=["']${f.name}["']`).test(source)) warnings.push(`scene field "${f.name}" has no data-field element in the code`);
  const parts = { tokens: answer.tokens, tones, sceneFields: answer.sceneFields, props: answer.props, doc: answer.doc };
  return { source, summary: answer.summary, ...Object.fromEntries(Object.entries(parts).filter(([, v]) => v !== undefined)), warnings, changes: describeChanges(req, { ...answer, tones }) };
}

export type { StageDef, BlockDef };
