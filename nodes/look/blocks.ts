import { BlockSetSchema, type BlockDef, type BlockSet } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';

/**
 * The Blocks node (CORE_CONTRACTS §5.10): one node carries a whole catalogue of blocks, each a scene
 * archetype (payload §2.7) — id, what the model may write, how to explain it, how to draw it. A
 * workflow usually has one; wire several into the AI Director's `blocks` port and the catalogue is
 * their union. The node's parameters *are* the definitions, so a template file is complete on its own.
 *
 * Code convention (shared with the stage, honoured by each engine's one generic renderer):
 * an HTML fragment with an inline `<style>`; text props bind to elements by `data-prop="name"`;
 * an optional `<script>` may call `nodecine.timeline(tl)` with a GSAP timeline whose zero is the
 * scene's start. No network, no `repeat: -1` — the renderer seeks the timeline by absolute time.
 */

export const BLOCKS = 'core/blocks';

export const DEFAULT_BLOCK: BlockDef = {
  id: 'text-card',
  name: 'Text card',
  doc: {
    example: '{"headline":"Ship video from a graph","body":"Wire a source to a script, a voice and an engine."}',
    when: 'One idea on screen: a headline and at most one supporting line. Use it for openings, transitions and closings; not for lists or numbers.',
  },
  props: {
    headline: {
      type: 'string',
      hint: 'up to six words, title case',
      required: true,
      max: 60,
    },
    body: {
      type: 'text',
      hint: 'one sentence, or leave it out',
      required: false,
      max: 160,
    },
  },
  code: {
    format: 'html-gsap',
    source: [
      '<style>',
      '  .card { display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 32px; }',
      '  .card h1 { font: 800 88px/1.05 var(--font-display); color: var(--fg); margin: 0; letter-spacing: -0.01em; }',
      '  .card p  { font: 400 38px/1.4 var(--font-body); color: var(--muted); margin: 0; max-width: 760px; }',
      '  .card .bar { width: 120px; height: 10px; border-radius: 5px; background: var(--accent); transform-origin: left center; }',
      '</style>',
      '<div class="card">',
      '  <div class="bar"></div>',
      '  <h1 data-prop="headline"></h1>',
      '  <p data-prop="body" data-if="body"></p>',
      '</div>',
      '<script>',
      '  nodecine.timeline(gsap.timeline()',
      '    .fromTo(".card .bar", { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.out" }, 0)',
      '    .fromTo(".card h1", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.2)',
      '    .fromTo(".card p", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.5));',
      '</script>'
    ].join('\n'),
  },
};

export const DEFAULT_BLOCKS: BlockSet = { blocks: [DEFAULT_BLOCK] };

export const blocks: NodeDefinition<typeof BlockSetSchema> = {
  type: BLOCKS,
  version: 1,
  namespace: 'core',
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'blocks', type: 'BlockSet' }],
  paramsSchema: BlockSetSchema,
  defaultParams: DEFAULT_BLOCKS,
  run: async ({ params }) => ({ blocks: params }),
};
