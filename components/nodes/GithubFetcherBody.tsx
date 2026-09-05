'use client';
import React from 'react';
import type { FactSheet, SourceRef } from '@/core/types/payloads';
import { Kv, useT } from '@/components/ui';
import { useInputPayload, useRuntime } from '@/store/useStudio';
import { parseGithubSource, repoUrl } from '@/core/github/parse-source';

/** Body of the GitHub Fetcher node: what it will do with the current input, and the facts it produced. */
export const GithubFetcherBody: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const t = useT();
  const source = useInputPayload<SourceRef>(nodeId, 'source');
  const rt = useRuntime(nodeId);
  const sheet = rt?.outputs.facts?.payload as FactSheet | undefined;
  const coords = source ? parseGithubSource(source.value) : null;

  const facts = sheet?.facts;
  const num = (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : '—');
  const str = (v: unknown) => (typeof v === 'string' && v ? v : '—');
  const topics = Array.isArray(facts?.topics) ? (facts!.topics as string[]) : [];

  return (
    <>
      <Kv k={t('fetcher.mode')} v={source ? (coords ? t('fetcher.willFetch', { repo: repoUrl(coords) }) : t('fetcher.willPassthrough')) : t('fetcher.noInput')} dim={!source} />
      {sheet && (
        <>
          <div className="nc-hint" style={{ color: sheet.mode === 'fetched' ? 'var(--ok)' : 'var(--tx-2)' }}>
            {sheet.mode === 'fetched' ? t('fetcher.fetched', { at: new Date(sheet.fetchedAt).toLocaleTimeString() }) : t('fetcher.passthrough')}
          </div>
          {sheet.mode === 'fetched' && (
            <>
              <Kv k={t('fetcher.stars')} v={num(facts?.stars)} />
              <Kv k={t('fetcher.language')} v={str(facts?.primaryLanguage)} />
              <Kv k={t('fetcher.topics')} v={topics.length ? topics.slice(0, 3).join(', ') + (topics.length > 3 ? ` +${topics.length - 3}` : '') : '—'} />
              <Kv k={t('fetcher.install')} v={<code style={{ fontSize: 8.5 }}>{str(facts?.installCommand)}</code>} />
            </>
          )}
          <div className="nc-hint">{t('fetcher.readme', { n: String(facts?.readmeExcerpt ?? '').length })}</div>
        </>
      )}
    </>
  );
};
