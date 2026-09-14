'use client';
import React from 'react';
import type { ScenePlan } from '@/contracts/types/payloads';
import { padTailFramesOf, voiceTrackOf, type VideoIR } from '@/contracts/types/ir';
import { Kv, useT } from '@/components/ui';
import { FormBody } from '@/nodes/form-body';
import { useInputPayload, useOutputPayload } from '@/store/useStudio';
import { readIR } from '@/contracts/types/migrate-ir';
import type { BodyProps } from '@/nodes/kit';

export const AssemblerBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const plan = useInputPayload<ScenePlan>(nodeId, 'plan');
  const ir: VideoIR | undefined = readIR(useOutputPayload(nodeId, 'ir'));
  const colors = ['var(--accent)', 'var(--accent-2)', 'var(--ok)', 'var(--run)', 'var(--warn)'];
  return (
    <>
      <Kv k={t('node.total')} v={ir ? `${ir.meta.totalDurationInFrames} ${t('node.frames')} · ${ir.meta.width}×${ir.meta.height}` : '—'} dim={!ir} />
      <FormBody nodeId={nodeId} />
      <div className="nc-alloc">
        {(ir?.beats ?? plan?.scenes ?? []).map((s, i, arr) => {
          const w = 'durationInFrames' in s ? s.durationInFrames : (s as { weight: number }).weight;
          const sum = arr.reduce((a, x) => a + ('durationInFrames' in x ? x.durationInFrames : (x as { weight: number }).weight), 0);
          return <div key={i} style={{ width: `${(100 * w) / sum}%`, background: ir ? colors[i % colors.length] : 'var(--tx-3)', opacity: ir ? 1 : 0.25 }} />;
        })}
      </div>
      {ir && (() => {
        const durations = ir.beats.map((b) => b.durationInFrames).join(' / ');
        // Ten durations do not fit one row; keep the line to one and hand the full list to the tooltip.
        const clock = voiceTrackOf(ir) ? `${t('node.padTail')} ${padTailFramesOf(ir)}f` : t('node.silent');
        return <div className="nc-hint one-line" title={durations}>{ir.beats.length} {t('node.scenes')} · {durations} · {clock}</div>;
      })()}
    </>
  );
};
