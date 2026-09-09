import { describe, expect, it } from 'vitest';
import tpl from '@/templates/still-wide.json';
import { castScenes } from '@/nodes/art-director/cast';


describe('still-wide with clips', () => {
  it('casts still-clip for every scene that carries a clip', () => {
    const node = (tpl as any).graph.nodes.find((n: any) => n.type === 'core/art-director');
    const { casting, ...look } = node.params;
    const clip = '/api/assets/89abcdef0123456789abcdef0123456789abcdef.mp4';
    const script = { language: 'vi', scenes: [1, 2, 3].map((i) => ({ role: 'shot', weight: 1, narration: `c${i}`, content: { clip } })) } as any;
    const { plan, notes } = castScenes(script, look, casting ?? []);
    expect(plan.scenes.map((s) => s.blockId)).toEqual(['still-clip', 'still-clip', 'still-clip']);
    expect(notes).toEqual([]);
    expect(Object.values(plan.scenes[0]!.props)).toContain(clip);
  });
});
