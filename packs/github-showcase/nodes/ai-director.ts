import { z } from 'zod';
import type { NodeDefinition } from '@/core/nodes/definition';
import type { FactSheet, LLMRef } from '@/core/types/payloads';
import { NodeError, toNodeError } from '@/core/errors';
import { PACK_ID } from '../constants';
import { PackErrorCode } from '../errors';
import { DirectorOutputSchema, buildDirectorPrompt, resolveOutputLanguage, sameLanguage, toPackets, type DirectorOutput } from '../director';

const Params = z.object({
  /** `auto` = language of the source text; otherwise a BCP 47 primary subtag such as `vi`. */
  outputLanguage: z.string().min(2).max(35).default('auto'),
});

export const AI_DIRECTOR = `${PACK_ID}/ai-director`;

/** Raw JSON the provider hands back; validated here so retries and error details stay in the node. */
const Raw = z.unknown();

/**
 * github-showcase spec §3 — asks the language model for the narration and the three scenes.
 * Retry policy: wrong structure → one retry; wrong language → one retry with a stricter prompt.
 */
export const aiDirector: NodeDefinition<typeof Params> = {
  type: AI_DIRECTOR,
  version: 1,
  pack: PACK_ID,
  kind: 'process',
  inputs: [
    { name: 'facts', type: 'FactSheet' },
    { name: 'llm', type: 'LLMRef', requires: ['installed', 'authenticated'] },
  ],
  outputs: [
    { name: 'plan', type: 'DirectorPlan' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: { outputLanguage: 'auto' },
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const sheet = inputs.facts!.payload as FactSheet;
    const ref = inputs.llm!.payload as LLMRef;
    const language = resolveOutputLanguage(params.outputLanguage, sheet);
    log('info', `output language: ${language}${params.outputLanguage === 'auto' ? ' (detected from source)' : ''} · provider ${ref.providerId}`);

    let strict = false;
    let schemaRetries = 0;
    let languageRetries = 0;
    let lastRaw: unknown;
    for (let attempt = 1; ; attempt++) {
      progress(0.2 + attempt * 0.2, `attempt ${attempt}`);
      let raw: unknown;
      try {
        raw = await services.complete(ref, buildDirectorPrompt(sheet, language, strict), Raw, signal);
      } catch (e) {
        const err = toNodeError(e, 'LLM_UPSTREAM');
        if (err.code === PackErrorCode.LLM_SCHEMA_INVALID && schemaRetries < 1) {
          schemaRetries++;
          log('warn', `model did not return JSON; retrying once`, err.code);
          continue;
        }
        throw new NodeError(err.code, err.message, err.code !== 'PROVIDER_NOT_INSTALLED', err.details);
      }
      lastRaw = raw;
      const parsed = DirectorOutputSchema.safeParse(raw);
      if (!parsed.success) {
        const why = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '$'}: ${i.message}`).join('; ');
        if (schemaRetries < 1) {
          schemaRetries++;
          log('warn', `plan has the wrong structure (${why}); retrying once`, PackErrorCode.LLM_SCHEMA_INVALID);
          continue;
        }
        throw new NodeError(PackErrorCode.LLM_SCHEMA_INVALID, why, true, { raw: lastRaw });
      }
      const out: DirectorOutput = parsed.data;
      if (!sameLanguage(out.language, language)) {
        if (languageRetries < 1) {
          languageRetries++;
          strict = true;
          log('warn', `model answered in "${out.language}", expected "${language}"; retrying with a strict prompt`, PackErrorCode.LLM_LANGUAGE_MISMATCH);
          continue;
        }
        throw new NodeError(PackErrorCode.LLM_LANGUAGE_MISMATCH, `model answered in "${out.language}", expected "${language}"`, true, { raw: lastRaw });
      }
      const packets = toPackets({ ...out, language });
      log('info', `narration ${packets.script.text.split(/\s+/).length} words · scenes: ${out.scenes.map((s) => s.headline).join(' / ')}`);
      return packets;
    }
  },
};
