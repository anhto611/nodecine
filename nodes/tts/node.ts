import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import { TtsErrorCode } from './errors';
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

/** Silence after each scene's narration: the breath between two thoughts, and the frame the cut lands on. */
export const SCENE_GAP_SECONDS = 0.35;

/**
 * CORE_CONTRACTS §5.3 — AudioScript + TTSRef → Voiceover. A script that comes scene by scene is
 * voiced scene by scene and joined, so the assembler can cut where the speech does; a script that
 * is one text is voiced as one.
 */
export const ttsEngine: NodeDefinition<typeof Params> = {
  type: 'core/tts-engine',
  version: 1,
  kind: 'process',
  inputs: [
    { name: 'script', type: 'AudioScript' },
    { name: 'tts', type: 'TTSRef', requires: ['installed', 'encoder'] },
  ],
  outputs: [{ name: 'voiceover', type: 'Voiceover' }],
  paramsSchema: Params,
  defaultParams: { speed: 1 },
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const script = inputs.script!.payload as AudioScript;
    const ref = inputs.tts!.payload as TTSRef;
    const { voice, fallback } = pickVoice(ref, script.language, params.voice);
    if (fallback) {
      log('warn', `no voice for "${script.language}", using fallback "${voice.displayName}"`, TtsErrorCode.TTS_VOICE_LANGUAGE_MISMATCH);
    }
    log('info', `voice=${voice.id} speed=${params.speed}`);
    const segments = script.segments?.filter((s) => s.trim()) ?? [];
    if (segments.length < 2) {
      const voiceover = await services.synthesize(ref, script.text, voice, params.speed, signal);
      return { voiceover: segments.length === 1 ? { ...voiceover, segments: [{ start: 0, durationSeconds: voiceover.durationSeconds }] } : voiceover };
    }
    const parts = [];
    for (const [i, text] of segments.entries()) {
      progress(i / segments.length, `${i + 1}/${segments.length}`);
      try {
        parts.push(await services.synthesize(ref, text, voice, params.speed, signal));
      } catch (e) {
        // A provider that fails one segment upstream (a gateway timeout, a dropped connection) gets one more try.
        if ((e as { code?: string }).code !== ErrorCode.TTS_UPSTREAM || signal.aborted) throw e;
        log('warn', `segment ${i + 1}: ${e instanceof Error ? e.message.slice(0, 120) : String(e)} · retrying once`);
        await new Promise((r) => setTimeout(r, 2000));
        parts.push(await services.synthesize(ref, text, voice, params.speed, signal));
      }
    }
    const joined = await services.concatAudio(parts.map((p) => ({ audioUrl: p.audioUrl, durationSeconds: p.durationSeconds })), SCENE_GAP_SECONDS, signal);
    log('info', `${segments.length} segments · ${joined.durationSeconds.toFixed(2)}s`);
    const first = parts[0]!;
    // A provider that timed the words of each part timed the whole: shift each part's words to where it starts.
    const words = parts.every((p) => p.words?.length) ? parts.flatMap((p, i) => p.words!.map((w) => ({ text: w.text, start: Math.round((w.start + joined.segments[i]!.start) * 1000) / 1000, end: Math.round((w.end + joined.segments[i]!.start) * 1000) / 1000 }))) : undefined;
    return { voiceover: { audioUrl: joined.audioUrl, durationSeconds: joined.durationSeconds, voiceName: first.voiceName, language: first.language, speed: params.speed, segments: joined.segments, ...(words ? { words } : {}) } };
  },
};
