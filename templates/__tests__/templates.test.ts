import { beforeEach, describe, expect, it } from 'vitest';
import { registerCoreNodes } from '@/core/nodes';
import { getNodeType, _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetTemplates, listTemplates, templateGraph } from '@/core/templates/registry';
import { topoSort, validateGraph } from '@/core/engine/graph';
import { registerTemplates } from '..';
import { AI_DIRECTOR } from '@/core/nodes/ai-director';
import type { Beat } from '@/core/director/beats';
import type { BlockDef } from '@/core/types/payloads';

/**
 * The one promise a shipped template makes: a user could have built it from a blank canvas. That
 * means every node type is one the Library offers, every block a director may pick is a Block node
 * wired into it, and every parameter is one the node's own schema accepts. If a
 * template needs anything a user cannot reach, it is not a template — it is code in disguise.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetTemplates();
  registerCoreNodes();
  registerTemplates();
});

/** Every block of every Blocks node wired into a node's `blocks` port. */
function wiredBlocks(t: ReturnType<typeof listTemplates>[number], nodeId: string): BlockDef[] {
  return t.graph.edges
    .filter((e) => e.target === nodeId && e.targetPort === 'blocks')
    .flatMap((e) => (t.graph.nodes.find((n) => n.id === e.source)!.params as unknown as { blocks: BlockDef[] }).blocks);
}

describe('shipped templates', () => {
  it('there are three, and they register from JSON', () => {
    expect(listTemplates().map((t) => t.id).sort()).toEqual(['github-showcase', 'quote-cards', 'static-script']);
  });

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

  it('give every director and script a stage and only blocks that are wired into it', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === AI_DIRECTOR || n.type === 'core/static-script')) {
        expect(t.graph.edges.some((e) => e.target === n.id && e.targetPort === 'stage'), `${t.id}/${n.id}: stage`).toBe(true);
        const wired = wiredBlocks(t, n.id).map((b) => b.id);
        expect(wired.length, `${t.id}/${n.id}: blocks`).toBeGreaterThan(0);
        const named = n.type === AI_DIRECTOR ? (n.params.beats as Beat[]).flatMap((b) => b.blocks) : (n.params.scenes as { blockId: string }[]).map((s) => s.blockId);
        for (const id of named) expect(wired, `${t.id}/${n.id}: ${id}`).toContain(id);
      }
    }
  });

  it('bind facts only to props the beat\'s blocks actually have', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === AI_DIRECTOR)) {
        const wired = wiredBlocks(t, n.id);
        for (const beat of n.params.beats as Beat[]) {
          const allowed = beat.blocks.length ? wired.filter((b) => beat.blocks.includes(b.id)) : wired;
          const keys = new Set(allowed.flatMap((b) => Object.keys(b.props)));
          for (const prop of Object.keys(beat.factBindings)) expect(keys.has(prop), `${t.id}: ${beat.role}.${prop}`).toBe(true);
        }
      }
    }
  });

  it('wire without cycles, and open with nothing missing except what the user must type', () => {
    for (const t of listTemplates()) {
      const g = templateGraph(t);
      expect(() => topoSort(g)).not.toThrow();
      const errors = validateGraph(g).filter((i) => i.severity === 'error').map((i) => i.code);
      // github-showcase ships with an empty Input Trigger: the repo link is the one thing only the user has.
      expect(errors, t.id).toEqual(t.id === 'github-showcase' ? ['INPUT_EMPTY'] : []);
    }
  });

  it('hand out a copy, never the stored graph', () => {
    const t = listTemplates()[0]!;
    const g = templateGraph(t);
    g.nodes[0]!.params.mutated = true;
    expect('mutated' in templateGraph(t).nodes[0]!.params).toBe(false);
  });
});

describe('the GitHub showcase, as data', () => {
  it('routes stars, the install command and the url around the model, not through it', () => {
    const t = listTemplates().find((x) => x.id === 'github-showcase')!;
    const director = t.graph.nodes.find((n) => n.type === AI_DIRECTOR)!;
    const bound = (director.params.beats as Beat[]).flatMap((s) => Object.values(s.factBindings));
    expect([...new Set(bound)].sort()).toEqual(['installCommand', 'name', 'stars', 'url']);
    // The same fact sheet also feeds the assembler directly, which is where those bindings resolve.
    expect(t.graph.edges.some((e) => e.source === 'fetcher' && e.target === 'assembler' && e.targetPort === 'facts')).toBe(true);
  });
});

describe('the quote reel, as data', () => {
  it('has no fact source and no bindings, and gets its subject from the Input Trigger', () => {
    const t = listTemplates().find((x) => x.id === 'quote-cards')!;
    expect(t.graph.nodes.some((n) => n.type.endsWith('/github-fetcher'))).toBe(false);
    expect(t.graph.edges.some((e) => e.targetPort === 'facts')).toBe(false);
    expect(t.graph.edges.some((e) => e.source === 'input' && e.targetPort === 'source')).toBe(true);
    const director = t.graph.nodes.find((n) => n.type === AI_DIRECTOR)!;
    expect((director.params.beats as Beat[]).reduce((n, s) => n + s.count, 0)).toBe(5);
  });
});
