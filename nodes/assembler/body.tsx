'use client';
import React from 'react';
import type { ScenePlan } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useInputPayload, useRuntime } from '@/store/useStudio';
import type { BodyProps } from '@/nodes/kit';

export const AssemblerBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const plan = useInputPayload<ScenePlan>(nodeId, 'plan');
  const ir = rt?.outputs.ir?.payload as VideoIR | undefined;
  const colors = ['var(--accent)', 'var(--accent-2)', 'var(--ok)', 'var(--run)', 'var(--warn)'];
  return (
    <>
      <Kv k={t('node.total')} v={ir ? `${ir.meta.totalDurationInFrames} ${t('node.frames')} · ${ir.meta.width}×${ir.meta.height}` : '—'} dim={!ir} />
      <FormBody nodeId={nodeId} />
      <div className="nc-alloc">
        {(ir?.timeline ?? plan?.scenes ?? []).map((s, i, arr) => {
          const w = 'durationInFrames' in s ? s.durationInFrames : (s as { weight: number }).weight;
          const sum = arr.reduce((a, x) => a + ('durationInFrames' in x ? x.durationInFrames : (x as { weight: number }).weight), 0);
          return <div key={i} style={{ width: `${(100 * w) / sum}%`, background: ir ? colors[i % colors.length] : 'var(--tx-3)', opacity: ir ? 1 : 0.25 }} />;
        })}
      </div>
      {ir && (() => {
        const durations = ir.timeline.map((s) => s.durationInFrames).join(' / ');
        // Ten durations do not fit one row; keep the line to one and hand the full list to the tooltip.
        return <div className="nc-hint one-line" title={durations}>{ir.timeline.length} {t('node.scenes')} · {durations} · {t('node.padTail')} {ir.audioTrack.padTailFrames}f</div>;
      })()}
    </>
  );
};
