import { z } from 'zod';
import { isContentKey, type BlockDef, type BlockField, type ContentKey, type ScenePlan, type LookDef, type SceneContent, type SceneScript } from '@/core/types/payloads';

/**
 * Casting (CORE_CONTRACTS §5.9): the Art Director's one job at run time. A scene arrives as content in the
 * fixed vocabulary; the Art Director picks the block that shows it, fills the block's props from the
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

/**
 * Text cut to a block's limit at a word boundary, with an ellipsis. The vocabulary allows longer
 * text than a small card can hold; the plan must still validate, so the card gets what fits.
 */
export function clipText(text: string, max: number | undefined): string {
  if (max === undefined || text.length <= max) return text;
  const head = text.slice(0, Math.max(1, max - 1));
  const space = head.lastIndexOf(' ');
  return `${(space >= max * 0.6 ? head.slice(0, space) : head).trimEnd()}…`;
}

/** One prop's value from the content, shaped for the field; `undefined` when the content has nothing for it. */
export function propValue(field: BlockField, value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  switch (field.type) {
    case 'string':
    case 'text':
      return clipText(Array.isArray(value) ? value.join(', ') : String(value), field.max);
    case 'string[]': {
      // A list with too few items for the block cannot be shown; too many are cut to the limit.
      const items = (Array.isArray(value) ? value : [String(value)]).map((x) => String(x).trim()).filter(Boolean);
      if (items.length === 0 || (field.min !== undefined && items.length < field.min)) return undefined;
      return field.max !== undefined ? items.slice(0, field.max) : items;
    }
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
  /** Optional props left empty: a block that shows this content with nothing left over fits better. */
  spare: number;
  /** Content the scene has that neither this block nor the stage would show: the block loses it. */
  dropped: ContentKey[];
}

/** Keys the stage draws itself (kicker, source): a block need not show them. */
export const stageKeys = (look: { sceneFields: LookDef['sceneFields'] }): Set<string> => new Set(look.sceneFields.map((f) => f.name));

/** How well a block shows a scene's content, given which content keys are fact-bound and which the stage draws. */
export function fitOf(block: BlockDef, content: SceneContent, bound: Set<string>, onStage: Set<string> = new Set()): Fit {
  let filled = 0;
  let spare = 0;
  const missing: string[] = [];
  const shown = new Set<string>();
  for (const [name, field] of Object.entries(block.props)) {
    const key = contentKeyOf(name, field);
    const has = key !== undefined && (bound.has(key) || propValue(field, content[key]) !== undefined);
    if (has) { filled++; shown.add(key!); }
    else if (field.required) missing.push(name);
    else spare++;
  }
  const present = (Object.keys(content) as ContentKey[]).filter((k) => { const v = content[k]; return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0); });
  const dropped = present.filter((k) => !shown.has(k) && !onStage.has(k) && !bound.has(k));
  return { block, missing, filled, spare, dropped };
}

/** A block covers a scene when it can show it and loses none of its content. */
export const covers = (f: Fit): boolean => f.missing.length === 0 && f.dropped.length === 0;

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

/** One scene's choice made outside the rule: by the user's casting table or by a model. */
export interface Pick { block?: string; tone?: string }

/**
 * For every scene: the blocks that cover it (show all of it), the ones that merely fit (show it
 * but lose some content), and the one the casting table pins (when it fits). A scene with no
 * covering block is what the Art Director writes a new block for.
 */
export function sceneCandidates(script: SceneScript, look: LookDef, casting: Casting): { role: string; pinned?: string; candidates: string[]; partial: { id: string; dropped: ContentKey[] }[] }[] {
  const byRole = new Map(casting.map((c) => [c.role, c]));
  const onStage = stageKeys(look);
  return script.scenes.map((scene) => {
    const bound = new Set(Object.keys(scene.factBindings ?? {}));
    const fits = look.blocks.map((b) => fitOf(b, scene.content, bound, onStage)).filter((f) => f.missing.length === 0);
    const pin = byRole.get(scene.role)?.block;
    return {
      role: scene.role,
      ...(pin && fits.some((f) => f.block.id === pin) ? { pinned: pin } : {}),
      candidates: fits.filter(covers).map((f) => f.block.id),
      partial: fits.filter((f) => !covers(f)).map((f) => ({ id: f.block.id, dropped: f.dropped })),
    };
  });
}

export class CastError extends Error {
  constructor(message: string, public readonly fix: string) {
    super(message);
    this.name = 'CastError';
  }
}

/** Turn a scene script into a self-contained plan. Throws `CastError` when a scene has no block that can show it. */
/**
 * Turn a scene script into a self-contained plan. `picks` are a model's choices, one per scene: they
 * count after the user's casting table and before the rule, and only when the block fits.
 * Throws `CastError` when a scene has no block that can show it.
 */
export function castScenes(script: SceneScript, look: LookDef, casting: Casting, picks: (Pick | undefined)[] = []): { plan: ScenePlan; notes: string[] } {
  const { blocks, ...stage } = look;
  const notes: string[] = [];
  const byRole = new Map(casting.map((c) => [c.role, c]));
  const used = new Map<string, number>();
  const onStage = stageKeys(look);
  const scenes = script.scenes.map((scene, i) => {
    const bound = new Set(Object.keys(scene.factBindings ?? {}));
    const cast = byRole.get(scene.role);
    const fits = blocks.map((b) => fitOf(b, scene.content, bound, onStage));
    let fit: Fit | undefined;
    if (cast?.block) {
      const pinned = fits.find((f) => f.block.id === cast.block);
      if (!pinned) notes.push(`scene ${i + 1} (${scene.role}): no block "${cast.block}" in this look; picking by content`);
      else if (pinned.missing.length) notes.push(`scene ${i + 1} (${scene.role}): block "${cast.block}" needs ${pinned.missing.join(', ')} which the scene does not say; picking by content`);
      else fit = pinned;
    }
    const pick = picks[i];
    if (!fit && pick?.block) {
      const chosen = fits.find((f) => f.block.id === pick.block);
      if (chosen && chosen.missing.length === 0) fit = chosen;
      else notes.push(`scene ${i + 1} (${scene.role}): the model chose "${pick.block}", which cannot show this scene; picking by content`);
    }
    if (!fit) {
      // A block that cannot show the scene never wins. Among the rest: the one that loses the least
      // content, then most props filled, then the fewest left empty (a block made for this content),
      // then the block used least so far, so a run of similar scenes does not all land on the first
      // card in the catalogue.
      const able = fits.filter((f) => f.missing.length === 0);
      fit = able.sort((a, b) => a.dropped.length - b.dropped.length || b.filled - a.filled || a.spare - b.spare || (used.get(a.block.id) ?? 0) - (used.get(b.block.id) ?? 0))[0];
    }
    if (fit) used.set(fit.block.id, (used.get(fit.block.id) ?? 0) + 1);
    if (!fit) {
      const best = [...fits].sort((a, b) => a.missing.length - b.missing.length)[0];
      const keys = Object.keys(scene.content).filter((k) => (scene.content as Record<string, unknown>)[k] !== undefined);
      throw new CastError(
        `scene ${i + 1} (${scene.role}) says ${keys.join(', ') || 'nothing'} and no block of the look can show that${best ? `; "${best.block.id}" still needs ${best.missing.join(', ')}` : ''}`,
        'add what the block needs to the beat brief, cast another block for this role, or add a block that shows this content',
      );
    }
    const wantTone = cast?.tone ?? pick?.tone;
    const tone = wantTone && wantTone in stage.tones ? wantTone : undefined;
    if (wantTone && !tone) notes.push(`scene ${i + 1} (${scene.role}): the stage has no tone "${wantTone}"`);
    const fields: Record<string, string> = {};
    for (const f of stage.sceneFields) {
      const v = isContentKey(f.name) ? scene.content[f.name] : undefined;
      if (typeof v === 'string' && v && (!f.options?.length || f.options.includes(v))) fields[f.name] = v;
    }
    if (fit.dropped.length) notes.push(`scene ${i + 1} (${scene.role}): ${fit.block.id} has no place for ${fit.dropped.join(', ')}`);
    const factBindings = bindingsFor(fit.block, scene.factBindings);
    const props = fillProps(fit.block, scene.content, bound);
    for (const [name, field] of Object.entries(fit.block.props)) {
      const key = contentKeyOf(name, field);
      const raw = key ? scene.content[key] : undefined;
      if (typeof raw === 'string' && field.max !== undefined && raw.length > field.max) notes.push(`scene ${i + 1} (${scene.role}): "${name}" of ${fit.block.id} cut to ${field.max} characters`);
    }
    return {
      blockId: fit.block.id,
      weight: scene.weight,
      props,
      ...(tone ? { tone } : {}),
      ...(Object.keys(fields).length ? { fields } : {}),
      ...(Object.keys(factBindings).length ? { factBindings } : {}),
    };
  });
  return { plan: { language: script.language, stage, blocks, scenes }, notes };
}
