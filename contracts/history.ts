import type { Composition } from './types/composition';

/** One run in a workflow's history: the composition it filled, the preview it played, and every file rendered from it. */
export interface RunRecord {
  seq: number;
  startedAt: number;
  durationMs: number;
  composition: Composition;
  /** The page the player loaded for it, so the run can be played again without running. */
  preview?: { engineId: string; url: string; width: number; height: number };
  exports: { fileName: string; bytes: number; outputUrl: string }[];
}
