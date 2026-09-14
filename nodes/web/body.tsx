'use client';
import React from 'react';
import type { FactSheet, SourceRef } from '@/contracts/types/payloads';
import { Kv, useT } from '@/components/ui';
import { useInputPayload, useOutputPayload } from '@/store/useStudio';
import { FormBody } from '@/nodes/form-body';
import type { BodyProps } from '@/nodes/kit';
import { parsePageUrls } from '@/contracts/network/public-url';
import { parseGithubSource, repoUrl } from './github/parse-source';

/**
 * Body of the Fetcher: what it will do with the input as it stands, then what came back.
 *
 * A repository and a page give different facts, so the card shows different rows for each — it is
 * one node because the person should not have to know which it is, not because the two answers are
 * the same.
 */
export const WebFetcherBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const source = useInputPayload<SourceRef>(nodeId, 'source');
  const sheet = useOutputPayload<FactSheet>(nodeId, 'facts');
  const repo = source ? parseGithubSource(source.value) : null;
  const targets = source && !repo ? parsePageUrls(source.value) : [];
  const facts = sheet?.facts;
  const image = typeof facts?.image === 'string' ? facts.image : null;
  const num = (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : '—');
  const isRepo = sheet?.mode === 'fetched' && typeof facts?.stars === 'number';
  const will = repo
    ? t('fetcher.willFetch', { repo: repoUrl(repo) })
    : targets.length === 1 ? t('web.willRead', { domain: targets[0]!.domain })
    : targets.length ? t('web.willReadMany', { n: targets.length })
    : t('fetcher.willPassthrough');
  return (
    <>
      <Kv k={t('fetcher.mode')} v={source ? will : t('fetcher.noInput')} dim={!source} />
      {repo ? null : <FormBody nodeId={nodeId} fields={['screenshot']} />}
      {isRepo && (
        <>
          <Kv k={t('fetcher.stars')} v={num(facts?.stars)} />
          <Kv k={t('fetcher.language')} v={typeof facts?.language === 'string' && facts.language ? facts.language : '—'} />
        </>
      )}
      {sheet?.mode === 'fetched' && typeof facts?.count === 'number' && facts.count > 1 ? <Kv k={t('web.pages')} v={String(facts.count)} /> : null}
      {sheet?.mode === 'fetched' && !isRepo && (
        <>
          <div className="nc-hint one-line" style={{ color: 'var(--tx-2)' }} title={String(facts?.title ?? '')}>{String(facts?.title ?? '—')}</div>
          <Kv k={t('web.publishedAt')} v={String(facts?.publishedAt || '—')} dim={!facts?.publishedAt} />
          {image ? <img src={image} alt="" style={{ width: '100%', borderRadius: 3, border: '1px solid var(--line-2)' }} /> : <Kv k={t('content.image')} v="—" dim />}
        </>
      )}
      <div className="nc-hint">{t('web.hint')}</div>
    </>
  );
};
