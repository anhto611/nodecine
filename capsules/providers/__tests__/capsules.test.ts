import { describe, expect, it, beforeAll } from 'vitest';
import { PROVIDERS, providersOfKind, findProvider } from '@/capsules/providers/installed';
import { installProviders } from '@/capsules/providers/.generated/server';
import { getLLMProvider, getTTSProvider, _resetProviderRegistries } from '@/contracts/providers/registry';
import { PROVIDER_TRANSLATIONS } from '@/capsules/providers/.generated/locales';
import { schemaFields } from '@/core/schema-form';

/**
 * A provider is a capsule on the same terms as a node: one folder, one manifest, and one Zod schema
 * that the form is drawn from, the defaults come out of, and the server validates against. These
 * checks are what stops those three drifting apart again — they used to be three hand-kept lists.
 */

beforeAll(() => {
  _resetProviderRegistries();
  installProviders();
});

const registrationFor = (id: string, kind: 'tts' | 'llm') => (kind === 'tts' ? getTTSProvider(id) : getLLMProvider(id));

describe('the providers this build ships', () => {
  it('are discovered, one per capsule, and split by kind', () => {
    expect(PROVIDERS.length).toBeGreaterThan(0);
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
    expect(providersOfKind('tts').length + providersOfKind('llm').length).toBe(PROVIDERS.length);
  });

  it('each register a factory under the id their manifest declares', () => {
    for (const p of PROVIDERS) expect(registrationFor(p.id, p.kind), `${p.id} is described but never registered`).toBeDefined();
  });

  it('start a fresh node with settings their own schema accepts', () => {
    for (const p of PROVIDERS) {
      expect(p.settingsSchema.safeParse(p.defaultSettings).success, `${p.id} defaults are not valid against its schema`).toBe(true);
      // The server reads the defaults from the same schema; they cannot be two different objects.
      expect(registrationFor(p.id, p.kind)!.defaultSettings, `${p.id}`).toEqual(p.defaultSettings);
    }
  });

  it('draw their form from that schema and nothing else', () => {
    for (const p of PROVIDERS) {
      expect(p.fields, `${p.id}`).toEqual(schemaFields(p.settingsSchema));
      for (const name of Object.keys(p.widgets)) {
        expect(p.fields.some((f) => f.name === name), `${p.id} styles a field "${name}" its schema does not have`).toBe(true);
      }
    }
  });

  it('say their name and what they need, in every language', () => {
    const missing: string[] = [];
    for (const p of PROVIDERS) {
      for (const [locale, dict] of Object.entries(PROVIDER_TRANSLATIONS)) {
        for (const key of [p.nameKey, p.noteKey]) if (!(key in dict)) missing.push(`${locale} · ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('are found by id, and an unknown id is simply not one', () => {
    expect(findProvider(PROVIDERS[0]!.id)?.id).toBe(PROVIDERS[0]!.id);
    expect(findProvider('no-such-provider')).toBeUndefined();
  });
});
