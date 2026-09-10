'use client';
import React from 'react';
import type { EngineRef } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import { readCapability } from '@/core/nodes/definition';
import { Kv, Btn, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useInputPayload, useRuntime, useStudio } from '@/store/useStudio';
import { useParams, type BodyProps } from '@/nodes/kit';
import { FormBody } from '@/nodes/form-body';
import { RESOLUTIONS, outputSizeFor } from '@/core/visual/frame';
import { useFrame } from '@/nodes/kit';

export const ExportBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ codec: string; quality: string; resolution: string }>(nodeId);
  const frame = useFrame();
  const rt = useRuntime(nodeId);
  const running = useStudio((s) => s.running);
  const runNode = useStudio((s) => s.runNode);
  const cancel = useStudio((s) => s.cancel);
  const ir = useInputPayload<VideoIR>(nodeId, 'ir');
  const engine = useInputPayload<EngineRef>(nodeId, 'engine');
  const canRender = !!ir && !!engine && readCapability(engine, 'render')?.status === 'ready' && !running;
  const result = rt?.result as { outputUrl?: string; bytes?: number; fileName?: string } | undefined;
  if (rt?.state === 'running') {
    return (
      <>
        <Kv k={`${p.codec} · ${p.quality}`} v={rt.progress?.message ?? '…'} />
        <div className="nc-bar"><div style={{ width: `${Math.round((rt.progress?.fraction ?? 0) * 100)}%` }} /></div>
        <Btn small danger className={stopFlow} onClick={cancel} style={{ alignSelf: 'flex-end', marginTop: 4 }}>{t('node.cancel')}</Btn>
      </>
    );
  }
  return (
    <>
      {/* Resolution is the one field the schema cannot label alone: each option shows the pixel size it yields for this frame. */}
      <FormBody nodeId={nodeId} widgets={{ resolution: { render: (
        <select className={`nc-select ${stopFlow}`} value={p.resolution ?? '1080p'} onChange={(e) => set({ resolution: e.target.value })}>{RESOLUTIONS.map((r) => { const o = outputSizeFor(ir ? { width: ir.meta.width, height: ir.meta.height } : frame, r); return <option key={r} value={r}>{r} · {o.width}×{o.height}</option>; })}</select>
      ) } }} />
      {result?.outputUrl && rt?.state === 'success' && (
        <a className={`nc-btn nc-btn-sm ${stopFlow}`} href={result.outputUrl} download={result.fileName} style={{ justifyContent: 'center', marginTop: 4 }}>
          <Icon.down size={10} /> {t('node.download')} · {((result.bytes ?? 0) / 1024 / 1024).toFixed(1)} MB
        </a>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <Btn small primary className={stopFlow} disabled={!canRender} onClick={() => void runNode(nodeId)} style={{ flex: 1, justifyContent: 'center' }} title={!ir ? t('node.waiting', { port: t('port.videoIR') }) : !engine ? t('node.waiting', { port: t('port.engineRef') }) : readCapability(engine, 'render')?.reason}>
          <Icon.play size={9} /> {t('node.render')}
        </Btn>
      </div>
    </>
  );
};
