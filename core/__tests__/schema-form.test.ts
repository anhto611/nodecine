import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { schemaFields, settleNumber } from '@/core/schema-form';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry, listNodeTypes } from '@/core/nodes/definition';

describe('schemaFields', () => {
  it('reads enums, strings, bounded numbers and booleans off an object schema, in order', () => {
    const fields = schemaFields(z.object({
      codec: z.enum(['h264', 'h265']).default('h264'),
      fileName: z.string().min(1).max(80).default('out.mp4'),
      fps: z.number().int().positive().default(30),
      speed: z.number().min(0.5).max(2).default(1),
      concurrency: z.number().int().positive().optional(),
      burn: z.boolean().default(false),
      settings: z.record(z.string(), z.unknown()).default({}),
    }));
    expect(fields.map((f) => `${f.name}:${f.kind}`)).toEqual(['codec:select', 'fileName:text', 'fps:number', 'speed:number', 'concurrency:number', 'burn:boolean']);
    expect(fields[0]).toMatchObject({ options: ['h264', 'h265'], defaultValue: 'h264', optional: false });
    expect(fields[1]).toMatchObject({ max: 80, defaultValue: 'out.mp4' });
    // positive() is an exclusive bound at 0; for an integer that means 1.
    expect(fields[2]).toMatchObject({ integer: true, min: 1, defaultValue: 30 });
    expect(fields[3]).toMatchObject({ integer: false, min: 0.5, max: 2 });
    expect(fields[4]).toMatchObject({ optional: true, min: 1 });
  });

  it('returns nothing for a schema that is not an object', () => {
    expect(schemaFields(z.string())).toEqual([]);
  });
});

describe('settleNumber', () => {
  const maxChars = schemaFields(z.object({ maxChars: z.number().int().min(8).max(80).default(26) }))[0] as Extract<ReturnType<typeof schemaFields>[number], { kind: 'number' }>;
  it('rounds integers and applies the bounds when the field is left', () => {
    expect(settleNumber(maxChars, '7')).toBe(8);
    expect(settleNumber(maxChars, '99')).toBe(80);
    expect(settleNumber(maxChars, '26.6')).toBe(27);
  });
  it('falls back to the default when emptied, or to unset for an optional field', () => {
    expect(settleNumber(maxChars, '')).toBe(26);
    expect(settleNumber(maxChars, 'abc')).toBe(26);
    expect(settleNumber({ ...maxChars, optional: true }, '')).toBeUndefined();
  });
});

describe('the Zod internals schemaFields reads', () => {
  it('still look the way it expects', () => {
    const def = (z.object({ a: z.string() }) as unknown as { _def: { typeName?: string; shape?: unknown } })._def;
    const why = 'Zod moved `_def`. nodes/form.ts reads it directly, so every schema-driven node body goes blank without a single error. Check the Zod version before anything else.';
    expect(def.typeName, why).toBe('ZodObject');
    expect(typeof def.shape, why).toBe('function');
  });

  it('draws a form for every node that declares scalar parameters', () => {
    _resetNodeRegistry();
    registerNodes();
    for (const node of listNodeTypes()) {
      const scalars = Object.entries(node.defaultParams as Record<string, unknown>).filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
      if (!scalars.length) continue;
      expect(schemaFields(node.paramsSchema).length, `${node.type} has scalar parameters but its schema yields no fields`).toBeGreaterThan(0);
    }
  });
});
