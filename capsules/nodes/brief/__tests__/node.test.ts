import { describe, expect, it } from 'vitest';
import { brief } from '../node';

const run = (params: Record<string, unknown>) => brief.run({ params: brief.paramsSchema.parse(params), inputs: {}, lists: {}, log: () => {} } as never) as Promise<{ brief: unknown }>;

describe('the Brief node', () => {
  it('hands on what the video is about, trimmed, and the language it is written in', async () => {
    const out = await run({ about: '  https://apps.apple.com/app/pig-money sổ chi tiêu có AI ' });
    expect(out.brief).toEqual({ about: 'https://apps.apple.com/app/pig-money sổ chi tiêu có AI', language: 'vi' });
    expect((await run({ about: 'https://example.com/very/long/english/looking/path 家計簿アプリの紹介動画' })).brief).toMatchObject({ language: 'ja' });
    expect((await run({ about: 'https://apps.apple.com/vn/app/duolingo-language-chess/id570060128' })).brief).toMatchObject({ language: 'en' });
  });

  it('asks for something to be about', async () => {
    expect(brief.validate!(brief.paramsSchema.parse({}))).toEqual([{ code: 'BRIEF_EMPTY', message: 'say what the video is about: a link or a few sentences' }]);
    await expect(run({ about: '   ' })).rejects.toMatchObject({ code: 'BRIEF_EMPTY' });
  });
});
