import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
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
let bundleKey = '';

/**
 * Fingerprint of everything the Remotion bundle is built from. In development the process outlives
 * many edits, and a cached bundle silently renders the code from when the server started: the trap
 * costs an hour before anyone suspects the cache. In production the sources cannot change, so the
 * fingerprint is computed once and the bundle is built once.
 */
async function sourceKey(): Promise<string> {
  if (process.env.NODE_ENV === 'production') return 'production';
  const roots = ['nodes/remotion-engine'];
  const stamps: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__' && e.name !== 'node_modules') await walk(full);
      } else if (/\.(tsx?|css|woff2?)$/.test(e.name)) {
        const st = await stat(full).catch(() => null);
        if (st) stamps.push(`${full}:${st.mtimeMs}:${st.size}`);
      }
    }
  };
  for (const r of roots) await walk(path.resolve(process.cwd(), r));
  return contentHash(stamps.sort());
}

async function getBundle(): Promise<string> {
  const key = await sourceKey();
  if (key !== bundleKey) {
    bundlePromise = null;
    bundleKey = key;
  }
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const { bundle } = await import('@remotion/bundler');
      const outDir = path.join(await ensureTmpDir(), 'remotion-bundle');
      // The Remotion bundle is a separate webpack graph: teach it the `@/` alias from tsconfig.
      return bundle({
        entryPoint: path.resolve(process.cwd(), 'nodes/remotion-engine/entry.ts'),
        outDir,
        webpackOverride: (config) => ({
          ...config,
          resolve: { ...config.resolve, alias: { ...(config.resolve?.alias as Record<string, string> | undefined), '@': path.resolve(process.cwd()) } },
        }),
      });
    })().catch((e) => { bundlePromise = null; bundleKey = ''; throw e; });
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
