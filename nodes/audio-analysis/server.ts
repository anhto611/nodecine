import path from 'node:path';
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { exec, ExecError } from '@/server/exec';
import { ffmpegBin } from '@/server/audio';
import { contentHash } from '@/core/hash';
import { analyzeSamples, detectBeats, pcm16ToFloat } from '@/contracts/audio/analysis';
import { ensureTmpDir, fileNameFromMediaUrl, mediaPath, mediaUrl } from '@/server/paths';

const SAMPLE_RATE = 16_000;

/**
 * The file decoded to 16 kHz mono PCM by ffmpeg, analysed in the core, written as JSON under a
 * hash of the file and the rate (ARCHITECTURE §6): same input, same name, no second decode.
 */
export async function analyzeAudioOnServer(url: string, fps: number, signal: AbortSignal): Promise<{ analysisUrl: string; frames: number; beatSeconds: number[] }> {
  const source = mediaPath(fileNameFromMediaUrl(url));
  const name = `${contentHash({ analysis: path.basename(source), fps, sampleRate: SAMPLE_RATE, version: 1 })}.json`;
  const out = mediaPath(name);
  const cached = await readFile(out, 'utf8').then((s) => JSON.parse(s) as { fps: number; frames: number[][] }, () => null);
  if (cached) return { analysisUrl: mediaUrl(name), frames: cached.frames.length, beatSeconds: detectBeats(cached) };

  const bin = await ffmpegBin();
  if (!bin) throw new Error('ffmpeg not found');
  const tmp = await ensureTmpDir();
  const pcm = path.join(tmp, `${path.basename(name, '.json')}.pcm`);
  const r = await exec(bin, { args: ['-y', '-v', 'error', '-i', source, '-f', 's16le', '-ac', '1', '-ar', String(SAMPLE_RATE), pcm], timeoutMs: 5 * 60_000, signal });
  if (r.code !== 0) throw new ExecError(`ffmpeg could not decode the sound: ${r.stderr.trim()}`, r);
  try {
    const bytes = await readFile(pcm);
    const analysis = analyzeSamples(pcm16ToFloat(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)), SAMPLE_RATE, fps);
    const partial = `${out}.part`;
    await writeFile(partial, JSON.stringify(analysis), 'utf8');
    await rename(partial, out);
    return { analysisUrl: mediaUrl(name), frames: analysis.frames.length, beatSeconds: detectBeats(analysis) };
  } finally {
    await stat(pcm).then(() => unlink(pcm), () => undefined);
  }
}

export const audioAnalysisServices = { 'audio-analysis/analyze': analyzeAudioOnServer };
