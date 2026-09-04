import { describe, it, expect } from 'vitest';
import os from 'node:os';
import { parseSayVoices, createSystemTtsProvider } from '../system-tts';
import { measureDurationSeconds } from '@/server/audio';

describe('parseSayVoices', () => {
  it('parses `say -v ?` lines including names with spaces and parentheses', () => {
    const out = [
      'Albert              en_US    # Hello! My name is Albert.',
      'Eddy (French (France)) fr_FR    # Bonjour! Je m’appelle Eddy.',
      'Linh                vi_VN    # Xin chào! Tên tôi là Linh.',
      'garbage line',
    ].join('\n');
    const voices = parseSayVoices(out);
    // Preferred voices first, novelty voices last (alphabetical within a tier).
    expect(voices).toEqual([
      { id: 'Linh', displayName: 'Linh', language: 'vi-VN' },
      { id: 'Albert', displayName: 'Albert', language: 'en-US' },
      { id: 'Eddy (French (France))', displayName: 'Eddy (French (France))', language: 'fr-FR' },
    ]);
  });
});

const onMac = os.platform() === 'darwin';

describe.skipIf(!onMac)('system-tts on macOS (integration)', () => {
  it('probe reports installed + encoder and lists English voices', async () => {
    const p = createSystemTtsProvider({ rate: 1 });
    const r = await p.probe();
    expect(r.capabilities.installed.status).toBe('ready');
    expect(r.capabilities.encoder.status).toBe('ready');
    expect(r.voices.some((v) => v.language.startsWith('en'))).toBe(true);
  }, 20_000);

  it('synthesizes a short line to mp3 and measures its duration from the file', async () => {
    const p = createSystemTtsProvider({ rate: 1 });
    const probe = await p.probe();
    const voice = probe.voices.find((v) => v.language === 'en-US') ?? probe.voices[0]!;
    const r = await p.synthesize('Nodes, not timelines.', voice, 1, new AbortController().signal);
    expect(r.filePath.endsWith('.mp3')).toBe(true);
    expect(r.durationSeconds).toBeGreaterThan(0.5);
    expect(r.durationSeconds).toBeLessThan(6);
    expect(await measureDurationSeconds(r.filePath)).toBe(r.durationSeconds);
  }, 60_000);

  it('the same text and voice yields the same file (content-addressed)', async () => {
    const p = createSystemTtsProvider({ rate: 1 });
    const probe = await p.probe();
    const voice = probe.voices.find((v) => v.language === 'en-US') ?? probe.voices[0]!;
    const a = await p.synthesize('Nodes, not timelines.', voice, 1, new AbortController().signal);
    const b = await p.synthesize('Nodes, not timelines.', voice, 1, new AbortController().signal);
    expect(a.filePath).toBe(b.filePath);
  }, 60_000);
});
