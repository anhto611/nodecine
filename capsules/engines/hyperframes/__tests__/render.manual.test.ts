import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { previewWithBundler, renderWithProducer } from '../register.server';
import type { Composition } from '@/contracts/types/composition';
import { mediaPath, fileNameFromMediaUrl, projectFilePath } from '@/server/paths';
import { measureDurationSeconds } from '@/server/contracts/audio';

/**
 * Manual, with the real bundler and producer: the starter composition, filled with a value, previewed
 * and rendered the way HyperFrames does it. Enabled with NODECINE_MANUAL_RENDER=1; it drives a browser.
 */
const enabled = process.env.NODECINE_MANUAL_RENDER === '1';

describe.skipIf(!enabled)('a HyperFrames composition, for real', () => {
  // A capsule imports no other capsule, so the project is written out here rather than borrowed from the Composition node.
  const INDEX = `<!doctype html>
<html data-composition-variables='[{"id":"title","type":"string","label":"Title","default":"Hello"}]'>
<head><style>body{margin:0;background:#0b0b0f}.title{position:absolute;left:96px;top:800px;font:700 120px sans-serif;color:#fff}</style></head>
<body>
<div id="stage" data-composition-id="spike" data-start="0" data-width="1080" data-height="1920">
  <div class="title" data-var-text="title">Hello</div>
</div>
<script src="gsap.min.js"></script>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.from('.title', { opacity: 0, y: 40, duration: 0.6 }).to({}, { duration: 4.4 });
  window.__timelines = window.__timelines || {};
  window.__timelines['spike'] = tl;
</script>
</body>
</html>`;
  const starter = async (): Promise<Composition> => ({
    engine: 'hyperframes', width: 1080, height: 1920, fps: 30, files: { 'index.html': INDEX }, media: {},
    variables: [{ id: 'title', type: 'string', label: 'Title', default: 'Hello' }], values: { title: 'Filled by NodeCine' },
  });

  it('bundles a preview page with the values set ahead of every script', async () => {
    const { url } = await previewWithBundler(await starter(), new AbortController().signal);
    const [, , , key, name] = url.split('/');
    const html = await readFile(projectFilePath(key!, name!), 'utf8');
    expect(html).toContain('window.__hfVariables = {"title":"Filled by NodeCine"}');
    expect(html.indexOf('__hfVariables')).toBeLessThan(html.indexOf('__timelines'));
  }, 120_000);

  it('renders it to an MP4 as long as its timeline', async () => {
    const fractions: number[] = [];
    const result = await renderWithProducer(await starter(), { quality: 'low', fileName: 'starter.mp4' }, (p) => fractions.push(p.fraction), new AbortController().signal);
    console.log(`RENDERED ${result.bytes} bytes · ${result.outputUrl} · ${fractions.length} progress reports`);
    expect(result.bytes).toBeGreaterThan(10_000);
    const seconds = await measureDurationSeconds(mediaPath(fileNameFromMediaUrl(result.outputUrl)), new AbortController().signal);
    expect(seconds).toBeGreaterThan(4.5);
    expect(seconds).toBeLessThan(5.5);
  }, 600_000);
});
