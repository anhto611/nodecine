import { describe, expect, it } from 'vitest';
import { assetProjectPath } from '@/contracts/types/assets';
import { contentHash } from '@/core/hash';
import { assetProblems, assets, nameFor } from '../node';

const url = (n: number) => `/api/assets/${String(n).repeat(40)}.png`;
const run = (items: { name: string; url: string; note?: string }[]) => assets.run({ params: { items }, inputs: {}, lists: {}, log: () => {} } as never) as Promise<{ assets: { items: unknown[] } }>;

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
    await expect(run([{ name: 'logo', url: url(1) }, { name: 'logo', url: url(2) }])).rejects.toMatchObject({ code: 'ASSETS_INVALID' });
  });
});

const asset = (n: number, ext = 'png') => `/api/assets/${String(n).repeat(40)}.${ext}`;
const brief = { about: 'Kimi K2.7 HighSpeed https://kimi.com/blog/k2-7', durationSeconds: 60, tone: 'expert', language: 'vi', notes: '' };
const research = { language: 'vi', subject: 'Kimi K2.7 Code HighSpeed', summary: 'Bản K2.7 chạy nhanh hơn.', points: [], sources: [{ url: 'https://kimi.com/blog/k2-7', title: 'Blog' }, { url: 'https://news.example/k2-7', title: 'News' }] };
const pages: Record<string, { url: string; alt: string; page: string }[]> = {
  'https://kimi.com/blog/k2-7': ['og', 'icon', 'chart'].map((n) => ({ url: `https://kimi.com/${n}.png`, alt: n, page: 'https://kimi.com/blog/k2-7' })),
  'https://news.example/k2-7': [{ url: 'https://kimi.com/chart.png', alt: 'chart again', page: 'https://news.example/k2-7' }, { url: 'https://news.example/photo.jpg', alt: 'photo', page: 'https://news.example/k2-7' }],
};
const fetched: Record<string, { url: string; width?: number; height?: number }> = {
  'https://kimi.com/og.png': { url: asset(1), width: 1200, height: 630 },
  'https://kimi.com/chart.png': { url: asset(2), width: 1600, height: 900 },
  'https://kimi.com/icon.png': { url: asset(3), width: 64, height: 64 },
  'https://news.example/photo.jpg': { url: asset(5), width: 1200, height: 800 },
};

function searching(params: Record<string, unknown>, inputs: Record<string, unknown> = { brief: { type: 'Brief', payload: brief }, research: { type: 'Research', payload: research } }) {
  const calls: { prompt: string; images?: string[] }[] = [];
  const read: string[] = [];
  let patched: Record<string, unknown> = {};
  const services = {
    probeLLM: async () => ({ providerId: 'fake', displayName: 'Fake', transport: 'cli', settings: {}, capabilities: { installed: { status: 'ready' }, authenticated: { status: 'ready' }, structuredOutput: { status: 'ready' }, vision: { status: 'ready' } } }),
    complete: async (_ref: unknown, prompt: string, _schema: unknown, _signal: unknown, opts?: { images?: string[] }) => {
      calls.push({ prompt, images: opts?.images });
      return { language: 'vi', pictures: [{ number: 2, note: 'Biểu đồ tốc độ token' }, { number: 3, note: 'Ảnh trong bài báo' }, { number: 9, note: 'không có' }] };
    },
    invoke: async (id: string, [link]: [string]) => {
      if (id === 'assets/read-page') { read.push(link); return { url: link, title: '', text: '', pictures: pages[link] ?? [] }; }
      const f = fetched[link];
      if (!f) throw new Error('404');
      return f;
    },
  };
  const run = (extra: Record<string, unknown> = {}) => assets.run({
    nodeId: 'assets', params: assets.paramsSchema.parse({ llmProvider: 'fake', ...params, ...patched, ...extra }), inputs, lists: {}, signal: new AbortController().signal, fresh: false,
    services, log: () => {}, progress: () => {}, patchParams: (p: Record<string, unknown>) => { patched = { ...patched, ...p }; },
  } as never) as Promise<{ assets: { items: { name: string; url: string; note: string; source?: string }[] } }>;
  return { calls, read, run, patched: () => patched };
}

describe('the Assets node finding pictures', () => {
  it('reads the brief\'s and the research\'s pages, shows the model the pictures big enough for a film, and keeps the ones it picks', async () => {
    const { calls, read, run } = searching({ pictures: 4, wanted: 'Benchmark charts and the logo.' });
    const out = await run();
    expect(read).toEqual(['https://kimi.com/blog/k2-7', 'https://news.example/k2-7']);
    // The icon is too small; the chart shown twice is one picture.
    expect(calls[0]!.images).toEqual([asset(1), asset(2), asset(5)]);
    expect(calls[0]!.prompt).toContain('Benchmark charts and the logo.');
    expect(out.assets.items).toEqual([
      { name: 'bieu-do-toc-do-token', url: asset(2), note: 'Biểu đồ tốc độ token', width: 1600, height: 900, source: 'https://kimi.com/blog/k2-7' },
      { name: 'anh-trong-bai-bao', url: asset(5), note: 'Ảnh trong bài báo', width: 1200, height: 800, source: 'https://news.example/k2-7' },
    ]);
  });

  it('keeps what it found, so leaving a picture out or rewriting a note does not search again', async () => {
    const s = searching({ pictures: 4 });
    await s.run();
    expect(s.patched()).toMatchObject({ found: [{ url: asset(2) }, { url: asset(5) }] });
    const again = await s.run({ dropped: [asset(5)], notes: { [asset(2)]: 'Biểu đồ' } });
    expect(s.calls).toHaveLength(1);
    expect(again.assets.items.map((a) => [a.url, a.note])).toEqual([[asset(2), 'Biểu đồ']]);
    await s.run({ attempt: 1 });
    expect(s.calls).toHaveLength(2);
  });

  it('finds nothing with nothing wired in, or when it is asked for no pictures', async () => {
    const unwired = searching({ pictures: 4 }, {});
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
    const key = contentHash({ about: 'x', language: 'vi', subject: undefined, summary: undefined, sources: undefined, pictures: 8, wanted: '', attempt: 0, llm: ['', {}] });
    return assets.run({ params: assets.paramsSchema.parse({ ...params, found, foundFor: key }), inputs: { brief: { type: 'Brief', payload: { about: 'x', language: 'vi' } } }, lists: {}, log: () => {}, patchParams: () => {} } as never) as Promise<{ assets: { items: { name: string; url: string; note: string }[] } }>;
  };

  it('keeps the found ones a person did not leave out, with their notes, before the ones a person brought', async () => {
    const { assets: out } = await runWith({ items: [{ name: 'logo', url: url(1), note: 'my logo' }], dropped: [url(9)], notes: { [url(8)]: 'Biểu đồ tốc độ' } });
    expect(out.items.map((a) => [a.name, a.url, a.note])).toEqual([
      ['logo-2', url(7), 'Logo Kimi'],
      ['chart', url(8), 'Biểu đồ tốc độ'],
      ['logo', url(1), 'my logo'],
    ]);
  });
});
