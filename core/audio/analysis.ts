/**
 * Per-frame loudness and three bands of a sound, for clips that move to the music (docs/IR_V3.md
 * §5.3, `analysisUrl`). Pure: samples in, one row per video frame out, every value 0..1 against
 * the file's own peak so a quiet track still moves. The Audio Analysis node decodes the file and
 * writes what this returns as JSON beside the media; the engines inline it and a scene reads it as
 * `nodecine.audio(id)`.
 */

export const ANALYSIS_BANDS = ['level', 'bass', 'mid', 'high'] as const;
export type AnalysisBand = (typeof ANALYSIS_BANDS)[number];

export interface AudioAnalysis {
  version: 1;
  fps: number;
  sampleRate: number;
  bands: readonly AnalysisBand[];
  /** One row per video frame, in band order. */
  frames: number[][];
}

/** Band edges in Hz: bass is the kick and the bass line, mid the voice and the chords, high the hats and the air. */
const EDGES = { bass: [20, 250], mid: [250, 2000], high: [2000, 8000] } as const;
const FFT_SIZE = 512;

/** Mono samples in [-1, 1] → analysis at `fps`. A window per frame, `FFT_SIZE` samples around its centre. */
export function analyzeSamples(samples: Float32Array, sampleRate: number, fps: number): AudioAnalysis {
  if (!(sampleRate > 0) || !(fps > 0)) throw new Error('sampleRate and fps must be positive');
  const frameCount = Math.max(1, Math.ceil((samples.length / sampleRate) * fps));
  const hop = sampleRate / fps;
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const window = hann(FFT_SIZE);
  const binHz = sampleRate / FFT_SIZE;
  const raw: number[][] = [];
  for (let f = 0; f < frameCount; f++) {
    const centre = Math.floor(f * hop + hop / 2);
    let energy = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const s = samples[centre - FFT_SIZE / 2 + i] ?? 0;
      re[i] = s * window[i]!;
      im[i] = 0;
      energy += s * s;
    }
    fft(re, im);
    const band = (lo: number, hi: number) => {
      let sum = 0;
      const from = Math.max(1, Math.floor(lo / binHz));
      const to = Math.min(FFT_SIZE / 2 - 1, Math.ceil(hi / binHz));
      for (let k = from; k <= to; k++) sum += re[k]! * re[k]! + im[k]! * im[k]!;
      return Math.sqrt(sum / Math.max(1, to - from + 1));
    };
    raw.push([Math.sqrt(energy / FFT_SIZE), band(...EDGES.bass), band(...EDGES.mid), band(...EDGES.high)]);
  }
  // Against the file's own peak per band, so a whisper of a track and a wall of sound both reach 1.
  const peaks = ANALYSIS_BANDS.map((_, b) => raw.reduce((m, row) => Math.max(m, row[b]!), 0) || 1);
  const frames = raw.map((row) => row.map((v, b) => Math.round((v / peaks[b]!) * 1000) / 1000));
  return { version: 1, fps, sampleRate, bands: ANALYSIS_BANDS, frames };
}

/** Signed 16-bit little-endian mono, as ffmpeg writes with `-f s16le -ac 1`. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength - (bytes.byteLength % 2));
  const out = new Float32Array(view.byteLength / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/** In-place radix-2 Cooley–Tukey; `re.length` must be a power of two. */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]!;
        const ui = im[i + k]!;
        const vr = re[i + k + len / 2]! * cr - im[i + k + len / 2]! * ci;
        const vi = re[i + k + len / 2]! * ci + im[i + k + len / 2]! * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}
