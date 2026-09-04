import path from 'node:path';
import { stat } from 'node:fs/promises';
import { registerEngine } from '@/core/adapters/registry';
import type { ExportSettings, RenderProgress, RenderResult } from '@/core/adapters/types';
import type { VideoIR } from '@/core/types/ir';
import { contentHash } from '@/core/hash';
import { ensureTmpDir, mediaUrl } from '@/server/paths';
import { createRemotionAdapter } from './adapter';
import { COMPOSITION_ID, REMOTION_ENGINE_ID } from './constants';

/**
 * Server registration: preview + real render through @remotion/bundler and @remotion/renderer.
 * Both packages are `serverExternalPackages` (ARCHITECTURE §8.2). The bundle is cached per process (§7).
 */

let bundlePromise: Promise<string> | null = null;

async function getBundle(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const { bundle } = await import('@remotion/bundler');
      const outDir = path.join(await ensureTmpDir(), 'remotion-bundle');
      // The Remotion bundle is a separate webpack graph: teach it the `@/` alias from tsconfig.
      return bundle({
        entryPoint: path.resolve(process.cwd(), 'engines/remotion/entry.ts'),
        outDir,
        webpackOverride: (config) => ({
          ...config,
          resolve: { ...config.resolve, alias: { ...(config.resolve?.alias as Record<string, string> | undefined), '@': path.resolve(process.cwd()) } },
        }),
      });
    })().catch((e) => { bundlePromise = null; throw e; });
  }
  return bundlePromise;
}

function mediaBaseUrl(): string {
  return process.env.NODECINE_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

const CRF: Record<ExportSettings['quality'], number> = { high: 18, medium: 23, low: 28 };

async function serverRender(ir: VideoIR, settings: ExportSettings, onProgress: (p: RenderProgress) => void, signal: AbortSignal): Promise<RenderResult> {
  const { renderMedia, selectComposition } = await import('@remotion/renderer');
  const serveUrl = await getBundle();
  const inputProps = { ir, mediaBaseUrl: mediaBaseUrl() };
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });
  const key = contentHash({ ir, settings });
  const fileName = `${key}.mp4`;
  const outputLocation = path.join(await ensureTmpDir(), fileName);
  const total = composition.durationInFrames;
  await renderMedia({
    composition,
    serveUrl,
    codec: settings.codec === 'h265' ? 'h265' : 'h264',
    crf: CRF[settings.quality],
    outputLocation,
    inputProps,
    cancelSignal: (cancel) => { signal.addEventListener('abort', () => cancel(), { once: true }); },
    onProgress: ({ renderedFrames }) => onProgress({ renderedFrames, totalFrames: total }),
  });
  const s = await stat(outputLocation);
  return { outputUrl: mediaUrl(fileName), bytes: s.size };
}

export function registerRemotionServer(): void {
  registerEngine(REMOTION_ENGINE_ID, (settings) => createRemotionAdapter(settings, { render: serverRender }));
}
