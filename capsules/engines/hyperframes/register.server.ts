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
import { hoistNestedCompositions } from './hoist.server';
import { withoutMixedAudio, writePreviewAudio } from './preview-audio.server';

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
  // `s` for a page whose sound is the file beside it: pages from before, which still play their own, are not reused.
  const name = `preview-s-${contentHash(values)}.html`;
  const target = projectFilePath(key, name);
  const exists = (file: string) => stat(file).then(() => true, () => false);
  // Its sound on the film's clock, beside it, for the player to play from the Studio's page (see preview-audio.server.ts).
  const audio = projectFilePath(key, name.replace(/\.html$/, '.m4a'));
  if (!(await exists(audio))) {
    await writePreviewAudio(composition.files[COMPOSITION_ENTRY] ?? '', values, dir, audio).catch(() => false);
  }
  if (!(await exists(target))) {
    // Nested sub-compositions lose their values in the bundle; flatten them first (see hoist.server.ts).
    const { html, hoisted } = hoistNestedCompositions(composition.files[COMPOSITION_ENTRY] ?? '', (src) => composition.files[src]);
    const entryFile = hoisted ? `preview-entry-${contentHash(html)}.html` : COMPOSITION_ENTRY;
    if (hoisted) await writeFile(projectFilePath(key, entryFile), html, 'utf8');
    const bundled = await bundleToSingleHtml(dir, { entryFile, runtime: 'inline' });
    // `<` escaped so a value holding `</script>` cannot close the tag it is written into.
    const assignment = `<script>window.__hfVariables = ${JSON.stringify(values).replace(/</g, '\\u003c')};</script>`;
    // With the sound in its own file, the page keeps no audio of its own: two copies played at once.
    const page = (await exists(audio)) ? withoutMixedAudio(bundled) : bundled;
    await writeFile(target, injectTagsAtHeadStart(page, assignment), 'utf8');
  }
  return { url: projectUrl(key, name) };
};

/**
 * The producer keeps every captured frame on disk before encoding, which a long film cannot afford:
 * an 85-second portrait film asked for over 100 GB. It says so before capturing, and its low-memory
 * mode streams frames straight into the encoder instead, slower but within any disk.
 */
const OUT_OF_FRAME_STORAGE = /temporary frame storage|low-memory-mode/i;

/** The composition rendered by `@hyperframes/producer`, with its values as the render's variables. */
export const renderWithProducer: ServerRender = async (composition, settings, onProgress, signal) => {
  const { createRenderJob, executeRenderJob, resolveConfig } = await import('@hyperframes/producer');
  const { dir } = await writeProject(composition);
  const tmp = await ensureTmpDir();
  const fileName = `${contentHash({ project: dir, values: valuesOf(composition), fps: composition.fps, quality: settings.quality })}.mp4`;
  const outputPath = path.join(tmp, fileName);
  const run = async (lowMemoryMode: boolean) => {
    const job = createRenderJob({
      fps: composition.fps, quality: QUALITY[settings.quality], format: 'mp4', entryFile: COMPOSITION_ENTRY, variables: valuesOf(composition),
      ...(lowMemoryMode ? { producerConfig: resolveConfig({ lowMemoryMode: true }) } : {}),
    });
    // The producer's file server would swap the global Request/Response out from under Next (see server/web-globals.ts).
    await keepWebGlobals(() => executeRenderJob(job, dir, outputPath, (j, message) => {
      const fraction = j.progress > 1 ? j.progress / 100 : j.progress;
      onProgress({ fraction: Math.max(0, Math.min(1, fraction)), message });
    }, signal));
  };
  try {
    await run(false);
  } catch (e) {
    if (signal.aborted || !OUT_OF_FRAME_STORAGE.test(e instanceof Error ? e.message : String(e))) throw e;
    onProgress({ fraction: 0, message: 'streaming frames to the encoder' });
    await run(true);
  }
  const s = await stat(outputPath);
  return { outputUrl: mediaUrl(fileName), bytes: s.size };
};

export function registerHyperframesServer(): void {
  registerEngine(HYPERFRAMES_ENGINE_ID, () => createHyperframesAdapter({ preview: previewWithBundler, render: renderWithProducer }));
}
