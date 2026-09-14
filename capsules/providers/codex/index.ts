import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { z, type ZodTypeAny } from 'zod';
import { codexSettings } from './settings';
import { registerLLMProvider } from '@/contracts/providers/registry';
import { ErrorCode, NodeError } from '@/contracts/errors';
import { extractJson } from '@/contracts/ai/structured-completion';
import type { LLMProvider } from '@/contracts/providers/types';
import type { Capability, LLMRef } from '@/contracts/types/payloads';
import { exec, findBinary } from '@/server/exec';

/**
 * OpenAI Codex CLI provider: calls locally logged-in `codex` CLI.
 * No API key required when logged in. Runs sandboxed in temporary directory with read-only permissions.
 */

export const CODEX_ID = 'codex';

export const CODEX_TIMEOUT_ENV = 'NODECINE_CODEX_TIMEOUT_MS';
export const CODEX_TIMEOUT_MS = Number(process.env[CODEX_TIMEOUT_ENV]) || 600_000;

const ready: Capability = { status: 'ready' };

async function codexBin(): Promise<string | null> {
  return findBinary('codex', 'NODECINE_CODEX_BIN');
}

async function looksAuthenticated(): Promise<boolean> {
  if (process.env.OPENAI_API_KEY) return true;
  try {
    const authFile = path.join(os.homedir(), '.codex', 'auth.json');
    const raw = await readFile(authFile, 'utf8');
    const cfg = JSON.parse(raw) as { tokens?: unknown; OPENAI_API_KEY?: unknown };
    if (cfg.tokens || cfg.OPENAI_API_KEY) return true;
  } catch {
    /* auth file missing or unreadable */
  }
  return false;
}

export function createCodexProvider(settings: Record<string, unknown>): LLMProvider {
  return {
    providerId: CODEX_ID,
    displayName: 'Codex CLI',
    transport: 'cli',

    async probe(): Promise<LLMRef['capabilities']> {
      const bin = await codexBin();
      if (!bin) {
        const missing: Capability = {
          status: 'unavailable',
          code: 'PROVIDER_NOT_INSTALLED',
          reason: 'Codex CLI was not found',
          fix: 'npm install -g @openai/codex',
        };
        return { installed: missing, authenticated: missing, structuredOutput: missing };
      }
      const v = await exec(bin, { args: ['--version'], timeoutMs: 5000 }).catch(() => null);
      const version = v && v.code === 0 ? v.stdout.trim().split(/\s+/)[1] || v.stdout.trim() : undefined;
      const authenticated: Capability = (await looksAuthenticated())
        ? ready
        : {
            status: 'unavailable',
            code: 'PROVIDER_NOT_AUTHENTICATED',
            reason: 'Codex CLI is not logged in',
            fix: 'codex login',
          };
      return { installed: ready, authenticated, structuredOutput: ready, version };
    },

    async complete<S extends ZodTypeAny>(prompt: string, outputSchema: S, signal: AbortSignal): Promise<z.infer<S>> {
      const bin = await codexBin();
      if (!bin) throw Object.assign(new Error('Codex CLI not found'), { code: 'PROVIDER_NOT_INSTALLED' });
      const cwd = await mkdtemp(path.join(os.tmpdir(), 'nodecine-codex-'));
      const outFile = path.join(cwd, 'last-message.txt');
      try {
        const args = ['exec', '--ephemeral', '--skip-git-repo-check', '-s', 'read-only', '-o', outFile];
        const model = settings.model as string | undefined;
        if (model) args.push('-m', model);
        args.push(prompt);

        const r = await exec(bin, {
          args,
          stdin: '',
          cwd,
          timeoutMs: CODEX_TIMEOUT_MS,
          signal,
          maxOutput: 512 * 1024,
        });

        if (r.timedOut) {
          throw new NodeError('LLM_UPSTREAM', `codex did not answer within ${Math.round(CODEX_TIMEOUT_MS / 1000)}s`, true)
            .withFix(`give it longer with ${CODEX_TIMEOUT_ENV}`);
        }
        if (r.code !== 0) {
          throw new NodeError('LLM_UPSTREAM', `codex exited ${r.code}: ${r.stderr.trim() || r.stdout.trim() || 'no output'}`, true);
        }

        const lastMessage = await readFile(outFile, 'utf8').catch(() => '');
        const raw = lastMessage.trim() || r.stdout.trim();
        if (!raw) throw Object.assign(new Error('codex returned empty output'), { code: 'LLM_UPSTREAM' });

        const text = extractJson(raw);
        const parsed = outputSchema.safeParse(JSON.parse(text));
        if (!parsed.success) {
          throw Object.assign(new Error(parsed.error.issues.map((i) => i.message).join('; ')), {
            code: ErrorCode.LLM_SCHEMA_INVALID,
            raw,
          });
        }
        return parsed.data as z.infer<S>;
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    },
  };
}

export function registerCodex(): void {
  registerLLMProvider({
    id: CODEX_ID,
    displayName: 'Codex CLI',
    factory: createCodexProvider,
    settingsSchema: codexSettings,
  });
}
