'use client';
import React from 'react';
import { Btn, useT, stopFlow } from '@/capsules/sdk/ui';
import { Icon } from '@/capsules/sdk/icons';
import { FormBody } from '@/capsules/sdk/form-body';
import { useRun, useRuntime, type BodyProps } from '@/capsules/sdk/host';

export const CaptionExportBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const { running, runNode } = useRun();
  const result = rt?.result as { outputUrl?: string; bytes?: number; fileName?: string; lines?: number } | undefined;
  const done = rt?.state === 'success' && !!result?.outputUrl;
  return (
    <>
      <FormBody nodeId={nodeId} />
      {done ? (
        <a className={`nc-btn nc-btn-sm ${stopFlow}`} href={result.outputUrl} download={result.fileName} style={{ justifyContent: 'center', marginTop: 4 }}>
          <Icon.down size={10} /> {t('node.download')} · {result.lines} {t('node.lines')}
        </a>
      ) : (
        <Btn small className={stopFlow} disabled={running} onClick={() => runNode(nodeId)} style={{ justifyContent: 'center', marginTop: 4 }}>
          <Icon.play size={9} /> {t('node.writeFile')}
        </Btn>
      )}
    </>
  );
};
