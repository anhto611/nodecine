import { rename, stat } from 'node:fs/promises';
import { exec } from './exec';
import { ffmpegBin, ffprobeBin } from './audio';

/**
 * A rendered MP4 carries the workflow that made it, the way a ComfyUI PNG carries its workflow:
 * drop the video back on the canvas and the graph comes back. Stored as a format tag, written with a
 * stream copy so the video is not re-encoded. Best-effort by design: a missing ffmpeg leaves the
 * file without the tag and the render still counts.
 */

export const WORKFLOW_TAG = 'nodecine_workflow';

export async function embedWorkflow(mp4Path: string, workflow: unknown, signal?: AbortSignal): Promise<boolean> {
  const bin = await ffmpegBin();
  if (!bin) return false;
  const tmp = `${mp4Path}.meta.tmp.mp4`;
  const json = JSON.stringify(workflow);
  const r = await exec(bin, {
    args: ['-y', '-v', 'error', '-i', mp4Path, '-c', 'copy', '-map', '0', '-movflags', 'use_metadata_tags+faststart', '-metadata', `${WORKFLOW_TAG}=${json}`, '-f', 'mp4', tmp],
    timeoutMs: 120_000,
    signal,
  });
  if (r.code !== 0) throw new Error(`ffmpeg could not tag the video: ${r.stderr.trim()}`);
  const s = await stat(tmp);
  if (s.size === 0) throw new Error('ffmpeg wrote an empty file');
  await rename(tmp, mp4Path);
  return true;
}

export async function readWorkflowTag(mp4Path: string, signal?: AbortSignal): Promise<unknown | null> {
  const bin = await ffprobeBin();
  if (!bin) throw Object.assign(new Error('ffprobe was not found'), { code: 'PROVIDER_NOT_INSTALLED' });
  const r = await exec(bin, { args: ['-v', 'error', '-show_entries', `format_tags=${WORKFLOW_TAG}`, '-of', 'json', mp4Path], timeoutMs: 30_000, signal });
  if (r.code !== 0) throw new Error(`ffprobe failed: ${r.stderr.trim()}`);
  const parsed = JSON.parse(r.stdout) as { format?: { tags?: Record<string, string> } };
  const raw = parsed.format?.tags?.[WORKFLOW_TAG];
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}
