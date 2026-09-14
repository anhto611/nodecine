import path from 'node:path';
import { access } from 'node:fs/promises';
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
  if (await access(ALIGN_VENV_PYTHON).then(() => true, () => false)) return ALIGN_VENV_PYTHON;
  return findBinary('python3');
}

export function parseAlignerOutput(stdout: string): Word[] {
  const parsed = JSON.parse(stdout) as unknown;
  if (!Array.isArray(parsed)) throw new Error('aligner did not return a list');
  return parsed
    .filter((w): w is { text: string; start: number; end: number } => !!w && typeof w.text === 'string' && typeof w.start === 'number' && typeof w.end === 'number')
    .map((w) => ({ text: w.text, start: Math.max(0, w.start), end: Math.max(w.start, w.end) }));
}

export async function alignWordsOnServer(audioUrl: string, text: string, language: string, options: { model: string }, signal: AbortSignal): Promise<Word[]> {
  const python = await alignerPython();
  if (!python) throw new NodeError(ErrorCode.PROVIDER_NOT_INSTALLED, 'No Python interpreter with stable-ts').withFix(ALIGN_INSTALL_HINT);
  const audio = mediaPath(fileNameFromMediaUrl(audioUrl));
  const model = /^[a-z0-9._-]{1,40}$/i.test(options.model) ? options.model : 'small';
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
  let words: Word[];
  try {
    words = parseAlignerOutput(r.stdout);
  } catch (e) {
    throw new NodeError(TranscribeErrorCode.ALIGN_FAILED, `aligner output unreadable (${r.stdout.length} bytes${r.truncated ? ', cut at the output cap' : ''}): ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!words.length) throw new NodeError(TranscribeErrorCode.ALIGN_FAILED, 'aligner returned no words');
  return words;
}

export const transcribeServices = { 'transcribe/align': alignWordsOnServer };
