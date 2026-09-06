/**
 * Weight-based frame allocation (CORE_CONTRACTS §5.4).
 * Deterministic: every scene except the last gets floor(total × w / Σw); the last takes the remainder.
 */

export function computeTotalFrames(
  durationSeconds: number,
  fps: number,
  minTotalFrames: number,
): { total: number; audioFrames: number; padTailFrames: number } {
  if (!(durationSeconds > 0)) throw new Error('durationSeconds must be positive');
  if (!Number.isInteger(fps) || fps <= 0) throw new Error('fps must be a positive integer');
  const audioFrames = Math.ceil(durationSeconds * fps);
  const total = Math.max(audioFrames, minTotalFrames);
  return { total, audioFrames, padTailFrames: total - audioFrames };
}

export function allocateFrames(total: number, weights: number[]): number[] {
  if (!Number.isInteger(total) || total <= 0) throw new Error('total must be a positive integer');
  if (weights.length === 0) throw new Error('at least one scene is required');
  if (weights.some((w) => !(w > 0))) throw new Error('every weight must be positive');
  if (total < weights.length) throw new Error(`${total} frames cannot cover ${weights.length} scenes`);

  const sum = weights.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let used = 0;
  for (let i = 0; i < weights.length - 1; i++) {
    const frames = Math.floor((total * (weights[i] as number)) / sum);
    out.push(frames);
    used += frames;
  }
  out.push(total - used);

  // IR invariant 4: no scene may be zero frames. With very skewed weights and a small total,
  // floor can yield 0; borrow one frame from the last scene (which always holds the remainder)
  // so the total is preserved.
  for (let i = 0; i < out.length - 1; i++) {
    if ((out[i] as number) === 0) {
      out[i] = 1;
      out[out.length - 1] = (out[out.length - 1] as number) - 1;
    }
  }
  if ((out[out.length - 1] as number) <= 0) throw new Error('cannot allocate: last scene would get 0 frames');
  return out;
}
