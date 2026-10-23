import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cloneVoice, presetVoice, tempoFilter } from '../index';
import { VieneuWorker } from '../worker';

describe('the VieNeu voices', () => {
  it('reads a preset as VieNeu lists it, without its star', () => {
    expect(presetVoice(['⭐ Hải Đăng — Nam · Bắc · Phong cách tự nhiên', 'Hải Đăng'])).toEqual({
      id: 'Hải Đăng',
      displayName: 'Hải Đăng — Nam · Bắc · Phong cách tự nhiên',
      language: 'vi-VN',
    });
    expect(presetVoice(['Thái Sơn — Nam · Nam · Phong cách kể chuyện', 'Thái Sơn']).displayName).toBe('Thái Sơn — Nam · Nam · Phong cách kể chuyện');
  });

  it('makes a recording in the voices folder a voice of its own', () => {
    expect(cloneVoice('giong-kenh.wav')).toEqual({ id: 'clone:giong-kenh.wav', displayName: 'giong-kenh · giọng riêng', language: 'vi-VN' });
  });

  it('changes the pace with as many atempo steps as it takes, and leaves 1 alone', () => {
    expect(tempoFilter(1)).toBeNull();
    expect(tempoFilter(1.1)).toBe('atempo=1.1000');
    expect(tempoFilter(3)).toBe('atempo=2.0000,atempo=1.5000');
    expect(tempoFilter(0.3)).toBe('atempo=0.5000,atempo=0.6000');
  });
});

/** A stand-in for worker.py, in Node: the same lines in, the same lines out. */
const FAKE = `
const rl = require('node:readline').createInterface({ input: process.stdin });
const say = (m) => process.stdout.write(JSON.stringify(m) + '\\n');
console.error('loading the model…');
say({ ready: true, sampleRate: 48000 });
rl.on('line', (line) => {
  const r = JSON.parse(line);
  if (r.cmd === 'voices') say({ id: r.id, voices: [['⭐ Hải Đăng — Nam · Bắc', 'Hải Đăng']] });
  else if (r.text === 'die') process.exit(3);
  else if (r.text === 'slow') setTimeout(() => say({ id: r.id, ok: true }), 200);
  else say({ id: r.id, ok: true, heard: r.text });
});
`;

describe('the VieNeu worker', () => {
  let dir: string;
  let worker: VieneuWorker | null = null;
  afterEach(async () => {
    worker?.stop();
    worker = null;
    if (dir) await rm(dir, { recursive: true, force: true });
  });
  const fake = async (source = FAKE) => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'vieneu-'));
    const script = path.join(dir, 'worker.js');
    await writeFile(script, source);
    worker = new VieneuWorker(process.execPath, script, 10_000, []);
    return worker;
  };

  it('loads once and answers each request with its own answer, the text going in on stdin', async () => {
    const w = await fake();
    expect((await w.ask({ cmd: 'voices' })).voices).toEqual([['⭐ Hải Đăng — Nam · Bắc', 'Hải Đăng']]);
    const [a, b] = await Promise.all([w.ask({ cmd: 'say', text: 'Đêm ấy, sông lặng như tờ.' }), w.ask({ cmd: 'say', text: 'một câu khác' })]);
    expect(a.heard).toBe('Đêm ấy, sông lặng như tờ.');
    expect(b.heard).toBe('một câu khác');
  });

  it('stops waiting for a sentence when the run is stopped', async () => {
    const w = await fake();
    const stop = new AbortController();
    const asked = w.ask({ cmd: 'say', text: 'slow' }, stop.signal);
    stop.abort();
    await expect(asked).rejects.toThrow(/aborted/);
  });

  it('says why when the process dies, and starts again on the next request', async () => {
    const w = await fake();
    await expect(w.ask({ cmd: 'say', text: 'die' })).rejects.toThrow(/VieNeu stopped \(3\): loading the model/);
    expect((await w.ask({ cmd: 'say', text: 'again' })).heard).toBe('again');
  });

  it('passes on why the model could not load', async () => {
    const w = await fake(`process.stdout.write(JSON.stringify({ ready: false, error: 'ModuleNotFoundError: vieneu' }) + '\\n'); setTimeout(() => {}, 1000);`);
    await expect(w.ask({ cmd: 'voices' })).rejects.toThrow(/ModuleNotFoundError: vieneu/);
  });
});
