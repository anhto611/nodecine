import type { LLMProviderFactory, TTSProviderFactory } from './types';

/** Empty registries; providers/* self-register at startup (ARCHITECTURE §2). */
const llm = new Map<string, LLMProviderFactory>();
const tts = new Map<string, TTSProviderFactory>();

export function registerLLMProvider(id: string, factory: LLMProviderFactory): void {
  llm.set(id, factory);
}
export function registerTTSProvider(id: string, factory: TTSProviderFactory): void {
  tts.set(id, factory);
}
export function getLLMProviderFactory(id: string): LLMProviderFactory | undefined {
  return llm.get(id);
}
export function getTTSProviderFactory(id: string): TTSProviderFactory | undefined {
  return tts.get(id);
}
export function listLLMProviderIds(): string[] {
  return [...llm.keys()];
}
export function listTTSProviderIds(): string[] {
  return [...tts.keys()];
}

/** Test-only. */
export function _resetProviderRegistries(): void {
  llm.clear();
  tts.clear();
}
