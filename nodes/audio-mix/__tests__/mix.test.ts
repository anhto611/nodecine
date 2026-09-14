import { describe, expect, it } from 'vitest';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import type { RunContext } from '@/core/nodes/definition';
import type { Voiceover } from '@/contracts/types/payloads';
import { audioMix } from '../node';
import { mixFilter } from '../server';

const voiceover: Voiceover = {
  audioUrl: '/api/media/aaaaaaaaaaaaaaaa.mp3',
  durationSeconds: 60,
  voiceName: 'linh',
  language: 'vi-VN',
  speed: 1,
  words: [{ text: 'Xin', start: 0, end: 0.2 }],
  segments: [{ start: 0, durationSeconds: 30 }, { start: 30, durationSeconds: 30 }],
};

function ctx(params: Partial<Parameters<typeof audioMix.run>[0]['params']> = {}) {
  const services = makeFakeServices();
  const logs: string[] = [];
  const c = {
    nodeId: 'mix',
    params: { ...audioMix.defaultParams, ...params },
    inputs: { voiceover: { payload: voiceover } },
    lists: {},
    signal: new AbortController().signal,
    services,
    log: (_l: string, m: string) => logs.push(m),
    progress: () => {},
    patchParams: () => {},
  } as unknown as RunContext<typeof audioMix.defaultParams>;
  return { c, services, logs };
}

describe('the Music Bed node', () => {
  it('passes the voice through untouched when no track is chosen', async () => {
    const { c, services } = ctx({ track: '' });
    const out = await audioMix.run(c);
    expect(out.voiceover).toBe(voiceover);
    expect(services.calls.some((x) => x.name === 'audio-mix/mix')).toBe(false);
  });

  it('keeps the words and the scene segments, and takes the mix its own measured length', async () => {
    const { c, services } = ctx({ track: 'bed.mp3', volume: 0.2 });
    const out = (await audioMix.run(c)).voiceover as Voiceover;
    expect(services.calls.find((x) => x.name === 'audio-mix/mix')!.args[1]).toMatchObject({ track: 'bed.mp3', volume: 0.2 });
    expect(out.audioUrl).not.toBe(voiceover.audioUrl);
    expect(out.durationSeconds).toBe(63.18);
    expect(out.words).toEqual(voiceover.words);
    expect(out.segments).toEqual(voiceover.segments);
  });
});

describe('the ffmpeg recipe', () => {
  const opts = { track: 'bed.mp3', volume: 0.16, duck: 0.7, fadeInSeconds: 1, fadeOutSeconds: 2 };

  it('loops the bed to the voice, fades both ends and ends with the voice', () => {
    const f = mixFilter(60, opts);
    expect(f).toContain('aloop=loop=-1');
    expect(f).toContain('atrim=0:60.000');
    expect(f).toContain('afade=t=in:st=0:d=1.00');
    expect(f).toContain('afade=t=out:st=58.000:d=2.00');
    expect(f).toContain('duration=first');
    expect(f).toContain('normalize=0');
    expect(f).toContain('sidechaincompress');
  });

  it('leaves the sidechain out when nothing should duck', () => {
    expect(mixFilter(60, { ...opts, duck: 0 })).not.toContain('sidechaincompress');
  });

  it('never asks for fades longer than the voice', () => {
    const f = mixFilter(1.5, { ...opts, fadeInSeconds: 4, fadeOutSeconds: 4 });
    expect(f).toContain('afade=t=in:st=0:d=0.75');
    expect(f).toContain('afade=t=out:st=0.750:d=0.75');
  });
});

describe('the music as a track of its own', () => {
  it('goes out beside the mix, at the bed\'s level, looping, faded, ducking to where the voice would push it', async () => {
    const { c, services } = ctx({ track: 'calm.mp3', volume: 0.2, duck: 0.5 });
    const out = await audioMix.run(c);
    expect(services.calls.map((x) => x.name)).toEqual(['audio-mix/import', 'audio-mix/mix']);
    expect(out.track).toEqual({ url: expect.stringMatching(/^\/api\/media\/[a-f0-9]{16}\.mp3$/), durationSeconds: 184.2, role: 'music', gain: 0.2, startSeconds: 0, loop: true, fadeInSeconds: 1, fadeOutSeconds: 2, duckTo: 0.1 });
    expect((out.voiceover as Voiceover).durationSeconds).toBe(63.18);
  });

  it('is the only output when no voice is wired in, and ducks nowhere when duck is off', async () => {
    const { c, services } = ctx({ track: 'calm.mp3', duck: 0 });
    c.inputs = {};
    const out = await audioMix.run(c);
    expect(out.voiceover).toBeUndefined();
    expect(out.track).toMatchObject({ role: 'music', gain: 0.16 });
    expect((out.track as { duckTo?: number }).duckTo).toBeUndefined();
    expect(services.calls.map((x) => x.name)).toEqual(['audio-mix/import']);
  });

  it('emits nothing at all with no track and no voice', async () => {
    const { c } = ctx();
    c.inputs = {};
    expect(await audioMix.run(c)).toEqual({});
  });
});
