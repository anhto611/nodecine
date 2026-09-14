import { JobHub, type Job, type JobRecorder } from '@/server/jobs';
import type { Executor } from '@/core/engine/executor';
import type { RunRecord } from '@/contracts/history';
import type { VideoIR } from '@/contracts/types/ir';
import { migrateIR } from '@/contracts/types/migrate-ir';
import { NODE_FEATURES } from '@/capsules/nodes';
import { NODE_SOURCES } from '@/capsules/nodes/.generated/server';
import { fingerprintFor } from '@/server/fingerprints';
import { ensureServerRegistrations } from './register';
import { createServerServices } from './services.server';

/**
 * The job hub as the contracts run it: the services that reach models, voices and engines, and a run
 * history made of films. The hub itself (`server/jobs.ts`) knows neither.
 */

const hasNodeFeature = (type: string, feature: string): boolean => NODE_FEATURES[type]?.includes(feature) ?? false;
const HISTORY_PER_KEY = 20;

/** What a run keeps: the film it made, the engine that played it, and every file exported from it. */
export interface FilmResult {
  ir: VideoIR;
  engineId?: string;
  durationMs: number;
  exports: { fileName: string; bytes: number; outputUrl: string }[];
}

export const filmRecorder: JobRecorder = {
  /** A run that reached an IR goes into the history, with the engine the player used. */
  run(job: Job, executor: Executor): FilmResult | undefined {
    const graph = executor.getGraph();
    const carrier = graph.nodes.find((n) => hasNodeFeature(n.type, 'history-ir'));
    const ir = carrier ? (executor.runtime(carrier.id).outputs.ir?.payload as VideoIR | undefined) : undefined;
    if (!ir) return undefined;
    // The engine is the player node's own setting, so it is read off that node rather than
    // followed back along a wire.
    const player = graph.nodes.find((n) => hasNodeFeature(n.type, 'history-preview') && executor.runtime(n.id).state === 'success');
    const engineId = player ? String((player.params as { engineId?: string }).engineId ?? '') : '';
    return { ir, ...(engineId ? { engineId } : {}), durationMs: Date.now() - (job.startedAt ?? job.createdAt), exports: [] };
  },

  /** An MP4 export files its result under the run it came from. */
  node(job: Job, executor: Executor, lastRun: Job | undefined): boolean {
    if (!job.ok || !job.nodeId) return false;
    const node = executor.getGraph().nodes.find((n) => n.id === job.nodeId);
    if (!node || !hasNodeFeature(node.type, 'history-file-export')) return false;
    const file = executor.runtime(job.nodeId).result as { fileName?: string; bytes?: number; outputUrl?: string } | undefined;
    const film = lastRun?.result as FilmResult | undefined;
    if (!file?.outputUrl || !film) return false;
    film.exports = [...film.exports.filter((x) => x.outputUrl !== file.outputUrl), { fileName: file.fileName ?? 'video.mp4', bytes: file.bytes ?? 0, outputUrl: file.outputUrl }];
    return true;
  },

  /** A film recorded by an older build carries that build's IR; brought forward, or dropped when no version reads it. */
  load(result: unknown): FilmResult | undefined {
    const film = result as FilmResult | undefined;
    if (!film?.ir) return undefined;
    return { ...film, ir: migrateIR(film.ir) };
  },

  /** History entries for a workflow, newest first, read off the runs that produced a film. */
  history(jobs: Job[], key: string): RunRecord[] {
    const runs = jobs.filter((j) => j.key === key && j.kind === 'run' && j.result).sort((a, b) => a.createdAt - b.createdAt);
    return runs
      .map((j, i) => { const film = j.result as FilmResult; return { seq: i + 1, startedAt: j.startedAt ?? j.createdAt, durationMs: film.durationMs, ir: film.ir, engineId: film.engineId, exports: film.exports }; })
      .reverse()
      .slice(0, HISTORY_PER_KEY);
  },
};

/** One hub per process. Kept on globalThis so Next's dev reloads do not orphan a running queue. */
export function jobHub(): JobHub {
  const g = globalThis as unknown as { __nodecineJobHub?: JobHub };
  if (!g.__nodecineJobHub) {
    g.__nodecineJobHub = new JobHub((workflow) => createServerServices({ workflow }), {
      recorder: filmRecorder,
      prepare: ensureServerRegistrations,
      fingerprint: fingerprintFor(NODE_SOURCES),
    });
  }
  return g.__nodecineJobHub;
}
