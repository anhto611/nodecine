'use client';
import type { PlayerHandle, PlayerOptions } from '@/contracts/adapters/types';

type PlayerElement = HTMLElement & { play(): void; pause(): void; seek(seconds: number): void; currentTime: number };

/**
 * `<hyperframes-player>` in a node's card. The page it loads was prepared on the server with the
 * composition's values. `sandbox-origin="opaque"` keeps the composition's scripts out of the Studio's
 * own page: a composition is code, and a workflow can come from someone else.
 */
export function mountHyperframesPlayer(element: HTMLElement, preview: PlayerOptions): PlayerHandle {
  void import('@hyperframes/player');
  const player = document.createElement('hyperframes-player') as PlayerElement;
  player.setAttribute('src', preview.url);
  player.setAttribute('width', String(preview.width));
  player.setAttribute('height', String(preview.height));
  // A picture without controls is a thumbnail: silent, since nobody chose to play it.
  if (preview.controls !== false) player.setAttribute('controls', '');
  else player.setAttribute('muted', '');
  player.setAttribute('sandbox-origin', 'opaque');
  player.style.width = '100%';
  player.style.height = '100%';
  // A portrait film in a node card or a side panel is a few hundred pixels wide: the player's own
  // spacing needs about 270 for its controls, and past that it cuts the speed button and hides the
  // scrubber. Tighter spacing keeps them all on the bar.
  player.style.setProperty('--hfp-controls-gap', '6px');
  player.style.setProperty('--hfp-controls-padding', '6px 8px');
  player.style.setProperty('--hfp-font-size', '12px');
  // The page shows every clip as its markup left it until something seeks it: a film whose scenes stack
  // their parts would open on all of them at once. So it is seeked as soon as it is ready, to its first
  // frame, or to the moment a thumbnail shows.
  const still = preview.still;
  player.addEventListener('ready', () => {
    player.seek?.(still ?? 0);
    if (still !== undefined) player.pause?.();
  }, { once: true });
  // The page's sound as one file beside it, when it has any: a click on Play does not reach the
  // opaque-origin frame, whose audio is then refused, and the player plays this from the Studio's page
  // instead (see preview-audio.server.ts). A thumbnail makes no sound, so it needs none.
  //
  // Such a page keeps no audio of its own (see register.server.ts), so the frame never reports its audio
  // refused, and the player would never switch to the file: the film ran silent until a reload. With the
  // file in hand the Studio's page takes the sound at once, and again whenever the player hands it back
  // to the frame (a reload of the frame does).
  if (preview.controls !== false) {
    const audio = preview.url.replace(/\.html(\?.*)?$/, '.m4a');
    if (audio !== preview.url) {
      // The player's own fallback, called early. Not public API; without it the player keeps its default.
      const owned = player as PlayerElement & { _audioOwner?: string; _promoteToParentProxy?: () => void };
      const takeSound = () => {
        if (player.hasAttribute('audio-src') && owned._audioOwner !== 'parent') owned._promoteToParentProxy?.();
      };
      player.addEventListener('ready', takeSound);
      player.addEventListener('play', takeSound);
      player.addEventListener('audioownershipchange', takeSound);
      void fetch(audio, { method: 'HEAD' }).then((res) => {
        if (!res.ok || !player.isConnected) return;
        player.setAttribute('audio-src', audio);
        takeSound();
      }, () => {});
    }
  }
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
