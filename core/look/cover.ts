import type { BlockDef, CoverDef, SceneSpec, StageDef } from '@/core/types/payloads';

/**
 * The stage a cover is drawn on (CORE_CONTRACTS §2.13): a ground, the fonts, and the slot.
 *
 * Deliberately bare. The real stage's code is measured in pixels for the video's frame; poured into
 * a portrait cover it would put its furniture in the wrong places. What carries over is the part
 * that is not about shape — the palette, the fonts, the tones — so the cover and the film look like
 * one piece of work without the cover inheriting a layout meant for another.
 *
 * The node body previews a cover through this, and the export renders through it, so what is on
 * screen while you design is what comes out.
 */
export const COVER_STAGE_SOURCE = [
  '<style>',
  '  .cover { position: absolute; inset: 0; background: var(--bg); color: var(--fg); font-family: var(--font-body); overflow: hidden; }',
  '</style>',
  '<div class="cover"><div data-slot="content"></div></div>',
].join('\n');

export function coverStage(stage: StageDef, cover: CoverDef): StageDef {
  return {
    ...stage,
    name: `${stage.name} cover`,
    frame: cover.frame,
    transition: { type: 'cut', seconds: 0.1 },
    sceneFields: [],
    vars: {},
    code: { format: 'html-gsap', source: COVER_STAGE_SOURCE },
  };
}

/**
 * A cover is block-shaped for anything that draws one: same props, same code.
 *
 * The `doc.example` is not documentation here — it is what the preview draws. What the cover was
 * designed with wins; a prop with nothing chosen yet stands in for itself, by its hint where there
 * is one, so the words on screen are about the length the real ones will be. An empty object would
 * parse and leave the preview blank, and designing a cover against a black rectangle is designing
 * blind — which is exactly what a cover with no ground of its own renders as.
 */
export const coverAsBlock = (cover: CoverDef) => ({
  id: cover.id,
  name: cover.name,
  doc: { example: JSON.stringify({ ...placeholders(cover), ...(cover.defaults ?? {}) }), when: 'a cover' },
  props: cover.props,
  code: cover.code,
});

function placeholders(cover: CoverDef): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(cover.props)) {
    // No stand-in for a picture: the element simply has no source, and the ground shows through.
    if (field.type === 'image' || field.type === 'video') continue;
    if (field.type === 'number') { out[name] = 12345; continue; }
    if (field.type === 'boolean') { out[name] = true; continue; }
    if (field.type === 'string[]') { out[name] = ['One', 'Two', 'Three']; continue; }
    out[name] = field.hint ?? name;
  }
  return out;
}

/**
 * Where a cover's ground comes from when nobody has chosen one (CORE_CONTRACTS §2.13).
 *
 * Order: what the cover was designed with, then the film's own opening shot, then nothing. The
 * middle step is what makes a cover worth having on a template: the footage differs every run, so a
 * ground pinned once would give every video the same cover, and asking a person to pick a picture
 * after each run is the manual step the whole node exists to remove.
 *
 * A clip cannot be drawn into a still, so it comes back as a clip to take a frame from — the caller
 * does that, because it needs ffmpeg. Pure here so the choice can be read without a renderer.
 */
export function coverGround(
  cover: CoverDef,
  filled: Record<string, unknown>,
  scenes: { props: Record<string, unknown> }[],
  blocks: BlockDef[],
): { prop: string; image: string } | { prop: string; clip: string } | null {
  const prop = Object.entries(cover.props).find(([name, f]) => f.type === 'image' && !filled[name])?.[0];
  if (!prop) return null;
  // The film's assets are in the scenes' props, under whatever the block called them: read the type
  // off the block rather than guessing at names, so a block calling its picture `shot` still counts.
  for (const scene of scenes) {
    const block = blocks.find((b) => b.id === (scene as SceneSpec).blockId);
    for (const [name, field] of Object.entries(block?.props ?? {})) {
      const v = scene.props[name];
      if (typeof v !== 'string' || !v) continue;
      if (field.type === 'image') return { prop, image: v };
      if (field.type === 'video') return { prop, clip: v };
    }
  }
  return null;
}
