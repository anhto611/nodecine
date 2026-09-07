'use client';
import React from 'react';
import type { FactSheet, SourceRef } from '@/core/types/payloads';
import { Kv, useT } from '@/components/ui';
import { useInputPayload, useRuntime } from '@/store/useStudio';
import { FormBody } from '@/nodes/form-body';
import type { BodyProps } from '@/nodes/kit';
import { parsePageUrls } from './parse-url';

/** Body of the Web Fetcher: what it will read, then what the page said and the picture it kept. */
export const WebFetcherBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const source = useInputPayload<SourceRef>(nodeId, 'source');
  const rt = useRuntime(nodeId);
  const sheet = rt?.outputs.facts?.payload as FactSheet | undefined;
  const targets = source ? parsePageUrls(source.value) : [];
  const facts = sheet?.facts;
  const image = typeof facts?.image === 'string' ? facts.image : null;
  return (
    <>
      <Kv k={t('fetcher.mode')} v={source ? (targets.length ? (targets.length === 1 ? t('web.willRead', { domain: targets[0]!.domain }) : t('web.willReadMany', { n: targets.length })) : t('fetcher.willPassthrough')) : t('fetcher.noInput')} dim={!source} />
      <FormBody nodeId={nodeId} fields={['screenshot']} />
      {sheet?.mode === 'fetched' && typeof facts?.count === 'number' && facts.count > 1 ? <Kv k={t('web.pages')} v={String(facts.count)} /> : null}
      {sheet?.mode === 'fetched' && (
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
