import { beforeEach, describe, expect, it } from 'vitest';
import { registerCoreNodes } from '@/core/nodes';
import { registerCoreScenes } from '@/core/scenes/title-card';
import { _resetSceneRegistry, getScene } from '@/core/scenes/registry';
import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { validateGraph, topoSort } from '@/core/engine/graph';
import { githubShowcaseTemplate } from '../template';
import { githubFetcher } from '../nodes/github-fetcher';
import { aiDirector } from '../nodes/ai-director';
import { registerGithubShowcaseRemotion } from '../remotion';
import { CTA, HOOK, MOCKUP } from '../scenes/schemas';

describe('github-showcase template (spec §1)', () => {
  beforeEach(() => {
    _resetSceneRegistry();
    registerCoreScenes();
    registerCoreNodes();
    registerNodeType(githubFetcher as unknown as AnyNodeDefinition);
    registerNodeType(aiDirector as unknown as AnyNodeDefinition);
  });

  it('has ten nodes, twelve wires, no cycle, and asks only for the repo link', () => {
    const g = githubShowcaseTemplate();
    expect(g.nodes).toHaveLength(10);
    expect(g.edges).toHaveLength(12);
    expect(() => topoSort(g)).not.toThrow();
    // The template ships with an empty Input Trigger on purpose: the one thing the user must supply
    // is the repo link, so that is the only error the freshly opened graph may carry.
    const errors = validateGraph(g).filter((i) => i.severity === 'error');
    expect(errors).toEqual([{ code: 'INPUT_EMPTY', message: 'Please enter content before running', nodeId: 'input', severity: 'error' }]);
  });

  it('wires the FactSheet straight into the assembler, bypassing the model', () => {
    const g = githubShowcaseTemplate();
    expect(g.edges.some((e) => e.source === 'fetcher' && e.target === 'assembler' && e.targetPort === 'facts')).toBe(true);
    expect(g.nodes.find((n) => n.id === 'export')!.bypassed).toBe(true);
  });

  it('registers a Remotion renderer for all three scene types', () => {
    registerGithubShowcaseRemotion();
    for (const t of [HOOK, MOCKUP, CTA]) expect(typeof getScene(t)?.renderers.remotion).toBe('function');
  });
});
