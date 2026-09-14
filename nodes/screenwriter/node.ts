import { z } from 'zod';
import { resolveLLM } from '@/contracts/resources';
import { ErrorCode, NodeError } from '@/contracts/errors';
import { runScreenwriter } from '@/contracts/ai/structured-completion';
import { buildScreenwriterPrompt } from '@/nodes/screenwriter/prompt';
import { BeatSchema, boundFactKeys, expandBeats, listBeats, outputSchemaFor, toPackets } from '@/nodes/screenwriter/beats';
import { resolveOutputLanguage } from '@/contracts/text/languages';
import { getForm } from '@/contracts/forms/registry';
import type { FactSheet, LLMRef, PlateSheet, SourceRef } from '@/contracts/types/payloads';
import { signatureKey, signatureOf } from '@/contracts/visual/plates';
import type { NodeDefinition } from '@/core/nodes/definition';

const Params = z.object({
  /** The language model this node writes with (§1.3): a provider id and its settings. */
  llmProvider: z.string().max(60).default(''),
  llmSettings: z.record(z.string(), z.unknown()).default({}),
  /** What the video is about and how it should feel. The one thing only the user can say. */
  prompt: z.string().min(1).max(4000),
  /** `auto` = the language of the brief and the facts; otherwise a BCP 47 primary subtag. */
  outputLanguage: z.string().min(2).max(35).default('auto'),
  beats: z.array(BeatSchema).min(1).max(24),
  /** What kind of film this is (CORE_CONTRACTS §6). Empty writes the way the app always has. */
  form: z.string().max(40).default(''),
  /** How long the film should take to read aloud, in seconds. 0 lets the beats decide, as before. */
  targetSeconds: z.number().min(0).max(600).default(0),
});

export const SCREENWRITER = 'core/screenwriter';

export const DEFAULT_SCREENWRITER: z.infer<typeof Params> = {
  llmProvider: '',
  llmSettings: {},
  prompt: 'A short, warm introduction to the subject. Plain language, one idea per scene.',
  outputLanguage: 'auto',
  form: '',
  targetSeconds: 0,
  beats: [
    { role: 'opening', brief: 'Say what this is in one line.', weight: 1, count: 1, factBindings: {} },
    { role: 'body', brief: 'One idea per scene, building on the last.', weight: 1, count: 2, factBindings: {} },
    { role: 'closing', brief: 'Leave the viewer with one thing to do or remember.', weight: 1, count: 1, factBindings: {} },
  ],
};

/**
 * The Screenwriter (CORE_CONTRACTS §5.8). It asks a language model for a narration and, for every
 * scene of every beat, what the scene says in the content vocabulary — no drawing: the Illustrator
 * draws that afterwards.
 *
 * Nothing about any particular kind of video lives here. The brief and the beats are parameters, the
 * output shape is the content vocabulary, and
 * any prop bound to a fact is left out of the prompt entirely — checkable data reaches the video
 * through the Facts port, never through the model. That is what lets a user build a GitHub showcase,
 * a quote reel or anything else from a blank canvas, and share the result as a template that is only data.
 */
export const screenwriter: NodeDefinition<typeof Params> = {
  type: SCREENWRITER,
  version: 3,
  kind: 'process',
  inputs: [
    // A line the user typed, for videos with no fact source: it becomes the subject of the brief.
    { name: 'source', type: 'SourceRef', required: false },
    { name: 'facts', type: 'FactSheet', required: false },
    // The layouts the film can be drawn in. With a catalogue on this port the model is given the
    // shapes and writes only those; without one it writes whatever the scene needs, as before.
    { name: 'plates', type: 'PlateSheet', required: false },
  ],
  outputs: [
    { name: 'scenes', type: 'SceneScript' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: DEFAULT_SCREENWRITER,

  run: async ({ params, inputs, services, signal, log, progress }) => {
    const facts = inputs.facts?.payload as FactSheet | undefined;
    const catalogue = (inputs.plates?.payload as PlateSheet | undefined)?.plates ?? [];
    const subject = (inputs.source?.payload as SourceRef | undefined)?.value.trim() || undefined;
    const ref = await resolveLLM(services, params);
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

    // One entry per shape, not per plate: two plates drawing the same keys are one choice to make.
    const shapes = [...new Map(catalogue.map((p) => [signatureKey(p.keys), { keys: p.keys as readonly string[], ...(p.budget ? { budget: p.budget } : {}) }])).values()];
    if (shapes.length) log('info', `${shapes.length} layout${shapes.length === 1 ? '' : 's'} to choose from: ${shapes.map((s) => s.keys.join('+')).join(' · ')}`);

    let outputSchema;
    try {
      outputSchema = outputSchemaFor(scenes);
    } catch (e) {
      throw new NodeError(ErrorCode.NODE_PARAMS_INVALID, e instanceof Error ? e.message : String(e), false);
    }

    // A form named but unknown to this build is the user's mistake, not something to quietly ignore:
    // they would get the old shape of film back and no reason why.
    const form = getForm(params.form.trim() || undefined);
    if (params.form.trim() && !form) throw new NodeError(ErrorCode.NODE_PARAMS_INVALID, `no film form named "${params.form.trim()}"`, false);
    const out = await runScreenwriter({ services, signal, log, progress }, ref, {
      outputSchema,
      buildPrompt: (lang, strict) => buildScreenwriterPrompt({ brief: params.prompt, subject, facts, excludeFacts, scenes, language: lang, strict, ...(form ? { form: form.script } : {}), ...(params.targetSeconds ? { targetSeconds: params.targetSeconds } : {}), ...(shapes.length ? { shapes } : {}) }),
      languageOf: (o) => o.language,
    }, language);

    const packets = toPackets({ ...out, language }, scenes);
    // Said here, where the scene has a number and a title, rather than left to the scene builder,
    // which can only name the shape. The builder still refuses the run: this is the explanation.
    if (shapes.length) {
      const known = new Set(shapes.map((s) => s.keys.join('+')));
      for (const [i, scene] of packets.scenes.scenes.entries()) {
        const wrote = signatureKey(signatureOf(scene.content));
        if (!known.has(wrote)) log('warn', `scene ${i + 1} was written as "${wrote}", which no layout draws`, ErrorCode.NODE_OUTPUT_INVALID);
      }
    }
    if (form) packets.scenes.form = form.id;
    log('info', `${form ? `form "${form.id}" · ` : ''}narration ${packets.script.text.split(/\s+/).length} words in ${packets.scenes.scenes.length} scenes · ${packets.scenes.scenes.map((s) => s.content.title ?? s.role).join(' | ')}`);
    return packets;
  },
};
