import { describe, expect, it } from 'vitest';
import { createVbeeProvider, vbeeCreds } from './index';

/** Talks to Vbee with real credentials; runs only when NODECINE_MANUAL_VBEE=1 and the token is set. */
describe.skipIf(process.env.NODECINE_MANUAL_VBEE !== '1' || !vbeeCreds())('Vbee (live)', () => {
  it('probes the catalogue and reads one Vietnamese line with a basic voice', async () => {
    const p = createVbeeProvider({ rate: 1 });
    const r = await p.probe();
    expect(r.capabilities.installed.status).toBe('ready');
    const voice = r.voices.find((v) => v.language === 'vi-VN' && v.displayName.endsWith('basic'))!;
    expect(voice).toBeDefined();
    const out = await p.synthesize('Xin chào, đây là giọng đọc thử của NodeCine.', voice, 1, new AbortController().signal);
    console.log(voice.id, out.filePath, out.durationSeconds);
    expect(out.durationSeconds).toBeGreaterThan(1);
  }, 60_000);
});
