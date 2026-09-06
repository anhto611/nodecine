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
