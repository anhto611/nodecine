import type { ZodTypeAny, z } from 'zod';
import type { LLMRef, TTSRef, Voice } from '../types/payloads';

/** Provider interfaces (CORE_CONTRACTS §7.2, §8). */

export interface LLMProvider {
  readonly providerId: string;
  readonly displayName: string;
  readonly transport: LLMRef['transport'];
  probe(): Promise<LLMRef['capabilities']>;
  complete<S extends ZodTypeAny>(prompt: string, outputSchema: S, signal: AbortSignal): Promise<z.infer<S>>;
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
