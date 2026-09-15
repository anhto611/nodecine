import type { Storyboard } from '@/contracts/types/storyboard';
import { ASSETS_DIR } from '@/contracts/types/assets';
import { checkBlockValues, type BlockInfo, type BlockRole } from './blocks';

/**
 * What is wrong with a storyboard before anything is voiced: the rules the Assemble node holds a
 * storyboard to, checked on its words alone, and the shape a film needs. Each problem is one sentence
 * naming its frame, written to be handed back to the model that wrote the storyboard.
 */

export interface StoryboardRules {
  catalog: BlockInfo[];
  /** The project paths of the pictures there are: `assets/<name>.<ext>`. */
  assets: string[];
  /** How long the film should run, when a brief says. */
  targetSeconds?: number;
  /** How fast the narration is read, to estimate its length. */
  wordsPerSecond?: number;
  /** The roles the first and the last scene must play, when the workflow's guide says. */
  first?: BlockRole;
  last?: BlockRole;
  /** How many scenes in a row may play the same block, when the workflow's guide says. */
  repeat?: number;
}

/** Words compared the way cues are matched: case and trailing punctuation aside. */
export const cueWord = (s: string) => s.normalize('NFC').toLowerCase().replace(/[.,:;!?"'“”‘’()…]+$/g, '').replace(/^[("'“‘]+/g, '');

/** Whether `@word` (or `@two words`) is said in a narration. */
export function cueSaid(cue: string, narration: string): boolean {
  const words = narration.split(/\s+/).filter(Boolean).map(cueWord);
  const wanted = cue.replace(/^@/, '').trim().split(/\s+/).map(cueWord);
  return words.some((_, i) => wanted.every((w, j) => words[i + j] !== undefined && words[i + j]!.startsWith(w)));
}

/** A frame's values with every cue replaced by a number, and the cues that are not said. */
function cuesToNumbers(value: unknown, narration: string, where: string, unsaid: string[]): unknown {
  if (Array.isArray(value)) return value.map((v, i) => cuesToNumbers(v, narration, `${where}[${i}]`, unsaid));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cuesToNumbers(v, narration, where ? `${where}.${k}` : k, unsaid)]));
  if (typeof value !== 'string' || !value.trim().startsWith('@')) return value;
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) if (!cueSaid(part, narration)) unsaid.push(`${where}: "${part.slice(1)}" is not said in this frame`);
  return parts.length > 1 ? parts.map(() => 0).join(',') : 0;
}

function assetPaths(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => assetPaths(v, found));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => assetPaths(v, found));
  else if (typeof value === 'string' && value.startsWith(ASSETS_DIR)) found.push(value);
  return found;
}

export function storyboardProblems(storyboard: Storyboard, rules: StoryboardRules): string[] {
  const problems: string[] = [];
  const byName = new Map(rules.catalog.map((b) => [b.name, b]));
  const frames = storyboard.frames;

  frames.forEach((frame, i) => {
    const where = `frame ${frame.number}`;
    if (!frame.voiceover && !frame.durationSeconds) problems.push(`${where}: a silent frame needs a duration`);
    if (!frame.block) {
      problems.push(`${where}: it plays no block (choose one of ${rules.catalog.map((b) => b.name).join(', ')})`);
      return;
    }
    const block = byName.get(frame.block);
    const label = `${where}, ${frame.block}`;
    if (!block) {
      problems.push(`${where}: there is no block ${frame.block} (there are ${rules.catalog.map((b) => b.name).join(', ')})`);
      return;
    }
    for (const path of assetPaths(frame.values)) {
      if (!rules.assets.includes(path)) problems.push(`${label}: no asset ${path} (${rules.assets.length ? `there are ${rules.assets.join(', ')}` : 'there are no pictures'})`);
    }
    const unsaid: string[] = [];
    const values = cuesToNumbers(frame.values, frame.voiceover ?? '', '', unsaid) as Record<string, unknown>;
    problems.push(...unsaid.map((u) => `${label}, ${u}`));
    const declared = block.variables.filter((v) => v.id !== 'seconds');
    problems.push(...checkBlockValues(label, values, declared).problems);
    if (i === 0 && rules.first && block.role !== rules.first) problems.push(`${where}: the first frame must play a ${rules.first} block (it plays ${block.name}, a ${block.role} block)`);
    if (i === frames.length - 1 && rules.last && block.role !== rules.last) problems.push(`${where}: the last frame must play a ${rules.last} block (it plays ${block.name}, a ${block.role} block)`);
  });

  if (rules.repeat) {
    let run = 1;
    frames.forEach((frame, i) => {
      run = i > 0 && frame.block && frame.block === frames[i - 1]!.block ? run + 1 : 1;
      if (run === rules.repeat! + 1) problems.push(`frame ${frame.number}: ${frame.block} plays ${run} scenes in a row, at most ${rules.repeat} may: tell this scene with another block`);
    });
  }

  if (rules.targetSeconds) {
    const rate = rules.wordsPerSecond ?? 2.8;
    const words = frames.reduce((n, f) => n + (f.voiceover ?? '').split(/\s+/).filter(Boolean).length, 0);
    const silent = frames.reduce((n, f) => n + (f.voiceover ? 0 : f.durationSeconds ?? 0), 0);
    const estimate = words / rate + silent;
    const low = rules.targetSeconds * 0.8, high = rules.targetSeconds * 1.2;
    if (estimate < low || estimate > high) {
      problems.push(`the film runs about ${Math.round(estimate)} s (${words} words at ${rate} a second${silent ? ` and ${Math.round(silent)} s of silent frames` : ''}); it should run ${rules.targetSeconds} s, within ${Math.round(low)}–${Math.round(high)} s: ${estimate > high ? 'say less' : 'say more'}`);
    }
  }
  return problems;
}
