'use client';
import React from 'react';
import type { AudioScript, DirectorPlan, FactSheet } from '@/core/types/payloads';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useInputPayload, useNode, useRuntime, useStudio } from '@/store/useStudio';
import { languageName, resolveOutputLanguage } from '../director';

const LANGS = ['auto', 'en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'pt', 'id', 'th'];

/** Body of the AI Director node: output language, then the narration and scene headlines it wrote. */
export const DirectorBody: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const t = useT();
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  const facts = useInputPayload<FactSheet>(nodeId, 'facts');
  const rt = useRuntime(nodeId);
  const plan = rt?.outputs.plan?.payload as DirectorPlan | undefined;
  const script = rt?.outputs.script?.payload as AudioScript | undefined;
  const param = (node?.params.outputLanguage as string | undefined) ?? 'auto';
  const resolved = facts ? resolveOutputLanguage(param, facts) : param === 'auto' ? null : param;
  const raw = (rt?.error?.details as { raw?: unknown } | undefined)?.raw;

  return (
    <>
      <Kv k={t('director.outputLanguage')} v={
        <select className={`nc-select ${stopFlow}`} value={param} onChange={(e) => setParams(nodeId, { outputLanguage: e.target.value })}>
          {LANGS.map((l) => <option key={l} value={l}>{l === 'auto' ? `${t('node.auto')}${resolved && param === 'auto' ? ` · ${resolved}` : ''}` : `${l} · ${languageName(l)}`}</option>)}
        </select>
      } />
      <div className="nc-hint">{t('director.theme')}</div>
      {script && plan && (
        <>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('director.narration', { n: script.text.split(/\s+/).length })}</div>
          <div style={{ fontSize: 9, color: 'var(--tx-2)', lineHeight: 1.5, maxHeight: 54, overflow: 'hidden' }}>{script.text}</div>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('director.scenes')}</div>
          {plan.scenes.map((s, i) => (
            <div key={i} className="nc-kv"><span className="nc-k">{i + 1} · {s.sceneType.split('/')[1]}</span><span className="nc-v">{String(s.props.headline ?? '')}</span></div>
          ))}
        </>
      )}
      {raw != null && (
        <>
          <div className="nc-k" style={{ marginTop: 4, color: 'var(--err)' }}>{t('director.rawOutput')}</div>
          <pre className={`nc-textarea ${stopFlow}`} style={{ margin: 0, maxHeight: 70, overflow: 'auto', fontSize: 8.5, whiteSpace: 'pre-wrap' }}>{typeof raw === 'string' ? raw : JSON.stringify(raw, null, 1)}</pre>
        </>
      )}
    </>
  );
};
