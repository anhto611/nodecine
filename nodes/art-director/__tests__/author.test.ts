import { beforeEach, describe, expect, it } from 'vitest';
import { authorBlock, buildAuthoringPrompt, rejectBlock, slugForBlock } from '../author';
import { Executor } from '@/core/engine/executor';
import type { Graph } from '@/core/engine/graph';
import { registerNodes } from '@/nodes';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { makeFakeServices } from '@/core/__tests__/fakes';
import { STAGE, TEXT_CARD, lookNode } from '@/core/__tests__/look-fixtures';
import type { BlockDef, LLMRef, ScenePlan, SceneScript } from '@/core/types/payloads';

const look = { ...STAGE, blocks: [TEXT_CARD] };
const ref = { providerId: 'claude-code', displayName: 'x', transport: 'cli', capabilities: {}, settings: {} } as unknown as LLMRef;
const quoteScene: SceneScript['scenes'][number] = { role: 'voice', weight: 1, narration: 'As one user put it.', content: { quote: 'It just works.', attribution: 'a user' } };
const goodBlock = {
  name: 'Quote card',
  when: 'Somebody\'s words with who said them.',
  example: '{"quote":"It just works.","attribution":"a user"}',
  props: { quote: { type: 'text', content: 'quote', required: true, max: 220 }, attribution: { type: 'string', content: 'attribution', required: false, max: 60 } },
  source: '<style>\n  .q { font: 600 54px/1.3 var(--font-display); color: var(--fg); }\n</style>\n<blockquote class="q" data-prop="quote"></blockquote>\n<cite data-prop="attribution" data-if="attribution"></cite>\n<script>\n  nodecine.timeline(gsap.timeline().fromTo(".q", { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0));\n</script>',
};

describe('buildAuthoringPrompt / rejectBlock', () => {
  it('tells the model what the scene says and shows, the stage tokens, the rules, and the answer shape', () => {
    const p = buildAuthoringPrompt(quoteScene, look);
    expect(p).toContain('says: "As one user put it."');
    expect(p).toContain('- quote: "It just works."');
    expect(p).toContain('Palette keys of the stage');
    expect(p).toContain('data-prop=');
    expect(p).toContain('"content": "<content key>"');
    expect(buildAuthoringPrompt(quoteScene, look, 'no props')).toContain('Your previous attempt was rejected: no props');
  });

  it('rejects a block that does not fit the scene, has no data-prop, or uses gsap.from', () => {
    const base: BlockDef = { id: 'q', name: 'Q', doc: { when: 'w', example: '' }, props: { quote: { type: 'text', content: 'quote', required: true }, attribution: { type: 'string', content: 'attribution', required: false } }, code: { format: 'html-gsap', source: '<p data-prop="quote"></p><i data-prop="attribution"></i>' } };
    expect(rejectBlock(base, quoteScene)).toBeNull();
    // A block that shows the quote but has nowhere for the attribution loses content: not good enough.
    expect(rejectBlock({ ...base, props: { quote: base.props.quote! }, code: { format: 'html-gsap', source: '<p data-prop="quote"></p>' } }, quoteScene)).toMatch(/no prop for attribution/);
    expect(rejectBlock({ ...base, code: { format: 'html-gsap', source: '<p></p>' } }, quoteScene)).toMatch(/no data-prop/);
    expect(rejectBlock({ ...base, props: { title: { type: 'string', content: 'title', required: true } }, code: { format: 'html-gsap', source: '<p data-prop="title"></p>' } }, quoteScene)).toMatch(/title are required/);
    expect(rejectBlock({ ...base, code: { format: 'html-gsap', source: '<p data-prop="quote"></p><i data-prop="attribution"></i><script>gsap.from(".x")</script>' } }, quoteScene)).toMatch(/from\(\)/);
  });

  it('slugs a name and keeps ids unique', () => {
    expect(slugForBlock('Quote card', ['text-card'])).toBe('quote-card');
    expect(slugForBlock('Quote card', ['quote-card'])).toBe('quote-card-2');
  });
});

describe('authorBlock', () => {
  it('accepts a good answer first time, and feeds the rejection back on a second try', async () => {
    const prompts: string[] = [];
    let n = 0;
    const services = { complete: async (_r: LLMRef, prompt: string) => { prompts.push(prompt); n++; return n === 1 ? { ...goodBlock, source: '<p>no hooks</p><script>nodecine.timeline(gsap.timeline())</script>' } : goodBlock; } };
    const { block, attempts } = await authorBlock(services as never, ref, quoteScene, look, new AbortController().signal);
    expect(attempts).toBe(2);
    expect(prompts[1]).toMatch(/Your previous attempt was rejected: prop "quote" has no data-prop element/);
    expect(block.id).toBe('quote-card');
    expect(block.props.attribution!.required).toBe(false);
  });
});

describe('the Art Director writes a block when nothing fits', () => {
  beforeEach(() => { _resetNodeRegistry(); registerNodes(); });

  it('uses the new block for the scene, keeps it in its params, and reuses the run afterwards', async () => {
    const script: Graph['nodes'][number] = {
      id: 'writer', type: 'core/static-script', bypassed: false, position: { x: 0, y: 0 },
      params: { scenes: [{ role: 'open', weight: 1, narration: 'Hello.', content: { title: 'Hello' } }, { role: 'voice', weight: 1, narration: quoteScene.narration, content: quoteScene.content }] },
    };
    const g: Graph = {
      nodes: [script, { id: 'llm', type: 'core/llm-provider', params: { providerId: 'claude-code', settings: {} }, bypassed: false, position: { x: 0, y: 0 } }, lookNode('art', [TEXT_CARD])],
      edges: [
        { id: 'e1', source: 'writer', sourcePort: 'scenes', target: 'art', targetPort: 'scenes' },
        { id: 'e2', source: 'llm', sourcePort: 'llm', target: 'art', targetPort: 'llm' },
      ],
    };
    const services = makeFakeServices({ complete: async (prompt: string) => (prompt.includes('write a new block') ? goodBlock : { scenes: [{ block: 'text-card' }, { block: 'quote-card' }] }) });
    const patches: unknown[] = [];
    const ex = new Executor(g, services, { onParamsPatch: (id, p) => patches.push([id, Object.keys(p)]) });
    const { ok } = await ex.run();
    expect(ok).toBe(true);
    const plan = ex.runtime('art').outputs.plan!.payload as ScenePlan;
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['text-card', 'quote-card']);
    expect(plan.blocks.map((b) => b.id)).toEqual(['text-card', 'quote-card']);
    expect(patches).toEqual([['art', ['blocks']]]);
    expect((ex.getGraph().nodes.find((n) => n.id === 'art')!.params.blocks as BlockDef[]).map((b) => b.id)).toEqual(['text-card', 'quote-card']);

    const before = services.calls.filter((c) => c.name === 'complete').length;
    ex.setGraph(ex.getGraph());
    await ex.run();
    expect(ex.runtime('art').reused).toBe(true);
    expect(services.calls.filter((c) => c.name === 'complete').length).toBe(before);
  });
});
