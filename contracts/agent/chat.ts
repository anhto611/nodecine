import type { Graph } from '@/core/engine/graph';
import type { NodeRuntime } from '@/core/engine/state';
import { WORKFLOW_OWNED, type ActionResult, type AgentAction } from './actions';
import { readBlock } from '@/contracts/storyboard/blocks';
import { holdsKit } from './kit';

/**
 * One workflow's conversation with its agent. Each workflow keeps its own: a saved workflow under its
 * file id, a draft under its tab, so two workflows open side by side never share what was said.
 */

export interface AgentMessage {
  id: string;
  at: string;
  /** `event` is something the app tells the agent on its own — a run it started has finished. */
  role: 'user' | 'assistant' | 'event';
  text: string;
  /** On a person's message: the node they had selected, which an unnamed "this" refers to. */
  focus?: string;
  /** On a person's message: the sample video they attached (`contracts/agent/sample.ts`). */
  sample?: { id: string; name: string; seconds: number; segments: number; thumbs: string[] };
  /** On an assistant message: what it did, and how each edit went. */
  actions?: AgentAction[];
  results?: ActionResult[];
  /** On an assistant message that could not be produced: why. */
  error?: { code: string; message: string; fix?: string };
}

export interface AgentChat {
  id: string;
  messages: AgentMessage[];
  updatedAt: string;
}

/** A node's last run, small enough to put in a prompt. */
export interface RuntimeSummary {
  state: string;
  error?: { code: string; message: string; fix?: string };
  warnings?: string[];
  /** Each output port's payload, shortened. */
  outputs?: Record<string, string>;
}

/** The node the person has selected, given to the agent whole rather than shortened. */
export interface NodeFocus {
  nodeId: string;
  /** Each output port's payload as JSON, up to {@link FOCUS_CHARS}. */
  outputs: Record<string, string>;
}

/** How much of the focused node's outputs the agent reads: enough for a whole storyboard. */
export const FOCUS_CHARS = 30_000;

export const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,90}$/;

/** The agent behind a tab: its file's, once it has one. */
export const agentIdFor = (tab: { key: string; fileId: string | null }): string => (tab.fileId ? `wf-${tab.fileId}` : tab.key);

/** JSON, cut to `max` characters with a note of how much was left out. */
export function brief(value: unknown, max: number): string {
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) return '';
  return text.length > max ? `${text.slice(0, max)}…(+${text.length - max} chars)` : text;
}

/** What each node did last, for the agent: state, error, warnings, and a glimpse of its outputs. */
export function summarizeRuntimes(runtimes: Record<string, NodeRuntime | undefined>, outputChars = 400): Record<string, RuntimeSummary> {
  const out: Record<string, RuntimeSummary> = {};
  for (const [id, rt] of Object.entries(runtimes)) {
    if (!rt) continue;
    const s: RuntimeSummary = { state: rt.state };
    if (rt.error) s.error = { code: rt.error.code, message: brief(rt.error.message, 600), ...(rt.error.fix ? { fix: rt.error.fix } : {}) };
    if (rt.blockedBy) s.error = { code: rt.blockedBy.code, message: brief(rt.blockedBy.message, 600), ...(rt.blockedBy.fix ? { fix: rt.blockedBy.fix } : {}) };
    if (rt.warnings?.length) s.warnings = rt.warnings.slice(0, 5).map((w) => brief(w.message, 300));
    const ports = Object.entries(rt.outputs ?? {});
    if (ports.length) s.outputs = Object.fromEntries(ports.map(([port, p]) => [port, brief(p?.payload, outputChars)]));
    out[id] = s;
  }
  return out;
}

/**
 * A parameter value as the agent reads it: long text and long lists shortened, deep structures cut.
 * The agent can always set a value in full; it only reads a shortened one.
 */
export function shortenValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…(+${value.length - 500} chars)` : value;
  if (Array.isArray(value)) {
    if (depth > 3) return `[${value.length} items]`;
    const head = value.slice(0, 12).map((v) => shortenValue(v, depth + 1));
    return value.length > 12 ? [...head, `…(+${value.length - 12} items)`] : head;
  }
  if (value && typeof value === 'object') {
    if (depth > 3) return '{…}';
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shortenValue(v, depth + 1)]));
  }
  return value;
}

/** The selected node's outputs, whole up to {@link FOCUS_CHARS} between them. */
export function focusOf(nodeId: string, runtime: NodeRuntime | undefined, pinned?: Record<string, unknown>): NodeFocus {
  const payloads: [string, unknown][] = runtime && Object.keys(runtime.outputs ?? {}).length ? Object.entries(runtime.outputs).map(([port, p]) => [port, p?.payload]) : Object.entries(pinned ?? {});
  const each = Math.floor(FOCUS_CHARS / Math.max(1, payloads.length));
  return { nodeId, outputs: Object.fromEntries(payloads.map(([port, payload]) => [port, brief(payload, each)])) };
}

/**
 * A kit as the agent reads it: what each block is for and the values it takes, the other files by size.
 * The HTML itself would be cut short and unreadable; what the agent needs is what the kit offers.
 */
export function summarizeKit(files: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([p, text]) => {
      const t = typeof text === 'string' ? text : '';
      const m = /^compositions\/([a-z][a-z0-9-]{1,40})\.html$/.exec(p);
      if (!m) return [p, `${t.length} chars`];
      const b = readBlock(m[1]!, t);
      return [p, `block, ${b.role}: ${b.description || '(no description)'} · values: ${b.variables.map((v) => v.id).join(', ') || 'none'}`];
    }),
  );
}

/** The workflow as the agent reads it: nodes with their parameters, and the wires between them. */
export function summarizeGraph(graph: Graph): { nodes: unknown[]; wires: string[] } {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      ...(n.bypassed ? { bypassed: true } : {}),
      ...(n.pinned ? { pinned: true } : {}),
      params: shortenValue(
        Object.fromEntries(
          Object.entries(n.params)
            .filter(([k]) => !WORKFLOW_OWNED.includes(k))
            .map(([k, v]) => (holdsKit(n.type) && k === 'files' && v && typeof v === 'object' ? [k, summarizeKit(v as Record<string, unknown>)] : [k, v])),
        ),
      ),
    })),
    wires: graph.edges.map((e) => `${e.source}.${e.sourcePort} → ${e.target}.${e.targetPort}`),
  };
}
