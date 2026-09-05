'use client';
import type { VideoIR } from '@/core/types/ir';
import type { PlayerHandle } from '@/core/adapters/types';
import { getScene } from '@/core/scenes/registry';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { MONO } from './draw';
import type { SceneDraw } from './types';

/**
 * Browser-only preview for Hyperframes: one canvas, one audio element, one animation frame loop.
 * The audio track is the clock while playing, so sound and picture cannot drift apart; when paused
 * the frame is whatever was last seeked to.
 */
export function mountHyperframesPlayer(element: HTMLElement, ir: VideoIR): PlayerHandle {
  const { width, height, fps, totalDurationInFrames } = ir.meta;

  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;background:#000';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = 'flex:1;min-height:0;width:100%;object-fit:contain;display:block';
  const ctx = canvas.getContext('2d');

  const audio = document.createElement('audio');
  audio.src = ir.audioTrack.voiceoverUrl;
  audio.preload = 'auto';

  const bar = document.createElement('div');
  bar.style.cssText = 'height:26px;display:flex;align-items:center;gap:8px;padding:0 8px;background:#0b0c10;border-top:1px solid #23262c;font:9px ' + MONO + ';color:#8b909b';
  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.style.cssText = 'width:18px;height:18px;border:0;border-radius:3px;background:#22252b;color:#e4e6ea;cursor:pointer;font:10px ' + MONO;
  playBtn.textContent = '▶';
  const scrub = document.createElement('input');
  scrub.type = 'range';
  scrub.min = '0';
  scrub.max = String(Math.max(0, totalDurationInFrames - 1));
  scrub.value = '0';
  scrub.style.cssText = 'flex:1;accent-color:#7c5cff';
  const time = document.createElement('span');
  time.style.cssText = 'min-width:52px;text-align:right';

  bar.append(playBtn, scrub, time);
  root.append(canvas, bar, audio);
  element.append(root);

  let frame = 0;
  let raf = 0;
  let disposed = false;
  const listeners = new Set<(f: number) => void>();

  const clockFrame = () => Math.min(totalDurationInFrames - 1, Math.max(0, Math.round(audio.currentTime * fps)));

  const paint = () => {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const scene = ir.timeline.find((s) => frame >= s.startFrame && frame < s.startFrame + s.durationInFrames) ?? ir.timeline[ir.timeline.length - 1];
    if (!scene) return;
    const draw = getScene(scene.sceneType)?.renderers[HYPERFRAMES_ENGINE_ID] as SceneDraw | undefined;
    if (!draw) {
      ctx.fillStyle = '#f85149';
      ctx.font = `400 40px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`no renderer: ${scene.sceneType}`, width / 2, height / 2);
      return;
    }
    ctx.save();
    try {
      draw(scene.props, { ctx, width, height, frame: frame - scene.startFrame, durationInFrames: scene.durationInFrames, fps });
    } finally {
      ctx.restore();
    }
  };

  const setFrame = (next: number, fromClock = false) => {
    const f = Math.min(totalDurationInFrames - 1, Math.max(0, Math.round(next)));
    if (f === frame && fromClock) return;
    frame = f;
    scrub.value = String(f);
    time.textContent = `${(f / fps).toFixed(1)}s / ${(totalDurationInFrames / fps).toFixed(1)}s`;
    paint();
    listeners.forEach((l) => l(f));
  };

  const tick = () => {
    if (disposed) return;
    if (!audio.paused) setFrame(clockFrame(), true);
    raf = requestAnimationFrame(tick);
  };

  playBtn.onclick = () => {
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  };
  audio.onplay = () => { playBtn.textContent = '❚❚'; };
  audio.onpause = () => { playBtn.textContent = '▶'; };
  audio.onended = () => { playBtn.textContent = '▶'; };
  scrub.oninput = () => {
    audio.currentTime = Number(scrub.value) / fps;
    setFrame(Number(scrub.value));
  };

  // Text metrics depend on the web font, so repaint once it is in place.
  void (document.fonts?.ready ?? Promise.resolve()).then(() => { if (!disposed) paint(); });
  setFrame(Math.min(12, totalDurationInFrames - 1));
  raf = requestAnimationFrame(tick);

  return {
    unmount() {
      disposed = true;
      cancelAnimationFrame(raf);
      audio.pause();
      listeners.clear();
      root.remove();
    },
    seekTo(f) {
      audio.currentTime = f / fps;
      setFrame(f);
    },
    play() {
      void audio.play().catch(() => undefined);
    },
    pause() {
      audio.pause();
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
