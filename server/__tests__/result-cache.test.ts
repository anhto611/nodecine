import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DiskResultCache } from '../result-cache';
import type { CachedResult } from '@/core/engine/result-cache';

/** Results on disk: kept by signature, and only as good as the files they name. */

let dir = '';
let media = '';
const previousTmp = process.env.NODECINE_TMP_DIR;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-results-'));
  media = await mkdtemp(path.join(os.tmpdir(), 'nodecine-media-'));
  process.env.NODECINE_TMP_DIR = media;
});
afterEach(async () => {
  if (previousTmp === undefined) delete process.env.NODECINE_TMP_DIR; else process.env.NODECINE_TMP_DIR = previousTmp;
  await rm(dir, { recursive: true, force: true });
  await rm(media, { recursive: true, force: true });
});

const voice = (file: string): CachedResult => ({
  outputs: { voiceover: { payloadType: 'Voiceover', payload: { audioUrl: `/api/media/${file}`, durationSeconds: 2 }, contentHash: 'abcd' } },
  durationMs: 1200,
});

describe('a result kept on disk', () => {
  it('comes back by its signature, as it went in', async () => {
    const cache = new DiskResultCache(() => dir);
    await writeFile(path.join(media, '0123456789abcdef.mp3'), 'x');
    await cache.set('aaaabbbbccccdddd', voice('0123456789abcdef.mp3'));
    expect(await new DiskResultCache(() => dir).get('aaaabbbbccccdddd')).toEqual(voice('0123456789abcdef.mp3'));
    expect(await cache.get('ffffffffffffffff')).toBeUndefined();
  });

  it('is a miss once a file it names is gone, and is dropped', async () => {
    const cache = new DiskResultCache(() => dir);
    await cache.set('aaaabbbbccccdddd', voice('fedcba9876543210.mp3'));
    // The temp dir was cleaned: the voice-over this result points at is not there.
    expect(await cache.get('aaaabbbbccccdddd')).toBeUndefined();
    expect(await readdir(dir)).toEqual([]);
  });

  it('refuses a signature that is not one, rather than writing a path out of it', async () => {
    const cache = new DiskResultCache(() => dir);
    await cache.set('../escape', voice('0123456789abcdef.mp3'));
    expect(await cache.get('../escape')).toBeUndefined();
    expect(await readdir(dir).catch(() => [])).toEqual([]);
  });

  it('keeps the most recently used when there are too many', async () => {
    const cache = new DiskResultCache(() => dir);
    await writeFile(path.join(media, '0123456789abcdef.mp3'), 'x');
    const sigs = ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb', 'cccccccccccccccc'];
    for (const [i, sig] of sigs.entries()) {
      await cache.set(sig, voice('0123456789abcdef.mp3'));
      const t = new Date(Date.now() - (10 - i) * 60_000);
      await utimes(path.join(dir, `${sig}.json`), t, t);
    }
    // Reading the oldest makes it the newest.
    await cache.get('aaaaaaaaaaaaaaaa');
    await cache.prune(2);
    expect((await readdir(dir)).sort()).toEqual(['aaaaaaaaaaaaaaaa.json', 'cccccccccccccccc.json']);
  });
});
