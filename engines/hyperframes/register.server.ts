import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { registerEngine } from '@/core/adapters/registry';
import { registerCodeRenderer } from '@/core/look/renderers';
import type { CaptureResult, CaptureSettings, ExportSettings, RenderProgress, RenderResult } from '@/core/adapters/types';
import type { VideoIR } from '@/core/types/ir';
import { contentHash } from '@/core/hash';
import { ensureTmpDir, fileNameFromMediaUrl, mediaPath, mediaUrl } from '@/server/paths';
import { createHyperframesAdapter } from './adapter';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { buildHyperframesDocument } from './document';
import { vendorSource } from './vendor.server';
import { renderScaleFor } from '@/core/look/frame';
import { assetNamesIn, assetPath } from '@/server/paths';

/**
 * Server registration: real render through @hyperframes/producer. The composition is written as a
 * small project directory under the temp dir — index.html, the voice-over next to it, the fonts —
 * because the producer serves a directory to its headless Chrome. Output lands in the temp dir under
 * a content hash like every other media file (ARCHITECTURE §6).
 */

const QUALITY: Record<ExportSettings['quality'], 'high' | 'standard' | 'draft'> = { high: 'high', medium: 'standard', low: 'draft' };
const FONTS = ['JetBrainsMono-Regular.woff2', 'JetBrainsMono-Bold.woff2', 'JetBrainsMono-ExtraBold.woff2'];

/**
 * The project directory a headless Chrome is pointed at: index.html, the voice-over beside it, the
 * fonts and any images the look refers to. The MP4 render and the poster capture both start here —
 * a poster that came from a differently built page would not be a still of the video.
 */
async function buildProjectDir(ir: VideoIR, settings: Pick<ExportSettings, 'resolution'>, key: string): Promise<{ projectDir: string; scale: number }> {
  const tmp = await ensureTmpDir();
  const projectDir = path.join(tmp, `hf-${key}`);
  await mkdir(path.join(projectDir, 'fonts'), { recursive: true });

  await copyFile(mediaPath(fileNameFromMediaUrl(ir.audioTrack.voiceoverUrl)), path.join(projectDir, 'voiceover.mp3'));
  for (const f of FONTS) await copyFile(path.resolve(process.cwd(), 'public/fonts', f), path.join(projectDir, 'fonts', f));
  // Images the stage or blocks refer to come along, by their hashed names.
  // Scene props carry images too, not only the code: an asset named in a prop and left behind is a hole in the MP4.
  const assets = assetNamesIn(JSON.stringify([ir.stage.code.source, ...ir.blocks.map((b) => b.code.source), ir.timeline]));
  if (assets.length) await mkdir(path.join(projectDir, 'assets'), { recursive: true });
  for (const a of assets) await copyFile(assetPath(a), path.join(projectDir, 'assets', a)).catch(() => undefined);

  const [gsapSource, runtimeSource] = await Promise.all([vendorSource('gsap.js'), vendorSource('hyperframes-runtime.js')]);
  const scale = renderScaleFor({ width: ir.meta.width, height: ir.meta.height }, settings.resolution ?? '1080p');
  const html = buildHyperframesDocument(ir, { gsapSource, runtimeSource, voiceoverSrc: 'voiceover.mp3', fontBase: 'fonts', scale, assetBase: 'assets' });
  await writeFile(path.join(projectDir, 'index.html'), html, 'utf8');
  return { projectDir, scale };
}

export async function renderWithProducer(ir: VideoIR, settings: ExportSettings, onProgress: (p: RenderProgress) => void, signal: AbortSignal): Promise<RenderResult> {
  const { createRenderJob, executeRenderJob } = await import('@hyperframes/producer');
  const tmp = await ensureTmpDir();
  const key = contentHash({ ir, settings, engine: HYPERFRAMES_ENGINE_ID });
  const { projectDir } = await buildProjectDir(ir, settings, key);

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

/**
 * One frame of the same composition, as a PNG (CORE_CONTRACTS §5.18). The producer's own capture
 * session does the work — it serves the project directory, seeks the page's timeline to the second
 * asked for and screenshots deterministically, which is exactly what the MP4 path does frame by
 * frame. Rolling our own puppeteer here would be a second, subtly different renderer.
 */
export async function capturePosterWithProducer(ir: VideoIR, opts: CaptureSettings, signal: AbortSignal): Promise<CaptureResult> {
  const { createFileServer, createCaptureSession, initializeSession, captureFrameToBuffer, closeCaptureSession } = await import('@hyperframes/producer');
  const key = contentHash({ ir, opts, engine: HYPERFRAMES_ENGINE_ID, kind: 'poster' });
  const fileName = `${key}.png`;
  const outputPath = mediaPath(fileName);
  if (await stat(outputPath).then(() => true, () => false)) {
    return { outputUrl: mediaUrl(fileName), bytes: (await stat(outputPath)).size };
  }

  const { projectDir, scale } = await buildProjectDir(ir, opts, key);
  // The second the user asked for, clamped inside the film and quantised to a real frame.
  const frame = Math.min(Math.max(0, Math.round(opts.atSeconds * ir.meta.fps)), Math.max(0, ir.meta.totalDurationInFrames - 1));
  const server = await createFileServer({ projectDir, fps: { num: ir.meta.fps, den: 1 } });
  let session: Awaited<ReturnType<typeof createCaptureSession>> | null = null;
  try {
    session = await createCaptureSession(server.url, projectDir, {
      width: Math.round(ir.meta.width * scale),
      height: Math.round(ir.meta.height * scale),
      fps: { num: ir.meta.fps, den: 1 },
      format: 'png',
    });
    await initializeSession(session);
    if (signal.aborted) throw Object.assign(new Error('cancelled'), { code: 'RUN_CANCELLED' });
    const shot = await captureFrameToBuffer(session, frame, frame / ir.meta.fps);
    await writeFile(outputPath, shot.buffer);
    return { outputUrl: mediaUrl(fileName), bytes: shot.buffer.byteLength };
  } finally {
    if (session) await closeCaptureSession(session).catch(() => undefined);
    server.close();
  }
}

export function registerHyperframesServer(): void {
  registerCodeRenderer('html-gsap', HYPERFRAMES_ENGINE_ID, 'hyperframes-producer');
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter({ render: renderWithProducer, capture: capturePosterWithProducer }));
}
