import { beforeEach, describe, expect, it } from 'vitest';
import { registerCoreNodes } from '@/core/nodes';
import { registerCoreScenes, TITLE_CARD } from '@/core/scenes/title-card';
import { _resetSceneRegistry, getScene } from '@/core/scenes/registry';
import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { topoSort, validateGraph } from '@/core/engine/graph';
import { quoteCardsTemplate } from '../template';
import { quoteDirector } from '../nodes/quote-director';
import { registerQuoteCardsRemotion } from '../remotion';
import { registerQuoteCardsHyperframes } from '../hyperframes';
import { QUOTE } from '../scenes/schemas';

describe('quote-cards template', () => {
  beforeEach(() => {
    _resetSceneRegistry();
    registerCoreScenes();
    registerCoreNodes();
    registerNodeType(quoteDirector as unknown as AnyNodeDefinition);
  });

  it('has eight nodes, eight wires, no cycle, and opens ready to run', () => {
    const g = quoteCardsTemplate();
    expect(g.nodes).toHaveLength(8);
    expect(g.edges).toHaveLength(8);
    expect(() => topoSort(g)).not.toThrow();
    // Unlike github-showcase, the theme has a sensible default, so nothing is missing on open.
    expect(validateGraph(g).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('leaves the assembler\'s Facts port unwired, which is the point of this pack', () => {
    const g = quoteCardsTemplate();
    expect(g.edges.some((e) => e.target === 'assembler' && e.targetPort === 'facts')).toBe(false);
  });

  it('has no fetcher and no server handler: the topic goes straight to the director', () => {
    const g = quoteCardsTemplate();
    expect(g.edges).toContainEqual({ id: 'e1', source: 'input', sourcePort: 'source', target: 'director', targetPort: 'topic' });
  });

  it('registers its scene for both engines, and relies on the core one for the opener', () => {
    registerQuoteCardsRemotion();
    registerQuoteCardsHyperframes();
    expect(typeof getScene(QUOTE)?.renderers.remotion).toBe('function');
    expect(typeof getScene(QUOTE)?.renderers.hyperframes).toBe('function');
    // The pack registers no renderer for the title card; the core scene is already there.
    expect(getScene(TITLE_CARD)).toBeDefined();
  });
});
