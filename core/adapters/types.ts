import type { Capability, EngineRef } from '../types/payloads';
import type { VideoIR } from '../types/ir';

/** Engine adapter interface (CORE_CONTRACTS §6.1). Implementations live outside core/ and self-register. */

export interface ExportSettings {
  codec: 'h264' | 'h265';
  quality: 'high' | 'medium' | 'low';
  fileName: string;
  /** Output resolution by short side; the design coordinates stay the stage's and are scaled at render (CORE_CONTRACTS §5.6). */
  resolution?: '1080p' | '1440p' | '2160p';
}

export interface RenderProgress {
  renderedFrames: number;
  totalFrames: number;
}

export interface RenderResult {
  outputUrl: string;
  bytes: number;
}

/** One still of the composition, for a cover image (CORE_CONTRACTS §5.18). */
export interface CaptureSettings {
  /** Where in the film to take it. Clamped into the film and quantised to a real frame. */
  atSeconds: number;
  resolution?: ExportSettings['resolution'];
}

export interface CaptureResult {
  outputUrl: string;
  bytes: number;
}

/** What the Video Output node gets back from mountPlayer: enough to drive the scene inspector. */
export interface PlayerHandle {
  unmount(): void;
  seekTo(frame: number): void;
  play(): void;
  pause(): void;
  /** Subscribe to frame updates; returns an unsubscribe. */
  onFrame(listener: (frame: number) => void): () => void;
}

export interface EngineAdapter {
  readonly engineId: string;
  readonly displayName: string;
  readonly adapterVersion: string;
  probe(): Promise<{ preview: Capability; render: Capability }>;
  /** Client-side only. */
  mountPlayer(element: HTMLElement, ir: VideoIR): PlayerHandle;
  /** Server-side only. */
  render(
    ir: VideoIR,
    settings: ExportSettings,
    onProgress: (p: RenderProgress) => void,
    signal: AbortSignal,
  ): Promise<RenderResult>;
  /**
   * Server-side only, and optional: an engine that cannot take a still simply leaves it out, and the
   * Poster node blocks with a reason instead of the contract growing a capability nobody reports.
   */
  capture?(ir: VideoIR, settings: CaptureSettings, signal: AbortSignal): Promise<CaptureResult>;
}

export type EngineAdapterFactory = (settings: Record<string, unknown>) => EngineAdapter;

export function makeEngineRef(
  adapter: EngineAdapter,
  capabilities: EngineRef['capabilities'],
  settings: Record<string, unknown>,
): EngineRef {
  return {
    engineId: adapter.engineId,
    displayName: adapter.displayName,
    adapterVersion: adapter.adapterVersion,
    capabilities,
    settings,
  };
}
