import { describe, expect, it } from 'vitest';
import { NODE_ERROR_CODES } from '@/capsules/nodes/.generated/definitions';
import { NODE_TRANSLATIONS } from '@/capsules/nodes/.generated/locales';
import { ErrorCode } from '@/contracts/errors';
import { en } from '@/locales/en';
import { vi } from '@/locales/vi';

/**
 * A failure that belongs to one node belongs in that node's capsule: the code in its `errors.ts`,
 * the sentence a person reads in its own `locales.ts`. Core keeps only what core, the engine and
 * the provider layer raise. These two checks are what stops the two halves drifting apart — the Web
 * Fetcher declared five codes for months and had a string for none of them.
 */

const LOCALES = { en: { ...en, ...NODE_TRANSLATIONS.en }, vi: { ...vi, ...NODE_TRANSLATIONS.vi } };

describe('error codes a capsule owns', () => {
  it('are spelled out in every language', () => {
    const missing: string[] = [];
    for (const [nodeId, codes] of Object.entries(NODE_ERROR_CODES)) {
      for (const code of codes) {
        for (const [locale, dict] of Object.entries(LOCALES)) {
          if (!(`error.${code}` as string in dict)) missing.push(`${nodeId} · ${locale} · error.${code}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('are not also declared by the core table', () => {
    const owned = new Set(Object.values(NODE_ERROR_CODES).flat());
    const both = Object.keys(ErrorCode).filter((code) => owned.has(code));
    expect(both, 'a code has one owner: either core raises it or one capsule does').toEqual([]);
  });

  it('are not claimed by two capsules at once', () => {
    const seen = new Map<string, string>();
    for (const [nodeId, codes] of Object.entries(NODE_ERROR_CODES)) {
      for (const code of codes) {
        expect(seen.get(code), `${code} is claimed by both ${seen.get(code)} and ${nodeId}`).toBeUndefined();
        seen.set(code, nodeId);
      }
    }
  });
});

describe('the core error table', () => {
  it('has a string in every language for every code it declares', () => {
    const missing: string[] = [];
    for (const code of Object.values(ErrorCode)) {
      for (const [locale, dict] of Object.entries(LOCALES)) {
        if (!(`error.${code}` as string in dict)) missing.push(`${locale} · error.${code}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
