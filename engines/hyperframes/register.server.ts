import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { registerEngine } from '@/core/adapters/registry';
import { registerCodeRenderer } from '@/core/look/renderers';
import type { ExportSettings, RenderProgress, RenderResult } from '@/core/adapters/types';
import type { VideoIR } from '@/core/types/ir';
import { contentHash } from '@/core/hash';
import { ensureTmpDir, fileNameFromMediaUrl, mediaPath, mediaUrl } from '@/server/paths';
import { createHyperframesAdapter } from './adapter';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { buildHyperframesDocument } from './document';
import { vendorSource } from './vendor.server';

/**
 * Server registration: real render through @hyperframes/producer. The composition is written as a
 * small project directory under the temp dir — index.html, the voice-over next to it, the fonts —
 * because the producer serves a directory to its headless Chrome. Output lands in the temp dir under
 * a content hash like every other media file (ARCHITECTURE §6).
 */

const QUALITY: Record<ExportSettings['quality'], 'high' | 'standard' | 'draft'> = { high: 'high', medium: 'standard', low: 'draft' };
const FONTS = ['JetBrainsMono-Regular.woff2', 'JetBrainsMono-Bold.woff2', 'JetBrainsMono-ExtraBold.woff2'];

export async function renderWithProducer(ir: VideoIR, settings: ExportSettings, onProgress: (p: RenderProgress) => void, signal: AbortSignal): Promise<RenderResult> {
  const { createRenderJob, executeRenderJob } = await import('@hyperframes/producer');
  const tmp = await ensureTmpDir();
  const key = contentHash({ ir, settings, engine: HYPERFRAMES_ENGINE_ID });
  const projectDir = path.join(tmp, `hf-${key}`);
  await mkdir(path.join(projectDir, 'fonts'), { recursive: true });

  await copyFile(mediaPath(fileNameFromMediaUrl(ir.audioTrack.voiceoverUrl)), path.join(projectDir, 'voiceover.mp3'));
  for (const f of FONTS) await copyFile(path.resolve(process.cwd(), 'public/fonts', f), path.join(projectDir, 'fonts', f));

  const [gsapSource, runtimeSource] = await Promise.all([vendorSource('gsap.js'), vendorSource('hyperframes-runtime.js')]);
  const html = buildHyperframesDocument(ir, { gsapSource, runtimeSource, voiceoverSrc: 'voiceover.mp3', fontBase: 'fonts' });
  await writeFile(path.join(projectDir, 'index.html'), html, 'utf8');

  const fileName = `${key}.mp4`;
  const outputPath = path.join(tmp, fileName);
  const total = ir.meta.totalDurationInFrames;
  const job = createRenderJob({ fps: ir.meta.fps, quality: QUALITY[settings.quality], format: 'mp4' });
  await executeRenderJob(job, projectDir, outputPath, (j) => {
    const fraction = j.progress > 1 ? j.progress / 100 : j.progress;
    onProgress({ renderedFrames: Math.min(total, Math.round(fraction * total)), totalFrames: total });
  }, signal);
  const s = await stat(outputPath);
  return { outputUrl: mediaUrl(fileName), bytes: s.size };
}

export function registerHyperframesServer(): void {
  registerCodeRenderer('html-gsap', HYPERFRAMES_ENGINE_ID, 'hyperframes-producer');
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter({ render: renderWithProducer }));
}
