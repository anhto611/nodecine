import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBlockCatalog, readComponentCatalog } from '@/contracts/storyboard/blocks';
import type { Composition } from '@/contracts/types/composition';
import { writeProject } from '../project.server';

/**
 * Every template's text, held to one rule: a box that clips its text (overflow hidden) leaves room
 * under the last line for a descender (g, y, p, ạ) and over the first for a stacked Vietnamese accent
 * (ẫ, ổ, ặ). "Nguyên Mông" lost the foot of its g to a title set at line-height 1.16 with no padding;
 * this finds the next one before a person does. The room is reckoned from the box's line height and
 * padding, the way a browser lays the line out, on each block and component with its sample values.
 *
 * Manual, because it drives a browser: enabled with NODECINE_MANUAL_RENDER=1, one template with
 * NODECINE_CLIP_ONLY=<id>.
 */
describe.skipIf(process.env.NODECINE_MANUAL_RENDER !== '1')('the text of every template', () => {
  it('leaves room for descenders and stacked accents wherever it clips', async () => {
    const found: string[] = [];
    const puppeteer = (await import('puppeteer')).default;
    const { createFileServer } = await import('@hyperframes/producer');
    const browser = await puppeteer.launch({ headless: true });
    const dir = path.join(process.cwd(), 'templates');
    const only = process.env.NODECINE_CLIP_ONLY;
    for (const folder of (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory() && !/^[._]/.test(e.name)).map((e) => e.name)) {
      if (only && folder !== only) continue;
      const wf = JSON.parse(await readFile(path.join(dir, folder, 'workflow.json'), 'utf8'));
      const files = wf.graph.nodes.find((n: { params?: { files?: unknown } }) => n.params?.files).params.files as Record<string, string>;
      const parts = [...readBlockCatalog(files).map((b) => ({ ...b, file: `compositions/${b.name}.html`, comp: false })), ...readComponentCatalog(files).map((c) => ({ ...c, file: `compositions/components/${c.name}.html`, comp: true }))];
      for (const part of parts) {
        const html = files[part.file]!;
        const size = /data-width="(\d+)" data-height="(\d+)"/.exec(html);
        const w = Number(size?.[1] ?? 1280), h = Number(size?.[2] ?? 720);
        const values = Object.fromEntries(part.variables.map((v) => [v.id, (v as unknown as { sample?: unknown }).sample ?? v.default]));
        let page = html.replace(/<template>([\s\S]*?)<\/template>/i, '$1').replace(/<head([^>]*)>/i, '<head$1><script src="gsap.min.js"></script>');
        if (part.comp) page = page.replace(/<body([^>]*)>/i, `<body$1><style>#root{width:${w}px;height:${h}px;position:relative!important}</style>`);
        const composition: Composition = { engine: 'hyperframes', width: w, height: h, fps: 30, files: { 'index.html': page }, media: {}, variables: [], values };
        const { dir: proj } = await writeProject(composition);
        const server = await createFileServer({ projectDir: proj, fps: { num: 30, den: 1 }, preHeadScripts: [`window.__hfVariables = ${JSON.stringify(values).replace(/</g, '\u003c')};`] });
        const tab = await browser.newPage();
        await tab.setViewport({ width: w, height: h });
        await tab.goto(server.url, { waitUntil: 'networkidle0' }).catch(() => {});
        await tab.evaluate(() => (document as Document).fonts.ready);
        await new Promise((r) => setTimeout(r, 300));
        const hits = await tab.evaluate(() => {
          const out: string[] = [];
          const clipsY = (el: Element) => {
            const cs = getComputedStyle(el);
            return cs.overflowY === 'hidden' || cs.overflow === 'hidden' || cs.overflowY === 'clip';
          };
          for (const el of Array.from(document.querySelectorAll('body *')) as HTMLElement[]) {
            const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim());
            if (!own || !clipsY(el)) continue;
            const cs = getComputedStyle(el);
            const fs = parseFloat(cs.fontSize);
            const lh = cs.lineHeight === 'normal' ? 1.2 * fs : parseFloat(cs.lineHeight);
            const pb = parseFloat(cs.paddingBottom), pt = parseFloat(cs.paddingTop);
            const text = el.textContent!.trim();
            const descends = /[gjpqyạậặẹệịọộợụựỵ]/.test(text);
            const stacked = /[ẤẦẨẪẬẮẰẲẴẶẾỀỂỄỆỐỒỔỖỘỚỜỞỠỢấầẩẫắằẳẵếềểễốồổỗớờởỡ]/.test(text);
            // Half the leading sits below the last baseline; a descender needs ~0.22em, a stacked accent ~0.3em above.
            const below = (lh - fs) / 2 + pb, above = (lh - fs) / 2 + pt;
            const lowRoom = descends && below < 0.16 * fs;
            const highRoom = stacked && above < 0.12 * fs;
            if (fs >= 22 && (lowRoom || highRoom)) out.push(`${el.className || el.tagName} · ${Math.round(fs)}px lh ${(lh / fs).toFixed(2)} pad ${pt.toFixed(0)}/${pb.toFixed(0)} · ${lowRoom ? 'BOTTOM' : ''}${highRoom ? 'TOP' : ''} · "${text.slice(0, 40)}"`);
          }
          return out;
        });
        for (const hit of hits) found.push(`${folder}/${part.file.replace('compositions/', '')} :: ${hit}`);
        await tab.close();
        server.close();
      }
    }
    await browser.close();
    expect(found).toEqual([]);
  }, 1_800_000);
});
