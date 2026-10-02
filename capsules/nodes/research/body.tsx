'use client';
import React from 'react';
import { Btn, Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useOutputPayload, useParams, useRun, type BodyProps } from '@/capsules/sdk/host';
import { FormBody } from '@/capsules/sdk/form-body';
import { ProviderPick } from '@/capsules/sdk/pickers';
import type { Research, ResearchPoint } from '@/contracts/types/research';
import type { ResearchEdits } from './material';
import { SEARCH } from './node';

type Params = { attempt: number; edits: ResearchEdits };

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * The findings as a person reads and corrects them: what the subject is, the facts with where each was
 * read, the sources. A correction is kept apart from what the model found and laid over it on the next
 * run; "Research again" takes a new look.
 */
export const ResearchBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<Params>(nodeId);
  const { running, runNode } = useRun();
  const found = useOutputPayload<Research>(nodeId, 'research');
  const [settings, setSettings] = React.useState(false);
  const edits = p.edits ?? {};
  const pending = Object.keys(edits).length > 0;
  const subject = edits.subject ?? found?.subject ?? '';
  const summary = edits.summary ?? found?.summary ?? '';
  const points: ResearchPoint[] = edits.points ?? found?.points ?? [];
  const setPoints = (next: ResearchPoint[]) => set({ edits: { ...edits, points: next } });
  const again = () => {
    set({ attempt: (p.attempt ?? 0) + 1, edits: {} });
    setTimeout(() => runNode(nodeId), 0);
  };
  const fid = (field: string) => `${nodeId}-research-${field}`;

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ProviderPick nodeId={nodeId} kind="llm" />
      <button className="nc-chip" style={{ alignSelf: 'flex-start' }} aria-expanded={settings} onClick={() => setSettings(!settings)}>
        {settings ? t('node.researchSettingsHide') : t('node.researchSettings')}
      </button>
      {settings && (
        <FormBody
          nodeId={nodeId}
          fields={['search', 'guide']}
          widgets={{
            search: { labelKey: 'node.researchSearch', options: SEARCH.map((s) => ({ value: s, label: t(`node.researchSearch.${s}`) })) },
            guide: { widget: 'textarea', rows: 6, labelKey: 'node.researchGuide', placeholder: t('node.researchGuideHint') },
          }}
        />
      )}
      {!found ? (
        <div className="nc-hint">{t('node.researchEmpty')}</div>
      ) : (
        <>
          <Kv
            k={<label htmlFor={fid('subject')}>{t('node.researchSubject')}</label>}
            v={<input id={fid('subject')} className="nc-input" maxLength={120} value={subject} onChange={(e) => set({ edits: { ...edits, subject: e.target.value } })} />}
          />
          <Kv
            wide
            k={<label htmlFor={fid('summary')}>{t('node.researchSummary')}</label>}
            v={<textarea id={fid('summary')} className="nc-textarea" rows={3} maxLength={2000} value={summary} onChange={(e) => set({ edits: { ...edits, summary: e.target.value } })} />}
          />
          <Kv
            wide
            k={t('node.researchPoints', { count: points.length })}
            v={
              <div style={{ display: 'grid', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                {points.map((point, i) => (
                  <div key={i} style={{ display: 'grid', gap: 2 }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                      <textarea
                        aria-label={t('node.researchPoint', { n: i + 1 })}
                        className="nc-textarea"
                        rows={2}
                        style={{ flex: 1 }}
                        maxLength={600}
                        value={point.text}
                        onChange={(e) => setPoints(points.map((q, j) => (j === i ? { ...q, text: e.target.value } : q)))}
                      />
                      <button className="nc-chip" aria-label={t('node.researchRemove')} onClick={() => setPoints(points.filter((_, j) => j !== i))}>
                        ×
                      </button>
                    </div>
                    <div className="nc-hint one-line" style={{ marginTop: 0 }} title={point.source || t('node.researchFromBrief')}>
                      {point.source ? (
                        <a href={point.source} target="_blank" rel="noreferrer" style={{ color: 'var(--tx-3)' }}>
                          {hostOf(point.source)}
                        </a>
                      ) : (
                        t('node.researchFromBrief')
                      )}
                    </div>
                  </div>
                ))}
              </div>
            }
          />
          {found.sources.length > 0 && (
            <details>
              <summary className="nc-k" style={{ cursor: 'pointer' }}>
                {t('node.researchSources', { count: found.sources.length })}
              </summary>
              <div style={{ display: 'grid', gap: 2, marginTop: 4 }}>
                {found.sources.map((s) => (
                  <a key={s.url} className="nc-hint one-line" style={{ marginTop: 0, color: 'var(--tx-2)' }} href={s.url} target="_blank" rel="noreferrer" title={s.url}>
                    {s.title || hostOf(s.url)}
                  </a>
                ))}
              </div>
            </details>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pending && (
              <Btn small primary disabled={running} onClick={() => runNode(nodeId)}>
                {t('node.researchApply')}
              </Btn>
            )}
            {pending && (
              <Btn small disabled={running} onClick={() => set({ edits: {} })}>
                {t('node.researchUndo')}
              </Btn>
            )}
            <Btn small disabled={running} onClick={again}>
              {t('node.researchAgain')}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
};
