import type { ZodTypeAny, z } from 'zod';
import type { LLMRef, TTSRef, Voice } from '../types/payloads';

/** Provider interfaces. */

export interface LLMProvider {
  readonly providerId: string;
  readonly displayName: string;
  readonly transport: LLMRef['transport'];
  probe(): Promise<LLMRef['capabilities']>;
  complete<S extends ZodTypeAny>(prompt: string, outputSchema: S, signal: AbortSignal, options?: LLMCompleteOptions): Promise<z.infer<S>>;
}

/** A picture on this machine for the model to look at with the prompt. */
export interface LLMImage { path: string; mediaType: string }

export interface LLMCompleteOptions {
  /** Only a provider whose probe reports `vision` ready is given these. */
  images?: LLMImage[];
  /** Search and read the web while answering. Only asked of a provider whose probe reports `webSearch` ready. */
  web?: boolean;
}

export interface SynthesizeResult {
  /** Filesystem path of the generated MP3 — server-side only; the TTS node maps it to /api/media. */
  filePath: string;
  durationSeconds: number;
  voice: Voice;
}

export interface TTSProvider {
  readonly providerId: string;
  readonly displayName: string;
  readonly transport: TTSRef['transport'];
  probe(): Promise<{ capabilities: TTSRef['capabilities']; voices: Voice[] }>;
  synthesize(text: string, voice: Voice, speed: number, signal: AbortSignal): Promise<SynthesizeResult>;
}

export type LLMProviderFactory = (settings: Record<string, unknown>) => LLMProvider;
export type TTSProviderFactory = (settings: Record<string, unknown>) => TTSProvider;

/**
 * The packet a probed voice provider puts on its port. Beside the interface it is built from, the
 * way `makeEngineRef` sits beside `EngineAdapter` — it is every provider's, not any one of them's.
 */
export function buildTTSRef(provider: TTSProvider, probe: Awaited<ReturnType<TTSProvider['probe']>>, settings: Record<string, unknown>): TTSRef {
  return {
    providerId: provider.providerId,
    displayName: provider.displayName,
    transport: provider.transport,
    capabilities: probe.capabilities,
    voices: probe.voices,
    settings: { defaultVoice: settings.defaultVoice as string | undefined, rate: (settings.rate as number | undefined) ?? 1 },
  };
}
