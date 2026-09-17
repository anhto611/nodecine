import { describe, expect, it } from 'vitest';
import type { Composition } from '@/contracts/types/composition';
import type { Storyboard } from '@/contracts/types/storyboard';
import { coverage } from '../node';

const block = (name: string, vars: string, description = name) => `<!doctype html><html data-composition-id="${name}" data-role="scene" data-composition-variables='[${vars}]'>
<head><meta name="description" content="${description}"></head><body><template><div id="root" data-composition-id="${name}"></div></template></body></html>`;

const composition = {
  engine: 'hyperframes', width: 1080, height: 1920, fps: 30, media: {}, variables: [], values: {},
  files: {
    'index.html': '<html></html>',
    'compositions/clip-full.html': block('clip-full', '{ "id": "from", "type": "number", "label": "From (s)", "default": 0, "required": true }, { "id": "seconds", "type": "number", "label": "Length", "default": 5 }'),
    'compositions/clip-card.html': block('clip-card', '{ "id": "from", "type": "number", "label": "From (s)", "default": 0, "required": true }, { "id": "title", "type": "string", "label": "Title", "default": "", "maxLength": 40 }, { "id": "image", "type": "image", "label": "Picture", "default": "" }, { "id": "seconds", "type": "number", "label": "Length", "default": 5 }'),
    'compositions/components/word-pop.html': `<!doctype html><html data-composition-id="word-pop" data-role="effect" data-composition-variables='[{ "id": "text", "type": "string", "label": "Words", "default": "", "required": true, "maxLength": 24 }]'><head><meta name="description" content="a word thrown on screen"></head><body><template><div id="root" data-composition-id="word-pop"></div></template></body></html>`,
    'assemble.json': JSON.stringify({ slots: { middle: [90, 620, 900, 500], full: [0, 0, 1080, 1920] } }),
  },
} as Composition;

const storyboard: Storyboard = {
  markdown: '', layers: [], subject: 'raw-talk.mp4',
  frames: [
    { number: 1, title: 'Một', voiceover: 'Tôi đang tự làm một công cụ dựng video.', transitionIn: 'cut', block: 'clip-full', values: { from: 0 }, mounts: [], extra: {} },
    { number: 2, title: 'Hai', voiceover: 'Nó không có timeline, mỗi việc là một node.', transitionIn: 'cut', block: 'clip-full', values: { from: 4.2 }, mounts: [], extra: {} },
  ],
};
const assets = { items: [{ name: 'so-do-node', url: `/api/assets/${'a'.repeat(40)}.png`, note: 'a node graph' }] };

function setup(answer: unknown) {
  const prompts: string[] = [];
  const logs: string[] = [];
  const services = {
    probeLLM: async () => ({ providerId: 'fake', displayName: 'Fake', transport: 'cli', settings: {}, capabilities: { installed: { status: 'ready' }, authenticated: { status: 'ready' }, structuredOutput: { status: 'ready' }, vision: { status: 'ready' } } }),
    complete: async (_ref: unknown, prompt: string) => { prompts.push(prompt); return answer; },
  };
  const run = () => coverage.run({
    nodeId: 'coverage', params: coverage.paramsSchema.parse({ llmProvider: 'fake' }), lists: {}, signal: new AbortController().signal,
    inputs: {
      storyboard: { type: 'Storyboard', payload: storyboard },
      composition: { type: 'Composition', payload: composition },
      assets: { type: 'Assets', payload: assets },
    },
    services, fresh: false, log: (_: string, m: string) => logs.push(m), progress: () => {}, patchParams: () => {},
  } as never) as Promise<{ storyboard: Storyboard }>;
  return { prompts, logs, run };
}

describe('the Coverage node', () => {
  it('dresses the scenes it was given without moving a cut', async () => {
    const { prompts, run } = setup({
      language: 'vi', scenes: [
        { number: 1, block: 'clip-full', values: {} },
        { number: 2, block: 'clip-card', values: { title: 'Mỗi việc một node', image: `assets/so-do-node.png`, from: 99, seconds: 99 } },
      ],
    });
    const out = await run();
    expect(out.storyboard.frames.map((f) => f.block)).toEqual(['clip-full', 'clip-card']);
    // The second of the recording each scene starts from is the Rough Cut node's, whatever the model writes.
    expect(out.storyboard.frames.map((f) => f.values.from)).toEqual([0, 4.2]);
    expect(out.storyboard.frames[1]!.values.seconds).toBeUndefined();
    expect(out.storyboard.frames[1]!.values.title).toBe('Mỗi việc một node');
    // What is said, the cuts and the order are handed to the model as settled facts.
    expect(prompts[0]).toContain('Tôi đang tự làm một công cụ dựng video.');
    expect(prompts[0]).toContain('assets/so-do-node.png');
    expect(prompts[0]).toContain('Do not write `from` or `seconds`');
  });

  it('throws a piece over a scene, on the word it belongs to', async () => {
    const { prompts, run } = setup({
      language: 'vi', scenes: [
        { number: 1, block: 'clip-full', values: {}, mount: { component: 'word-pop', box: 'middle', at: '@video', values: { text: 'MIỄN PHÍ' } } },
        { number: 2, block: 'clip-full', values: {}, mount: { component: 'no-such-piece', box: 'middle', at: '@node', values: {} } },
      ],
    });
    const out = await run();
    expect(out.storyboard.frames[0]!.mounts).toEqual([{ component: 'word-pop', box: 'middle', at: '@video', values: { text: 'MIỄN PHÍ' } }]);
    // A piece the composition does not have is dropped; the scene itself is kept.
    expect(out.storyboard.frames[1]!.mounts).toEqual([]);
    expect(prompts[0]).toContain('word-pop');
    expect(prompts[0]).toContain('Boxes it can go in: middle, full');
  });

  it('keeps the rough cut for a scene the model answers badly, and says so', async () => {
    const { logs, run } = setup({
      language: 'vi', scenes: [
        { number: 1, block: 'no-such-block', values: {} },
        { number: 2, block: 'clip-card', values: { image: 'assets/not-there.png' } },
      ],
    });
    const out = await run();
    expect(out.storyboard.frames.map((f) => f.block)).toEqual(['clip-full', 'clip-full']);
    expect(logs.join(' ')).toContain('no block called "no-such-block"');
    expect(logs.join(' ')).toContain('keeps the rough cut');
  });
});
