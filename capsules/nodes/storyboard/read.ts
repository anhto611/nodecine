import { parseStoryboard } from '@hyperframes/core/storyboard';
import { MountSchema, StoryboardSchema, type Storyboard, type StoryboardFrame } from '@/contracts/types/storyboard';

export interface StoryboardReading {
  storyboard?: Storyboard;
  problems: string[];
  warnings: string[];
}

/** The first ```json block of a frame's prose: its block's values (an object), or its mounts (a list). */
const JSON_BLOCK = /```json\s*\n([\s\S]*?)\n```/;

/**
 * A `STORYBOARD.md` read with HyperFrames' own parser, then checked for what NodeCine needs of it:
 * every frame either spoken or given a duration, and its block's values or its mounts well formed. Problems are sentences
 * a person can act on, each naming its frame.
 */
export function readStoryboard(markdown: string): StoryboardReading {
  const manifest = parseStoryboard(markdown);
  const problems: string[] = [];
  const warnings = manifest.warnings.map((w) => (w.frameIndex ? `frame ${w.frameIndex}: ${w.message}` : w.message));
  if (!manifest.frames.length) return { problems: ['no frames: start each one with a "## Frame N — Title" heading'], warnings };

  const frames: StoryboardFrame[] = manifest.frames.map((f, i) => {
    const number = f.number ?? i + 1;
    // `- block: <name>` plays one of the workflow's blocks with the json object as its values; a frame
    // without a block lists the components it mounts instead.
    const { block, ...extra } = f.extra;
    const name = block?.trim() || undefined;
    let data: unknown = name ? {} : [];
    const raw = JSON_BLOCK.exec(f.narrative)?.[1];
    if (raw) {
      try { data = JSON.parse(raw); } catch (e) { problems.push(`frame ${number}: its json block does not parse (${e instanceof Error ? e.message : String(e)})`); }
    }
    const isObject = !!data && typeof data === 'object' && !Array.isArray(data);
    if (name && !isObject) problems.push(`frame ${number}: a frame that plays "${name}" gives its values as a json object`);
    if (!name && !Array.isArray(data)) problems.push(`frame ${number}: values go with a block (add "- block: <name>"); a frame without one lists its mounts`);
    const values = name && isObject ? data as Record<string, unknown> : {};
    const list = !name && Array.isArray(data) ? data : [];
    const parsed = list.map((m, j) => {
      const r = MountSchema.safeParse(m);
      if (!r.success) problems.push(`frame ${number}, mount ${j + 1}: ${r.error.issues.map((x) => `${x.path.join('.') || 'mount'} ${x.message}`).join('; ')}`);
      return r.success ? r.data : null;
    }).filter((m): m is NonNullable<typeof m> => !!m);
    const voiceover = f.voiceover?.trim() || undefined;
    if (!voiceover && !f.durationSeconds) problems.push(`frame ${number}: a silent frame needs a duration`);
    return { number, title: f.title ?? '', scene: f.scene, voiceover, durationSeconds: f.durationSeconds, transitionIn: f.transitionIn, block: name, values, mounts: parsed, extra };
  });

  const result = StoryboardSchema.safeParse({ format: manifest.globals.format, message: manifest.globals.message, arc: manifest.globals.arc, frames, markdown });
  if (!result.success) problems.push(...result.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`));
  return { storyboard: problems.length ? undefined : result.data, problems, warnings };
}

/** The spoken frames' lines in order: one narration segment per spoken frame. */
export const spokenLines = (storyboard: Storyboard): string[] => storyboard.frames.map((f) => f.voiceover).filter((v): v is string => !!v);
