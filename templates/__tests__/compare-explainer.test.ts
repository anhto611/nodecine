import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import compare from '../compare-explainer.json';
import { castScenes } from '@/nodes/art-director/cast';
import { AssetUrlSchema, type LookDef, type SceneScript } from '@/core/types/payloads';

/**
 * The comparison template ships its drawings — two pictures in the script, the character in the
 * stage — as SVG inside the JSON. The sources sit beside it under `templates/assets`, and these
 * tests hold the two together: edit a drawing and forget to embed it, and this goes red.
 */
const ASSETS = path.resolve(__dirname, '../assets/compare-explainer');
const inline = (name: string) => 'data:image/svg+xml;base64,' + readFileSync(path.join(ASSETS, name)).toString('base64');
const nodes = compare.graph.nodes as { id: string; type: string; params: Record<string, unknown> }[];
const script = nodes.find((n) => n.type === 'core/static-script')!.params as { scenes: SceneScript['scenes'] };
const look = nodes.find((n) => n.type === 'core/art-director')!.params as unknown as LookDef & { casting: [] };

describe('the comparison template', () => {
  it('carries the two pictures in every comparison scene, byte for byte the files under templates/assets', () => {
    const compared = script.scenes.filter((s) => s.content.entries);
    expect(compared.length).toBeGreaterThan(0);
    for (const s of compared) {
      expect(s.content.entries!.map((e) => e.image)).toEqual([inline('website.svg'), inline('web-app.svg')]);
      for (const e of s.content.entries!) expect(AssetUrlSchema.safeParse(e.image).success).toBe(true);
    }
  });

  it('draws the character in the stage, from the file, with both arms', () => {
    const drawing = readFileSync(path.join(ASSETS, 'character.svg'), 'utf8').trim();
    expect(look.code.source).toContain(drawing);
    expect(drawing).toContain('class="arm-point"');
    expect(drawing).toContain('class="arm-think"');
    expect(drawing).not.toContain('<style'); // its colours are attributes, so the stage's own CSS is the only CSS
  });

  it('casts the pictures into the cards without a model', () => {
    const { plan } = castScenes({ language: 'vi', scenes: script.scenes }, look, []);
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['hero-question', 'compare-cards', 'compare-cards', 'compare-cards', 'hero-question']);
    const cards = plan.scenes[1]!.props.cards as { label: string; image?: string }[];
    expect(cards.map((c) => c.label)).toEqual(['Website', 'Web App']);
    expect(cards[0]!.image).toBe(inline('website.svg'));
    expect(cards[1]!.image).toBe(inline('web-app.svg'));
  });

  it('gives the right side its own colour and the blocks the classes the stage poses by', () => {
    expect(look.tokens.palette.accent2).toBeTruthy();
    const by = Object.fromEntries(look.blocks.map((b) => [b.id, b.code.source]));
    expect(by['hero-question']).toContain('class="wrap hero"');
    expect(by['compare-cards']).toContain('class="wrap compare"');
    expect(by['compare-cards']).toContain('nodecine.index % 2');
    expect(look.code.source).toContain('.stage:has(.nc-block .hero) .who-drawn .arm-think { display: block; }');
  });
});
