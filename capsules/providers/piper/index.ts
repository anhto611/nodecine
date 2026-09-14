import os from 'node:os';
import path from 'node:path';
import { readdir, readFile, rename } from 'node:fs/promises';
import { registerTTSProvider } from '@/contracts/providers/registry';
import type { SynthesizeResult, TTSProvider } from '@/contracts/providers/types';
import type { Capability, Voice } from '@/contracts/types/payloads';
import { exec, ExecError, findBinary } from '@/server/exec';
import { convertToMp3, ffmpegBin, measureDurationSeconds } from '@/server/contracts/audio';
import { ensureTmpDir } from '@/server/paths';
import { contentHash } from '@/core/hash';
import { piperSettings } from './settings';

/**
 * Piper provider: a local neural voice, offline and without a key.
 *
 * It exists for two reasons. It sounds considerably better than the OS synthesizer, and unlike
 * macOS `say` it runs the same way on macOS, Windows and Linux, so it is the first voice this app
 * can offer on every platform. Piper reads the text on standard input, which is exactly what the
 * subprocess rule asks for.
 */

export const PIPER_ID = 'piper';

const ready: Capability = { status: 'ready' };
const INSTALL_HINT = 'pip install piper-tts, then download a voice from rhasspy/piper-voices';

/** Where voice models live: the override first, then Piper's own default location. */
export function voicesDir(): string {
  return process.env.NODECINE_PIPER_VOICES?.trim() || path.join(os.homedir(), '.local', 'share', 'piper-voices');
}

/**
 * A voice is a `<name>.onnx` model beside a `<name>.onnx.json` config. The language lives in the
 * config; the file name is the fallback, since every published voice is named `<lang>-<name>-<size>`.
 */
export function parsePiperVoice(fileName: string, config: string): Voice | null {
  const id = fileName.replace(/\.onnx$/i, '');
  if (!id || id === fileName) return null;
  let language = '';
  try {
    const cfg = JSON.parse(config) as { language?: { code?: string }; espeak?: { voice?: string } };
    language = cfg.language?.code?.replace('_', '-') ?? cfg.espeak?.voice ?? '';
  } catch {
    /* fall back to the file name below */
  }
  if (!language) {
    const m = /^([a-z]{2,3})[_-]([A-Za-z]{2,})/.exec(id);
    language = m ? `${m[1]}-${m[2]}` : 'en';
  }
  // `vi_VN-vais1000-medium` reads better as `vais1000 · medium`.
  const rest = id.replace(/^[a-z]{2,3}[_-][A-Za-z]{2,}-?/, '').replace(/-/g, ' · ');
  return { id, displayName: rest || id, language };
}

async function piperBin(): Promise<string | null> {
  return findBinary('piper', 'NODECINE_PIPER_BIN');
}

async function listVoices(dir: string): Promise<Voice[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const voices: Voice[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.onnx')) continue;
    const config = await readFile(path.join(dir, `${e.name}.json`), 'utf8').catch(() => '');
    const voice = parsePiperVoice(e.name, config);
    if (voice) voices.push(voice);
  }
  return voices.sort((a, b) => a.language.localeCompare(b.language) || a.displayName.localeCompare(b.displayName));
}

/** Piper measures speed as seconds per unit of text, so it is the reciprocal of a rate. */
export const lengthScaleFor = (speed: number, rate: number): number =>
  Math.min(4, Math.max(0.25, 1 / (Math.max(0.1, speed) * Math.max(0.1, rate))));

export function createPiperProvider(settings: Record<string, unknown>): TTSProvider {
  return {
    providerId: PIPER_ID,
    displayName: 'Piper',
    transport: 'local',

    async probe() {
      const bin = await piperBin();
      const dir = voicesDir();
      const voices = bin ? await listVoices(dir) : [];
      const installed: Capability = !bin
        ? { status: 'unavailable', code: 'PROVIDER_NOT_INSTALLED', reason: 'The piper binary was not found', fix: INSTALL_HINT }
        : voices.length === 0
          ? { status: 'unavailable', code: 'PROVIDER_NOT_INSTALLED', reason: `No voice models in ${dir}`, fix: INSTALL_HINT }
          : ready;
      const ffmpeg = await ffmpegBin();
      const encoder: Capability = ffmpeg
        ? ready
        : { status: 'unavailable', code: 'PROVIDER_NOT_INSTALLED', reason: 'ffmpeg was not found', fix: 'brew install ffmpeg' };
      void settings;
      return { capabilities: { installed, encoder }, voices };
    },

    async synthesize(text, voice, speed, signal): Promise<SynthesizeResult> {
      const bin = await piperBin();
      if (!bin) throw Object.assign(new Error('piper not available'), { code: 'PROVIDER_NOT_INSTALLED' });
      const dir = await ensureTmpDir();
      const rate = (settings.rate as number | undefined) ?? 1;
      const lengthScale = lengthScaleFor(speed, rate);
      const key = contentHash({ provider: PIPER_ID, text, voice: voice.id, lengthScale });
      const wavPath = path.join(dir, `${key}.wav`);
      const mp3Tmp = path.join(dir, `${key}.mp3.part`);
      const mp3Path = path.join(dir, `${key}.mp3`);
      const model = path.join(voicesDir(), `${voice.id}.onnx`);

      // The narration goes in on stdin, never through argv.
      const r = await exec(bin, {
        args: ['--model', model, '--output_file', wavPath, '--length_scale', String(lengthScale)],
        stdin: text,
        timeoutMs: 120_000,
        signal,
      });
      if (r.code !== 0) throw Object.assign(new ExecError(`piper failed: ${r.stderr.trim() || r.code}`, r), { code: 'PROVIDER_PROCESS_FAILED' });

      await convertToMp3(wavPath, mp3Tmp, signal);
      await rename(mp3Tmp, mp3Path);
      const durationSeconds = await measureDurationSeconds(mp3Path, signal).catch((e) => {
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code: 'TTS_AUDIO_UNREADABLE' });
      });
      return { filePath: mp3Path, durationSeconds, voice };
    },
  };
}

export function registerPiper(): void {
  registerTTSProvider({
    id: PIPER_ID,
    displayName: 'Piper',
    factory: createPiperProvider,
    settingsSchema: piperSettings,
  });
}
