import { z } from 'zod';
import { LookDefBaseSchema, uniqueBlockIds, type LLMRef, type SceneScript, type StageDef } from '@/core/types/payloads';
import { ErrorCode } from '@/core/errors';
import { CastError, CastingSchema, castScenes, sceneCandidates } from './cast';
import { pickWithModel } from './cast-ai';
import { authorBlock } from './author';
import { DEFAULT_BLOCK } from './blocks';
import type { NodeDefinition } from '@/core/nodes/definition';

/**
 * The Art Director node (CORE_CONTRACTS §5.9): the visual stage of the pipeline. It comes after the script:
 * the screenwriter or the static script hands it scenes with content, and it casts a block, a tone and
 * the stage fields for each (cast.ts) and emits the plan. Its parameters are the whole look — the
 * stage (payload §2.6), the one persistent shell every scene plays on, the catalogue of blocks
 * (§2.7) that play on it — plus the casting table by role.
 *
 * The stage part: design tokens, the tones a scene may switch to, the per-scene fields it draws
 * (with the rule that teaches the model to write each), and the markup around the block's content
 * area; a block is dropped into the element marked `data-slot="content"`. One Art Director per workflow,
 * between the script and the Timeline Assembler.
 *
 * Stage and block share one code convention: an HTML fragment with an inline `<style>`, tokens exposed as
 * CSS custom properties by the renderer, an optional `<script>` calling `nodecine.timeline(tl)`.
 */

export const ART_DIRECTOR = 'core/art-director';

/** New blocks one run may draw, however many the model asks for. */
const MAX_DRAWN = 3;

export const DEFAULT_STAGE: StageDef = {
  name: 'Dark',
  frame: {
    width: 1080,
    height: 1920,
  },
  tokens: {
    palette: {
      bg: '#0b0c10',
      bg2: '#101218',
      panel: '#14161c',
      line: '#2a2e37',
      fg: '#f2f3f5',
      muted: '#9aa0ab',
      muted2: '#5f6570',
      accent: '#7c5cff',
    },
    fonts: {
      display: "'JetBrains Mono', ui-monospace, Menlo, monospace",
      body: "'JetBrains Mono', ui-monospace, Menlo, monospace",
    },
  },
  transition: { type: 'fade', seconds: 0.4 },
  vars: {},
  tones: {
    cool: {
      accent: '#58a6ff',
      bg2: '#0f1420',
    },
    warm: {
      accent: '#e3b341',
      bg2: '#1a150e',
    },
    green: {
      accent: '#3fb950',
      bg2: '#0e1a12',
    },
  },
  sceneFields: [
    {
      name: 'kicker',
      rule: 'two or three words naming what the scene is about, uppercase, shown small above the content',
    },
  ],
  code: {
    format: 'html-gsap',
    source: [
      '<style>',
      '  .stage { position: absolute; inset: 0; background: var(--bg); color: var(--fg); font-family: var(--font-body); }',
      '  /* The glow is its own layer, moved by transform (a compositor job, no repaint): the stage script drives --drift from 1 to 1.18 over the scene. */',
      "  .stage::before { content: ''; position: absolute; inset: -12%; background: radial-gradient(120% 80% at 50% 0%, var(--bg2) 0%, var(--bg) 65%); transform: scale(var(--drift, 1)); transform-origin: 50% 0%; will-change: transform; pointer-events: none; }",
      '  .stage .kicker { position: absolute; left: 72px; top: 200px; font: 600 28px/1 var(--font-body); letter-spacing: .16em; text-transform: uppercase; color: var(--accent); }',
      '  .stage .content { position: absolute; left: 72px; right: 168px; top: 260px; bottom: 680px; display: flex; flex-direction: column; justify-content: center; }',
      '  .stage .rule { position: absolute; left: 72px; right: 168px; bottom: 640px; height: 2px; background: var(--line); }',
      '  .stage .captions { position: absolute; left: 72px; right: 168px; bottom: 720px; text-align: center; font: 700 44px/1.3 var(--font-body); color: color-mix(in srgb, var(--fg) 85%, transparent); text-shadow: 0 2px 10px color-mix(in srgb, var(--bg) 70%, transparent); --caption-on: var(--accent); }',
      '</style>',
      '<div class="stage">',
      '  <div class="kicker" data-field="kicker"></div>',
      '  <div class="content" data-slot="content"></div>',
      '  <div class="rule"></div>',
      '  <div class="captions" data-slot="captions" data-caption-style="karaoke"></div>',
      '</div>',
      '<script>',
      '  nodecine.timeline(gsap.timeline()',
      '    .fromTo(".kicker", { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }, 0)',
      '    .fromTo(".rule", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.6, ease: "power2.out" }, 0.1)',
      '    .fromTo(".stage", { "--drift": 1 }, { "--drift": 1.18, duration: Math.max(4, nodecine.duration || 6), ease: "none" }, 0));',
      '</script>'
    ].join('\n'),
  },
};

/** The look, plus who plays which role. Declared here rather than in payloads because casting is the node's, not the wire's. */
export const ArtDirectorParamsSchema = LookDefBaseSchema.extend({ casting: CastingSchema }).superRefine(uniqueBlockIds);
export type ArtDirectorParams = z.infer<typeof ArtDirectorParamsSchema>;

export const artDirector: NodeDefinition<typeof ArtDirectorParamsSchema> = {
  type: ART_DIRECTOR,
  version: 5,
  kind: 'process',
  inputs: [
    { name: 'scenes', type: 'SceneScript' },
    // Wired, a model chooses among the blocks that fit each scene; unwired, the rule chooses.
    { name: 'llm', type: 'LLMRef', required: false, requires: ['installed', 'authenticated'] },
  ],
  outputs: [{ name: 'plan', type: 'ScenePlan' }],
  paramsSchema: ArtDirectorParamsSchema,
  defaultParams: { ...DEFAULT_STAGE, blocks: [DEFAULT_BLOCK], casting: [] },
  // A scene no block can show is known before anything runs; say so on the node instead of failing mid-run.
  preflight: (inputs, params) => {
    const script = inputs.scenes?.payload as SceneScript | undefined;
    if (!script) return null;
    // With a model wired, a scene no block can show is written for, not refused.
    if (inputs.llm) return null;
    try {
      const { casting, ...lookDef } = params;
      castScenes(script, lookDef, casting);
      return null;
    } catch (e) {
      if (e instanceof CastError) return { kind: 'capability', code: ErrorCode.NODE_PARAMS_INVALID, message: e.message, fix: e.fix };
      throw e;
    }
  },
  run: async ({ params, inputs, services, signal, log, progress, patchParams }) => {
    const { casting, ...params_ } = params;
    let lookDef = params_;
    const script = inputs.scenes!.payload as SceneScript;
    const ref = inputs.llm?.payload as LLMRef | undefined;
    if (ref) {
      // A scene no block shows whole (all of its content) gets a block written for it, used now and kept
      // in the node — unless the casting table already named a block for that role, which is the user deciding.
      const orphans = sceneCandidates(script, lookDef, casting).map((c, i) => (!c.pinned && c.candidates.length === 0 ? i : -1)).filter((i) => i >= 0);
      for (const i of orphans) {
        const scene = script.scenes[i]!;
        progress(0.1, `writing a block for scene ${i + 1}`);
        const { block, attempts } = await authorBlock(services, ref, scene, lookDef, signal);
        lookDef = { ...lookDef, blocks: [...lookDef.blocks, block] };
        log('info', `wrote block "${block.id}" for scene ${i + 1} (${scene.role})${attempts > 1 ? ' on the second try' : ''} · kept in this node`);
      }
      if (orphans.length) patchParams({ blocks: lookDef.blocks });
    }
    let picks: Awaited<ReturnType<typeof pickWithModel>> = [];
    if (ref) {
      progress(0.2, 'casting with the model');
      picks = await pickWithModel(services, ref, script, lookDef, casting, signal, log, true);
      // Scenes the model looked at and turned down: it read the catalogue and said none of it is
      // right for that beat. Each gets a block drawn for it, which is then that scene's block —
      // there is nothing to choose between, since it was written for this scene and no other.
      const turned = picks.map((p, i) => (p?.none ? i : -1)).filter((i) => i >= 0);
      for (const i of turned.slice(0, MAX_DRAWN)) {
        const scene = script.scenes[i]!;
        progress(0.3, `drawing a block for scene ${i + 1}`);
        const { block } = await authorBlock(services, ref, scene, lookDef, signal);
        lookDef = { ...lookDef, blocks: [...lookDef.blocks, block] };
        picks[i] = { block: block.id, ...(picks[i]?.tone ? { tone: picks[i]!.tone } : {}) };
        log('info', `drew block "${block.id}" for scene ${i + 1} (${scene.role}): the model asked for one · kept in this node`);
      }
      // A catalogue that grows every run stops being a look. Past the cap the rest are cast by the
      // rule, and the log says so rather than the run quietly costing ten more model calls.
      if (turned.length > MAX_DRAWN) log('warn', `the model asked for ${turned.length} new blocks; drew ${MAX_DRAWN} and cast the rest from the catalogue`);
      for (const i of turned.slice(MAX_DRAWN)) picks[i] = { ...(picks[i]?.tone ? { tone: picks[i]!.tone } : {}) };
      if (turned.length) patchParams({ blocks: lookDef.blocks });
    }
    const { plan, notes } = castScenes(script, lookDef, casting, picks);
    for (const n of notes) log('warn', n);
    log('info', `${plan.scenes.length} scenes cast${ref ? ' with the model' : ' by content'} · ${plan.scenes.map((s) => s.blockId).join(', ')}`);
    return { plan };
  },
};

export const DEFAULT_ART_DIRECTOR: ArtDirectorParams = artDirector.defaultParams;
