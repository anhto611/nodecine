import { stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { registerEngine } from '@/contracts/adapters/registry';
import type { ExportSettings } from '@/contracts/adapters/types';
import type { Composition } from '@/contracts/types/composition';
import { COMPOSITION_ENTRY } from '@/contracts/types/composition';
import { contentHash } from '@/core/hash';
import { ensureTmpDir, mediaUrl, projectFilePath, projectUrl } from '@/server/paths';
import { keepWebGlobals } from '@/server/web-globals';
import { createHyperframesAdapter, type ServerPreview, type ServerRender } from './adapter';
import { HYPERFRAMES_ENGINE_ID } from './constants';
import { writeProject } from './project.server';

const QUALITY: Record<ExportSettings['quality'], 'high' | 'standard' | 'draft'> = { high: 'high', medium: 'standard', low: 'draft' };

/** The values a render or a preview uses: what the composition was given, over nothing else. */
const valuesOf = (composition: Composition): Record<string, unknown> => composition.values ?? {};

/**
 * A preview page for `<hyperframes-player>`: the project bundled into one HTML file with the runtime
 * inlined, and the values set as `window.__hfVariables` ahead of every script — exactly where the
 * producer puts them for a render, so the preview and the MP4 read the same values the same way.
 * Written into the project directory, so the files the page names still resolve beside it.
 */
export const previewWithBundler: ServerPreview = async (composition) => {
  const { bundleToSingleHtml, injectTagsAtHeadStart } = await import('@hyperframes/core/compiler');
  const { key, dir } = await writeProject(composition);
  const values = valuesOf(composition);
  const name = `preview-${contentHash(values)}.html`;
  const target = projectFilePath(key, name);
  if (!(await stat(target).then(() => true, () => false))) {
    const bundled = await bundleToSingleHtml(dir, { entryFile: COMPOSITION_ENTRY, runtime: 'inline' });
    // `<` escaped so a value holding `</script>` cannot close the tag it is written into.
    const assignment = `<script>window.__hfVariables = ${JSON.stringify(values).replace(/</g, '\\u003c')};</script>`;
    await writeFile(target, injectTagsAtHeadStart(bundled, assignment), 'utf8');
  }
  return { url: projectUrl(key, name) };
};

/** The composition rendered by `@hyperframes/producer`, with its values as the render's variables. */
export const renderWithProducer: ServerRender = async (composition, settings, onProgress, signal) => {
  const { createRenderJob, executeRenderJob } = await import('@hyperframes/producer');
  const { dir } = await writeProject(composition);
  const tmp = await ensureTmpDir();
  const fileName = `${contentHash({ project: dir, values: valuesOf(composition), fps: composition.fps, quality: settings.quality })}.mp4`;
  const outputPath = path.join(tmp, fileName);
  const job = createRenderJob({ fps: composition.fps, quality: QUALITY[settings.quality], format: 'mp4', entryFile: COMPOSITION_ENTRY, variables: valuesOf(composition) });
  // The producer's file server would swap the global Request/Response out from under Next (see server/web-globals.ts).
  await keepWebGlobals(() => executeRenderJob(job, dir, outputPath, (j, message) => {
    const fraction = j.progress > 1 ? j.progress / 100 : j.progress;
    onProgress({ fraction: Math.max(0, Math.min(1, fraction)), message });
  }, signal));
  const s = await stat(outputPath);
  return { outputUrl: mediaUrl(fileName), bytes: s.size };
};

export function registerHyperframesServer(): void {
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter({ preview: previewWithBundler, render: renderWithProducer }));
}
