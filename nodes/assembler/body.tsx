'use client';
import React from 'react';
import type { DirectorPlan } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useInputPayload, useRuntime } from '@/store/useStudio';
import { useParams, type BodyProps } from '@/nodes/kit';

export const AssemblerBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ fps: number; minTotalFrames: number; title: string }>(nodeId);
  const rt = useRuntime(nodeId);
  const plan = useInputPayload<DirectorPlan>(nodeId, 'plan');
  const ir = rt?.outputs.ir?.payload as VideoIR | undefined;
  const colors = ['var(--accent)', 'var(--accent-2)', 'var(--ok)', 'var(--run)', 'var(--warn)'];
  return (
    <>
      <Kv k={t('node.total')} v={ir ? `${ir.meta.totalDurationInFrames} ${t('node.frames')}` : '—'} dim={!ir} />
      <Kv k={t('node.fps')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 44 }} type="number" value={p.fps} onChange={(e) => set({ fps: Number(e.target.value) || 30 })} />} />
      <Kv k={t('node.minFrames')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 54 }} type="number" value={p.minTotalFrames} onChange={(e) => set({ minTotalFrames: Number(e.target.value) || 0 })} />} />
      <Kv k={t('node.title')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 100 }} value={p.title} onChange={(e) => set({ title: e.target.value })} />} />
      <div className="nc-alloc">
        {(ir?.timeline ?? plan?.scenes ?? []).map((s, i, arr) => {
          const w = 'durationInFrames' in s ? s.durationInFrames : (s as { weight: number }).weight;
          const sum = arr.reduce((a, x) => a + ('durationInFrames' in x ? x.durationInFrames : (x as { weight: number }).weight), 0);
          return <div key={i} style={{ width: `${(100 * w) / sum}%`, background: ir ? colors[i % colors.length] : 'var(--tx-3)', opacity: ir ? 1 : 0.25 }} />;
        })}
      </div>
      {ir && <div className="nc-hint">{ir.timeline.map((s) => s.durationInFrames).join(' / ')} · {t('node.padTail')} {ir.audioTrack.padTailFrames}f</div>}
    </>
  );
};
