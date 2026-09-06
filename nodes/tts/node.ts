import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import type { AudioScript, TTSRef, Voice } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({
  voice: z.string().optional(),
  speed: z.number().min(0.5).max(2).default(1),
});

/** Voice selection rule (CORE_CONTRACTS §8.2). Returns the voice and whether it is a fallback. Exported for the body. */
export const voiceSpeaks = (v: Voice, language: string): boolean => v.language === 'mul' || v.language.toLowerCase() === language.toLowerCase() || v.language.toLowerCase().startsWith(language.toLowerCase() + '-');

export function pickVoice(ref: TTSRef, language: string, preferred?: string): { voice: Voice; fallback: boolean } {
  const lang = language.toLowerCase();
  // `mul` (BCP 47: multiple languages) is a voice that speaks whatever the script is in, like ElevenLabs'.
  const matches = (v: Voice) => voiceSpeaks(v, lang);
  // An explicit choice is the user's to make: it is honoured even across languages, with a warning.
  const chosen = preferred ? ref.voices.find((v) => v.id === preferred) : undefined;
  if (chosen) return { voice: chosen, fallback: !matches(chosen) };
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
