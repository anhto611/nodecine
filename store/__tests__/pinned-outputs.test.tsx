import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStudio, useInputPayload, useOutputPayload } from '@/store/useStudio';
import { validateGraph } from '@/core/engine/graph';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { registerNodes } from '@/nodes';
import type { Graph } from '@/core/engine/graph';

/**
 * What a pinned node shows before anything has run (CORE_CONTRACTS §1.5).
 *
 * A pin is how a result becomes part of the workflow: the node hands its stored outputs back and
 * never runs. Reading only the live runtime meant that opening a workflow whose set and plates were
 * pinned showed two empty cards with the drawings sitting in the file, and the only way to see them
 * was to start a run — the one thing a pin exists to make unnecessary.
 */

const at = '2026-09-12T00:00:00.000Z';
const graph: Graph = {
  nodes: [
    { id: 'set', type: 'core/set', params: {}, bypassed: false, position: { x: 0, y: 0 }, pinned: { outputs: { style: { name: 'a sheet' } }, at } },
    { id: 'plates', type: 'core/plates', params: {}, bypassed: false, position: { x: 0, y: 0 }, pinned: { outputs: { plates: { plates: [] } }, at } },
  ],
  edges: [{ id: 'e', source: 'set', sourcePort: 'style', target: 'plates', targetPort: 'style' }],
};

describe('a pinned node with no run behind it', () => {
  it('shows on its own card what the pin holds', () => {
    useStudio.setState({ graph, runtimes: {} });
    expect(renderHook(() => useOutputPayload('set', 'style')).result.current).toEqual({ name: 'a sheet' });
  });

  it('feeds the card downstream of it too', () => {
    useStudio.setState({ graph, runtimes: {} });
    expect(renderHook(() => useInputPayload('plates', 'style')).result.current).toEqual({ name: 'a sheet' });
  });

  it('gives way to a run, which is the newer answer', () => {
    const packet = { type: 'StyleSheet', payload: { name: 'just drawn' }, producedAt: 0, signature: 's' };
    useStudio.setState({ graph, runtimes: { set: { state: 'success', outputs: { style: packet } } as never } });
    expect(renderHook(() => useOutputPayload('set', 'style')).result.current).toEqual({ name: 'just drawn' });
  });
});

describe('the warning about an input with no wire', () => {
  it('is not said of a pinned node, which never reads its inputs', () => {
    _resetNodeRegistry();
    registerNodes();
    // The plate maker's `scenes` is required and unwired here. Wiring it would be a cycle, and the
    // node is pinned, so nothing will ever read it.
    const unconnected = validateGraph(graph).filter((i) => i.code === 'GRAPH_PORT_UNCONNECTED');
    expect(unconnected).toEqual([]);
  });

  it('is still said of a node that will run', () => {
    _resetNodeRegistry();
    registerNodes();
    const thawed: Graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === 'plates' ? { ...n, pinned: undefined } : n)) };
    expect(validateGraph(thawed).some((i) => i.code === 'GRAPH_PORT_UNCONNECTED' && i.nodeId === 'plates')).toBe(true);
  });
});
