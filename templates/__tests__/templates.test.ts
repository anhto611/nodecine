import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/nodes';
import { getNodeType, _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetTemplates, listTemplates, registerTemplate, templateGraph } from '@/core/templates/registry';
import { topoSort, validateGraph } from '@/core/engine/graph';
import { registerTemplates } from '..';

/**
 * The one promise a shipped template makes: a user could have built it from a blank canvas. That
 * means every node type is one the Library offers and every parameter is one the node's own schema accepts. If a
 * template needs anything a user cannot reach, it is not a template — it is code in disguise.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetTemplates();
  registerNodes();
  registerTemplates();
});

describe('shipped templates', () => {
  it('use only node types the Library offers', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes) expect(getNodeType(n.type), `${t.id}: ${n.type}`).toBeDefined();
    }
  });

  it('give every node parameters its own schema accepts', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes) {
        const def = getNodeType(n.type)!;
        const parsed = def.paramsSchema.safeParse(n.params);
        expect(parsed.success, `${t.id}/${n.id}: ${parsed.success ? '' : parsed.error.message}`).toBe(true);
      }
    }
  });

  it('wire without cycles, and open with nothing missing except what the user must type', () => {
    for (const t of listTemplates()) {
      const g = templateGraph(t);
      expect(() => topoSort(g)).not.toThrow();
      const issues = validateGraph(g);
      expect(issues.filter((i) => i.severity === 'error').map((i) => i.code), t.id).toEqual([]);
    }
  });

  it('hand out a copy, never the stored graph', () => {
    registerTemplate({ id: 'copy-check', name: 'Copy check', category: 'test', graph: { nodes: [{ id: 'n', type: 'core/tts-engine', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] } });
    const t = listTemplates().find((x) => x.id === 'copy-check')!;
    const g = templateGraph(t);
    g.nodes[0]!.params.mutated = true;
    expect('mutated' in templateGraph(t).nodes[0]!.params).toBe(false);
  });
});
