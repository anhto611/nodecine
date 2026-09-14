'use client';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import type { VideoIR } from '@/contracts/types/ir';
import type { PlayerHandle } from '@/contracts/adapters/types';
import { NodeCineVideo, type VideoProps } from './Video';
import type { MountPlayer } from './adapter';

/** Browser-only: mounts @remotion/player into an element owned by the Video Output node. */
export const mountRemotionPlayer: MountPlayer = (element: HTMLElement, ir: VideoIR): PlayerHandle => {
  const root = createRoot(element);
  const ref = React.createRef<PlayerRef>();
  const props: VideoProps = { ir, mediaBaseUrl: '' };
  root.render(
    React.createElement(Player, {
      ref,
      component: NodeCineVideo as unknown as React.ComponentType<Record<string, unknown>>,
      inputProps: props as unknown as Record<string, unknown>,
      durationInFrames: ir.meta.totalDurationInFrames,
      fps: ir.meta.fps,
      compositionWidth: ir.meta.width,
      compositionHeight: ir.meta.height,
      style: { width: '100%', height: '100%' },
      controls: true,
      clickToPlay: true,
      // Scenes fade in from black; start a few frames in so the poster frame is not empty.
      initialFrame: Math.min(12, ir.meta.totalDurationInFrames - 1),
      acknowledgeRemotionLicense: true,
    }),
  );
  return {
    // The handle is released from a React effect cleanup of the host tree, i.e. while React is
    // still rendering; unmounting a nested root synchronously there is a React warning and a
    // potential race, so defer it to the next macrotask.
    unmount: () => { setTimeout(() => root.unmount(), 0); },
    seekTo: (frame) => ref.current?.seekTo(frame),
    play: () => ref.current?.play(),
    pause: () => ref.current?.pause(),
    onFrame: (listener) => {
      const handler = (e: { detail: { frame: number } }) => listener(e.detail.frame);
      // The ref is populated after the first render; poll briefly until it is.
      let unsub: (() => void) | undefined;
      const timer = setInterval(() => {
        if (!ref.current) return;
        clearInterval(timer);
        ref.current.addEventListener('frameupdate', handler);
        unsub = () => ref.current?.removeEventListener('frameupdate', handler);
      }, 50);
      return () => { clearInterval(timer); unsub?.(); };
    },
  };
};
