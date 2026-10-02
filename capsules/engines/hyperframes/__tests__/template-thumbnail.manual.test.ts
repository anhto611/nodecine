import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBlock, readBlockCatalog } from '@/contracts/storyboard/blocks';
import type { Composition } from '@/contracts/types/composition';
import { writeProject } from '../project.server';

/**
 * The gallery's card art, rendered from the template's own composition rather than drawn beside it.
 *
 * It goes through the same machinery a render does — the file server that injects the verified
 * runtime into `index.html`, and the capture session that seeks and screenshots — so a card is a real
 * frame of the scene it shows. The only difference from a film is the entry: a template's own
 * `index.html` is empty, because the film's entry is what the Assemble node writes, so the hook block
 * stands in as the entry and loads GSAP the way Assemble does.
 *
 * Manual, because it drives a browser: enabled with NODECINE_MANUAL_RENDER=1. Run it when a
 * template's scene designs change, and commit the PNG it writes beside the workflow.
 */
const enabled = process.env.NODECINE_MANUAL_RENDER === '1';

/** How far into the block's own length the still is taken: past the entrance, before anything leaves. */
const AT = 0.55;

const FPS = { num: 30, den: 1 };
const WIDTH = 1080;
const HEIGHT = 1920;
/** A gallery card is small: the still is drawn at half the composition's size, not full frame. */
const SCALE = 0.5;

describe.skipIf(!enabled)('a template thumbnail, from the template itself', () => {
  it('writes templates/<id>/thumbnail.png', async () => {
    const templatesDir = path.join(process.cwd(), 'templates');
    const folders = (await readdir(templatesDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .sort();
    expect(folders.length).toBeGreaterThan(0);

    const { createFileServer, createCaptureSession, initializeSession, captureFrameToBuffer, closeCaptureSession } = await import('@hyperframes/producer');
    const framesDir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-thumbnails-'));
    try {
      for (const folder of folders) {
        const workflow = JSON.parse(await readFile(path.join(templatesDir, folder, 'workflow.json'), 'utf8')) as {
          graph: { nodes: { params?: { files?: Record<string, string> } }[] };
        };
        const files = workflow.graph.nodes.find((node) => node.params?.files)?.params?.files;
        if (!files) throw new Error(`templates/${folder}/workflow.json: no node carries a files map`);

        // A card shows one scene, and a kit's blocks are scenes. Only a kit with no blocks at all — a
        // single-scene film that is its own entry — falls back to that entry; a shell page is not a
        // scene, and a still of it would show nothing.
        const blocks = readBlockCatalog(files);
        const block = blocks.find((candidate) => candidate.role === 'hook') ?? blocks[0];
        const entry = block ? files[`compositions/${block.name}.html`] : (files['index.html'] ?? '');
        if (!entry) throw new Error(`templates/${folder}: no scene to draw a card from`);
        const scene = block ?? readBlock('film', entry);

        const seconds = Number(scene.variables.find((variable) => variable.id === 'seconds')?.default ?? 4);
        // What the card shows: the sample the author wrote, and the default wherever there is none.
        const values = Object.fromEntries(scene.variables.map((variable) => [variable.id, (variable as unknown as { sample?: unknown }).sample ?? variable.default]));
        // A block keeps its scene in `<template>`, which the runtime instantiates only for a
        // sub-composition of a host page. Standalone, the scene is the page — so the template comes
        // off, and GSAP is loaded where the entry did not already load it itself.
        const unwrapped = entry.replace(/<template>([\s\S]*?)<\/template>/i, '$1');
        const page = unwrapped.includes('gsap.min.js') ? unwrapped : unwrapped.replace(/<head([^>]*)>/i, '<head$1><script src="gsap.min.js"></script>');
        // A card is the scene's own shape: a screen recording is landscape, everything else here is
        // portrait. The size is declared on the scene's root, so the card follows the template.
        const size = /data-width="(\d+)" data-height="(\d+)"/.exec(entry);
        const width = Number(size?.[1] ?? WIDTH);
        const height = Number(size?.[2] ?? HEIGHT);
        const composition: Composition = {
          engine: 'hyperframes',
          width,
          height,
          fps: 30,
          files: { 'index.html': page },
          media: {},
          // The declaration travels in the engine's own shape; NodeCine's two extra keys stay behind.
          variables: scene.variables.map((variable) => ({ id: variable.id, type: variable.type, label: variable.label, default: variable.default })),
          values,
        };

        const { dir } = await writeProject(composition);
        const server = await createFileServer({
          projectDir: dir,
          fps: FPS,
          // The engine hands a composition its values as `window.__hfVariables`: the same key a
          // render sets, so the card shows the sample copy rather than the declared defaults.
          preHeadScripts: [`window.__hfVariables = ${JSON.stringify(values).replace(/</g, '\\u003c')};`],
        });
        const session = await createCaptureSession(server.url, framesDir, { width, height, fps: FPS, format: 'png', deviceScaleFactor: SCALE });
        try {
          await initializeSession(session);
          const at = Math.max(0.2, seconds * AT);
          const { buffer } = await captureFrameToBuffer(session, Math.round(at * FPS.num), at);
          const output = path.join(templatesDir, folder, 'thumbnail.png');
          await writeFile(output, buffer);
          const bytes = (await stat(output)).size;
          console.log(`THUMBNAIL templates/${folder}/thumbnail.png · scene=${scene.name} · ${width}x${height} · at=${at.toFixed(2)}s · ${bytes} bytes · warnings=${session.warnings.length}`);
          expect(bytes).toBeGreaterThan(4_000);
        } finally {
          await closeCaptureSession(session);
          server.close();
        }
      }
    } finally {
      await rm(framesDir, { recursive: true, force: true });
    }
  }, 900_000);
});
