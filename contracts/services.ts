import type { ZodTypeAny, z } from 'zod';
import type { EngineRef, LLMRef, TTSRef, Voice, Voiceover } from './types/payloads';
import type { VideoIR } from './types/ir';
import type { ExportSettings, RenderProgress, RenderResult } from './adapters/types';

/**
 * What a video workflow's nodes ask of the machine beyond the core's two calls: a model, a voice, an
 * engine, and the files those produce. `server/services.server.ts` implements all of it.
 */
declare module '@/core/engine/services' {
  export interface NodeServices {
    probeLLM(providerId: string, settings: Record<string, unknown>): Promise<LLMRef>;
    probeTTS(providerId: string, settings: Record<string, unknown>): Promise<TTSRef>;
    probeEngine(engineId: string, settings: Record<string, unknown>): Promise<EngineRef>;
    synthesize(ref: TTSRef, text: string, voice: Voice, speed: number, signal: AbortSignal): Promise<Voiceover>;
    /**
     * Ask the model. The server keeps every answer on disk by provider and prompt, so the same
     * question asked again — after a restart, or because a downstream visual node re-ran — is
     * free and identical; `fresh` skips that and asks again (a forced run, a retry).
     */
    complete<S extends ZodTypeAny>(ref: LLMRef, prompt: string, schema: S, signal: AbortSignal, opts?: { fresh?: boolean }): Promise<z.infer<S>>;
    render(
      ref: EngineRef,
      ir: VideoIR,
      settings: ExportSettings,
      onProgress: (p: RenderProgress) => void,
      signal: AbortSignal,
    ): Promise<RenderResult>;
    /**
     * Text kept as a file the browser can download, named by its own content.
     * `extension` is the kind of file it is — `srt`, `vtt` — and never a path.
     */
    saveText(text: string, extension: string): Promise<{ url: string; bytes: number }>;
    /**
     * One file from several, in order, with a pause after each part. Returns the file, its measured
     * length and where each part starts and how long it lasts, pause included.
     */
    concatAudio(parts: { audioUrl: string; durationSeconds: number }[], gapSeconds: number, signal: AbortSignal): Promise<{ audioUrl: string; durationSeconds: number; segments: { start: number; durationSeconds: number }[] }>;
  }
}
