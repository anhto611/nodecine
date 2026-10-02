import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exec } from '@/server/exec';
import { ffmpegBin } from '../audio';
import { embedWorkflow, readWorkflowTag } from '../video-meta';

/** Integration: needs ffmpeg and ffprobe on the machine, like the system-tts tests. */
let dir = '';
let ffmpeg: string | null = null;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-meta-'));
  ffmpeg = await ffmpegBin();
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('workflow tag in an MP4', () => {
  it('round-trips a workflow through the file without re-encoding', async () => {
    if (!ffmpeg) return;
    const file = path.join(dir, 'clip.mp4');
    const r = await exec(ffmpeg, {
      args: [
        '-y',
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=64x64:d=1',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=44100:cl=mono',
        '-t',
        '1',
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        '-pix_fmt',
        'yuv420p',
        file,
      ],
      timeoutMs: 60_000,
    });
    expect(r.code).toBe(0);
    expect(await readWorkflowTag(file)).toBeNull();
    const workflow = { name: 'Tệp thử', graph: { nodes: [], edges: [] }, note: 'quotes " and unicode ✓' };
    expect(await embedWorkflow(file, workflow)).toBe(true);
    expect(await readWorkflowTag(file)).toEqual(workflow);

    // Large workflow (> 40KB) that would exceed Windows CreateProcess 32KB argument limit
    const largeWorkflow = { name: 'Large', payload: 'a'.repeat(45_000) };
    expect(await embedWorkflow(file, largeWorkflow)).toBe(true);
    expect(await readWorkflowTag(file)).toEqual(largeWorkflow);
  }, 60_000);
});
