import { describe, expect, it } from 'vitest';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import type { RunContext } from '@/core/nodes/definition';
import type { Voiceover } from '@/contracts/types/payloads';
import { audioInput } from '../node';

function ctx(file: string) {
  const services = makeFakeServices();
  const c = {
    nodeId: 'in', params: { file, language: 'vi' }, inputs: {}, lists: {},
    signal: new AbortController().signal, services, log: () => {}, progress: () => {}, patchParams: () => {},
  } as unknown as RunContext<{ file: string; language: string }>;
  return { c, services };
}

describe('the Audio Input node', () => {
  it('emits the same payload shape the TTS Engine does, named after the recording', async () => {
    const { c, services } = ctx('take 3.wav');
    const vo = (await audioInput.run(c)).voiceover as Voiceover;
    expect(services.calls.find((x) => x.name === 'audio-input/import')!.args[0]).toBe('take 3.wav');
    expect(vo).toEqual({ audioUrl: expect.stringMatching(/^\/api\/media\/[a-f0-9]{16}\.mp3$/), durationSeconds: 42.5, voiceName: 'take 3.wav', language: 'vi', speed: 1 });
  });

  it('carries no segments, so the Assembler falls back to the scene weights', async () => {
    const { c } = ctx('take 3.wav');
    expect((await audioInput.run(c)).voiceover).not.toHaveProperty('segments');
  });

  it('says so plainly while no recording is chosen', () => {
    expect(audioInput.validate!({ file: '  ', language: 'en' })).toHaveLength(1);
    expect(audioInput.validate!({ file: 'a.mp3', language: 'en' })).toEqual([]);
  });
});

describe('the recording as an ambient track', () => {
  it('goes out on the track port too, the same file at full level, one shot from the start of the film', async () => {
    const { c } = ctx('rain.wav');
    const out = await audioInput.run(c);
    const vo = out.voiceover as Voiceover;
    expect(out.track).toEqual({ url: vo.audioUrl, durationSeconds: 42.5, role: 'ambient', gain: 1, startSeconds: 0 });
  });
});
