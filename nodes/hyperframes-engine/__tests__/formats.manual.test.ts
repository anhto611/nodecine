import { describe, expect, it } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { renderWithProducer } from '../register.server';
import { ensureTmpDir } from '@/server/paths';
import type { VideoIR } from '@/contracts/types/ir';
import { STYLE } from '@/contracts/__tests__/scene-fixtures';

/**
 * Manual: the two formats beyond `html-gsap`, rendered for real. Enabled with
 * NODECINE_MANUAL_FORMATS=1; needs ffmpeg on the machine. A page that inlines the library and a
 * scene that draws itself each frame can both be wrong in ways no unit test sees — a library that
 * never loads, a canvas that stays black, a seek that moves nothing — so the proof is pixels: three
 * frames are pulled out of the MP4 and the picture has to change between them.
 */
const enabled = process.env.NODECINE_MANUAL_FORMATS === '1';
const run = promisify(exec);

/** A pink circle crossing the frame in two seconds, hand-written: the smallest honest Lottie file. */
const LOTTIE = JSON.stringify({
  v: '5.7.4', fr: 30, ip: 0, op: 60, w: 1080, h: 1920, nm: 'dot', ddd: 0, assets: [],
  layers: [{
    ddd: 0, ind: 1, ty: 4, nm: 'circle', sr: 1, ao: 0, ip: 0, op: 60, st: 0, bm: 0,
    ks: {
      o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] },
      p: { a: 1, k: [{ t: 0, s: [200, 960, 0], i: { x: 0.5, y: 0.5 }, o: { x: 0.5, y: 0.5 } }, { t: 60, s: [880, 960, 0] }] },
    },
    shapes: [{ ty: 'gr', nm: 'g', it: [
      { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [400, 400] } },
      { ty: 'fl', c: { a: 0, k: [1, 0.48, 0.64, 1] }, o: { a: 0, k: 100 } },
      { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
    ] }],
  }],
});

/** A cube turning on `nodecine.frame`, drawn by the three the page inlines. */
const THREE_SCENE = [
  '<canvas id="gl" style="position:absolute;inset:0;width:100%;height:100%"></canvas>',
  '<script>',
  "var canvas = root.querySelector('#gl');",
  'var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });',
  'renderer.setSize(1080, 1920, false);',
  'var scene = new THREE.Scene();',
  'var camera = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 100);',
  'camera.position.set(0, 0, 6);',
  'var cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0xff7aa2 }));',
  'scene.add(cube);',
  'scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 3));',
  'nodecine.frame(function (t) { cube.rotation.y = t * 1.6; cube.rotation.x = t * 0.7; renderer.render(scene, camera); });',
  '</script>',
].join('\n');

function filmOf(format: string, source: string): VideoIR {
  return {
    irVersion: 3,
    meta: { title: format, language: 'en', fps: 30, width: 1080, height: 1920, totalDurationInFrames: 60 },
    style: STYLE,
    tracks: [{ id: 'scenes', clips: [{ id: 'scene-1', kind: 'code', startFrame: 0, durationInFrames: 60, format, source }] }],
    beats: [{ index: 0, startFrame: 0, durationInFrames: 60, clipId: 'scene-1' }],
    audio: [],
    transitions: { default: { name: 'cut', seconds: 0.1 } },
  };
}

/**
 * One frame as an 8×8 grid of colours. A grid, not an average: a shape crossing the frame leaves the
 * average where it was, so averaging would call a moving picture still.
 */
async function frameGrid(mp4: string, seconds: number): Promise<number[]> {
  const { stdout } = await run(`ffmpeg -v error -ss ${seconds} -i "${mp4}" -frames:v 1 -vf scale=8:8 -f rawvideo -pix_fmt rgb24 -`, { encoding: 'buffer', maxBuffer: 1 << 20 });
  return [...(stdout as unknown as Buffer)];
}

/** How much light the frame carries, and how far two frames are apart, per cell. */
const brightness = (g: number[]) => g.reduce((n, v) => n + v, 0) / (g.length / 3);
const distance = (a: number[], b: number[]) => a.reduce((n, v, i) => n + Math.abs(v - (b[i] ?? 0)), 0) / (a.length / 3);

/** The same circle, but given twice the room: two seconds of animation inside a four-second clip. */
function heldFilm(): VideoIR {
  const film = filmOf('lottie', LOTTIE);
  film.meta.totalDurationInFrames = 120;
  film.tracks[0]!.clips[0]!.durationInFrames = 120;
  film.beats[0]!.durationInFrames = 120;
  return film;
}

describe.skipIf(!enabled)('the formats beyond html-gsap, rendered for real', () => {
  for (const [format, source] of [['lottie', LOTTIE], ['html-three', THREE_SCENE]] as const) {
    it(`draws ${format}: the frame is not black, and it moves`, async () => {
      const out = await renderWithProducer(filmOf(format, source), { codec: 'h264', quality: 'medium', fileName: `${format}.mp4`, resolution: '1080p' }, () => {}, new AbortController().signal);
      const mp4 = path.join(await ensureTmpDir(), path.basename(out.outputUrl));
      const [early, late] = await Promise.all([frameGrid(mp4, 0.3), frameGrid(mp4, 1.7)]);
      console.log(`${format}: ${mp4} · light ${brightness(early).toFixed(1)} → ${brightness(late).toFixed(1)} · moved ${distance(early, late).toFixed(1)}`);
      expect(brightness(early), 'the frame is black: the library never drew').toBeGreaterThan(12);
      expect(distance(early, late), 'the two frames are the same picture: the seek moves nothing').toBeGreaterThan(6);
    }, 600_000);
  }

  it('holds a Lottie that ends before its clip does, instead of going blank', async () => {
    const out = await renderWithProducer(heldFilm(), { codec: 'h264', quality: 'medium', fileName: 'lottie-held.mp4', resolution: '1080p' }, () => {}, new AbortController().signal);
    const mp4 = path.join(await ensureTmpDir(), path.basename(out.outputUrl));
    // Both of the later two are past the animation's two seconds, so they are the same held frame.
    const [start, end, after] = await Promise.all([frameGrid(mp4, 0.3), frameGrid(mp4, 2.5), frameGrid(mp4, 3.8)]);
    console.log(`lottie hold: ${mp4} · light ${brightness(end).toFixed(1)} → ${brightness(after).toFixed(1)} · drift ${distance(end, after).toFixed(1)}`);
    expect(brightness(after), 'the animation vanished once it ran out').toBeGreaterThan(12);
    expect(distance(end, after), 'the held frame is not the last frame of the animation').toBeLessThan(4);
    expect(distance(start, after), 'the animation never ran: it sits on its first frame').toBeGreaterThan(6);
  }, 600_000);
});
