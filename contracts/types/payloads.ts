import { z } from 'zod';

/** Payload schemas for the video port types and the parts a node probes. */

const bcp47 = z.string().min(2).max(35);

/**
 * A file a scene carries: an image uploaded through `POST /api/assets`, or a clip taken in from the
 * user's own folder through `POST /api/assets/from-library`. Either way it is addressed by its hash
 * — a scene may only show a file this machine is already holding.
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

/** The one scene-code format there is: an HTML fragment with inline style and an optional GSAP timeline. */
export const SCENE_FORMAT = 'html-gsap' as const;
export const SCENE_SOURCE_MAX = 200_000;

/**
 * Where the spoken words are written, in pixels of the frame: the band's insets from the left, the
 * right and the bottom, and the size of its type.
 *
 * It is data and not a CSS rule because three parties need the same number. The style sheet used to
 * move the band itself, and on 2026-09-11 that left the film's own layer reserving a strip 500 px
 * from where the words actually were: the device sat on the captions, and correcting it against the
 * wrong strip put the device on the scene's own text instead. The sheet still chooses the face and
 * the colour; where the band sits is agreed here.
 */
export const CaptionBandSchema = z.object({
  left: z.number().int().min(0).max(8192),
  right: z.number().int().min(0).max(8192),
  bottom: z.number().int().min(0).max(8192),
  size: z.number().int().min(12).max(240),
});
export type CaptionBand = z.infer<typeof CaptionBandSchema>;

/**
 * What every scene of a video shares: a name, and one sheet of CSS — the
 * colours, the type, the classes the scenes' markup uses.
 */
export const StyleSchema = z.object({
  name: z.string().min(1).max(80),
  css: z.string().max(SCENE_SOURCE_MAX),
  /** Absent on a film drawn before the band was agreed; the engine falls back to its own default. */
  captions: CaptionBandSchema.optional(),
});
export type Style = z.infer<typeof StyleSchema>;

/**
 * How one scene gives way to the next: a name in the transition registry, which
 * the engine wired in must have. `cut`, `fade`, `slide` and `zoom` every engine has; the rest is the
 * engine's own catalogue, and the output node blocks with ENGINE_TRANSITION_UNSUPPORTED otherwise.
 */
export const TransitionSchema = z.object({ type: z.string().min(1).max(60), seconds: z.number().min(0.1).max(2) });
export type Transition = z.infer<typeof TransitionSchema>;

/**
 * Values of the whole video: a channel name, an episode number, and a
 * character or a logo as a picture. The same in every scene; a scene draws one with `data-var`.
 */
export const VarsSchema = z.record(z.string().regex(IDENT), z.union([z.string().max(200), AssetUrlSchema]));

export const AudioScriptSchema = z.object({
  /** The whole narration; with `segments`, their join. */
  text: z.string().min(1),
  language: bcp47,
  /** The narration scene by scene, in scene order: the TTS Engine voices each one and the cut follows. */
  segments: z.array(z.string().min(1)).min(1).optional(),
});
export type AudioScript = z.infer<typeof AudioScriptSchema>;

/** Media URLs are always app-relative. Never a filesystem path. */
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
/** Caption lines on the voice-over's clock: what is said, when. Where and how is the scene's. */
export const CaptionTrackSchema = z.object({
  cues: z.array(z.object({ start: z.number().nonnegative(), end: z.number().nonnegative(), words: z.array(WordSchema).min(1) })),
});
export type CaptionTrack = z.infer<typeof CaptionTrackSchema>;

/** One capability as reported by probe(). */
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
