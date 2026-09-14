import { describe, expect, it } from 'vitest';
import { fill, FILLED } from '../node';
import { makeFakeServices } from '@/contracts/__tests__/fakes';
import type { Composition } from '@/contracts/types/composition';
import type { CaptionTrack, Voiceover } from '@/contracts/types/payloads';

const composition: Composition = {
  engine: 'hyperframes', width: 1080, height: 1920, fps: 30,
  files: { 'index.html': '<html></html>' }, media: {},
  variables: [
    { id: 'title', type: 'string', default: 'Hello' },
    { id: 'accent', type: 'color', default: '#ff0000' },
    { id: FILLED.voiceoverSeconds, type: 'number', default: 5 },
    { id: FILLED.voiceover, type: 'string', default: '' },
    { id: 'shot', type: 'image', default: '' },
  ],
  values: {},
};
const voice: Voiceover = {
  audioUrl: '/api/media/0123456789abcdef.mp3', durationSeconds: 7.5, voiceName: 'samantha', language: 'en-US', speed: 1,
  words: [{ text: 'Hi', start: 0, end: 0.4 }],
  segments: [{ start: 0, durationSeconds: 3 }, { start: 3, durationSeconds: 4.5 }],
};
const captions: CaptionTrack = { cues: [{ start: 0, end: 0.4, words: [{ text: 'Hi', start: 0, end: 0.4 }] }] };

const run = (values: Record<string, unknown>, extra: Record<string, unknown> = {}) => fill.run({
  params: { values },
  inputs: { composition: { type: 'Composition', payload: composition }, ...extra },
  lists: {}, services: makeFakeServices(), signal: new AbortController().signal, log: () => {}, progress: () => {},
} as never) as Promise<{ composition: Composition }>;

/** What the Fill node pours into a composition, and what it refuses to. */
describe('the Fill node', () => {
  it('sets values for declared variables and leaves the files alone when nothing else is wired', async () => {
    const { composition: out } = await run({ title: 'NodeCine' });
    expect(out.values).toEqual({ title: 'NodeCine' });
    expect(out.files).toEqual(composition.files);
    expect(out.media).toEqual({});
  });

  it('puts the voice-over beside the composition, with its length and its words, and the caption lines as JSON', async () => {
    const { composition: out } = await run({}, {
      voiceover: { type: 'Voiceover', payload: voice },
      captions: { type: 'CaptionTrack', payload: captions },
    });
    expect(out.media['voiceover.mp3']).toBe(voice.audioUrl);
    expect(out.values[FILLED.voiceover]).toBe('voiceover.mp3');
    expect(out.values[FILLED.voiceoverSeconds]).toBe(7.5);
    expect(JSON.parse(out.files[FILLED.timing]!)).toEqual({ durationSeconds: 7.5, segments: voice.segments, words: voice.words });
    expect(JSON.parse(out.files[FILLED.captions]!)).toEqual(captions.cues);
  });

  it('copies an uploaded picture into the project and points its variable there', async () => {
    const { composition: out } = await run({ shot: '/api/assets/0123456789abcdef0123.png' });
    expect(out.values.shot).toBe('images/shot.png');
    expect(out.media['images/shot.png']).toBe('/api/assets/0123456789abcdef0123.png');
  });

  it('leaves the voice-over variable unset without a voice, so the composition renders silent', async () => {
    const { composition: out } = await run({});
    expect(out.values[FILLED.voiceover]).toBeUndefined();
    expect(out.files[FILLED.timing]).toBeUndefined();
  });

  it('refuses a value for a variable the composition does not declare, or of the wrong type', async () => {
    await expect(run({ subtitle: 'x' })).rejects.toMatchObject({ code: 'VARIABLE_UNDECLARED' });
    await expect(run({ accent: 12 })).rejects.toMatchObject({ code: 'VARIABLE_WRONG_TYPE' });
  });
});
