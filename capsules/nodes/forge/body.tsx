'use client';
import React from 'react';
import { Btn, Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useParams, useRun, useRuntime, type BodyProps } from '@/capsules/sdk/host';
import { FormBody } from '@/capsules/sdk/form-body';
import { ProviderPick } from '@/capsules/sdk/pickers';

const COUNTS = [0, 1, 2, 3, 4] as const;

interface ForgedView {
  name: string;
  description: string;
  still?: string;
}

/** The shelf, how many to forge and with which model; after a run, what was forged, each with the still it was judged by. */
export const ForgeBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ attempt: number; forged: ForgedView[]; forgedFor: string; max: number }>(nodeId);
  const { running, runNode } = useRun();
  const ran = !!useRuntime(nodeId) && !!p.forgedFor;
  const forged = p.forged ?? [];
  const forgeAgain = () => {
    set({ attempt: (p.attempt ?? 0) + 1 });
    setTimeout(() => runNode(nodeId), 0);
  };
  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ProviderPick nodeId={nodeId} kind="llm" />
      <FormBody
        nodeId={nodeId}
        fields={['max']}
        widgets={{ max: { labelKey: 'node.forgeMax', options: COUNTS.map((n) => ({ value: n, label: String(n) })) } }}
      />
      {forged.length > 0 ? (
        <>
          <span className="nc-k">{t('node.forgeCount', { count: forged.length })}</span>
          {forged.map((f) => (
            <div key={f.name} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              {f.still && <img src={f.still} alt="" style={{ width: 96, flex: '0 0 96px', borderRadius: 4, background: '#222' }} />}
              <Kv k={f.name} v={f.description} dim />
            </div>
          ))}
        </>
      ) : (
        ran && (
          <div className="nc-hint" style={{ marginTop: 0 }}>
            {t('node.forgeNone')}
          </div>
        )
      )}
      {(p.max ?? 2) > 0 && (
        <Btn small style={{ alignSelf: 'flex-start' }} disabled={running} onClick={forgeAgain}>
          {t('node.forgeAgain')}
        </Btn>
      )}
    </div>
  );
};
