'use client';
import React from 'react';
import type { ScenePlan } from '@/core/types/payloads';
import { Kv, useT } from '@/components/ui';
import { ScenePreview } from '@/components/ScenePreview';
import { FormBody } from '@/nodes/form-body';
import { useParams, type BodyProps } from '@/nodes/kit';
import { ImagePick } from '@/components/node-runtime/content-editor';
import { useInputPayload, useOutputPayload } from '@/store/useStudio';
import { listTransitions } from '@/core/visual/transitions';
import { stopFlow } from '@/components/ui';
import type { EngineRef } from '@/core/types/payloads';
import type { IllustratorParams } from './node';

/**
 * The Illustrator's body: the brief, the ratio, an optional picture — and, once it has run, the
 * storyboard it drew, to look at. There is nothing to edit in the drawing: change the brief and
 * run again, or force a run for a fresh one.
 */
export const IllustratorBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<IllustratorParams>(nodeId);
  const plan = useOutputPayload<ScenePlan>(nodeId, 'plan');
  const engine = useInputPayload<EngineRef>(nodeId, 'engine');
  // The names the wired engine has, or every name any engine registered; a name set on another machine stays selectable.
  const names = listTransitions(engine?.engineId);
  const current = p.transition ?? 'fade';
  const options = names.includes(current) ? names : [current, ...names];
  return (
    <>
      <FormBody nodeId={nodeId} fields={['brief', 'frame']} widgets={{ brief: { widget: 'textarea', placeholder: t('illustrator.briefPlaceholder') } }} />
      <Kv k={t('illustrator.character')} v={<ImagePick url={p.character || undefined} onPick={(url) => set({ character: url ?? '' })} />} />
      <Kv
        k={t('node.transition')}
        v={
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select className={`nc-select ${stopFlow}`} value={current} onChange={(e) => set({ transition: e.target.value })}>
              {options.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input className={`nc-input ${stopFlow}`} type="number" min={0.1} max={2} step={0.1} value={p.transitionSeconds ?? 0.4} onChange={(e) => set({ transitionSeconds: Math.min(2, Math.max(0.1, Number(e.target.value) || 0.4)) })} style={{ width: 52 }} />
            <span className="nc-k">s</span>
          </span>
        }
      />
      {plan ? (
        <>
          <div className="nc-k" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>storyboard</span><span>{plan.style.name} · {t('illustrator.scenes', { n: plan.scenes.length })}</span></div>
          <Storyboard plan={plan} width={36} />
        </>
      ) : null}
      <div className="nc-hint">{t('illustrator.hint')}</div>
    </>
  );
};

/** The scenes as drawn, one small frame each, in the frame's ratio. */
export const Storyboard: React.FC<{ plan: ScenePlan; width: number }> = ({ plan, width }) => {
  const { width: fw, height: fh } = plan.frame;
  const h = Math.round((width * fh) / fw);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {plan.scenes.map((spec, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', width }} title={`${i + 1}`}>
          <div className="nc-k" style={{ alignSelf: 'stretch', fontSize: 'var(--fs-hint)', color: 'var(--accent-2)' }}>{i + 1}</div>
          <div style={{ width, height: h, borderRadius: 2, overflow: 'hidden', background: '#000' }}>
            <ScenePreview options={{ style: plan.style, source: spec.source, vars: plan.vars, width: fw, height: fh }} style={{ width, height: h }} />
          </div>
        </div>
      ))}
    </div>
  );
};
