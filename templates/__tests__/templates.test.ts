import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/nodes';
import { getNodeType, _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetTemplates, listTemplates, templateGraph } from '@/core/templates/registry';
import { topoSort, validateGraph } from '@/core/engine/graph';
import { registerTemplates } from '..';
import { shapeOfTemplate } from '@/components/panels/TemplatePlayer';

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

/** The Plate Maker downstream of a script node, following `scenes` however many hops it takes (Stock Media may sit between). */
function platesAfter(t: ReturnType<typeof listTemplates>[number], nodeId: string) {
  const seen = new Set<string>();
  for (let at = nodeId; !seen.has(at); ) {
    seen.add(at);
    const edge = t.graph.edges.find((e) => e.source === at && e.sourcePort === 'scenes');
    const next = t.graph.nodes.find((n) => n.id === edge?.target);
    if (!next) return undefined;
    if (next.type === 'core/plates') return next;
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

  it('send every screenwriter and script into a Plate Maker with a model, beside a Set with a brief', () => {
    // The model is a setting on the node that needs it (§1.3); it was a wired provider node until
    // 2026-09-12, and asserting the wire here was asserting the shape of that older build.
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === 'core/screenwriter' || n.type === 'core/static-script')) {
        const plates = platesAfter(t, n.id);
        expect(plates, `${t.id}/${n.id}: plate maker`).toBeDefined();
        expect(String(plates!.params.llmProvider), `${t.id}: the plate maker names no model`).not.toBe('');
        // The look is the Set's now; the Illustrator carried both until 2026-09-13.
        const set = t.graph.nodes.find((x) => x.type === 'core/set');
        expect(set, `${t.id}: set`).toBeDefined();
        expect(String(set!.params.brief).length, `${t.id}: brief`).toBeGreaterThan(20);
      }
    }
  });

  it('wire without cycles, and open with nothing missing except what the user must type', () => {
    for (const t of listTemplates()) {
      const g = templateGraph(t);
      expect(() => topoSort(g)).not.toThrow();
      const issues = validateGraph(g);
      expect(issues.filter((i) => i.severity === 'error').map((i) => i.code), t.id).toEqual([]);
      // github-showcase ships with an empty Input Trigger: the repo link is the one thing only the
      // user has. That is a warning and never an error — an empty box must not disable Run.
      const warned = issues.filter((i) => i.severity === 'warning').map((i) => i.code);
      if (t.id === 'github-showcase') expect(warned).toContain('INPUT_EMPTY');
    }
  });

  // The card is what a person picks a template by, so what it says about the frame must come from
  // the template. A hardcoded "9:16" was right for four templates and a lie about the fifth.
  it('say on the card the shape their own set is drawn to', () => {
    for (const t of listTemplates()) {
      const shape = shapeOfTemplate(t.graph);
      const preset = t.graph.nodes.find((n) => n.type === 'core/set')?.params.frame;
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
    const writer = t.graph.nodes.find((n) => n.type === 'core/screenwriter')!;
    const bound = (writer.params.beats as { count: number; factBindings: Record<string, string> }[]).flatMap((s) => Object.values(s.factBindings));
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
    const writer = t.graph.nodes.find((n) => n.type === 'core/screenwriter')!;
    expect((writer.params.beats as { count: number; factBindings: Record<string, string> }[]).reduce((n, s) => n + s.count, 0)).toBe(5);
  });
});
