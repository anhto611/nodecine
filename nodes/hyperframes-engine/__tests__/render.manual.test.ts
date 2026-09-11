import { describe, expect, it } from 'vitest';
import { stat } from 'node:fs/promises';
import { renderWithProducer } from '../register.server';
import type { VideoIR } from '@/core/types/ir';
import { SCENE_SOURCE, STYLE } from '@/core/__tests__/scene-fixtures';

/**
 * Manual: runs the real producer on a small hand-drawn film. Enabled with NODECINE_MANUAL_RENDER=1;
 * needs a voice-over mp3 in NODECINE_TMP_DIR named 0123456789abcdef0123456789abcdef.mp3 and its
 * length in NODECINE_MANUAL_DURATION (seconds).
 */
const enabled = process.env.NODECINE_MANUAL_RENDER === '1';

const SCENES = [
  SCENE_SOURCE.replace('Hello', 'Ship video from a graph').replace('First', 'NodeCine v0.1'),
  '<div class="card"><h1 class="title">Nodes, not timelines</h1></div>\n<script>\n  nodecine.timeline(gsap.timeline().fromTo(".card", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }));\n</script>',
  '<div class="card"><h1 class="title">Star on GitHub</h1></div>',
];

/** The IR the cases below render: the test style with three drawn scenes. */
function sampleIR(): VideoIR {
  const duration = Number(process.env.NODECINE_MANUAL_DURATION ?? '9');
  const fps = 30;
  const total = Math.ceil(duration * fps);
  const weights = [1, 2, 1];
  const weightSum = weights.reduce((n, w) => n + w, 0);
  let cursor = 0;
  const clips = SCENES.map((source, i) => {
    const frames = i === SCENES.length - 1 ? total - cursor : Math.round((total * weights[i]!) / weightSum);
    const clip = { id: `scene-${i + 1}`, kind: 'code' as const, startFrame: cursor, durationInFrames: frames, format: 'html-gsap', source };
    cursor += frames;
    return clip;
  });
  return {
    irVersion: 3,
    meta: { title: 'sample', language: 'en', fps, width: 1080, height: 1920, totalDurationInFrames: total },
    style: STYLE,
    tracks: [{ id: 'scenes', clips }],
    beats: clips.map((c, index) => ({ index, startFrame: c.startFrame, durationInFrames: c.durationInFrames, clipId: c.id })),
    audio: [{ id: 'voice', role: 'voice', url: '/api/media/0123456789abcdef0123456789abcdef.mp3', startFrame: 0, durationInFrames: total, gain: 1 }],
    transitions: { default: { name: 'fade', seconds: 0.4 } },
  };
}

/** A scene that plays a clip behind a headline, for the b-roll case below. */
const brollScene = (clip: string) => [
  '<div class="wrap">',
  `  <video class="shot" src="${clip}"></video>`,
  '  <h1 class="hl">B-roll behind the words</h1>',
  '</div>',
  '<style>',
  '.wrap { position: absolute; inset: 0; }',
  '.shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }',
  '.hl { position: absolute; left: 6%; right: 6%; bottom: 14%; margin: 0; font: 700 84px var(--font-display); color: var(--fg); text-shadow: 0 2px 24px rgba(0,0,0,.8); }',
  '</style>',
].join('\n');

describe.skipIf(!enabled)('Hyperframes producer, for real', () => {
  it('renders a small film to an MP4', async () => {
    const ir = sampleIR();
    const t0 = Date.now();
    const out = await renderWithProducer(ir, { codec: 'h264', quality: 'medium', fileName: 'sample.mp4' }, () => {}, new AbortController().signal);
    console.log('rendered', out, 'in', Date.now() - t0, 'ms');
    expect(out.outputUrl).toMatch(/^\/api\/media\/[a-f0-9]+\.mp4$/);
    const s = await stat(`${process.env.NODECINE_TMP_DIR}/${out.outputUrl.split('/').pop()}`);
    expect(s.size).toBeGreaterThan(50_000);
  }, 600_000);

  /**
   * B-roll: the producer's media pipeline extracts the clip's frames and injects them at capture,
   * so all this side has to do is put a `<video>` in the page with the scene's timing on it.
   * Needs a clip asset in NODECINE_ASSETS_DIR named by NODECINE_MANUAL_CLIP (a `/api/assets/...` url).
   */
  it.skipIf(!process.env.NODECINE_MANUAL_CLIP)('plays a clip inside a scene', async () => {
    const ir = sampleIR();
    const fps = ir.meta.fps;
    const out = await renderWithProducer(
      {
        ...ir,
        meta: { ...ir.meta, totalDurationInFrames: 2 * fps },
        audio: [{ ...ir.audio[0]!, durationInFrames: 2 * fps }],
        tracks: [{ id: 'scenes', clips: [{ id: 'scene-1', kind: 'code', startFrame: 0, durationInFrames: 2 * fps, format: 'html-gsap', source: brollScene(process.env.NODECINE_MANUAL_CLIP!) }] }],
        beats: [{ index: 0, startFrame: 0, durationInFrames: 2 * fps, clipId: 'scene-1' }],
      },
      { codec: 'h264', quality: 'medium', fileName: 'broll.mp4' },
      () => {},
      new AbortController().signal,
    );
    console.log('rendered b-roll', out);
    expect((await stat(`${process.env.NODECINE_TMP_DIR}/${out.outputUrl.split('/').pop()}`)).size).toBeGreaterThan(20_000);
  }, 600_000);
});
