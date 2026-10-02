import { parseStoryboard } from '@hyperframes/core/storyboard';
import { CueSchema, MountSchema, StoryboardLayerSchema, StoryboardSchema, type Storyboard, type StoryboardFrame, type StoryboardLayer } from '@/contracts/types/storyboard';

export interface StoryboardReading {
  storyboard?: Storyboard;
  problems: string[];
  warnings: string[];
}

/** Where NodeCine's layers start, after the frames, and each layer's own heading. */
const LAYERS_HEADING = /^## Layers[ \t]*$/m;
const LAYER_HEADING = /^### Layer[ \t]+(\d+)[ \t]*(?:[—–-][ \t]*(.*))?$/gm;

/** A cue as written: seconds, or `@word`. */
const cueOf = (raw: string | undefined) => {
  const text = raw?.trim();
  if (!text) return undefined;
  const n = Number(text.replace(/s$/, ''));
  return CueSchema.parse(Number.isFinite(n) && /^[\d.]+s?$/.test(text) ? n : text);
};

/**
 * The layers under `## Layers`, each `### Layer N — Title` with `- block:`, `- frames: 2-4`, and
 * optionally `- start: @word`, `- end: @word`, `- track: 3`, then a ```json block of its values.
 */
function readLayers(text: string, problems: string[]): StoryboardLayer[] {
  const heads = [...text.matchAll(LAYER_HEADING)];
  return heads
    .map((head, i) => {
      const body = text.slice(head.index! + head[0].length, heads[i + 1]?.index ?? text.length);
      const number = Number(head[1]);
      const where = `layer ${number}`;
      const fields: Record<string, string> = {};
      for (const m of body.matchAll(/^-[ \t]*([a-z_]+)[ \t]*:[ \t]*(.*)$/gm)) fields[m[1]!] = m[2]!.trim();
      const range = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(fields.frames ?? '');
      if (!range) problems.push(`${where}: say the frames it runs over, like "- frames: 2-4"`);
      let values: unknown = {};
      const raw = JSON_BLOCK.exec(body)?.[1];
      if (raw) {
        try {
          values = JSON.parse(raw);
        } catch (e) {
          problems.push(`${where}: its json block does not parse (${e instanceof Error ? e.message : String(e)})`);
        }
      }
      if (!values || typeof values !== 'object' || Array.isArray(values)) {
        problems.push(`${where}: its values are a json object`);
        values = {};
      }
      const candidate = {
        number,
        title: head[2]?.trim() ?? '',
        block: fields.block,
        from: Number(range?.[1] ?? 0),
        to: Number(range?.[2] ?? range?.[1] ?? 0),
        ...(fields.start ? { start: cueOf(fields.start) } : {}),
        ...(fields.end ? { end: cueOf(fields.end) } : {}),
        ...(fields.track ? { track: Number(fields.track) } : {}),
        values,
      };
      const parsed = StoryboardLayerSchema.safeParse(candidate);
      if (!parsed.success) {
        if (range) problems.push(...parsed.error.issues.map((x) => `${where}: ${x.path.join('.') || 'layer'} ${x.message}`));
        return null;
      }
      return parsed.data;
    })
    .filter((l): l is StoryboardLayer => !!l);
}
/** The first ```json block of a frame's prose: its block's values (an object), or its mounts (a list). */
const JSON_BLOCK = /```json\s*\n([\s\S]*?)\n```/;
const JSON_BLOCKS = /```json\s*\n([\s\S]*?)\n```/g;

/**
 * A `STORYBOARD.md` read with HyperFrames' own parser, then checked for what NodeCine needs of it:
 * every frame either spoken or given a duration, and its block's values or its mounts well formed. Problems are sentences
 * a person can act on, each naming its frame.
 */
export function readStoryboard(markdown: string): StoryboardReading {
  // Layers are NodeCine's, after the frames: HyperFrames' parser reads only what comes before them.
  const split = LAYERS_HEADING.exec(markdown);
  const manifest = parseStoryboard(split ? markdown.slice(0, split.index) : markdown);
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
    // A frame that plays a block may mount components over it too: a second json block, a list.
    const blocks = [...f.narrative.matchAll(JSON_BLOCKS)].map((m) => m[1]!);
    const parse = (raw: string): unknown => {
      try {
        return JSON.parse(raw);
      } catch (e) {
        problems.push(`frame ${number}: its json block does not parse (${e instanceof Error ? e.message : String(e)})`);
        return undefined;
      }
    };
    const raw = blocks[0];
    if (raw) data = parse(raw) ?? data;
    const extraMounts = name && blocks[1] ? parse(blocks[1]) : undefined;
    if (extraMounts !== undefined && !Array.isArray(extraMounts)) problems.push(`frame ${number}: its second json block lists the components it mounts`);
    const isObject = !!data && typeof data === 'object' && !Array.isArray(data);
    if (name && !isObject) problems.push(`frame ${number}: a frame that plays "${name}" gives its values as a json object`);
    if (!name && !Array.isArray(data)) problems.push(`frame ${number}: values go with a block (add "- block: <name>"); a frame without one lists its mounts`);
    const values = name && isObject ? (data as Record<string, unknown>) : {};
    const list = !name && Array.isArray(data) ? data : Array.isArray(extraMounts) ? extraMounts : [];
    const parsed = list
      .map((m, j) => {
        const r = MountSchema.safeParse(m);
        if (!r.success) problems.push(`frame ${number}, mount ${j + 1}: ${r.error.issues.map((x) => `${x.path.join('.') || 'mount'} ${x.message}`).join('; ')}`);
        return r.success ? r.data : null;
      })
      .filter((m): m is NonNullable<typeof m> => !!m);
    const voiceover = f.voiceover?.trim() || undefined;
    if (!voiceover && !f.durationSeconds) problems.push(`frame ${number}: a silent frame needs a duration`);
    return { number, title: f.title ?? '', scene: f.scene, voiceover, durationSeconds: f.durationSeconds, transitionIn: f.transitionIn, block: name, values, mounts: parsed, extra };
  });

  const layers = split ? readLayers(markdown.slice(split.index + split[0].length), problems) : [];
  const result = StoryboardSchema.safeParse({
    format: manifest.globals.format,
    ...(manifest.globals.extra.subject ? { subject: manifest.globals.extra.subject } : {}),
    message: manifest.globals.message,
    arc: manifest.globals.arc,
    frames,
    layers,
    markdown,
  });
  if (!result.success) problems.push(...result.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`));
  return { storyboard: problems.length ? undefined : result.data, problems, warnings };
}

/** The spoken frames' lines in order: one narration segment per spoken frame. */
export const spokenLines = (storyboard: Storyboard): string[] => storyboard.frames.map((f) => f.voiceover).filter((v): v is string => !!v);
