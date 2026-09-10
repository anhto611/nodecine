import { describe, it, expect, beforeEach } from 'vitest';
import { useStudio } from '@/store/useStudio';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { registerNodes } from '@/nodes';
import type { Graph } from '@/core/engine/graph';
import firstRun from '@/lib/first-run.json';

/**
 * Drawing a wire and moving the end of one are single changes, so each has to cost exactly one
 * Ctrl+Z and land the graph back where it was.
 */

const template = (): Graph => structuredClone(firstRun.graph as Graph);
let seq = 0;

beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
  // A fresh tab key each time: the undo history is kept per tab.
  useStudio.setState({ graph: template(), activeTab: `test-${seq++}`, tabs: [], executor: null, canUndo: false, canRedo: false });
});

const edgesInto = (g: Graph, target: string, port: string) => g.edges.filter((e) => e.target === target && e.targetPort === port);

describe('moving the end of a wire', () => {
  it('lands the wire on its new port', () => {
    const before = useStudio.getState().graph;
    const moved = useStudio.getState().reconnect('e4', { source: 'transcribe', sourcePort: 'voiceover', target: 'assembler', targetPort: 'voiceover' });
    expect(moved).toBe(true);
    const after = useStudio.getState().graph;
    expect(after.edges.some((e) => e.id === 'e4')).toBe(false);
    expect(edgesInto(after, 'assembler', 'voiceover').map((e) => e.source)).toEqual(['transcribe']);
    expect(after.edges).toHaveLength(before.edges.length);
  });

  it('takes one undo to put it back where it was', () => {
    const before = useStudio.getState().graph;
    useStudio.getState().reconnect('e4', { source: 'transcribe', sourcePort: 'voiceover', target: 'assembler', targetPort: 'voiceover' });
    useStudio.getState().undo();
    // The wire used to come off the store before the ports were checked, so the undo step recorded a
    // graph that had already lost it: one Ctrl+Z left the wire deleted instead of moving it back.
    expect(useStudio.getState().graph.edges).toEqual(before.edges);
    expect(useStudio.getState().canUndo).toBe(false);
  });

  it('refuses ports that do not agree and changes nothing', () => {
    const before = useStudio.getState().graph;
    const moved = useStudio.getState().reconnect('e4', { source: 'script', sourcePort: 'script', target: 'assembler', targetPort: 'voiceover' });
    expect(moved).toBe(false);
    expect(useStudio.getState().graph).toEqual(before);
    expect(useStudio.getState().canUndo).toBe(false);
  });
});

describe('drawing a wire', () => {
  it('replaces the one already on that input, and one undo brings it back', () => {
    const before = useStudio.getState().graph;
    expect(useStudio.getState().connect({ source: 'transcribe', sourcePort: 'voiceover', target: 'assembler', targetPort: 'voiceover' })).toBe(true);
    expect(edgesInto(useStudio.getState().graph, 'assembler', 'voiceover').map((e) => e.source)).toEqual(['transcribe']);
    useStudio.getState().undo();
    expect(useStudio.getState().graph.edges).toEqual(before.edges);
  });
});
