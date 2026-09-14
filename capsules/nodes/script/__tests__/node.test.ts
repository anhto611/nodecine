import { describe, expect, it } from 'vitest';
import { script, segmentsOf } from '../node';

const run = (text: string) => script.run({ params: { text, language: 'vi' }, inputs: {}, lists: {}, log: () => {} } as never) as Promise<{ script: { text: string; segments: string[]; language: string } }>;

describe('the Script node', () => {
  it('makes each paragraph a segment, and the text their join', async () => {
    const { script: out } = await run('Kimi vừa ra mắt\nK2.7 Code.\n\n  Nhìn demo trước.  \n\n\n');
    expect(out.segments).toEqual(['Kimi vừa ra mắt K2.7 Code.', 'Nhìn demo trước.']);
    expect(out.text).toBe('Kimi vừa ra mắt K2.7 Code. Nhìn demo trước.');
    expect(out.language).toBe('vi');
  });

  it('refuses an empty script', async () => {
    expect(segmentsOf(' \n\n ')).toEqual([]);
    await expect(run('   ')).rejects.toMatchObject({ code: 'SCRIPT_EMPTY' });
  });
});
