import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { createServerServices } from '@/server/services.server';
import type { VideoIR } from '@/contracts/types/ir';
import { renderWithProducer } from '@/nodes/hyperframes-engine/register.server';

/**
 * Manual, everything real: the Claude Code CLI draws the thing that spans the film and the scenes
 * that must leave room for it. Enabled with NODECINE_MANUAL_SPANNING=1 and a workflow file in
 * NODECINE_MANUAL_WF. What it proves is the one thing a fake model cannot: that a real answer keeps
 * the two sides in agreement — the layer arrives, every scene says where it wants it, and the
 * rectangle it fills is left clear.
 */
const enabled = process.env.NODECINE_MANUAL_SPANNING === '1';

describe.skipIf(!enabled)('the Illustrator drawing what spans the film, for real', () => {
  it('emits the layer, and every scene places it', async () => {
    registerNodes();
    const file = process.env.NODECINE_MANUAL_WF ?? '.nodecine/workflows/g16-hoa-si-ve-lop.json';
    const graph = (JSON.parse(readFileSync(file, 'utf8')) as { graph: Graph }).graph;
    const ex = new Executor(graph, createServerServices(), {
      onStateChange: (id, rt) => { if (rt.state === 'error' || rt.state === 'blocked') console.log(`[${id}] ${rt.state} ${rt.error?.code ?? rt.blockedBy?.code}: ${rt.error?.message ?? rt.blockedBy?.message}`); },
    });
    const { ok } = await ex.run();
    const ill = graph.nodes.find((n) => n.type === 'core/illustrator')!.id;
    const layer = ex.runtime(ill).outputs.layer?.payload as { kind: string; source: string; placement: string } | undefined;
    console.log('layer emitted:', !!layer, layer ? `${layer.source.length} chars, ${layer.placement}` : '');
    expect(ok).toBe(true);
    expect(layer, 'the illustrator drew no spanning layer').toBeTruthy();

    const asm = graph.nodes.find((n) => n.type === 'core/timeline-assembler')!.id;
    const ir = ex.runtime(asm).outputs.ir!.payload as VideoIR;
    console.log('tracks:', ir.tracks.map((t) => `${t.id}(${t.clips.length})`).join(' '));
    for (const b of ir.beats) console.log(`  beat ${b.index} stage=${JSON.stringify(b.stage)}`);
    // Every scene has to say where it wants the thing, or it cannot have composed around it.
    expect(ir.beats.every((b) => !!(b.stage as { spanning?: unknown } | undefined)?.spanning)).toBe(true);
    expect(ir.tracks.length).toBe(2);

    writeFileSync('.nodecine/tmp/g16-ir.json', JSON.stringify(ir));
    const r = await renderWithProducer(ir, { codec: 'h264', quality: 'medium', fileName: 'g16.mp4', resolution: '1080p' }, () => {}, new AbortController().signal);
    console.log('RENDER', path.join('.nodecine/tmp', path.basename(r.outputUrl)));
  }, 1_800_000);
});
