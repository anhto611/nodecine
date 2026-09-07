import { z } from 'zod';
import { ErrorCode, NodeError } from '@/core/errors';
import { runScreenwriter } from '@/nodes/screenwriter/loop';
import { buildScreenwriterPrompt } from '@/nodes/screenwriter/prompt';
import { BeatSchema, boundFactKeys, expandBeats, listBeats, outputSchemaFor, toPackets } from '@/nodes/screenwriter/beats';
import { resolveOutputLanguage } from '@/core/text/languages';
import type { FactSheet, LLMRef, SourceRef } from '@/core/types/payloads';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({
  /** What the video is about and how it should feel. The one thing only the user can say. */
  prompt: z.string().min(1).max(4000),
  /** `auto` = the language of the brief and the facts; otherwise a BCP 47 primary subtag. */
  outputLanguage: z.string().min(2).max(35).default('auto'),
  beats: z.array(BeatSchema).min(1).max(24),
});

export const SCREENWRITER = 'core/screenwriter';

export const DEFAULT_SCREENWRITER: z.infer<typeof Params> = {
  prompt: 'A short, warm introduction to the subject. Plain language, one idea per scene.',
  outputLanguage: 'auto',
  beats: [
    { role: 'opening', brief: 'Say what this is in one line.', weight: 1, count: 1, factBindings: {} },
    { role: 'body', brief: 'One idea per scene, building on the last.', weight: 1, count: 2, factBindings: {} },
    { role: 'closing', brief: 'Leave the viewer with one thing to do or remember.', weight: 1, count: 1, factBindings: {} },
  ],
};

/**
 * The one director (CORE_CONTRACTS §5.8). It asks a language model for a narration and, for every
 * scene of every beat, what the scene says in the content vocabulary — no block, no stage: the Art Director
 * casts those afterwards. It hands
 * the Timeline Assembler a self-contained plan: stage, blocks, scenes.
 *
 * Nothing about any particular kind of video lives here. The brief and the beats are parameters, the
 * look arrives on wires as data, the output shape is derived from the blocks' own props tables, and
 * any prop bound to a fact is left out of the prompt entirely — checkable data reaches the video
 * through the Facts port, never through the model. That is what lets a user build a GitHub showcase,
 * a quote reel or anything else from a blank canvas, and share the result as a template that is only data.
 */
export const screenwriter: NodeDefinition<typeof Params> = {
  type: SCREENWRITER,
  version: 2,
  namespace: 'core',
  kind: 'process',
  inputs: [
    // A line the user typed, for videos with no fact source: it becomes the subject of the brief.
    { name: 'source', type: 'SourceRef', required: false },
    { name: 'facts', type: 'FactSheet', required: false },
    { name: 'llm', type: 'LLMRef', requires: ['installed', 'authenticated'] },
  ],
  outputs: [
    { name: 'scenes', type: 'SceneScript' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: DEFAULT_SCREENWRITER,

  run: async ({ params, inputs, services, signal, log, progress }) => {
    const facts = inputs.facts?.payload as FactSheet | undefined;
    const subject = (inputs.source?.payload as SourceRef | undefined)?.value.trim() || undefined;
    const ref = inputs.llm!.payload as LLMRef;
    const scenes = expandBeats(params.beats, facts?.facts);
    for (const l of listBeats(params.beats, facts?.facts)) {
      if (l.found === null) log('warn', `beat "${l.role}" runs over "${l.key}", which the facts do not have as a list; it gets no scenes`, ErrorCode.NODE_PARAMS_INVALID);
      else log('info', `beat "${l.role}" runs over ${l.found} item${l.found === 1 ? '' : 's'} of "${l.key}"`);
    }
    if (scenes.length === 0) throw new NodeError(ErrorCode.NODE_PARAMS_INVALID, 'no scenes: every beat runs over a list the facts do not have', false);
    const excludeFacts = boundFactKeys(params.beats);

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

    const out = await runScreenwriter({ services, signal, log, progress }, ref, {
      outputSchema,
      buildPrompt: (lang, strict) => buildScreenwriterPrompt({ brief: params.prompt, subject, facts, excludeFacts, scenes, language: lang, strict }),
      languageOf: (o) => o.language,
    }, language);

    const packets = toPackets({ ...out, language }, scenes);
    log('info', `narration ${packets.script.text.split(/\s+/).length} words in ${packets.scenes.scenes.length} scenes · ${packets.scenes.scenes.map((s) => s.content.title ?? s.role).join(' | ')}`);
    return packets;
  },
};
