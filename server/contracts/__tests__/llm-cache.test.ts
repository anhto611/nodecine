import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { registerLLMProvider } from '@/contracts/providers/registry';
import type { LLMProvider } from '@/contracts/providers/types';
import type { LLMRef } from '@/contracts/types/payloads';

/**
 * The answers the server keeps on disk are keyed by what was asked *and* by the provider that was
 * asked. The settings are part of "who was asked": two
 * models are two providers as far as an answer is concerned.
 */

const cacheDir = mkdtempSync(path.join(os.tmpdir(), 'nodecine-llm-cache-'));
let asked: string[] = [];

beforeAll(() => {
  process.env.NODECINE_CACHE_DIR = cacheDir;
  registerLLMProvider({
    id: 'test-echo',
    displayName: 'Echo',
    settingsSchema: z.object({ model: z.string() }),
    factory: (settings): LLMProvider => ({
      providerId: 'test-echo',
      displayName: 'Echo',
      transport: 'cli',
      probe: async () => ({ installed: { status: 'ready' }, authenticated: { status: 'ready' }, structuredOutput: { status: 'ready' } }),
      complete: async () => {
        const model = String(settings.model);
        asked.push(model);
        return { model };
      },
    }),
  });
});

afterAll(() => {
  delete process.env.NODECINE_CACHE_DIR;
  rmSync(cacheDir, { recursive: true, force: true });
});

const Answer = z.object({ model: z.string() });
const refFor = (model: string) => ({ providerId: 'test-echo', settings: { model } }) as unknown as LLMRef;

describe('the model-answer cache', () => {
  it('asks once for the same prompt, and asks again when the provider is set up differently', async () => {
    const { createServerServices } = await import('@/server/contracts/services.server');
    const services = createServerServices();
    const signal = new AbortController().signal;
    asked = [];

    const first = await services.complete(refFor('small'), 'name a colour', Answer, signal);
    expect(first.model).toBe('small');
    expect(asked).toEqual(['small']);

    // Same question, same provider, same settings: the answer comes off disk.
    const again = await services.complete(refFor('small'), 'name a colour', Answer, signal);
    expect(again.model).toBe('small');
    expect(asked).toEqual(['small']);

    // Switching the model on the Provider node has to reach the model. With the settings left out
    // of the key, this handed back the small model's answer and nothing said so.
    const bigger = await services.complete(refFor('large'), 'name a colour', Answer, signal);
    expect(bigger.model).toBe('large');
    expect(asked).toEqual(['small', 'large']);
  });

  it('`fresh` asks again even when the answer is on disk', async () => {
    const { createServerServices } = await import('@/server/contracts/services.server');
    const services = createServerServices();
    const signal = new AbortController().signal;
    asked = [];

    await services.complete(refFor('small'), 'name a fruit', Answer, signal);
    await services.complete(refFor('small'), 'name a fruit', Answer, signal, { fresh: true });
    expect(asked).toEqual(['small', 'small']);
  });
});
