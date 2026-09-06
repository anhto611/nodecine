import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { schemaFields, settleNumber } from '../form';

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
