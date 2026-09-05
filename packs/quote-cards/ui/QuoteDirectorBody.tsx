'use client';
import React from 'react';
import type { AudioScript, DirectorPlan, SourceRef } from '@/core/types/payloads';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useInputPayload, useNode, useRuntime, useStudio } from '@/store/useStudio';
import { detectLanguage } from '@/core/text/detect-language';
import { MAX_QUOTES, MIN_QUOTES, languageName } from '../director';
import { QUOTE } from '../scenes/schemas';

const LANGS = ['auto', 'en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'pt', 'id', 'th'];
const COUNTS = Array.from({ length: MAX_QUOTES - MIN_QUOTES + 1 }, (_, i) => MIN_QUOTES + i);

/** Body of the Quote Director: the theme it read, how many quotes to ask for, then what came back. */
export const QuoteDirectorBody: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const t = useT();
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  const topic = useInputPayload<SourceRef>(nodeId, 'topic');
  const rt = useRuntime(nodeId);
  const plan = rt?.outputs.plan?.payload as DirectorPlan | undefined;
  const script = rt?.outputs.script?.payload as AudioScript | undefined;
  const param = (node?.params.outputLanguage as string | undefined) ?? 'auto';
  const count = (node?.params.count as number | undefined) ?? 4;
  const text = topic?.value.trim() ?? '';
  const resolved = param !== 'auto' ? param : text ? detectLanguage(text) : null;
  const raw = (rt?.error?.details as { raw?: unknown } | undefined)?.raw;
  const quotes = plan?.scenes.filter((s) => s.sceneType === QUOTE) ?? [];

  return (
    <>
      <Kv k={t('quotes.topic')} v={text || t('quotes.noTopic')} dim={!text} />
      <Kv k={t('quotes.count')} v={
        <select className={`nc-select ${stopFlow}`} value={String(count)} onChange={(e) => setParams(nodeId, { count: Number(e.target.value) })}>
          {COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      } />
      <Kv k={t('quotes.outputLanguage')} v={
        <select className={`nc-select ${stopFlow}`} value={param} onChange={(e) => setParams(nodeId, { outputLanguage: e.target.value })}>
          {LANGS.map((l) => <option key={l} value={l}>{l === 'auto' ? `${t('node.auto')}${resolved && param === 'auto' ? ` · ${resolved}` : ''}` : `${l} · ${languageName(l)}`}</option>)}
        </select>
      } />
      {script && plan && (
        <>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('quotes.narration', { n: script.text.split(/\s+/).length })}</div>
          <div style={{ fontSize: 9, color: 'var(--tx-2)', lineHeight: 1.5, maxHeight: 54, overflow: 'hidden' }}>{script.text}</div>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('quotes.written')}</div>
          {quotes.map((s, i) => (
            <div key={i} className="nc-kv">
              <span className="nc-k">{i + 1}</span>
              <span className="nc-v">{String(s.props.attribution ?? '')}</span>
            </div>
          ))}
        </>
      )}
      {raw != null && (
        <>
          <div className="nc-k" style={{ marginTop: 4, color: 'var(--err)' }}>{t('quotes.rawOutput')}</div>
          <pre className={`nc-textarea ${stopFlow}`} style={{ margin: 0, maxHeight: 70, overflow: 'auto', fontSize: 8.5, whiteSpace: 'pre-wrap' }}>{typeof raw === 'string' ? raw : JSON.stringify(raw, null, 1)}</pre>
        </>
      )}
    </>
  );
};
