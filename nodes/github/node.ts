import { z } from 'zod';
import type { NodeDefinition } from '@/core/nodes/definition';
import type { FactSheet, SourceRef } from '@/core/types/payloads';
import { NodeError, toNodeError } from '@/core/errors';
import { parseGithubSource, repoUrl } from '@/nodes/github/parse-source';
import { buildFetchedFacts, buildPassthroughFacts, type RepoData } from '@/nodes/github/facts';
import { fetchRepo } from '@/nodes/github/fetch-repo';
import { GithubErrorCode, RETRYABLE } from '@/nodes/github/errors';

const Params = z.object({});

export const GITHUB_FETCHER = 'core/github-fetcher';

/** The one call out of the node, swappable so a test never touches GitHub. */
export const github = { fetchRepo };

/** CORE_CONTRACTS §5.11 — turns a repo link into facts by calling GitHub from the node, which runs on the server. Plain text passes through. */
export const githubFetcher: NodeDefinition<typeof Params> = {
  type: GITHUB_FETCHER,
  version: 1,
  kind: 'process',
  inputs: [{ name: 'source', type: 'SourceRef' }],
  outputs: [{ name: 'facts', type: 'FactSheet' }],
  paramsSchema: Params,
  defaultParams: {},
  run: async ({ inputs, services, signal, log, progress }) => {
    const source = inputs.source!.payload as SourceRef;
    const coords = parseGithubSource(source.value);
    const fetchedAt = new Date(services.now()).toISOString();

    if (!coords) {
      log('info', `not a GitHub repo link; passing ${source.value.length} chars through`);
      const facts: FactSheet = { facts: buildPassthroughFacts(source.value), sourceLabel: 'text', fetchedAt, mode: 'passthrough' };
      return { facts };
    }

    log('info', `fetching ${repoUrl(coords)}`);
    progress(0.1, 'github');
    let data: RepoData;
    try {
      data = await github.fetchRepo(coords, signal);
    } catch (e) {
      const err = toNodeError(e, GithubErrorCode.REPO_NETWORK);
      throw new NodeError(err.code, err.message, RETRYABLE[err.code] ?? err.retryable, err.details);
    }
    for (const d of data.degraded ?? []) log('warn', `GitHub did not serve the ${d}; facts are built without it`, GithubErrorCode.REPO_NETWORK);
    const facts = buildFetchedFacts(data);
    log('info', `stars=${facts.stars ?? '?'} language=${facts.primaryLanguage || '?'} readme=${String(facts.readmeExcerpt).length} chars`);
    const sheet: FactSheet = { facts, sourceLabel: String(facts.url), fetchedAt, mode: 'fetched' };
    return { facts: sheet };
  },
};
