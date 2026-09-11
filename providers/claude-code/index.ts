import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { z, type ZodTypeAny } from 'zod';
import { claudeCodeSettings } from './settings';
import { registerLLMProvider } from '@/core/providers/registry';
import { ErrorCode, NodeError } from '@/core/errors';
import { extractJson } from '@/core/ai/structured-completion';
import type { LLMProvider } from '@/core/providers/types';
import type { Capability, LLMRef } from '@/core/types/payloads';
import { exec, findBinary } from '@/server/exec';

/**
 * Claude Code provider (CORE_CONTRACTS §7): calls the locally logged-in `claude` CLI. No API key.
 * Sandboxed per ARCHITECTURE §8.3: empty temp cwd, tools disabled, single turn, prompt via stdin.
 * `complete()` is exercised by the Screenwriter; Phase A only needs `probe()`.
 */

export const CLAUDE_CODE_ID = 'claude-code';

export const CLAUDE_TIMEOUT_ENV = 'NODECINE_CLAUDE_TIMEOUT_MS';

/**
 * How long one call may take. Two minutes was the first guess and it was wrong: writing a script
 * fits inside it, but drawing a whole scene as HTML does not, and the fourth scene of a five-scene
 * film was being killed mid-answer. Ten minutes is long enough for the longest thing this app asks
 * for, and the run is cancellable anyway, so a person is never actually stuck waiting it out.
 */
export const CLAUDE_TIMEOUT_MS = Number(process.env[CLAUDE_TIMEOUT_ENV]) || 600_000;
const ready: Capability = { status: 'ready' };

async function claudeBin(): Promise<string | null> {
  return findBinary('claude', 'NODECINE_CLAUDE_BIN');
}

/**
 * Cheap login check without spending a request: Claude Code keeps its OAuth account in
 * ~/.claude.json (and credentials in the macOS keychain). An API key in the environment also counts.
 * This is a heuristic; the definitive answer comes from the first real completion.
 */
async function looksAuthenticated(): Promise<boolean> {
  if (process.env.ANTHROPIC_API_KEY) return true;
  try {
    const raw = await readFile(path.join(os.homedir(), '.claude.json'), 'utf8');
    const cfg = JSON.parse(raw) as { oauthAccount?: unknown };
    if (cfg.oauthAccount) return true;
  } catch {
    /* no config file */
  }
  if (os.platform() === 'darwin') {
    const r = await exec('/usr/bin/security', { args: ['find-generic-password', '-s', 'Claude Code-credentials'], timeoutMs: 3000 }).catch(() => null);
    if (r && r.code === 0) return true;
  }
  return false;
}

export function createClaudeCodeProvider(settings: Record<string, unknown>): LLMProvider {
  return {
    providerId: CLAUDE_CODE_ID,
    displayName: 'Claude Code',
    transport: 'cli',

    async probe(): Promise<LLMRef['capabilities']> {
      const bin = await claudeBin();
      if (!bin) {
        const missing: Capability = { status: 'unavailable', code: 'PROVIDER_NOT_INSTALLED', reason: 'Claude Code CLI was not found', fix: 'npm install -g @anthropic-ai/claude-code' };
        return { installed: missing, authenticated: missing, structuredOutput: missing };
      }
      const v = await exec(bin, { args: ['--version'], timeoutMs: 5000 }).catch(() => null);
      const version = v && v.code === 0 ? v.stdout.trim().split(/\s+/)[0] : undefined;
      const authenticated: Capability = (await looksAuthenticated())
        ? ready
        : { status: 'unavailable', code: 'PROVIDER_NOT_AUTHENTICATED', reason: 'Claude Code is not logged in', fix: 'claude  →  /login' };
      return { installed: ready, authenticated, structuredOutput: ready, version };
    },

    async complete<S extends ZodTypeAny>(prompt: string, outputSchema: S, signal: AbortSignal): Promise<z.infer<S>> {
      const bin = await claudeBin();
      if (!bin) throw Object.assign(new Error('Claude Code CLI not found'), { code: 'PROVIDER_NOT_INSTALLED' });
      const cwd = await mkdtemp(path.join(os.tmpdir(), 'nodecine-claude-'));
      try {
        const args = ['-p', '--output-format', 'json', '--max-turns', '1', '--tools', ''];
        const model = settings.model as string | undefined;
        if (model) args.push('--model', model);
        const r = await exec(bin, { args, stdin: prompt, cwd, timeoutMs: CLAUDE_TIMEOUT_MS, signal, maxOutput: 256 * 1024 });
        if (r.timedOut) {
          // A killed process exits with a null code and an empty stderr, so without this the failure
          // read as "claude exited null:" — true, useless, and impossible to act on.
          throw new NodeError('LLM_UPSTREAM', `claude did not answer within ${Math.round(CLAUDE_TIMEOUT_MS / 1000)}s`, true)
            .withFix(`give it longer with ${CLAUDE_TIMEOUT_ENV}, or ask for less in one go`);
        }
        if (r.code !== 0) throw new NodeError('LLM_UPSTREAM', `claude exited ${r.code}: ${r.stderr.trim() || 'no output'}`, true);
        const envelope = JSON.parse(r.stdout) as { result?: string; is_error?: boolean };
        if (envelope.is_error || typeof envelope.result !== 'string') throw Object.assign(new Error('claude returned an error envelope'), { code: 'LLM_UPSTREAM' });
        const text = extractJson(envelope.result);
        const parsed = outputSchema.safeParse(JSON.parse(text));
        if (!parsed.success) throw Object.assign(new Error(parsed.error.issues.map((i) => i.message).join('; ')), { code: ErrorCode.LLM_SCHEMA_INVALID, raw: envelope.result });
        return parsed.data as z.infer<S>;
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    },
  };
}

export function registerClaudeCode(): void {
  registerLLMProvider({
    id: CLAUDE_CODE_ID,
    displayName: 'Claude Code',
    factory: createClaudeCodeProvider,
    settingsSchema: claudeCodeSettings,
  });
}
