import { describe, expect, it } from 'vitest';
import { WRITTEN_KEYS, type SceneScript } from '@/core/types/payloads';
import { buildBreakdownPrompt, hasWritten, outputSchemaFor } from '../prompt';

const script: SceneScript = {
  language: 'vi',
  scenes: [
    { role: 'open', weight: 1, narration: 'Mỗi cảnh là một tấm hình.', content: {} },
    { role: 'body', weight: 1, narration: 'Ba bước: chọn, nối, chạy.', content: { title: 'Ba bước' } },
    { role: 'close', weight: 1, narration: 'Bấm chạy là xong.', content: { image: '/api/assets/0123456789abcdef.png' } },
  ],
};

describe('hasWritten', () => {
  it('counts words, not files, and not empty values', () => {
    expect(hasWritten({})).toBe(false);
    expect(hasWritten({ image: '/api/assets/0123456789abcdef.png' })).toBe(false);
    expect(hasWritten({ title: '' })).toBe(false);
    expect(hasWritten({ points: [] })).toBe(false);
    expect(hasWritten({ title: 'x' })).toBe(true);
    expect(hasWritten({ entries: [{ label: 'a' }] })).toBe(true);
  });
});

describe('buildBreakdownPrompt', () => {
  const prompt = buildBreakdownPrompt({ script, wanted: [0, 2], density: 'auto', language: 'vi', strict: false });

  it('shows every scene with its narration and marks the ones written by hand as keep', () => {
    expect(prompt).toContain('1. [open] "Mỗi cảnh là một tấm hình."');
    expect(prompt).toContain('2. [body] "Ba bước: chọn, nối, chạy." — already written by hand: keep, answer {}');
    expect(prompt).toContain('3. [close] "Bấm chạy là xong."');
    expect(prompt).not.toContain('3. [close] "Bấm chạy là xong." —');
    expect(prompt).toContain('exactly 3 objects');
  });

  it('uses the screenwriter vocabulary, every written key and neither file', () => {
    for (const k of WRITTEN_KEYS) expect(prompt).toContain(`- ${k}:`);
    expect(prompt).not.toContain('- image:');
    expect(prompt).not.toContain('- clip:');
  });

  it('never asks for the narration back', () => {
    expect(prompt).toContain('you do not return it');
    expect(prompt).not.toContain('"narration"');
  });

  it('names the language and says it twice when strict', () => {
    expect(prompt).toContain('Write ALL on-screen text in Vietnamese (language code "vi")');
    expect(buildBreakdownPrompt({ script, wanted: [0], density: 'auto', language: 'vi', strict: true })).toContain('This is mandatory');
  });

  it('says how dense to write, one rule per density', () => {
    expect(buildBreakdownPrompt({ script, wanted: [0], density: 'sparse', language: 'vi', strict: false })).toContain('Keep it spare');
    expect(buildBreakdownPrompt({ script, wanted: [0], density: 'rich', language: 'vi', strict: false })).toContain('Show what the narration lists');
    expect(prompt).toContain('Let the narration decide');
  });

  it('drops the keep rule when every scene is written', () => {
    const all = buildBreakdownPrompt({ script, wanted: [0, 1, 2], density: 'auto', language: 'vi', strict: false });
    expect(all).not.toContain('keep');
  });
});

describe('outputSchemaFor', () => {
  it('holds the model to the scene count and drops a file the model names', () => {
    const schema = outputSchemaFor(2);
    expect(schema.safeParse({ language: 'vi', scenes: [{ title: 'a' }, {}] }).success).toBe(true);
    expect(schema.safeParse({ language: 'vi', scenes: [{ title: 'a' }] }).success).toBe(false);
    expect(schema.safeParse({ language: 'vi', scenes: [{ title: 'a' }, {}, {}] }).success).toBe(false);
    const withFile = schema.safeParse({ language: 'vi', scenes: [{ image: '/api/assets/0123456789abcdef.png', title: 'a' }, {}] });
    expect(withFile.success && withFile.data.scenes[0]).toEqual({ title: 'a' });
    expect(() => outputSchemaFor(0)).toThrow();
  });
});
