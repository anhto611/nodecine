import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runScreenwriter, type ScreenwriterContext } from '@/contracts/ai/structured-completion';
import { ErrorCode, NodeError } from '@/contracts/errors';
import type { LLMRef } from '@/contracts/types/payloads';

const Output = z.object({ language: z.string(), headline: z.string() });

const ref: LLMRef = {
  providerId: 'fake',
  displayName: 'Fake',
  transport: 'cli',
  capabilities: { installed: { status: 'ready' }, authenticated: { status: 'ready' }, structuredOutput: { status: 'ready' } },
  settings: {},
};

/** Answers the prompts in turn; an Error is thrown, anything else is returned. */
function ctx(answers: unknown[]) {
  const prompts: string[] = [];
  const c: ScreenwriterContext = {
    signal: new AbortController().signal,
    progress: () => {},
    log: () => {},
    services: {
      complete: (async (_ref, prompt) => {
        prompts.push(prompt);
        const a = answers[prompts.length - 1];
        if (a instanceof Error) throw a;
        return a;
      }) as ScreenwriterContext['services']['complete'],
    },
  };
  return { c, prompts };
}

const spec = {
  outputSchema: Output,
  buildPrompt: (language: string, strict: boolean) => `write in ${language}${strict ? ' STRICTLY' : ''}`,
  languageOf: (o: z.infer<typeof Output>) => o.language,
};

describe('runScreenwriter', () => {
  it('returns the first answer that fits the schema and the language', async () => {
    const { c, prompts } = ctx([{ language: 'en', headline: 'HI' }]);
    await expect(runScreenwriter(c, ref, spec, 'en')).resolves.toEqual({ language: 'en', headline: 'HI' });
    expect(prompts).toHaveLength(1);
  });

  it('accepts a regional tag for the primary subtag that was asked for', async () => {
    const { c, prompts } = ctx([{ language: 'en-US', headline: 'HI' }]);
    await expect(runScreenwriter(c, ref, spec, 'en')).resolves.toBeTruthy();
    expect(prompts).toHaveLength(1);
  });

  it('retries the wrong shape once, without getting stricter', async () => {
    const { c, prompts } = ctx([{ nope: 1 }, { language: 'en', headline: 'HI' }]);
    await expect(runScreenwriter(c, ref, spec, 'en')).resolves.toBeTruthy();
    expect(prompts).toEqual(['write in en', 'write in en']);
  });

  it('gives up on the second wrong shape, keeping the raw answer for the node to show', async () => {
    const { c } = ctx([{ nope: 1 }, { still: 'wrong' }]);
    const err = await runScreenwriter(c, ref, spec, 'en').catch((e: unknown) => e as NodeError);
    expect(err).toBeInstanceOf(NodeError);
    expect((err as NodeError).code).toBe(ErrorCode.LLM_SCHEMA_INVALID);
    expect((err as NodeError).details).toEqual({ raw: { still: 'wrong' } });
  });

  it('retries a language mismatch once, strictly', async () => {
    const { c, prompts } = ctx([{ language: 'en', headline: 'HI' }, { language: 'vi', headline: 'CHÀO' }]);
    await expect(runScreenwriter(c, ref, spec, 'vi')).resolves.toEqual({ language: 'vi', headline: 'CHÀO' });
    expect(prompts).toEqual(['write in vi', 'write in vi STRICTLY']);
  });

  it('gives up on the second mismatch and names both languages', async () => {
    const { c } = ctx([{ language: 'en', headline: 'A' }, { language: 'en', headline: 'B' }]);
    const err = await runScreenwriter(c, ref, spec, 'vi').catch((e: unknown) => e as NodeError);
    expect((err as NodeError).code).toBe(ErrorCode.LLM_LANGUAGE_MISMATCH);
    expect((err as NodeError).message).toContain('"en"');
    expect((err as NodeError).message).toContain('"vi"');
  });

  it('treats a provider that could not get JSON out of the model as one wrong shape', async () => {
    const notJson = Object.assign(new Error('no json'), { code: ErrorCode.LLM_SCHEMA_INVALID });
    const { c, prompts } = ctx([notJson, { language: 'en', headline: 'HI' }]);
    await expect(runScreenwriter(c, ref, spec, 'en')).resolves.toBeTruthy();
    expect(prompts).toHaveLength(2);
  });

  it('keeps the two kinds of retry separate', async () => {
    const { c, prompts } = ctx([{ nope: 1 }, { language: 'en', headline: 'A' }, { language: 'vi', headline: 'B' }]);
    await expect(runScreenwriter(c, ref, spec, 'vi')).resolves.toEqual({ language: 'vi', headline: 'B' });
    expect(prompts).toEqual(['write in vi', 'write in vi', 'write in vi STRICTLY']);
  });

  it('does not retry a provider failure, and marks an uninstalled provider as not worth retrying', async () => {
    const gone = Object.assign(new Error('not installed'), { code: ErrorCode.PROVIDER_NOT_INSTALLED });
    const { c, prompts } = ctx([gone]);
    const err = await runScreenwriter(c, ref, spec, 'en').catch((e: unknown) => e as NodeError);
    expect((err as NodeError).code).toBe(ErrorCode.PROVIDER_NOT_INSTALLED);
    expect((err as NodeError).retryable).toBe(false);
    expect(prompts).toHaveLength(1);
  });
});
