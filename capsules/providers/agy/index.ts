import { z, type ZodTypeAny } from 'zod';
import { agySettings } from './settings';
import { registerLLMProvider } from '@/contracts/providers/registry';
import { ErrorCode, NodeError } from '@/contracts/errors';
import { extractJson } from '@/contracts/ai/structured-completion';
import type { LLMProvider } from '@/contracts/providers/types';
import type { Capability, LLMRef } from '@/contracts/types/payloads';
import { exec, findBinary } from '@/server/exec';

/**
 * Google Antigravity (agy) CLI provider: calls local `agy` CLI non-interactively.
 * Supports Gemini and Claude models configured in Antigravity.
 */

export const AGY_ID = 'agy';

export const AGY_TIMEOUT_ENV = 'NODECINE_AGY_TIMEOUT_MS';
export const AGY_TIMEOUT_MS = Number(process.env[AGY_TIMEOUT_ENV]) || 600_000;

const ready: Capability = { status: 'ready' };

async function agyBin(): Promise<string | null> {
  return findBinary('agy', 'NODECINE_AGY_BIN');
}

/**
 * Whether agy looks signed in. There is no cheap way to ask it, so this says yes and lets the first
 * call report a missing login.
 */
async function looksAuthenticated(): Promise<boolean> {
  return true;
}

export function createAgyProvider(settings: Record<string, unknown>): LLMProvider {
  return {
    providerId: AGY_ID,
    displayName: 'Antigravity (agy)',
    transport: 'cli',

    async probe(): Promise<LLMRef['capabilities']> {
      const bin = await agyBin();
      if (!bin) {
        const missing: Capability = {
          status: 'unavailable',
          code: 'PROVIDER_NOT_INSTALLED',
          reason: 'agy CLI was not found',
          fix: 'Install Google Antigravity CLI (agy)',
        };
        return { installed: missing, authenticated: missing, structuredOutput: missing };
      }
      const v = await exec(bin, { args: ['--version'], timeoutMs: 5000 }).catch(() => null);
      const version = v && v.code === 0 ? v.stdout.trim() : undefined;
      const authenticated: Capability = (await looksAuthenticated())
        ? ready
        : {
            status: 'unavailable',
            code: 'PROVIDER_NOT_AUTHENTICATED',
            reason: 'agy CLI is not authenticated',
          };
      return { installed: ready, authenticated, structuredOutput: ready, version };
    },

    async complete<S extends ZodTypeAny>(prompt: string, outputSchema: S, signal: AbortSignal): Promise<z.infer<S>> {
      const bin = await agyBin();
      if (!bin) throw Object.assign(new Error('agy CLI not found'), { code: 'PROVIDER_NOT_INSTALLED' });
      const args = ['-p', prompt, '--output-format', 'text', '--dangerously-skip-permissions', '--disable-slash-commands'];
      const model = settings.model as string | undefined;
      if (model) args.push('--model', model);
      const effort = settings.effort as string | undefined;
      if (effort) args.push('--effort', effort);

      const r = await exec(bin, {
        args,
        stdin: '',
        timeoutMs: AGY_TIMEOUT_MS,
        signal,
        maxOutput: 1024 * 1024,
      });

      if (r.timedOut) {
        throw new NodeError('LLM_UPSTREAM', `agy did not answer within ${Math.round(AGY_TIMEOUT_MS / 1000)}s`, true)
          .withFix(`give it longer with ${AGY_TIMEOUT_ENV}`);
      }
      if (r.code !== 0) {
        throw new NodeError('LLM_UPSTREAM', `agy exited ${r.code}: ${r.stderr.trim() || r.stdout.trim() || 'no output'}`, true);
      }

      const raw = r.stdout.trim();
      if (!raw) throw Object.assign(new Error('agy returned empty output'), { code: 'LLM_UPSTREAM' });

      const text = extractJson(raw);
      const parsed = outputSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        throw Object.assign(new Error(parsed.error.issues.map((i) => i.message).join('; ')), {
          code: ErrorCode.LLM_SCHEMA_INVALID,
          raw,
        });
      }
      return parsed.data as z.infer<S>;
    },
  };
}

export function registerAgy(): void {
  registerLLMProvider({
    id: AGY_ID,
    displayName: 'Antigravity (agy)',
    factory: createAgyProvider,
    settingsSchema: agySettings,
  });
}
