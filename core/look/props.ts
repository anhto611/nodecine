import { z, type ZodTypeAny } from 'zod';
import { AssetUrlSchema, ENTRY_KEYS, EntryContentSchema, type BlockDef, type BlockField, type StageDef } from '../types/payloads';

/**
 * A block's `props` table is the only description of what goes into it (CORE_CONTRACTS §2.7).
 * Everything that needs a shape derives it from here — what the screenwriter asks the model for, what
 * the Static Script accepts, what the IR validator checks — so no block has a hand-written schema.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The Zod schema of one field. Optional fields also accept `null`, which is what a missing fact binds to. */
export function fieldSchema(f: BlockField): ZodTypeAny {
  let s: ZodTypeAny;
  switch (f.type) {
    case 'string':
    case 'text': {
      let t = z.string().min(f.required ? 1 : 0);
      if (f.max !== undefined) t = t.max(f.max);
      s = t;
      break;
    }
    case 'number': {
      let n = z.number();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      s = n;
      break;
    }
    case 'boolean':
      s = z.boolean();
      break;
    case 'color':
      s = z.string().regex(HEX, 'a colour is #rrggbb');
      break;
    case 'image':
    case 'video':
      s = AssetUrlSchema;
      break;
    case 'string[]': {
      let a = z.array(z.string().min(1));
      if (f.min !== undefined) a = a.min(f.min);
      if (f.max !== undefined) a = a.max(f.max);
      s = a;
      break;
    }
    case 'entries': {
      // Only the keys the block says it draws: what it does not name never reaches the plan, so a
      // block asking for a label and a picture cannot be handed the paragraph as well.
      const of = f.of?.length ? f.of : ENTRY_KEYS;
      let a = z.array(EntryContentSchema.pick(Object.fromEntries(of.map((k) => [k, true])) as never).strip());
      if (f.min !== undefined) a = a.min(f.min);
      if (f.max !== undefined) a = a.max(f.max);
      s = a;
      break;
    }
  }
  return f.required ? s : s.nullable().optional();
}

/** Every prop of a block, unknown keys dropped. */
export function propsSchemaFor(block: BlockDef, omit: Iterable<string> = []): z.ZodObject<Record<string, ZodTypeAny>> {
  const skip = new Set(omit);
  const shape: Record<string, ZodTypeAny> = {};
  for (const [name, f] of Object.entries(block.props)) if (!skip.has(name)) shape[name] = fieldSchema(f);
  return z.object(shape).strip();
}

/** A one-line, honest hint for a field: its shape from the type and limits, its intent from the hint. */
export function describeBlockField(f: BlockField): string {
  let shape: string;
  switch (f.type) {
    case 'string':
    case 'text':
      shape = f.max !== undefined ? `text, up to ${f.max} characters` : 'text';
      break;
    case 'number':
      shape = f.min !== undefined && f.max !== undefined ? `number ${f.min}–${f.max}` : 'number';
      break;
    case 'boolean':
      shape = 'true or false';
      break;
    case 'color':
      shape = '#rrggbb';
      break;
    case 'image':
      shape = 'an uploaded image';
      break;
    case 'video':
      shape = 'a video clip this machine holds';
      break;
    case 'string[]':
      shape = `[${f.min !== undefined && f.min === f.max ? `exactly ${f.min}` : f.max !== undefined ? `up to ${f.max}` : 'any number of'} × text]`;
      break;
    case 'entries': {
      const many = f.min !== undefined && f.min === f.max ? `exactly ${f.min}` : f.max !== undefined ? `up to ${f.max}` : 'any number of';
      shape = `${many} entries, each with ${(f.of?.length ? f.of : ENTRY_KEYS).join(', ')}`;
      break;
    }
  }
  return `${shape}${f.hint ? ` — ${f.hint}` : ''}${f.required ? '' : ' (optional)'}`;
}

/** The per-scene fields a stage draws, all optional; a field with options is held to them. */
export function sceneFieldsSchema(stage: StageDef): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of stage.sceneFields) shape[f.name] = (f.options?.length ? z.enum(f.options as [string, ...string[]]) : z.string().max(200)).optional();
  return z.object(shape).strip();
}

export const toneNames = (stage: StageDef): string[] => Object.keys(stage.tones);

export const blockById = (blocks: BlockDef[], id: string): BlockDef | undefined => blocks.find((b) => b.id === id);
