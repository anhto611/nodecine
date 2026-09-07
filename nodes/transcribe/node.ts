import { z } from 'zod';
import type { AudioScript, Voiceover } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { retime } from '@/nodes/captions/cues';

export const ALIGN_MODELS = ['small', 'medium', 'large-v3'] as const;

const Params = z.object({
  model: z.enum(ALIGN_MODELS).default('small'),
});

/**
 * CORE_CONTRACTS §5.12 — Voiceover + AudioScript → Voiceover with word timings.
 *
 * Alignment, not transcription: the text is known, so the aligner only has to say when each word
 * is spoken. A voice-over that already carries words (a provider that returns them) passes through
 * untouched, so wiring this node in costs nothing there.
 */
export const transcribe: NodeDefinition<typeof Params> = {
  type: 'core/transcribe',
  version: 1,
  kind: 'process',
  inputs: [
    { name: 'voiceover', type: 'Voiceover' },
    { name: 'script', type: 'AudioScript' },
  ],
  outputs: [{ name: 'voiceover', type: 'Voiceover' }],
  paramsSchema: Params,
  defaultParams: { model: 'small' },
  run: async ({ params, inputs, services, signal, log }) => {
    const voiceover = inputs.voiceover!.payload as Voiceover;
    const script = inputs.script!.payload as AudioScript;
    if (voiceover.words?.length) {
      log('info', `${voiceover.words.length} words already timed by the provider`);
      return { voiceover };
    }
    const heard = await services.alignWords(voiceover.audioUrl, script.text, voiceover.language, { model: params.model }, signal);
    // The narration's own words on the aligner's clock: the text can never come back misspelled.
    const words = retime(script.text, heard);
    log('info', `${words.length} words aligned with ${params.model}${heard.length !== words.length ? ` (aligner heard ${heard.length}, retimed by position)` : ''}`);
    return { voiceover: { ...voiceover, words } };
  },
};
