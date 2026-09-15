import { describe, expect, it } from 'vitest';
import { assetProjectPath } from '@/contracts/types/assets';
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
