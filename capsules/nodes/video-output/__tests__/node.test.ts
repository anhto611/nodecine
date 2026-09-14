import { describe, expect, it } from 'vitest';
import { videoOutput } from '../node';
import { readCapability } from '@/core/nodes/definition';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import { SCENE_SOURCE, STYLE } from '@/contracts/__tests__/scene-fixtures';
import type { VideoIR } from '@/contracts/types/ir';

const ir: VideoIR = {
  irVersion: 3,
  meta: { title: 'T', language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 300 },
  style: STYLE,
  vars: {},
  tracks: [{ id: 'scenes', clips: [{ id: 'scene-1', kind: 'code', startFrame: 0, durationInFrames: 300, format: 'html-gsap', source: SCENE_SOURCE }] }],
  beats: [{ index: 0, startFrame: 0, durationInFrames: 300, clipId: 'scene-1' }],
  audio: [],
  transitions: { default: { name: 'fade', seconds: 0.4 } },
};

/**
 * What the player node hands back to the card.
 *
 * The card mounts the engine's player only when the engine says preview is ready, and the only
 * place it can read that is this node's result. It used to be the engine's ref, which carried the
 * capabilities; when the engine became a parameter the node started returning a summary instead,
 * and every finished run showed "preview is not available on this engine" over a film the engine
 * was perfectly able to play. The result is the ref, and this is the test that says so.
 */
describe('the player node’s result', () => {
  const run = async () => {
    const services = makeFakeServices();
    return (await videoOutput.run({
      params: { engineId: 'hyperframes', engineSettings: {} },
      inputs: { ir: { type: 'VideoIR', payload: ir } },
      lists: {},
      services,
      signal: new AbortController().signal,
      log: () => {},
      progress: () => {},
    } as never)) as Record<string, unknown>;
  };

  it('carries the engine’s capabilities, so the card can mount the player', async () => {
    expect(readCapability(await run(), 'preview')?.status).toBe('ready');
  });

  it('still names the engine and the length of the film', async () => {
    const result = await run();
    expect(result.engineId).toBe('hyperframes');
    expect(result.totalFrames).toBe(ir.meta.totalDurationInFrames);
  });
});
