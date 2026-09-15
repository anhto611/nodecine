import type { Capability, EngineRef } from '../types/payloads';
import type { Composition } from '../types/composition';

/**
 * Engine adapter interface. An engine renders and previews compositions written for it, the way the
 * engine itself does; implementations live in `capsules/engines/` and self-register.
 */

export interface ExportSettings {
  quality: 'high' | 'medium' | 'low';
  fileName: string;
}

export interface RenderProgress {
  /** 0..1 */
  fraction: number;
  message?: string;
}

export interface RenderResult {
  outputUrl: string;
  bytes: number;
}

export interface PlayerOptions {
  url: string;
  width: number;
  height: number;
  controls?: boolean;
  still?: number;
  /** Plays as soon as it is ready, and from the start again at the end. */
  loop?: boolean;
}

/** What a player node gets back from mounting a preview. */
export interface PlayerHandle {
  unmount(): void;
  seekTo(seconds: number): void;
  play(): void;
  pause(): void;
  /** Subscribe to time updates, in seconds; returns an unsubscribe. */
  onTime(listener: (seconds: number) => void): () => void;
}

export interface EngineAdapter {
  readonly engineId: string;
  readonly displayName: string;
  readonly adapterVersion: string;
  probe(): Promise<{ preview: Capability; render: Capability }>;
  /** Server-side: a page the player can load for this composition, filled with its values. */
  preview(composition: Composition, signal: AbortSignal): Promise<{ url: string }>;
  /**
   * Client-side: play a prepared preview inside `element`. `controls: false` draws the picture alone;
   * `still` holds it paused at that second once loaded, for a thumbnail.
   */
  mountPlayer(element: HTMLElement, preview: PlayerOptions): PlayerHandle;
  /** Server-side: the composition, filled with its values, as a video file. */
  render(composition: Composition, settings: ExportSettings, onProgress: (p: RenderProgress) => void, signal: AbortSignal): Promise<RenderResult>;
}

export type EngineAdapterFactory = (settings: Record<string, unknown>) => EngineAdapter;

export function makeEngineRef(adapter: EngineAdapter, capabilities: EngineRef['capabilities'], settings: Record<string, unknown>): EngineRef {
  return { engineId: adapter.engineId, displayName: adapter.displayName, adapterVersion: adapter.adapterVersion, capabilities, settings };
}
