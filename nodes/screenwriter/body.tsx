'use client';
import React from 'react';
import { ProviderPick } from '@/components/node-runtime/provider-pick';
import { OUTPUT_LANGUAGES, languageName } from '@/contracts/text/languages';
import type { Beat } from '@/nodes/screenwriter/beats';
import { CONTENT_KEYS, type AudioScript, type ContentKey, type SceneScript } from '@/contracts/types/payloads';
import { Btn, Kv, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useNode, useRuntime, useStudio } from '@/store/useStudio';
import type { BodyProps } from '@/nodes/kit';
import { FormPicker } from '@/nodes/form-picker';

type Params = { prompt: string; outputLanguage: string; targetSeconds: number; beats: Beat[] };

/**
 * Body of the Screenwriter: the brief, the language, then the beats — each a role, a line on what
 * it does, a weight, a count, and which content keys come from a fact instead of the model. No
 * visual definition is here: the Illustrator draws the scenes this node writes.
 */
export const ScreenwriterBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  const rt = useRuntime(nodeId);
  const p = (node?.params ?? {}) as Partial<Params>;
  const beats = p.beats ?? [];
  const scenes = rt?.outputs.scenes?.payload as SceneScript | undefined;
  const script = rt?.outputs.script?.payload as AudioScript | undefined;
  const raw = (rt?.error?.details as { raw?: unknown } | undefined)?.raw;

  const setOverlay = useStudio((s) => s.setOverlay);
  const openBeat = (i: number) => setOverlay({ nodeId, data: { beat: i } });
  const set = (patch: Partial<Params>) => setParams(nodeId, patch);
  const removeBeat = (i: number) => set({ beats: beats.filter((_, j) => j !== i) });
  const addBeat = () => set({ beats: [...beats, { role: `beat ${beats.length + 1}`, brief: '', weight: 1, count: 1, factBindings: {} }] });

  return (
    <>
      <ProviderPick nodeId={nodeId} kind="llm" />
      <div className="nc-k">{t('screenwriter.brief')}</div>
      <textarea className={`nc-textarea ${stopFlow}`} value={p.prompt ?? ''} onChange={(e) => set({ prompt: e.target.value })} />
      <FormPicker nodeId={nodeId} />
      <Kv k={t('screenwriter.targetSeconds')} v={
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input className={`nc-input ${stopFlow}`} type="number" min={0} max={600} step={5} style={{ width: 64 }} value={p.targetSeconds ?? 0} onChange={(e) => set({ targetSeconds: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })} />
          <span className="nc-k">{p.targetSeconds ? 's' : t('node.auto')}</span>
        </span>
      } />
      <Kv k={t('screenwriter.outputLanguage')} v={
        <select className={`nc-select ${stopFlow}`} value={p.outputLanguage ?? 'auto'} onChange={(e) => set({ outputLanguage: e.target.value })}>
          {OUTPUT_LANGUAGES.map((l) => <option key={l} value={l}>{l === 'auto' ? t('node.auto') : `${l} · ${languageName(l)}`}</option>)}
        </select>
      } />

      <div className="nc-k" style={{ marginTop: 4 }}>{t('screenwriter.beats')}</div>
      {beats.map((b, i) => {
        const bound = Object.entries(b.factBindings ?? {}) as [ContentKey, string][];
        // One line per beat, drawn and hovered like a scene of a Static Script so that it reads as
        // something to click. Everything about it is edited in the dialog, where there is room.
        return (
          <div key={i} className={`nc-scene-line ${stopFlow}`} title={t('screenwriter.openHint')} onClick={() => openBeat(i)}>
            <span className="nc-k" style={{ color: 'var(--accent-2)', flex: 'none', width: 16 }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
                <span className="nc-k" style={{ minWidth: 0 }}>{b.role || t('screenwriter.role')}</span>
                <span className="nc-chip" style={{ cursor: 'inherit' }} title={`${t('node.weight')} ${b.weight}`}>{b.count}× · {b.weight}w</span>
                {b.factList ? <span className="nc-chip" style={{ cursor: 'inherit' }} title={t('screenwriter.overList', { key: b.factList })}>[] {b.factList}</span> : null}
                {bound.length > 0 && <span className="nc-chip" style={{ cursor: 'inherit' }} title={bound.map(([k, f]) => `${k} ← ${f}`).join(', ')}>{bound.length}⚲</span>}
              </span>
              <span style={{ minWidth: 0, color: b.brief.trim() ? 'var(--tx)' : 'var(--tx-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.brief.trim() || t('screenwriter.beatNoBrief')}</span>
            </span>
            <span className="nc-scene-tools" onClick={(e) => e.stopPropagation()}>
              <button className="nc-chip" onClick={() => removeBeat(i)} disabled={beats.length <= 1} title={t('common.remove')}><Icon.x size={9} /></button>
            </span>
          </div>
        );
      })}
      <Btn small className={stopFlow} onClick={() => { addBeat(); openBeat(beats.length); }} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('node.addScene')}</Btn>

      {script && scenes && (
        <>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('screenwriter.narration', { n: script.text.split(/\s+/).length })}</div>
          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-2)', lineHeight: 1.5, maxHeight: 54, overflow: 'hidden' }}>{script.text}</div>
          <div className="nc-k" style={{ marginTop: 4 }}>{t('screenwriter.written')}</div>
          {scenes.scenes.map((s, i) => (
            <div key={i} className="nc-kv" title={s.narration}><span className="nc-k">{i + 1} · {s.role}</span><span className="nc-v">{s.content.title ?? s.content.quote ?? s.content.body ?? ''}</span></div>
          ))}
        </>
      )}
      {raw != null && (
        <>
          <div className="nc-k" style={{ marginTop: 4, color: 'var(--err)' }}>{t('screenwriter.rawOutput')}</div>
          <pre className={`nc-textarea ${stopFlow}`} style={{ margin: 0, maxHeight: 70, overflow: 'auto', fontSize: 'var(--fs-hint)', whiteSpace: 'pre-wrap' }}>{typeof raw === 'string' ? raw : JSON.stringify(raw, null, 1)}</pre>
        </>
      )}
    </>
  );
};
