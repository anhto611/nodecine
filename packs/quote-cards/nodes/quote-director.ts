import { z } from 'zod';
import type { NodeDefinition } from '@/core/nodes/definition';
import { ErrorCode, NodeError, toNodeError } from '@/core/errors';
import { detectLanguage } from '@/core/text/detect-language';
import type { LLMRef, SourceRef } from '@/core/types/payloads';
import { PACK_ID } from '../constants';
import { PackErrorCode } from '../errors';
import { DirectorOutputSchema, MAX_QUOTES, MIN_QUOTES, buildQuotePrompt, sameLanguage, toPackets, type DirectorOutput } from '../director';

const Params = z.object({
  /** `auto` = the language the topic was typed in; otherwise a BCP 47 primary subtag such as `vi`. */
  outputLanguage: z.string().min(2).max(35).default('auto'),
  count: z.number().int().min(MIN_QUOTES).max(MAX_QUOTES).default(4),
});

export const QUOTE_DIRECTOR = `${PACK_ID}/quote-director`;

/** Raw JSON from the provider; validated here so the retry decision and the raw text stay together. */
const Raw = z.unknown();

/**
 * Turns a topic into an opening card and N quote cards.
 *
 * It takes a `SourceRef` — the line the user typed — where github-showcase's director takes a
 * `FactSheet`. Same two output ports, same `LLMRef` input, entirely different left-hand side; the
 * port types are what let both be "a director" without either knowing about the other.
 */
export const quoteDirector: NodeDefinition<typeof Params> = {
  type: QUOTE_DIRECTOR,
  version: 1,
  pack: PACK_ID,
  kind: 'process',
  inputs: [
    { name: 'topic', type: 'SourceRef' },
    { name: 'llm', type: 'LLMRef', requires: ['installed', 'authenticated'] },
  ],
  outputs: [
    { name: 'plan', type: 'DirectorPlan' },
    { name: 'script', type: 'AudioScript' },
  ],
  paramsSchema: Params,
  defaultParams: { outputLanguage: 'auto', count: 4 },
  run: async ({ params, inputs, services, signal, log, progress }) => {
    const topic = (inputs.topic!.payload as SourceRef).value.trim();
    if (!topic) throw new NodeError(ErrorCode.INPUT_EMPTY, 'type a theme for the quotes', false);
    const ref = inputs.llm!.payload as LLMRef;
    const language = params.outputLanguage === 'auto' ? detectLanguage(topic) : params.outputLanguage.toLowerCase();
    log('info', `output language: ${language}${params.outputLanguage === 'auto' ? ' (detected from the topic)' : ''} · ${params.count} quotes · provider ${ref.providerId}`);

    let strict = false;
    let schemaRetries = 0;
    let languageRetries = 0;
    let lastRaw: unknown;
    for (let attempt = 1; ; attempt++) {
      progress(0.2 + attempt * 0.2, `attempt ${attempt}`);
      let raw: unknown;
      try {
        raw = await services.complete(ref, buildQuotePrompt(topic, language, params.count, strict), Raw, signal);
      } catch (e) {
        const err = toNodeError(e, ErrorCode.LLM_UPSTREAM);
        if (err.code === ErrorCode.LLM_SCHEMA_INVALID && schemaRetries < 1) {
          schemaRetries++;
          log('warn', 'model did not return JSON; retrying once', err.code);
          continue;
        }
        throw new NodeError(err.code, err.message, err.code !== ErrorCode.PROVIDER_NOT_INSTALLED, err.details);
      }
      lastRaw = raw;
      const parsed = DirectorOutputSchema.safeParse(raw);
      if (!parsed.success) {
        const why = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '$'}: ${i.message}`).join('; ');
        if (schemaRetries < 1) {
          schemaRetries++;
          log('warn', `plan has the wrong structure (${why}); retrying once`, ErrorCode.LLM_SCHEMA_INVALID);
          continue;
        }
        throw new NodeError(ErrorCode.LLM_SCHEMA_INVALID, why, true, { raw: lastRaw });
      }
      const out: DirectorOutput = parsed.data;
      if (!sameLanguage(out.language, language)) {
        if (languageRetries < 1) {
          languageRetries++;
          strict = true;
          log('warn', `model answered in "${out.language}", expected "${language}"; retrying with a strict prompt`, PackErrorCode.QUOTE_LANGUAGE_MISMATCH);
          continue;
        }
        throw new NodeError(PackErrorCode.QUOTE_LANGUAGE_MISMATCH, `model answered in "${out.language}", expected "${language}"`, true, { raw: lastRaw });
      }
      // The count is the user's, not the model's: fewer than asked is a miss worth one retry.
      if (out.quotes.length !== params.count && schemaRetries < 1) {
        schemaRetries++;
        log('warn', `model wrote ${out.quotes.length} quotes, asked for ${params.count}; retrying once`, ErrorCode.LLM_SCHEMA_INVALID);
        continue;
      }
      const packets = toPackets({ ...out, language });
      log('info', `${out.quotes.length} quotes · narration ${packets.script.text.split(/\s+/).length} words`);
      return packets;
    }
  },
};
