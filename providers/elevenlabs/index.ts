import path from 'node:path';
import { rename, writeFile } from 'node:fs/promises';
import { elevenlabsSettings, ELEVENLABS_MODELS } from './settings';
import { registerTTSProvider } from '@/contracts/providers/registry';
import type { SynthesizeResult, TTSProvider } from '@/contracts/providers/types';
import type { Capability, Voice } from '@/contracts/types/payloads';
import { ErrorCode } from '@/contracts/errors';
import { contentHash } from '@/core/hash';
import { ensureTmpDir } from '@/server/paths';
import { ffmpegBin } from '@/server/audio';
import { clamp, codedError, defaultApiDeps, envFirst, exists, withTimeout, type ApiDeps } from '../api-shared';

/**
 * ElevenLabs provider (CORE_CONTRACTS §8): hosted neural voices, 29 languages on one model.
 *
 * Every ElevenLabs voice speaks every language its model covers, so a voice is not tied to one
 * language the way a Piper model is. The voices are therefore listed as `mul` (BCP 47 for "multiple
 * languages") and the Voice node treats `mul` as matching whatever the script is in.
 *
 * The key is infrastructure, like a binary path: it comes from the environment, never from the
 * graph, so a shared workflow carries no credential (ARCHITECTURE §4).
 */

export const ELEVENLABS_ID = 'elevenlabs';
const API = 'https://api.elevenlabs.io/v1';
const ready: Capability = { status: 'ready' };
const KEY_HINT = 'set ELEVENLABS_API_KEY in .env.local';

export const elevenlabsKey = (): string | undefined => envFirst('ELEVENLABS_API_KEY');

interface ApiVoice { voice_id: string; name: string; category?: string; labels?: Record<string, string | undefined> }

/** `Rachel · american · female`: the name plus the two labels that tell voices apart at a glance. */
export function parseElevenlabsVoices(body: unknown): Voice[] {
  const list = ((body as { voices?: ApiVoice[] })?.voices ?? []).filter((v) => v && v.voice_id && v.name);
  return list.map((v) => {
    const tags = [v.labels?.accent, v.labels?.gender].filter((s): s is string => !!s);
    return { id: v.voice_id, displayName: [v.name, ...tags].join(' · '), language: 'mul' };
  });
}

/** ElevenLabs takes speed inside voice_settings and only within 0.7–1.2. */
export const elevenlabsSpeed = (speed: number, rate: number): number => Math.round(clamp(speed * rate, 0.7, 1.2) * 100) / 100;

export function createElevenlabsProvider(settings: Record<string, unknown>, deps: ApiDeps = defaultApiDeps()): TTSProvider {
  const model = ELEVENLABS_MODELS.includes(settings.model as (typeof ELEVENLABS_MODELS)[number]) ? (settings.model as string) : ELEVENLABS_MODELS[0];
  const rate = (settings.rate as number | undefined) ?? 1;

  return {
    providerId: ELEVENLABS_ID,
    displayName: 'ElevenLabs',
    transport: 'api',

    async probe() {
      const key = elevenlabsKey();
      let installed: Capability;
      let voices: Voice[] = [];
      if (!key) {
        installed = { status: 'unavailable', code: ErrorCode.KEY_MISSING, reason: 'No ElevenLabs API key', fix: KEY_HINT };
      } else {
        try {
          const res = await deps.fetch(`${API}/voices`, { headers: { 'xi-api-key': key }, signal: withTimeout(undefined, deps.timeoutMs) });
          if (res.status === 401 || res.status === 403) {
            installed = { status: 'unavailable', code: ErrorCode.KEY_INVALID, reason: 'ElevenLabs rejected the API key', fix: KEY_HINT };
          } else if (!res.ok) {
            installed = { status: 'unavailable', code: ErrorCode.PROVIDER_PROBE_FAILED, reason: `ElevenLabs answered HTTP ${res.status}` };
          } else {
            voices = parseElevenlabsVoices(await res.json());
            installed = voices.length ? ready : { status: 'unavailable', code: ErrorCode.PROVIDER_PROBE_FAILED, reason: 'The account has no voices' };
          }
        } catch (e) {
          installed = { status: 'unavailable', code: ErrorCode.PROVIDER_PROBE_FAILED, reason: `Could not reach ElevenLabs: ${e instanceof Error ? e.message : String(e)}` };
        }
      }
      const encoder: Capability = (await ffmpegBin()) ? ready : { status: 'unavailable', code: ErrorCode.PROVIDER_NOT_INSTALLED, reason: 'ffmpeg was not found', fix: 'brew install ffmpeg' };
      return { capabilities: { installed, encoder }, voices };
    },

    async synthesize(text, voice, speed, signal): Promise<SynthesizeResult> {
      const key = elevenlabsKey();
      if (!key) throw codedError(ErrorCode.KEY_MISSING, 'No ElevenLabs API key');
      const dir = await ensureTmpDir();
      const spd = elevenlabsSpeed(speed, rate);
      const hash = contentHash({ provider: ELEVENLABS_ID, model, text, voice: voice.id, speed: spd });
      const mp3Path = path.join(dir, `${hash}.mp3`);
      // The same line in the same voice is the same file; do not pay for it twice.
      if (!(await exists(mp3Path))) {
        const res = await deps.fetch(`${API}/text-to-speech/${encodeURIComponent(voice.id)}?output_format=mp3_44100_128`, {
          method: 'POST',
          headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
          // The narration travels in the body, never in the URL (CORE_CONTRACTS §9.1).
          body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: spd } }),
          signal: withTimeout(signal, 120_000),
        });
        if (res.status === 401 || res.status === 403) throw codedError(ErrorCode.KEY_INVALID, 'ElevenLabs rejected the API key');
        if (!res.ok) throw codedError(ErrorCode.TTS_UPSTREAM, `ElevenLabs HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
        const tmp = `${mp3Path}.part`;
        await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
        await rename(tmp, mp3Path);
      }
      const durationSeconds = await deps.measure(mp3Path, signal).catch((e) => {
        throw codedError(ErrorCode.TTS_AUDIO_UNREADABLE, e instanceof Error ? e.message : String(e));
      });
      return { filePath: mp3Path, durationSeconds, voice };
    },
  };
}

export function registerElevenlabs(): void {
  registerTTSProvider({
    id: ELEVENLABS_ID,
    displayName: 'ElevenLabs',
    factory: (settings) => createElevenlabsProvider(settings),
    settingsSchema: elevenlabsSettings,
  });
}
