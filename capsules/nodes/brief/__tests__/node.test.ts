import { describe, expect, it } from 'vitest';
import { brief } from '../node';

const run = (params: Record<string, unknown>) => brief.run({ params: brief.paramsSchema.parse(params), inputs: {}, lists: {}, log: () => {} } as never) as Promise<{ brief: unknown }>;

describe('the Brief node', () => {
  it('hands on what the video is about, trimmed, with its choices', async () => {
    const out = await run({ about: '  https://apps.apple.com/app/pig-money sổ chi tiêu có AI ', durationSeconds: 45, tone: 'playful', language: 'vi', notes: ' không nói giá ' });
    expect(out.brief).toEqual({ about: 'https://apps.apple.com/app/pig-money sổ chi tiêu có AI', durationSeconds: 45, tone: 'playful', language: 'vi', notes: 'không nói giá' });
  });

  it('asks for something to be about', async () => {
    expect(brief.validate!(brief.paramsSchema.parse({}))).toEqual([{ code: 'BRIEF_EMPTY', message: 'say what the video is about: a link or a few sentences' }]);
    await expect(run({ about: '   ' })).rejects.toMatchObject({ code: 'BRIEF_EMPTY' });
  });
});
