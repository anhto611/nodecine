import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('matte decoder completion', () => {
  it.each([0, 1])('requires decoder success even when encoding succeeds (exit %s)', (exitCode) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'nodecine-matte-test-'));
    try {
      // Exercise the actual subprocess pipeline without downloading the matting model.
      const source = readFileSync(path.resolve('capsules/nodes/matte/cutout/matte.mjs'), 'utf8');
      writeFileSync(path.join(dir, 'matte.mjs'), source.replace("import ort from 'onnxruntime-node';", `
        const ort = {
          Tensor: class { constructor(type, data) { this.data = data; } },
          InferenceSession: { create: async () => ({
            run: async () => ({ fgr: { data: new Float32Array(12).fill(1) },
              pha: { data: new Float32Array(4).fill(1) } }),
            release: async () => {},
          }) },
        };
      `));
      const ffmpeg = path.join(dir, 'ffmpeg.mjs');
      writeFileSync(ffmpeg, `
        if (process.argv.includes('-vf')) {
          process.stdout.write(Buffer.alloc(16), () => process.exit(${exitCode}));
        } else {
          process.stdin.resume();
          process.stdin.on('end', () => process.exit(0));
        }
      `);
      const result = spawnSync(process.execPath, [path.join(dir, 'matte.mjs'),
        '--clip', 'clip', '--out', 'out.webm', '--model', 'model',
        '--width', '2', '--height', '2', '--ffmpeg', ffmpeg], { encoding: 'utf8', timeout: 10_000 });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(exitCode);
      if (exitCode) {
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('decoder exited 1');
      } else {
        expect(JSON.parse(result.stdout).frames).toBe(1);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
