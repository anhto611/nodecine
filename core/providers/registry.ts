import type { ZodTypeAny } from 'zod';
import type { LLMProviderFactory, TTSProviderFactory } from './types';

/**
 * Provider registries (ARCHITECTURE §2). Empty in the core; `providers/*` self-register at startup.
 *
 * A registration carries more than a factory, because there is one node per port type rather than
 * one node per provider: the node renders the provider list and the fields of whichever provider is
 * selected, so the registry has to describe the settings as well as build the provider.
 */

export interface ProviderRegistration<F> {
  id: string;
  displayName: string;
  factory: F;
  /** Shape of `settings` for this provider; the node validates and renders from it. */
  settingsSchema: ZodTypeAny;
  defaultSettings: Record<string, unknown>;
  /**
   * Setting names that hold a credential. Nothing reads this yet: the hosted providers take their
   * keys from the environment, so no credential sits in a graph. A provider that must carry one in
   * its settings declares it here so the key handling has a single place to look.
   */
  secretSettings?: string[];
}

export type LLMProviderRegistration = ProviderRegistration<LLMProviderFactory>;
export type TTSProviderRegistration = ProviderRegistration<TTSProviderFactory>;

const llm = new Map<string, LLMProviderRegistration>();
const tts = new Map<string, TTSProviderRegistration>();

export function registerLLMProvider(reg: LLMProviderRegistration): void {
  llm.set(reg.id, reg);
}
export function registerTTSProvider(reg: TTSProviderRegistration): void {
  tts.set(reg.id, reg);
}

export function getLLMProvider(id: string): LLMProviderRegistration | undefined {
  return llm.get(id);
}
export function getTTSProvider(id: string): TTSProviderRegistration | undefined {
  return tts.get(id);
}
export function getLLMProviderFactory(id: string): LLMProviderFactory | undefined {
  return llm.get(id)?.factory;
}
export function getTTSProviderFactory(id: string): TTSProviderFactory | undefined {
  return tts.get(id)?.factory;
}

export function listLLMProviders(): LLMProviderRegistration[] {
  return [...llm.values()];
}
export function listTTSProviders(): TTSProviderRegistration[] {
  return [...tts.values()];
}

/** Test-only. */
export function _resetProviderRegistries(): void {
  llm.clear();
  tts.clear();
}
