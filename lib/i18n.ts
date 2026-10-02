'use client';
import { en, type DictKey } from '@/locales/en';
import { vi } from '@/locales/vi';
import { NODE_TRANSLATIONS } from '@/capsules/nodes/.generated/locales';
import { PROVIDER_TRANSLATIONS } from '@/capsules/providers/.generated/locales';
import { ENGINE_TRANSLATIONS } from '@/capsules/engines/.generated/locales';

export type Locale = 'en' | 'vi';
export const LOCALES: Locale[] = ['en', 'vi'];

/** The two dictionaries. */
const DICTS: Record<Locale, Record<string, string>> = {
  en: { ...en, ...NODE_TRANSLATIONS.en, ...ENGINE_TRANSLATIONS.en, ...PROVIDER_TRANSLATIONS.en },
  vi: { ...vi, ...NODE_TRANSLATIONS.vi, ...ENGINE_TRANSLATIONS.vi, ...PROVIDER_TRANSLATIONS.vi },
};

/** Whether either dictionary carries the key: a body that labels enum values asks before it falls back to the raw value. */
export const hasTranslation = (key: string): boolean => key in DICTS.en || key in DICTS.vi;

/** Translate a key with `{var}` interpolation. Unknown keys fall back to English, then to the key itself. */
export function translate(locale: Locale, key: DictKey | string, vars?: Record<string, string | number>): string {
  const raw = DICTS[locale][key] ?? DICTS.en[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : raw;
}
