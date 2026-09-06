import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createElevenlabsProvider, elevenlabsSpeed, parseElevenlabsVoices } from '../elevenlabs';
import { createVbeeProvider, describeVbeeError, parseVbeeVoices, vbeeSpeed } from '../vbee';
import { pickVoice } from '@/nodes/tts/node';
import type { TTSRef } from '@/core/types/payloads';
import type { ApiDeps } from '../api-shared';

/**
 * The hosted voices never touch the network here: fetch is a script of answers, and the file that
 * comes back is whatever bytes the script says. What is under test is the contract around the call —
 * where the key comes from, how a refusal is reported, and that the same line is not bought twice.
 */

const OLD = { ...process.env };
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-tts-'));
  process.env.NODECINE_TMP_DIR = dir;
  for (const k of ['ELEVENLABS_API_KEY', 'VBEE_TOKEN', 'VBEE_APP_ID']) delete process.env[k];
});
afterEach(async () => {
  process.env = { ...OLD };
  await rm(dir, { recursive: true, force: true });
});

type Call = { url: string; init?: RequestInit };
type FetchFn = typeof globalThis.fetch;
function fakeFetch(script: (call: Call, n: number) => Response | Promise<Response>): { fetch: FetchFn; calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    return script(call, calls.length);
  }) as FetchFn;
  return { fetch: f, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const bytes = (s: string) => new Response(Buffer.from(s), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
const deps = (fetch: FetchFn): ApiDeps => ({ fetch, timeoutMs: 1000, measure: async () => 1.25 });

describe('ElevenLabs', () => {
  it('lists voices as multilingual with the labels that tell them apart', () => {
    const voices = parseElevenlabsVoices({ voices: [
      { voice_id: 'v1', name: 'Rachel', labels: { accent: 'american', gender: 'female' } },
      { voice_id: 'v2', name: 'Bare' },
      { voice_id: '', name: 'broken' },
    ] });
    expect(voices).toEqual([
      { id: 'v1', displayName: 'Rachel · american · female', language: 'mul' },
      { id: 'v2', displayName: 'Bare', language: 'mul' },
    ]);
  });

  it('a multilingual voice matches any script language without a fallback warning', () => {
    const ref = { providerId: 'elevenlabs', displayName: 'ElevenLabs', transport: 'api', capabilities: { installed: { status: 'ready' }, encoder: { status: 'ready' } }, voices: parseElevenlabsVoices({ voices: [{ voice_id: 'v1', name: 'Rachel' }] }), settings: { rate: 1 } } as TTSRef;
    expect(pickVoice(ref, 'vi', undefined)).toEqual({ voice: ref.voices[0], fallback: false });
    expect(pickVoice(ref, 'en-US', 'v1')).toEqual({ voice: ref.voices[0], fallback: false });
  });

  it('keeps speed inside what the API accepts', () => {
    expect(elevenlabsSpeed(1, 1)).toBe(1);
    expect(elevenlabsSpeed(2, 1)).toBe(1.2);
    expect(elevenlabsSpeed(0.5, 1)).toBe(0.7);
  });

  it('reports a missing key as KEY_MISSING without calling out', async () => {
    const { fetch, calls } = fakeFetch(() => json({}));
    const r = await createElevenlabsProvider({}, deps(fetch)).probe();
    expect(r.capabilities.installed).toMatchObject({ status: 'unavailable', code: 'KEY_MISSING' });
    expect(calls).toHaveLength(0);
    await expect(createElevenlabsProvider({}, deps(fetch)).synthesize('hi', { id: 'v1', displayName: 'Rachel', language: 'mul' }, 1, new AbortController().signal)).rejects.toMatchObject({ code: 'KEY_MISSING' });
  });

  it('reports a rejected key as KEY_INVALID and sends the key as the xi-api-key header', async () => {
    process.env.ELEVENLABS_API_KEY = 'sk-old-name';
    const { fetch, calls } = fakeFetch(() => json({ detail: { status: 'invalid_api_key' } }, 401));
    const r = await createElevenlabsProvider({}, deps(fetch)).probe();
    expect(r.capabilities.installed).toMatchObject({ status: 'unavailable', code: 'KEY_INVALID' });
    expect((calls[0]!.init!.headers as Record<string, string>)['xi-api-key']).toBe('sk-old-name');
  });

  it('synthesizes to an mp3 in the tmp dir, sends the text in the body, and reuses the file', async () => {
    process.env.ELEVENLABS_API_KEY = 'sk-test';
    const { fetch, calls } = fakeFetch(() => bytes('ID3fake-mp3'));
    const p = createElevenlabsProvider({ model: 'eleven_flash_v2_5', rate: 1 }, deps(fetch));
    const voice = { id: 'v1', displayName: 'Rachel', language: 'mul' };
    const r = await p.synthesize('Xin chào các bạn', voice, 1, new AbortController().signal);
    expect(r.durationSeconds).toBe(1.25);
    expect(r.filePath.startsWith(dir)).toBe(true);
    expect(await readFile(r.filePath, 'utf8')).toBe('ID3fake-mp3');
    expect(calls[0]!.url).toContain('/text-to-speech/v1?');
    expect(calls[0]!.url).not.toContain('Xin');
    expect(JSON.parse(calls[0]!.init!.body as string)).toMatchObject({ text: 'Xin chào các bạn', model_id: 'eleven_flash_v2_5' });
    const again = await p.synthesize('Xin chào các bạn', voice, 1, new AbortController().signal);
    expect(again.filePath).toBe(r.filePath);
    expect(calls).toHaveLength(1);
  });

  it('turns an upstream failure into TTS_UPSTREAM', async () => {
    process.env.ELEVENLABS_API_KEY = 'sk-test';
    const { fetch } = fakeFetch(() => new Response('quota', { status: 429 }));
    await expect(createElevenlabsProvider({}, deps(fetch)).synthesize('hi', { id: 'v1', displayName: 'R', language: 'mul' }, 1, new AbortController().signal)).rejects.toMatchObject({ code: 'TTS_UPSTREAM' });
  });
});

describe('Vbee', () => {
  const catalogue = { status: 1, result: { voices: [
    { code: 'hn_male_minhquan_yt_24k-pre', name: 'Minh Quân Pro', gender: 'male', language_code: 'vi-VN', level: 'PREMIUM', active: true },
    { code: 'en_female_x', name: 'Emma', gender: 'female', language_code: 'en-US', level: 'BASIC', active: true },
    { code: 'hn_female_ngochuyen_full_48k-fhg', name: 'HN - Ngọc Huyền', gender: 'female', language_code: 'vi-VN', level: 'BASIC', active: true },
    { code: 'gone', name: 'Gone', active: false },
  ] } };

  it('lists Vietnamese first, basic before premium, and skips inactive voices', () => {
    expect(parseVbeeVoices(catalogue).map((v) => v.id)).toEqual(['hn_female_ngochuyen_full_48k-fhg', 'hn_male_minhquan_yt_24k-pre', 'en_female_x']);
    expect(parseVbeeVoices(catalogue)[0]).toEqual({ id: 'hn_female_ngochuyen_full_48k-fhg', displayName: 'HN - Ngọc Huyền · female · basic', language: 'vi-VN' });
  });

  it('formats speed the way the API wants it', () => {
    expect(vbeeSpeed(1, 1)).toBe('1.0');
    expect(vbeeSpeed(1.5, 1)).toBe('1.5');
    expect(vbeeSpeed(3, 1)).toBe('2.0');
  });

  it('needs both the token and the app id', async () => {
    process.env.VBEE_TOKEN = 'tok';
    const { fetch, calls } = fakeFetch(() => json(catalogue));
    expect((await createVbeeProvider({}, deps(fetch)).probe()).capabilities.installed).toMatchObject({ code: 'KEY_MISSING' });
    expect(calls).toHaveLength(0);
    process.env.VBEE_APP_ID = 'app';
    const r = await createVbeeProvider({}, deps(fetch)).probe();
    expect(r.capabilities.installed.status).toBe('ready');
    expect(r.voices).toHaveLength(3);
  });

  it('names a premium refusal for what it is', () => {
    expect(describeVbeeError(1045, 'hn_male_minhquan_yt_24k-pre', '')).toMatch(/Premium/);
    expect(describeVbeeError(1045, 'hn_female_x-fhg', '')).toMatch(/another voice/);
    expect(describeVbeeError(9, 'x', '{"a":1}')).toContain('error_code=9');
  });

  it('asks for a direct link, downloads it over https, and reuses the file', async () => {
    process.env.VBEE_TOKEN = 'tok';
    process.env.VBEE_APP_ID = 'app';
    const { fetch, calls } = fakeFetch((c, n) => (n === 1 ? json({ status: 1, result: { audio_link: 'https://vbee.s3.example/a.mp3' } }) : bytes('ID3vbee')));
    const p = createVbeeProvider({ rate: 1 }, deps(fetch));
    const voice = { id: 'hn_female_ngochuyen_full_48k-fhg', displayName: 'Ngọc Huyền', language: 'vi-VN' };
    const r = await p.synthesize('Xin chào', voice, 1.2, new AbortController().signal);
    expect(JSON.parse(calls[0]!.init!.body as string)).toMatchObject({ app_id: 'app', input_text: 'Xin chào', voice_code: voice.id, speed_rate: '1.2', response_type: 'direct' });
    expect(calls[1]!.url).toBe('https://vbee.s3.example/a.mp3');
    expect(await readFile(r.filePath, 'utf8')).toBe('ID3vbee');
    await p.synthesize('Xin chào', voice, 1.2, new AbortController().signal);
    expect(calls).toHaveLength(2);
  });

  it('reads a refusal out of an HTTP 200 and refuses a non-https audio link', async () => {
    process.env.VBEE_TOKEN = 'tok';
    process.env.VBEE_APP_ID = 'app';
    const voice = { id: 'v-pre', displayName: 'V', language: 'vi-VN' };
    const refused = fakeFetch(() => json({ status: 0, error_code: 1045, error_message: null }));
    await expect(createVbeeProvider({}, deps(refused.fetch)).synthesize('a', voice, 1, new AbortController().signal)).rejects.toMatchObject({ code: 'TTS_UPSTREAM', message: expect.stringContaining('1045') });
    const plain = fakeFetch(() => json({ status: 1, result: { audio_link: 'http://evil/a.mp3' } }));
    await expect(createVbeeProvider({}, deps(plain.fetch)).synthesize('b', voice, 1, new AbortController().signal)).rejects.toMatchObject({ code: 'TTS_UPSTREAM', message: expect.stringContaining('https') });
  });
});
