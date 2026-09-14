import { describe, it, expect, beforeEach } from 'vitest';
import { _resetEngineRegistry, getEngineFactory, registerEngine, listEngineIds } from '../adapters/registry';

/** The engine registry holds whatever each side of an engine registered, by id, and nothing else. */

beforeEach(() => _resetEngineRegistry());

describe('the engine registry', () => {
  it('starts empty and hands back what was registered under its id', () => {
    expect(listEngineIds()).toEqual([]);
    const factory = () => ({}) as never;
    registerEngine('paints', factory);
    expect(listEngineIds()).toEqual(['paints']);
    expect(getEngineFactory('paints')).toBe(factory);
    expect(getEngineFactory('nobody')).toBeUndefined();
  });
});
