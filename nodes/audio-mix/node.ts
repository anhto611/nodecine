import { z } from 'zod';
import type { AudioTrackSpec, Voiceover } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';
import type { MixResult } from './types';

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
 * CORE_CONTRACTS §5.15 — music under the voice, two ways out.
 *
 * `voiceover`: the mix, exactly as long as the voice, so the timings everything downstream depends
 * on — the scene segments, the aligned words — come through untouched. `track`: the same music as
 * an audio track of its own, for the assembler's `audio` port; the engines play it beside the voice
 * and draw the fades, and the film can have music with no voice at all. Ducking rides the mix today
 * and is data on the track (docs/IR_V3.md §5.3). No track chosen is not an error: the voice passes
 * through, which is what a template that ships without music does on someone else's machine.
 */
export const audioMix: NodeDefinition<typeof Params> = {
  type: AUDIO_MIX,
  // 2: the voice is optional and the music also goes out as a track of its own.
  version: 2,
  kind: 'process',
  inputs: [{ name: 'voiceover', type: 'Voiceover', required: false }],
  outputs: [
    { name: 'voiceover', type: 'Voiceover' },
    { name: 'track', type: 'AudioTrackSpec' },
  ],
  paramsSchema: Params,
  defaultParams: { track: '', volume: 0.16, duck: 0.7, fadeInSeconds: 1, fadeOutSeconds: 2 },
  run: async ({ params, inputs, services, signal, log }) => {
    const voiceover = inputs.voiceover?.payload as Voiceover | undefined;
    const name = params.track.trim();
    if (!name) {
      log('info', voiceover ? 'no music chosen; the voice passes through' : 'no music chosen');
      return voiceover ? { voiceover } : {};
    }
    const file = await services.invoke<MixResult>('audio-mix/import', [name, signal]);
    const track: AudioTrackSpec = {
      url: file.audioUrl,
      durationSeconds: file.durationSeconds,
      role: 'music',
      gain: params.volume,
      startSeconds: 0,
      loop: true,
      fadeInSeconds: params.fadeInSeconds,
      fadeOutSeconds: params.fadeOutSeconds,
      // `duck` is how far the voice pushes the bed down; the track says where it lands.
      ...(params.duck > 0 ? { duckTo: Number((params.volume * (1 - params.duck)).toFixed(3)) } : {}),
    };
    if (!voiceover) {
      log('info', `${name} as a track at ${Math.round(params.volume * 100)}%; no voice to mix under`);
      return { track };
    }
    const mixed = await services.invoke<MixResult>('audio-mix/mix', [voiceover.audioUrl, { ...params, track: name }, signal]);
    log('info', `${name} under the voice at ${Math.round(params.volume * 100)}%, ducking ${Math.round(params.duck * 100)}%`);
    // Only the file changes: the words and the scene segments are still on the voice's own clock.
    return { voiceover: { ...voiceover, audioUrl: mixed.audioUrl, durationSeconds: mixed.durationSeconds }, track };
  },
};
