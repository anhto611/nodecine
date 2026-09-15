'use client';
import React from 'react';
import { Btn, useT, stopFlow } from '@/capsules/sdk/ui';
import { useOutputPayload, useParams, useRun, type BodyProps } from '@/capsules/sdk/host';
import { ProviderPick } from '@/capsules/sdk/pickers';
import type { Research, ResearchPoint } from '@/contracts/types/research';
import type { ResearchEdits } from './material';

type Params = { search: 'sources' | 'web'; guide: string; attempt: number; edits: ResearchEdits };

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

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
  const label = { fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' };
  const [settings, setSettings] = React.useState(false);

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ProviderPick nodeId={nodeId} kind="llm" />
      <button className="nc-chip" style={{ alignSelf: 'flex-start' }} aria-expanded={settings} onClick={() => setSettings(!settings)}>{settings ? t('node.researchSettingsHide') : t('node.researchSettings')}</button>
      {settings && (
        <div style={{ display: 'grid', gap: 6, padding: 6, border: '1px solid var(--line)', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor={fid('search')} style={label}>{t('node.researchSearch')}</label>
            <select id={fid('search')} className="nc-select" value={p.search ?? 'sources'} onChange={(e) => set({ search: e.target.value as Params['search'] })}>
              <option value="sources">{t('node.researchSearch.sources')}</option>
              <option value="web">{t('node.researchSearch.web')}</option>
            </select>
          </div>
          <label htmlFor={fid('guide')} style={{ display: 'grid', gap: 3 }}>
            <span style={label}>{t('node.researchGuide')}</span>
            <textarea id={fid('guide')} className="nc-textarea" style={{ minHeight: 120 }} maxLength={8000} placeholder={t('node.researchGuideHint')} value={p.guide ?? ''} onChange={(e) => set({ guide: e.target.value })} />
          </label>
        </div>
      )}
      {!found ? <div className="nc-hint">{t('node.researchEmpty')}</div> : (
        <>
          <label htmlFor={fid('subject')} style={{ display: 'grid', gap: 3 }}>
            <span style={label}>{t('node.researchSubject')}</span>
            <input id={fid('subject')} className="nc-input" maxLength={120} value={subject} onChange={(e) => set({ edits: { ...edits, subject: e.target.value } })} />
          </label>
          <label htmlFor={fid('summary')} style={{ display: 'grid', gap: 3 }}>
            <span style={label}>{t('node.researchSummary')}</span>
            <textarea id={fid('summary')} className="nc-textarea" style={{ minHeight: 64 }} maxLength={2000} value={summary} onChange={(e) => set({ edits: { ...edits, summary: e.target.value } })} />
          </label>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={label}>{t('node.researchPoints', { count: points.length })}</span>
            <div style={{ display: 'grid', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
              {points.map((point, i) => (
                <div key={i} style={{ display: 'grid', gap: 2 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                    <textarea aria-label={t('node.researchPoint', { n: i + 1 })} className="nc-textarea" style={{ minHeight: 36, flex: 1 }} maxLength={600} value={point.text}
                      onChange={(e) => setPoints(points.map((q, j) => (j === i ? { ...q, text: e.target.value } : q)))} />
                    <button className="nc-chip" aria-label={t('node.researchRemove')} onClick={() => setPoints(points.filter((_, j) => j !== i))}>×</button>
                  </div>
                  <div className="nc-hint one-line" style={{ marginTop: 0 }} title={point.source || t('node.researchFromBrief')}>
                    {point.source ? <a href={point.source} target="_blank" rel="noreferrer" style={{ color: 'var(--tx-3)' }}>{hostOf(point.source)}</a> : t('node.researchFromBrief')}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {found.sources.length > 0 && (
            <details>
              <summary style={{ ...label, cursor: 'pointer' }}>{t('node.researchSources', { count: found.sources.length })}</summary>
              <div style={{ display: 'grid', gap: 2, marginTop: 4 }}>
                {found.sources.map((s) => (
                  <a key={s.url} className="nc-hint one-line" style={{ marginTop: 0, color: 'var(--tx-2)' }} href={s.url} target="_blank" rel="noreferrer" title={s.url}>{s.title || hostOf(s.url)}</a>
                ))}
              </div>
            </details>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pending && <Btn small primary disabled={running} onClick={() => runNode(nodeId)}>{t('node.researchApply')}</Btn>}
            {pending && <Btn small disabled={running} onClick={() => set({ edits: {} })}>{t('node.researchUndo')}</Btn>}
            <Btn small disabled={running} onClick={again}>{t('node.researchAgain')}</Btn>
          </div>
        </>
      )}
    </div>
  );
};
