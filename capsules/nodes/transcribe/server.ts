import os from 'node:os';
import path from 'node:path';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { ErrorCode } from '@/contracts/errors';
import { TranscribeErrorCode } from './errors';
import type { Word } from '@/contracts/types/payloads';
import { exec, findBinary } from '@/server/exec';
import { fileNameFromMediaUrl, mediaPath } from '@/server/paths';
import { NodeError } from '@/contracts/errors';

/**
 * Forced alignment on the server: a stable-ts script reads the narration on
 * stdin and prints word timings. The interpreter is found like any other tool — an environment
 * override, then the project-local venv `npm run setup:align` creates, then `python3` on PATH — and
 * the audio path is rebuilt from the media URL's hashed name, never taken from the graph.
 */

export const ALIGN_SCRIPT = path.join(process.cwd(), 'capsules', 'nodes', 'transcribe', 'align', 'stable_ts_align.py');
export const ALIGN_VENV_PYTHON = path.join(process.cwd(), '.nodecine', 'tools', 'stable-ts', 'bin', 'python');
export const ALIGN_INSTALL_HINT = 'npm run setup:align';

export async function alignerPython(): Promise<string | null> {
  const override = process.env.NODECINE_ALIGN_PYTHON?.trim();
  if (override) return override;
  if (
    await access(ALIGN_VENV_PYTHON).then(
      () => true,
      () => false,
    )
  )
    return ALIGN_VENV_PYTHON;
  return findBinary('python3');
}

/** What the aligner said: the words, and the language it decided on when it was left to hear one. */
export interface Heard {
  words: Word[];
  language?: string;
}

export function parseAlignerOutput(stdout: string): Heard {
  const parsed = JSON.parse(stdout) as unknown;
  // The script used to print a bare list; it prints the language with them now.
  const list = Array.isArray(parsed) ? parsed : (parsed as { words?: unknown })?.words;
  if (!Array.isArray(list)) throw new Error('aligner did not return a list of words');
  const language = Array.isArray(parsed) ? undefined : (parsed as { language?: unknown }).language;
  return {
    words: list
      .filter((w): w is { text: string; start: number; end: number } => !!w && typeof w.text === 'string' && typeof w.start === 'number' && typeof w.end === 'number')
      .map((w) => ({ text: w.text, start: Math.max(0, w.start), end: Math.max(w.start, w.end) })),
    ...(typeof language === 'string' && language ? { language } : {}),
  };
}

/**
 * `window`: align only that stretch of the recording (seconds from its start), cut out with ffmpeg
 * first, the timings given back on the recording's clock. A narration of several segments is aligned
 * one segment at a time, so the aligner losing its place in one cannot pull the others off.
 */
export async function alignWordsOnServer(
  audioUrl: string,
  text: string,
  language: string,
  options: { model: string; window?: { start: number; duration: number } },
  signal: AbortSignal,
): Promise<Heard> {
  const python = await alignerPython();
  if (!python) throw new NodeError(ErrorCode.PROVIDER_NOT_INSTALLED, 'No Python interpreter with stable-ts').withFix(ALIGN_INSTALL_HINT);
  const whole = mediaPath(fileNameFromMediaUrl(audioUrl));
  const model = /^[a-z0-9._-]{1,40}$/i.test(options.model) ? options.model : 'small';
  const window = options.window;
  let audio = whole;
  let dir: string | null = null;
  if (window) {
    const ffmpeg = await findBinary('ffmpeg', 'NODECINE_FFMPEG_BIN');
    if (!ffmpeg) throw new NodeError(ErrorCode.PROVIDER_NOT_INSTALLED, 'ffmpeg is needed to cut the recording').withFix('brew install ffmpeg');
    dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-align-'));
    audio = path.join(dir, 'segment.wav');
    const cut = await exec(ffmpeg, {
      args: ['-v', 'error', '-y', '-ss', String(Math.max(0, window.start)), '-t', String(Math.max(0.1, window.duration)), '-i', whole, '-ac', '1', '-ar', '16000', audio],
      timeoutMs: 60_000,
      signal,
    });
    if (cut.code !== 0) {
      await rm(dir, { recursive: true, force: true });
      throw new NodeError(TranscribeErrorCode.ALIGN_FAILED, `could not cut the recording: ${cut.stderr.trim().slice(0, 200)}`);
    }
  }
  try {
    const heard = await alignFile(python, audio, text, language, model, signal);
    const offset = window?.start ?? 0;
    return offset ? { ...heard, words: heard.words.map((w) => ({ ...w, start: w.start + offset, end: w.end + offset })) } : heard;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}

async function alignFile(python: string, audio: string, text: string, language: string, model: string, signal: AbortSignal): Promise<Heard> {
  const r = await exec(python, {
    args: [ALIGN_SCRIPT, '--audio', audio, '--language', language, '--model', model],
    // The narration goes in on stdin, never through argv.
    stdin: text,
    timeoutMs: 15 * 60_000,
    // One JSON object per word: a ten-minute narration is a few hundred kilobytes, far past exec's default cap.
    maxOutput: 8 * 1024 * 1024,
    signal,
  });
  if (r.code !== 0) {
    const err = r.stderr.trim();
    if (/No module named 'stable_whisper'/.test(err)) throw new NodeError(ErrorCode.PROVIDER_NOT_INSTALLED, 'stable-ts is not installed for this interpreter').withFix(ALIGN_INSTALL_HINT);
    throw new NodeError(TranscribeErrorCode.ALIGN_FAILED, `aligner failed: ${err.split('\n').slice(-3).join(' ').slice(0, 400) || r.code}`);
  }
  let heard: Heard;
  try {
    heard = parseAlignerOutput(r.stdout);
  } catch (e) {
    throw new NodeError(
      TranscribeErrorCode.ALIGN_FAILED,
      `aligner output unreadable (${r.stdout.length} bytes${r.truncated ? ', cut at the output cap' : ''}): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!heard.words.length) throw new NodeError(TranscribeErrorCode.ALIGN_FAILED, 'aligner returned no words');
  return heard;
}

export const transcribeServices = { 'transcribe/align': alignWordsOnServer };
