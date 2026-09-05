import { beforeEach, describe, expect, it } from 'vitest';
import { registerCoreNodes } from '@/core/nodes';
import { getNodeType, _resetNodeRegistry } from '@/core/nodes/definition';
import { registerCoreScenes } from '@/core/scenes/title-card';
import { _resetSceneRegistry, getScene } from '@/core/scenes/registry';
import { _resetTemplates, listTemplates, templateGraph } from '@/core/templates/registry';
import { topoSort, validateGraph } from '@/core/engine/graph';
import { installExtras } from '@/extras/installed';
import { registerTemplates } from '..';
import { AI_DIRECTOR } from '@/core/nodes/ai-director';
import type { Slot } from '@/core/director/slots';

/**
 * The one promise a shipped template makes: a user could have built it from a blank canvas. That
 * means every node type is one the Library offers, every scene type a director asks for is one the
 * Static Script picker would list, and every parameter is one the node's own schema accepts. If a
 * template needs anything a user cannot reach, it is not a template — it is code in disguise.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetSceneRegistry();
  _resetTemplates();
  registerCoreScenes();
  registerCoreNodes();
  installExtras();
  registerTemplates();
});

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

  it('ask the director only for scene types that are registered', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === AI_DIRECTOR)) {
        for (const slot of n.params.scenes as Slot[]) expect(getScene(slot.sceneType), `${t.id}: ${slot.sceneType}`).toBeDefined();
      }
    }
  });

  it('bind facts only to props the scene actually has', () => {
    for (const t of listTemplates()) {
      for (const n of t.graph.nodes.filter((n) => n.type === AI_DIRECTOR)) {
        for (const slot of n.params.scenes as Slot[]) {
          const shape = (getScene(slot.sceneType)!.propsSchema as { shape?: Record<string, unknown> }).shape ?? {};
          for (const prop of Object.keys(slot.factBindings)) expect(prop in shape, `${t.id}: ${slot.sceneType}.${prop}`).toBe(true);
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
    const bound = (director.params.scenes as Slot[]).flatMap((s) => Object.values(s.factBindings));
    expect(bound.sort()).toEqual(['installCommand', 'name', 'stars', 'url']);
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
    expect((director.params.scenes as Slot[]).reduce((n, s) => n + s.count, 0)).toBe(5);
  });
});
