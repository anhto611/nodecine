'use client';
import React from 'react';
import { OUTPUT_LANGUAGES, languageName } from '@/core/text/languages';
import type { Beat } from '@/nodes/director/beats';
import { CONTENT_KEYS, type AudioScript, type ContentKey, type SceneScript } from '@/core/types/payloads';
import { Btn, Kv, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useNode, useRuntime, useStudio } from '@/store/useStudio';
import type { BodyProps } from '@/nodes/kit';

type Params = { prompt: string; outputLanguage: string; beats: Beat[] };

/**
 * Body of the one director: the brief, the language, then the beats — each a role, a line on what
 * it does, a weight, a count, and which content keys come from a fact instead of the model. No
 * block and no look are here: the Look casts them from the scenes this node writes.
 */
export const AiDirectorBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  const rt = useRuntime(nodeId);
  const p = (node?.params ?? {}) as Partial<Params>;
  const beats = p.beats ?? [];
  const scenes = rt?.outputs.scenes?.payload as SceneScript | undefined;
  const script = rt?.outputs.script?.payload as AudioScript | undefined;
  const raw = (rt?.error?.details as { raw?: unknown } | undefined)?.raw;

  const [open, setOpen] = React.useState<number | null>(null);
  const set = (patch: Partial<Params>) => setParams(nodeId, patch);
  const updateBeat = (i: number, patch: Partial<Beat>) => set({ beats: beats.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const removeBeat = (i: number) => set({ beats: beats.filter((_, j) => j !== i) });
  const addBeat = () => set({ beats: [...beats, { role: `beat ${beats.length + 1}`, brief: '', weight: 1, count: 1, factBindings: {} }] });
  const bind = (i: number, key: ContentKey, factKey: string | null) => {
    const next = { ...beats[i]!.factBindings };
    if (factKey === null) delete next[key];
    else next[key] = factKey;
    updateBeat(i, { factBindings: next });
  };

  return (
    <>
      <div className="nc-k">{t('director.brief')}</div>
      <textarea className={`nc-textarea ${stopFlow}`} value={p.prompt ?? ''} onChange={(e) => set({ prompt: e.target.value })} />
      <Kv k={t('director.outputLanguage')} v={
        <select className={`nc-select ${stopFlow}`} value={p.outputLanguage ?? 'auto'} onChange={(e) => set({ outputLanguage: e.target.value })}>
          {OUTPUT_LANGUAGES.map((l) => <option key={l} value={l}>{l === 'auto' ? t('node.auto') : `${l} · ${languageName(l)}`}</option>)}
        </select>
      } />

      <div className="nc-k" style={{ marginTop: 4 }}>{t('director.beats')}</div>
      {beats.map((b, i) => {
        const bound = Object.entries(b.factBindings) as [ContentKey, string][];
        const unbound = CONTENT_KEYS.filter((k) => !(k in b.factBindings));
        const isOpen = open === i;
        // One line per beat, the way the Look node lists its blocks; only the beat being edited unfolds.
        return (
          <div key={i} style={{ border: `1px solid ${isOpen ? 'var(--line-3)' : 'var(--line)'}`, borderRadius: 3, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="nc-scene-row" style={{ cursor: 'pointer' }} onClick={() => setOpen(isOpen ? null : i)}>
              <span className="nc-k" style={{ color: 'var(--accent-2)', flex: '0 0 auto' }}>{isOpen ? '▾' : '▸'} {i + 1}</span>
              <span className="nc-k" style={{ color: 'var(--tx)', flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.role || t('director.role')}</span>
              <span className="nc-k" style={{ flex: '0 0 auto' }} title={`${t('node.weight')} ${b.weight}`}>{b.count}× · {b.weight}w</span>
              {bound.length > 0 && <span className="nc-k" style={{ flex: '0 0 auto' }} title={bound.map(([k, f]) => `${k} ← ${f}`).join(', ')}>{bound.length}⚲</span>}
            </div>
            {isOpen && (
              <>
                <div className="nc-scene-row">
                  <input className={`nc-input ${stopFlow}`} style={{ flex: 1, minWidth: 0 }} value={b.role} title={t('director.role')} onChange={(e) => updateBeat(i, { role: e.target.value })} />
                  <input className={`nc-input ${stopFlow}`} style={{ width: 30 }} type="number" min={0.1} step={0.5} value={b.weight} title={t('node.weight')} onChange={(e) => updateBeat(i, { weight: Number(e.target.value) || 1 })} />
                  <span className="nc-k">{t('director.count')}</span>
                  <input className={`nc-input ${stopFlow}`} style={{ width: 30 }} type="number" min={1} max={12} step={1} value={b.count} onChange={(e) => updateBeat(i, { count: Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1))) })} />
                  <button className={`nc-chip ${stopFlow}`} onClick={() => { removeBeat(i); setOpen(null); }} disabled={beats.length <= 1} title="remove"><Icon.x size={9} /></button>
                </div>
                <textarea className={`nc-textarea ${stopFlow}`} rows={2} placeholder={t('director.beatBrief')} value={b.brief} onChange={(e) => updateBeat(i, { brief: e.target.value })} />
                {bound.map(([key, factKey]) => (
                  <Kv key={key} k={t(`content.${key}`)} v={
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input className={`nc-input ${stopFlow}`} title={t('director.bind')} value={factKey} onChange={(e) => bind(i, key, e.target.value)} />
                      <button className={`nc-chip ${stopFlow}`} onClick={() => bind(i, key, null)} title={t('director.bindNone')}><Icon.x size={9} /></button>
                    </span>
                  } />
                ))}
                {unbound.length > 0 && (
                  <select className={`nc-select ${stopFlow}`} value="" title={t('director.bind')} onChange={(e) => { if (e.target.value) bind(i, e.target.value as ContentKey, e.target.value); }}>
                    <option value="">{t('director.bindAdd')}</option>
                    {unbound.map((k) => <option key={k} value={k}>{t(`content.${k}`)}</option>)}
                  </select>
                )}
              </>
            )}
          </div>
        );
      })}
      <Btn small className={stopFlow} onClick={() => { addBeat(); setOpen(beats.length); }} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('node.addScene')}</Btn>

      {script && scenes && (
        <>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('director.narration', { n: script.text.split(/\s+/).length })}</div>
          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-2)', lineHeight: 1.5, maxHeight: 54, overflow: 'hidden' }}>{script.text}</div>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('director.written')}</div>
          {scenes.scenes.map((s, i) => (
            <div key={i} className="nc-kv"><span className="nc-k">{i + 1} · {s.role}</span><span className="nc-v">{s.content.title ?? s.content.quote ?? s.content.body ?? ''}</span></div>
          ))}
        </>
      )}
      {raw != null && (
        <>
          <div className="nc-k" style={{ marginTop: 4, color: 'var(--err)' }}>{t('director.rawOutput')}</div>
          <pre className={`nc-textarea ${stopFlow}`} style={{ margin: 0, maxHeight: 70, overflow: 'auto', fontSize: 'var(--fs-hint)', whiteSpace: 'pre-wrap' }}>{typeof raw === 'string' ? raw : JSON.stringify(raw, null, 1)}</pre>
        </>
      )}
    </>
  );
};
