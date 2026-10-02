import os from 'node:os';
import path from 'node:path';
import { writeFile, rename } from 'node:fs/promises';
import { registerTTSProvider } from '@/contracts/providers/registry';
import type { TTSProvider, SynthesizeResult } from '@/contracts/providers/types';
import type { Capability, Voice } from '@/contracts/types/payloads';
import { exec, ExecError, findBinary } from '@/server/exec';
import { convertToMp3, ffmpegBin, measureDurationSeconds } from '@/server/contracts/audio';
import { ensureTmpDir } from '@/server/paths';
import { contentHash } from '@/core/hash';
import { systemTtsSettings } from './settings';

/**
 * System TTS provider: the OS speech synthesizer plus ffmpeg.
 * v0.1 implements macOS `say`; other platforms report `installed: unavailable`.
 */

export const SYSTEM_TTS_ID = 'system-tts';
const SAY_DEFAULT_WPM = 175;

const ready: Capability = { status: 'ready' };

/** `say -v ?` prints `Name<spaces>lang_REGION<spaces># sample`. Names may contain spaces and parentheses. */
/** macOS ships novelty voices (Bells, Zarvox, …) that are never a sensible default; list them last. */
const NOVELTY = new Set([
  'Albert',
  'Bad News',
  'Bahh',
  'Bells',
  'Boing',
  'Bubbles',
  'Cellos',
  'Wobble',
  'Good News',
  'Jester',
  'Organ',
  'Superstar',
  'Trinoids',
  'Whisper',
  'Zarvox',
  'Junior',
  'Ralph',
  'Kathy',
  'Fred',
  'Grandma',
  'Grandpa',
  'Rocko',
  'Sandy',
  'Shelley',
  'Eddy',
  'Flo',
  'Reed',
]);
/** Voices that sound best as automatic picks, in order. */
const PREFERRED = ['Samantha', 'Alex', 'Daniel', 'Karen', 'Moira', 'Tessa', 'Rishi', 'Linh', 'Kyoko', 'Yuna', 'Tingting', 'Monica', 'Thomas', 'Anna'];

function voiceRank(v: Voice): number {
  const base = v.displayName.split(' (')[0]!;
  const pref = PREFERRED.indexOf(base);
  if (pref >= 0) return pref;
  if (NOVELTY.has(base)) return 10_000;
  return 1000;
}

export function parseSayVoices(output: string): Voice[] {
  const voices: Voice[] = [];
  for (const line of output.split('\n')) {
    const m = /^(.+?)\s+([a-z]{2,3}[_-][A-Za-z0-9_]+)\s+#/.exec(line.trim());
    if (!m) continue;
    const displayName = m[1]!.trim();
    const language = m[2]!.replace('_', '-');
    voices.push({ id: displayName, displayName, language });
  }
  return voices.sort((a, b) => voiceRank(a) - voiceRank(b) || a.displayName.localeCompare(b.displayName));
}

async function sayBin(): Promise<string | null> {
  if (os.platform() !== 'darwin') return null;
  return findBinary('say');
}

export function createSystemTtsProvider(settings: Record<string, unknown>): TTSProvider {
  return {
    providerId: SYSTEM_TTS_ID,
    displayName: 'System TTS',
    transport: 'local',

    async probe() {
      const say = await sayBin();
      const ffmpeg = await ffmpegBin();
      const installed: Capability = say
        ? ready
        : {
            status: 'unavailable',
            code: 'PROVIDER_NOT_INSTALLED',
            reason: os.platform() === 'darwin' ? '`say` was not found' : `System TTS is not supported on ${os.platform()} in v0.1`,
          };
      const encoder: Capability = ffmpeg ? ready : { status: 'unavailable', code: 'PROVIDER_NOT_INSTALLED', reason: 'ffmpeg was not found', fix: 'brew install ffmpeg' };
      let voices: Voice[] = [];
      if (say) {
        const r = await exec(say, { args: ['-v', '?'], timeoutMs: 5000, maxOutput: 64 * 1024 });
        if (r.code === 0) voices = parseSayVoices(r.stdout);
      }
      void settings;
      return { capabilities: { installed, encoder }, voices };
    },

    async synthesize(text, voice, speed, signal): Promise<SynthesizeResult> {
      const say = await sayBin();
      if (!say) throw Object.assign(new Error('`say` not available'), { code: 'PROVIDER_NOT_INSTALLED' });
      const dir = await ensureTmpDir();
      const rate = (settings.rate as number | undefined) ?? 1;
      const wpm = Math.round(SAY_DEFAULT_WPM * rate * speed);
      const key = contentHash({ provider: SYSTEM_TTS_ID, text, voice: voice.id, wpm });
      const textPath = path.join(dir, `${key}.txt`);
      const aiffPath = path.join(dir, `${key}.aiff`);
      const mp3Tmp = path.join(dir, `${key}.mp3.part`);
      const mp3Path = path.join(dir, `${key}.mp3`);

      // User content goes through a file, never through argv.
      await writeFile(textPath, text, 'utf8');
      const r = await exec(say, { args: ['-v', voice.id, '-r', String(wpm), '-o', aiffPath, '-f', textPath], timeoutMs: 60_000, signal });
      if (r.code !== 0) throw Object.assign(new ExecError(`say failed: ${r.stderr.trim() || r.code}`, r), { code: 'PROVIDER_PROCESS_FAILED' });

      await convertToMp3(aiffPath, mp3Tmp, signal);
      await rename(mp3Tmp, mp3Path);
      const durationSeconds = await measureDurationSeconds(mp3Path, signal).catch((e) => {
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code: 'TTS_AUDIO_UNREADABLE' });
      });
      return { filePath: mp3Path, durationSeconds, voice };
    },
  };
}

export function registerSystemTts(): void {
  registerTTSProvider({
    id: SYSTEM_TTS_ID,
    displayName: 'System voice',
    factory: createSystemTtsProvider,
    settingsSchema: systemTtsSettings,
  });
}
