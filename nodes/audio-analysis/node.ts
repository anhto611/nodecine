import { z } from 'zod';
import type { NodeDefinition } from '@/core/nodes/definition';
import type { AudioTrackSpec } from '@/contracts/types/payloads';

const Params = z.object({
  /** The film's frame rate: one row of the analysis per frame. The Assembler's `fps` should match. */
  fps: z.number().int().positive().default(30),
});

export const AUDIO_ANALYSIS = 'core/audio-analysis';

/**
 * CORE_CONTRACTS §5.21 — AudioTrackSpec → the same track with `analysisUrl`: per-frame loudness and
 * three bands, measured from the file and written as JSON beside it. A scene reads them as
 * `nodecine.audio('<track id>')` and moves to the music; the engines inline the JSON into the page,
 * so a render never fetches. Analysing the same file at the same rate twice costs nothing.
 */
export const audioAnalysis: NodeDefinition<typeof Params> = {
  type: AUDIO_ANALYSIS,
  version: 1,
  kind: 'process',
  inputs: [{ name: 'track', type: 'AudioTrackSpec' }],
  outputs: [{ name: 'track', type: 'AudioTrackSpec' }],
  paramsSchema: Params,
  defaultParams: { fps: 30 },
  run: async ({ params, inputs, services, signal, log }) => {
    const track = inputs.track!.payload as AudioTrackSpec;
    const { analysisUrl, frames, beatSeconds } = await services.invoke<{ analysisUrl: string; frames: number; beatSeconds: number[] }>('audio-analysis/analyze', [track.url, params.fps, signal]);
    log('info', `${frames} frames at ${params.fps} fps · level, bass, mid, high · ${beatSeconds.length} beats`);
    return { track: { ...track, analysisUrl, ...(beatSeconds.length ? { beatSeconds } : {}) } };
  },
};
