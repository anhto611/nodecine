'use client';
import React from 'react';
import type { EngineRef } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import { readCapability } from '@/core/nodes/definition';
import { Btn, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useInputPayload, useRuntime, useStudio } from '@/store/useStudio';
import { FormBody } from '@/nodes/form-body';
import type { BodyProps } from '@/nodes/kit';

export const PosterBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const running = useStudio((s) => s.running);
  const runNode = useStudio((s) => s.runNode);
  const ir = useInputPayload<VideoIR>(nodeId, 'ir');
  const engine = useInputPayload<EngineRef>(nodeId, 'engine');
  const canRender = !!ir && !!engine && readCapability(engine, 'render')?.status === 'ready' && !running;
  const result = rt?.result as { outputUrl?: string; bytes?: number; fileName?: string } | undefined;
  const seconds = ir ? ir.meta.totalDurationInFrames / ir.meta.fps : undefined;
  return (
    <>
      <FormBody nodeId={nodeId} widgets={{ atSeconds: { step: 0.5, placeholder: seconds ? `0 – ${seconds.toFixed(1)}` : undefined } }} />
      {result?.outputUrl && rt?.state === 'success' && (
        <>
          {/* The still itself: the one thing that says whether this is the right frame. */}
          <img src={result.outputUrl} alt="" style={{ width: '100%', borderRadius: 3, border: '1px solid var(--line-2)', marginTop: 4 }} />
          <a className={`nc-btn nc-btn-sm ${stopFlow}`} href={result.outputUrl} download={result.fileName} style={{ justifyContent: 'center', marginTop: 4 }}>
            <Icon.down size={10} /> {t('node.download')} · {((result.bytes ?? 0) / 1024).toFixed(0)} KB
          </a>
        </>
      )}
      <Btn
        small
        primary
        className={stopFlow}
        disabled={!canRender}
        onClick={() => void runNode(nodeId)}
        style={{ justifyContent: 'center', marginTop: 4 }}
        title={!ir ? t('node.waiting', { port: t('port.videoIR') }) : !engine ? t('node.waiting', { port: t('port.engineRef') }) : readCapability(engine, 'render')?.reason}
      >
        <Icon.play size={9} /> {rt?.state === 'running' ? '…' : t('node.capture')}
      </Btn>
    </>
  );
};
