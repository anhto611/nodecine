import type { ZodTypeAny, z } from 'zod';
import type { EngineRef, LLMRef, TTSRef, Voice, Voiceover, Word } from '../types/payloads';
import type { VideoIR } from '../types/ir';
import type { ExportSettings, RenderProgress, RenderResult } from '../adapters/types';

/**
 * Everything a node needs from outside the graph. The executor runs on the server (ARCHITECTURE
 * §1.2); `server/services.server.ts` implements this with the providers and engines directly.
 * Tests implement it with fakes.
 */
export interface ReadPageOptions {
  /** Open the page in a browser and keep a picture of it; costs a browser launch, so it is a choice. */
  screenshot: boolean;
  width: number;
  height: number;
}

/** What a page said about itself, plus any pictures kept as scene assets (CORE_CONTRACTS §5.14). */
export interface PageRead {
  /** The address actually read, after redirects. */
  url: string;
  domain: string;
  title?: string;
  description?: string;
  siteName?: string;
  publishedAt?: string;
  /** The page's own picture (og:image), downloaded: `/api/assets/<hash>.<ext>`. */
  pictureAsset?: string;
  /** A photograph of the page, when one was asked for. */
  screenshotAsset?: string;
  /** Why the photograph did not come out, when one was asked for and failed; the read still stands. */
  shotProblem?: string;
}

/** How a music bed sits under a voice (CORE_CONTRACTS §5.15). */
export interface MixAudioOptions {
  /** A file name in this machine's music folder. */
  track: string;
  /** The bed's level against the voice, 0 to 1. */
  volume: number;
  /** How far the voice pushes the bed down, 0 (not at all) to 1 (flat). */
  duck: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}
export interface MixResult {
  audioUrl: string;
  durationSeconds: number;
}

/** What the Stock Images node asks a picture library for (CORE_CONTRACTS §5.19). */
export interface StockRequest {
  provider: 'pexels' | 'pixabay';
  query: string;
  orientation: 'landscape' | 'portrait' | 'square';
  /** The frame's long edge, so the footage is asked for at the size it will be shown. */
  longEdge: number;
  /**
   * `auto` tries a clip and takes a photograph when none fits; `clip` and `still` allow only the
   * one kind, and come back empty rather than substituting the other.
   */
  want: 'auto' | 'clip' | 'still';
  /** Pages already used in this video, so no two scenes get the same photograph. */
  used: string[];
}
export interface StockResult {
  /** Which content key it fills: a clip goes in `clip`, a photograph in `image`. */
  kind: 'clip' | 'photo';
  assetUrl: string;
  author: string;
  page: string;
  width: number;
  height: number;
  durationSec?: number;
}

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
   * Word timings for a voice-over whose text is known: forced alignment, not transcription. Returns
   * the words of `text` in order, each with its start and end in seconds.
   */
  alignWords(audioUrl: string, text: string, language: string, options: { model: string }, signal: AbortSignal): Promise<Word[]>;
  /** What the Web Fetcher asks for: the page, and optionally a photograph of it. */
  readPage(url: string, opts: ReadPageOptions, signal: AbortSignal): Promise<PageRead>;
  /** A voice-over with music under it, the same length as the voice. */
  mixAudio(voiceoverUrl: string, opts: MixAudioOptions, signal: AbortSignal): Promise<MixResult>;
  /**
   * Text kept as a file the browser can download, named by its own content (CORE_CONTRACTS §5.16).
   * `extension` is the kind of file it is — `srt`, `vtt` — and never a path.
   */
  saveText(text: string, extension: string): Promise<{ url: string; bytes: number }>;
  /** A recording from this machine's voice folder, brought in as a voice-over (CORE_CONTRACTS §5.17). */
  importAudio(fileName: string, signal: AbortSignal): Promise<{ audioUrl: string; durationSeconds: number }>;
  /** One piece of footage for one scene, kept as an asset; null when nothing in the library fits. */
  fetchStockMedia(req: StockRequest, signal: AbortSignal): Promise<StockResult | null>;
  /**
   * One file from several, in order, with a pause after each part. Returns the file, its measured
   * length and where each part starts and how long it lasts, pause included (CORE_CONTRACTS §5.3).
   */
  concatAudio(parts: { audioUrl: string; durationSeconds: number }[], gapSeconds: number, signal: AbortSignal): Promise<{ audioUrl: string; durationSeconds: number; segments: { start: number; durationSeconds: number }[] }>;
  now(): number;
}
