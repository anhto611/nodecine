import type { Capability, Style, EngineRef } from '../types/payloads';
import type { VideoIR } from '../types/ir';

/** Engine adapter interface (CORE_CONTRACTS §6.1). Implementations live outside core/ and self-register. */

export interface ExportSettings {
  codec: 'h264' | 'h265';
  quality: 'high' | 'medium' | 'low';
  fileName: string;
  /** Output resolution by short side; the design coordinates stay the plan's and are scaled at render (CORE_CONTRACTS §5.6). */
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

/** One scene to look at outside a film (CORE_CONTRACTS §2.8): the style, the drawing, the video's values, optional sample facts and caption. */
export interface ScenePreviewOptions {
  style: Style;
  source: string;
  width?: number;
  height?: number;
  vars?: Record<string, string>;
  facts?: Record<string, unknown>;
  /** A sample caption line, to judge where the scene puts captions. */
  captions?: string;
  /**
   * Run the scene's script on a looping timeline; needs gsap's source inlined.
   *
   * Not a nicety for scenes that merely move: a drawing that spans the film is written to be placed
   * and revealed by its own script — `visibility: hidden` until an `autoAlpha` tween — so a still of
   * one is an empty frame, every time.
   */
  animate?: { gsapSource: string; loopSeconds?: number };
}

export interface EngineAdapter {
  readonly engineId: string;
  readonly displayName: string;
  readonly adapterVersion: string;
  probe(): Promise<{ preview: Capability; render: Capability }>;
  /** Client-side only. */
  mountPlayer(element: HTMLElement, ir: VideoIR): PlayerHandle;
  /**
   * Client-side, optional: one scene as a self-contained page the Studio shows in a sandboxed
   * iframe (the storyboard, a modal). An engine that cannot draw a still leaves it out.
   */
  previewScene?(options: ScenePreviewOptions): string;
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
