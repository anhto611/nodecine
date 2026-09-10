import type { ZodTypeAny } from 'zod';

/**
 * A form read off a Zod schema (ARCHITECTURE §2): the schema already says a codec is one of two
 * values, a count sits between 8 and 80, a title is a string — so nothing else need say it again in
 * JSX. Node bodies reach it through `FormBody`; the provider nodes draw their chosen provider's
 * settings from the same reading, which is why it sits in core rather than in `nodes/`. Pure, so it
 * can be tested without React. Kinds a form cannot draw (records, arrays, objects) are left out and
 * are drawn by hand.
 */
export type FormField =
  | { name: string; kind: 'text'; optional: boolean; max?: number; defaultValue?: string }
  | { name: string; kind: 'number'; optional: boolean; min?: number; max?: number; integer: boolean; defaultValue?: number }
  | { name: string; kind: 'select'; optional: boolean; options: string[]; defaultValue?: string }
  | { name: string; kind: 'boolean'; optional: boolean; defaultValue?: boolean };

type Def = { typeName: string; innerType?: ZodTypeAny; defaultValue?: () => unknown; values?: string[]; checks?: { kind: string; value?: number; inclusive?: boolean }[]; schema?: ZodTypeAny; shape?: () => Record<string, ZodTypeAny> };
const defOf = (s: ZodTypeAny): Def => (s as unknown as { _def: Def })._def;

/** Strip default / optional / nullable / effects wrappers, remembering what they said. */
function unwrap(schema: ZodTypeAny): { core: ZodTypeAny; optional: boolean; defaultValue?: unknown } {
  let s = schema;
  let optional = false;
  let defaultValue: unknown;
  for (let i = 0; i < 8; i++) {
    const d = defOf(s);
    if (d.typeName === 'ZodDefault' && d.innerType) { defaultValue = d.defaultValue?.(); s = d.innerType; continue; }
    if ((d.typeName === 'ZodOptional' || d.typeName === 'ZodNullable') && d.innerType) { optional = true; s = d.innerType; continue; }
    if (d.typeName === 'ZodEffects' && d.schema) { s = d.schema; continue; }
    break;
  }
  return { core: s, optional, defaultValue };
}

/** The fields of an object schema the form can draw, in declaration order. */
export function schemaFields(schema: ZodTypeAny): FormField[] {
  const d = defOf(schema);
  const shape = d.typeName === 'ZodObject' && d.shape ? d.shape() : unwrap(schema).core && defOf(unwrap(schema).core).shape?.();
  if (!shape) return [];
  const out: FormField[] = [];
  for (const [name, member] of Object.entries(shape)) {
    const { core, optional, defaultValue } = unwrap(member);
    const cd = defOf(core);
    if (cd.typeName === 'ZodEnum' && cd.values) out.push({ name, kind: 'select', optional, options: [...cd.values], defaultValue: defaultValue as string | undefined });
    else if (cd.typeName === 'ZodString') {
      const max = cd.checks?.find((c) => c.kind === 'max')?.value;
      out.push({ name, kind: 'text', optional, max, defaultValue: defaultValue as string | undefined });
    } else if (cd.typeName === 'ZodNumber') {
      const checks = cd.checks ?? [];
      const integer = checks.some((c) => c.kind === 'int');
      const minC = checks.find((c) => c.kind === 'min');
      const maxC = checks.find((c) => c.kind === 'max');
      // An exclusive bound on an integer is the next integer; on a real number the bound itself is the best the form can offer.
      const min = minC?.value === undefined ? undefined : minC.inclusive === false && integer ? minC.value + 1 : minC.value;
      const max = maxC?.value === undefined ? undefined : maxC.inclusive === false && integer ? maxC.value - 1 : maxC.value;
      out.push({ name, kind: 'number', optional, min, max, integer, defaultValue: defaultValue as number | undefined });
    } else if (cd.typeName === 'ZodBoolean') out.push({ name, kind: 'boolean', optional, defaultValue: defaultValue as boolean | undefined });
  }
  return out;
}

/**
 * A number the user has finished typing, made valid: empty means "unset" for an optional field and
 * the default otherwise; integers are rounded; bounds are applied. Called on blur, not on every
 * keystroke, so typing 80 into a field whose minimum is 24 does not snap the 8 to 24 midway.
 */
export function settleNumber(field: Extract<FormField, { kind: 'number' }>, raw: string): number | undefined {
  if (raw.trim() === '') return field.optional ? undefined : field.defaultValue;
  let n = Number(raw);
  if (!Number.isFinite(n)) return field.optional ? undefined : field.defaultValue;
  if (field.integer) n = Math.round(n);
  if (field.min !== undefined) n = Math.max(field.min, n);
  if (field.max !== undefined) n = Math.min(field.max, n);
  return n;
}
