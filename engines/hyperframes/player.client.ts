'use client';
import type { VideoIR } from '@/core/types/ir';
import type { PlayerHandle } from '@/core/adapters/types';
import { buildHyperframesDocument } from './document';
import type { MountPlayer } from './adapter';

/**
 * Browser preview: the HyperFrames web component with the composition passed inline as `srcdoc`
 * and run in an opaque-origin sandbox — the block code cannot reach the Studio, and the page's own
 * CSP keeps it off the network. The two vendored scripts are fetched from the app once and inlined.
 */

type HyperframesPlayerElement = HTMLElement & {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ready: boolean;
};

let vendor: Promise<{ gsapSource: string; runtimeSource: string }> | null = null;
function vendorSources() {
  if (!vendor) {
    vendor = Promise.all(['gsap.js', 'hyperframes-runtime.js'].map((n) => fetch(`/api/vendor/${n}`).then((r) => { if (!r.ok) throw new Error(`vendor ${n}: ${r.status}`); return r.text(); })))
      .then(([gsapSource, runtimeSource]) => ({ gsapSource: gsapSource!, runtimeSource: runtimeSource! }))
      .catch((e) => { vendor = null; throw e; });
  }
  return vendor;
}

let elementDefined: Promise<void> | null = null;
const defineElement = () => (elementDefined ??= import('@hyperframes/player').then(() => undefined));

export const mountHyperframesPlayer: MountPlayer = (element: HTMLElement, ir: VideoIR): PlayerHandle => {
  const { fps, totalDurationInFrames } = ir.meta;
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0;background:#000;display:flex;align-items:center;justify-content:center';
  element.append(host);

  let player: HyperframesPlayerElement | null = null;
  let disposed = false;
  let raf = 0;
  let lastFrame = -1;
  let pendingSeek: number | null = Math.min(12, totalDurationInFrames - 1);
  const listeners = new Set<(f: number) => void>();

  const tick = () => {
    if (disposed) return;
    if (player?.ready) {
      const f = Math.min(totalDurationInFrames - 1, Math.max(0, Math.round(player.currentTime * fps)));
      if (f !== lastFrame) {
        lastFrame = f;
        listeners.forEach((l) => l(f));
      }
    }
    raf = requestAnimationFrame(tick);
  };

  void Promise.all([vendorSources(), defineElement()])
    .then(([sources]) => {
      if (disposed) return;
      const html = buildHyperframesDocument(ir, { ...sources, voiceoverSrc: ir.audioTrack.voiceoverUrl, fontBase: '/fonts' });
      const el = document.createElement('hyperframes-player') as HyperframesPlayerElement;
      el.setAttribute('width', String(ir.meta.width));
      el.setAttribute('height', String(ir.meta.height));
      el.setAttribute('controls', '');
      el.setAttribute('sandbox-origin', 'opaque');
      el.setAttribute('srcdoc', html);
      el.style.cssText = 'width:100%;height:100%;display:block';
      el.addEventListener('ready', () => {
        if (pendingSeek !== null) { el.seek(pendingSeek / fps); pendingSeek = null; }
      }, { once: true });
      host.append(el);
      player = el;
      raf = requestAnimationFrame(tick);
    })
    .catch((e: unknown) => {
      if (disposed) return;
      host.textContent = `Hyperframes preview failed: ${e instanceof Error ? e.message : String(e)}`;
      host.style.cssText += ';color:#f85149;font:12px ui-monospace,monospace;padding:12px';
    });

  return {
    unmount() {
      disposed = true;
      cancelAnimationFrame(raf);
      listeners.clear();
      player?.pause();
      host.remove();
    },
    seekTo(frame) {
      if (player?.ready) player.seek(frame / fps);
      else pendingSeek = frame;
    },
    play() { player?.play(); },
    pause() { player?.pause(); },
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
