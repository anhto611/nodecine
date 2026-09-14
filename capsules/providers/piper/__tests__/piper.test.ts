import { afterEach, describe, expect, it } from 'vitest';
import { createPiperProvider, lengthScaleFor, parsePiperVoice, voicesDir } from '..';

const OLD = { ...process.env };
afterEach(() => {
  process.env = { ...OLD };
});

describe('parsePiperVoice', () => {
  it('reads the language from the model config', () => {
    expect(parsePiperVoice('vi_VN-vais1000-medium.onnx', JSON.stringify({ language: { code: 'vi_VN' } }))).toEqual({
      id: 'vi_VN-vais1000-medium',
      displayName: 'vais1000 · medium',
      language: 'vi-VN',
    });
  });

  it('falls back to the file name when the config is missing or broken', () => {
    expect(parsePiperVoice('en_US-lessac-high.onnx', '')?.language).toBe('en-US');
    expect(parsePiperVoice('en_GB-alba-medium.onnx', 'not json at all')?.language).toBe('en-GB');
  });

  it('accepts the older espeak field', () => {
    expect(parsePiperVoice('custom.onnx', JSON.stringify({ espeak: { voice: 'de' } }))?.language).toBe('de');
  });

  it('ignores anything that is not a model file', () => {
    expect(parsePiperVoice('README.md', '')).toBeNull();
    expect(parsePiperVoice('.onnx', '')).toBeNull();
  });
});

describe('lengthScaleFor', () => {
  it('is the reciprocal of the requested speed', () => {
    expect(lengthScaleFor(1, 1)).toBe(1);
    expect(lengthScaleFor(2, 1)).toBe(0.5);
    expect(lengthScaleFor(0.5, 1)).toBe(2);
  });

  it('combines the node speed with the provider rate', () => {
    expect(lengthScaleFor(2, 2)).toBe(0.25);
  });

  it('stays inside a range Piper accepts, whatever it is given', () => {
    expect(lengthScaleFor(0.001, 1)).toBe(4);
    expect(lengthScaleFor(1000, 1)).toBe(0.25);
    expect(lengthScaleFor(0, 0)).toBe(4);
  });
});

describe('voicesDir', () => {
  it('prefers the override', () => {
    process.env.NODECINE_PIPER_VOICES = '/tmp/my-voices';
    expect(voicesDir()).toBe('/tmp/my-voices');
  });

  it('falls back to piper\'s own location', () => {
    delete process.env.NODECINE_PIPER_VOICES;
    expect(voicesDir()).toMatch(/piper-voices$/);
  });
});

describe('probe without piper installed', () => {
  it('reports what is missing and how to fix it, and never throws', async () => {
    process.env.NODECINE_PIPER_BIN = '/nonexistent/piper';
    process.env.NODECINE_PIPER_VOICES = '/nonexistent/voices';
    const probe = await createPiperProvider({}).probe();
    expect(probe.voices).toEqual([]);
    expect(probe.capabilities.installed.status).toBe('unavailable');
    if (probe.capabilities.installed.status === 'unavailable') {
      expect(probe.capabilities.installed.code).toBe('PROVIDER_NOT_INSTALLED');
      expect(probe.capabilities.installed.fix).toContain('piper');
    }
  });
});
