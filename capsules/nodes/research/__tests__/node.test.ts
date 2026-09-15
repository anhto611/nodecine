import { describe, expect, it } from 'vitest';
import { research } from '../node';

const brief = { about: 'Kimi K2.7 HighSpeed nhanh gấp 6 lần https://kimi.com/blog/k2-7 và https://broken.example', language: 'vi' };
const findings = {
  language: 'vi', subject: 'Kimi K2.7 Code HighSpeed', summary: 'Bản K2.7 chạy nhanh hơn cho lập trình.',
  points: [{ text: 'Khoảng 180 token/giây ở coding task trung bình.', source: 'https://kimi.com/blog/k2-7' }, { text: 'Đang mở cho Beta Program.', source: null }],
  sources: [{ url: 'https://kimi.com/blog/k2-7', title: 'K2.7 HighSpeed' }],
};

function setup(settings: Record<string, unknown>, options: { web?: boolean } = {}) {
  const calls: { prompt: string; images?: string[]; web?: boolean }[] = [];
  const logs: string[] = [];
  const services = {
    probeLLM: async () => ({ providerId: 'fake', displayName: 'Fake', transport: 'cli', settings: {}, capabilities: { installed: { status: 'ready' }, authenticated: { status: 'ready' }, structuredOutput: { status: 'ready' }, vision: { status: 'ready' }, ...(options.web ? { webSearch: { status: 'ready' } } : {}) } }),
    complete: async (_ref: unknown, prompt: string, _schema: unknown, _signal: unknown, opts?: { images?: string[]; web?: boolean }) => {
      calls.push({ prompt, images: opts?.images, web: opts?.web });
      return structuredClone(findings);
    },
    invoke: async (_id: string, [link]: [string]) => {
      if (link.includes('broken')) throw new Error('the page answered 404');
      return { url: link, title: 'K2.7 HighSpeed', text: 'K2.7 Code HighSpeed runs about 180 tokens a second.', pictures: [] };
    },
  };
  const run = () => research.run({
    nodeId: 'research', params: research.paramsSchema.parse({ llmProvider: 'fake', ...settings }), lists: {}, signal: new AbortController().signal, fresh: false,
    inputs: { brief: { type: 'Brief', payload: brief } },
    services, log: (_: string, m: string) => logs.push(m), progress: () => {}, patchParams: () => {},
  } as never) as Promise<{ research: { subject: string; points: { text: string; source: string }[]; sources: unknown[] } }>;
  return { calls, logs, run };
}

describe('Research', () => {
  it('reads the linked pages and hands on the facts with where each was read', async () => {
    const { calls, logs, run } = setup({ guide: 'Find the number behind the news.' });
    const out = await run();
    expect(logs.some((m) => m.includes('could not read https://broken.example'))).toBe(true);
    expect(calls[0]!.web).toBeUndefined();
    expect(calls[0]!.images).toBeUndefined();
    expect(calls[0]!.prompt).toContain('Find the number behind the news.');
    expect(calls[0]!.prompt).toContain('K2.7 Code HighSpeed runs about 180 tokens a second.');
    expect(calls[0]!.prompt).toContain('Do not look anything up');
    expect(out.research).toEqual({
      language: 'vi', subject: 'Kimi K2.7 Code HighSpeed', summary: 'Bản K2.7 chạy nhanh hơn cho lập trình.',
      points: [{ text: 'Khoảng 180 token/giây ở coding task trung bình.', source: 'https://kimi.com/blog/k2-7' }, { text: 'Đang mở cho Beta Program.', source: '' }],
      sources: [{ url: 'https://kimi.com/blog/k2-7', title: 'K2.7 HighSpeed' }],
    });
    expect(Object.keys(out)).toEqual(['research']);
  });

  it('searches the web when the workflow asks and the model can, and says so when it cannot', async () => {
    const able = setup({ search: 'web' }, { web: true });
    await able.run();
    expect(able.calls[0]!.web).toBe(true);
    expect(able.calls[0]!.prompt).toContain('You can search the web');

    const unable = setup({ search: 'web' });
    await unable.run();
    expect(unable.calls[0]!.web).toBeUndefined();
    expect(unable.logs.some((m) => m.includes('cannot search the web'))).toBe(true);
  });

  it('lays a person\'s corrections over what the model found', async () => {
    const { run } = setup({ edits: { subject: 'Kimi K2.7', points: [{ text: 'Nhanh gấp 6 lần.', source: '' }] } });
    const out = await run();
    expect(out.research.subject).toBe('Kimi K2.7');
    expect(out.research.points).toEqual([{ text: 'Nhanh gấp 6 lần.', source: '' }]);
  });
});
