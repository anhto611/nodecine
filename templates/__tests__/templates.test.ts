import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/nodes';
import { getNodeType, _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetTemplates, listTemplates, templateGraph } from '@/core/templates/registry';
import { topoSort, validateGraph } from '@/core/engine/graph';
import { registerTemplates } from '..';
import { shapeOfTemplate } from '@/components/panels/TemplatePlayer';
import { SCREENWRITER } from '@/nodes/screenwriter/node';
import type { Beat } from '@/nodes/screenwriter/beats';

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

/** The Illustrator downstream of a script node, following `scenes` however many hops it takes (Stock Media may sit between). */
function illustratorAfter(t: ReturnType<typeof listTemplates>[number], nodeId: string) {
  const seen = new Set<string>();
  for (let at = nodeId; !seen.has(at); ) {
    seen.add(at);
    const edge = t.graph.edges.find((e) => e.source === at && e.sourcePort === 'scenes');
    const next = t.graph.nodes.find((n) => n.id === edge?.target);
    if (!next) return undefined;
    if (next.type === 'core/illustrator') return next;
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

  it('send every screenwriter and script into an Illustrator that has a brief and a model', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === SCREENWRITER || n.type === 'core/static-script')) {
        const ill = illustratorAfter(t, n.id);
        expect(ill, `${t.id}/${n.id}: illustrator`).toBeDefined();
        expect(String(ill!.params.brief).length, `${t.id}: brief`).toBeGreaterThan(20);
        expect(t.graph.edges.some((e) => e.target === ill!.id && e.targetPort === 'llm'), `${t.id}: llm wired into the illustrator`).toBe(true);
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
  it('say on the card the shape their own illustrator draws', () => {
    for (const t of listTemplates()) {
      const shape = shapeOfTemplate(t.graph);
      const preset = t.graph.nodes.find((n) => n.type === 'core/illustrator')?.params.frame;
      if (!preset) { expect(shape).toBeNull(); continue; }
      expect(shape!.ratio).toBe(preset);
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
