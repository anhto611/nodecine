import { describe, it, expect } from 'vitest';
import type { Graph, NodeInstance } from '@/core/engine/graph';
import { setWorkflowModel, withWorkflowModel, workflowModel } from '../workflow-model';

/** One model for the whole workflow: what its agent thinks with, and what a node left empty writes with. */

const node = (id: string, params: Record<string, unknown>): NodeInstance => ({ id, type: 'x', params, bypassed: false, position: { x: 0, y: 0 } });
const first = { provider: 'first', settings: {} };

describe('workflow model', () => {
  it('is the one set on the workflow, else one its nodes name, else the fallback', () => {
    const named: Graph = { nodes: [node('a', { llmProvider: '' }), node('b', { llmProvider: 'codex', llmSettings: { model: 'm' } })], edges: [] };
    expect(workflowModel({ nodes: [], edges: [] }, first)).toEqual(first);
    expect(workflowModel(named, first)).toEqual({ provider: 'codex', settings: { model: 'm' } });
    expect(workflowModel(setWorkflowModel(named, { provider: 'agy', settings: {} }), first)).toEqual({ provider: 'agy', settings: {} });
  });

  it('fills only the nodes that leave their model empty', () => {
    const g = setWorkflowModel(
      { nodes: [node('a', { llmProvider: '', llmSettings: {} }), node('b', { llmProvider: 'codex' }), node('c', { about: '' })], edges: [] },
      { provider: 'agy', settings: { k: 1 } },
    );
    const filled = withWorkflowModel(g);
    expect(filled.nodes.map((n) => n.params.llmProvider)).toEqual(['agy', 'codex', undefined]);
    expect(filled.nodes[0]!.params.llmSettings).toEqual({ k: 1 });
    expect(filled.settings).toEqual(g.settings);
  });

  it('leaves a graph with nothing to fill as it was', () => {
    const g: Graph = { nodes: [node('b', { llmProvider: 'codex' })], edges: [] };
    expect(withWorkflowModel(g, first)).toBe(g);
  });
});
