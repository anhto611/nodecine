'use client';
import type { PlayerHandle } from '@/contracts/adapters/types';

type PlayerElement = HTMLElement & { play(): void; pause(): void; seek(seconds: number): void; currentTime: number };

/**
 * `<hyperframes-player>` in a node's card. The page it loads was prepared on the server with the
 * composition's values. `sandbox-origin="opaque"` keeps the composition's scripts out of the Studio's
 * own page: a composition is code, and a workflow can come from someone else.
 */
export function mountHyperframesPlayer(element: HTMLElement, preview: { url: string; width: number; height: number }): PlayerHandle {
  void import('@hyperframes/player');
  const player = document.createElement('hyperframes-player') as PlayerElement;
  player.setAttribute('src', preview.url);
  player.setAttribute('width', String(preview.width));
  player.setAttribute('height', String(preview.height));
  player.setAttribute('controls', '');
  player.setAttribute('sandbox-origin', 'opaque');
  player.style.width = '100%';
  player.style.height = '100%';
  element.appendChild(player);
  return {
    unmount: () => player.remove(),
    seekTo: (seconds) => player.seek?.(seconds),
    play: () => player.play?.(),
    pause: () => player.pause?.(),
    onTime: (listener) => {
      const handler = (e: Event) => listener((e as CustomEvent<{ currentTime: number }>).detail?.currentTime ?? player.currentTime ?? 0);
      player.addEventListener('timeupdate', handler);
      return () => player.removeEventListener('timeupdate', handler);
    },
  };
}
