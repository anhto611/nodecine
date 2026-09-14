'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { platesInGraph, pinnedPayload, type StoredPlate } from '@/contracts/visual/plate-store';
import { ScenePreview } from '@/components/ScenePreview';
import { Icon } from '@/components/icons';
import { Btn, Dialog, useT } from '@/components/ui';

/**
 * This workflow's plate store (USER_FLOWS §1.11): every layout it has already drawn.
 *
 * The store belongs to the workflow, not to the app, so it opens from the card that holds the
 * plates and never from the app's own rail. A modal rather than a side panel because of what is in
 * it: a plate is a whole portrait frame, and a 260-pixel column of them is the thumbnail problem
 * again with more scrolling.
 *
 * One window, two halves: every plate on the left, the one chosen drawn whole on the right.
 */
const openAt = (o: { nodeId: string; data?: unknown }): number | null => {
  const i = (o.data as { plate?: unknown } | undefined)?.plate;
  return typeof i === 'number' ? i : null;
};

export const PlateStore: React.FC = () => {
  const t = useT();
  const overlay = useStudio((s) => s.overlay);
  const setOverlay = useStudio((s) => s.setOverlay);
  const graph = useStudio((s) => s.graph);
  const runtimes = useStudio((s) => s.runtimes);
  const from = overlay ? openAt(overlay) : null;
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(from ?? 0);
  const close = () => setOverlay(null);
  // Reopening from another thumbnail is a new index on the same overlay, not a remount.
  React.useEffect(() => { if (from !== null) setSel(from); }, [from]);

  // What the ports carry now: this run's outputs, and the pin for whatever has not run yet.
  const plates = React.useMemo(() => {
    const pinned = pinnedPayload(graph);
    return platesInGraph(graph, (nodeId, port) => runtimes[nodeId]?.outputs?.[port]?.payload ?? pinned(nodeId, port));
  }, [graph, runtimes]);

  const match = (p: StoredPlate) => !q || p.signature.includes(q.toLowerCase()) || p.plate.id.includes(q.toLowerCase());
  const shown = plates.filter(match);
  const index = Math.min(sel, Math.max(0, shown.length - 1));
  const current = shown[index];
  const go = (i: number) => { if (i >= 0 && i < shown.length) setSel(i); };
  if (from === null) return null;

  return (
    <Dialog
      width="min(1180px, 94vw)"
      height="min(860px, 90vh)"
      icon={<Icon.brush size={14} />}
      title={t('plateStore.title')}
      titleExtra={<span className="nc-k">{t('plateStore.count', { n: shown.length })}</span>}
      onClose={close}
      closeTitle={t('script.done')}
      onKey={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(index + (e.key === 'ArrowLeft' ? -1 : 1)); } }}
      footer={<>
        <Btn small disabled={index === 0 || !current} onClick={() => go(index - 1)}>‹ {t('script.prev')}</Btn>
        <Btn small disabled={!current || index >= shown.length - 1} onClick={() => go(index + 1)}>{t('script.next')} ›</Btn>
        <div style={{ flex: 1 }} />
        <Btn primary onClick={close}>{t('script.done')}</Btn>
      </>}
    >
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12, padding: 12 }}>
        <div style={{ width: 300, flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ height: 28, background: 'var(--bg-sunk)', border: '1px solid var(--line-2)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', color: 'var(--tx-3)', flex: 'none' }}>
            <Icon.search /><input value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder={t('plateStore.search')} style={{ background: 'none', border: 0, outline: 'none', color: 'var(--tx)', font: 'inherit', fontSize: 'var(--fs-body)', width: '100%' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {shown.length === 0 ? (
              <div className="nc-hint">{plates.length === 0 ? t('plateStore.empty') : t('plateStore.noMatch')}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
                {shown.map((p, i) => (
                  <button key={`${p.nodeId}-${p.plate.id}`} className={`nc-plate-tile ${i === index ? 'on' : ''}`} onClick={() => setSel(i)} title={`${p.plate.id} · ${p.signature}`}>
                    <span style={{ display: 'block', aspectRatio: `${p.style.frame.width} / ${p.style.frame.height}`, background: '#000', borderRadius: 2, overflow: 'hidden' }}>
                      <ScenePreview lazy options={{ style: p.style.style, source: p.plate.source, width: p.style.frame.width, height: p.style.frame.height }} />
                    </span>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-2)', fontSize: 'var(--fs-hint)', marginTop: 3 }}>{p.plate.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {current ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 'none' }}>
                <span className="nc-k" style={{ color: 'var(--tx)' }}>{current.plate.id}</span>
                <span className="nc-k">{current.style.style.name}</span>
              </div>
              <ScenePreview fit guides options={{ style: current.style.style, source: current.plate.source, width: current.style.frame.width, height: current.style.frame.height }} style={{ flex: 1, minHeight: 0 }} />
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 'none' }}>
                {current.plate.keys.map((k) => (
                  <span key={k} className="nc-chip" style={{ cursor: 'default' }}>{k}{current.plate.budget?.[k] ? ` · ${current.plate.budget[k]}` : ''}</span>
                ))}
              </div>
              <div className="nc-hint" style={{ flex: 'none' }}>{t('plateStore.from', { node: current.nodeId })}</div>
            </>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
};
