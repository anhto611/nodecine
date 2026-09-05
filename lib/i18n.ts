'use client';
import { en, type DictKey } from '@/locales/en';
import { vi } from '@/locales/vi';

export type Locale = 'en' | 'vi';
export const LOCALES: Locale[] = ['en', 'vi'];

/** Core strings, plus whatever the installed extras contribute. */
const DICTS: Record<Locale, Record<string, string>> = { en: { ...en }, vi: { ...vi } };

/**
 * Merge strings in from outside the core: the nodes and scenes under `extras/` own the wording for
 * themselves, so the core dictionaries stay about the framework.
 */
export function addLocales(locales: Record<string, Record<string, string>>): void {
  for (const [locale, entries] of Object.entries(locales)) {
    if (!LOCALES.includes(locale as Locale)) continue;
    Object.assign(DICTS[locale as Locale], entries);
  }
}

/** Translate a key with `{var}` interpolation. Unknown keys fall back to English, then to the key itself. */
export function translate(locale: Locale, key: DictKey | string, vars?: Record<string, string | number>): string {
  const raw = DICTS[locale][key] ?? DICTS.en[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : raw;
}
