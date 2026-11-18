import { describe, expect, it, afterAll } from 'vitest';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createKokoroProvider } from '../kokoro';
import { createVieneuProvider } from '../vieneu';
import { createOmnivoiceProvider } from '../omnivoice';

/**
 * The local voices, for real: each one reads a line on this machine. Runs only when
 * NODECINE_MANUAL_VOICES=1, after `npm run setup:<voice>`. OmniVoice clones a line VieNeu just read, so
 * no person's voice is needed for the test.
 */
const live = process.env.NODECINE_MANUAL_VOICES === '1';
const signal = () => new AbortController().signal;
const samples = mkdtempSync(path.join(os.tmpdir(), 'nodecine-voices-'));
afterAll(() => rmSync(samples, { recursive: true, force: true }));

describe.skipIf(!live)('local voices (live)', () => {
  it('Kokoro reads English, twice on one loaded model', async () => {
    const p = createKokoroProvider({ rate: 1 });
    const r = await p.probe();
    expect(r.capabilities.installed.status).toBe('ready');
    const voice = r.voices.find((v) => v.id === 'af_heart')!;
    const t0 = Date.now();
    const a = await p.synthesize('Hello from NodeCine. This is the Kokoro voice.', voice, 1, signal());
    const t1 = Date.now();
    const b = await p.synthesize('A second line, on the model already loaded.', voice, 1.2, signal());
    console.log('kokoro', a.durationSeconds, `${t1 - t0} ms`, b.durationSeconds, `${Date.now() - t1} ms`);
    expect(a.durationSeconds).toBeGreaterThan(1);
    expect(b.durationSeconds).toBeGreaterThan(1);
  }, 120_000);

  it('VieNeu reads Vietnamese, and its line becomes an OmniVoice sample', async () => {
    const p = createVieneuProvider({ expressive: 0.8 });
    const r = await p.probe();
    expect(r.capabilities.installed.status).toBe('ready');
    const voice = r.voices.find((v) => v.id === 'Ngọc Huyền')!;
    const words = 'Xin chào các bạn, hôm nay chúng ta cùng tìm hiểu về trà xanh Thái Nguyên.';
    const t0 = Date.now();
    const out = await p.synthesize(words, voice, 1, signal());
    console.log('vieneu', out.durationSeconds, `${Date.now() - t0} ms`, out.filePath);
    expect(out.durationSeconds).toBeGreaterThan(2);
    copyFileSync(out.filePath, path.join(samples, 'mau.mp3'));
    writeFileSync(path.join(samples, 'mau.txt'), words);
  }, 600_000);

  it('OmniVoice speaks in the voice of a sample', async () => {
    process.env.NODECINE_VOICES_DIR = samples;
    const p = createOmnivoiceProvider({ rate: 1 });
    const r = await p.probe();
    console.log('omnivoice probe', r.capabilities.installed, r.voices);
    expect(r.capabilities.installed.status).toBe('ready');
    const t0 = Date.now();
    const out = await p.synthesize('Đây là giọng được nhái lại từ một mẫu ngắn.', r.voices[0]!, 1, signal());
    console.log('omnivoice', out.durationSeconds, `${Date.now() - t0} ms`, out.filePath);
    expect(out.durationSeconds).toBeGreaterThan(1);
  }, 900_000);
});
