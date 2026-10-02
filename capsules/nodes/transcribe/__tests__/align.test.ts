import { describe, expect, it } from 'vitest';
import { parseAlignerOutput } from '../server';

describe('parseAlignerOutput', () => {
  it('keeps well-formed words, clamps negatives and inverted spans, drops junk', () => {
    const out = parseAlignerOutput(JSON.stringify({ language: 'vi', words: [{ text: 'Xin', start: -0.1, end: 0.2 }, { text: 'chào', start: 0.6, end: 0.5 }, { nope: true }, 'x'] }));
    expect(out).toEqual({
      language: 'vi',
      words: [
        { text: 'Xin', start: 0, end: 0.2 },
        { text: 'chào', start: 0.6, end: 0.6 },
      ],
    });
  });
  it('still reads the bare list older scripts printed', () => {
    expect(parseAlignerOutput(JSON.stringify([{ text: 'Xin', start: 0, end: 0.2 }]))).toEqual({ words: [{ text: 'Xin', start: 0, end: 0.2 }] });
  });
  it('refuses anything that is not a list', () => {
    expect(() => parseAlignerOutput('{"a":1}')).toThrow(/list/);
  });
});

describe('aligning a voice of several segments', () => {
  it('aligns each segment on its own stretch, and spreads one whose timings collapse', async () => {
    const { transcribe } = await import('../node');
    const calls: { text: string; window?: { start: number; duration: number } }[] = [];
    const services = {
      invoke: async (_id: string, [_url, text, _lang, opts]: [string, string, string, { window?: { start: number; duration: number } }]) => {
        calls.push({ text, window: opts.window });
        const w = opts.window!;
        // The second segment comes back piled on one instant, the way a lost aligner answers.
        if (calls.length === 2) return { words: text.split(' ').map((t) => ({ text: t, start: w.start + 3, end: w.start + 3.01 })) };
        return { words: text.split(' ').map((t, i) => ({ text: t, start: w.start + i * 0.5, end: w.start + i * 0.5 + 0.3 })) };
      },
    };
    const voiceover = {
      audioUrl: '/api/media/' + 'a'.repeat(16) + '.mp3',
      durationSeconds: 8,
      voiceName: 'v',
      language: 'vi',
      speed: 1,
      segments: [
        { start: 0, durationSeconds: 3 },
        { start: 3, durationSeconds: 5 },
      ],
    };
    const script = { text: 'Xin chào bạn. Chọn hình. Dịch câu.', language: 'vi', segments: ['Xin chào bạn.', 'Chọn hình. Dịch câu.'] };
    const logs: string[] = [];
    const out = (await transcribe.run({
      params: { model: 'small', maxChars: 26 },
      inputs: { voiceover: { type: 'Voiceover', payload: voiceover }, script: { type: 'AudioScript', payload: script } },
      services,
      signal: new AbortController().signal,
      log: (_l: string, m: string) => logs.push(m),
    } as never)) as { voiceover: { words: { text: string; start: number }[] } };
    expect(calls.map((c) => c.window)).toEqual([
      { start: 0, duration: 3 },
      { start: 3, duration: 5 },
    ]);
    const words = out.voiceover.words;
    expect(words.map((w) => w.text)).toEqual(['Xin', 'chào', 'bạn.', 'Chọn', 'hình.', 'Dịch', 'câu.']);
    expect(words[1]!.start).toBe(0.5);
    // "Chọn" is said inside its own segment, not at the aligner's pile.
    const chon = words[3]!,
      cau = words[6]!;
    expect(chon.start).toBeGreaterThanOrEqual(3);
    expect(cau.start).toBeLessThan(8);
    expect(cau.start - chon.start).toBeGreaterThan(2);
    expect(logs.some((m) => m.includes('segment by segment (1 spread evenly)'))).toBe(true);
  });
});
