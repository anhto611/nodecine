import type { ZodTypeAny, z } from 'zod';
import type { EngineRef, LLMRef, TTSRef, Voice, Voiceover } from './types/payloads';
import type { Composition } from './types/composition';
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
     * free and identical; `fresh` skips that and asks again (a forced run, a retry). `images` are
     * uploaded pictures (`/api/assets/…`) the model looks at with the prompt; a model that cannot see
     * is asked without them. `web` lets the model search and read the web while it answers; a model
     * whose `webSearch` is not ready is asked without it.
     */
    complete<S extends ZodTypeAny>(ref: LLMRef, prompt: string, schema: S, signal: AbortSignal, opts?: { fresh?: boolean; images?: string[]; web?: boolean }): Promise<z.infer<S>>;
    /** A page the engine's player loads for this composition, filled with its values. */
    preview(ref: EngineRef, composition: Composition, signal: AbortSignal): Promise<{ url: string }>;
    /** The composition, filled with its values, rendered by the engine it names. */
    render(ref: EngineRef, composition: Composition, settings: ExportSettings, onProgress: (p: RenderProgress) => void, signal: AbortSignal): Promise<RenderResult>;
    /**
     * Text kept as a file the browser can download, named by its own content.
     * `extension` is the kind of file it is — `srt`, `vtt` — and never a path.
     */
    saveText(text: string, extension: string): Promise<{ url: string; bytes: number }>;
    /**
     * One file from several, in order, with a pause after each part. Returns the file, its measured
     * length and where each part starts and how long it lasts, pause included.
     */
    concatAudio(
      parts: { audioUrl: string; durationSeconds: number }[],
      gapSeconds: number,
      signal: AbortSignal,
    ): Promise<{ audioUrl: string; durationSeconds: number; segments: { start: number; durationSeconds: number }[] }>;
  }
}
