import path from 'node:path';
import { access, readdir, rename, rm } from 'node:fs/promises';
import { registerTTSProvider } from '@/contracts/providers/registry';
import type { SynthesizeResult, TTSProvider } from '@/contracts/providers/types';
import type { Capability, Voice } from '@/contracts/types/payloads';
import { exec, ExecError } from '@/server/exec';
import { ffmpegBin, measureDurationSeconds } from '@/server/contracts/audio';
import { ensureTmpDir } from '@/server/paths';
import { contentHash } from '@/core/hash';
import { vieneuSettings } from './settings';
import { VieneuWorker } from './worker';

/**
 * VieNeu provider: Vietnamese voices that run on this machine, without a key or a per-character bill
 * (pnnbao97/VieNeu-TTS, Apache 2.0). Its 25 preset voices cover the North, the Centre and the South
 * in natural, storytelling, story-reading and news styles; any recording a person drops in the
 * voices folder becomes a voice of its own, cloned from three to five seconds of it.
 *
 * VieNeu is a Python library, so it runs in a Python of its own (`.nodecine/vieneu` by default),
 * loaded once and kept (worker.ts).
 */

export const VIENEU_ID = 'vieneu';

const ready: Capability = { status: 'ready' };
const INSTALL_HINT = 'py -3.12 -m venv .nodecine/vieneu, then .nodecine/vieneu/Scripts/python -m pip install vieneu';
/** A voice cloned from a recording: its id names the file. */
const CLONE = 'clone:';
const RECORDING = /\.(wav|mp3|flac|m4a|ogg)$/i;

/** The Python VieNeu is installed in: the override first, then the one the install hint makes. */
export function vieneuPython(): string {
  const override = process.env.NODECINE_VIENEU_PYTHON?.trim();
  if (override) return override;
  const venv = path.resolve(process.cwd(), '.nodecine', 'vieneu');
  return process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
}

/** Where a person's own recordings go, each becoming a cloned voice. */
export function cloneVoicesDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_VIENEU_VOICES?.trim() || path.join('.nodecine', 'vieneu-voices'));
}

/** A preset as VieNeu lists it — `["⭐ Hải Đăng — Nam · Bắc · Phong cách tự nhiên", "Hải Đăng"]` — as a voice. */
export function presetVoice([label, id]: [string, string]): Voice {
  return { id, displayName: label.replace(/^\W*⭐\s*/u, '').trim() || id, language: 'vi-VN' };
}

/** A recording in the voices folder as a voice cloned from it. */
export const cloneVoice = (file: string): Voice => ({ id: `${CLONE}${file}`, displayName: `${file.replace(RECORDING, '')} · giọng riêng`, language: 'vi-VN' });

async function clones(): Promise<Voice[]> {
  const files = await readdir(cloneVoicesDir()).catch(() => [] as string[]);
  return files.filter((f) => RECORDING.test(f)).sort().map(cloneVoice);
}

/** The ffmpeg tempo chain for a speed: one `atempo` holds 0.5 to 2, a further one goes beyond. */
export function tempoFilter(speed: number): string | null {
  const s = Math.min(4, Math.max(0.25, speed));
  if (Math.abs(s - 1) < 0.005) return null;
  const parts: number[] = [];
  let left = s;
  while (left > 2) {
    parts.push(2);
    left /= 2;
  }
  while (left < 0.5) {
    parts.push(0.5);
    left /= 0.5;
  }
  parts.push(left);
  return parts.map((p) => `atempo=${p.toFixed(4)}`).join(',');
}

let shared: VieneuWorker | null = null;
/** The one model this server keeps loaded, started on first use. */
function worker(): VieneuWorker {
  shared ??= new VieneuWorker(vieneuPython(), path.join(process.cwd(), 'capsules', 'providers', 'vieneu', 'worker.py'));
  return shared;
}

export function createVieneuProvider(settings: Record<string, unknown>, deps: { worker?: () => VieneuWorker } = {}): TTSProvider {
  const model = deps.worker ?? worker;
  let presets: Voice[] | null = null;
  return {
    providerId: VIENEU_ID,
    displayName: 'VieNeu',
    transport: 'local',

    async probe() {
      const python = vieneuPython();
      const found = await access(python).then(
        () => true,
        () => false,
      );
      const ffmpeg = await ffmpegBin();
      const encoder: Capability = ffmpeg ? ready : { status: 'unavailable', code: 'PROVIDER_NOT_INSTALLED', reason: 'ffmpeg was not found', fix: 'install ffmpeg' };
      if (!found) {
        return { capabilities: { installed: { status: 'unavailable', code: 'PROVIDER_NOT_INSTALLED', reason: `No Python with VieNeu at ${python}`, fix: INSTALL_HINT }, encoder }, voices: [] };
      }
      try {
        // The first probe loads the model; the voices are kept for the ones after it.
        presets ??= (((await model().ask({ cmd: 'voices' })).voices as [string, string][]) ?? []).map(presetVoice);
      } catch (e) {
        return {
          capabilities: { installed: { status: 'unavailable', code: 'PROVIDER_NOT_INSTALLED', reason: e instanceof Error ? e.message : String(e), fix: INSTALL_HINT }, encoder },
          voices: [],
        };
      }
      return { capabilities: { installed: ready, encoder }, voices: [...presets, ...(await clones())] };
    },

    async synthesize(text, voice, speed, signal): Promise<SynthesizeResult> {
      const dir = await ensureTmpDir();
      const rate = (settings.rate as number | undefined) ?? 1;
      const tempo = Math.max(0.25, speed) * Math.max(0.25, rate);
      const ref = voice.id.startsWith(CLONE) ? path.join(cloneVoicesDir(), voice.id.slice(CLONE.length)) : undefined;
      const key = contentHash({ provider: VIENEU_ID, text, voice: voice.id, tempo });
      const wavPath = path.join(dir, `${key}.wav`);
      const mp3Tmp = path.join(dir, `${key}.mp3.part`);
      const mp3Path = path.join(dir, `${key}.mp3`);

      try {
        await model().ask(ref ? { cmd: 'say', text, ref, out: wavPath } : { cmd: 'say', text, voice: voice.id, out: wavPath }, signal);
      } catch (e) {
        if (signal.aborted) throw e;
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code: 'PROVIDER_PROCESS_FAILED' });
      }

      const bin = await ffmpegBin();
      if (!bin) throw Object.assign(new Error('ffmpeg not found'), { code: 'PROVIDER_NOT_INSTALLED' });
      const filter = tempoFilter(tempo);
      const r = await exec(bin, {
        args: ['-y', '-v', 'error', '-i', wavPath, ...(filter ? ['-filter:a', filter] : []), '-codec:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', mp3Tmp],
        timeoutMs: 120_000,
        signal,
      });
      if (r.code !== 0) throw Object.assign(new ExecError(`ffmpeg failed: ${r.stderr.trim()}`, r), { code: 'PROVIDER_PROCESS_FAILED' });
      await rename(mp3Tmp, mp3Path);
      await rm(wavPath, { force: true });
      const durationSeconds = await measureDurationSeconds(mp3Path, signal).catch((e) => {
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code: 'TTS_AUDIO_UNREADABLE' });
      });
      return { filePath: mp3Path, durationSeconds, voice };
    },
  };
}

export function registerVieneu(): void {
  registerTTSProvider({
    id: VIENEU_ID,
    displayName: 'VieNeu',
    factory: (settings) => createVieneuProvider(settings),
    settingsSchema: vieneuSettings,
  });
}
