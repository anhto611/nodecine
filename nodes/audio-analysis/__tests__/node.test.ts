import { describe, expect, it } from 'vitest';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import type { RunContext } from '@/core/nodes/definition';
import type { AudioTrackSpec } from '@/contracts/types/payloads';
import { audioAnalysis } from '../node';

const track: AudioTrackSpec = { url: '/api/media/' + 'a'.repeat(16) + '.mp3', durationSeconds: 30, role: 'music', gain: 0.2, startSeconds: 0, loop: true };

describe('the Audio Analysis node', () => {
  it('hands the track on with the analysis beside it, asking the server once per file and rate', async () => {
    const services = makeFakeServices();
    const c = { nodeId: 'an', params: { fps: 30 }, inputs: { track: { payload: track } }, lists: {}, signal: new AbortController().signal, services, log: () => {}, progress: () => {}, patchParams: () => {} } as unknown as RunContext<{ fps: number }>;
    const out = (await audioAnalysis.run(c)).track as AudioTrackSpec;
    expect(services.calls.find((x) => x.name === 'audio-analysis/analyze')!.args.slice(0, 2)).toEqual([track.url, 30]);
    expect(out).toEqual({ ...track, analysisUrl: expect.stringMatching(/^\/api\/media\/[a-f0-9]{16}\.json$/), beatSeconds: [0.5, 1, 1.5, 2] });
  });
});
