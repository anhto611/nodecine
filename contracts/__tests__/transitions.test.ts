import { beforeEach, describe, expect, it } from 'vitest';
import { _resetTransitions, listTransitions, missingTransitions, registerTransition, transitionNamesOf, unsupportedFilmBlock } from '../visual/transitions';
import { _resetCodeRenderers, registerCodeRenderer } from '../visual/renderers';
import { migrateIR } from '../types/migrate-ir';
import lumenV2 from './fixtures/ir-v2-lumen.json';

const engine = { engineId: 'hyperframes', displayName: 'HyperFrames', capabilities: {} } as unknown as Parameters<typeof unsupportedFilmBlock>[0];

beforeEach(() => { _resetTransitions(); _resetCodeRenderers(); });

describe('the transition registry', () => {
  it('is empty in the core and lists what engines put in it, the required four first', () => {
    expect(listTransitions()).toEqual([]);
    registerTransition('wipe-left', 'hyperframes', 'x');
    registerTransition('fade', 'hyperframes', 'x');
    registerTransition('fade', 'other-engine', 'x');
    registerTransition('cut', 'other-engine', 'x');
    expect(listTransitions()).toEqual(['cut', 'fade', 'wipe-left']);
    expect(listTransitions('other-engine')).toEqual(['cut', 'fade']);
    expect(missingTransitions(['fade', 'wipe-left', 'iris'], 'other-engine')).toEqual(['wipe-left', 'iris']);
  });

  it('reads the names a film asks for off the film: the default and each override, once', () => {
    const ir = migrateIR(lumenV2);
    expect(transitionNamesOf(ir)).toEqual(['fade']);
    ir.transitions.at = [{ afterClipId: ir.beats[0]!.clipId, name: 'wipe-left', seconds: 0.5 }, { afterClipId: ir.beats[1]!.clipId, name: 'fade', seconds: 0.3 }];
    expect(transitionNamesOf(ir)).toEqual(['fade', 'wipe-left']);
  });

  it('blocks an output node on a missing renderer first, then on a missing transition, naming what the engine does have', () => {
    const ir = migrateIR(lumenV2);
    expect(unsupportedFilmBlock(engine, undefined)).toBeNull();
    expect(unsupportedFilmBlock(undefined, ir)).toBeNull();
    expect(unsupportedFilmBlock(engine, ir)).toMatchObject({ code: 'ENGINE_SCENE_UNSUPPORTED' });
    registerCodeRenderer('html-gsap', 'hyperframes', () => null);
    expect(unsupportedFilmBlock(engine, ir)).toMatchObject({ code: 'ENGINE_TRANSITION_UNSUPPORTED', message: expect.stringContaining('fade') });
    registerTransition('fade', 'hyperframes', 'x');
    registerTransition('cut', 'hyperframes', 'x');
    expect(unsupportedFilmBlock(engine, ir)).toBeNull();
    ir.transitions.at = [{ afterClipId: ir.beats[0]!.clipId, name: 'iris', seconds: 0.5 }];
    expect(unsupportedFilmBlock(engine, ir)).toMatchObject({ code: 'ENGINE_TRANSITION_UNSUPPORTED', message: expect.stringContaining('iris'), fix: 'pick one of: cut, fade' });
  });

  it('reads the formats off the clips, not off a constant', () => {
    const ir = migrateIR(lumenV2);
    registerCodeRenderer('html-gsap', 'hyperframes', () => null);
    registerTransition('fade', 'hyperframes', 'x');
    (ir.tracks[0]!.clips[1] as { format: string }).format = 'lottie';
    expect(unsupportedFilmBlock(engine, ir)).toMatchObject({ code: 'ENGINE_SCENE_UNSUPPORTED', message: expect.stringContaining('lottie') });
  });
});
