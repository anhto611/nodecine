'use client';
import React from 'react';
import { getEngineFactory } from '@/contracts/adapters/registry';
import type { PlayerHandle } from '@/contracts/adapters/types';
import { padTailFramesOf, voiceTrackOf, type VideoIR } from '@/contracts/types/ir';
import type { EngineRef } from '@/contracts/types/payloads';
import { readCapability } from '@/core/nodes/definition';
import { useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useInputPayload, useRuntime, useStudio } from '@/store/useStudio';
import { EnginePick } from '@/components/node-runtime/provider-pick';
import { useParams } from '@/nodes/kit';
import { readIR } from '@/contracts/types/migrate-ir';
import type { BodyProps } from '@/nodes/kit';
import { useFrame } from '@/nodes/kit';

/**
 * The player node (USER_FLOWS §1.4). Mounts the engine's player via the adapter registry; never imports Remotion.
 * Wrapper carries nodrag/nopan/nowheel so scrubbing does not move the canvas (ARCHITECTURE §8.1).
 */
export const VideoOutputBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const videoFrame = useFrame();
  const rt = useRuntime(nodeId);
  const wiredIr: VideoIR | undefined = readIR(useInputPayload(nodeId, 'ir'));
  // The engine is this node's own setting now (§1.3); the ref it probed on its last run says what
  // that engine can do, and the id alone is enough to mount its player.
  const [params] = useParams<{ engineId: string; engineSettings: Record<string, unknown> }>(nodeId);
  const engineId = params.engineId ?? '';
  const engine = rt?.result as EngineRef | undefined;
  const viewingRun = useStudio((s) => s.viewingRun);
  const history = useStudio((s) => s.history);
  const step = useStudio((s) => s.step);
  const running = useStudio((s) => s.running);
  // Unconditional subscription: hooks must not run inside JSX branches.
  const stepNodeType = useStudio((s) => (s.step ? s.graph.nodes.find((n) => n.id === s.step!.nodeId)?.type ?? '' : ''));
  const ir = viewingRun != null ? history.find((r) => r.seq === viewingRun)?.ir ?? wiredIr : wiredIr;
  const previewReady = !engine || readCapability(engine, 'preview')?.status === 'ready';
  const showPlayer = !!ir && !!engineId && previewReady && (rt?.state === 'success' || viewingRun != null);

  const ref = React.useRef<HTMLDivElement>(null);
  const handle = React.useRef<PlayerHandle | null>(null);
  const [frame, setFrame] = React.useState(0);
  const irKey = ir ? `${engineId}:${ir.meta.totalDurationInFrames}:${voiceTrackOf(ir)?.url ?? ''}:${ir.beats.map((b) => b.clipId + b.durationInFrames).join(',')}` : '';

  React.useEffect(() => {
    if (!showPlayer || !ref.current || !ir || !engineId) return;
    const factory = getEngineFactory(engineId);
    if (!factory) return;
    const adapter = factory(params.engineSettings ?? {});
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
  const voice = ir ? voiceTrackOf(ir) : undefined;

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <EnginePick nodeId={nodeId} />
      <div style={{ width: '100%', aspectRatio: ir ? `${ir.meta.width} / ${ir.meta.height}` : `${videoFrame.width} / ${videoFrame.height}`, background: '#000', border: '1px solid var(--line-2)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        {showPlayer ? (
          // Keyed so a new IR gets a fresh container: the previous nested root unmounts asynchronously
          // and must not share an element with the next createRoot().
          <div key={irKey} ref={ref} style={{ position: 'absolute', inset: 0 }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 22px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 'var(--fs-body)', lineHeight: 1.7 }}>
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
          {/* One chip per scene; ten of them do not fit one row, so they wrap instead of spilling past the card. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 3 }}>
            {ir.beats.map((s, i) => {
              const active = frame >= s.startFrame && frame < s.startFrame + s.durationInFrames;
              return (
                <button
                  key={s.clipId}
                  className={`nc-chip ${active ? 'on' : ''}`}
                  style={{ minWidth: 0, textAlign: 'left', padding: '4px 6px', lineHeight: 1.4 }}
                  // Land a few frames in: scenes fade in from black, so the exact first frame previews as empty.
                  onClick={() => handle.current?.seekTo(s.startFrame + Math.min(12, Math.max(0, s.durationInFrames - 1)))}
                  title={s.clipId}
                >
                  <div style={{ color: active ? 'var(--accent-2)' : 'var(--tx)', textTransform: 'uppercase', letterSpacing: '.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('node.scene')} {i + 1}</div>
                  <div style={{ color: 'var(--tx-3)', fontSize: 'var(--fs-hint)' }}>{s.startFrame}–{s.startFrame + s.durationInFrames}</div>
                </button>
              );
            })}
          </div>
          <div className="nc-kv" style={{ borderTop: '1px solid var(--line)', paddingTop: 5 }}>
            <span className="nc-k">{total} {t('node.frames')} · {fps}fps · {voice ? `${t('node.padTail')} ${padTailFramesOf(ir)}f` : t('node.silent')}</span>
            <span className="nc-k">{ir.meta.width}×{ir.meta.height}</span>
          </div>
        </>
      )}
    </div>
  );
};
