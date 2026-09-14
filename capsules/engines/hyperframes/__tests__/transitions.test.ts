import { describe, expect, it } from 'vitest';
import { REQUIRED_TRANSITIONS } from '@/contracts/types/ir';
import { TRANSITION_CATALOG, transitionCatalogScript } from '../transitions';

describe('the HyperFrames transition catalogue', () => {
  it('has every required name and only touches what the runtime lets a clip own', () => {
    for (const name of REQUIRED_TRANSITIONS) expect(TRANSITION_CATALOG).toHaveProperty(name);
    for (const body of Object.values(TRANSITION_CATALOG)) {
      expect(body).not.toMatch(/visibility|display|autoAlpha/);
    }
  });

  it('serialises to one object literal of functions that parses', () => {
    const script = transitionCatalogScript();
    const catalog = new Function(`return ${script}`)() as Record<string, (...a: unknown[]) => void>;
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(TRANSITION_CATALOG).sort());
    expect(typeof catalog.fade).toBe('function');
  });
});
