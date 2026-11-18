import { describe, it, expect, afterEach } from 'vitest';
import { registerTTSProvider, _resetProviderRegistries } from '../providers/registry';
import { resolveAutoTTS } from '../resources';
import type { TTSRef } from '../types/payloads';

/** A voice left automatic is chosen for the script's language, among the services that may be chosen by themselves. */

const ok = { status: 'ready' as const };
const off = { status: 'unavailable' as const, code: 'PROVIDER_NOT_INSTALLED', reason: 'not installed', fix: 'npm run setup' };
const ref = (id: string, language: string, installed = true): TTSRef => ({
  providerId: id,
  displayName: id,
  transport: 'local',
  capabilities: { installed: installed ? ok : off, encoder: ok },
  voices: [{ id: `${id}-1`, displayName: '1', language }],
  settings: { rate: 1 },
});
const schema = { safeParse: () => ({ success: true, data: {} }) } as never;

function setup(refs: Record<string, TTSRef>, ranks: Record<string, number | undefined>) {
  for (const id of Object.keys(refs)) registerTTSProvider({ id, displayName: id, factory: () => ({}) as never, settingsSchema: schema, autoRank: ranks[id] });
  const asked: string[] = [];
  const services = {
    probeTTS: async (id: string) => {
      asked.push(id);
      return refs[id]!;
    },
  };
  return { services, asked };
}

afterEach(() => _resetProviderRegistries());

describe('an automatic voice', () => {
  it('is the first service that speaks the language: Vietnamese to the second, English to the first', async () => {
    const { services, asked } = setup({ english: ref('english', 'en-US'), viet: ref('viet', 'vi'), clone: ref('clone', 'mul') }, { english: 1, viet: 2 });
    expect((await resolveAutoTTS(services, 'vi')).providerId).toBe('viet');
    expect((await resolveAutoTTS(services, 'en')).providerId).toBe('english');
    // A service that clones a person's voice is never asked unless named.
    expect(asked).not.toContain('clone');
  });

  it('falls back to the first ready service when the one that speaks the language is not installed', async () => {
    const { services } = setup({ english: ref('english', 'en-US'), viet: ref('viet', 'vi', false) }, { english: 1, viet: 2 });
    expect((await resolveAutoTTS(services, 'vi')).providerId).toBe('english');
  });

  it('says what to do when nothing is ready', async () => {
    const { services } = setup({ english: ref('english', 'en-US', false) }, { english: 1 });
    await expect(resolveAutoTTS(services, 'en')).rejects.toMatchObject({ fix: 'npm run setup' });
  });
});
