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

export const SceneSpecSchema = z.object({
  sceneType: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'sceneType must look like <pack>/<name>'),
  weight: z.number().positive(),
  props: z.record(z.string(), z.unknown()),
  factBindings: z.record(z.string(), z.string()).optional(),
});
export type SceneSpec = z.infer<typeof SceneSpecSchema>;

export const DirectorPlanSchema = z.object({
  language: bcp47,
  theme: z.string().min(1),
  scenes: z.array(SceneSpecSchema).min(1),
});
export type DirectorPlan = z.infer<typeof DirectorPlanSchema>;

export const AudioScriptSchema = z.object({
  text: z.string().min(1),
  language: bcp47,
});
export type AudioScript = z.infer<typeof AudioScriptSchema>;

/** Media URLs are always app-relative (ARCHITECTURE §6). Never a filesystem path. */
export const MediaUrlSchema = z.string().regex(/^\/api\/media\/[a-f0-9]{16,64}\.[a-z0-9]+$/);

export const VoiceoverSchema = z.object({
  audioUrl: MediaUrlSchema,
  durationSeconds: z.number().positive(),
  voiceName: z.string(),
  language: bcp47,
  speed: z.number().positive(),
});
export type Voiceover = z.infer<typeof VoiceoverSchema>;

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
} as const;
