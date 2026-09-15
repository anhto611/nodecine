import { z } from 'zod';
import { cueSaid, cueWord } from '@/contracts/storyboard/validate';

/**
 * What the model writes: a storyboard as JSON, one frame per scene, each playing a block of the
 * workflow with the values it declares. The node turns it into HyperFrames' STORYBOARD.md and reads
 * that back, so a written storyboard and a typed one are the same thing downstream.
 */

export const TRANSITIONS = ['cut', 'crossfade', 'blur-crossfade'] as const;

/** A component mounted over a scene's block: in a named slot, from one word to another. */
export const WrittenMountSchema = z.object({
  component: z.string().min(1).max(41),
  slot: z.string().min(1).max(40),
  at: z.string().max(80).nullable().default(null),
  until: z.string().max(80).nullable().default(null),
  values: z.record(z.string(), z.unknown()).default({}),
});
export type WrittenMount = z.infer<typeof WrittenMountSchema>;

export const WrittenFrameSchema = z.object({
  title: z.string().min(1).max(80),
  voiceover: z.string().max(600).nullable().default(null),
  duration_seconds: z.number().positive().max(30).nullable().default(null),
  transition_in: z.enum(TRANSITIONS).default('cut'),
  block: z.string().min(1).max(41),
  values: z.record(z.string(), z.unknown()).default({}),
  mounts: z.array(WrittenMountSchema).max(4).default([]),
});
export type WrittenFrame = z.infer<typeof WrittenFrameSchema>;

/** A layer as the model writes it: an overlay block over scenes `from_frame` to `to_frame`, numbered from 1. */
export const WrittenLayerSchema = z.object({
  title: z.string().min(1).max(80),
  block: z.string().min(1).max(41),
  from_frame: z.number().int().positive(),
  to_frame: z.number().int().positive(),
  start: z.string().max(80).nullable().default(null),
  end: z.string().max(80).nullable().default(null),
  values: z.record(z.string(), z.unknown()).default({}),
});
export type WrittenLayer = z.infer<typeof WrittenLayerSchema>;

export const WrittenStoryboardSchema = z.object({
  language: z.string().min(2).max(35),
  /** The product or subject, as the model understood it from the description, the page and the pictures. */
  subject: z.string().max(120).default(''),
  message: z.string().max(300).default(''),
  frames: z.array(WrittenFrameSchema).min(2).max(16),
  layers: z.array(WrittenLayerSchema).max(6).default([]),
});
export type WrittenStoryboard = z.infer<typeof WrittenStoryboardSchema>;

/**
 * A list or an object the model wrote as a JSON string ("effects": "[{…}]") read back into a list:
 * its moments are checked and timed only when they are real values, not text.
 */
export function unwrapJson(written: WrittenStoryboard): WrittenStoryboard {
  const unwrap = (value: unknown): unknown => {
    if (typeof value !== 'string' || !/^\s*[[{]/.test(value)) return value;
    try { return JSON.parse(value); } catch { return value; }
  };
  const each = (values: Record<string, unknown>) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, unwrap(v)]));
  return { ...written, frames: written.frames.map((f) => ({ ...f, values: each(f.values), mounts: (f.mounts ?? []).map((m) => ({ ...m, values: each(m.values) })) })), layers: (written.layers ?? []).map((l) => ({ ...l, values: each(l.values) })) };
}

/**
 * The storyboard with its subject renamed wherever it is written: in what is said, in every text value
 * and in the scene titles. A product's name appears in several scenes; a person corrects it once.
 */
export function renameEverywhere(written: WrittenStoryboard, from: string, to: string): WrittenStoryboard {
  if (!from.trim() || from === to) return written;
  const pattern = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  // A moment still said after the rename stays; one on a word of the old name moves to the matching word of the new one.
  const oldWords = from.trim().split(/\s+/), newWords = to.trim().split(/\s+/);
  const cue = (part: string, narration: string) => {
    const word = part.trim().replace(/^@/, '');
    if (!word || cueSaid(part.trim(), narration)) return part;
    const first = cueWord(word.split(/\s+/)[0]!);
    const at = oldWords.findIndex((w) => cueWord(w).startsWith(first));
    return at < 0 ? part : `@${newWords[Math.min(at, newWords.length - 1)]}`;
  };
  const swap = (value: unknown, narration: string): unknown => {
    if (typeof value === 'string' && value.trim().startsWith('@')) return value.split(',').map((part) => cue(part, narration)).join(',');
    if (typeof value === 'string') return value.replace(pattern, to);
    if (Array.isArray(value)) return value.map((v) => swap(v, narration));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swap(v, narration)]));
    return value;
  };
  return {
    ...written,
    subject: to,
    message: written.message.replace(pattern, to),
    frames: written.frames.map((f) => {
      const voiceover = f.voiceover === null ? null : f.voiceover.replace(pattern, to);
      return { ...f, title: f.title.replace(pattern, to), voiceover, values: swap(f.values, voiceover ?? '') as Record<string, unknown>, mounts: (f.mounts ?? []).map((m) => ({ ...m, values: swap(m.values, voiceover ?? '') as Record<string, unknown> })) };
    }),
    layers: (written.layers ?? []).map((l) => {
      const narration = written.frames.slice(l.from_frame - 1, l.to_frame).map((f) => (f.voiceover ?? '').replace(pattern, to)).join(' ');
      return { ...l, title: l.title.replace(pattern, to), values: swap(l.values, narration) as Record<string, unknown> };
    }),
  };
}

/** What a person changed on one scene by hand; kept apart from what the model wrote. */
export const FrameEditSchema = z.object({
  title: z.string().max(80).optional(),
  voiceover: z.string().max(600).optional(),
  values: z.record(z.string(), z.unknown()).optional(),
});
export type FrameEdit = z.infer<typeof FrameEditSchema>;

/** The key a person's edit of a layer is kept under, beside the scenes' `0`, `1`…. */
export const layerEditKey = (index: number) => `layer-${index}`;

/** The written storyboard with a person's edits laid over it, scene by scene and layer by layer. */
export function applyEdits(written: WrittenStoryboard, edits: Record<string, FrameEdit>): WrittenStoryboard {
  return {
    ...written,
    layers: (written.layers ?? []).map((layer, i) => {
      const edit = edits[layerEditKey(i)];
      return edit ? { ...layer, ...(edit.title !== undefined ? { title: edit.title } : {}), values: { ...layer.values, ...(edit.values ?? {}) } } : layer;
    }),
    frames: written.frames.map((frame, i) => {
      const edit = edits[String(i)];
      if (!edit) return frame;
      return {
        ...frame,
        ...(edit.title !== undefined ? { title: edit.title } : {}),
        ...(edit.voiceover !== undefined ? { voiceover: edit.voiceover } : {}),
        values: { ...frame.values, ...(edit.values ?? {}) },
      };
    }),
  };
}

// A quote inside the storyboard's quoted voiceover would end it early: typographic quotes read the same aloud.
const quoted = (text: string) => `"${text.replace(/"/g, '”').replace(/\s+/g, ' ').trim()}"`;
const line = (text: string) => text.replace(/\s+/g, ' ').trim();

/** HyperFrames' STORYBOARD.md for a written storyboard. */
export function toMarkdown(written: WrittenStoryboard, globals: { format: string }): string {
  const head = ['---', `format: ${globals.format}`, ...(written.subject ? [`subject: ${line(written.subject)}`] : []), ...(written.message ? [`message: ${line(written.message)}`] : []), '---', ''];
  const frames = written.frames.map((frame, i) => [
    `## Frame ${i + 1} — ${line(frame.title)}`,
    ...(frame.voiceover?.trim() ? [`- voiceover: ${quoted(frame.voiceover)}`] : []),
    ...(!frame.voiceover?.trim() && frame.duration_seconds ? [`- duration: ${frame.duration_seconds}s`] : []),
    `- transition_in: ${frame.transition_in}`,
    `- block: ${frame.block}`,
    '',
    '```json',
    JSON.stringify(frame.values, null, 2),
    '```',
    '',
    // The components over the block: a second json block, in the storyboard's own mount shape.
    ...((frame.mounts ?? []).length ? ['```json', JSON.stringify((frame.mounts ?? []).map((m) => ({ component: m.component, box: m.slot, ...(m.at?.trim() ? { at: m.at.trim() } : {}), ...(m.until?.trim() ? { until: m.until.trim() } : {}), values: m.values })), null, 2), '```', ''] : []),
  ].join('\n'));
  const layers = (written.layers ?? []).length ? ['## Layers', '', ...(written.layers ?? []).map((layer, i) => [
    `### Layer ${i + 1} — ${line(layer.title)}`,
    `- block: ${layer.block}`,
    `- frames: ${layer.from_frame}-${layer.to_frame}`,
    ...(layer.start?.trim() ? [`- start: ${line(layer.start)}`] : []),
    ...(layer.end?.trim() ? [`- end: ${line(layer.end)}`] : []),
    '',
    '```json',
    JSON.stringify(layer.values, null, 2),
    '```',
    '',
  ].join('\n'))] : [];
  return [...head, ...frames, ...layers].join('\n');
}
