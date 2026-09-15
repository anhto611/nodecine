import { z } from 'zod';

/** Payload schemas for the video port types and the parts a node probes. */

const bcp47 = z.string().min(2).max(35);

/**
 * A picture or a clip a composition uses: uploaded through `POST /api/assets` and addressed by its
 * hash, so a composition only ever names a file this machine already holds.
 */
const HASHED_ASSET = /^\/api\/assets\/[a-f0-9]{16,64}\.[a-z0-9]+$/;
export const AssetUrlSchema = z.string().regex(HASHED_ASSET, 'must be an uploaded asset');

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

/** Caption lines on the voice-over's clock: what is said, when. Where and how is the composition's. */
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
    /** Whether pictures can go with a prompt. Absent means no. */
    vision: CapabilitySchema.optional(),
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
