import { z } from 'zod';
import { BlockDefSchema, CONTENT_KEYS, type BlockDef, type LLMRef, type LookDef, type SceneScript } from '@/core/types/payloads';
import type { NodeServices } from '@/core/engine/services';
import { BLOCK_RULES, codeRules, lintLookSource } from './edit.server';
import { fitOf, stageKeys } from './cast';

/**
 * A block written from nothing (CORE_CONTRACTS §5.9). When no block of the look shows a scene whole
 * — every key of its content, minus what the stage draws — and a model is wired, the Art Director asks for one: props that take exactly the content the
 * scene has, a "when to use me" line, and code in the stage's own tokens. The block is checked
 * the way a hand-written one is — schema, lint, and it must actually fit the scene — then used
 * for this run and kept in the node's parameters, where the user can edit or remove it.
 */

const AuthoredSchema = z
  .object({
    name: z.string().min(1).max(80),
    when: z.string().min(1).max(1000),
    example: z.string().max(2000).optional(),
    props: z.record(
      z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
      z.object({
        type: z.enum(['string', 'text', 'number', 'boolean', 'color', 'string[]', 'image', 'video']),
        content: z.enum(CONTENT_KEYS),
        required: z.boolean().optional(),
        max: z.number().int().positive().optional(),
        min: z.number().optional(),
        hint: z.string().max(200).optional(),
      }),
    ),
    source: z.string().min(20).max(200_000),
  })
  .strip();

/** The block's id from its name, unique in the look. */
export function slugForBlock(name: string, taken: string[]): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'block';
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}

export function buildAuthoringPrompt(scene: SceneScript['scenes'][number], look: LookDef, feedback?: string): string {
  const onStage = stageKeys(look);
  const content = Object.entries(scene.content).filter(([k, v]) => v !== undefined && v !== '' && !onStage.has(k));
  const bound = Object.keys(scene.factBindings ?? {});
  const sample = look.blocks[0];
  return [
    `You are the art director of a short video. No block in this look can show one scene; write a new block for it.`,
    ``,
    `The scene (role "${scene.role}") says: "${scene.narration}"`,
    `On screen it has these content keys:`,
    ...content.map(([k, v]) => `- ${k}: ${Array.isArray(v) ? JSON.stringify(v) : JSON.stringify(String(v))}`),
    ...(bound.length ? [`These keys are filled from verified data later and must have a prop too: ${bound.join(', ')}`] : []),
    ``,
    `Design the block so that every prop maps to one of those keys through "content" — one prop per key the scene has, no prop for a key it lacks. A key that is a list ("points") maps to a string[] prop; "number" may map to a number prop.`,
    `Palette keys of the stage (use as var(--key)): ${Object.keys(look.tokens.palette).join(', ')}. Font keys (use as var(--font-key)): ${Object.keys(look.tokens.fonts).join(', ')}.`,
    ``,
    `Rules:`,
    ...codeRules(look.frame).map((r) => `- ${r}`),
    ...BLOCK_RULES.map((r) => `- ${r}`),
    `- Give the block a short, specific name that says what it shows (e.g. "Quote card", "Metric ring").`,
    ...(sample ? [``, `For style, an existing block of this look (do not copy it; match its scale and voice):`, sample.code.source.slice(0, 1800)] : []),
    ...(feedback ? [``, `Your previous attempt was rejected: ${feedback}. Fix that.`] : []),
    ``,
    `Return ONLY a JSON object, no prose, no markdown fence:`,
    `{ "name": "…", "when": "one line: when this block is the right choice", "example": "{…example props as a JSON string…}", "props": { "<propName>": { "type": "string|text|number|string[]", "content": "<content key>", "required": true, "max": 60, "hint": "…" } }, "source": "<the complete block source>" }`,
  ].join('\n');
}

/** Everything that would make a written block unusable, as one sentence, or null when it is fine. */
export function rejectBlock(block: BlockDef, scene: SceneScript['scenes'][number], look: { sceneFields: LookDef['sceneFields'] } = { sceneFields: [] }): string | null {
  const parsed = BlockDefSchema.safeParse(block);
  if (!parsed.success) return `the block does not validate: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`;
  if (Object.keys(block.props).length === 0) return 'the block has no props, so it cannot show the content';
  const lint = lintLookSource('block', block.code.source, block);
  if (lint.length) return lint.join('; ');
  const fit = fitOf(block, scene.content, new Set(Object.keys(scene.factBindings ?? {})), stageKeys(look));
  if (fit.missing.length) return `the props ${fit.missing.join(', ')} are required but the scene has no content for them`;
  if (fit.filled === 0) return 'none of the props take any of the scene\'s content';
  if (fit.dropped.length) return `the block has no prop for ${fit.dropped.join(', ')}, which the scene has`;
  return null;
}

/** Ask for a block, check it, ask once more with the reason if it fails, else throw. */
export async function authorBlock(
  services: Pick<NodeServices, 'complete'>,
  ref: LLMRef,
  scene: SceneScript['scenes'][number],
  look: LookDef,
  signal: AbortSignal,
): Promise<{ block: BlockDef; attempts: number }> {
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const a = await services.complete(ref, buildAuthoringPrompt(scene, look, feedback), AuthoredSchema, signal);
    const block: BlockDef = {
      id: slugForBlock(a.name, look.blocks.map((b) => b.id)),
      name: a.name,
      doc: { when: a.when, example: a.example ?? '' },
      props: Object.fromEntries(Object.entries(a.props).map(([k, f]) => [k, { ...f, required: f.required ?? true }])),
      code: { format: 'html-gsap', source: a.source },
    };
    const why = rejectBlock(block, scene, look);
    if (!why) return { block, attempts: attempt };
    feedback = why;
  }
  throw Object.assign(new Error(`the model could not write a block for scene "${scene.role}": ${feedback}`), { code: 'BLOCK_AUTHOR_FAILED', fix: 'add a block that shows this content, or change the beat brief so the scene says less' });
}
