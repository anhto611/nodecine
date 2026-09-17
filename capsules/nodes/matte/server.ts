import path from 'node:path';
import { createHash } from 'node:crypto';
import { access, rename, stat } from 'node:fs/promises';
import { ErrorCode, NodeError } from '@/contracts/errors';
import { exec, findBinary } from '@/server/exec';
import { assetPath, assetUrl, fileNameFromAssetUrl } from '@/server/paths';
import type { ClipFacts } from '@/server/contracts/video';
import { MatteErrorCode } from './errors';

/**
 * Cutting the speaker out of their room, on the server.
 *
 * The work is one command — `cutout/matte.mjs`, which runs ffmpeg on both sides of itself — because
 * that is the shape this app allows a subprocess to take. What comes back is an asset named by the
 * hash of the clip it came from and the detail it was cut at, so the same clip cut twice costs
 * nothing, and written under a temporary name first, so a run cut short never leaves half a file
 * whose name says it is whole.
 */

export const MATTE_SCRIPT = path.join(process.cwd(), 'capsules', 'nodes', 'matte', 'cutout', 'matte.mjs');
export const MATTE_MODEL = path.join(process.cwd(), '.nodecine', 'models', 'rvm_resnet50_fp32.onnx');
export const MATTE_INSTALL_HINT = 'npm run setup:matte';

/** The matting model, wherever this machine keeps it. */
export async function matteModel(): Promise<string | null> {
  const override = process.env.NODECINE_MATTE_MODEL?.trim();
  if (override) return override;
  return access(MATTE_MODEL).then(() => MATTE_MODEL, () => null);
}

/**
 * How big the model is asked to work.
 *
 * `fast` halves the frame, which measured 3.7 times quicker on this footage with no edge anyone could
 * point at — a cut-out is only ever seen as a head breaking out over a card, at a fraction of the
 * frame, so the detail it loses is detail nothing was going to show. `fine` keeps the full frame for
 * when the cut-out fills the screen.
 */
export type MatteDetail = 'fast' | 'fine';

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export function matteSize(facts: ClipFacts, detail: MatteDetail): { width: number; height: number } {
  const scale = detail === 'fast' ? 0.5 : 1;
  return { width: even(facts.width * scale), height: even(facts.height * scale) };
}

export interface CutOut { url: string; width: number; height: number; frames: number; seconds: number }

export async function cutOutClip(clipUrl: string, facts: ClipFacts, detail: MatteDetail, signal?: AbortSignal): Promise<CutOut> {
  const { width, height } = matteSize(facts, detail);
  const name = `${createHash('sha1').update(`${fileNameFromAssetUrl(clipUrl)}:matte:${detail}`).digest('hex')}.webm`;
  const out = assetPath(name);
  if (await stat(out).then((s) => s.isFile(), () => false)) {
    return { url: assetUrl(name), width, height, frames: 0, seconds: 0 };
  }

  const model = await matteModel();
  if (!model) throw new NodeError(ErrorCode.PROVIDER_NOT_INSTALLED, 'the matting model is not on this machine', false).withFix(MATTE_INSTALL_HINT);
  const ffmpeg = await findBinary('ffmpeg', 'NODECINE_FFMPEG_BIN');
  if (!ffmpeg) throw new NodeError(ErrorCode.PROVIDER_NOT_INSTALLED, 'ffmpeg was not found', false).withFix('brew install ffmpeg');

  const partial = `${out}.part.webm`;
  const r = await exec(process.execPath, {
    args: [MATTE_SCRIPT, '--clip', assetPath(fileNameFromAssetUrl(clipUrl)), '--out', partial, '--model', model,
      '--width', String(width), '--height', String(height), '--fps', String(facts.fps), '--ffmpeg', ffmpeg],
    // Minutes a frame at worst, and a talking-head clip runs to thousands of them.
    timeoutMs: 4 * 60 * 60_000,
    signal,
  });
  if (r.code !== 0) {
    throw new NodeError(MatteErrorCode.MATTE_FAILED, `the speaker could not be cut out: ${r.stderr.trim().split('\n').slice(-3).join(' ').slice(0, 400) || r.code}`);
  }
  let told: { frames?: number; seconds?: number };
  try { told = JSON.parse(r.stdout) as { frames?: number; seconds?: number }; }
  catch { throw new NodeError(MatteErrorCode.MATTE_FAILED, 'the cutter said nothing about what it did'); }
  await rename(partial, out);
  return { url: assetUrl(name), width, height, frames: told.frames ?? 0, seconds: told.seconds ?? 0 };
}

export const matteServices = { 'matte/cut': cutOutClip };
