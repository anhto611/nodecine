import { describe, expect, it } from 'vitest';
import { inspectComposition } from '../server';
import { STARTER_INDEX } from '../starter';

/** What the Composition node reads off a HyperFrames project, with HyperFrames' own parser and linter. */
describe('inspecting a composition', () => {
  it('reads the starter’s size and variables, and HyperFrames finds no error in it', async () => {
    const r = await inspectComposition({ 'index.html': STARTER_INDEX });
    expect(r).toMatchObject({ width: 1080, height: 1920 });
    expect(r.variables.map((v) => v.id)).toEqual(['title', 'accent']);
    expect(r.findings.filter((f) => f.severity === 'error')).toEqual([]);
  });
});
