import { z } from 'zod';

/** Payload schemas for the core port types (CORE_CONTRACTS §2, §6.2, §7.1, §8.1). */

const bcp47 = z.string().min(2).max(35);

export const SourceRefSchema = z.object({
  value: z.string(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

const FactScalarSchema = z.union([z.string(), z.number(), z.null()]);
/** One thing in a list of facts: a news item, a release, a review — its own fields (CORE_CONTRACTS §2.2). */
export const FactItemSchema = z.record(z.string(), FactScalarSchema);
export const FactValueSchema = z.union([FactScalarSchema, z.array(z.string()), z.array(FactItemSchema)]);
export type FactItem = z.infer<typeof FactItemSchema>;

/**
 * Read `items.2.title` out of a fact sheet: a plain key, or a list name, an index and a field
 * (CORE_CONTRACTS §2.2). A beat over a list binds one scene to one item this way.
 */
export function readFactPath(facts: Record<string, unknown>, path: string): unknown {
  let cur: unknown = facts;
  for (const step of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const i = Number(step);
      if (!Number.isInteger(i) || i < 0 || i >= cur.length) return undefined;
      cur = cur[i];
      continue;
    }
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[step];
  }
  return cur;
}

/** The list a fact key holds, or null when that key is not a list of things. */
export function factListAt(facts: Record<string, unknown>, key: string): FactItem[] | null {
  const v = facts[key];
  return Array.isArray(v) && v.every((x) => x && typeof x === 'object' && !Array.isArray(x)) ? (v as FactItem[]) : null;
}
export const FactSheetSchema = z.object({
  facts: z.record(z.string(), FactValueSchema),
  sourceLabel: z.string(),
  fetchedAt: z.string(),
  mode: z.enum(['fetched', 'passthrough']),
});
export type FactSheet = z.infer<typeof FactSheetSchema>;

/**
 * The content vocabulary (CORE_CONTRACTS §2.11): the fixed set of things a scene can say, written by
 * the screenwriter without knowing any drawing, and read by the Illustrator when it draws the scene.
 */
/** The keys a model writes. An image is not among them: a model cannot know an uploaded asset's name. */
export const WRITTEN_KEYS = ['kicker', 'title', 'body', 'points', 'number', 'label', 'quote', 'attribution', 'code', 'source', 'entries'] as const;
/** The two a model can never fill: only a person or a fact points at a file this machine holds. */
export const CONTENT_KEYS = [...WRITTEN_KEYS, 'image', 'clip'] as const;
export type WrittenKey = (typeof WRITTEN_KEYS)[number];
export type ContentKey = (typeof CONTENT_KEYS)[number];
export const isContentKey = (k: string): k is ContentKey => (CONTENT_KEYS as readonly string[]).includes(k);

/**
 * A file a scene carries: an image uploaded through `POST /api/assets`, or a clip taken in from the
 * user's own folder through `POST /api/assets/from-library`. Either way it is addressed by its hash
 * (ARCHITECTURE §6) — a scene may only show a file this machine is already holding.
 */
const HASHED_ASSET = /^\/api\/assets\/[a-f0-9]{16,64}\.[a-z0-9]+$/;
/**
 * The one other form: a small SVG carried inline. A template is a JSON file and cannot ship a file
 * beside it, and a workflow shared with someone else loses every hashed asset it names — a drawing
 * that travels inside the graph survives both. SVG only, and small, so a graph stays a graph and not
 * a picture archive; a photograph is uploaded and hashed like before.
 */
const INLINE_SVG = /^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/;
export const INLINE_ASSET_MAX_CHARS = 64 * 1024;
export const isInlineAsset = (url: string): boolean => url.length <= INLINE_ASSET_MAX_CHARS && INLINE_SVG.test(url);
export const AssetUrlSchema = z.string().refine((s) => HASHED_ASSET.test(s) || isInlineAsset(s), 'must be an uploaded asset, or an inline SVG under 64 KB');
/** Whether a string names a file a scene may show: hashed upload or inline SVG. A var that is one is drawn as a picture. */
export const isAssetUrl = (s: string): boolean => HASHED_ASSET.test(s) || isInlineAsset(s);

const IDENT = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/** The frame a plan is drawn for: the design coordinates its code is written in (CORE_CONTRACTS §2.3). */
export const FrameSchema = z.object({ width: z.number().int().min(16).max(8192), height: z.number().int().min(16).max(8192) });
export type Frame = z.infer<typeof FrameSchema>;

/** The one scene-code format there is: an HTML fragment with inline style and an optional GSAP timeline (CORE_CONTRACTS §2.8). */
export const SCENE_FORMAT = 'html-gsap' as const;
export const SCENE_SOURCE_MAX = 200_000;

/**
 * What every scene of a video shares (CORE_CONTRACTS §2.6): a name, and one sheet of CSS — the
 * colours, the type, the classes the scenes' markup uses. Drawn by the Illustrator for the run.
 */
export const StyleSchema = z.object({
  name: z.string().min(1).max(80),
  css: z.string().max(SCENE_SOURCE_MAX),
});
export type Style = z.infer<typeof StyleSchema>;

/** How one scene gives way to the next (CORE_CONTRACTS §2.6): one kind for the whole film. */
export const TransitionSchema = z.object({ type: z.enum(['cut', 'fade', 'slide', 'zoom']), seconds: z.number().min(0.1).max(2) });
export type Transition = z.infer<typeof TransitionSchema>;

/**
 * Values of the whole video (CORE_CONTRACTS §2.6): a channel name, an episode number, and a
 * character or a logo as a picture. The same in every scene; a scene draws one with `data-var`.
 */
export const VarsSchema = z.record(z.string().regex(IDENT), z.union([z.string().max(200), AssetUrlSchema]));

/** One scene of a plan (CORE_CONTRACTS §2.3): its own drawing, complete. */
export const SceneSpecSchema = z.object({
  weight: z.number().positive(),
  /** The scene's HTML fragment: markup, `<style>`, optional `<script>` (CORE_CONTRACTS §2.8). */
  source: z.string().min(1).max(SCENE_SOURCE_MAX),
  /** fact key → element: `data-fact="<key>"` in the source takes `facts[key]` at assembly; facts always win. */
  factBindings: z.record(z.string(), z.string()).optional(),
});
export type SceneSpec = z.infer<typeof SceneSpecSchema>;

/**
 * A plan is self-contained (CORE_CONTRACTS §2.3): every scene carries its own drawing and the
 * style they share, so the assembler, the engines and a saved project need nothing registered.
 */
export const ScenePlanSchema = z.object({
  language: bcp47,
  frame: FrameSchema.default({ width: 1080, height: 1920 }),
  style: StyleSchema,
  transition: TransitionSchema.default({ type: 'fade', seconds: 0.4 }),
  vars: VarsSchema.default({}),
  scenes: z.array(SceneSpecSchema).min(1),
});
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

export const AudioScriptSchema = z.object({
  /** The whole narration; with `segments`, their join. */
  text: z.string().min(1),
  language: bcp47,
  /** The narration scene by scene, in scene order: the TTS Engine voices each one and the cut follows (CORE_CONTRACTS §2.4). */
  segments: z.array(z.string().min(1)).min(1).optional(),
});
export type AudioScript = z.infer<typeof AudioScriptSchema>;

/** The vocabulary itself, shared by a scene and by one entry inside it. */
const contentShape = {
  kicker: z.string().max(40),
  title: z.string().max(120),
  body: z.string().max(400),
  points: z.array(z.string().min(1).max(120)).max(6),
  number: z.string().max(24),
  label: z.string().max(60),
  quote: z.string().max(300),
  attribution: z.string().max(80),
  code: z.string().max(200),
  source: z.string().max(80),
  image: AssetUrlSchema,
  clip: AssetUrlSchema,
};

/**
 * One of several things a scene shows at once (CORE_CONTRACTS §2.11): the same vocabulary, one level
 * down. Two of them are a comparison, five are a ranking, three are the steps of a how-to.
 *
 * The vocabulary does not grow a noun per genre — it grows one dimension, repetition, and the
 * fifteen words it already has describe each entry. One level only: an entry holding entries is a
 * layout engine in disguise.
 */
export const EntryContentSchema = z.object(contentShape).partial().strip();
export type EntryContent = z.infer<typeof EntryContentSchema>;
/** The keys an entry may carry. */
export const ENTRY_KEYS = Object.keys(contentShape) as (keyof typeof contentShape)[];

/** What one scene says, in the content vocabulary; every key optional, a scene writes what it needs. */
export const SceneContentSchema = z
  .object({
    ...contentShape,
    /** Several things shown at once: two to compare, five to rank, three steps. */
    entries: z.array(EntryContentSchema).max(12),
  })
  .partial()
  .strip();
export type SceneContent = z.infer<typeof SceneContentSchema>;

/**
 * The scene script (CORE_CONTRACTS §2.11): the video broken into scenes with their content, before
 * any drawing instructions. Written by the Screenwriter or typed into Static Script; the Illustrator draws each
 * scene from it and emits the ScenePlan.
 */
export const SceneScriptSchema = z.object({
  language: bcp47,
  scenes: z
    .array(
      z.object({
        /** The beat this scene belongs to: hook, quote, cta. */
        role: z.string().min(1).max(40),
        weight: z.number().positive(),
        /** What is said over this scene. The scene lasts as long as its narration (CORE_CONTRACTS §5.4). */
        narration: z.string().min(1).max(600),
        content: SceneContentSchema,
        /** content key → fact key: filled from verified data at assembly, never written by the model. */
        factBindings: z.record(z.enum(CONTENT_KEYS), z.string()).optional(),
      }),
    )
    .min(1),
});
export type SceneScript = z.infer<typeof SceneScriptSchema>;

/** Media URLs are always app-relative (ARCHITECTURE §6). Never a filesystem path. */
export const MediaUrlSchema = z.string().regex(/^\/api\/media\/[a-f0-9]{16,64}\.[a-z0-9]+$/);

/** One spoken word: seconds from the start of the voice-over. */
export const WordSchema = z.object({ text: z.string().min(1), start: z.number().nonnegative(), end: z.number().nonnegative() });
export type Word = z.infer<typeof WordSchema>;

export const VoiceoverSchema = z.object({
  audioUrl: MediaUrlSchema,
  durationSeconds: z.number().positive(),
  voiceName: z.string(),
  language: bcp47,
  speed: z.number().positive(),
  /** Word timings, when a provider returned them or the Transcribe node aligned them. */
  words: z.array(WordSchema).optional(),
  /** One entry per narration segment, in order: where it starts and how long it lasts in the file, gap included. */
  segments: z.array(z.object({ start: z.number().nonnegative(), durationSeconds: z.number().positive() })).min(1).optional(),
});
export type Voiceover = z.infer<typeof VoiceoverSchema>;

/** How the spoken word is marked; read off the scene's caption slot, never carried by the track. */
export const CAPTION_STYLES = ['karaoke', 'reveal'] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];
/** Caption lines on the voice-over's clock (CORE_CONTRACTS §2.10): what is said, when. Where and how is the scene's. */
export const CaptionTrackSchema = z.object({
  cues: z.array(z.object({ start: z.number().nonnegative(), end: z.number().nonnegative(), words: z.array(WordSchema).min(1) })),
});
export type CaptionTrack = z.infer<typeof CaptionTrackSchema>;

/** One capability as reported by probe() (EXECUTION_ENGINE §1.1). */
export const CapabilitySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready') }),
  z.object({
    status: z.literal('unavailable'),
    reason: z.string(),
    fix: z.string().optional(),
    code: z.string().optional(),
  }),
]);
export type Capability = z.infer<typeof CapabilitySchema>;

export const EngineRefSchema = z.object({
  engineId: z.string().min(1),
  displayName: z.string(),
  adapterVersion: z.string(),
  capabilities: z.object({ preview: CapabilitySchema, render: CapabilitySchema }),
  settings: z.record(z.string(), z.unknown()),
});
export type EngineRef = z.infer<typeof EngineRefSchema>;

export const LLMRefSchema = z.object({
  providerId: z.string().min(1),
  displayName: z.string(),
  transport: z.enum(['cli', 'api']),
  capabilities: z.object({
    installed: CapabilitySchema,
    authenticated: CapabilitySchema,
    structuredOutput: CapabilitySchema,
    version: z.string().optional(),
  }),
  settings: z.record(z.string(), z.unknown()),
});
export type LLMRef = z.infer<typeof LLMRefSchema>;

export const VoiceSchema = z.object({ id: z.string(), displayName: z.string(), language: bcp47 });
export type Voice = z.infer<typeof VoiceSchema>;

export const TTSRefSchema = z.object({
  providerId: z.string().min(1),
  displayName: z.string(),
  transport: z.enum(['local', 'api']),
  capabilities: z.object({ installed: CapabilitySchema, encoder: CapabilitySchema }),
  voices: z.array(VoiceSchema),
  settings: z.object({ defaultVoice: z.string().optional(), rate: z.number().positive().default(1) }),
});
export type TTSRef = z.infer<typeof TTSRefSchema>;

export const PAYLOAD_SCHEMAS = {
  SourceRef: SourceRefSchema,
  FactSheet: FactSheetSchema,
  ScenePlan: ScenePlanSchema,
  AudioScript: AudioScriptSchema,
  Voiceover: VoiceoverSchema,
  EngineRef: EngineRefSchema,
  LLMRef: LLMRefSchema,
  TTSRef: TTSRefSchema,
  CaptionTrack: CaptionTrackSchema,
  SceneScript: SceneScriptSchema,
} as const;
