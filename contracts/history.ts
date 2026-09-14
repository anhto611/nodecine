import type { VideoIR } from './types/ir';

/** In-session run history. */
export interface RunRecord {
  seq: number;
  startedAt: number;
  durationMs: number;
  ir: VideoIR;
  /** Filled by the first Video Output that succeeds in this run. */
  thumbnailDataUrl?: string;
  engineId?: string;
  exports: { fileName: string; bytes: number; outputUrl: string }[];
}
