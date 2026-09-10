import { VideoIRSchema, type VideoIR } from './ir';

/**
 * The five IR invariants (CORE_CONTRACTS §3.1). Runs before an IR leaves the assembler
 * and before any adapter loads one.
 */

export type IRValidation = { ok: true } | { ok: false; violations: string[] };

export function validateIR(ir: unknown): IRValidation {
  const parsed = VideoIRSchema.safeParse(ir);
  if (!parsed.success) {
    return {
      ok: false,
      violations: parsed.error.issues.map((i) => `schema: ${i.path.join('.')} ${i.message}`),
    };
  }
  const v = parsed.data;
  const violations: string[] = [];

  if (v.timeline[0]!.startFrame !== 0) violations.push('1: timeline[0].startFrame must be 0');

  for (let i = 1; i < v.timeline.length; i++) {
    const prev = v.timeline[i - 1]!;
    const cur = v.timeline[i]!;
    const expected = prev.startFrame + prev.durationInFrames;
    if (cur.startFrame !== expected) {
      violations.push(`2: scene ${i} starts at ${cur.startFrame}, expected ${expected} (gap or overlap)`);
    }
  }

  const sum = v.timeline.reduce((a, s) => a + s.durationInFrames, 0);
  if (sum !== v.meta.totalDurationInFrames) {
    violations.push(`3: scene durations sum to ${sum}, totalDurationInFrames is ${v.meta.totalDurationInFrames}`);
  }

  // Invariant 4 is already enforced by the schema (durationInFrames positive); kept explicit for a clear message.
  v.timeline.forEach((s, i) => {
    if (s.durationInFrames <= 0) violations.push(`4: scene ${i} has 0 frames`);
  });

  // 5: an IR is self-contained — every scene carries a drawing, a fragment and not a page.
  v.timeline.forEach((s, i) => {
    if (!s.source.trim()) violations.push(`5: scene ${i} has no drawing`);
    if (/<(html|head|body)\b/i.test(s.source)) violations.push(`5: scene ${i} is a whole page, not a fragment`);
  });

  const ids = new Set<string>();
  for (const s of v.timeline) {
    if (ids.has(s.id)) violations.push(`duplicate scene id: ${s.id}`);
    ids.add(s.id);
  }

  return violations.length ? { ok: false, violations } : { ok: true };
}

export function assertValidIR(ir: unknown): asserts ir is VideoIR {
  const r = validateIR(ir);
  if (!r.ok) throw new IRInvalidError(r.violations);
}

export class IRInvalidError extends Error {
  readonly code = 'IR_INVALID';
  constructor(public readonly violations: string[]) {
    super(`IR_INVALID: ${violations.join('; ')}`);
  }
}
