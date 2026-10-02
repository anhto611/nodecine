import { describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/contracts/errors';
import { ttsEngine, UPSTREAM_RETRY_WAITS } from '../node';

const ref = {
  providerId: 'fake',
  displayName: 'Fake',
  settings: {},
  capabilities: { installed: { status: 'ready' }, encoder: { status: 'ready' } },
  voices: [{ id: 'v-vi', displayName: 'Vi', language: 'vi' }],
};

const upstream = (message: string) => Object.assign(new Error(message), { code: ErrorCode.TTS_UPSTREAM });

/** A node run whose voice service answers with the given outcomes, one per call. */
function setup(outcomes: unknown[], script: { text: string; language: string; segments?: string[] }) {
  const tries: string[] = [];
  const logs: string[] = [];
  const services = {
    probeTTS: async () => ref,
    synthesize: async (_ref: unknown, text: string) => {
      tries.push(text);
      const next = outcomes.shift();
      if (next instanceof Error) throw next;
      return next ?? { audioUrl: `/api/media/${tries.length}.mp3`, durationSeconds: 1, voiceName: 'v-vi', language: 'vi' };
    },
    concatAudio: async (parts: { durationSeconds: number }[], gap: number) => ({
      audioUrl: '/api/media/joined.mp3',
      durationSeconds: parts.length * (1 + gap),
      segments: parts.map((_, i) => ({ start: i * (1 + gap), durationSeconds: 1 })),
    }),
  };
  const run = () =>
    ttsEngine.run({
      nodeId: 'tts',
      params: ttsEngine.paramsSchema.parse({ ttsProvider: 'fake' }),
      lists: {},
      signal: new AbortController().signal,
      inputs: { script: { type: 'AudioScript', payload: script } },
      services,
      fresh: false,
      log: (_: string, m: string) => logs.push(m),
      progress: () => {},
      patchParams: () => {},
    } as never) as Promise<{ voiceover: { durationSeconds: number } }>;
  return { tries, logs, run };
}

describe('the Voiceover node when the service falters', () => {
  it('asks a gateway that timed out again, and gets the narration in the end', async () => {
    vi.useFakeTimers();
    try {
      const { tries, logs, run } = setup([upstream('Vbee HTTP 504 Gateway Timeout'), upstream('Vbee HTTP 504 Gateway Timeout')], {
        text: 'Một hai ba.',
        language: 'vi',
        segments: ['Một hai.', 'Ba bốn.'],
      });
      const done = run();
      await vi.runAllTimersAsync();
      await done;
      expect(tries).toEqual(['Một hai.', 'Một hai.', 'Một hai.', 'Ba bốn.']);
      expect(logs.some((m) => m.includes('504') && m.includes('trying again'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries a script that is one piece too', async () => {
    vi.useFakeTimers();
    try {
      const { tries, run } = setup([upstream('Vbee HTTP 502')], { text: 'Một câu thôi.', language: 'vi' });
      const done = run();
      await vi.runAllTimersAsync();
      await done;
      expect(tries).toEqual(['Một câu thôi.', 'Một câu thôi.']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up after the last wait, and never retries an error that will not change', async () => {
    vi.useFakeTimers();
    try {
      const always = setup(UPSTREAM_RETRY_WAITS.map(() => upstream('Vbee HTTP 504')).concat([upstream('Vbee HTTP 504')]), { text: 'Một câu.', language: 'vi' });
      // The expectation is attached before the clock moves, so the rejection is never unhandled.
      const failing = expect(always.run()).rejects.toThrow('504');
      await vi.runAllTimersAsync();
      await failing;
      expect(always.tries).toHaveLength(UPSTREAM_RETRY_WAITS.length + 1);

      const bad = setup([Object.assign(new Error('Vbee rejected the token'), { code: ErrorCode.KEY_INVALID })], { text: 'Một câu.', language: 'vi' });
      const rejected = expect(bad.run()).rejects.toThrow('rejected the token');
      await vi.runAllTimersAsync();
      await rejected;
      expect(bad.tries).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
