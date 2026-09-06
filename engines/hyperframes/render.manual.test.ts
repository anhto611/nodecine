import { describe, expect, it } from 'vitest';
import { stat } from 'node:fs/promises';
import { renderWithProducer } from './register.server';
import staticScript from '@/templates/static-script.json';
import githubShowcase from '@/templates/github-showcase.json';
import quoteCards from '@/templates/quote-cards.json';
import type { VideoIR } from '@/core/types/ir';
import type { BlockDef, StageDef } from '@/core/types/payloads';

/**
 * Manual: runs the real producer on one shipped template's look with sample props.
 * Enabled with NODECINE_MANUAL_RENDER=1; needs a voice-over mp3 in NODECINE_TMP_DIR named
 * 0123456789abcdef0123456789abcdef.mp3 and its length in NODECINE_MANUAL_DURATION (seconds).
 * NODECINE_MANUAL_TEMPLATE picks static-script (default), github-showcase or quote-cards.
 */
const enabled = process.env.NODECINE_MANUAL_RENDER === '1';
const TEMPLATES = { 'static-script': staticScript, 'github-showcase': githubShowcase, 'quote-cards': quoteCards } as const;
type Scene = { blockId: string; weight: number; props: Record<string, unknown>; tone?: string; fields?: Record<string, string> };
const SAMPLE: Record<keyof typeof TEMPLATES, Scene[]> = {
  'static-script': [
    { blockId: 'text-card', weight: 1, props: { headline: 'Ship video from a graph', body: 'NodeCine v0.1' }, fields: { kicker: 'NodeCine' } },
    { blockId: 'text-card', weight: 2, props: { headline: 'Nodes, not timelines' }, tone: 'cool', fields: { kicker: 'How' } },
    { blockId: 'text-card', weight: 1, props: { headline: 'Star on GitHub' }, tone: 'warm', fields: { kicker: 'Next' } },
  ],
  'github-showcase': [
    { blockId: 'hook', weight: 1, props: { headline: 'HTTP, without the ceremony', subline: 'Fast, unopinionated, minimalist web framework for Node.js.', badgeText: 'Trending', stars: 69417 }, fields: { kicker: 'expressjs/express' } },
    { blockId: 'mockup', weight: 2, props: { headline: 'Three lines to a running server', featureHighlights: ['Routes as plain functions', 'Middleware you can read', 'Zero config, zero build'], installCommand: 'npm install express', repoName: 'expressjs/express' }, tone: 'green', fields: { kicker: 'What it does' } },
    { blockId: 'cta', weight: 1, props: { headline: 'Ship your next API on it', callToActionText: 'Star the repo, read the docs, open your first issue.', buttonText: 'Star on GitHub', brandName: 'github.com/expressjs/express' }, tone: 'amber', fields: { kicker: 'Next' } },
  ],
  'quote-cards': [
    { blockId: 'text-card', weight: 0.5, props: { headline: 'Staying focused when progress feels slow' }, fields: { kicker: 'Five quotes' } },
    { blockId: 'quote', weight: 1, props: { text: 'Slow is smooth, and smooth is fast.', attribution: 'a saying among instructors' }, tone: 'moss', fields: { kicker: 'One' } },
    { blockId: 'quote', weight: 1, props: { text: 'The days are long, but the years are short.', attribution: 'Gretchen Rubin' }, tone: 'indigo', fields: { kicker: 'Two' } },
  ],
};

describe.skipIf(!enabled)('Hyperframes producer, for real', () => {
  it('renders a shipped look to an MP4', async () => {
    const id = (process.env.NODECINE_MANUAL_TEMPLATE ?? 'static-script') as keyof typeof TEMPLATES;
    const nodes = TEMPLATES[id].graph.nodes;
    const stage = nodes.find((n) => n.type === 'core/look')!.params as unknown as StageDef;
    const blocks = nodes.filter((n) => n.type === 'core/blocks').flatMap((n) => (n.params as unknown as { blocks: BlockDef[] }).blocks);
    const duration = Number(process.env.NODECINE_MANUAL_DURATION ?? '9');
    const fps = 30;
    const total = Math.ceil(duration * fps);
    const scenes = SAMPLE[id];
    const weightSum = scenes.reduce((n, s) => n + s.weight, 0);
    let cursor = 0;
    const timeline = scenes.map((s, i) => {
      const frames = i === scenes.length - 1 ? total - cursor : Math.round((total * s.weight) / weightSum);
      const entry = { id: `scene-${i + 1}-${s.blockId}`, blockId: s.blockId, startFrame: cursor, durationInFrames: frames, props: s.props, ...(s.tone ? { tone: s.tone } : {}), ...(s.fields ? { fields: s.fields } : {}) };
      cursor += frames;
      return entry;
    });
    const ir: VideoIR = {
      irVersion: 1,
      meta: { title: id, language: 'en', fps, width: 1080, height: 1920, totalDurationInFrames: total },
      stage, blocks,
      audioTrack: { voiceoverUrl: '/api/media/0123456789abcdef0123456789abcdef.mp3', durationSeconds: duration, padTailFrames: 0 },
      timeline,
    };
    const t0 = Date.now();
    const out = await renderWithProducer(ir, { codec: 'h264', quality: 'medium', fileName: `${id}.mp4` }, () => {}, new AbortController().signal);
    console.log('rendered', id, out, 'in', Date.now() - t0, 'ms');
    expect(out.outputUrl).toMatch(/^\/api\/media\/[a-f0-9]+\.mp4$/);
    const s = await stat(`${process.env.NODECINE_TMP_DIR}/${out.outputUrl.split('/').pop()}`);
    expect(s.size).toBeGreaterThan(50_000);
  }, 600_000);
});
