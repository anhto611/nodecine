import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JobHub } from '@/server/jobs';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { pipeline, registerTestKit } from '@/core/__tests__/kit';
import { MemoryResultCache } from '@/core/engine/result-cache';

/**
 * The client retries a request the server answered with an empty 5xx, on the reading that the route
 * never ran. Being wrong about that must not cost a second render, so the submission carries the
 * browser's own id and the hub queues it once.
 */
describe('submitting the same request twice', () => {
  // Its own jobs directory: a test must not write into the run history of whoever is using the app.
  let dir = '';
  const previous = process.env.NODECINE_JOBS_DIR;
  beforeAll(() => { dir = mkdtempSync(path.join(tmpdir(), 'nodecine-jobs-')); process.env.NODECINE_JOBS_DIR = dir; });
  afterAll(() => { if (previous === undefined) delete process.env.NODECINE_JOBS_DIR; else process.env.NODECINE_JOBS_DIR = previous; rmSync(dir, { recursive: true, force: true }); });

  const graph = () => pipeline();
  const hub = () => { _resetNodeRegistry(); registerTestKit(); return new JobHub(() => ({}) as never, { cache: new MemoryResultCache() }); };

  it('queues one job and hands the same one back', () => {
    const h = hub();
    const first = h.submit({ key: 'idem-test', kind: 'run', graph: graph(), requestId: 'req-abc' });
    const second = h.submit({ key: 'idem-test', kind: 'run', graph: graph(), requestId: 'req-abc' });
    expect(second.id).toBe(first.id);
    expect(h.list().filter((j) => j.key === 'idem-test')).toHaveLength(1);
  });

  it('still queues two jobs for two different submissions', () => {
    const h = hub();
    const a = h.submit({ key: 'idem-test-2', kind: 'run', graph: graph(), requestId: 'req-1' });
    const b = h.submit({ key: 'idem-test-2', kind: 'run', graph: graph(), requestId: 'req-2' });
    expect(b.id).not.toBe(a.id);
  });
});
