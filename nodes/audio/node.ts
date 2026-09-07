import { z } from 'zod';
import { ErrorCode } from '@/core/errors';
import type { Voiceover } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import { OUTPUT_LANGUAGES } from '@/core/text/languages';

/** Every output language but `auto`: nothing here listens to the file to work it out. */
const LANGUAGES = OUTPUT_LANGUAGES.filter((l) => l !== 'auto') as [string, ...string[]];

const Params = z.object({
  /** A file name in this machine's music folder; empty means no music. */
  track: z.string().max(120).default(''),
  volume: z.number().min(0).max(1).default(0.16),
  duck: z.number().min(0).max(1).default(0.7),
  fadeInSeconds: z.number().min(0).max(10).default(1),
  fadeOutSeconds: z.number().min(0).max(10).default(2),
});

export const AUDIO_MIX = 'core/audio-mix';

/**
 * CORE_CONTRACTS §5.15 — Voiceover → Voiceover, with music under the voice.
 *
 * The mix is exactly as long as the voice, so the timings everything downstream depends on — the
 * scene segments, the aligned words — come through untouched. No track chosen is not an error: the
 * voice passes through, which is what a template that ships without music does on someone else's
 * machine, where the folder is empty.
 */
export const audioMix: NodeDefinition<typeof Params> = {
  type: AUDIO_MIX,
  version: 1,
  kind: 'process',
  inputs: [{ name: 'voiceover', type: 'Voiceover' }],
  outputs: [{ name: 'voiceover', type: 'Voiceover' }],
  paramsSchema: Params,
  defaultParams: { track: '', volume: 0.16, duck: 0.7, fadeInSeconds: 1, fadeOutSeconds: 2 },
  run: async ({ params, inputs, services, signal, log }) => {
    const voiceover = inputs.voiceover!.payload as Voiceover;
    if (!params.track.trim()) {
      log('info', 'no music chosen; the voice passes through');
      return { voiceover };
    }
    const mixed = await services.mixAudio(voiceover.audioUrl, { ...params, track: params.track.trim() }, signal);
    log('info', `${params.track} under the voice at ${Math.round(params.volume * 100)}%, ducking ${Math.round(params.duck * 100)}%`);
    // Only the file changes: the words and the scene segments are still on the voice's own clock.
    return { voiceover: { ...voiceover, audioUrl: mixed.audioUrl, durationSeconds: mixed.durationSeconds } };
  },
};

const InputParams = z.object({
  /** A file name in this machine's voice folder; empty means nothing to bring in yet. */
  file: z.string().max(120).default(''),
  /** What is spoken in it. `auto` is not offered: nothing here reads the audio to find out. */
  language: z.enum(LANGUAGES).default('en'),
});

export const AUDIO_INPUT = 'core/audio-input';

/**
 * CORE_CONTRACTS §5.17 — a recording somebody already has → Voiceover.
 *
 * The other way into the pipeline. Until now only the TTS Engine could make a voice-over, so a
 * person with their own voice on disk had no way in at all. What comes out is the same payload the
 * TTS Engine emits, so Căn Mốc Từ, Nhạc Nền, Phụ Đề and the Assembler take it without knowing the
 * difference — but it carries no `segments`, so the Assembler cuts the scenes by weight.
 */
export const audioInput: NodeDefinition<typeof InputParams> = {
  type: AUDIO_INPUT,
  version: 1,
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'voiceover', type: 'Voiceover' }],
  paramsSchema: InputParams,
  defaultParams: { file: '', language: 'en' },
  validate: (params) => (params.file.trim() ? [] : [{ code: ErrorCode.INPUT_EMPTY, message: 'choose a recording' }]),
  run: async ({ params, services, signal, log }) => {
    const file = params.file.trim();
    const { audioUrl, durationSeconds } = await services.importAudio(file, signal);
    log('info', `${file} · ${durationSeconds.toFixed(2)}s · ${params.language}`);
    // No `segments`: one file, one take. The Assembler falls back to the scene weights.
    return { voiceover: { audioUrl, durationSeconds, voiceName: file, language: params.language, speed: 1 } };
  },
};
