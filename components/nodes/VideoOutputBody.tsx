'use client';
import React from 'react';
import { getEngineFactory } from '@/core/adapters/registry';
import type { PlayerHandle } from '@/core/adapters/types';
import type { VideoIR } from '@/core/types/ir';
import type { EngineRef } from '@/core/types/payloads';
import { readCapability } from '@/core/nodes/definition';
import { useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useInputPayload, useRuntime, useStudio } from '@/store/useStudio';
import type { BodyProps } from './bodies';

/**
 * The player node (USER_FLOWS §1.4). Mounts the engine's player via the adapter registry; never imports Remotion.
 * Wrapper carries nodrag/nopan/nowheel so scrubbing does not move the canvas (ARCHITECTURE §8.1).
 */
export const VideoOutputBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const wiredIr = useInputPayload<VideoIR>(nodeId, 'ir');
  const engine = useInputPayload<EngineRef>(nodeId, 'engine');
  const viewingRun = useStudio((s) => s.viewingRun);
  const history = useStudio((s) => s.history);
  const step = useStudio((s) => s.step);
  const running = useStudio((s) => s.running);
  // Unconditional subscription: hooks must not run inside JSX branches.
  const stepNodeType = useStudio((s) => (s.step ? s.graph.nodes.find((n) => n.id === s.step!.nodeId)?.type ?? '' : ''));
  const ir = viewingRun != null ? history.find((r) => r.seq === viewingRun)?.ir ?? wiredIr : wiredIr;
  const previewReady = readCapability(engine, 'preview')?.status === 'ready';
  const showPlayer = !!ir && !!engine && previewReady && (rt?.state === 'success' || viewingRun != null);

  const ref = React.useRef<HTMLDivElement>(null);
  const handle = React.useRef<PlayerHandle | null>(null);
  const [frame, setFrame] = React.useState(0);
  const irKey = ir ? `${engine?.engineId}:${ir.meta.totalDurationInFrames}:${ir.audioTrack.voiceoverUrl}:${ir.timeline.map((s) => s.id + s.durationInFrames).join(',')}` : '';

  React.useEffect(() => {
    if (!showPlayer || !ref.current || !ir || !engine) return;
    const factory = getEngineFactory(engine.engineId);
    if (!factory) return;
    const adapter = factory(engine.settings);
    let off: (() => void) | undefined;
    try {
      handle.current = adapter.mountPlayer(ref.current, ir);
      off = handle.current.onFrame(setFrame);
    } catch {
      handle.current = null;
    }
    return () => {
      off?.();
      handle.current?.unmount();
      handle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlayer, irKey]);

  const total = ir?.meta.totalDurationInFrames ?? 0;
  const fps = ir?.meta.fps ?? 30;
  const audioEndFrame = ir ? Math.ceil(ir.audioTrack.durationSeconds * fps) : 0;

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: '100%', aspectRatio: '9 / 16', background: '#000', border: '1px solid var(--line-2)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        {showPlayer ? (
          // Keyed so a new IR gets a fresh container: the previous nested root unmounts asynchronously
          // and must not share an element with the next createRoot().
          <div key={irKey} ref={ref} style={{ position: 'absolute', inset: 0 }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 22px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 9.5, lineHeight: 1.7 }}>
            {running && step ? (
              <>
                <span style={{ color: 'var(--run)' }}><Icon.spin size={22} /></span>
                <div>{stepNodeType ? t(`node.${stepNodeType}`) : ''}</div>
                <div>{t('node.step', { step: step.step, total: step.total })}</div>
              </>
            ) : engine && !previewReady ? (
              <>
                <span style={{ color: 'var(--warn)' }}><Icon.warn size={22} /></span>
                <div>{readCapability(engine, 'preview')?.reason ?? t('node.previewUnavailable')}</div>
              </>
            ) : (
              <>
                <span style={{ opacity: 0.5 }}><Icon.screen size={26} /></span>
                <div>{t('node.noIR')}</div>
              </>
            )}
          </div>
        )}
      </div>
      {ir && (
        <>
          <div style={{ display: 'flex', gap: 3 }}>
            {ir.timeline.map((s, i) => {
              const active = frame >= s.startFrame && frame < s.startFrame + s.durationInFrames;
              return (
                <button
                  key={s.id}
                  className={`nc-chip ${active ? 'on' : ''}`}
                  style={{ flex: s.durationInFrames, textAlign: 'left', padding: '4px 6px', lineHeight: 1.4 }}
                  // Land a few frames in: scenes fade in from black, so the exact first frame previews as empty.
                  onClick={() => handle.current?.seekTo(s.startFrame + Math.min(12, Math.max(0, s.durationInFrames - 1)))}
                  title={s.blockId}
                >
                  <div style={{ color: active ? 'var(--accent-2)' : 'var(--tx)', textTransform: 'uppercase', letterSpacing: '.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('node.scene')} {i + 1}</div>
                  <div style={{ color: 'var(--tx-3)', fontSize: 8 }}>{s.startFrame}–{s.startFrame + s.durationInFrames}</div>
                </button>
              );
            })}
          </div>
          <div className="nc-kv" style={{ borderTop: '1px solid var(--line)', paddingTop: 5 }}>
            <span className="nc-k">{total} {t('node.frames')} · {fps}fps · {t('node.padTail')} {ir.audioTrack.padTailFrames}f{audioEndFrame < total ? '' : ''}</span>
            <span className="nc-k">{ir.meta.width}×{ir.meta.height}</span>
          </div>
        </>
      )}
    </div>
  );
};
