'use client';
import React from 'react';
import { OUTPUT_LANGUAGES, languageName } from '@/core/text/languages';
import type { Beat } from '@/nodes/director/beats';
import type { AudioScript, BlockDef, DirectorPlan } from '@/core/types/payloads';
import { Btn, Kv, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useNode, useRuntime, useStudio } from '@/store/useStudio';
import { useWiredLook } from '@/nodes/look/body';
import type { BodyProps } from '@/nodes/kit';

type Params = { prompt: string; outputLanguage: string; beats: Beat[] };

/** The prop keys a beat's blocks offer, so the editor can offer a fact binding for each. */
function propKeys(blocks: BlockDef[]): string[] {
  return [...new Set(blocks.flatMap((b) => Object.keys(b.props)))];
}

/**
 * Body of the one director: the brief, the language, then the beats — each a role, a line on what
 * it does, a weight, a count, the blocks of the wired catalogue the model may pick from, and for
 * every prop the choice between letting the model write it or binding it to a fact. The look itself
 * is not here: it arrives on the stage and blocks wires.
 */
export const AiDirectorBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  const rt = useRuntime(nodeId);
  const { stage, blocks } = useWiredLook(nodeId);
  const p = (node?.params ?? {}) as Partial<Params>;
  const beats = p.beats ?? [];
  const plan = rt?.outputs.plan?.payload as DirectorPlan | undefined;
  const script = rt?.outputs.script?.payload as AudioScript | undefined;
  const raw = (rt?.error?.details as { raw?: unknown } | undefined)?.raw;

  const set = (patch: Partial<Params>) => setParams(nodeId, patch);
  const updateBeat = (i: number, patch: Partial<Beat>) => set({ beats: beats.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const removeBeat = (i: number) => set({ beats: beats.filter((_, j) => j !== i) });
  const addBeat = () => set({ beats: [...beats, { role: `beat ${beats.length + 1}`, brief: '', weight: 1, count: 1, blocks: [], factBindings: {} }] });
  const toggleBlock = (i: number, id: string) => {
    const cur = beats[i]!.blocks;
    updateBeat(i, { blocks: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  const bind = (i: number, prop: string, factKey: string) => {
    const next = { ...beats[i]!.factBindings };
    if (factKey.trim()) next[prop] = factKey.trim();
    else delete next[prop];
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
      {!stage || blocks.length === 0 ? <div className="nc-hint" style={{ color: 'var(--warn)' }}>{t('director.noLook')}</div> : null}
      {beats.map((b, i) => {
        const allowed = b.blocks.length ? blocks.filter((x) => b.blocks.includes(x.id)) : blocks;
        const missing = b.blocks.filter((id) => !blocks.some((x) => x.id === id));
        return (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="nc-scene-row">
              <span className="nc-k" style={{ color: 'var(--accent-2)' }}>{i + 1}</span>
              <input className={`nc-input ${stopFlow}`} value={b.role} title={t('director.role')} onChange={(e) => updateBeat(i, { role: e.target.value })} />
              <input className={`nc-input ${stopFlow}`} style={{ width: 38 }} type="number" min={0.1} step={0.5} value={b.weight} title={t('node.weight')} onChange={(e) => updateBeat(i, { weight: Number(e.target.value) || 1 })} />
              <span className="nc-k">{t('director.count')}</span>
              <input className={`nc-input ${stopFlow}`} style={{ width: 34 }} type="number" min={1} max={12} step={1} value={b.count} onChange={(e) => updateBeat(i, { count: Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1))) })} />
              <button className={`nc-chip ${stopFlow}`} onClick={() => removeBeat(i)} disabled={beats.length <= 1} title="remove"><Icon.x size={9} /></button>
            </div>
            <textarea className={`nc-textarea ${stopFlow}`} rows={2} placeholder={t('director.beatBrief')} value={b.brief} onChange={(e) => updateBeat(i, { brief: e.target.value })} />
            <div className="nc-kv">
              <span className="nc-k">{t('director.blocks')}</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'flex-end' }}>
                {blocks.map((x) => (
                  <button key={x.id} className={`nc-chip ${b.blocks.includes(x.id) ? 'on' : ''} ${stopFlow}`} onClick={() => toggleBlock(i, x.id)}>{x.id}</button>
                ))}
                {missing.map((id) => (
                  <button key={id} className={`nc-chip on ${stopFlow}`} style={{ borderColor: 'var(--err)', color: 'var(--err)' }} title="not wired" onClick={() => toggleBlock(i, id)}>{id}</button>
                ))}
                {b.blocks.length === 0 ? <span className="nc-dim">{t('director.anyBlock')}</span> : null}
              </span>
            </div>
            {propKeys(allowed).map((k) => (
              <Kv key={k} k={k} v={
                <input className={`nc-input ${stopFlow}`} placeholder={t('director.bindNone')} title={t('director.bind')} value={b.factBindings[k] ?? ''} onChange={(e) => bind(i, k, e.target.value)} />
              } />
            ))}
          </div>
        );
      })}
      <Btn small className={stopFlow} onClick={addBeat} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('node.addScene')}</Btn>

      {script && plan && (
        <>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('director.narration', { n: script.text.split(/\s+/).length })}</div>
          <div style={{ fontSize: 9, color: 'var(--tx-2)', lineHeight: 1.5, maxHeight: 54, overflow: 'hidden' }}>{script.text}</div>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('director.written')}</div>
          {plan.scenes.map((s, i) => (
            <div key={i} className="nc-kv"><span className="nc-k">{i + 1} · {s.blockId}{s.tone ? ` · ${s.tone}` : ''}</span><span className="nc-v">{String(s.props.headline ?? s.props.text ?? '')}</span></div>
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
