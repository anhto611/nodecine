import { parseStoryboard } from '@hyperframes/core/storyboard';
import { MountSchema, StoryboardSchema, type Storyboard, type StoryboardFrame } from '@/contracts/types/storyboard';

export interface StoryboardReading {
  storyboard?: Storyboard;
  problems: string[];
  warnings: string[];
}

/** The first ```json block of a frame's prose: the frame's mounts, when it has any. */
const MOUNTS = /```json\s*\n([\s\S]*?)\n```/;

/**
 * A `STORYBOARD.md` read with HyperFrames' own parser, then checked for what NodeCine needs of it:
 * every frame either spoken or given a duration, and its mounts well formed. Problems are sentences
 * a person can act on, each naming its frame.
 */
export function readStoryboard(markdown: string): StoryboardReading {
  const manifest = parseStoryboard(markdown);
  const problems: string[] = [];
  const warnings = manifest.warnings.map((w) => (w.frameIndex ? `frame ${w.frameIndex}: ${w.message}` : w.message));
  if (!manifest.frames.length) return { problems: ['no frames: start each one with a "## Frame N — Title" heading'], warnings };

  const frames: StoryboardFrame[] = manifest.frames.map((f, i) => {
    const number = f.number ?? i + 1;
    let mounts: unknown = [];
    const block = MOUNTS.exec(f.narrative)?.[1];
    if (block) {
      try { mounts = JSON.parse(block); } catch (e) { problems.push(`frame ${number}: its json block does not parse (${e instanceof Error ? e.message : String(e)})`); }
    }
    const list = Array.isArray(mounts) ? mounts : [];
    if (!Array.isArray(mounts)) problems.push(`frame ${number}: the json block must be a list of mounts`);
    const parsed = list.map((m, j) => {
      const r = MountSchema.safeParse(m);
      if (!r.success) problems.push(`frame ${number}, mount ${j + 1}: ${r.error.issues.map((x) => `${x.path.join('.') || 'mount'} ${x.message}`).join('; ')}`);
      return r.success ? r.data : null;
    }).filter((m): m is NonNullable<typeof m> => !!m);
    const voiceover = f.voiceover?.trim() || undefined;
    if (!voiceover && !f.durationSeconds) problems.push(`frame ${number}: a silent frame needs a duration`);
    return { number, title: f.title ?? '', scene: f.scene, voiceover, durationSeconds: f.durationSeconds, transitionIn: f.transitionIn, mounts: parsed, extra: f.extra };
  });

  const result = StoryboardSchema.safeParse({ format: manifest.globals.format, message: manifest.globals.message, arc: manifest.globals.arc, frames, markdown });
  if (!result.success) problems.push(...result.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`));
  return { storyboard: problems.length ? undefined : result.data, problems, warnings };
}

/** The spoken frames' lines in order: one narration segment per spoken frame. */
export const spokenLines = (storyboard: Storyboard): string[] => storyboard.frames.map((f) => f.voiceover).filter((v): v is string => !!v);
