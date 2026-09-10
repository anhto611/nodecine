import { z } from 'zod';
import type { NodeDefinition } from '@/core/nodes/definition';
import type { FactItem, FactSheet, SourceRef } from '@/core/types/payloads';
import { NodeError, toNodeError } from '@/core/errors';
import { parsePageUrls } from './parse-url';
import { RETRYABLE, WebErrorCode } from './errors';

const Params = z.object({
  /** Open the page in a browser and keep a picture of it. Off by default: it costs a browser launch. */
  screenshot: z.boolean().default(false),
  width: z.number().int().min(320).max(2560).default(1280),
  height: z.number().int().min(320).max(2560).default(800),
  /** How many links of the input to read; the rest are ignored. */
  maxPages: z.number().int().min(1).max(20).default(10),
});

export const WEB_FETCHER = 'core/web-fetcher';

/**
 * CORE_CONTRACTS §5.14 — a link becomes facts: what the page calls itself, who published it, and
 * its picture kept as a scene asset so a scene may show it. Optionally a photograph of the page.
 * Anything that is not a public web address passes through as text, the way the GitHub fetcher does,
 * so this node never breaks a graph that is fed a topic instead of a link.
 */
export const webFetcher: NodeDefinition<typeof Params> = {
  type: WEB_FETCHER,
  version: 1,
  kind: 'process',
  inputs: [{ name: 'source', type: 'SourceRef' }],
  outputs: [{ name: 'facts', type: 'FactSheet' }],
  paramsSchema: Params,
  defaultParams: { screenshot: false, width: 1280, height: 800, maxPages: 10 },
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const source = inputs.source!.payload as SourceRef;
    const fetchedAt = new Date(services.now()).toISOString();
    const targets = parsePageUrls(source.value, params.maxPages);

    if (targets.length === 0) {
      log('info', `no web address in the input; passing ${source.value.trim().length} chars through`);
      const facts: FactSheet = { facts: { text: source.value.trim() }, sourceLabel: 'text', fetchedAt, mode: 'passthrough' };
      return { facts };
    }

    log('info', `reading ${targets.length} page${targets.length === 1 ? '' : 's'}${params.screenshot ? ' and photographing them' : ''}`);
    const items: FactItem[] = [];
    const failures: string[] = [];
    for (const [i, target] of targets.entries()) {
      progress(i / targets.length, `${i + 1}/${targets.length} ${target.domain}`);
      try {
        const page = await services.readPage(target.url, { screenshot: params.screenshot, width: params.width, height: params.height }, signal);
        if (params.screenshot && !page.screenshotAsset) log('warn', `${page.domain}: no photograph${page.shotProblem ? ` (${page.shotProblem})` : ''}; the page's own picture is used instead`, WebErrorCode.SHOT_FAILED);
        // Fact fields are named after the content vocabulary where they line up, so a beat binds by name.
        items.push({
          title: page.title ?? '',
          body: page.description ?? '',
          source: page.domain,
          url: page.url,
          siteName: page.siteName ?? page.domain,
          publishedAt: page.publishedAt ?? '',
          // A scene shows the photograph when there is one, and the page's own picture otherwise.
          image: page.screenshotAsset ?? page.pictureAsset ?? null,
        });
        log('info', `${target.domain}: ${page.title ? `“${page.title.slice(0, 50)}”` : 'no title'}${items[items.length - 1]!.image ? ' · with a picture' : ''}`);
      } catch (e) {
        if (signal.aborted) throw e;
        const err = toNodeError(e, WebErrorCode.PAGE_NETWORK);
        // One dead link out of five is a warning; all of them dead is the node's failure.
        failures.push(`${target.domain}: ${err.message}`);
        log('warn', `${target.domain}: ${err.message}`, err.code);
        if (targets.length === 1) throw new NodeError(err.code, err.message, RETRYABLE[err.code] ?? err.retryable, err.details);
      }
    }
    if (items.length === 0) throw new NodeError(WebErrorCode.PAGE_NETWORK, `none of the ${targets.length} pages could be read: ${failures[0]}`, true);

    // `items` is the list a beat runs over; the first page also sits at the top level, so a graph
    // with one link reads the same as it always did.
    const first = items[0]!;
    const facts: FactSheet['facts'] = { ...first, items, count: items.length };
    const sheet: FactSheet = { facts, sourceLabel: items.length === 1 ? String(first.source) : `${items.length} pages`, fetchedAt, mode: 'fetched' };
    return { facts: sheet };
  },
};
