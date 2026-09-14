import { describe, expect, it } from 'vitest';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import type { ScenePlan, AudioScript } from '@/contracts/types/payloads';
import { voiceTrackOf, type VideoIR } from '@/contracts/types/ir';
import { mediaPath, fileNameFromMediaUrl } from '@/server/paths';
import { createServerServices } from '@/server/services.server';
import githubShowcase from '@/templates/github-showcase.json';

/**
 * Manual, end to end, everything real: GitHub API, the Claude Code CLI, the system voice, the
 * HyperFrames producer. Enabled with NODECINE_E2E=1; NODECINE_E2E_REPO picks the repository and
 * NODECINE_E2E_OUT a path to copy the MP4 to. Runs the shipped GitHub template exactly as the Studio would.
 */
const enabled = process.env.NODECINE_E2E === '1';

describe.skipIf(!enabled)('github-showcase, end to end', () => {
  it('turns a repo link into a one-minute MP4', async () => {
    registerNodes();
    const graph = structuredClone(githubShowcase.graph) as Graph;
    graph.nodes.find((n) => n.id === 'input')!.params = { value: process.env.NODECINE_E2E_REPO ?? 'expressjs/express' };
    const services = createServerServices();
    const ex = new Executor(graph, services, {
      onStateChange: (id, rt) => { if (rt.state !== 'queued' && rt.state !== 'running') console.log(`[${id}] ${rt.state}${rt.error ? ` ${rt.error.code}: ${rt.error.message}` : ''}${rt.blockedBy ? ` blocked ${rt.blockedBy.code}: ${rt.blockedBy.message}` : ''}`); },
    });
    const t0 = Date.now();
    const { ok } = await ex.run();
    const plan = ex.runtime('illustrator').outputs.plan?.payload as ScenePlan | undefined;
    const script = ex.runtime('screenwriter').outputs.script?.payload as AudioScript | undefined;
    if (script) console.log(`narration (${script.text.split(/\s+/).length} words):\n${script.text}`);
    if (plan) console.log('scenes:', plan.scenes.length, 'in', plan.style.name);
    expect(ok).toBe(true);
    const ir = ex.runtime('assembler').outputs.ir!.payload as VideoIR;
    console.log(`video: ${(ir.meta.totalDurationInFrames / ir.meta.fps).toFixed(1)}s, ${ir.beats.length} scenes, voice ${((voiceTrackOf(ir)?.durationInFrames ?? 0) / ir.meta.fps).toFixed(2)}s`);
    const state = await ex.runNode('export');
    expect(state).toBe('success');
    const result = ex.runtime('export').result as { outputUrl: string; bytes: number };
    console.log('mp4:', result, 'total', Date.now() - t0, 'ms');
    if (process.env.NODECINE_E2E_OUT) await copyFile(mediaPath(fileNameFromMediaUrl(result.outputUrl)), path.resolve(process.env.NODECINE_E2E_OUT));
  }, 900_000);
});
