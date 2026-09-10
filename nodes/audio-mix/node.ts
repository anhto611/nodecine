import { z } from 'zod';
import type { Voiceover } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';

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
