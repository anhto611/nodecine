import { JobHub, type Job, type JobRecorder } from '@/server/jobs';
import type { Executor } from '@/core/engine/executor';
import type { RunRecord } from '@/contracts/history';
import { CompositionSchema, type Composition } from '@/contracts/types/composition';
import { NODE_FEATURES } from '@/capsules/nodes';
import { NODE_SOURCES } from '@/capsules/nodes/.generated/server';
import { fingerprintFor } from '@/server/fingerprints';
import { ensureServerRegistrations } from './register';
import { createServerServices } from './services.server';

/**
 * The job hub as the contracts run it: the services that reach models, voices and engines, and a run
 * history made of filled compositions. The hub itself (`server/jobs.ts`) knows neither.
 */

const hasNodeFeature = (type: string, feature: string): boolean => NODE_FEATURES[type]?.includes(feature) ?? false;
const HISTORY_PER_KEY = 20;

/** What a run keeps: the composition the player played, the page it loaded, and every file rendered from it. */
export interface FilmResult {
  composition: Composition;
  preview?: RunRecord['preview'];
  durationMs: number;
  exports: { fileName: string; bytes: number; outputUrl: string }[];
}

export const filmRecorder: JobRecorder = {
  /** A run whose player played something goes into the history: what was wired into the player, and the page it loaded. */
  run(job: Job, executor: Executor): FilmResult | undefined {
    const graph = executor.getGraph();
    const player = graph.nodes.find((n) => hasNodeFeature(n.type, 'history-preview') && executor.runtime(n.id).state === 'success');
    if (!player) return undefined;
    const wire = graph.edges.find((e) => e.target === player.id && e.targetPort === 'composition');
    const composition = wire ? (executor.runtime(wire.source).outputs[wire.sourcePort]?.payload as Composition | undefined) : undefined;
    if (!composition) return undefined;
    const r = executor.runtime(player.id).result as { engineId?: string; url?: string; width?: number; height?: number } | undefined;
    const preview = r?.engineId && r.url && r.width && r.height ? { engineId: r.engineId, url: r.url, width: r.width, height: r.height } : undefined;
    return { composition, ...(preview ? { preview } : {}), durationMs: Date.now() - (job.startedAt ?? job.createdAt), exports: [] };
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

  /** A run recorded by an older build carries something this build cannot play; it is dropped. */
  load(result: unknown): FilmResult | undefined {
    const film = result as FilmResult | undefined;
    if (!film || !CompositionSchema.safeParse(film.composition).success) return undefined;
    return film;
  },

  /** History entries for a workflow, newest first, read off the runs that played something. */
  history(jobs: Job[], key: string): RunRecord[] {
    const runs = jobs.filter((j) => j.key === key && j.kind === 'run' && j.result).sort((a, b) => a.createdAt - b.createdAt);
    return runs
      .map((j, i) => {
        const film = j.result as FilmResult;
        return { seq: i + 1, startedAt: j.startedAt ?? j.createdAt, durationMs: film.durationMs, composition: film.composition, preview: film.preview, exports: film.exports };
      })
      .reverse()
      .slice(0, HISTORY_PER_KEY);
  },
};

/**
 * The fingerprint of the code this hub was built with, measured once, now.
 *
 * The hub lives on globalThis and keeps running the node code it was created with, while Next reloads
 * modules around it. Measured on every run instead, the fingerprint followed the files on disk: an
 * edit gave a new signature to a result the old code produced, and that stale result was then kept
 * under the new code's name — after a restart the fixed node was never run, and its old output came
 * back from the cache. Frozen here, a signature always names the code that actually ran; an edit
 * reaches the hub, and the cache, with a restart.
 */
function frozenFingerprints(sources: Readonly<Record<string, string>>): (type: string) => string | undefined {
  const measure = fingerprintFor(sources);
  const frozen = new Map(Object.keys(sources).map((type) => [type, measure(type)] as const));
  return (type) => frozen.get(type);
}

/** One hub per process. Kept on globalThis so Next's dev reloads do not orphan a running queue. */
export function jobHub(): JobHub {
  const g = globalThis as unknown as { __nodecineJobHub?: JobHub };
  if (!g.__nodecineJobHub) {
    g.__nodecineJobHub = new JobHub((workflow) => createServerServices({ workflow }), {
      recorder: filmRecorder,
      prepare: ensureServerRegistrations,
      fingerprint: frozenFingerprints(NODE_SOURCES),
    });
  }
  return g.__nodecineJobHub;
}
