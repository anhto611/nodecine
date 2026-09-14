import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStudio, useInputPayload, useOutputPayload } from '@/store/useStudio';
import { validateGraph } from '@/core/engine/graph';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { registerTestKit } from '@/core/__tests__/kit';
import type { Graph } from '@/core/engine/graph';

/**
 * What a pinned node shows before anything has run (CORE_CONTRACTS §1.5).
 *
 * A pin is how a result becomes part of the workflow: the node hands its stored outputs back and
 * never runs. Reading only the live runtime meant that opening a workflow with pinned nodes showed
 * empty cards with the results sitting in the file, and the only way to see them was to start a
 * run — the one thing a pin exists to make unnecessary.
 */

const at = '2026-09-12T00:00:00.000Z';
const graph: Graph = {
  nodes: [
    { id: 'source', type: 'test/source', params: {}, bypassed: false, position: { x: 0, y: 0 }, pinned: { outputs: { out: { text: 'pinned' } }, at } },
    { id: 'voice', type: 'test/voice', params: {}, bypassed: false, position: { x: 0, y: 0 }, pinned: { outputs: { out: { text: 'spoken' } }, at } },
    { id: 'join', type: 'test/join', params: {}, bypassed: false, position: { x: 0, y: 0 } },
  ],
  edges: [{ id: 'e', source: 'source', sourcePort: 'out', target: 'join', targetPort: 'in' }],
};

describe('a pinned node with no run behind it', () => {
  it('shows on its own card what the pin holds', () => {
    useStudio.setState({ graph, runtimes: {} });
    expect(renderHook(() => useOutputPayload('source', 'out')).result.current).toEqual({ text: 'pinned' });
  });

  it('feeds the card downstream of it too', () => {
    useStudio.setState({ graph, runtimes: {} });
    expect(renderHook(() => useInputPayload('join', 'in')).result.current).toEqual({ text: 'pinned' });
  });

  it('gives way to a run, which is the newer answer', () => {
    const packet = { type: 'TestText', payload: { text: 'just run' }, producedAt: 0, signature: 's' };
    useStudio.setState({ graph, runtimes: { source: { state: 'success', outputs: { out: packet } } as never } });
    expect(renderHook(() => useOutputPayload('source', 'out')).result.current).toEqual({ text: 'just run' });
  });
});

describe('the warning about an input with no wire', () => {
  it('is not said of a pinned node, which never reads its inputs', () => {
    _resetNodeRegistry();
    registerTestKit();
    // The voice's `in` is required and unwired here, but the node is pinned, so nothing will ever read it.
    const unconnected = validateGraph(graph).filter((i) => i.code === 'GRAPH_PORT_UNCONNECTED');
    expect(unconnected).toEqual([]);
  });

  it('is still said of a node that will run', () => {
    _resetNodeRegistry();
    registerTestKit();
    const thawed: Graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === 'voice' ? { ...n, pinned: undefined } : n)) };
    expect(validateGraph(thawed).some((i) => i.code === 'GRAPH_PORT_UNCONNECTED' && i.nodeId === 'voice')).toBe(true);
  });
});
