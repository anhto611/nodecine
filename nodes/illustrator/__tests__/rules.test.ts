import { describe, expect, it } from 'vitest';
import { STYLE_RULES, codeRules, lintSceneSource, lintStyleCss } from '../rules';
import { buildStylePrompt } from '../style';
import { buildScenePrompt, describeContent, resolveAssets, sceneAssets } from '../scene';
import { SCENE_SOURCE, STYLE } from '@/core/__tests__/scene-fixtures';

const frame = { width: 1080, height: 1920 };

describe('the prompts', () => {
  it('the style prompt carries the brief, the frame, the rules and the answer shape', () => {
    const p = buildStylePrompt({ brief: 'bảng trắng', frame, language: 'vi', character: true });
    expect(p).toContain('bảng trắng');
    expect(p).toContain('1080×1920 portrait');
    expect(p).toContain(STYLE_RULES[0]);
    expect(p).toContain('data-var="character"');
    expect(p).toContain('"guide"');
    expect(buildStylePrompt({ brief: '', frame, language: 'en' })).toContain('No brief');
    expect(buildStylePrompt({ brief: '', frame, language: 'en' }, 'no --bg')).toContain('rejected: no --bg');
  });

  it('the scene prompt carries the narration, the content, the bound keys, the style sheet, the safe zones and the rules', () => {
    const scene = { role: 'body', weight: 1, narration: 'Ba bước.', content: { title: 'Ba bước', points: ['một', 'hai'], image: '/api/assets/0123456789abcdef.png' }, factBindings: { number: 'stars' } };
    const p = buildScenePrompt({ style: STYLE, guide: 'the guide', frame: { width: 1920, height: 1080 }, language: 'vi', scene, index: 1, count: 5, vars: { channel: 'AIDev' } });
    expect(p).toContain('Draw scene 2 of 5');
    expect(p).toContain('"Ba bước."');
    expect(p).toContain('- title: "Ba bước"');
    expect(p).toContain('- points: ["một","hai"]');
    expect(p).toContain('- image: a picture — write src="asset:image"');
    expect(p).not.toContain('/api/assets/0123456789abcdef.png');
    expect(p).toContain('- number: "…" — bound to verified data "stars": data-fact="stars"');
    expect(p).toContain('channel ("AIDev")');
    expect(p).toContain('the guide');
    expect(p).toContain(STYLE.css);
    expect(p).toContain('left 96px, right 96px, top 96px, bottom 96px');
    expect(p).toContain(codeRules(frame)[3]);
  });

  it('describes entries one level down, a bound key next to its text, and pictures as tokens it swaps back afterwards', () => {
    const shot = '/api/assets/0123456789abcdef0123456789abcdef01234567.png';
    const scene = { role: 'x', weight: 1, narration: 'n', content: { number: '1,284', entries: [{ label: 'A', body: 'a' }, { label: 'B', image: shot }] }, factBindings: { number: 'stars' } };
    expect(describeContent(scene)).toEqual(['- number: "1,284" — bound to verified data "stars": data-fact="stars"', '- entries (2, laid out alike):', '  1. label: "A"', '  1. body: "a"', '  2. label: "B"', '  2. image: a picture — write src="asset:entries.2.image"']);
    expect(sceneAssets(scene)).toEqual({ 'entries.2.image': shot });
    expect(resolveAssets('<img src="asset:entries.2.image"><img src="asset:image">', sceneAssets(scene))).toBe(`<img src="${shot}"><img src="asset:image">`);
  });
});

describe('lintSceneSource', () => {
  it('is quiet on a good scene', () => {
    expect(lintSceneSource(SCENE_SOURCE)).toEqual({ hard: [], soft: [] });
  });
  it('flags the mistakes the rules forbid, hard ones apart', () => {
    const r = lintSceneSource('<html><body><div>x</div></body></html><script>gsap.from(".a", {})</script><style>.a { color: red !important }</style>', { facts: ['stars'] });
    expect(r.hard).toEqual(['contains <html>/<head>/<body>; only a fragment belongs here', 'no element carries data-fact="stars"']);
    expect(r.soft).toEqual(['uses gsap .from(); use fromTo so seeking stays in sync', 'uses !important']);
    expect(lintSceneSource('<style>.a{}</style>').hard).toEqual(['has no markup']);
    expect(lintSceneSource('<img src="asset:image">').hard).toEqual(['names asset:image, which the scene does not have']);
    expect(lintSceneSource('<div class="card">x</div>', { assets: { 'entries.1.image': '/api/assets/0123456789abcdef.png' } }).soft).toEqual(['the picture entries.1.image is not shown']);
    expect(lintSceneSource('<img src="https://x.y/a.png">').soft).toEqual(['loads something from the network, which a render cannot']);
  });
});

describe('lintStyleCss', () => {
  it('wants every variable a scene relies on, and no markup', () => {
    expect(lintStyleCss(STYLE.css)).toEqual({ hard: [], soft: [] });
    expect(lintStyleCss('.nc-scene { --bg: #000; }').hard[0]).toBe('does not define --fg, --accent, --muted, --line, --font-display, --font-body');
    expect(lintStyleCss('<style>.a{}</style>').hard[0]).toBe('contains markup; only CSS belongs here');
    expect(lintStyleCss(`${STYLE.css}\n:root { --x: 1 } @import url(https://fonts.example/x.css);`).soft).toEqual(['loads something from the network, which a render cannot', 'uses :root, which the scope never reaches; put variables on .nc-scene']);
  });
});
