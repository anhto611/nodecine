'use client';
import React from 'react';
import type { ScenePlan } from '@/contracts/types/payloads';
import { ScenePreview } from '@/components/ScenePreview';

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
