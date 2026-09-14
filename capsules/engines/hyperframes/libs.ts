import { allClips, type VideoIR } from '@/contracts/types/ir';

/** Which extra libraries a film's clips call for, by vendor name: lottie-web for `lottie`, three for `html-three`. */
export function libsFor(ir: Pick<VideoIR, 'tracks'>): { lottie: boolean; three: boolean } {
  const formats = new Set(allClips(ir).flatMap((c) => (c.kind === 'code' ? [c.format] : [])));
  return { lottie: formats.has('lottie'), three: formats.has('html-three') };
}

/** The sources to inline, through whatever reads a vendor file here, only for the formats the film uses. */
export async function loadLibs(ir: Pick<VideoIR, 'tracks'>, read: (name: 'lottie.js' | 'three.js') => Promise<string>): Promise<{ lottie?: string; three?: string }> {
  const need = libsFor(ir);
  const [lottie, three] = await Promise.all([need.lottie ? read('lottie.js') : undefined, need.three ? read('three.js') : undefined]);
  return { ...(lottie ? { lottie } : {}), ...(three ? { three } : {}) };
}
