import { describe, expect, it } from 'vitest';
import { assetProjectPath } from '@/contracts/types/assets';
import { contentHash } from '@/core/hash';
import { assetProblems, assets, nameFor } from '../node';

const url = (n: number) => `/api/assets/${String(n).repeat(40)}.png`;
const run = (items: { name: string; url: string; note?: string }[]) =>
  assets.run({ params: assets.paramsSchema.parse({ items }), inputs: {}, lists: {}, log: () => {} } as never) as Promise<{ assets: { items: unknown[] } }>;

describe('the Assets node', () => {
  it('hands on its pictures by name, each landing under assets/', async () => {
    const { assets: out } = await run([{ name: 'ai-entry', url: url(1), note: 'the chat that logs four expenses' }]);
    expect(out.items).toEqual([{ name: 'ai-entry', url: url(1), note: 'the chat that logs four expenses' }]);
    expect(assetProjectPath({ name: 'ai-entry', url: url(1) })).toBe('assets/ai-entry.png');
  });

  it('names an upload after its file, never twice', () => {
    expect(nameFor('Màn hình Lịch.PNG', [])).toBe('man-hinh-lich');
    expect(nameFor('calendar.png', ['calendar', 'calendar-2'])).toBe('calendar-3');
  });

  it('refuses two assets with one name', async () => {
    expect(assetProblems([{ name: 'logo' }, { name: 'logo' }, { name: 'Bad Name' }])).toEqual(['two assets are named "logo"', '"Bad Name" is not a name: use lowercase letters, digits and dashes']);
    await expect(
      run([
        { name: 'logo', url: url(1) },
        { name: 'logo', url: url(2) },
      ]),
    ).rejects.toMatchObject({ code: 'ASSETS_INVALID' });
  });
});

const asset = (n: number, ext = 'png') => `/api/assets/${String(n).repeat(40)}.${ext}`;
const brief = { about: 'Kimi K2.7 HighSpeed https://kimi.com/blog/k2-7', language: 'vi' };
const pages: Record<string, { url: string; alt: string; page: string }[]> = {
  'https://kimi.com/blog/k2-7': ['og', 'icon', 'chart'].map((n) => ({ url: `https://kimi.com/${n}.png`, alt: n, page: 'https://kimi.com/blog/k2-7' })),
  'https://news.example/k2-7': [
    { url: 'https://kimi.com/chart.png', alt: 'chart again', page: 'https://news.example/k2-7' },
    { url: 'https://news.example/photo.jpg', alt: 'photo', page: 'https://news.example/k2-7' },
  ],
};
const fetched: Record<string, { url: string; width?: number; height?: number }> = {
  'https://kimi.com/og.png': { url: asset(1), width: 1200, height: 630 },
  'https://kimi.com/chart.png': { url: asset(2), width: 1600, height: 900 },
  'https://kimi.com/icon.png': { url: asset(3), width: 64, height: 64 },
  'https://news.example/photo.jpg': { url: asset(5), width: 1200, height: 800 },
};

function searching(params: Record<string, unknown>, options: { web?: boolean; inputs?: Record<string, unknown> } = {}) {
  const calls: { prompt: string; images?: string[]; web?: boolean }[] = [];
  const read: string[] = [];
  let patched: Record<string, unknown> = {};
  const services = {
    probeLLM: async () => ({
      providerId: 'fake',
      displayName: 'Fake',
      transport: 'cli',
      settings: {},
      capabilities: {
        installed: { status: 'ready' },
        authenticated: { status: 'ready' },
        structuredOutput: { status: 'ready' },
        vision: { status: 'ready' },
        ...(options.web === false ? {} : { webSearch: { status: 'ready' } }),
      },
    }),
    complete: async (_ref: unknown, prompt: string, _schema: unknown, _signal: unknown, opts?: { images?: string[]; web?: boolean }) => {
      calls.push({ prompt, images: opts?.images, web: opts?.web });
      if (prompt.includes('Search the web for the pages')) return { pages: [{ url: 'https://kimi.com/blog/k2-7' }, { url: 'https://news.example/k2-7' }] };
      return {
        language: 'vi',
        pictures: [
          { number: 2, note: 'Biểu đồ tốc độ token' },
          { number: 3, note: 'Ảnh trong bài báo' },
          { number: 9, note: 'không có' },
        ],
      };
    },
    invoke: async (id: string, [link]: [string]) => {
      if (id === 'assets/read-page') {
        read.push(link);
        return { url: link, title: '', text: '', pictures: pages[link] ?? [] };
      }
      const f = fetched[link];
      if (!f) throw new Error('404');
      return f;
    },
  };
  const run = (extra: Record<string, unknown> = {}) =>
    assets.run({
      nodeId: 'assets',
      params: assets.paramsSchema.parse({ llmProvider: 'fake', ...params, ...patched, ...extra }),
      inputs: options.inputs ?? { brief: { type: 'Brief', payload: brief } },
      lists: {},
      signal: new AbortController().signal,
      fresh: false,
      services,
      log: () => {},
      progress: () => {},
      patchParams: (p: Record<string, unknown>) => {
        patched = { ...patched, ...p };
      },
    } as never) as Promise<{ assets: { items: { name: string; url: string; note: string; source?: string }[] } }>;
  return { calls, read, run, patched: () => patched };
}

describe('the Assets node finding pictures', () => {
  it("reads the brief's links and the pages a web search finds, shows the model the pictures big enough for a film, and keeps the ones it picks", async () => {
    const { calls, read, run } = searching({ pictures: 4, wanted: 'Benchmark charts and the logo.' });
    const out = await run();
    expect(calls[0]!.web).toBe(true);
    expect(calls[0]!.prompt).toContain('Pages already known (do not list them again): https://kimi.com/blog/k2-7');
    // The page the search gives again is read once.
    expect(read).toEqual(['https://kimi.com/blog/k2-7', 'https://news.example/k2-7']);
    // The icon is too small; the chart shown twice is one picture.
    expect(calls[1]!.images).toEqual([asset(1), asset(2), asset(5)]);
    expect(calls[1]!.prompt).toContain('Benchmark charts and the logo.');
    expect(out.assets.items).toEqual([
      { name: 'bieu-do-toc-do-token', url: asset(2), note: 'Biểu đồ tốc độ token', width: 1600, height: 900, source: 'https://kimi.com/blog/k2-7' },
      { name: 'anh-trong-bai-bao', url: asset(5), note: 'Ảnh trong bài báo', width: 1200, height: 800, source: 'https://news.example/k2-7' },
    ]);
  });

  it("reads only the brief's links with a model that cannot search, and finds nothing without any", async () => {
    const linked = searching({ pictures: 4 }, { web: false });
    await linked.run();
    expect(linked.read).toEqual(['https://kimi.com/blog/k2-7']);
    expect(linked.calls.every((c) => !c.web)).toBe(true);
    const bare = searching({ pictures: 4 }, { web: false, inputs: { brief: { type: 'Brief', payload: { about: 'Kimi K2.7 HighSpeed', language: 'vi' } } } });
    expect((await bare.run()).assets.items).toEqual([]);
    expect(bare.calls).toHaveLength(0);
  });

  it('shows the model the pictures a person brought, first, and never offers one of them again', async () => {
    const logo = { name: 'logo-kimi', url: asset(1), note: 'Logo Kimi' };
    const { calls, run } = searching({ pictures: 4, items: [logo] });
    const out = await run();
    expect(calls[0]!.prompt).toContain('The video already has pictures of: Logo Kimi');
    // The og picture is byte for byte the logo already brought: out before the model looks. The brought one goes first.
    expect(calls[1]!.images).toEqual([asset(1), asset(2), asset(5)]);
    expect(calls[1]!.prompt).toContain('The first 1 attached pictures are already in the video (A1…A1)');
    expect(calls[1]!.prompt).toContain('A1. Logo Kimi');
    expect(calls[1]!.prompt).toContain('Never pick a candidate that shows the same thing as a picture already in the video');
    expect(calls[1]!.prompt).toContain('1. chart');
    expect(out.assets.items.filter((a) => a.url === asset(1))).toHaveLength(1);
  });

  it('never offers again a found picture a person removed', async () => {
    const { calls, run } = searching({ pictures: 4, removed: [asset(2)] });
    const out = await run();
    expect(calls[1]!.images).toEqual([asset(1), asset(5)]);
    expect(out.assets.items.some((a) => a.url === asset(2))).toBe(false);
  });

  it('keeps what it found, so removing a picture or rewriting a note does not search again', async () => {
    const s = searching({ pictures: 4 });
    await s.run();
    expect(s.patched()).toMatchObject({ found: [{ url: asset(2) }, { url: asset(5) }] });
    const again = await s.run({ removed: [asset(5)], notes: { [asset(2)]: 'Biểu đồ' } });
    expect(s.calls).toHaveLength(2);
    expect(again.assets.items.map((a) => [a.url, a.note])).toEqual([[asset(2), 'Biểu đồ']]);
    await s.run({ attempt: 1 });
    expect(s.calls).toHaveLength(4);
    // Searching again asks the same question, with no push to pick something else: the logo may come back.
    expect(s.calls[3]!.prompt).toBe(s.calls[1]!.prompt);
  });

  it('finds nothing with no brief wired in, or when it is asked for no pictures', async () => {
    const unwired = searching({ pictures: 4 }, { inputs: {} });
    expect((await unwired.run()).assets.items).toEqual([]);
    const none = searching({ pictures: 0 });
    expect((await none.run()).assets.items).toEqual([]);
    expect(unwired.calls.length + none.calls.length).toBe(0);
  });
});

describe('the Assets node with pictures it found', () => {
  const found = [
    { name: 'logo', url: url(7), note: 'Logo Kimi', source: 'https://kimi.com' },
    { name: 'chart', url: url(8), note: 'Biểu đồ', source: 'https://kimi.com/blog' },
    { name: 'shot', url: url(9), note: 'Màn hình', source: 'https://kimi.com/blog' },
  ];
  // What an earlier search found, kept on the node for the brief it was found for.
  const runWith = (params: Record<string, unknown>) => {
    const key = contentHash({ about: 'x', language: 'vi', pictures: 8, wanted: '', attempt: 0, llm: ['', {}], existing: ((params.items ?? []) as { url: string }[]).map((a) => a.url) });
    return assets.run({
      params: assets.paramsSchema.parse({ ...params, found, foundFor: key }),
      inputs: { brief: { type: 'Brief', payload: { about: 'x', language: 'vi' } } },
      lists: {},
      log: () => {},
      patchParams: () => {},
    } as never) as Promise<{ assets: { items: { name: string; url: string; note: string }[] } }>;
  };

  it('leaves out a found picture a person removed', async () => {
    const { assets: out } = await runWith({ items: [], removed: [url(7), url(9)] });
    expect(out.items.map((a) => a.url)).toEqual([url(8)]);
  });

  it('keeps the found ones a person did not remove, with their notes, before the ones a person brought', async () => {
    const { assets: out } = await runWith({ items: [{ name: 'logo', url: url(1), note: 'my logo' }], removed: [url(9)], notes: { [url(8)]: 'Biểu đồ tốc độ' } });
    expect(out.items.map((a) => [a.name, a.url, a.note])).toEqual([
      ['logo-2', url(7), 'Logo Kimi'],
      ['chart', url(8), 'Biểu đồ tốc độ'],
      ['logo', url(1), 'my logo'],
    ]);
  });
});
