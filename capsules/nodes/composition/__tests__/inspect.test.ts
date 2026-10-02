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

  it('lints a block under compositions/ as the project linter does, and names the file a finding is in', async () => {
    // A block with no size, which the linter refuses; a component beside it is elastic and carries none either, and that is fine.
    const block = '<template><div id="root" data-composition-id="broken"></div></template>';
    const component =
      '<template><div id="root" data-composition-id="elastic"><script>window.__timelines = window.__timelines || {}; window.__timelines["elastic"] = gsap.timeline({ paused: true });</script></div></template>';
    const r = await inspectComposition({ 'index.html': STARTER_INDEX, 'compositions/broken.html': block, 'compositions/components/elastic.html': component });
    expect(r.findings.some((f) => f.file === 'compositions/broken.html' && f.code === 'root_missing_dimensions')).toBe(true);
    expect(r.findings.some((f) => f.file?.startsWith('compositions/components/'))).toBe(false);
  });
});
