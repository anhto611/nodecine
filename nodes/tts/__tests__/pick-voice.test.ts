import { describe, expect, it } from 'vitest';
import { pickVoice } from '../node';
import type { TTSRef } from '@/core/types/payloads';

/** Choosing a voice for a script's language (CORE_CONTRACTS §8.2), for a provider whose voices speak any language. */
describe('pickVoice', () => {
  it('a multilingual voice matches any script language without a fallback warning', () => {
    const ref = { providerId: 'elevenlabs', displayName: 'ElevenLabs', transport: 'api', capabilities: { installed: { status: 'ready' }, encoder: { status: 'ready' } }, voices: [{ id: 'v1', displayName: 'Rachel', language: 'mul' }], settings: { rate: 1 } } as TTSRef;
    expect(pickVoice(ref, 'vi', undefined)).toEqual({ voice: ref.voices[0], fallback: false });
    expect(pickVoice(ref, 'en-US', 'v1')).toEqual({ voice: ref.voices[0], fallback: false });
  });
});
