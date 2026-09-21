/**
 * The speaker, lifted off the room they were filmed in, as a clip that is clear everywhere else.
 *
 *   node matte.mjs --clip <file> --out <file.webm> --model <file.onnx> --width N --height N --fps N
 *
 * Three processes on one pipe — ffmpeg decodes to raw RGBA, this reads it a frame at a time and hands
 * each to the matting model, ffmpeg encodes what comes back — so a three-minute clip never lands on
 * disk as ten gigabytes of frames. It is one command from the server's side, which is the only way
 * this app is allowed to run a subprocess.
 *
 * The result is VP9 with alpha in WebM, because that is the one thing a browser draws transparently
 * without a line of script, and a browser is what renders every film here. Two warnings worth keeping:
 * ffprobe reports such a file as `yuv420p` with an `alpha_mode=1` tag, since VP9 carries the alpha in
 * a side stream — that is not a broken file; and ffmpeg's own decoder ignores that alpha, so a cut-out
 * can only ever be checked by opening it in a browser, never by rendering it with ffmpeg.
 *
 * Prints one JSON line on stdout when it is done: {frames, seconds, width, height}.
 */
import { spawn } from 'node:child_process';
import ort from 'onnxruntime-node';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const clip = args.get('clip'), out = args.get('out'), model = args.get('model');
const W = Number(args.get('width')), H = Number(args.get('height')), fps = Number(args.get('fps')) || 30;
const ffmpeg = args.get('ffmpeg') || 'ffmpeg';
if (!clip || !out || !model || !W || !H) {
  process.stderr.write('usage: matte.mjs --clip F --out F --model F --width N --height N [--fps N] [--ffmpeg PATH]\n');
  process.exit(2);
}

const stride = W * H * 4;
const pixels = W * H;

/**
 * Each platform's own accelerator, then the plain CPU. CoreML on a Mac is the same Neural Engine the
 * system's own person segmentation runs on; DirectML on Windows reaches any GPU, AMD and Intel too.
 */
const ACCELERATOR = { darwin: 'coreml', win32: 'dml', linux: 'cuda' };
async function open() {
  const first = ACCELERATOR[process.platform];
  for (const providers of first ? [[first], ['cpu']] : [['cpu']]) {
    try {
      const session = await ort.InferenceSession.create(model, { executionProviders: providers });
      process.stderr.write(`matting on ${providers[0]}\n`);
      return session;
    } catch (e) {
      process.stderr.write(`${providers[0]} would not load the model: ${String(e.message ?? e).split('\n')[0]}\n`);
    }
  }
  throw new Error('no execution provider would load the matting model');
}

const session = await open();
/**
 * What the model remembers between frames. This is why it holds a hair edge still where a model that
 * judges each frame alone makes it crawl — and also why it must be given a run-up: cold, it reads a
 * radiator that never moves as part of the person. A single zero starts it fresh.
 */
const fresh = () => new ort.Tensor('float32', new Float32Array(1), [1, 1, 1, 1]);
let state = [fresh(), fresh(), fresh(), fresh()];
/** The model's authors ask for a quarter at this frame size: coarse work small, edges at full size. */
const ratio = new ort.Tensor('float32', new Float32Array([0.25]), [1]);

const planes = new Float32Array(3 * pixels);
const canvas = Buffer.alloc(stride);

function cutOut(frame) {
  for (let i = 0, p = 0; i < pixels; i++, p += 4) {
    planes[i] = frame[p] / 255;
    planes[pixels + i] = frame[p + 1] / 255;
    planes[2 * pixels + i] = frame[p + 2] / 255;
  }
  return session.run({
    src: new ort.Tensor('float32', planes, [1, 3, H, W]),
    r1i: state[0], r2i: state[1], r3i: state[2], r4i: state[3],
    downsample_ratio: ratio,
  }).then((result) => {
    state = [result.r1o, result.r2o, result.r3o, result.r4o];
    const fgr = result.fgr.data, pha = result.pha.data;
    // Premultiplied, which is what VP9's alpha expects and what keeps edges from fringing.
    for (let i = 0, p = 0; i < pixels; i++, p += 4) {
      const a = pha[i];
      canvas[p] = fgr[i] * a * 255;
      canvas[p + 1] = fgr[pixels + i] * a * 255;
      canvas[p + 2] = fgr[2 * pixels + i] * a * 255;
      canvas[p + 3] = a * 255;
    }
    return canvas;
  });
}

const decode = spawn(ffmpeg, ['-v', 'error', '-i', clip,
  '-vf', `fps=${fps},scale=${W}:${H},format=rgba`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
// Listen immediately: the decoder can exit while the model is still processing its last frame.
const decoded = new Promise((done) => {
  decode.once('close', done);
  decode.once('error', () => done(-1));
});
const encode = spawn(ffmpeg, ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
  '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0', '-crf', '34',
  // A keyframe a second. A film seeks into the cut-out at every scene exactly as it does the
  // recording, and a layer that stalls while the one under it does not is worse than both stalling.
  '-g', String(fps), '-keyint_min', String(fps),
  '-speed', '8', '-deadline', 'realtime', '-an', out, '-y']);
const encoded = new Promise((done) => {
  encode.once('close', done);
  encode.once('error', () => done(-1));
});

let trouble = '';
for (const [name, child] of [['decoder', decode], ['encoder', encode]]) {
  child.stderr.on('data', (d) => { trouble += `${name}: ${d}`; });
}
const write = (buffer) => new Promise((done) => {
  if (encode.stdin.write(buffer)) done();
  else encode.stdin.once('drain', done);
});

let frames = 0;
const started = Date.now();
let held = Buffer.alloc(0);
try {
  for await (const chunk of decode.stdout) {
    held = held.length ? Buffer.concat([held, chunk]) : chunk;
    while (held.length >= stride) {
      await write(await cutOut(held.subarray(0, stride)));
      held = held.subarray(stride);
      frames++;
      if (frames % 300 === 0) process.stderr.write(`${frames} frames\n`);
    }
  }
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n${trouble}`);
  process.exit(1);
}
encode.stdin.end();
const [decodeCode, code] = await Promise.all([decoded, encoded]);
if (decodeCode !== 0 || code !== 0 || !frames || held.length) {
  process.stderr.write(`${frames} frames, decoder exited ${decodeCode}, encoder exited ${code}, ${held.length} incomplete bytes\n${trouble}`);
  process.exit(1);
}
// Let go of the model before the process ends. Left to the runtime's own teardown, onnxruntime
// throws out of a destructor ("recursive_mutex lock failed") long after the work is finished and
// printed, which would look from the outside exactly like a cut-out that failed.
await session.release().catch(() => {});
process.stdout.write(JSON.stringify({ frames, seconds: (Date.now() - started) / 1000, width: W, height: H }),
  () => process.exit(0));
