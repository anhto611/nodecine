import { z } from 'zod';
import { ErrorCode } from '../errors';
import type { AudioScript, TTSRef, Voice } from '../types/payloads';
import type { NodeDefinition } from './definition';

const Params = z.object({
  voice: z.string().optional(),
  speed: z.number().min(0.5).max(2).default(1),
});

/** Voice selection rule (CORE_CONTRACTS §8.2). Returns the voice and whether it is a fallback. */
export function pickVoice(ref: TTSRef, language: string, preferred?: string): { voice: Voice; fallback: boolean } {
  const lang = language.toLowerCase();
  const matches = (v: Voice) => v.language.toLowerCase() === lang || v.language.toLowerCase().startsWith(lang + '-');
  const chosen = preferred ? ref.voices.find((v) => v.id === preferred && matches(v)) : undefined;
  if (chosen) return { voice: chosen, fallback: false };
  const first = ref.voices.find(matches);
  if (first) return { voice: first, fallback: false };
  const def = ref.voices.find((v) => v.id === ref.settings.defaultVoice) ?? ref.voices[0];
  if (!def) throw new Error('TTS provider reports no voices');
  return { voice: def, fallback: true };
}

/** CORE_CONTRACTS §5.3 — AudioScript + TTSRef → Voiceover. */
export const ttsEngine: NodeDefinition<typeof Params> = {
  type: 'core/tts-engine',
  version: 1,
  namespace: 'core',
  kind: 'process',
  inputs: [
    { name: 'script', type: 'AudioScript' },
    { name: 'tts', type: 'TTSRef', requires: ['installed', 'encoder'] },
  ],
  outputs: [{ name: 'voiceover', type: 'Voiceover' }],
  paramsSchema: Params,
  defaultParams: { speed: 1 },
  run: async ({ params, inputs, services, signal, log }) => {
    const script = inputs.script!.payload as AudioScript;
    const ref = inputs.tts!.payload as TTSRef;
    const { voice, fallback } = pickVoice(ref, script.language, params.voice);
    if (fallback) {
      log('warn', `no voice for "${script.language}", using fallback "${voice.displayName}"`, ErrorCode.TTS_VOICE_LANGUAGE_MISMATCH);
    }
    log('info', `voice=${voice.id} speed=${params.speed}`);
    const voiceover = await services.synthesize(ref, script.text, voice, params.speed, signal);
    return { voiceover };
  },
};
