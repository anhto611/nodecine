import { z } from 'zod';
import type { AudioScript, Voiceover } from '@/contracts/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { buildCaptionTrack, retime } from '@/contracts/captions/cues';
import { NodeError } from '@/contracts/errors';
import { TranscribeErrorCode } from './errors';

export const ALIGN_MODELS = ['small', 'medium', 'large-v3'] as const;

const Params = z.object({
  model: z.enum(ALIGN_MODELS).default('small'),
  /** Characters a caption line may hold: a measurement of the band the scenes draw. */
  maxChars: z.number().int().min(8).max(80).default(26),
});

/**
 * Voiceover (+ AudioScript) → the voice with word timings, and the captions.
 *
 * With a script wired in it **aligns**: the text is known, so the model only has to say when each
 * word is spoken, and the narration can never come back misspelled. Without one it **transcribes**,
 * which is the only way a recording somebody made outside this app can ever have captions — nobody
 * here knows what was said. A voice-over that already carries words passes through untouched either
 * way, so wiring this node in costs nothing there.
 *
 * The caption track comes out of the same node because it comes out of the same work. Captions were
 * a node of their own until 2026-09-12, and they could only ever be wired behind this one: nothing
 * else produces a voice carrying words. Two nodes for one step meant every workflow drew the pair
 * and the wire between them, and a person could put the second one somewhere it could never run.
 * Cutting the lines is pure and costs nothing; making them a second port is the honest shape.
 */
export const transcribe: NodeDefinition<typeof Params> = {
  type: 'transcribe',
  version: 2,
  kind: 'process',
  inputs: [
    { name: 'voiceover', type: 'Voiceover' },
    // Optional: a film whose voice this app wrote knows its own words; a recording brought in does not.
    { name: 'script', type: 'AudioScript', required: false },
  ],
  outputs: [
    { name: 'voiceover', type: 'Voiceover' },
    { name: 'captions', type: 'CaptionTrack' },
  ],
  paramsSchema: Params,
  defaultParams: { model: 'small', maxChars: 26 },
  run: async ({ params, inputs, services, signal, log }) => {
    const voiceover = inputs.voiceover!.payload as Voiceover;
    const script = inputs.script?.payload as AudioScript | undefined;
    if (voiceover.words?.length) {
      log('info', `${voiceover.words.length} words already timed by the provider`);
      return cut(voiceover, params.maxChars, log);
    }
    type Word = import('@/contracts/types/payloads').Word;
    type Heard = { words: Word[]; language?: string };
    const align = (text: string, window?: { start: number; duration: number }) =>
      services.invoke<Heard>('transcribe/align', [voiceover.audioUrl, text, voiceover.language, { model: params.model, ...(window ? { window } : {}) }, signal]);
    let words: Word[];
    // A recording brought in says `und`: nobody has listened to it yet. What the model heard becomes its language.
    let language = voiceover.language;
    let note = '';
    const segments = voiceover.segments ?? [];
    if (script && script.segments?.length && script.segments.length === segments.length && segments.length > 1) {
      // A voice of several segments, each with its own text: aligned one at a time, so the aligner
      // losing its place in a short choppy line cannot pile the words of the next scenes on top of it.
      // A segment whose timings still collapse is spread over its own stretch instead.
      words = [];
      let spread = 0;
      for (const [i, segment] of segments.entries()) {
        const text = script.segments[i]!;
        const heard = await align(text, { start: segment.start, duration: segment.durationSeconds }).catch(() => ({ words: [] as Word[] }));
        let timed = retime(text, heard.words);
        const span = timed.length ? timed[timed.length - 1]!.end - timed[0]!.start : 0;
        if (!timed.length || span < 0.4 * segment.durationSeconds) {
          timed = evenly(text, segment.start + 0.15, segment.start + segment.durationSeconds - 0.15);
          spread++;
        }
        words.push(...timed);
      }
      note = `${words.length} words aligned with ${params.model}, segment by segment${spread ? ` (${spread} spread evenly)` : ''}`;
    } else {
      const heard = await align(script?.text ?? '');
      // With a script, the narration's own words on the model's clock, so the text cannot come back
      // misspelled. Without one, what the model heard is all anybody has.
      words = script ? retime(script.text, heard.words) : heard.words;
      if (heard.language) language = heard.language;
      note = script
        ? `${words.length} words aligned with ${params.model}${heard.words.length !== words.length ? ` (aligner heard ${heard.words.length}, retimed by position)` : ''}`
        : `${words.length} words transcribed with ${params.model} · ${language === voiceover.language ? 'no script wired in' : `heard in ${language}`}`;
    }
    if (!words.length)
      throw new NodeError(TranscribeErrorCode.TRANSCRIBE_NO_WORDS, script ? 'the aligner returned no words' : 'the model heard no words in this recording').withFix(
        'check the recording has speech, and that its language matches the one set on the node that made it',
      );
    log('info', note);
    return cut({ ...voiceover, words, language }, params.maxChars, log);
  },
};

/** The words of a text spread over a stretch of time, longer words taking longer: what to say when the aligner cannot. */
function evenly(text: string, from: number, to: number): import('@/contracts/types/payloads').Word[] {
  const said = text.trim().split(/\s+/).filter(Boolean);
  const weights = said.map((w) => Math.max(1, w.length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = from;
  return said.map((word, i) => {
    const start = cursor;
    cursor += (weights[i]! / total) * Math.max(0.2, to - from);
    return { text: word, start: Math.round(start * 1000) / 1000, end: Math.round(cursor * 1000) / 1000 };
  });
}

/** The voice as it goes on, and the lines drawn from it. Pure; the words are already decided. */
function cut(voiceover: Voiceover, maxChars: number, log: (level: 'info', message: string) => void) {
  const captions = buildCaptionTrack(voiceover.words ?? [], { maxChars });
  log('info', `${captions.cues.length} caption line${captions.cues.length === 1 ? '' : 's'} · ≤${maxChars} chars`);
  return { voiceover, captions };
}
