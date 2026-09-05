import { beforeEach, describe, expect, it } from 'vitest';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { registerCoreNodes } from '@/core/nodes';
import { registerCoreScenes } from '@/core/scenes/title-card';
import { _resetSceneRegistry } from '@/core/scenes/registry';
import type { FactSheet } from '@/core/types/payloads';
import { makeFakeServices } from '@/core/__tests__/fakes';
import { githubFetcher, FETCH_REPO_OP, GITHUB_FETCHER } from '../nodes/github-fetcher';
import type { RepoData } from '../facts';

const repo: RepoData = {
  owner: 'acme',
  name: 'widget',
  description: 'A widget.',
  stars: 42,
  topics: [],
  language: 'Go',
  defaultBranch: 'main',
  readme: '# Widget',
  rootFiles: ['go.mod'],
  manifests: { 'go.mod': 'module example.com/widget\n' },
};

function graph(value: string): Graph {
  return {
    nodes: [
      { id: 'in', type: 'core/input-trigger', params: { value }, bypassed: false, position: { x: 0, y: 0 } },
      { id: 'fetch', type: GITHUB_FETCHER, params: {}, bypassed: false, position: { x: 0, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'in', sourcePort: 'source', target: 'fetch', targetPort: 'source' }],
  };
}

describe('GitHub Fetcher node', () => {
  beforeEach(() => {
    _resetSceneRegistry();
    registerCoreScenes();
    registerCoreNodes();
    registerNodeType(githubFetcher as unknown as AnyNodeDefinition);
  });

  it('passes plain text through without calling the server', async () => {
    const services = makeFakeServices();
    const ex = new Executor(graph('Just some prose about a tool.'), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const sheet = ex.runtimes_().get('fetch')!.outputs.facts!.payload as FactSheet;
    expect(sheet.mode).toBe('passthrough');
    expect(sheet.facts.readmeExcerpt).toBe('Just some prose about a tool.');
    expect(sheet.facts.stars).toBeNull();
    expect(services.calls.some((c) => c.name === 'serverOp')).toBe(false);
  });

  it('fetches a repo link through a server op and builds facts', async () => {
    const services = makeFakeServices({ serverOps: { [FETCH_REPO_OP]: async () => repo } });
    const ex = new Executor(graph('https://github.com/acme/widget'), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const call = services.calls.find((c) => c.name === 'serverOp')!;
    expect(call.args).toEqual([FETCH_REPO_OP, { owner: 'acme', name: 'widget' }]);
    const sheet = ex.runtimes_().get('fetch')!.outputs.facts!.payload as FactSheet;
    expect(sheet.mode).toBe('fetched');
    expect(sheet.sourceLabel).toBe('github.com/acme/widget');
    expect(sheet.facts.stars).toBe(42);
    expect(sheet.facts.installCommand).toBe('go install example.com/widget@latest');
  });

  it('surfaces REPO_NOT_FOUND as a non-retryable node error', async () => {
    const services = makeFakeServices({
      serverOps: { [FETCH_REPO_OP]: async () => { throw Object.assign(new Error('nope'), { code: 'REPO_NOT_FOUND' }); } },
    });
    const ex = new Executor(graph('acme/missing'), services);
    const { ok } = await ex.run();
    expect(ok).toBe(false);
    const rt = ex.runtimes_().get('fetch')!;
    expect(rt.state).toBe('error');
    expect(rt.error?.code).toBe('REPO_NOT_FOUND');
    expect(rt.error?.retryable).toBe(false);
  });

  it('marks rate limiting as retryable', async () => {
    const services = makeFakeServices({
      serverOps: { [FETCH_REPO_OP]: async () => { throw Object.assign(new Error('slow down'), { code: 'REPO_RATE_LIMITED' }); } },
    });
    const ex = new Executor(graph('acme/widget'), services);
    await ex.run();
    expect(ex.runtimes_().get('fetch')!.error?.retryable).toBe(true);
  });
});
