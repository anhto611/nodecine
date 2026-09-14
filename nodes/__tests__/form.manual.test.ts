import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { registerForms } from '@/forms';
import { createServerServices } from '@/server/services.server';
import type { VideoIR } from '@/contracts/types/ir';
import { renderWithProducer } from '@/nodes/hyperframes-engine/register.server';

/**
 * Manual, everything real: one workflow file, run with the Claude Code CLI, rendered to an MP4.
 * Enabled with NODECINE_MANUAL_FORM=1 and the file in NODECINE_MANUAL_WF. What it is for is the one
 * question a fake model cannot answer — whether a film form actually changes the film, or only the
 * prompt.
 */
const enabled = process.env.NODECINE_MANUAL_FORM === '1';

describe.skipIf(!enabled)('a workflow, run and rendered for real', () => {
  it('draws the film its form asks for', async () => {
    registerNodes();
    registerForms();
    const file = process.env.NODECINE_MANUAL_WF!;
    const graph = (JSON.parse(readFileSync(file, 'utf8')) as { graph: Graph }).graph;
    const ex = new Executor(graph, createServerServices(), {
      onStateChange: (id, rt) => { if (rt.state === 'error' || rt.state === 'blocked') console.log(`[${id}] ${rt.state} ${rt.error?.code ?? rt.blockedBy?.code}: ${rt.error?.message ?? rt.blockedBy?.message}`); },
    });
    const { ok } = await ex.run();
    expect(ok).toBe(true);

    const asm = graph.nodes.find((n) => n.type === 'core/timeline-assembler')!.id;
    const ir = ex.runtime(asm).outputs.ir!.payload as VideoIR;
    const clips = ir.tracks.flatMap((t) => t.clips).filter((c) => c.kind === 'code');
    console.log(`FILM ${path.basename(file)} · ${ir.beats.length} scenes · ${(ir.meta.totalDurationInFrames / ir.meta.fps).toFixed(1)}s · tracks ${ir.tracks.map((t) => t.id).join(',')}`);
    for (const c of clips) {
      if (c.kind !== 'code') continue;
      const script = /<script>([\s\S]*?)<\/script>/.exec(c.source)?.[1] ?? '';
      const words = (c.source.match(/class="word"/g) ?? []).length;
      console.log(`  ${c.id}: ${c.source.length} chars · ${(script.match(/\.(fromTo|to|set)\(/g) ?? []).length} tweens · ${(script.match(/nodecine\.when\(/g) ?? []).length} when() · ${(script.match(/nodecine\.count\(/g) ?? []).length} count() · ${(script.match(/nodecine\.frame\(/g) ?? []).length} frame() · ${words} word spans`);
    }
    const out = process.env.NODECINE_MANUAL_OUT;
    if (out) {
      const r = await renderWithProducer(ir, { codec: 'h264', quality: 'medium', fileName: `${path.basename(out)}`, resolution: '1080p' }, () => {}, new AbortController().signal);
      const { copyFile } = await import('node:fs/promises');
      const { ensureTmpDir } = await import('@/server/paths');
      await copyFile(path.join(await ensureTmpDir(), path.basename(r.outputUrl)), out);
      console.log('RENDER', out);
    }
  }, 2_400_000);
});
