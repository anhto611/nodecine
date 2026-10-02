import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { contentHash } from '@/core/hash';
import type { Composition } from '@/contracts/types/composition';
import { assetPath, fileNameFromAssetUrl, fileNameFromMediaUrl, mediaPath, projectDir, projectFilePath } from '@/server/paths';

/**
 * A composition written out as the directory HyperFrames works on: its text files as they are, its
 * media copied in from the files this machine already holds, and GSAP beside them so a render never
 * depends on a CDN answering. Keyed by the project's own content, so writing the same one twice is
 * one directory; the values are not part of it, because HyperFrames takes those at render time.
 */
export async function writeProject(composition: Composition): Promise<{ key: string; dir: string }> {
  const key = contentHash({ engine: composition.engine, files: composition.files, media: composition.media });
  const dir = projectDir(key);
  const done = path.join(dir, '.written');
  if (
    await stat(done).then(
      () => true,
      () => false,
    )
  )
    return { key, dir };

  await mkdir(dir, { recursive: true });
  for (const [relative, text] of Object.entries(composition.files)) {
    const target = projectFilePath(key, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text, 'utf8');
  }
  for (const [relative, url] of Object.entries(composition.media)) {
    const target = projectFilePath(key, relative);
    await mkdir(path.dirname(target), { recursive: true });
    const source = url.startsWith('/api/media/') ? mediaPath(fileNameFromMediaUrl(url)) : assetPath(fileNameFromAssetUrl(url));
    await copyFile(source, target);
  }
  if (!composition.files['gsap.min.js'] && !composition.media['gsap.min.js']) {
    await copyFile(path.resolve(process.cwd(), 'node_modules/gsap/dist/gsap.min.js'), projectFilePath(key, 'gsap.min.js'));
  }
  await writeFile(done, '', 'utf8');
  return { key, dir };
}
