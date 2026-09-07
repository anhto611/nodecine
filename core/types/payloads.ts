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
 * the screenwriter without knowing any block, and consumed by the Art Director when it casts a block for the
 * scene. A block prop names the key that fills it (`content`), or is filled by the key of its own name.
 */
/** The keys a model writes. An image is not among them: a model cannot know an uploaded asset's name. */
export const WRITTEN_KEYS = ['kicker', 'title', 'body', 'points', 'number', 'label', 'quote', 'attribution', 'code', 'source'] as const;
export const CONTENT_KEYS = [...WRITTEN_KEYS, 'image'] as const;
export type WrittenKey = (typeof WRITTEN_KEYS)[number];
export type ContentKey = (typeof CONTENT_KEYS)[number];
export const isContentKey = (k: string): k is ContentKey => (CONTENT_KEYS as readonly string[]).includes(k);

/** One thing that goes into a block (CORE_CONTRACTS §2.7). The hint is shown in the Art Director node's props table. */
/** An image a look carries: uploaded through `POST /api/assets`, addressed by its hash (ARCHITECTURE §6). */
export const AssetUrlSchema = z.string().regex(/^\/api\/assets\/[a-f0-9]{16,64}\.[a-z0-9]+$/, 'an image must be an uploaded asset');

export const BlockFieldSchema = z.object({
  type: z.enum(['string', 'text', 'number', 'boolean', 'color', 'string[]', 'image']),
  /** Which scene content fills this prop; absent means the prop's own name, when that is a content key. */
  content: z.enum(CONTENT_KEYS).optional(),
  hint: z.string().max(200).optional(),
  required: z.boolean().default(true),
  max: z.number().int().positive().optional(),
  min: z.number().optional(),
});
export type BlockField = z.infer<typeof BlockFieldSchema>;

/** Scene code shared by stage and block: an HTML fragment with inline style and an optional GSAP timeline. */
export const SceneCodeSchema = z.object({
  format: z.literal('html-gsap'),
  source: z.string().max(200_000),
});
export type SceneCode = z.infer<typeof SceneCodeSchema>;

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** A scene archetype the screenwriter may pick: what to write, when to use it, how it draws. */
export const BlockDefSchema = z.object({
  id: z.string().regex(SLUG).max(60),
  name: z.string().min(1).max(80),
  doc: z.object({ example: z.string().max(2000), when: z.string().max(1000) }),
  props: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/), BlockFieldSchema),
  code: SceneCodeSchema,
});
export type BlockDef = z.infer<typeof BlockDefSchema>;


/** The persistent shell every scene plays on; one per workflow (CORE_CONTRACTS §2.6). */
export const StageDefSchema = z.object({
  name: z.string().min(1).max(80),
  /** The frame this stage is drawn for; the video takes its size from here (CORE_CONTRACTS §2.6). */
  frame: z.object({ width: z.number().int().min(16).max(8192), height: z.number().int().min(16).max(8192) }).default({ width: 1080, height: 1920 }),
  tokens: z.object({ palette: z.record(z.string()), fonts: z.record(z.string()) }),
  /** Named palette overrides a scene may switch to; keys are what the model writes into `tone`. */
  tones: z.record(z.record(z.string())).default({}),
  /** How one scene gives way to the next (CORE_CONTRACTS §2.6): one kind for the whole film, the film's own rhythm. */
  transition: z.object({ type: z.enum(['cut', 'fade', 'slide', 'zoom']), seconds: z.number().min(0.1).max(2) }).default({ type: 'fade', seconds: 0.4 }),
  /** Extra per-scene fields the stage draws itself; the rule teaches the model how to write each. */
  sceneFields: z.array(z.object({ name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/), rule: z.string().max(300), options: z.array(z.string()).optional() })).default([]),
  code: SceneCodeSchema,
});
export type StageDef = z.infer<typeof StageDefSchema>;

/** Block ids unique within one look; shared by the LookDef and the Art Director node's parameters. */
export const uniqueBlockIds = (v: { blocks: { id: string }[] }, ctx: z.RefinementCtx): void => {
  const seen = new Set<string>();
  v.blocks.forEach((b, i) => {
    if (seen.has(b.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['blocks', i, 'id'], message: `block id "${b.id}" is used twice` });
    seen.add(b.id);
  });
};

/**
 * The whole look of a workflow (CORE_CONTRACTS §2.7): the stage every scene plays on and the
 * catalogue of blocks that play on it, block ids unique. It is the Art Director node's data; it does not
 * travel on a wire — the Art Director turns a scene script into a plan (§5.9) and sends that.
 */
export const LookDefBaseSchema = StageDefSchema.extend({ blocks: z.array(BlockDefSchema).min(1) });
export const LookDefSchema = LookDefBaseSchema.superRefine(uniqueBlockIds);
export type LookDef = z.infer<typeof LookDefSchema>;
/** The two parts of a look, as the plan and the renderers take them. */
export const splitLook = (look: LookDef): { stage: StageDef; blocks: BlockDef[] } => { const { blocks, ...stage } = look; return { stage, blocks }; };

/** One scene of a plan: a block from the plan's catalogue, what goes into it, and how the stage dresses it. */
export const SceneSpecSchema = z.object({
  blockId: z.string().regex(SLUG),
  weight: z.number().positive(),
  props: z.record(z.string(), z.unknown()),
  /** One of the stage's tones; absent means the stage's base palette. */
  tone: z.string().optional(),
  /** Values for the stage's `sceneFields`, by name. */
  fields: z.record(z.string(), z.string()).optional(),
  factBindings: z.record(z.string(), z.string()).optional(),
});
export type SceneSpec = z.infer<typeof SceneSpecSchema>;

/**
 * A plan is self-contained (CORE_CONTRACTS §2.3): it carries the stage and every block its scenes
 * may use, so the assembler, the engines and a saved project need nothing registered anywhere.
 */
export const ScenePlanSchema = z
  .object({
    language: bcp47,
    stage: StageDefSchema,
    blocks: z.array(BlockDefSchema).min(1),
    scenes: z.array(SceneSpecSchema).min(1),
  })
  .superRefine((plan, ctx) => {
    const ids = new Set(plan.blocks.map((b) => b.id));
    if (ids.size !== plan.blocks.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['blocks'], message: 'block ids must be unique' });
    plan.scenes.forEach((s, i) => {
      if (!ids.has(s.blockId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scenes', i, 'blockId'], message: `the plan carries no block "${s.blockId}"` });
      if (s.tone !== undefined && !(s.tone in plan.stage.tones)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scenes', i, 'tone'], message: `the stage has no tone "${s.tone}"` });
    });
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

/** What one scene says, in the content vocabulary; every key optional, a scene writes what it needs. */
export const SceneContentSchema = z
  .object({
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
  })
  .partial()
  .strip();
export type SceneContent = z.infer<typeof SceneContentSchema>;

/**
 * The scene script (CORE_CONTRACTS §2.11): the video broken into scenes with their content, before
 * any look. Written by the Screenwriter or typed into the Static Script; the Art Director casts a block, a
 * tone and the stage fields for each scene and emits the ScenePlan.
 */
export const SceneScriptSchema = z.object({
  language: bcp47,
  scenes: z
    .array(
      z.object({
        /** The beat this scene belongs to: hook, quote, cta. The Art Director casts by role. */
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

/** How the spoken word is marked; read off the stage's caption slot, never carried by the track. */
export const CAPTION_STYLES = ['karaoke', 'reveal'] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];
/** Caption lines on the voice-over's clock (CORE_CONTRACTS §2.10): what is said, when. Where and how is the stage's. */
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
