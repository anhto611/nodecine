import { describe, expect, it } from 'vitest';
import { REQUIRED_TRANSITIONS } from '@/core/types/ir';
import { GSAP_TRANSITION_CATALOG } from '@/core/visual/gsap-transitions';
import { REMOTION_TRANSITIONS, transitionStyle } from '../transitions';

describe('the Remotion transition catalogue', () => {
  it('has every required name, and every name the gsap catalogue has, so a film moves between engines unchanged', () => {
    for (const name of REQUIRED_TRANSITIONS) expect(REMOTION_TRANSITIONS).toHaveProperty(name);
    expect(Object.keys(REMOTION_TRANSITIONS).sort()).toEqual(Object.keys(GSAP_TRANSITION_CATALOG).sort());
  });

  it('starts with the incoming clip hidden or off and ends with it in place', () => {
    for (const name of Object.keys(REMOTION_TRANSITIONS)) {
      if (name === 'cut') continue;
      const start = transitionStyle(name, 0).in;
      const end = transitionStyle(name, 1).in;
      expect(Object.keys(start).length, name).toBeGreaterThan(0);
      // At the end nothing is left that hides it: opacity 1 (or absent), no offset, a full clip path.
      if ('opacity' in end) expect(end.opacity).toBe(1);
      if (typeof end.transform === 'string') expect(end.transform).toMatch(/translate[XY]\(0%\)|scale\(1\)|rotateY\(0deg\)/);
      if (typeof end.clipPath === 'string') expect(end.clipPath).toMatch(/inset\(0% 0 0 0\)|inset\(0 0 0 0%\)|circle\(75%/);
    }
    expect(transitionStyle('cut', 0.5)).toEqual({ in: {}, out: {} });
    expect(transitionStyle('nobody-knows', 0.5)).toEqual({ in: {}, out: {} });
  });
});
