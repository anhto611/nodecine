'use client';
import React from 'react';
import type { Composition } from '@/contracts/types/composition';
import { Kv, Btn, useT, stopFlow } from '@/capsules/sdk/ui';
import { Icon } from '@/capsules/sdk/icons';
import { useInputPayload, useParams, useRun, useRuntime, type BodyProps } from '@/capsules/sdk/host';
import { FormBody } from '@/capsules/sdk/form-body';

export const ExportBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p] = useParams<{ quality: string }>(nodeId);
  const rt = useRuntime(nodeId);
  const { running, runNode, cancel } = useRun();
  const composition = useInputPayload<Composition>(nodeId, 'composition');
  const canRender = !!composition && !running;
  const result = rt?.result as { outputUrl?: string; bytes?: number; fileName?: string } | undefined;
  if (rt?.state === 'running') {
    return (
      <>
        <Kv k={p.quality} v={rt.progress?.message ?? '…'} />
        <div className="nc-bar"><div style={{ width: `${Math.round((rt.progress?.fraction ?? 0) * 100)}%` }} /></div>
        <Btn small danger className={stopFlow} onClick={cancel} style={{ alignSelf: 'flex-end', marginTop: 4 }}>{t('node.cancel')}</Btn>
      </>
    );
  }
  return (
    <>
      <FormBody nodeId={nodeId} />
      {composition && <Kv k={t('node.size')} v={`${composition.width}×${composition.height} · ${composition.fps}fps`} dim />}
      {result?.outputUrl && rt?.state === 'success' && (
        <a className={`nc-btn nc-btn-sm ${stopFlow}`} href={result.outputUrl} download={result.fileName} style={{ justifyContent: 'center', marginTop: 4 }}>
          <Icon.down size={10} /> {t('node.download')} · {((result.bytes ?? 0) / 1024 / 1024).toFixed(1)} MB
        </a>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <Btn small primary className={stopFlow} disabled={!canRender} onClick={() => void runNode(nodeId)} style={{ flex: 1, justifyContent: 'center' }} title={!composition ? t('node.waiting', { port: t('port.composition') }) : undefined}>
          <Icon.play size={9} /> {t('node.render')}
        </Btn>
      </div>
    </>
  );
};
