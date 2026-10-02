'use client';
import React from 'react';
import { useHost } from '@/capsules/sdk/host';
import { getEngineFactory } from '@/contracts/adapters/registry';
import type { PlayerHandle } from '@/contracts/adapters/types';
import type { PartPreview } from './preview.server';
import type { Project } from './parts';

/**
 * A thumbnail is a page the engine prepares, so only a few are prepared at once; the rest wait their
 * turn rather than asking the server for every page the moment the dialog opens.
 */
const THUMBNAILS_AT_ONCE = 3;
let running = 0;
const waiting: (() => void)[] = [];
async function inTurn<T>(work: () => Promise<T>): Promise<T> {
  if (running >= THUMBNAILS_AT_ONCE) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** A short fingerprint of a file, so a picture is redrawn when the part it shows is edited. */
const fingerprint = (text: string): string => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** Mounts the engine's player; `still` makes it a paused picture instead, `loop` plays it over and over from the start. */
export const Player: React.FC<{ preview: PartPreview; still?: boolean; loop?: boolean }> = ({ preview, still, loop }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const factory = getEngineFactory(preview.engineId);
    if (!ref.current || !factory) return;
    let handle: PlayerHandle | null = null;
    try {
      handle = factory({}).mountPlayer(ref.current, { ...preview, ...(still ? { controls: false, still: Math.max(0, Math.min(preview.duration * 0.6, preview.duration - 0.1)) } : { loop }) });
    } catch {
      handle = null;
    }
    return () => handle?.unmount();
  }, [preview, still, loop]);
  return <div ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: still ? 'none' : 'auto' }} />;
};

/**
 * A box of the picture's own shape, no taller than `maxHeight`: its width follows from that height, so
 * a portrait film is not squeezed into a strip as wide as the panel.
 */
export const frameBox = (size: { width: number; height: number }, maxHeight: string): React.CSSProperties => ({
  position: 'relative',
  width: `min(100%, calc(${maxHeight} * ${size.width} / ${size.height}))`,
  aspectRatio: `${size.width} / ${size.height}`,
  margin: '0 auto',
  background: '#000',
  borderRadius: 4,
  overflow: 'hidden',
});

/** Becomes true once the element has scrolled into view, and stays true. */
function useSeen<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T>(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true);
      },
      { rootMargin: '200px' },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/**
 * One part as a picture: a paused frame of its preview, drawn once it scrolls into view and redrawn
 * when its own file changes. What is written under it is the caller's.
 */
/**
 * Sized one of two ways: `height`, the picture no taller than that in a wall that wraps; or `width`, the
 * card exactly that wide in a row that scrolls, the picture filling it at its own shape.
 */
export const Thumbnail: React.FC<{
  path: string;
  project: Project;
  engine?: string;
  selected?: boolean;
  height?: string;
  width?: string;
  onOpen: () => void;
  title?: string;
  children?: React.ReactNode;
}> = ({ path, project, engine, selected, height = '260px', width, onOpen, title, children }) => {
  const { action } = useHost();
  const [ref, seen] = useSeen<HTMLButtonElement>();
  const [live, setLive] = React.useState<PartPreview | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!seen) return;
    let gone = false;
    setFailed(null);
    inTurn(() => action<PartPreview>('composition/preview-part', [{ ...project, engine }, path])).then(
      (preview) => {
        if (!gone) setLive(preview);
      },
      (e: Error) => {
        if (!gone) setFailed(e.message);
      },
    );
    return () => {
      gone = true;
    };
    // Redrawn when this part's own file changes; an edit elsewhere keeps the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, path, fingerprint(project.files[path] ?? '')]);

  return (
    <button
      ref={ref}
      className={`nc-chip ${selected ? 'on' : ''}`}
      onClick={onOpen}
      title={title}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: 6, textAlign: 'left', whiteSpace: 'normal', minWidth: 0, ...(width ? { flex: `0 0 ${width}` } : {}) }}
    >
      <div style={width ? { ...frameBox(live ?? { width: 9, height: 16 }, height), width: '100%' } : frameBox(live ?? { width: 9, height: 16 }, height)}>
        {live ? (
          <Player preview={live} still />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              textAlign: 'center',
              color: failed ? 'var(--err)' : 'var(--tx-3)',
              fontSize: 'var(--fs-hint)',
              overflowWrap: 'anywhere',
            }}
          >
            {failed ?? '…'}
          </div>
        )}
      </div>
      {children}
    </button>
  );
};
