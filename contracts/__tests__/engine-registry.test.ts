import { describe, it, expect, beforeEach } from 'vitest';
import { _resetEngineRegistry, previewEngine, registerEngine, listEngineIds } from '../adapters/registry';
import type { EngineAdapter } from '../adapters/types';

/** Which engine draws a lone scene is a claim an engine makes, not a race between registrations. */

const adapter = (engineId: string, canDrawStills: boolean): EngineAdapter => ({
  engineId,
  displayName: engineId,
  adapterVersion: '1',
  probe: async () => ({ preview: { status: 'ready' }, render: { status: 'ready' } }),
  mountPlayer: () => { throw new Error('not used'); },
  ...(canDrawStills ? { previewScene: () => `<main>${engineId}</main>` } : {}),
  render: async () => { throw new Error('not used'); },
});

beforeEach(() => _resetEngineRegistry());

describe('previewEngine', () => {
  it('is nobody until an engine claims the job', () => {
    registerEngine('paints', () => adapter('paints', true));
    expect(listEngineIds()).toEqual(['paints']);
    // It can draw stills, but it did not say it was the one to ask.
    expect(previewEngine()).toBeUndefined();
  });

  it('is the engine that claimed it, whatever order the capsules loaded in', () => {
    registerEngine('first', () => adapter('first', true));
    registerEngine('second', () => adapter('second', true), { drawsStills: true });
    expect(previewEngine()?.engineId).toBe('second');

    _resetEngineRegistry();
    registerEngine('second', () => adapter('second', true), { drawsStills: true });
    registerEngine('first', () => adapter('first', true));
    expect(previewEngine()?.engineId).toBe('second');
  });

  it('stays undefined when the claiming half cannot actually draw one', () => {
    // The server half of an engine renders films and has no `previewScene`; claiming there would
    // hand the Studio an adapter that answers every still with nothing.
    registerEngine('render-only', () => adapter('render-only', false), { drawsStills: true });
    expect(previewEngine()).toBeUndefined();
  });
});
