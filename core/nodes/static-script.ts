import { z } from 'zod';
import { getScene } from '../scenes/registry';
import { TITLE_CARD } from '../scenes/title-card';
import type { NodeDefinition } from './definition';

const SceneRow = z.object({
  sceneType: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  weight: z.number().positive(),
  props: z.record(z.string(), z.unknown()),
});

const Params = z.object({
  language: z.string().min(2).default('en'),
  theme: z.string().min(1).default('core/dark'),
  script: z.string(),
  scenes: z.array(SceneRow).min(1),
});

export const DEFAULT_STATIC_SCRIPT = {
  language: 'en',
  theme: 'core/dark',
  script:
    'Meet NodeCine. Build short videos from a node graph, not a timeline. Wire a source to a script, a voice, and an engine, and press run.',
  scenes: [
    { sceneType: TITLE_CARD, weight: 1, props: { headline: 'SHIP VIDEO FROM A GRAPH', subline: 'NodeCine v0.1' } },
    { sceneType: TITLE_CARD, weight: 2, props: { headline: 'Nodes, not timelines', accentColor: '#7c5cff' } },
    { sceneType: TITLE_CARD, weight: 1, props: { headline: 'Star on GitHub' } },
  ],
};

/** CORE_CONTRACTS §5.2 — hand-written script and scenes; the Phase A acceptance node. */
export const staticScript: NodeDefinition<typeof Params> = {
  type: 'core/static-script',
  version: 1,
  pack: 'core',
  kind: 'source',
  inputs: [],
  outputs: [
    { name: 'plan', type: 'DirectorPlan' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: DEFAULT_STATIC_SCRIPT,
  validate: (p) => {
    const issues = [];
    if (!p.script.trim()) issues.push({ code: 'INPUT_EMPTY', message: 'Script is empty' });
    p.scenes.forEach((s, i) => {
      const def = getScene(s.sceneType);
      if (!def) {
        issues.push({ code: 'IR_INVALID', message: `Scene ${i + 1}: unknown scene type "${s.sceneType}"` });
        return;
      }
      const parsed = def.propsSchema.safeParse(s.props);
      if (!parsed.success) issues.push({ code: 'NODE_PARAMS_INVALID', message: `Scene ${i + 1}: ${parsed.error.issues[0]?.message ?? 'invalid props'}` });
    });
    return issues;
  },
  run: async ({ params }) => ({
    plan: { language: params.language, theme: params.theme, scenes: params.scenes.map((s) => ({ ...s })) },
    script: { text: params.script.trim(), language: params.language },
  }),
};
