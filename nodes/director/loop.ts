import { z, type ZodTypeAny } from 'zod';
import { ErrorCode, NodeError, toNodeError } from '@/core/errors';
import { sameLanguage } from '@/core/text/languages';
import type { LLMRef } from '@/core/types/payloads';
import type { LogLevel, RunContext } from '@/core/nodes/definition';
import type { NodeServices } from '@/core/engine/services';

/**
 * Ask a language model for a structured answer and hold it to the shape and the language that
 * were asked for (CORE_CONTRACTS §5.8).
 *
 * The provider is asked for unvalidated JSON on purpose. Validating here keeps the retry decision
 * and the raw text in one place, so a failure can show the user what the model actually wrote.
 */

const RAW = z.unknown();

export interface DirectorSpec<S extends ZodTypeAny> {
  /** What a good answer looks like. Anything else earns one retry, then fails with the raw text. */
  outputSchema: S;
  /** `strict` is set for the retry after a language mismatch; say it more firmly. */
  buildPrompt(language: string, strict: boolean): string;
  /** The language the model claims to have written in, read out of its own answer. */
  languageOf(output: z.infer<S>): string;
}

/** The parts of a node's run context this needs; a node passes itself. */
export type DirectorContext = Pick<RunContext, 'signal' | 'progress'> & {
  services: Pick<NodeServices, 'complete'>;
  log: (level: LogLevel, message: string, code?: string) => void;
};

/** One retry for the wrong shape and one for the wrong language, then give up with the raw text. */
export async function runDirector<S extends ZodTypeAny>(
  ctx: DirectorContext,
  ref: LLMRef,
  spec: DirectorSpec<S>,
  language: string,
): Promise<z.infer<S>> {
  let strict = false;
  let schemaRetries = 0;
  let languageRetries = 0;
  let lastRaw: unknown;

  for (let attempt = 1; ; attempt++) {
    ctx.progress(0.2 + attempt * 0.2, `attempt ${attempt}`);
    let raw: unknown;
    try {
      raw = await ctx.services.complete(ref, spec.buildPrompt(language, strict), RAW, ctx.signal);
    } catch (e) {
      const err = toNodeError(e, ErrorCode.LLM_UPSTREAM);
      // The provider itself can fail to get JSON out of the model; that is the same kind of miss.
      if (err.code === ErrorCode.LLM_SCHEMA_INVALID && schemaRetries < 1) {
        schemaRetries++;
        ctx.log('warn', 'model did not return JSON; retrying once', err.code);
        continue;
      }
      throw new NodeError(err.code, err.message, err.code !== ErrorCode.PROVIDER_NOT_INSTALLED, err.details);
    }

    lastRaw = raw;
    const parsed = spec.outputSchema.safeParse(raw);
    if (!parsed.success) {
      const why = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '$'}: ${i.message}`).join('; ');
      if (schemaRetries < 1) {
        schemaRetries++;
        ctx.log('warn', `answer has the wrong structure (${why}); retrying once`, ErrorCode.LLM_SCHEMA_INVALID);
        continue;
      }
      throw new NodeError(ErrorCode.LLM_SCHEMA_INVALID, why, true, { raw: lastRaw });
    }

    const output = parsed.data as z.infer<S>;
    const answered = spec.languageOf(output);
    if (!sameLanguage(answered, language)) {
      if (languageRetries < 1) {
        languageRetries++;
        strict = true;
        ctx.log('warn', `model answered in "${answered}", expected "${language}"; retrying with a strict prompt`, ErrorCode.LLM_LANGUAGE_MISMATCH);
        continue;
      }
      throw new NodeError(ErrorCode.LLM_LANGUAGE_MISMATCH, `model answered in "${answered}", expected "${language}"`, true, { raw: lastRaw });
    }
    return output;
  }
}
