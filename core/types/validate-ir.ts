import { ErrorCode } from '../errors';
import { VideoIRSchema, allClips, type VideoIR } from './ir';
import { IR_V2_VERSION, VideoIRV2Schema, type VideoIRV2 } from './ir-v2';

/**
 * The nine IR invariants (docs/IR_V3.md §6). Run before an IR leaves the assembler and before any
 * adapter loads one; an IR that fails never leaves the node. Warnings are things that are legal
 * but pointless — an empty track — and never stop a film. Nothing here reads a clip's `format` or a
 * transition's name: whether the connected engine has them is the output node's question.
 */

export type IRValidation = { ok: true; warnings: string[] } | { ok: false; violations: string[]; warnings: string[] };

export function validateIR(ir: unknown): IRValidation {
  // Asked first and on its own: an IR saved by an older build is a different failure from a
  // malformed one, and "expected literal 3" is not a sentence anyone can act on. A version-2 IR
  // reaching this far is a reader that forgot to call `migrateIR`.
  const version = (ir as { irVersion?: unknown } | null | undefined)?.irVersion;
  if (version !== undefined && version !== VideoIRSchema.shape.irVersion.value) {
    return { ok: false, violations: [`${ErrorCode.IR_VERSION_UNSUPPORTED}: this video plan is version ${String(version)}, this build reads version ${VideoIRSchema.shape.irVersion.value}`], warnings: [] };
  }
  const parsed = VideoIRSchema.safeParse(ir);
  if (!parsed.success) {
    return { ok: false, violations: parsed.error.issues.map((i) => `schema: ${i.path.join('.')} ${i.message}`), warnings: [] };
  }
  const v = parsed.data;
  const violations: string[] = [];
  const warnings: string[] = [];
  const total = v.meta.totalDurationInFrames;
  const clips = allClips(v);
  const endOf = (x: { startFrame: number; durationInFrames: number }) => x.startFrame + x.durationInFrames;

  // 1: something to show.
  if (clips.length === 0) violations.push('1: no clip on any track');

  // 9: one id, one thing — checked early so later messages can trust the names they print.
  const owners = new Map<string, string>();
  const claim = (id: string, what: string) => {
    const prev = owners.get(id);
    if (prev) violations.push(`9: id "${id}" is both ${prev} and ${what}`);
    else owners.set(id, what);
  };
  for (const t of v.tracks) claim(t.id, 'a track');
  for (const c of clips) claim(c.id, 'a clip');
  for (const a of v.audio) claim(a.id, 'an audio track');

  // 2: within a track, clips in order and apart. Gaps are fine; a track need not cover the film.
  for (const t of v.tracks) {
    if (t.clips.length === 0) warnings.push(`track "${t.id}" is empty`);
    for (let i = 1; i < t.clips.length; i++) {
      const a = t.clips[i - 1]!;
      const b = t.clips[i]!;
      if (b.startFrame < a.startFrame) violations.push(`2: track "${t.id}": clip "${b.id}" starts before "${a.id}"`);
      else if (b.startFrame < endOf(a)) violations.push(`2: track "${t.id}": clips "${a.id}" and "${b.id}" overlap`);
    }
  }

  // 3: nothing outlasts the film.
  for (const c of clips) if (endOf(c) > total) violations.push(`3: clip "${c.id}" ends at ${endOf(c)}, past the film's ${total}`);
  for (const a of v.audio) if (endOf(a) > total) violations.push(`3: audio "${a.id}" ends at ${endOf(a)}, past the film's ${total}`);

  // 4: the beats are the film's spine — contiguous from 0, adding up to the whole.
  if (v.beats[0]!.startFrame !== 0) violations.push('4: beats[0].startFrame must be 0');
  for (let i = 1; i < v.beats.length; i++) {
    const expected = endOf(v.beats[i - 1]!);
    if (v.beats[i]!.startFrame !== expected) violations.push(`4: beat ${i} starts at ${v.beats[i]!.startFrame}, expected ${expected} (gap or overlap)`);
  }
  const sum = v.beats.reduce((n, b) => n + b.durationInFrames, 0);
  if (sum !== total) violations.push(`4: beats sum to ${sum}, totalDurationInFrames is ${total}`);

  // 5: every beat is drawn by a code clip that covers it.
  const clipById = new Map(clips.map((c) => [c.id, c] as const));
  for (const b of v.beats) {
    const c = clipById.get(b.clipId);
    if (!c) violations.push(`5: beat ${b.index} names clip "${b.clipId}", which does not exist`);
    else if (c.kind !== 'code') violations.push(`5: beat ${b.index} names "${b.clipId}", a media clip; a beat is drawn by a code clip`);
    else if (b.startFrame < c.startFrame || endOf(b) > endOf(c)) violations.push(`5: beat ${b.index} runs outside its clip "${c.id}"`);
  }

  // 6: self-contained fragments.
  for (const c of clips) {
    if (c.kind !== 'code') continue;
    if (!c.source.trim()) violations.push(`6: clip "${c.id}" has no drawing`);
    if (/<(html|head|body)\b/i.test(c.source)) violations.push(`6: clip "${c.id}" is a whole page, not a fragment`);
  }

  // 7: one voice at most, and captions belong to it.
  const voices = v.audio.filter((a) => a.role === 'voice');
  if (voices.length > 1) violations.push(`7: ${voices.length} voice tracks; at most one`);
  if (v.captions && voices.length === 0) violations.push('7: captions without a voice track to belong to');
  for (const cue of v.captions?.cues ?? []) if (endOf(cue) > total) violations.push(`7: a caption line ends at ${endOf(cue)}, past the film's ${total}`);

  // 8: references point at things that exist.
  const audioIds = new Set(v.audio.map((a) => a.id));
  for (const a of v.audio) {
    if (!a.duck) continue;
    if (a.duck.by === a.id) violations.push(`8: audio "${a.id}" ducks by itself`);
    else if (!audioIds.has(a.duck.by)) violations.push(`8: audio "${a.id}" ducks by "${a.duck.by}", which does not exist`);
  }
  const beatClipIds = new Set(v.beats.map((b) => b.clipId));
  for (const t of v.transitions.at ?? []) if (!beatClipIds.has(t.afterClipId)) violations.push(`8: a transition after "${t.afterClipId}", which is not a beat clip`);

  return violations.length ? { ok: false, violations, warnings } : { ok: true, warnings };
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

// ---------- version 2, for what the migration reads ----------

/** The five invariants of version 2. Only a version-2 IR on its way through `migrateIR` is checked against these. */
export type IRValidationV2 = { ok: true } | { ok: false; violations: string[] };

export function validateIRV2(ir: unknown): IRValidationV2 {
  const version = (ir as { irVersion?: unknown } | null | undefined)?.irVersion;
  if (version !== undefined && version !== IR_V2_VERSION) {
    return { ok: false, violations: [`${ErrorCode.IR_VERSION_UNSUPPORTED}: this video plan is version ${String(version)}, not ${IR_V2_VERSION}`] };
  }
  const parsed = VideoIRV2Schema.safeParse(ir);
  if (!parsed.success) return { ok: false, violations: parsed.error.issues.map((i) => `schema: ${i.path.join('.')} ${i.message}`) };
  const v = parsed.data;
  const violations: string[] = [];
  if (v.timeline[0]!.startFrame !== 0) violations.push('1: timeline[0].startFrame must be 0');
  for (let i = 1; i < v.timeline.length; i++) {
    const prev = v.timeline[i - 1]!;
    const cur = v.timeline[i]!;
    const expected = prev.startFrame + prev.durationInFrames;
    if (cur.startFrame !== expected) violations.push(`2: scene ${i} starts at ${cur.startFrame}, expected ${expected} (gap or overlap)`);
  }
  const sum = v.timeline.reduce((a, s) => a + s.durationInFrames, 0);
  if (sum !== v.meta.totalDurationInFrames) violations.push(`3: scene durations sum to ${sum}, totalDurationInFrames is ${v.meta.totalDurationInFrames}`);
  v.timeline.forEach((s, i) => {
    if (s.durationInFrames <= 0) violations.push(`4: scene ${i} has 0 frames`);
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

export function assertValidIRV2(ir: unknown): asserts ir is VideoIRV2 {
  const r = validateIRV2(ir);
  if (!r.ok) throw new IRInvalidError(r.violations);
}
