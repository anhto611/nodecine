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
 * CORE_CONTRACTS §5.12 — Voiceover (+ AudioScript) → the voice with word timings, and the captions.
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
  type: 'core/transcribe',
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
    const heard = await services.invoke<import('@/contracts/types/payloads').Word[]>('transcribe/align', [voiceover.audioUrl, script?.text ?? '', voiceover.language, { model: params.model }, signal]);
    // With a script, the narration's own words on the model's clock, so the text cannot come back
    // misspelled. Without one, what the model heard is all anybody has.
    const words = script ? retime(script.text, heard) : heard;
    if (!words.length) throw new NodeError(TranscribeErrorCode.TRANSCRIBE_NO_WORDS, script ? 'the aligner returned no words' : 'the model heard no words in this recording').withFix('check the recording has speech, and that its language matches the one set on the node that made it');
    log('info', script
      ? `${words.length} words aligned with ${params.model}${heard.length !== words.length ? ` (aligner heard ${heard.length}, retimed by position)` : ''}`
      : `${words.length} words transcribed with ${params.model} · no script wired in`);
    return cut({ ...voiceover, words }, params.maxChars, log);
  },
};

/** The voice as it goes on, and the lines drawn from it. Pure; the words are already decided. */
function cut(voiceover: Voiceover, maxChars: number, log: (level: 'info', message: string) => void) {
  const captions = buildCaptionTrack(voiceover.words ?? [], { maxChars });
  log('info', `${captions.cues.length} caption line${captions.cues.length === 1 ? '' : 's'} · ≤${maxChars} chars`);
  return { voiceover, captions };
}
