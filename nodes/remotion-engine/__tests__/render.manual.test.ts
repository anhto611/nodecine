import { describe, expect, it } from 'vitest';
import { migrateIR } from '@/contracts/types/migrate-ir';
import lumenV2 from '@/contracts/__tests__/fixtures/ir-v2-lumen.json';

/**
 * Manual: a real Remotion bundle, and a real render of the Lumen film through it. Enable with
 * NODECINE_MANUAL_REMOTION=1 (bundle only) or =render (bundle and render three seconds). The bundle
 * is the webpack graph @remotion/bundler builds from entry.ts; this is what proves gsap and the
 * core's scene machinery compile into it. A render needs the app running on :3000 for its media.
 */
const mode = process.env.NODECINE_MANUAL_REMOTION;

describe.skipIf(!mode)('Remotion, for real', () => {
  it('bundles the composition with the shared scene runtime in it', async () => {
    const { bundle } = await import('@remotion/bundler');
    const path = await import('node:path');
    const { readFile, readdir } = await import('node:fs/promises');
    const outDir = path.join(process.cwd(), '.nodecine', 'tmp', 'remotion-bundle-test');
    const serveUrl = await bundle({
      entryPoint: path.resolve(process.cwd(), 'nodes/remotion-engine/entry.ts'),
      outDir,
      webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...(config.resolve?.alias as Record<string, string> | undefined), '@': path.resolve(process.cwd()) } } }),
    });
    const files = await readdir(serveUrl);
    const js = (await Promise.all(files.filter((f) => f.endsWith('.js')).map((f) => readFile(path.join(serveUrl, f), 'utf8')))).join('\n');
    expect(js).toContain('function mountScene(');
    expect(js).toContain('nc-cap-line');
    if (mode === 'render') {
      const { renderMedia, selectComposition } = await import('@remotion/renderer');
      const ir = migrateIR(lumenV2);
      ir.meta.totalDurationInFrames = 90;
      ir.beats = [{ ...ir.beats[0]!, durationInFrames: 90 }];
      ir.tracks[0]!.clips = [{ ...ir.tracks[0]!.clips[0]!, durationInFrames: 90 }];
      ir.audio = ir.audio.map((a) => ({ ...a, durationInFrames: 90 }));
      ir.captions = { cues: ir.captions!.cues.filter((c) => c.startFrame + c.durationInFrames <= 90) };
      const inputProps = { ir, mediaBaseUrl: 'http://127.0.0.1:3000' };
      const composition = await selectComposition({ serveUrl, id: 'nodecine', inputProps });
      const outputLocation = path.join(outDir, 'lumen-3s.mp4');
      await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation, inputProps });
      const { stat } = await import('node:fs/promises');
      expect((await stat(outputLocation)).size).toBeGreaterThan(10_000);
      console.log('rendered', outputLocation);

      // Footage under the scenes, repeated: the file is two seconds of the film's six, so the
      // composition has to start it over twice, and the scenes over it have to stay transparent.
      const clip = process.env.NODECINE_MANUAL_LOOP_CLIP;
      if (clip) {
        const looped = structuredClone(ir);
        looped.tracks = [{ id: 'under', clips: [{ id: 'bg', kind: 'media', startFrame: 0, durationInFrames: 90, url: clip, offsetSeconds: 0, fit: 'cover', loop: true, gain: 0, sourceSeconds: Number(process.env.NODECINE_MANUAL_LOOP_SECONDS ?? '2') }] }, ...looped.tracks];
        const props = { ir: looped, mediaBaseUrl: 'http://127.0.0.1:3000' };
        const comp = await selectComposition({ serveUrl, id: 'nodecine', inputProps: props });
        const out2 = path.join(outDir, 'looped.mp4');
        await renderMedia({ composition: comp, serveUrl, codec: 'h264', outputLocation: out2, inputProps: props });
        expect((await stat(out2)).size).toBeGreaterThan(10_000);
        console.log('rendered with looping footage', out2);
      }
    }
  }, 600_000);
});
