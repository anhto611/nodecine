import { createHash } from 'node:crypto';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { StillResult } from '@/contracts/adapters/types';
import type { Composition } from '@/contracts/types/composition';
import { assetPath, assetUrl, ensureAssetsDir } from '@/server/paths';
import { keepWebGlobals } from '@/server/web-globals';
import { writeProject } from './project.server';

/**
 * One frame of a composition as a JPEG, through the same machinery a render uses: the producer's file
 * server, which injects the verified runtime into `index.html`, and a capture session that seeks and
 * screenshots — as JPEG, because a PNG capture is made transparent and would drop the film's background. The values reach the page as `window.__hfVariables`, the key a render sets. The picture is
 * kept with the uploads, named by its bytes, so a model that looks at pictures can be shown it.
 */
export async function stillWithProducer(composition: Composition, seconds: number, signal: AbortSignal): Promise<StillResult> {
  const { createFileServer, createCaptureSession, initializeSession, captureFrameToBuffer, closeCaptureSession } = await import('@hyperframes/producer');
  if (signal.aborted) throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
  const fps = { num: composition.fps || 30, den: 1 };
  const { dir } = await writeProject(composition);
  const framesDir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-still-'));
  try {
    const buffer = await keepWebGlobals(async () => {
      const server = await createFileServer({
        projectDir: dir,
        fps,
        preHeadScripts: [`window.__hfVariables = ${JSON.stringify(composition.values ?? {}).replace(/</g, '\\u003c')};`],
      });
      const session = await createCaptureSession(server.url, framesDir, { width: composition.width, height: composition.height, fps, format: 'jpeg', quality: 92 });
      try {
        await initializeSession(session);
        const at = Math.max(0, seconds);
        return (await captureFrameToBuffer(session, Math.round(at * fps.num), at)).buffer;
      } finally {
        await closeCaptureSession(session).catch(() => undefined);
        server.close();
      }
    });
    const name = `${createHash('sha1').update(buffer).digest('hex')}.jpg`;
    const target = path.join(await ensureAssetsDir(), name);
    await writeFile(`${target}.part`, buffer);
    await rename(`${target}.part`, assetPath(name));
    return { url: assetUrl(name), width: composition.width, height: composition.height };
  } finally {
    await rm(framesDir, { recursive: true, force: true });
  }
}
