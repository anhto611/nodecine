import path from 'node:path';
import { access } from 'node:fs/promises';
import { ErrorCode } from '@/core/errors';
import type { Word } from '@/core/types/payloads';
import { exec, findBinary } from './exec';
import { fileNameFromMediaUrl, mediaPath } from './paths';

/**
 * Forced alignment on the server (CORE_CONTRACTS §5.12): a stable-ts script reads the narration on
 * stdin and prints word timings. The interpreter is found like any other tool — an environment
 * override, then the project-local venv `npm run setup:align` creates, then `python3` on PATH — and
 * the audio path is rebuilt from the media URL's hashed name, never taken from the graph.
 */

export const ALIGN_SCRIPT = path.join(process.cwd(), 'server', 'align', 'stable_ts_align.py');
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
  if (!python) throw Object.assign(new Error('No Python interpreter with stable-ts'), { code: ErrorCode.PROVIDER_NOT_INSTALLED, fix: ALIGN_INSTALL_HINT });
  const audio = mediaPath(fileNameFromMediaUrl(audioUrl));
  const model = /^[a-z0-9._-]{1,40}$/i.test(options.model) ? options.model : 'small';
  const r = await exec(python, {
    args: [ALIGN_SCRIPT, '--audio', audio, '--language', language, '--model', model],
    // The narration goes in on stdin, never through argv (CORE_CONTRACTS §9.2).
    stdin: text,
    timeoutMs: 15 * 60_000,
    signal,
  });
  if (r.code !== 0) {
    const err = r.stderr.trim();
    if (/No module named 'stable_whisper'/.test(err)) throw Object.assign(new Error('stable-ts is not installed for this interpreter'), { code: ErrorCode.PROVIDER_NOT_INSTALLED, fix: ALIGN_INSTALL_HINT });
    throw Object.assign(new Error(`aligner failed: ${err.split('\n').slice(-3).join(' ').slice(0, 400) || r.code}`), { code: ErrorCode.ALIGN_FAILED });
  }
  const words = parseAlignerOutput(r.stdout);
  if (!words.length) throw Object.assign(new Error('aligner returned no words'), { code: ErrorCode.ALIGN_FAILED });
  return words;
}
