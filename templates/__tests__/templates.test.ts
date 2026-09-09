import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/nodes';
import { getNodeType, _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetTemplates, listTemplates, templateGraph } from '@/core/templates/registry';
import { topoSort, validateGraph } from '@/core/engine/graph';
import { registerTemplates } from '..';
import { shapeOfTemplate } from '@/components/panels/TemplatePlayer';
import { SCREENWRITER } from '@/nodes/screenwriter/node';
import type { Beat } from '@/nodes/screenwriter/beats';
import type { BlockDef } from '@/core/types/payloads';

/**
 * The one promise a shipped template makes: a user could have built it from a blank canvas. That
 * means every node type is one the Library offers, every block the Art Director casts is one it carries, and every parameter is one the node's own schema accepts. If a
 * template needs anything a user cannot reach, it is not a template — it is code in disguise.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetTemplates();
  registerNodes();
  registerTemplates();
});

/**
 * The Art Director downstream of a script node, following `scenes` however many hops it takes: a
 * node that passes the script along on its way — Stock Images putting a picture on every scene —
 * sits between them without changing who casts.
 */
function lookAfter(t: ReturnType<typeof listTemplates>[number], nodeId: string) {
  const seen = new Set<string>();
  for (let at = nodeId; !seen.has(at); ) {
    seen.add(at);
    const edge = t.graph.edges.find((e) => e.source === at && e.sourcePort === 'scenes');
    const next = t.graph.nodes.find((n) => n.id === edge?.target);
    if (!next) return undefined;
    if (next.type === 'core/art-director') return next;
    at = next.id;
  }
  return undefined;
}

describe('shipped templates', () => {
  it('there are five, and they register from JSON', () => {
    expect(listTemplates().map((t) => t.id).sort()).toEqual(['ai-news', 'compare-explainer', 'github-showcase', 'quote-cards', 'still-wide']);
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

  it('send every screenwriter and script into an Art Director whose casting names only blocks it has, for roles it will get', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === SCREENWRITER || n.type === 'core/static-script')) {
        const look = lookAfter(t, n.id);
        expect(look, `${t.id}/${n.id}: look`).toBeDefined();
        const blocks = (look!.params.blocks as BlockDef[]).map((b) => b.id);
        const roles = n.type === SCREENWRITER ? (n.params.beats as Beat[]).map((b) => b.role) : (n.params.scenes as { role: string }[]).map((s) => s.role);
        for (const c of look!.params.casting as { role: string; block?: string; tone?: string }[]) {
          expect(roles, `${t.id}: cast role ${c.role}`).toContain(c.role);
          if (c.block) expect(blocks, `${t.id}: cast block ${c.block}`).toContain(c.block);
          if (c.tone) expect(Object.keys(look!.params.tones as Record<string, unknown>), `${t.id}: cast tone ${c.tone}`).toContain(c.tone);
        }
      }
    }
  });

  it('bind facts to content keys some block of the Art Director actually shows', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === SCREENWRITER)) {
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

  // The card is what a person picks a template by, so what it says about the frame must come from
  // the template. A hardcoded "9:16" was right for four templates and a lie about the fifth.
  it('say on the card the shape their own stage renders', () => {
    for (const t of listTemplates()) {
      const shape = shapeOfTemplate(t.graph);
      const stage = t.graph.nodes.find((n) => n.type === 'core/art-director')?.params as { frame?: { width: number; height: number } } | undefined;
      if (!stage?.frame) { expect(shape).toBeNull(); continue; }
      const { width, height } = stage.frame;
      const [w, h] = shape!.ratio.split(':').map(Number) as [number, number];
      expect(w / h).toBeCloseTo(width / height, 5);
      expect(shape!.fps).toBe(t.graph.nodes.find((n) => n.type === 'core/timeline-assembler')?.params.fps ?? 30);
    }
    expect(shapeOfTemplate(listTemplates().find((t) => t.id === 'still-wide')!.graph)).toEqual({ ratio: '16:9', fps: 30 });
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
    const writer = t.graph.nodes.find((n) => n.type === SCREENWRITER)!;
    const bound = (writer.params.beats as Beat[]).flatMap((s) => Object.values(s.factBindings));
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
    const writer = t.graph.nodes.find((n) => n.type === SCREENWRITER)!;
    expect((writer.params.beats as Beat[]).reduce((n, s) => n + s.count, 0)).toBe(5);
  });
});
