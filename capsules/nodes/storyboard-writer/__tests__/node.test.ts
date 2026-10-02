import { describe, expect, it } from 'vitest';
import type { Composition } from '@/contracts/types/composition';
import { storyboardWriter } from '../node';
import { unwrapJson, type WrittenStoryboard } from '../output';

const block = (name: string, role: string, vars: string) => `<!doctype html><html data-composition-id="${name}" data-role="${role}" data-composition-variables='[${vars}]'>
<head><meta name="description" content="${name} scene"></head><body><template><div id="root" data-composition-id="${name}"></div></template></body></html>`;

const composition: Composition = {
  engine: 'hyperframes',
  width: 1080,
  height: 1920,
  fps: 30,
  media: {},
  variables: [],
  values: {},
  files: {
    'index.html': '<html></html>',
    'storyboard-guide.md': '---\nfirst: hook\nlast: outro\n---\nOpen on the brand, show features on the phone, close on the button.',
    'compositions/brand-open.html': block('brand-open', 'hook', '{ "id": "name", "type": "string", "label": "Name", "default": "", "maxLength": 24, "required": true }'),
    'compositions/phone-feature.html': block(
      'phone-feature',
      'feature',
      '{ "id": "headline", "type": "string", "label": "Headline", "default": "", "maxLength": 20 }, { "id": "screen", "type": "image", "label": "Screen", "default": "" }, { "id": "callout_at", "type": "number", "label": "When (s)", "default": 1 }',
    ),
    'compositions/components/sticker.html': block('sticker', 'effect', '{ "id": "text", "type": "string", "label": "Text", "default": "", "maxLength": 14, "required": true }'),
    'assemble.json': JSON.stringify({ slots: { 'top-right': [620, 120, 400, 220] } }),
    'compositions/brand-corner.html': block(
      'brand-corner',
      'overlay',
      '{ "id": "name", "type": "string", "label": "Name", "default": "", "maxLength": 20, "required": true }, { "id": "wink_at", "type": "number", "label": "When (s)", "default": 1 }',
    ),
    'compositions/app-close.html': block('app-close', 'outro', '{ "id": "button", "type": "string", "label": "Button", "default": "", "maxLength": 28, "required": true }'),
  },
};
const assets = { items: [{ name: 'ai-entry', url: `/api/assets/${'a'.repeat(40)}.png`, note: 'chat logging four expenses' }] };

const good = {
  language: 'vi',
  subject: 'Pig Money',
  message: 'Ghi chi tiêu bằng một câu',
  frames: [
    { title: 'Mở', voiceover: 'Pig Money là sổ chi tiêu có AI.', transition_in: 'cut', block: 'brand-open', values: { name: 'Pig Money' } },
    {
      title: 'Gõ là ghi',
      voiceover: 'Chỉ cần gõ một câu, AI tự ghi thành bốn khoản chi.',
      transition_in: 'cut',
      block: 'phone-feature',
      values: { headline: 'Gõ là ghi', screen: 'assets/ai-entry.png', callout_at: '@bốn' },
    },
    { title: 'Kết', voiceover: null, duration_seconds: 3, transition_in: 'crossfade', block: 'app-close', values: { button: 'Tải miễn phí' } },
  ],
};

const research = {
  language: 'vi',
  subject: 'Pig Money',
  summary: 'Sổ chi tiêu có AI.',
  points: [{ text: 'Split bills with friends.', source: 'https://apps.apple.com/app/pig-money' }],
  sources: [{ url: 'https://apps.apple.com/app/pig-money', title: 'Pig Money' }],
};

function setup(answers: unknown[], params: Record<string, unknown> = {}) {
  const brief = { about: 'Pig Money: sổ chi tiêu có AI https://apps.apple.com/app/pig-money', language: 'vi' };
  const prompts: { prompt: string; images?: string[] }[] = [];
  const services = {
    probeLLM: async () => ({
      providerId: 'fake',
      displayName: 'Fake',
      transport: 'cli',
      settings: {},
      capabilities: { installed: { status: 'ready' }, authenticated: { status: 'ready' }, structuredOutput: { status: 'ready' }, vision: { status: 'ready' } },
    }),
    complete: async (_ref: unknown, prompt: string, _schema: unknown, _signal: unknown, opts?: { images?: string[] }) => {
      prompts.push({ prompt, images: opts?.images });
      if (!answers.length) throw new Error('no more answers');
      return answers.shift();
    },
  };
  const logs: string[] = [];
  const run = () =>
    storyboardWriter.run({
      nodeId: 'writer',
      params: storyboardWriter.paramsSchema.parse({ llmProvider: 'fake', durationSeconds: 10, ...params }),
      lists: {},
      signal: new AbortController().signal,
      inputs: {
        brief: { type: 'Brief', payload: brief },
        research: { type: 'Research', payload: research },
        composition: { type: 'Composition', payload: composition },
        assets: { type: 'Assets', payload: assets },
      },
      services,
      fresh: false,
      log: (_: string, m: string) => logs.push(m),
      progress: () => {},
      patchParams: () => {},
    } as never) as Promise<{ storyboard: { frames: { block?: string; values: Record<string, unknown>; voiceover?: string }[]; markdown: string; subject?: string }; script: { segments: string[] } }>;
  return { prompts, logs, run };
}

describe('the Storyboard Writer', () => {
  it('writes a storyboard the Assemble node can play, from the brief, the pictures and the blocks', async () => {
    const { prompts, run } = setup([structuredClone(good)]);
    const out = await run();
    expect(out.storyboard.frames.map((f) => f.block)).toEqual(['brand-open', 'phone-feature', 'app-close']);
    expect(out.storyboard.frames[1]!.values).toEqual({ headline: 'Gõ là ghi', screen: 'assets/ai-entry.png', callout_at: '@bốn' });
    expect(out.storyboard.markdown).toContain('- block: phone-feature');
    expect(out.script.segments).toEqual(['Pig Money là sổ chi tiêu có AI.', 'Chỉ cần gõ một câu, AI tự ghi thành bốn khoản chi.']);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.images).toEqual([assets.items[0]!.url]);
    expect(prompts[0]!.prompt).toContain('phone-feature [role: feature]');
    expect(prompts[0]!.prompt).toContain('Open on the brand, show features on the phone');
    expect(prompts[0]!.prompt).toContain('The first scene plays a hook block. The last scene plays a outro block.');
    expect(prompts[0]!.prompt).toContain('- name (string, required): Name');
    expect(prompts[0]!.prompt).toContain('Tone: energetic and upbeat');
    expect(prompts[0]!.prompt).not.toContain('Must say');
    expect(prompts[0]!.prompt).toContain('- Split bills with friends. [https://apps.apple.com/app/pig-money]');
    expect(out.storyboard.subject).toBe('Pig Money');
  });

  it('hands what breaks the rules back to the model, and keeps its fix', async () => {
    const broken = structuredClone(good);
    broken.frames[1]!.values = { headline: 'Một tiêu đề dài quá khung cho phép', screen: 'assets/ai-entri.png', callout_at: '@năm' };
    const { prompts, run } = setup([broken, structuredClone(good)]);
    const out = await run();
    expect(out.storyboard.frames[1]!.values.headline).toBe('Gõ là ghi');
    expect(prompts).toHaveLength(2);
    expect(prompts[1]!.prompt).toContain('headline is 34 characters, the block allows 20');
    expect(prompts[1]!.prompt).toContain('no asset assets/ai-entri.png (there are assets/ai-entry.png)');
    expect(prompts[1]!.prompt).toContain('callout_at: "năm" is not said in this frame');
  });

  it('gives up after two rounds of fixes, with the draft and what is still wrong', async () => {
    const broken = structuredClone(good);
    broken.frames[0]!.block = 'phone-feature';
    (broken.frames[2]!.values as Record<string, unknown>) = { button: '' };
    const { prompts, run } = setup([broken, broken, broken]);
    const error = await run().then(
      () => null,
      (e: { code: string; details: { problems: string[]; markdown: string } }) => e,
    );
    expect(error?.code).toBe('STORYBOARD_UNWRITABLE');
    expect(error?.details.problems).toContain('frame 1: the first frame must play a hook block (it plays phone-feature, a feature block)');
    expect(error?.details.problems).toContain('frame 3, app-close: button is required (Button)');
    expect(error?.details.markdown).toContain('## Frame 1 — Mở');
    expect(prompts).toHaveLength(3);
  });

  it("lays a person's edits over what was written, and rewrites one scene on its own", async () => {
    const rewritten = {
      title: 'Một câu là đủ',
      voiceover: 'Một câu chat, bốn khoản chi đã ghi xong.',
      transition_in: 'cut',
      block: 'phone-feature',
      values: { headline: 'Một câu là đủ', screen: 'assets/ai-entry.png', callout_at: '@bốn' },
    };
    const { prompts, run } = setup([structuredClone(good), rewritten], { rewrites: { 1: 1 }, edits: { 2: { values: { button: 'Tải ngay' } } } });
    const out = await run();
    expect(out.storyboard.frames[1]!.voiceover).toBe('Một câu chat, bốn khoản chi đã ghi xong.');
    expect(out.storyboard.frames[2]!.values.button).toBe('Tải ngay');
    expect(prompts[1]!.prompt).toContain('Rewrite scene 2 only');
  });

  it("holds a person's edits to the same rules", async () => {
    const { run } = setup([structuredClone(good)], { edits: { 1: { values: { callout_at: '@mười' } } } });
    await expect(run()).rejects.toMatchObject({ code: 'STORYBOARD_UNWRITABLE', message: 'frame 2, phone-feature, callout_at: "mười" is not said in this frame' });
  });

  it('holds no scene to a role when the guide asks for none, and wants every required value', async () => {
    const free = structuredClone(good) as unknown as WrittenStoryboard;
    free.frames.reverse();
    free.frames[0]!.values = {};
    const { run } = setup([free, free, free]);
    const original = composition.files['storyboard-guide.md'];
    composition.files['storyboard-guide.md'] = 'Anything goes.';
    try {
      const error = await run().then(
        () => null,
        (e: { details: { problems: string[] } }) => e,
      );
      expect(error?.details.problems).toEqual(['frame 1, app-close: button is required (Button)']);
    } finally {
      composition.files['storyboard-guide.md'] = original!;
    }
  });

  it("writes to its own length, language, tone and must-says, the brief's language when left on auto", async () => {
    const { prompts, run } = setup([structuredClone(good), structuredClone(good), structuredClone(good)], { tone: 'expert', notes: 'không nói giá', durationSeconds: 45 });
    // Three short scenes are too little for 45 seconds; only what was asked matters here.
    await run().catch(() => null);
    expect(prompts[0]!.prompt).toContain('Length: 45 seconds');
    expect(prompts[0]!.prompt).toContain('in Vietnamese');
    expect(prompts[0]!.prompt).toContain('Tone: precise, like an expert explaining');
    expect(prompts[0]!.prompt).toContain('Must say / must not say: không nói giá');
  });

  it('holds a film to how many scenes in a row one block may play', async () => {
    const same = structuredClone(good) as unknown as WrittenStoryboard;
    const feature = same.frames[1]!;
    same.frames.splice(2, 0, structuredClone(feature), structuredClone(feature));
    const { prompts, run } = setup([same, same, same], { durationSeconds: 15 });
    const original = composition.files['storyboard-guide.md']!;
    composition.files['storyboard-guide.md'] = original.replace('last: outro', 'last: outro\nrepeat: 2');
    try {
      const error = await run().then(
        () => null,
        (e: { details: { problems: string[] } }) => e,
      );
      expect(error?.details.problems).toContain('frame 4: phone-feature plays 3 scenes in a row, at most 2 may: tell this scene with another block');
      expect(prompts[0]!.prompt).toContain('Never more than 2 scenes in a row on the same block.');
    } finally {
      composition.files['storyboard-guide.md'] = original;
    }
  });

  it('lays an overlay block over a run of scenes, and holds it to the same rules', async () => {
    const layered = {
      ...structuredClone(good),
      layers: [{ title: 'Góc', block: 'brand-corner', from_frame: 1, to_frame: 2, start: '@sổ', end: null, values: { name: 'Pig Money', wink_at: '@bốn' } }],
    };
    const { run } = setup([layered]);
    const out = (await run()) as unknown as { storyboard: { markdown: string; layers: unknown[] } };
    expect(out.storyboard.markdown).toContain('## Layers\n\n### Layer 1 — Góc\n- block: brand-corner\n- frames: 1-2\n- start: @sổ');
    expect(out.storyboard.layers).toEqual([{ number: 1, title: 'Góc', block: 'brand-corner', from: 1, to: 2, start: '@sổ', values: { name: 'Pig Money', wink_at: '@bốn' } }]);

    const wrong = { ...structuredClone(good), layers: [{ title: 'Sai', block: 'phone-feature', from_frame: 2, to_frame: 5, start: '@Nokia', end: null, values: {} }] };
    const asFrame = structuredClone(good);
    asFrame.frames[1]!.block = 'brand-corner';
    const bad = setup([wrong, wrong, wrong]);
    const error = await bad.run().then(
      () => null,
      (e: { details: { problems: string[] } }) => e,
    );
    expect(error?.details.problems).toContain('layer 1, phone-feature: only an overlay block plays in a layer (this one is a feature block)');
    expect(error?.details.problems).toContain('layer 1: it runs over frames 2 to 5, but the film has frames 1 to 3');
    const misplaced = setup([asFrame, asFrame, asFrame]);
    const error2 = await misplaced.run().then(
      () => null,
      (e: { details: { problems: string[] } }) => e,
    );
    expect(error2?.details.problems).toContain("frame 2: brand-corner is an overlay block: it plays over several frames in a layer, not as a frame's block");
  });

  it("mounts components over a scene's block in named slots, on its words", async () => {
    const mounted = structuredClone(good) as unknown as WrittenStoryboard;
    mounted.frames[1]!.mounts = [{ component: 'sticker', slot: 'top-right', at: '@AI', until: null, values: { text: 'Miễn phí' } }];
    const { run } = setup([mounted]);
    const out = (await run()) as unknown as { storyboard: { markdown: string; frames: { mounts: unknown[] }[] } };
    expect(out.storyboard.frames[1]!.mounts).toEqual([{ component: 'sticker', box: 'top-right', at: '@AI', values: { text: 'Miễn phí' } }]);
    expect(out.storyboard.markdown).toContain('"component": "sticker"');

    const wrong = structuredClone(good) as unknown as WrittenStoryboard;
    wrong.frames[1]!.mounts = [{ component: 'sticker', slot: 'middle', at: '@Nokia', until: null, values: { text: 'Một nhãn dán quá dài' } }];
    const bad = setup([wrong, wrong, wrong]);
    const error = await bad.run().then(
      () => null,
      (e: { details: { problems: string[] } }) => e,
    );
    expect(error?.details.problems).toContain('frame 2, sticker (mount 1): there is no slot middle (there are top-right)');
    expect(error?.details.problems).toContain('frame 2, sticker (mount 1), at: "Nokia" is not said in this frame');
    expect(error?.details.problems).toContain('frame 2, sticker (mount 1): text is 20 characters, the block allows 14');
  });

  it('corrects the subject in every scene, and moves the moments on its words', async () => {
    const named = structuredClone(good);
    named.frames[0]!.values = { name: 'Pig Money' };
    named.frames[1]!.voiceover = 'Mở Pig Money, gõ một câu là ghi.';
    named.frames[1]!.values = { headline: 'Pig Money ghi hộ', screen: 'assets/ai-entry.png', callout_at: '@Money' };
    const { run } = setup([named], { subject: 'Heo Tiết Kiệm' });
    const out = await run();
    expect(out.storyboard.subject).toBe('Heo Tiết Kiệm');
    expect(out.storyboard.frames[0]!.values.name).toBe('Heo Tiết Kiệm');
    expect(out.storyboard.frames[0]!.voiceover).toBe('Heo Tiết Kiệm là sổ chi tiêu có AI.');
    expect(out.storyboard.frames[1]!.values).toEqual({ headline: 'Heo Tiết Kiệm ghi hộ', screen: 'assets/ai-entry.png', callout_at: '@Tiết' });
  });

  it('reads a list the model wrote as a JSON string, so its moments are checked and timed', () => {
    const stringy = structuredClone(good) as unknown as WrittenStoryboard;
    stringy.frames[1]!.values.effects = '[{"type": "pill", "text": "4 khoản", "at": "@bốn"}]';
    stringy.frames[1]!.values.headline = '[not json';
    const read = unwrapJson(stringy);
    expect(read.frames[1]!.values.effects).toEqual([{ type: 'pill', text: '4 khoản', at: '@bốn' }]);
    expect(read.frames[1]!.values.headline).toBe('[not json');
  });
});
