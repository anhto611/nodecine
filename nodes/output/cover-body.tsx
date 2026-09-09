'use client';
import React from 'react';
import type { CoverDef, EngineRef } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import { readCapability } from '@/core/nodes/definition';
import { Btn, Kv, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useInputPayload, useRuntime, useStudio } from '@/store/useStudio';
import { useParams, type BodyProps } from '@/nodes/kit';
import { FormBody } from '@/nodes/form-body';
import { CoverFields } from '@/nodes/cover-fields';
import { coverFrom } from './node';

export const CoverBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const running = useStudio((s) => s.running);
  const runNode = useStudio((s) => s.runNode);
  const [p, set] = useParams<{ cover: string; props: Record<string, unknown>; fileName: string; resolution: string }>(nodeId);
  const ir = useInputPayload<VideoIR>(nodeId, 'ir');
  const engine = useInputPayload<EngineRef>(nodeId, 'engine');
  const covers = ir?.covers ?? [];
  const cover = ir ? coverFrom(ir, p.cover ?? '') : undefined;
  const canRender = !!ir && !!cover && !!engine && readCapability(engine, 'render')?.status === 'ready' && !running;
  const result = rt?.result as { outputUrl?: string; bytes?: number; fileName?: string } | undefined;
  const setProp = (name: string, v: unknown) => set({ props: { ...(p.props ?? {}), [name]: v } });
  return (
    <>
      {covers.length > 1 && (
        <Kv k={t('node.cover')} v={
          <select className={`nc-select ${stopFlow}`} value={p.cover ?? ''} onChange={(e) => set({ cover: e.target.value })}>
            {covers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        } />
      )}
      {cover ? (
        <>
          <div className="nc-hint">{cover.name} · {cover.frame.width}×{cover.frame.height}</div>
          {/* Empty here means "as the Art Director designed it": this form overrides one export, it
              does not define the cover. */}
          <CoverFields cover={cover} values={p.props ?? {}} onChange={setProp} placeholderHint={t('node.coverOverrideHint')} />
        </>
      ) : (
        <div className="nc-hint" style={{ color: 'var(--warn)' }}>{t('node.noCover')}</div>
      )}
      <FormBody nodeId={nodeId} fields={['fileName', 'resolution']} />
      {result?.outputUrl && rt?.state === 'success' && (
        <>
          <img src={result.outputUrl} alt="" style={{ width: '100%', borderRadius: 3, border: '1px solid var(--line-2)', marginTop: 4 }} />
          <a className={`nc-btn nc-btn-sm ${stopFlow}`} href={result.outputUrl} download={result.fileName} style={{ justifyContent: 'center', marginTop: 4 }}>
            <Icon.down size={10} /> {t('node.download')} · {((result.bytes ?? 0) / 1024).toFixed(0)} KB
          </a>
        </>
      )}
      <Btn small primary className={stopFlow} disabled={!canRender} onClick={() => void runNode(nodeId)} style={{ justifyContent: 'center', marginTop: 4 }}>
        <Icon.play size={9} /> {rt?.state === 'running' ? '…' : t('node.capture')}
      </Btn>
    </>
  );
};
