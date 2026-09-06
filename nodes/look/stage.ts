import { StageDefSchema, type StageDef } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';

/**
 * The stage (CORE_CONTRACTS §5.9, payload §2.6): the one persistent shell every scene of a workflow plays on.
 * Design tokens, the tones a scene may switch to, the per-scene fields it draws (with the rule that
 * teaches the model to write each), and the markup around the block's content area. One per
 * workflow, wired into the director; the block is dropped into the element marked
 * `data-slot="content"`.
 *
 * Same code convention as the block: an HTML fragment with an inline `<style>`, tokens exposed as
 * CSS custom properties by the renderer, an optional `<script>` calling `nodecine.timeline(tl)`.
 */

export const STAGE = 'core/stage';

export const DEFAULT_STAGE: StageDef = {
  id: 'dark',
  name: 'Dark',
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
      '  .stage { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 0%, var(--bg2) 0%, var(--bg) 65%); color: var(--fg); font-family: var(--font-body); }',
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
      '    .fromTo(".rule", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.6, ease: "power2.out" }, 0.1));',
      '</script>'
    ].join('\n'),
  },
};

export const stage: NodeDefinition<typeof StageDefSchema> = {
  type: STAGE,
  version: 1,
  namespace: 'core',
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'stage', type: 'StageDef' }],
  paramsSchema: StageDefSchema,
  defaultParams: DEFAULT_STAGE,
  run: async ({ params }) => ({ stage: params }),
};
