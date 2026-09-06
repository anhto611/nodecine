/**
 * Where the platform's own UI covers a vertical video (CORE_CONTRACTS §2.6): the button column on
 * the right, the caption block at the bottom, the top bar, a small left margin. One definition for
 * the three places that care — the rule the model is given, the lint on its answer, and the guide
 * overlay in the preview — so they can never disagree.
 */
export interface SafeZones {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const PORTRAIT_SAFE_ZONES: SafeZones = { left: 72, right: 168, top: 260, bottom: 680 };
export const LANDSCAPE_SAFE_ZONES: SafeZones = { left: 96, right: 96, top: 96, bottom: 96 };

export const safeZonesFor = (width: number, height: number): SafeZones => (height > width ? PORTRAIT_SAFE_ZONES : LANDSCAPE_SAFE_ZONES);

/** `left 72px, right 168px, top 260px, bottom 680px` — as the prompt and the cheat line say it. */
export const describeSafeZones = (z: SafeZones): string => `left ${z.left}px, right ${z.right}px, top ${z.top}px, bottom ${z.bottom}px`;
