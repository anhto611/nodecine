import path from 'node:path';
import { rename, writeFile } from 'node:fs/promises';
import { vbeeSettings } from './settings';
import { registerTTSProvider } from '@/contracts/providers/registry';
import type { SynthesizeResult, TTSProvider } from '@/contracts/providers/types';
import type { Capability, Voice } from '@/contracts/types/payloads';
import { ErrorCode } from '@/contracts/errors';
import { contentHash } from '@/core/hash';
import { ensureTmpDir } from '@/server/paths';
import { ffmpegBin } from '@/server/contracts/audio';
import { clamp, codedError, defaultApiDeps, envFirst, exists, withTimeout, type ApiDeps } from '../api-shared';

/**
 * Vbee provider: hosted Vietnamese voices with regional accents, plus a
 * catalogue in other languages.
 *
 * The voice list comes from Vbee's own catalogue at probe time, never from a copy baked in here:
 * the catalogue is theirs to change, and a stale copy fails as an opaque error code. Basic voices
 * come first because they work on every plan; premium ones answer 1045 on a standard account after
 * a couple of trial calls, which looks exactly like an exhausted quota and is not.
 *
 * Two credentials, both from the environment: the bearer token and the app id.
 */

export const VBEE_ID = 'vbee';
const API = 'https://vbee.vn/api/v1';
const ready: Capability = { status: 'ready' };
const KEY_HINT = 'set VBEE_TOKEN and VBEE_APP_ID in .env.local';

export function vbeeCreds(): { token: string; appId: string } | undefined {
  const token = envFirst('VBEE_TOKEN');
  const appId = envFirst('VBEE_APP_ID');
  return token && appId ? { token, appId } : undefined;
}

interface ApiVoice { code: string; name: string; active?: boolean; gender?: string; language_code?: string; level?: string }

const LEVEL_RANK: Record<string, number> = { BASIC: 0, ADVANCED: 1, PREMIUM: 2 };

/** `HN - Ngọc Huyền · female · basic`, Vietnamese first, basic before premium, then by name. */
export function parseVbeeVoices(body: unknown): Voice[] {
  const list = ((body as { result?: { voices?: ApiVoice[] } })?.result?.voices ?? []).filter((v) => v && v.code && v.name && v.active !== false);
  const voices = list.map((v) => {
    const tags = [v.gender, v.level?.toLowerCase()].filter((s): s is string => !!s);
    return { voice: { id: v.code, displayName: [v.name, ...tags].join(' · '), language: v.language_code || 'vi-VN' }, level: LEVEL_RANK[v.level ?? ''] ?? 1 };
  });
  voices.sort((a, b) => Number(!a.voice.language.startsWith('vi')) - Number(!b.voice.language.startsWith('vi')) || a.level - b.level || a.voice.displayName.localeCompare(b.voice.displayName));
  return voices.map((x) => x.voice);
}

/** Vbee takes `speed_rate` as a string between 0.5 and 2. */
export const vbeeSpeed = (speed: number, rate: number): string => (Math.round(clamp(speed * rate, 0.5, 2) * 10) / 10).toFixed(1);

/** Vbee answers HTTP 200 for refusals too, with the reason in error_code and often no message. */
export function describeVbeeError(code: number | undefined, voiceId: string, raw: string): string {
  if (code === 1045) {
    const premium = /-pre$|-st$/.test(voiceId);
    return `Vbee refused voice "${voiceId}" (1045): this account may not use it.` + (premium ? ' Premium voices need a paid plan; pick a basic one.' : ' Pick another voice from the list.');
  }
  return `Vbee refused, error_code=${code ?? '?'}: ${raw.slice(0, 300)}`;
}

export function createVbeeProvider(settings: Record<string, unknown>, deps: ApiDeps = defaultApiDeps()): TTSProvider {
  const rate = (settings.rate as number | undefined) ?? 1;

  return {
    providerId: VBEE_ID,
    displayName: 'Vbee',
    transport: 'api',

    async probe() {
      const creds = vbeeCreds();
      let installed: Capability;
      let voices: Voice[] = [];
      if (!creds) {
        installed = { status: 'unavailable', code: ErrorCode.KEY_MISSING, reason: 'No Vbee token or app id', fix: KEY_HINT };
      } else {
        try {
          const res = await deps.fetch(`${API}/voices`, { headers: { authorization: `Bearer ${creds.token}` }, signal: withTimeout(undefined, deps.timeoutMs) });
          if (res.status === 401 || res.status === 403) {
            installed = { status: 'unavailable', code: ErrorCode.KEY_INVALID, reason: 'Vbee rejected the token', fix: KEY_HINT };
          } else if (!res.ok) {
            installed = { status: 'unavailable', code: ErrorCode.PROVIDER_PROBE_FAILED, reason: `Vbee answered HTTP ${res.status}` };
          } else {
            const body = (await res.json()) as { status?: number; error_code?: number };
            voices = parseVbeeVoices(body);
            installed = voices.length
              ? ready
              : body.status === 0
                ? { status: 'unavailable', code: ErrorCode.KEY_INVALID, reason: `Vbee rejected the token (error_code=${body.error_code ?? '?'})`, fix: KEY_HINT }
                : { status: 'unavailable', code: ErrorCode.PROVIDER_PROBE_FAILED, reason: 'Vbee listed no voices' };
          }
        } catch (e) {
          installed = { status: 'unavailable', code: ErrorCode.PROVIDER_PROBE_FAILED, reason: `Could not reach Vbee: ${e instanceof Error ? e.message : String(e)}` };
        }
      }
      const encoder: Capability = (await ffmpegBin()) ? ready : { status: 'unavailable', code: ErrorCode.PROVIDER_NOT_INSTALLED, reason: 'ffmpeg was not found', fix: 'brew install ffmpeg' };
      return { capabilities: { installed, encoder }, voices };
    },

    async synthesize(text, voice, speed, signal): Promise<SynthesizeResult> {
      const creds = vbeeCreds();
      if (!creds) throw codedError(ErrorCode.KEY_MISSING, 'No Vbee token or app id');
      const dir = await ensureTmpDir();
      const spd = vbeeSpeed(speed, rate);
      const hash = contentHash({ provider: VBEE_ID, text, voice: voice.id, speed: spd });
      const mp3Path = path.join(dir, `${hash}.mp3`);
      if (!(await exists(mp3Path))) {
        const res = await deps.fetch(`${API}/tts`, {
          method: 'POST',
          headers: { authorization: `Bearer ${creds.token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ app_id: creds.appId, input_text: text, voice_code: voice.id, audio_type: 'mp3', bitrate: 128, speed_rate: spd, response_type: 'direct' }),
          signal: withTimeout(signal, 120_000),
        });
        const raw = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 403) throw codedError(ErrorCode.KEY_INVALID, 'Vbee rejected the token');
        // A gateway's error page is HTML: its status is the news, not its markup.
        if (!res.ok) throw codedError(ErrorCode.TTS_UPSTREAM, `Vbee HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}${/^\s*</.test(raw) ? '' : `: ${raw.slice(0, 300)}`}`);
        let body: { result?: { audio_link?: string; audio_url?: string }; error_code?: number };
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          throw codedError(ErrorCode.TTS_UPSTREAM, `Vbee did not answer with JSON: ${raw.slice(0, 200)}`);
        }
        const link = body.result?.audio_link ?? body.result?.audio_url;
        if (!link) throw codedError(ErrorCode.TTS_UPSTREAM, describeVbeeError(body.error_code, voice.id, raw));
        // The audio link is Vbee's own storage; only https is followed.
        if (!/^https:\/\//.test(link)) throw codedError(ErrorCode.TTS_UPSTREAM, 'Vbee returned an audio link that is not https');
        const audio = await deps.fetch(link, { signal: withTimeout(signal, 120_000) });
        if (!audio.ok) throw codedError(ErrorCode.TTS_UPSTREAM, `Vbee audio download failed: HTTP ${audio.status}`);
        const tmp = `${mp3Path}.part`;
        await writeFile(tmp, Buffer.from(await audio.arrayBuffer()));
        await rename(tmp, mp3Path);
      }
      const durationSeconds = await deps.measure(mp3Path, signal).catch((e) => {
        throw codedError(ErrorCode.TTS_AUDIO_UNREADABLE, e instanceof Error ? e.message : String(e));
      });
      return { filePath: mp3Path, durationSeconds, voice };
    },
  };
}

export function registerVbee(): void {
  registerTTSProvider({
    id: VBEE_ID,
    displayName: 'Vbee',
    factory: (settings) => createVbeeProvider(settings),
    settingsSchema: vbeeSettings,
  });
}
