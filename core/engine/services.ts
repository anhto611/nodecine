import type { ZodTypeAny, z } from 'zod';
import type { EngineRef, LLMRef, TTSRef, Voice, Voiceover, Word } from '../types/payloads';
import type { VideoIR } from '../types/ir';
import type { ExportSettings, RenderProgress, RenderResult } from '../adapters/types';

/**
 * Everything a node needs from outside the graph. The executor runs on the server (ARCHITECTURE
 * §1.2); `server/services.server.ts` implements this with the providers and engines directly.
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
  /**
   * Word timings for a voice-over whose text is known: forced alignment, not transcription. Returns
   * the words of `text` in order, each with its start and end in seconds.
   */
  alignWords(audioUrl: string, text: string, language: string, options: { model: string }, signal: AbortSignal): Promise<Word[]>;
  now(): number;
}
