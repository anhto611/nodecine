import type { BlockDef, StageDef } from '../types/payloads';
import { DEFAULT_BLOCK } from '../nodes/block';
import { DEFAULT_STAGE } from '../nodes/stage';

/** The shipped dark stage and text card, plus a hook block with a fact-bound number, for tests. */
export const STAGE: StageDef = DEFAULT_STAGE;
export const TEXT_CARD: BlockDef = DEFAULT_BLOCK;
export const HOOK: BlockDef = {
  id: 'hook',
  name: 'Hook',
  doc: { example: '{"headline":"MEET WIDGET"}', when: 'An opening line; stars come from data.' },
  props: {
    headline: { type: 'string', hint: 'six words at most', required: true, max: 60 },
    stars: { type: 'number', required: false, min: 0 },
  },
  code: { format: 'html-gsap', source: '<h1 data-prop="headline"></h1>' },
};
export const CARD: BlockDef = {
  id: 'card',
  name: 'Card',
  doc: { example: '{"headline":"HI","features":["a","b","c"],"mood":"calm","accentColor":"#112233"}', when: 'A card with three features.' },
  props: {
    headline: { type: 'string', required: true, max: 60 },
    features: { type: 'string[]', hint: 'three short lines', required: true, min: 3, max: 3 },
    mood: { type: 'string', hint: 'calm or bold', required: true, max: 10 },
    stars: { type: 'number', required: false, min: 0 },
    accentColor: { type: 'color', required: true },
  },
  code: { format: 'html-gsap', source: '<div></div>' },
};

export const lookNodes = (consumer: string, blocks: BlockDef[] = [TEXT_CARD], stage: StageDef = STAGE) => ({
  nodes: [
    { id: 'stage', type: 'core/stage', params: stage, bypassed: false, position: { x: 0, y: 0 } },
    ...blocks.map((b) => ({ id: `block-${b.id}`, type: 'core/block', params: b, bypassed: false, position: { x: 0, y: 0 } })),
  ],
  edges: [
    { id: 'look-stage', source: 'stage', sourcePort: 'stage', target: consumer, targetPort: 'stage' },
    ...blocks.map((b) => ({ id: `look-${b.id}`, source: `block-${b.id}`, sourcePort: 'block', target: consumer, targetPort: 'blocks' })),
  ],
});
