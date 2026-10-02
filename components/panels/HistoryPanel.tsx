'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { Icon } from '@/capsules/sdk/icons';
import { useT } from '@/capsules/sdk/ui';

/** In-session run history: click an entry to play what it filled in the player node without re-running. */
export const HistoryPanel: React.FC = () => {
  const t = useT();
  const history = useStudio((s) => s.history);
  const viewing = useStudio((s) => s.viewingRun);
  const viewRun = useStudio((s) => s.viewRun);
  const setPanel = useStudio((s) => s.setPanel);
  return (
    <aside className="nc-panel">
      <div className="nc-pn-h">
        {t('history.title')}
        <button className="nc-chip" style={{ marginLeft: 'auto', border: 0 }} onClick={() => setPanel('history')}>
          <Icon.x size={12} />
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {history.length === 0 && <div style={{ padding: 12, color: 'var(--tx-3)', fontSize: 'var(--fs-body)' }}>{t('history.empty')}</div>}
        {history.map((r) => {
          const on = viewing === r.seq || (viewing == null && r === history[0]);
          return (
            <div key={r.seq} className={`nc-hi ${on ? 'on' : ''}`} onClick={() => viewRun(r.seq)}>
              <div
                style={{
                  width: 40,
                  height: 71,
                  background: '#000',
                  border: '1px solid var(--line-2)',
                  borderRadius: 2,
                  flex: '0 0 40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--tx-3)',
                }}
              >
                <Icon.screen size={12} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-body)' }}>
                  {t('history.run', { n: r.seq })}
                  {on && (
                    <span className="nc-tag" style={{ marginLeft: 6, color: 'var(--accent-2)', borderColor: 'var(--accent-sunk)' }}>
                      {t('history.viewing')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)', lineHeight: 1.6, marginTop: 3 }}>
                  <span style={{ color: 'var(--tx-2)' }}>{new Date(r.startedAt).toLocaleTimeString()}</span> · {r.composition.engine}
                  <br />
                  {r.composition.width}×{r.composition.height} · {Object.keys(r.composition.values).length} {t('history.values')} · {(r.durationMs / 1000).toFixed(1)}s
                  {r.exports.map((x) => (
                    <div key={x.outputUrl} style={{ color: 'var(--ok)' }}>
                      {x.fileName} · {(x.bytes / 1024 / 1024).toFixed(1)} MB
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', fontSize: 'var(--fs-hint)', color: 'var(--tx-3)', lineHeight: 1.55 }}>{t('history.footer')}</div>
    </aside>
  );
};
