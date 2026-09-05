import { z } from 'zod';
import type { NodeDefinition } from './definition';
import type { FactSheet, SourceRef } from '../types/payloads';
import { NodeError, toNodeError } from '../errors';
import { parseGithubSource, repoUrl } from '../github/parse-source';
import { buildFetchedFacts, buildPassthroughFacts, type RepoData } from '../github/facts';
import { GithubErrorCode, RETRYABLE } from '../github/errors';

const Params = z.object({});

export const GITHUB_FETCHER = 'core/github-fetcher';
/** Server op name; one flat namespace, so it carries its own prefix. */
export const FETCH_REPO_OP = 'github-fetch-repo';

/** CORE_CONTRACTS §5.11 — turns a repo link into facts through a server op; the browser never calls GitHub. Plain text passes through. */
export const githubFetcher: NodeDefinition<typeof Params> = {
  type: GITHUB_FETCHER,
  version: 1,
  namespace: 'core',
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
      data = (await services.serverOp(FETCH_REPO_OP, coords, signal)) as RepoData;
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
