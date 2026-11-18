import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z, type ZodTypeAny } from 'zod';
import { listNodeTypes } from '@/core/nodes/definition';
import type { Graph } from '@/core/engine/graph';
import { getLLMProviderFactory } from '@/contracts/providers/registry';
import { workflowModel } from '@/contracts/workflow-model';
import { firstModel } from './workflow-model';
import { ErrorCode, toNodeError } from '@/contracts/errors';
import { AgentTurnSchema, applyAgentActions, WORKFLOW_OWNED, type AgentTurn } from '@/contracts/agent/actions';
import { AGENT_ID, brief, FOCUS_CHARS, summarizeGraph, type NodeFocus, type AgentChat, type AgentMessage, type RuntimeSummary } from '@/contracts/agent/chat';
import { NODE_TRANSLATIONS } from '@/capsules/nodes/.generated/locales';
import { ensureServerRegistrations } from './register';

/**
 * Each workflow's own agent, on the server: its conversation on disk, and one turn of it.
 *
 * A turn is one question to whichever language model the workflow's agent was given, through the same
 * providers the nodes use: the workflow as it stands, what its nodes did on their last run, the node
 * types there are, and the conversation so far go in; a reply and a list of edits come out. Nothing
 * here keeps a model session open, so every provider can be an agent, and a conversation survives a
 * restart because it was only ever a file.
 */

export function agentsDir(): string {
  return path.resolve(process.cwd(), process.env.NODECINE_AGENTS_DIR ?? '.nodecine/agents');
}

function fileFor(id: string): string {
  if (!AGENT_ID.test(id)) throw Object.assign(new Error(`invalid agent id "${id}"`), { code: 'AGENT_ID_INVALID' });
  return path.join(agentsDir(), `${id}.json`);
}

/** Messages kept on disk per workflow, and how many of the latest go into a prompt. */
const KEEP = 400;
const RECALL = 30;

export async function readChat(id: string): Promise<AgentChat> {
  try {
    const chat = JSON.parse(await readFile(fileFor(id), 'utf8')) as AgentChat;
    return { ...chat, id, messages: Array.isArray(chat.messages) ? chat.messages : [] };
  } catch (e) {
    if ((e as { code?: string }).code === 'AGENT_ID_INVALID') throw e;
    return { id, messages: [], updatedAt: new Date(0).toISOString() };
  }
}

export async function writeChat(chat: AgentChat): Promise<AgentChat> {
  const target = fileFor(chat.id);
  // Files from before the workflow had its own model carried the agent's; that choice now lives on the workflow.
  const out: AgentChat = { id: chat.id, messages: chat.messages.slice(-KEEP), updatedAt: new Date().toISOString() };
  await mkdir(agentsDir(), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now().toString(36)}.tmp`;
  await writeFile(tmp, JSON.stringify(out, null, 2), 'utf8');
  await rename(tmp, target);
  return out;
}

export async function deleteChat(id: string): Promise<void> {
  await rm(fileFor(id), { force: true });
}

/** A draft saved for the first time takes its conversation with it; a copy saved under a new name starts with one. */
export async function moveChat(from: string, to: string, mode: 'move' | 'copy'): Promise<AgentChat> {
  const src = await readChat(from);
  const dst = await readChat(to);
  if (dst.messages.length) return dst;
  const out = await writeChat({ ...src, id: to });
  if (mode === 'move') await deleteChat(from);
  return out;
}

// ---------- the prompt ----------

/** A zod schema as a short type, for the model: `string`, `"a" | "b"`, `{ x: number }`. */
export function describeSchema(schema: ZodTypeAny, depth = 0): string {
  const def = schema._def as { typeName?: string } & Record<string, unknown>;
  switch (def.typeName) {
    case 'ZodDefault':
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodCatch':
    case 'ZodBranded':
    case 'ZodReadonly':
      return describeSchema(def.innerType as ZodTypeAny, depth);
    case 'ZodEffects':
      return describeSchema(def.schema as ZodTypeAny, depth);
    case 'ZodPipeline':
      return describeSchema(def.in as ZodTypeAny, depth);
    case 'ZodLazy':
      return 'object';
    case 'ZodString':
      return 'string';
    case 'ZodNumber': {
      const checks = (def.checks as { kind: string; value?: number }[] | undefined) ?? [];
      const int = checks.some((c) => c.kind === 'int');
      const min = checks.find((c) => c.kind === 'min')?.value;
      const max = checks.find((c) => c.kind === 'max')?.value;
      return `${int ? 'int' : 'number'}${min !== undefined || max !== undefined ? ` ${min ?? ''}..${max ?? ''}` : ''}`;
    }
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodLiteral':
      return JSON.stringify(def.value);
    case 'ZodEnum':
      return (def.values as string[]).map((v) => JSON.stringify(v)).join(' | ');
    case 'ZodArray':
      return `${describeSchema(def.type as ZodTypeAny, depth + 1)}[]`;
    case 'ZodRecord':
      return `Record<string, ${describeSchema(def.valueType as ZodTypeAny, depth + 1)}>`;
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion': {
      const options = (Array.isArray(def.options) ? def.options : [...(def.options as Map<unknown, ZodTypeAny>).values()]) as ZodTypeAny[];
      return depth > 2 ? 'union' : options.map((o) => describeSchema(o, depth + 1)).join(' | ');
    }
    case 'ZodObject': {
      if (depth > 2) return 'object';
      const shape = (schema as z.AnyZodObject).shape as Record<string, ZodTypeAny>;
      return `{ ${Object.entries(shape)
        .map(([k, v]) => `${k}: ${describeSchema(v, depth + 1)}`)
        .join('; ')} }`;
    }
    default:
      return 'any';
  }
}

/** Every node type, as the agent needs to know it to use it. */
export function nodeCatalog(): string {
  ensureServerRegistrations();
  const en = NODE_TRANSLATIONS.en ?? {};
  return listNodeTypes()
    .map((def) => {
      const shape = (def.paramsSchema as unknown as { shape?: Record<string, ZodTypeAny> }).shape ?? {};
      const params = Object.entries(shape)
        .filter(([k]) => !WORKFLOW_OWNED.includes(k))
        .map(([k, v]) => `    ${k}: ${describeSchema(v)} = ${brief((def.defaultParams as Record<string, unknown>)[k], 80)}`);
      const port = (p: { name: string; type: string; required?: boolean; multiple?: boolean }) => `${p.name}:${p.type}${p.multiple ? '[many]' : ''}${p.required === false ? '?' : ''}`;
      return [
        `- ${def.type} "${en[`node.${def.type}`] ?? def.type}" (${def.kind})`,
        en[`node.desc.${def.type}`] ? `  ${en[`node.desc.${def.type}`]}` : '',
        `  inputs: ${def.inputs.map(port).join(', ') || '—'}  outputs: ${def.outputs.map(port).join(', ') || '—'}`,
        params.length ? `  params:\n${params.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
}

export interface TurnInput {
  /** What the person wrote, or what the app reports on its own (a run finished). */
  message: { role: 'user' | 'event'; text: string };
  workflowName: string;
  graph: Graph;
  runtimes: Record<string, RuntimeSummary>;
  running: boolean;
  /** The node the person has selected on the canvas, if any. */
  focus?: NodeFocus;
}

/** The selected node in full: its parameters unshortened, and what it produced. */
function focusSection(input: TurnInput): string {
  const node = input.focus && input.graph.nodes.find((n) => n.id === input.focus!.nodeId);
  if (!node || !input.focus) return '';
  const ports = Object.entries(input.focus.outputs);
  return `

THE NODE THE PERSON HAS SELECTED: ${node.id} (${node.type})
When they say "this", "it", "here" or name no node, they mean this one. Its values below are whole, not shortened, so you may copy and edit them.
params: ${brief(node.params, FOCUS_CHARS)}
${ports.length ? ports.map(([port, text]) => `output ${port}: ${text}`).join('\n') : 'outputs: none yet (it has not run in this session)'}`;
}

function historyLines(messages: AgentMessage[]): string {
  return messages
    .slice(-RECALL)
    .map((m) => {
      if (m.role === 'user') return `PERSON${m.focus ? ` (about ${m.focus})` : ''}: ${brief(m.text, 2000)}`;
      if (m.role === 'event') return `APP: ${brief(m.text, 2000)}`;
      if (m.error) return `YOU (failed): ${m.error.message}`;
      const done = (m.results ?? []).map((r) => `${r.ok ? '✓' : '✗'} ${r.note}`).join('; ');
      return `YOU: ${brief(m.text, 2000)}${done ? `\n  edits: ${done}` : ''}`;
    })
    .join('\n');
}

export function agentPrompt(chat: AgentChat, input: TurnInput): string {
  return `You are the agent that looks after one NodeCine workflow, named "${input.workflowName}". NodeCine is a node-based video studio: a workflow is a graph of nodes wired output → input, and running it turns a brief into a video. The person you talk to may not code; never ask them to edit JSON, HTML or storyboard text — you make the changes yourself.

You can change the workflow and run it. Answer with ONE JSON object and nothing else:
{"reply": "<what you say to the person>", "actions": [<edits, in order>]}

Edits (node = an existing node id, or the ref of a node you add earlier in the same list):
  {"op":"add","ref":"<short name>","type":"<node type>","params":{…}}   params are optional, defaults fill the rest
  {"op":"remove","node":"…"}
  {"op":"set","node":"…","params":{"<param>": <full new value>}}   merged into the node's params
  {"op":"connect","from":"…","fromPort":"…","to":"…","toPort":"…"}   port types must match; an input takes one wire unless marked [many]
  {"op":"disconnect","to":"…","toPort":"…","from":"…"(optional)}
  {"op":"bypass","node":"…","bypassed":true|false}
  {"op":"run"} or {"op":"run","force":true}   run the whole workflow after the edits (force ignores cached results)
  {"op":"runNode","node":"…"}

Rules:
- Only use node types, ports and params from the catalog. Values must fit the param types.
- A value shown shortened, ending in "…(+N chars)", is not the real value: never copy it back. Set a param only with a full value you wrote.
- Do what the person asked and no more. If something is unclear and an edit could lose their work, ask instead of acting (actions: []).
- When you run the workflow, the app tells you how it went in a message starting with APP; then explain the outcome briefly, and fix and re-run only when the cause is clear and in your power.
- Your edits from earlier turns are listed with ✓ (applied) or ✗ (refused, with why): correct the refused ones rather than assuming they landed.
- Keep "reply" short and plain. Write it in the language the person writes in.

NODE CATALOG
${nodeCatalog()}

THE WORKFLOW NOW
${JSON.stringify(summarizeGraph(input.graph))}

LAST RUN, PER NODE${input.running ? ' (a run is going on right now)' : ''}
${Object.keys(input.runtimes).length ? JSON.stringify(input.runtimes) : 'nothing has run yet in this session'}

CONVERSATION SO FAR
${historyLines(chat.messages) || '(none)'}${focusSection(input)}

${input.message.role === 'user' ? `PERSON${input.focus ? ` (about ${input.focus.nodeId})` : ''}` : 'APP'}: ${input.message.text}`;
}

const RAW = z.unknown();
let seq = 0;
const messageId = () => `m-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * One turn: the message goes on the record, the model answers, its edits are tried against the graph
 * it was sent so the record says which landed, and the answer goes on the record too.
 */
/**
 * The turns being answered now, by agent id, so Stop can end one from a request of its own. Stopping
 * by closing the turn's own request was not enough: the browser's abort surfaced as an error in the
 * page, and a closed request does not always reach a route handler in development.
 */
const inFlight = new Map<string, AbortController>();

/** Stop the turn this agent is answering, if any. */
export function cancelTurn(id: string): boolean {
  const controller = inFlight.get(id);
  controller?.abort();
  return !!controller;
}

export async function agentTurn(id: string, input: TurnInput, closed?: AbortSignal): Promise<{ chat: AgentChat; turn: AgentTurn | null }> {
  // A turn ends when it is stopped or when its request goes away, whichever comes first.
  inFlight.get(id)?.abort();
  const controller = new AbortController();
  inFlight.set(id, controller);
  closed?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    return await answerTurn(id, input, controller.signal);
  } finally {
    if (inFlight.get(id) === controller) inFlight.delete(id);
  }
}

async function answerTurn(id: string, input: TurnInput, signal: AbortSignal): Promise<{ chat: AgentChat; turn: AgentTurn | null }> {
  ensureServerRegistrations();
  let chat = await readChat(id);
  const asked: AgentMessage = {
    id: messageId(),
    at: new Date().toISOString(),
    role: input.message.role,
    text: input.message.text,
    ...(input.focus && input.message.role === 'user' ? { focus: input.focus.nodeId } : {}),
  };
  const prompt = agentPrompt(chat, input);
  chat = { ...chat, messages: [...chat.messages, asked] };

  const answer = (m: Omit<AgentMessage, 'id' | 'at' | 'role'>): AgentMessage => ({ id: messageId(), at: new Date().toISOString(), role: 'assistant', ...m });
  // The agent thinks with the workflow's own model, the one its nodes write with unless they name another.
  const model = workflowModel(input.graph, firstModel());
  const factory = model ? getLLMProviderFactory(model.provider) : undefined;
  if (!model || !factory) {
    chat = await writeChat({
      ...chat,
      messages: [...chat.messages, answer({ text: '', error: { code: ErrorCode.INPUT_EMPTY, message: 'this workflow has no language model', fix: 'choose one at the top of the agent panel' } })],
    });
    return { chat, turn: null };
  }

  let turn: AgentTurn | null = null;
  let failure: AgentMessage['error'];
  const provider = factory(model.settings);
  // One retry for an answer that is not the JSON asked for, the same allowance the nodes give.
  for (let attempt = 0; attempt < 2 && !turn; attempt++) {
    try {
      const raw = await provider.complete(attempt ? `${prompt}\n\nYour last answer was not the JSON object asked for. Answer with that JSON object only.` : prompt, RAW, signal);
      const parsed = AgentTurnSchema.safeParse(typeof raw === 'string' ? { reply: raw, actions: [] } : raw);
      if (parsed.success) turn = parsed.data;
      else
        failure = {
          code: ErrorCode.LLM_SCHEMA_INVALID,
          message: parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.') || '$'}: ${i.message}`)
            .join('; '),
        };
    } catch (e) {
      if (signal.aborted) {
        failure = { code: 'CANCELLED', message: 'stopped' };
        break;
      }
      const err = toNodeError(e, ErrorCode.LLM_UPSTREAM);
      failure = { code: err.code, message: err.message, ...(err.fix ? { fix: err.fix } : {}) };
      if (err.code !== ErrorCode.LLM_SCHEMA_INVALID) break;
    }
  }

  if (!turn) {
    chat = await writeChat({ ...chat, messages: [...chat.messages, answer({ text: '', error: failure ?? { code: ErrorCode.LLM_UPSTREAM, message: 'no answer' } })] });
    return { chat, turn: null };
  }
  const { results } = applyAgentActions(input.graph, turn.actions);
  chat = await writeChat({ ...chat, messages: [...chat.messages, answer({ text: turn.reply, ...(turn.actions.length ? { actions: turn.actions, results } : {}) })] });
  return { chat, turn };
}
