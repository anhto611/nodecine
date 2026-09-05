import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodeType, type AnyNodeDefinition } from '@/core/nodes/definition';
import { registerNodes } from '@/nodes';
import type { FactSheet } from '@/core/types/payloads';
import { makeFakeServices } from '@/core/__tests__/fakes';
import { github, githubFetcher, GITHUB_FETCHER } from '@/nodes/github/node';
import type { RepoData } from '@/nodes/github/facts';

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
  const fetchRepo = vi.fn();
  beforeEach(() => {
    registerNodes();
    registerNodeType(githubFetcher as unknown as AnyNodeDefinition);
    fetchRepo.mockReset();
    vi.spyOn(github, 'fetchRepo').mockImplementation(fetchRepo as typeof github.fetchRepo);
  });
  afterEach(() => vi.restoreAllMocks());

  it('passes plain text through without calling GitHub', async () => {
    const services = makeFakeServices();
    const ex = new Executor(graph('Just some prose about a tool.'), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const sheet = ex.runtimes_().get('fetch')!.outputs.facts!.payload as FactSheet;
    expect(sheet.mode).toBe('passthrough');
    expect(sheet.facts.readmeExcerpt).toBe('Just some prose about a tool.');
    expect(sheet.facts.stars).toBeNull();
    expect(fetchRepo).not.toHaveBeenCalled();
  });

  it('fetches a repo link and builds facts', async () => {
    fetchRepo.mockResolvedValue(repo);
    const services = makeFakeServices();
    const ex = new Executor(graph('https://github.com/acme/widget'), services);
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    expect(fetchRepo).toHaveBeenCalledWith({ owner: 'acme', name: 'widget' }, expect.anything());
    const sheet = ex.runtimes_().get('fetch')!.outputs.facts!.payload as FactSheet;
    expect(sheet.mode).toBe('fetched');
    expect(sheet.sourceLabel).toBe('github.com/acme/widget');
    expect(sheet.facts.stars).toBe(42);
    expect(sheet.facts.installCommand).toBe('go install example.com/widget@latest');
  });

  it('surfaces REPO_NOT_FOUND as a non-retryable node error', async () => {
    fetchRepo.mockRejectedValue(Object.assign(new Error('nope'), { code: 'REPO_NOT_FOUND' }));
    const services = makeFakeServices();
    const ex = new Executor(graph('acme/missing'), services);
    const { ok } = await ex.run();
    expect(ok).toBe(false);
    const rt = ex.runtimes_().get('fetch')!;
    expect(rt.state).toBe('error');
    expect(rt.error?.code).toBe('REPO_NOT_FOUND');
    expect(rt.error?.retryable).toBe(false);
  });

  it('marks rate limiting as retryable', async () => {
    fetchRepo.mockRejectedValue(Object.assign(new Error('slow down'), { code: 'REPO_RATE_LIMITED' }));
    const services = makeFakeServices();
    const ex = new Executor(graph('acme/widget'), services);
    await ex.run();
    expect(ex.runtimes_().get('fetch')!.error?.retryable).toBe(true);
  });
});
