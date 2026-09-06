import { z } from 'zod';

/** Payload schemas for the core port types (CORE_CONTRACTS §2, §6.2, §7.1, §8.1). */

const bcp47 = z.string().min(2).max(35);

export const SourceRefSchema = z.object({
  value: z.string(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const FactValueSchema = z.union([z.string(), z.number(), z.null(), z.array(z.string())]);
export const FactSheetSchema = z.object({
  facts: z.record(z.string(), FactValueSchema),
  sourceLabel: z.string(),
  fetchedAt: z.string(),
  mode: z.enum(['fetched', 'passthrough']),
});
export type FactSheet = z.infer<typeof FactSheetSchema>;

/**
 * The content vocabulary (CORE_CONTRACTS §2.11): the fixed set of things a scene can say, written by
 * the director without knowing any block, and consumed by the Look when it casts a block for the
 * scene. A block prop names the key that fills it (`content`), or is filled by the key of its own name.
 */
export const CONTENT_KEYS = ['kicker', 'title', 'body', 'points', 'number', 'label', 'quote', 'attribution', 'code', 'source'] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];
export const isContentKey = (k: string): k is ContentKey => (CONTENT_KEYS as readonly string[]).includes(k);

/** One thing that goes into a block (CORE_CONTRACTS §2.7). The hint is shown in the Look node's props table. */
export const BlockFieldSchema = z.object({
  type: z.enum(['string', 'text', 'number', 'boolean', 'color', 'string[]']),
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

/** A scene archetype the director may pick: what to write, when to use it, how it draws. */
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
  /** Extra per-scene fields the stage draws itself; the rule teaches the model how to write each. */
  sceneFields: z.array(z.object({ name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/), rule: z.string().max(300), options: z.array(z.string()).optional() })).default([]),
  code: SceneCodeSchema,
});
export type StageDef = z.infer<typeof StageDefSchema>;

/** Block ids unique within one look; shared by the LookDef and the Look node's parameters. */
export const uniqueBlockIds = (v: { blocks: { id: string }[] }, ctx: z.RefinementCtx): void => {
  const seen = new Set<string>();
  v.blocks.forEach((b, i) => {
    if (seen.has(b.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['blocks', i, 'id'], message: `block id "${b.id}" is used twice` });
    seen.add(b.id);
  });
};

/**
 * The whole look of a workflow (CORE_CONTRACTS §2.7): the stage every scene plays on and the
 * catalogue of blocks that play on it, block ids unique. It is the Look node's data; it does not
 * travel on a wire — the Look turns a scene script into a plan (§5.9) and sends that.
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
export const DirectorPlanSchema = z
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
export type DirectorPlan = z.infer<typeof DirectorPlanSchema>;

export const AudioScriptSchema = z.object({
  text: z.string().min(1),
  language: bcp47,
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
  })
  .partial()
  .strip();
export type SceneContent = z.infer<typeof SceneContentSchema>;

/**
 * The scene script (CORE_CONTRACTS §2.11): the video broken into scenes with their content, before
 * any look. Written by the AI Director or typed into the Static Script; the Look casts a block, a
 * tone and the stage fields for each scene and emits the DirectorPlan.
 */
export const SceneScriptSchema = z.object({
  language: bcp47,
  scenes: z
    .array(
      z.object({
        /** The beat this scene belongs to: hook, quote, cta. The Look casts by role. */
        role: z.string().min(1).max(40),
        weight: z.number().positive(),
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
  DirectorPlan: DirectorPlanSchema,
  AudioScript: AudioScriptSchema,
  Voiceover: VoiceoverSchema,
  EngineRef: EngineRefSchema,
  LLMRef: LLMRefSchema,
  TTSRef: TTSRefSchema,
  CaptionTrack: CaptionTrackSchema,
  SceneScript: SceneScriptSchema,
} as const;
