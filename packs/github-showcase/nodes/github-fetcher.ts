import { z } from 'zod';
import type { NodeDefinition } from '@/core/nodes/definition';
import type { FactSheet, SourceRef } from '@/core/types/payloads';
import { NodeError, toNodeError } from '@/core/errors';
import { PACK_ID } from '../constants';
import { parseGithubSource, repoUrl } from '../parse-source';
import { buildFetchedFacts, buildPassthroughFacts, type RepoData } from '../facts';
import { PackErrorCode, RETRYABLE } from '../errors';

const Params = z.object({});

export const GITHUB_FETCHER = `${PACK_ID}/github-fetcher`;
export const FETCH_REPO_OP = 'fetch-repo';

/** github-showcase spec §2 — the only pack node that touches the network, via the server. */
export const githubFetcher: NodeDefinition<typeof Params> = {
  type: GITHUB_FETCHER,
  version: 1,
  pack: PACK_ID,
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
      data = (await services.packRequest(PACK_ID, FETCH_REPO_OP, coords, signal)) as RepoData;
    } catch (e) {
      const err = toNodeError(e, PackErrorCode.REPO_NETWORK);
      throw new NodeError(err.code, err.message, RETRYABLE[err.code] ?? err.retryable, err.details);
    }
    const facts = buildFetchedFacts(data);
    log('info', `stars=${facts.stars ?? '?'} language=${facts.primaryLanguage || '?'} readme=${String(facts.readmeExcerpt).length} chars`);
    const sheet: FactSheet = { facts, sourceLabel: String(facts.url), fetchedAt, mode: 'fetched' };
    return { facts: sheet };
  },
};
