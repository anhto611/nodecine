import { z } from 'zod';
import { ErrorCode, NodeError } from '../errors';
import { runDirector } from '../director/loop';
import { buildDirectorPrompt } from '../director/prompt';
import { SlotSchema, boundFactKeys, expandSlots, outputSchemaFor, toPackets, unknownSceneTypes } from '../director/slots';
import { resolveOutputLanguage } from '../text/languages';
import type { FactSheet, LLMRef, SourceRef } from '../types/payloads';
import type { NodeDefinition } from './definition';

const Params = z.object({
  /** What the video is about and how it should feel. The one thing only the user can say. */
  prompt: z.string().min(1).max(4000),
  /** `auto` = the language of the brief and the facts; otherwise a BCP 47 primary subtag. */
  outputLanguage: z.string().min(2).max(35).default('auto'),
  theme: z.string().min(1).default('core/dark'),
  scenes: z.array(SlotSchema).min(1).max(24),
});

export const AI_DIRECTOR = 'core/ai-director';

export const DEFAULT_AI_DIRECTOR: z.infer<typeof Params> = {
  prompt: 'A short, warm introduction to the subject. Plain language, one idea per scene.',
  outputLanguage: 'auto',
  theme: 'core/dark',
  scenes: [{ sceneType: 'core/title-card', weight: 1, count: 1, factBindings: {} }],
};

/**
 * The one director (CORE_CONTRACTS §5.8). It asks a language model for a narration and the props of
 * every scene the user listed, and hands the Timeline Assembler a plan.
 *
 * Nothing about any particular kind of video lives here. The brief is a parameter, the scenes are
 * picked from the registry, the output shape is derived from their schemas, and any prop bound to a
 * fact is left out of the prompt entirely — checkable data reaches the video through the Facts port,
 * never through the model. That is what lets a user build a GitHub showcase, a quote reel or
 * anything else from a blank canvas, and share the result as a template that is only data.
 */
export const aiDirector: NodeDefinition<typeof Params> = {
  type: AI_DIRECTOR,
  version: 1,
  namespace: 'core',
  kind: 'process',
  inputs: [
    // A line the user typed, for videos with no fact source: it becomes the subject of the brief.
    { name: 'source', type: 'SourceRef', required: false },
    { name: 'facts', type: 'FactSheet', required: false },
    { name: 'llm', type: 'LLMRef', requires: ['installed', 'authenticated'] },
  ],
  outputs: [
    { name: 'plan', type: 'DirectorPlan' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: DEFAULT_AI_DIRECTOR,

  // A scene type nothing registered cannot be asked for, so say so before spending a model call.
  preflight(_inputs, params) {
    const missing = unknownSceneTypes(params.scenes);
    if (missing.length === 0) return null;
    return {
      kind: 'capability',
      code: ErrorCode.NODE_PARAMS_INVALID,
      message: `no such scene type: ${missing.join(', ')}`,
      fix: 'pick a scene type from the list',
    };
  },

  run: async ({ params, inputs, services, signal, log, progress }) => {
    const facts = inputs.facts?.payload as FactSheet | undefined;
    const subject = (inputs.source?.payload as SourceRef | undefined)?.value.trim() || undefined;
    const ref = inputs.llm!.payload as LLMRef;
    const scenes = expandSlots(params.scenes);
    const excludeFacts = boundFactKeys(params.scenes);

    // The source for "auto" is whatever the model will read: the brief, and the facts it may see.
    const factText = facts ? Object.entries(facts.facts).filter(([k]) => !excludeFacts.has(k)).map(([, v]) => (typeof v === 'string' ? v : '')).join('\n') : '';
    const language = resolveOutputLanguage(params.outputLanguage, `${subject ?? ''}\n${params.prompt}\n${factText}`);
    log('info', `${scenes.length} scenes · output language ${language}${params.outputLanguage === 'auto' ? ' (detected)' : ''} · provider ${ref.providerId}`);

    let outputSchema;
    try {
      outputSchema = outputSchemaFor(scenes);
    } catch (e) {
      throw new NodeError(ErrorCode.NODE_PARAMS_INVALID, e instanceof Error ? e.message : String(e), false);
    }

    const out = await runDirector({ services, signal, log, progress }, ref, {
      outputSchema,
      buildPrompt: (lang, strict) => buildDirectorPrompt({ brief: params.prompt, subject, facts, excludeFacts, scenes, language: lang, strict }),
      languageOf: (o) => o.language,
    }, language);

    const packets = toPackets({ ...out, language }, scenes, params.theme);
    log('info', `narration ${packets.script.text.split(/\s+/).length} words · ${packets.plan.scenes.length} scenes`);
    return packets;
  },
};
