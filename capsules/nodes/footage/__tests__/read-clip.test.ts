import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assetPath, assetUrl, ensureAssetsDir, fileNameFromAssetUrl } from '@/server/paths';
import { clipAudio, readClip, webClip } from '@/server/contracts/video';
import { footage } from '../node';

/** A real two-second clip, made here, so the test needs nothing from outside. */
function makeClip(): string {
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'nodecine-clip-'));
  const file = path.join(dir, 'spoken.mp4');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=640x360:rate=25:duration=2',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=2',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    file,
  ]);
  const bytes = fs.readFileSync(file);
  const name = `${createHash('sha1').update(bytes).digest('hex')}.mp4`;
  const assets = path.resolve(process.cwd(), '.nodecine/assets');
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(assets, name), bytes);
  return assetUrl(name);
}

describe('a recorded clip brought in', () => {
  it('is read as it is, and gives its own sound as a voice', async () => {
    await ensureAssetsDir();
    const clip = makeClip();
    const facts = await readClip(clip);
    expect(facts).toMatchObject({ width: 640, height: 360, fps: 25, hasAudio: true, codec: 'h264' });
    expect(facts.durationSeconds).toBeCloseTo(2, 1);

    const logs: string[] = [];
    const out = (await footage.run({
      nodeId: 'f',
      params: footage.paramsSchema.parse({ clip, name: 'spoken.mp4' }),
      lists: {},
      signal: new AbortController().signal,
      inputs: {},
      fresh: false,
      services: {
        invoke: (id: string, args: unknown[]) =>
          id === 'footage/read' ? readClip(args[0] as string) : id === 'footage/playable' ? webClip(args[0] as string, args[1] as never) : clipAudio(args[0] as string),
      },
      log: (_: string, m: string) => logs.push(m),
      progress: () => {},
      patchParams: () => {},
    } as never)) as { footage: { name: string; width: number; hasAudio: boolean }; voice?: { audioUrl: string; language: string; durationSeconds: number } };

    expect(out.footage).toMatchObject({ name: 'spoken.mp4', width: 640, hasAudio: true });
    // Nobody has listened to it yet: the Caption Sync node writes down what it hears.
    expect(out.voice!.language).toBe('und');
    expect(out.voice!.audioUrl).toMatch(/^\/api\/media\/[a-f0-9]{16,64}\.mp3$/);
    expect(out.voice!.durationSeconds).toBeCloseTo(2, 0);
    expect(logs.join(' ')).toContain('640×360');
  }, 120_000);

  it('hands an H.264 clip back untouched, and makes a copy of one nothing can play', async () => {
    const clip = makeClip();
    const facts = await readClip(clip);
    expect(await webClip(clip, facts)).toEqual({ url: clip, converted: false });
    // A codec no browser here plays is made into one that is, under a name of its own.
    const copy = await webClip(clip, { ...facts, codec: 'hevc' });
    expect(copy.converted).toBe(true);
    expect(copy.url).toMatch(/^\/api\/assets\/[a-f0-9]{40}\.mp4$/);
    expect((await readClip(copy.url)).codec).toBe('h264');
  }, 120_000);

  it('measures CSV keyframes and reports rotated dimensions after conversion', async () => {
    const dir = fs.mkdtempSync(path.join(tmpdir(), 'nodecine-rotation-'));
    try {
      const original = path.join(dir, 'original.mp4');
      const rotated = path.join(dir, 'rotated.mp4');
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=64x48:rate=30:duration=10',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-g',
        '250',
        '-sc_threshold',
        '0',
        original,
      ]);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-display_rotation:v:0', '90', '-i', original, '-c', 'copy', rotated]);
      const bytes = fs.readFileSync(rotated);
      const name = `${createHash('sha1').update(bytes).digest('hex')}.mp4`;
      await ensureAssetsDir();
      fs.writeFileSync(assetPath(name), bytes);
      const clip = assetUrl(name);
      const facts = await readClip(clip);
      expect(facts.keyframeSeconds).toBeCloseTo(8.333, 2);
      expect(facts).toMatchObject({ width: 64, height: 48 });
      const out = (await footage.run({
        nodeId: 'f',
        params: footage.paramsSchema.parse({ clip }),
        lists: {},
        signal: new AbortController().signal,
        inputs: {},
        fresh: false,
        services: { invoke: (id: string, args: unknown[]) => (id === 'footage/read' ? readClip(args[0] as string) : webClip(args[0] as string, args[1] as never)) },
        log: () => {},
        progress: () => {},
        patchParams: () => {},
      } as never)) as { footage: { url: string; width: number; height: number } };
      expect(out.footage).toMatchObject({ width: 48, height: 64 });
      expect(out.footage.url).not.toBe(clip);
      fs.unlinkSync(assetPath(fileNameFromAssetUrl(out.footage.url)));
      fs.unlinkSync(assetPath(name));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it('says so when the clip is not on this machine', async () => {
    await expect(readClip(`/api/assets/${'a'.repeat(40)}.mp4`)).rejects.toThrow(/not on this machine/);
  });
});
