import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/nodes';
import { getNodeType, _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetTemplates, listTemplates, templateGraph } from '@/core/templates/registry';
import { topoSort, validateGraph } from '@/core/engine/graph';
import { registerTemplates } from '..';
import { AI_DIRECTOR } from '@/nodes/director/node';
import type { Beat } from '@/nodes/director/beats';
import type { BlockDef } from '@/core/types/payloads';

/**
 * The one promise a shipped template makes: a user could have built it from a blank canvas. That
 * means every node type is one the Library offers, every block the Look casts is one it carries, and every parameter is one the node's own schema accepts. If a
 * template needs anything a user cannot reach, it is not a template — it is code in disguise.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetTemplates();
  registerNodes();
  registerTemplates();
});

/** The Look downstream of a script node: the node its `scenes` port feeds. */
function lookAfter(t: ReturnType<typeof listTemplates>[number], nodeId: string) {
  const edge = t.graph.edges.find((e) => e.source === nodeId && e.sourcePort === 'scenes');
  return t.graph.nodes.find((n) => n.id === edge?.target && n.type === 'core/look');
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

  it('send every director and script into a Look whose casting names only blocks it has, for roles it will get', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === AI_DIRECTOR || n.type === 'core/static-script')) {
        const look = lookAfter(t, n.id);
        expect(look, `${t.id}/${n.id}: look`).toBeDefined();
        const blocks = (look!.params.blocks as BlockDef[]).map((b) => b.id);
        const roles = n.type === AI_DIRECTOR ? (n.params.beats as Beat[]).map((b) => b.role) : (n.params.scenes as { role: string }[]).map((s) => s.role);
        for (const c of look!.params.casting as { role: string; block?: string; tone?: string }[]) {
          expect(roles, `${t.id}: cast role ${c.role}`).toContain(c.role);
          if (c.block) expect(blocks, `${t.id}: cast block ${c.block}`).toContain(c.block);
          if (c.tone) expect(Object.keys(look!.params.tones as Record<string, unknown>), `${t.id}: cast tone ${c.tone}`).toContain(c.tone);
        }
      }
    }
  });

  it('bind facts to content keys some block of the Look actually shows', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === AI_DIRECTOR)) {
        const blocks = lookAfter(t, n.id)!.params.blocks as BlockDef[];
        const shown = new Set(blocks.flatMap((b) => Object.entries(b.props).map(([name, f]) => f.content ?? name)));
        for (const beat of n.params.beats as Beat[]) for (const key of Object.keys(beat.factBindings)) expect(shown.has(key), `${t.id}: ${beat.role}.${key}`).toBe(true);
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
