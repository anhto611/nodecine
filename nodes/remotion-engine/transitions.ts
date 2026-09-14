import type { CSSProperties } from 'react';
import { REQUIRED_TRANSITIONS } from '@/contracts/types/ir';
import { registerTransition } from '@/contracts/visual/transitions';
import { REMOTION_ENGINE_ID } from './constants';

/**
 * How Remotion draws a transition: not tweens on a timeline but a style per frame, computed from
 * how far the transition has come (`p` in 0..1). `in` dresses the incoming beat clip, `out` the
 * outgoing one, which stays mounted for the transition's length past the cut. The same thirteen
 * names as the gsap catalogue, so a film moves between engines without renaming anything; the
 * registry still says which engine has which.
 */
export type TransitionFrame = { in: CSSProperties; out: CSSProperties };
export type TransitionDrawer = (p: number) => TransitionFrame;

const ease = {
  out: (p: number) => 1 - (1 - p) ** 2,
  inOut: (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
  in: (p: number) => p * p,
  out3: (p: number) => 1 - (1 - p) ** 3,
};
const none: CSSProperties = {};

export const REMOTION_TRANSITIONS: Record<string, TransitionDrawer> = {
  cut: () => ({ in: none, out: none }),
  fade: (p) => ({ in: { opacity: ease.inOut(p) }, out: none }),
  slide: (p) => ({ in: { transform: `translateY(${(1 - ease.out3(p)) * 100}%)` }, out: { transform: `translateY(${-18 * ease.out3(p)}%)`, opacity: 1 - 0.6 * ease.out3(p) } }),
  zoom: (p) => ({ in: { opacity: ease.out(p), transform: `scale(${1.08 - 0.08 * ease.out(p)})` }, out: { transform: `scale(${1 - 0.04 * ease.out(p)})` } }),
  'slide-left': (p) => ({ in: { transform: `translateX(${(1 - ease.out3(p)) * 100}%)` }, out: { transform: `translateX(${-18 * ease.out3(p)}%)` } }),
  'slide-right': (p) => ({ in: { transform: `translateX(${-(1 - ease.out3(p)) * 100}%)` }, out: { transform: `translateX(${18 * ease.out3(p)}%)` } }),
  'push-up': (p) => ({ in: { transform: `translateY(${(1 - ease.inOut(p)) * 100}%)` }, out: { transform: `translateY(${-100 * ease.inOut(p)}%)` } }),
  'push-left': (p) => ({ in: { transform: `translateX(${(1 - ease.inOut(p)) * 100}%)` }, out: { transform: `translateX(${-100 * ease.inOut(p)}%)` } }),
  'wipe-left': (p) => ({ in: { clipPath: `inset(0 0 0 ${(1 - ease.inOut(p)) * 100}%)` }, out: none }),
  'wipe-up': (p) => ({ in: { clipPath: `inset(${(1 - ease.inOut(p)) * 100}% 0 0 0)` }, out: none }),
  iris: (p) => ({ in: { clipPath: `circle(${75 * ease.out(p)}% at 50% 50%)` }, out: none }),
  blur: (p) => ({ in: { opacity: ease.out(p), filter: `blur(${24 * (1 - ease.out(p))}px)` }, out: { filter: `blur(${24 * ease.in(p)}px)` } }),
  flip: (p) => ({ in: { opacity: ease.out(p), transform: `perspective(1200px) rotateY(${-90 * (1 - ease.out(p))}deg)` }, out: { opacity: 1 - ease.in(p), transform: `perspective(1200px) rotateY(${90 * ease.in(p)}deg)` } }),
};

/** The style of a clip at progress `p` through a named transition; a cut, or an unknown name, changes nothing. */
export function transitionStyle(name: string, p: number): TransitionFrame {
  const draw = REMOTION_TRANSITIONS[name] ?? REMOTION_TRANSITIONS.cut!;
  return draw(Math.max(0, Math.min(1, p)));
}

/** Both halves of the engine register the same names. */
export function registerRemotionTransitions(): void {
  for (const name of REQUIRED_TRANSITIONS) if (!(name in REMOTION_TRANSITIONS)) throw new Error(`Remotion catalogue is missing the required transition "${name}"`);
  for (const [name, draw] of Object.entries(REMOTION_TRANSITIONS)) registerTransition(name, REMOTION_ENGINE_ID, draw);
}
