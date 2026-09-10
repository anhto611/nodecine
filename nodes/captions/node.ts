import { z } from 'zod';
import type { Voiceover } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { ErrorCode } from '@/core/errors';
import { buildCaptionTrack } from '@/core/captions/cues';

const Params = z.object({
  /** Characters a line may hold: a measurement of the caption band the scenes draw, so it lives here, not there. */
  maxChars: z.number().int().min(8).max(80).default(26),
});

/**
 * CORE_CONTRACTS §5.13 — Voiceover with words → CaptionTrack. Pure.
 *
 * Only what is said and when. Where the lines sit, in which font, which colour the spoken word
 * turns: that is the scene's, declared on its `data-slot="captions"` element, or the style sheet's default band.
 */
export const captions: NodeDefinition<typeof Params> = {
  type: 'core/captions',
  version: 1,
  kind: 'process',
  inputs: [{ name: 'voiceover', type: 'Voiceover' }],
  outputs: [{ name: 'captions', type: 'CaptionTrack' }],
  paramsSchema: Params,
  defaultParams: { maxChars: 26 },
  run: async ({ params, inputs, log }) => {
    const voiceover = inputs.voiceover!.payload as Voiceover;
    if (!voiceover.words?.length) {
      throw Object.assign(new Error('the voice-over carries no word timings'), { code: ErrorCode.CAPTIONS_NO_WORDS, fix: 'wire the voice-over through a Transcribe node first' });
    }
    const track = buildCaptionTrack(voiceover.words, params);
    log('info', `${track.cues.length} lines from ${voiceover.words.length} words · ≤${params.maxChars} chars`);
    return { captions: track };
  },
};
