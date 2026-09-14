import { describe, expect, it } from 'vitest';
import { readStoryboard, spokenLines } from '../read';

const md = `---
format: 1080x1920
message: Kimi K2.7 HighSpeed nhanh gấp 6 lần
---

## Frame 1 — Tin mới
- voiceover: "Kimi vừa ra mắt K2.7 Code HighSpeed."
- transition_in: cut
- type: hook

narrativeRole: Mở bằng tin.

\`\`\`json
[{ "component": "hero-badge", "box": "hero", "values": { "badge": "6x" }, "at": "@Kimi" }]
\`\`\`

## Frame 2 — Kết
- duration: 4s
- transition_in: crossfade

\`\`\`json
[{ "component": "cta-card", "box": "full" }]
\`\`\`
`;

describe('reading a storyboard', () => {
  it('reads frames with HyperFrames\' parser and the mounts under each', () => {
    const { storyboard, problems } = readStoryboard(md);
    expect(problems).toEqual([]);
    expect(storyboard!.format).toBe('1080x1920');
    expect(storyboard!.frames.map((f) => [f.number, f.title, f.transitionIn, f.mounts.map((m) => m.component)])).toEqual([
      [1, 'Tin mới', 'cut', ['hero-badge']],
      [2, 'Kết', 'crossfade', ['cta-card']],
    ]);
    expect(storyboard!.frames[0]!.extra.type).toBe('hook');
    expect(spokenLines(storyboard!)).toEqual(['Kimi vừa ra mắt K2.7 Code HighSpeed.']);
  });

  it('names the frame of every problem', () => {
    const broken = md.replace('- duration: 4s\n', '').replace('"box": "full"', '"box": 12');
    const { storyboard, problems } = readStoryboard(broken);
    expect(storyboard).toBeUndefined();
    expect(problems.some((p) => p.startsWith('frame 2, mount 1: box'))).toBe(true);
    expect(problems).toContain('frame 2: a silent frame needs a duration');
  });
});
