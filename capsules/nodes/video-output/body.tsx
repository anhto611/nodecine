'use client';
import React from 'react';
import { getEngineFactory } from '@/contracts/adapters/registry';
import type { PlayerHandle } from '@/contracts/adapters/types';
import type { Composition } from '@/contracts/types/composition';
import { readCapability } from '@/core/nodes/definition';
import { useT, stopFlow } from '@/capsules/sdk/ui';
import { Icon } from '@/capsules/sdk/icons';
import { useInputPayload, useRun, useRuntime, useGraph, useViewedRun, type BodyProps } from '@/capsules/sdk/host';
import type { VideoOutputResult } from './node';

/**
 * The player node. Mounts the player of the engine the composition names, through the adapter
 * registry; never imports an engine. The wrapper carries nodrag/nopan/nowheel so scrubbing does not
 * move the canvas.
 */
export const VideoOutputBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const wired = useInputPayload<Composition>(nodeId, 'composition');
  const viewed = useViewedRun();
  const { step, running } = useRun();
  const graphNodes = useGraph().nodes;
  const stepNodeType = step ? graphNodes.find((n) => n.id === step.nodeId)?.type ?? '' : '';

  const live = rt?.state === 'success' ? (rt.result as VideoOutputResult | undefined) : undefined;
  // A run picked from the history plays what that run prepared, not what is wired now.
  const preview = viewed?.preview ?? live;
  const previewReady = !live || readCapability(live, 'preview')?.status === 'ready';
  const showPlayer = !!preview?.url && previewReady;
  const width = preview?.width ?? wired?.width ?? 1080;
  const height = preview?.height ?? wired?.height ?? 1920;

  const ref = React.useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = React.useState(0);
  const key = preview ? `${preview.engineId}:${preview.url}` : '';

  React.useEffect(() => {
    if (!showPlayer || !ref.current || !preview) return;
    const factory = getEngineFactory(preview.engineId);
    if (!factory) return;
    let handle: PlayerHandle | null = null;
    let off: (() => void) | undefined;
    try {
      handle = factory({}).mountPlayer(ref.current, { url: preview.url, width: preview.width, height: preview.height });
      off = handle.onTime(setSeconds);
    } catch {
      handle = null;
    }
    return () => {
      off?.();
      handle?.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlayer, key]);

  const composition = viewed?.composition ?? wired;
  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: '100%', aspectRatio: `${width} / ${height}`, background: '#000', border: '1px solid var(--line-2)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        {showPlayer ? (
          // Keyed so a new preview gets a fresh container rather than a player reused mid-teardown.
          <div key={key} ref={ref} style={{ position: 'absolute', inset: 0 }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 22px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 'var(--fs-body)', lineHeight: 1.7 }}>
            {running && step ? (
              <>
                <span style={{ color: 'var(--run)' }}><Icon.spin size={22} /></span>
                <div>{stepNodeType ? t(`node.${stepNodeType}`) : ''}</div>
                <div>{t('node.step', { step: step.step, total: step.total })}</div>
              </>
            ) : live && !previewReady ? (
              <>
                <span style={{ color: 'var(--warn)' }}><Icon.warn size={22} /></span>
                <div>{readCapability(live, 'preview')?.reason ?? t('node.previewUnavailable')}</div>
              </>
            ) : (
              <>
                <span style={{ opacity: 0.5 }}><Icon.screen size={26} /></span>
                <div>{t('node.noPreview')}</div>
              </>
            )}
          </div>
        )}
      </div>
      {composition && (
        <div className="nc-kv" style={{ borderTop: '1px solid var(--line)', paddingTop: 5 }}>
          <span className="nc-k">{seconds.toFixed(2)}s · {composition.fps}fps</span>
          <span className="nc-k">{composition.width}×{composition.height}</span>
        </div>
      )}
    </div>
  );
};
