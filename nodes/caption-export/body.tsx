'use client';
import React from 'react';
import { Btn, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useRuntime, useStudio } from '@/store/useStudio';
import { FormBody } from '@/nodes/form-body';
import type { BodyProps } from '@/nodes/kit';

export const CaptionExportBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const running = useStudio((s) => s.running);
  const runNode = useStudio((s) => s.runNode);
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
        <Btn small className={stopFlow} disabled={running} onClick={() => void runNode(nodeId)} style={{ justifyContent: 'center', marginTop: 4 }}>
          <Icon.play size={9} /> {t('node.writeFile')}
        </Btn>
      )}
    </>
  );
};
