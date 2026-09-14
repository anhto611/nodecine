import { ErrorCode, NodeError } from '@/contracts/errors';
import type { NodeServices } from '@/core/engine/services';
import type { EngineRef, LLMRef, TTSRef } from './types/payloads';
import { readCapability } from '@/core/nodes/definition';

/**
 * A node's own model, voice or engine (CORE_CONTRACTS §1.3).
 *
 * These used to be nodes of their own, wired in on a second kind of port: one Language Model node
 * feeding five others. It made the graph read as a machine with parts, but it cost every workflow
 * four nodes and a dozen wires before a single frame was drawn, and it put the reason a node could
 * not run in a different node from the one that failed. A node now names what it needs and probes it
 * itself, so a graph is inputs and outputs and nothing else.
 *
 * The capability check that the executor used to make on the wire is made here instead, with the
 * same codes and the same remedies: a provider that is installed but not signed in still says so,
 * and says it on the node that wanted it.
 */

const need = (ref: unknown, keys: readonly string[], what: string): void => {
  for (const key of keys) {
    const cap = readCapability(ref, key);
    if (!cap || cap.status !== 'ready') {
      throw new NodeError(cap?.code ?? ErrorCode.ENGINE_NOT_READY, cap?.reason ?? `${what} is not ready: "${key}" is unavailable`, true).withFix(cap?.fix ?? `open the node and choose a ${what} this machine can use`);
    }
  }
};

export const LLM_NEEDS = ['installed', 'authenticated'] as const;
export const TTS_NEEDS = ['installed', 'encoder'] as const;

/** The language model this node writes with. `requires` is empty for a step that can do without one. */
export async function resolveLLM(services: Pick<NodeServices, 'probeLLM'>, params: { llmProvider: string; llmSettings?: Record<string, unknown> }, requires: readonly string[] = LLM_NEEDS): Promise<LLMRef> {
  if (!params.llmProvider.trim()) throw new NodeError(ErrorCode.INPUT_EMPTY, 'no language model chosen', false).withFix('choose a language model on this node');
  const ref = await services.probeLLM(params.llmProvider, params.llmSettings ?? {});
  need(ref, requires, 'language model');
  return ref;
}

/** The voice this node speaks with. */
export async function resolveTTS(services: Pick<NodeServices, 'probeTTS'>, params: { ttsProvider: string; ttsSettings?: Record<string, unknown> }, requires: readonly string[] = TTS_NEEDS): Promise<TTSRef> {
  if (!params.ttsProvider.trim()) throw new NodeError(ErrorCode.INPUT_EMPTY, 'no voice chosen', false).withFix('choose a voice on this node');
  const ref = await services.probeTTS(params.ttsProvider, params.ttsSettings ?? {});
  need(ref, requires, 'voice');
  return ref;
}

/** The engine this node draws with: `preview` to show a film, `render` to write a file. */
export async function resolveEngine(services: Pick<NodeServices, 'probeEngine'>, params: { engineId: string; engineSettings?: Record<string, unknown> }, requires: readonly string[]): Promise<EngineRef> {
  if (!params.engineId.trim()) throw new NodeError(ErrorCode.INPUT_EMPTY, 'no engine chosen', false).withFix('choose an engine on this node');
  const ref = await services.probeEngine(params.engineId, params.engineSettings ?? {});
  need(ref, requires, 'engine');
  return ref;
}
