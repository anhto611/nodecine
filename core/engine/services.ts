import type { ZodTypeAny, z } from 'zod';
import type { EngineRef, LLMRef, TTSRef, Voice, Voiceover } from '../types/payloads';
import type { VideoIR } from '../types/ir';
import type { ExportSettings, RenderProgress, RenderResult } from '../adapters/types';

/**
 * Everything a node needs from outside the graph. The executor runs on the client
 * (ARCHITECTURE §1.2); the app implements this interface by calling local API routes.
 * Tests implement it with fakes.
 */
export interface NodeServices {
  probeLLM(providerId: string, settings: Record<string, unknown>): Promise<LLMRef>;
  probeTTS(providerId: string, settings: Record<string, unknown>): Promise<TTSRef>;
  probeEngine(engineId: string, settings: Record<string, unknown>): Promise<EngineRef>;
  synthesize(ref: TTSRef, text: string, voice: Voice, speed: number, signal: AbortSignal): Promise<Voiceover>;
  complete<S extends ZodTypeAny>(ref: LLMRef, prompt: string, schema: S, signal: AbortSignal): Promise<z.infer<S>>;
  render(
    ref: EngineRef,
    ir: VideoIR,
    settings: ExportSettings,
    onProgress: (p: RenderProgress) => void,
    signal: AbortSignal,
  ): Promise<RenderResult>;
  now(): number;
}
