import { z } from 'zod';
import { isContentKey, type BlockDef, type BlockField, type ContentKey, type DirectorPlan, type LookDef, type SceneContent, type SceneScript } from '@/core/types/payloads';

/**
 * Casting (CORE_CONTRACTS §5.9): the Look's one job at run time. A scene arrives as content in the
 * fixed vocabulary; the Look picks the block that shows it, fills the block's props from the
 * content, translates the scene's fact bindings onto those props, writes the stage's per-scene
 * fields and sets a tone. No model call: a rule per prop, a score per block, and the user's casting
 * table by role for when the rule should not decide.
 */

export const CastingSchema = z
  .array(
    z.object({
      role: z.string().min(1).max(40),
      /** Block id for every scene of this role; absent lets the content pick. */
      block: z.string().optional(),
      /** One of the stage's tones; absent is the base palette. */
      tone: z.string().optional(),
    }),
  )
  .default([]);
export type Casting = z.infer<typeof CastingSchema>;

/** The content key that fills a prop: declared, or the prop's own name when that is a key. */
export function contentKeyOf(name: string, field: BlockField): ContentKey | undefined {
  return field.content ?? (isContentKey(name) ? name : undefined);
}

/** One prop's value from the content, shaped for the field; `undefined` when the content has nothing for it. */
export function propValue(field: BlockField, value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  switch (field.type) {
    case 'string':
    case 'text':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'string[]':
      return Array.isArray(value) ? value : [String(value)];
    case 'number': {
      // "4,321" and "98%" carry a figure; "many" does not, and must not become 0.
      const digits = String(value).replace(/[^0-9.-]/g, '');
      const n = Number(digits);
      return /[0-9]/.test(digits) && Number.isFinite(n) ? n : undefined;
    }
    default:
      return undefined;
  }
}

export interface Fit {
  block: BlockDef;
  /** Required props with nothing to fill them: the block cannot show this scene. */
  missing: string[];
  /** How many props the content fills; the score a scene picks its block by. */
  filled: number;
}

/** How well a block shows a scene's content, given which content keys are fact-bound. */
export function fitOf(block: BlockDef, content: SceneContent, bound: Set<string>): Fit {
  let filled = 0;
  const missing: string[] = [];
  for (const [name, field] of Object.entries(block.props)) {
    const key = contentKeyOf(name, field);
    const has = key !== undefined && (bound.has(key) || propValue(field, content[key]) !== undefined);
    if (has) filled++;
    else if (field.required) missing.push(name);
  }
  return { block, missing, filled };
}

/** The block's props from the content; bound props are left for the assembler. */
export function fillProps(block: BlockDef, content: SceneContent, bound: Set<string>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(block.props)) {
    const key = contentKeyOf(name, field);
    if (!key || bound.has(key)) continue;
    const v = propValue(field, content[key]);
    if (v !== undefined) props[name] = v;
  }
  return props;
}

/** content key → fact key, restated as prop key → fact key for the block that was cast. */
export function bindingsFor(block: BlockDef, bindings: Partial<Record<ContentKey, string>> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!bindings) return out;
  for (const [name, field] of Object.entries(block.props)) {
    const key = contentKeyOf(name, field);
    const fact = key && bindings[key];
    if (fact) out[name] = fact;
  }
  return out;
}

export class CastError extends Error {
  constructor(message: string, public readonly fix: string) {
    super(message);
    this.name = 'CastError';
  }
}

/** Turn a scene script into a self-contained plan. Throws `CastError` when a scene has no block that can show it. */
export function castScenes(script: SceneScript, look: LookDef, casting: Casting): { plan: DirectorPlan; notes: string[] } {
  const { blocks, ...stage } = look;
  const notes: string[] = [];
  const byRole = new Map(casting.map((c) => [c.role, c]));
  const scenes = script.scenes.map((scene, i) => {
    const bound = new Set(Object.keys(scene.factBindings ?? {}));
    const cast = byRole.get(scene.role);
    const fits = blocks.map((b) => fitOf(b, scene.content, bound));
    let fit: Fit | undefined;
    if (cast?.block) {
      const pinned = fits.find((f) => f.block.id === cast.block);
      if (!pinned) notes.push(`scene ${i + 1} (${scene.role}): no block "${cast.block}" in this look; picking by content`);
      else if (pinned.missing.length) notes.push(`scene ${i + 1} (${scene.role}): block "${cast.block}" needs ${pinned.missing.join(', ')} which the scene does not say; picking by content`);
      else fit = pinned;
    }
    if (!fit) {
      // Most props filled wins; a block that cannot show the scene never wins; ties go to catalogue order.
      const able = fits.filter((f) => f.missing.length === 0);
      fit = able.sort((a, b) => b.filled - a.filled)[0];
    }
    if (!fit) {
      const best = [...fits].sort((a, b) => a.missing.length - b.missing.length)[0];
      const keys = Object.keys(scene.content).filter((k) => (scene.content as Record<string, unknown>)[k] !== undefined);
      throw new CastError(
        `scene ${i + 1} (${scene.role}) says ${keys.join(', ') || 'nothing'} and no block of the look can show that${best ? `; "${best.block.id}" still needs ${best.missing.join(', ')}` : ''}`,
        'add what the block needs to the beat brief, cast another block for this role, or add a block that shows this content',
      );
    }
    const tone = cast?.tone && cast.tone in stage.tones ? cast.tone : undefined;
    if (cast?.tone && !tone) notes.push(`scene ${i + 1} (${scene.role}): the stage has no tone "${cast.tone}"`);
    const fields: Record<string, string> = {};
    for (const f of stage.sceneFields) {
      const v = isContentKey(f.name) ? scene.content[f.name] : undefined;
      if (typeof v === 'string' && v && (!f.options?.length || f.options.includes(v))) fields[f.name] = v;
    }
    const factBindings = bindingsFor(fit.block, scene.factBindings);
    return {
      blockId: fit.block.id,
      weight: scene.weight,
      props: fillProps(fit.block, scene.content, bound),
      ...(tone ? { tone } : {}),
      ...(Object.keys(fields).length ? { fields } : {}),
      ...(Object.keys(factBindings).length ? { factBindings } : {}),
    };
  });
  return { plan: { language: script.language, stage, blocks, scenes }, notes };
}
