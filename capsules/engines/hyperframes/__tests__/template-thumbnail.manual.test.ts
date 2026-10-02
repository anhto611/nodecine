import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBlockCatalog } from '@/contracts/storyboard/blocks';
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

        const blocks = readBlockCatalog(files);
        const block = blocks.find((candidate) => candidate.role === 'hook') ?? blocks[0];
        if (!block) throw new Error(`templates/${folder}: the composition has no blocks`);
        const entry = files[`compositions/${block.name}.html`];
        if (!entry) throw new Error(`templates/${folder}: no file for block "${block.name}"`);

        const seconds = Number(block.variables.find((variable) => variable.id === 'seconds')?.default ?? 4);
        // What the card shows: the sample the author wrote, and the default wherever there is none.
        const values = Object.fromEntries(block.variables.map((variable) => [variable.id, (variable as unknown as { sample?: unknown }).sample ?? variable.default]));
        // A block keeps its scene in `<template>`, which the runtime instantiates only for a
        // sub-composition of a host page. Standalone, the scene is the page — so the template comes
        // off, GSAP is loaded the way Assemble loads it, and the values arrive before any script.
        const page = entry
          .replace(/<template>([\s\S]*?)<\/template>/i, '$1')
          .replace(/<head([^>]*)>/i, '<head$1><script src="gsap.min.js"></script>');
        const composition: Composition = {
          engine: 'hyperframes',
          width: WIDTH,
          height: HEIGHT,
          fps: 30,
          files: { 'index.html': page },
          media: {},
          // The declaration travels in the engine's own shape; NodeCine's two extra keys stay behind.
          variables: block.variables.map((variable) => ({ id: variable.id, type: variable.type, label: variable.label, default: variable.default })),
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
        const session = await createCaptureSession(server.url, framesDir, { width: WIDTH, height: HEIGHT, fps: FPS, format: 'png', deviceScaleFactor: SCALE });
        try {
          await initializeSession(session);
          const at = Math.max(0.2, seconds * AT);
          const { buffer } = await captureFrameToBuffer(session, Math.round(at * FPS.num), at);
          const output = path.join(templatesDir, folder, 'thumbnail.png');
          await writeFile(output, buffer);
          const bytes = (await stat(output)).size;
          console.log(`THUMBNAIL templates/${folder}/thumbnail.png · block=${block.name} · at=${at.toFixed(2)}s · ${bytes} bytes · warnings=${session.warnings.length}`);
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
