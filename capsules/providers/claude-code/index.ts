import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { z, type ZodTypeAny } from 'zod';
import { claudeCodeSettings } from './settings';
import { registerLLMProvider } from '@/contracts/providers/registry';
import { ErrorCode, NodeError } from '@/contracts/errors';
import { extractJson } from '@/contracts/ai/structured-completion';
import type { LLMCompleteOptions, LLMImage, LLMProvider } from '@/contracts/providers/types';
import type { Capability, LLMRef } from '@/contracts/types/payloads';
import { exec, findBinary } from '@/server/exec';

/**
 * Claude Code provider: calls the locally logged-in `claude` CLI. No API key.
 * Sandboxed: empty temp cwd, tools disabled, single turn, prompt via stdin.
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
        return { installed: missing, authenticated: missing, structuredOutput: missing, vision: missing };
      }
      const v = await exec(bin, { args: ['--version'], timeoutMs: 5000 }).catch(() => null);
      const version = v && v.code === 0 ? v.stdout.trim().split(/\s+/)[0] : undefined;
      const authenticated: Capability = (await looksAuthenticated())
        ? ready
        : { status: 'unavailable', code: 'PROVIDER_NOT_AUTHENTICATED', reason: 'Claude Code is not logged in', fix: 'claude  →  /login' };
      return { installed: ready, authenticated, structuredOutput: ready, vision: ready, version };
    },

    async complete<S extends ZodTypeAny>(prompt: string, outputSchema: S, signal: AbortSignal, options?: LLMCompleteOptions): Promise<z.infer<S>> {
      const bin = await claudeBin();
      if (!bin) throw Object.assign(new Error('Claude Code CLI not found'), { code: 'PROVIDER_NOT_INSTALLED' });
      const cwd = await mkdtemp(path.join(os.tmpdir(), 'nodecine-claude-'));
      try {
        const images = options?.images ?? [];
        // With pictures the prompt goes as one streamed user message whose content holds them; the
        // answer then comes back as a stream whose last line is the same result envelope.
        const args = images.length
          ? ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--max-turns', '1', '--tools', '']
          : ['-p', '--output-format', 'json', '--max-turns', '1', '--tools', ''];
        const model = settings.model as string | undefined;
        if (model) args.push('--model', model);
        const stdin = images.length ? `${JSON.stringify({ type: 'user', message: { role: 'user', content: [...(await imageBlocks(images, cwd, signal)), { type: 'text', text: prompt }] } })}\n` : prompt;
        const r = await exec(bin, { args, stdin, cwd, timeoutMs: CLAUDE_TIMEOUT_MS, signal, maxOutput: images.length ? 4 * 1024 * 1024 : 256 * 1024 });
        if (r.timedOut) {
          // A killed process exits with a null code and an empty stderr, so without this the failure
          // read as "claude exited null:" — true, useless, and impossible to act on.
          throw new NodeError('LLM_UPSTREAM', `claude did not answer within ${Math.round(CLAUDE_TIMEOUT_MS / 1000)}s`, true)
            .withFix(`give it longer with ${CLAUDE_TIMEOUT_ENV}, or ask for less in one go`);
        }
        if (r.code !== 0) {
          let msg = r.stderr.trim();
          if (!msg && r.stdout) {
            try {
              const env = JSON.parse(r.stdout) as { result?: string };
              if (env.result) msg = env.result;
            } catch {
              msg = r.stdout.trim();
            }
          }
          throw new NodeError('LLM_UPSTREAM', `claude exited ${r.code}: ${msg || 'no output'}`, true);
        }
        const envelope = (images.length ? resultLine(r.stdout) : JSON.parse(r.stdout)) as { result?: string; is_error?: boolean };
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

/** The last line of a streamed answer that carries the result envelope. */
function resultLine(stdout: string): unknown {
  const line = stdout.trim().split('\n').reverse().find((l) => l.includes('"type":"result"'));
  if (!line) throw Object.assign(new Error('claude returned no result'), { code: 'LLM_UPSTREAM' });
  return JSON.parse(line);
}

/** The longest side a picture is sent at: what the model reads at full detail, and well under its size limit. */
const IMAGE_LONG_SIDE = 1568;

/**
 * Pictures as base64 message blocks, each scaled to fit IMAGE_LONG_SIDE and sent as JPEG when ffmpeg
 * is there to do it; a phone screenshot as PNG can be several megabytes, past what one message takes.
 */
async function imageBlocks(images: LLMImage[], dir: string, signal: AbortSignal): Promise<unknown[]> {
  const ffmpeg = await findBinary('ffmpeg', 'NODECINE_FFMPEG_BIN');
  return Promise.all(images.map(async (image, i) => {
    let file = image.path;
    let mediaType = image.mediaType;
    if (ffmpeg && mediaType !== 'image/svg+xml') {
      const out = path.join(dir, `image-${i}.jpg`);
      const fit = `scale='if(gt(iw,ih),min(${IMAGE_LONG_SIDE},iw),-2)':'if(gt(iw,ih),-2,min(${IMAGE_LONG_SIDE},ih))'`;
      const r = await exec(ffmpeg, { args: ['-v', 'error', '-y', '-i', image.path, '-vf', fit, '-q:v', '3', out], timeoutMs: 30_000, signal }).catch(() => null);
      if (r && r.code === 0) { file = out; mediaType = 'image/jpeg'; }
    }
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: (await readFile(file)).toString('base64') } };
  }));
}

export function registerClaudeCode(): void {
  registerLLMProvider({
    id: CLAUDE_CODE_ID,
    displayName: 'Claude Code',
    factory: createClaudeCodeProvider,
    settingsSchema: claudeCodeSettings,
  });
}
