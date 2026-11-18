import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerLLMProvider } from '@/contracts/providers/registry';
import type { LLMProvider } from '@/contracts/providers/types';
import { applyAgentActions } from '@/contracts/agent/actions';
import { focusOf, summarizeGraph } from '@/contracts/agent/chat';
import type { Graph } from '@/core/engine/graph';
import { agentPrompt, agentTurn, cancelTurn, moveChat, readChat, writeChat } from '../agent';
import { ensureServerRegistrations } from '../register';
import { migrateGraph } from '@/core/engine/migrate';

/**
 * A workflow's agent answers with edits, never with a graph. Each edit lands or is refused on its
 * own, and the refusal says why, so the next turn can correct it.
 */

const dir = mkdtempSync(path.join(os.tmpdir(), 'nodecine-agents-'));
let answer: unknown = { reply: 'ok', actions: [] };
let prompts: string[] = [];

beforeAll(() => {
  process.env.NODECINE_AGENTS_DIR = dir;
  ensureServerRegistrations();
  const fake: LLMProvider = {
    providerId: 'fake-agent',
    displayName: 'Fake',
    transport: 'cli',
    probe: async () => ({}) as never,
    complete: async (prompt) => {
      prompts.push(prompt);
      return answer as never;
    },
  };
  // Answers only when stopped, the way a model that is still thinking does.
  const slow: LLMProvider = {
    ...fake,
    providerId: 'slow-agent',
    complete: (_p, _s, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('killed'), { code: 'LLM_UPSTREAM' })), { once: true })),
  };
  registerLLMProvider({ id: 'slow-agent', displayName: 'Slow', factory: () => slow, settingsSchema: { safeParse: () => ({ success: true, data: {} }) } as never });
  registerLLMProvider({ id: 'fake-agent', displayName: 'Fake', factory: () => fake, settingsSchema: { safeParse: () => ({ success: true, data: {} }) } as never });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
const idFor = (type: string) => `${type}-${n++}`;
const empty: Graph = { nodes: [], edges: [] };
/** An empty workflow whose model is the fake one. */
const fake: Graph = { nodes: [], edges: [], settings: { llm: { provider: 'fake-agent', settings: {} } } };

describe('applyAgentActions', () => {
  it('adds nodes by ref, wires them and places them left to right', () => {
    const r = applyAgentActions(
      empty,
      [
        { op: 'add', ref: 'b', type: 'brief', params: { about: 'a film about tea' } },
        { op: 'add', ref: 'r', type: 'research' },
        { op: 'connect', from: 'b', fromPort: 'brief', to: 'r', toPort: 'brief' },
      ],
      { idFor },
    );
    expect(r.results.every((x) => x.ok)).toBe(true);
    const [brief, research] = r.graph.nodes;
    expect(brief!.params.about).toBe('a film about tea');
    expect(r.graph.edges).toHaveLength(1);
    expect(r.graph.edges[0]).toMatchObject({ source: brief!.id, target: research!.id });
    expect(research!.position.x).toBeGreaterThan(brief!.position.x);
    expect(r.touched).toContain(research!.id);
  });

  it('refuses what does not exist and keeps going', () => {
    const r = applyAgentActions(
      empty,
      [
        { op: 'add', ref: 'x', type: 'no-such-node' },
        { op: 'add', ref: 'b', type: 'brief', params: { nope: 1 } },
        { op: 'add', ref: 'b2', type: 'brief' },
        { op: 'connect', from: 'b2', fromPort: 'brief', to: 'b2', toPort: 'brief' },
        { op: 'set', node: 'b2', params: { about: 42 } },
        { op: 'run' },
      ],
      { idFor },
    );
    expect(r.results.map((x) => x.ok)).toEqual([false, false, true, false, false, true]);
    expect(r.results[1]!.note).toContain('"nope"');
    expect(r.results[3]!.note).toContain('no input');
    expect(r.graph.nodes).toHaveLength(1);
    expect(r.run).toEqual({ force: false });
  });

  it('removes a node with its wires', () => {
    const first = applyAgentActions(
      empty,
      [
        { op: 'add', ref: 'b', type: 'brief' },
        { op: 'add', ref: 'r', type: 'research' },
        { op: 'connect', from: 'b', fromPort: 'brief', to: 'r', toPort: 'brief' },
      ],
      { idFor },
    );
    const briefId = first.added.b!;
    const r = applyAgentActions(first.graph, [{ op: 'remove', node: briefId }]);
    expect(r.graph.nodes.map((x) => x.type)).toEqual(['research']);
    expect(r.graph.edges).toEqual([]);
  });
});

describe('one model per workflow', () => {
  it('moves the model a node named onto the workflow, and empties every node', () => {
    const graph: Graph = {
      nodes: [
        { id: 'r', type: 'research', params: { llmProvider: 'agy', llmSettings: { model: 'x' } }, bypassed: false, position: { x: 0, y: 0 } },
        { id: 'w', type: 'research', params: { llmProvider: 'codex', llmSettings: {} }, bypassed: false, position: { x: 0, y: 0 } },
      ],
      edges: [],
    };
    const { graph: g, notes } = migrateGraph(graph);
    expect(g.settings?.llm).toEqual({ provider: 'agy', settings: { model: 'x' } });
    expect(g.nodes.map((n) => n.params.llmProvider)).toEqual(['', '']);
    expect(notes.filter((n) => n.code === 'PARAMS_RESET')).toHaveLength(2);
    // Brought forward once: a second pass has nothing left to say.
    expect(migrateGraph(g).notes).toEqual([]);
  });

  it('will not let the agent give one node its own model', () => {
    const r = applyAgentActions(empty, [{ op: 'add', ref: 'r', type: 'research', params: { llmProvider: 'codex' } }], { idFor });
    expect(r.results[0]!.ok).toBe(false);
    expect(r.results[0]!.note).toContain('belongs to the workflow');
  });
});

describe('agent turn', () => {
  it('sends the workflow and the catalog, records what landed', async () => {
    prompts = [];
    await writeChat({ id: 'tab-a', messages: [], updatedAt: '' });
    answer = {
      reply: 'Added a brief.',
      actions: [
        { op: 'add', ref: 'b', type: 'brief' },
        { op: 'remove', node: 'ghost' },
      ],
    };
    const { chat, turn } = await agentTurn('tab-a', { message: { role: 'user', text: 'add a brief' }, workflowName: 'Tea', graph: fake, runtimes: {}, running: false }, new AbortController().signal);
    expect(turn?.actions).toHaveLength(2);
    expect(chat.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(chat.messages[1]!.results!.map((r) => r.ok)).toEqual([true, false]);
    expect(prompts[0]).toContain('- brief "Brief"');
    expect(prompts[0]).toContain('PERSON: add a brief');

    // The next turn sees what was refused.
    answer = { reply: 'fine', actions: [] };
    await agentTurn('tab-a', { message: { role: 'user', text: 'and?' }, workflowName: 'Tea', graph: fake, runtimes: {}, running: false }, new AbortController().signal);
    expect(prompts[1]).toMatch(/✗ remove: no node "ghost"/);
  });

  it("says so when the workflow's model is not installed, and when the answer is not the JSON asked for", async () => {
    const unknown: Graph = { nodes: [], edges: [], settings: { llm: { provider: 'not-installed', settings: {} } } };
    const none = await agentTurn('tab-none', { message: { role: 'user', text: 'hi' }, workflowName: '', graph: unknown, runtimes: {}, running: false }, new AbortController().signal);
    expect(none.turn).toBeNull();
    expect(none.chat.messages.at(-1)!.error!.message).toMatch(/no language model/);

    prompts = [];
    await writeChat({ id: 'tab-bad', messages: [], updatedAt: '' });
    answer = { actions: 'nope' };
    const bad = await agentTurn('tab-bad', { message: { role: 'user', text: 'hi' }, workflowName: '', graph: fake, runtimes: {}, running: false }, new AbortController().signal);
    expect(prompts).toHaveLength(2);
    expect(bad.chat.messages.at(-1)!.error!.code).toBe('LLM_SCHEMA_INVALID');
  });

  it('moves a draft conversation to its file once', async () => {
    await writeChat({ id: 'tab-draft', messages: [{ id: '1', at: '', role: 'user', text: 'hello' }], updatedAt: '' });
    await moveChat('tab-draft', 'wf-tea-1', 'move');
    expect((await readChat('wf-tea-1')).messages[0]!.text).toBe('hello');
    expect((await readChat('tab-draft')).messages).toEqual([]);
  });

  it('gives the selected node whole, and remembers what a message was about', async () => {
    const long = 'y'.repeat(3000);
    const graph: Graph = { ...fake, nodes: [{ id: 'b', type: 'brief', params: { about: long, hint: {} }, bypassed: false, position: { x: 0, y: 0 } }] };
    const focus = focusOf('b', { state: 'success', reused: false, outputs: { brief: { payload: { about: long } } as never } });
    prompts = [];
    await writeChat({ id: 'tab-focus', messages: [], updatedAt: '' });
    answer = { reply: 'ok', actions: [] };
    const { chat } = await agentTurn('tab-focus', { message: { role: 'user', text: 'shorten this' }, workflowName: '', graph, runtimes: {}, running: false, focus }, new AbortController().signal);
    expect(prompts[0]).toContain('THE NODE THE PERSON HAS SELECTED: b (brief)');
    expect(prompts[0]).toContain(`"about":"${long}"`);
    expect(prompts[0]).toContain('PERSON (about b): shorten this');
    expect(chat.messages[0]!.focus).toBe('b');
  });

  it('never shows a long value in full', () => {
    const graph: Graph = { nodes: [{ id: 'b', type: 'brief', params: { about: 'x'.repeat(2000), hint: {} }, bypassed: false, position: { x: 0, y: 0 } }], edges: [] };
    const text = JSON.stringify(summarizeGraph(graph));
    expect(text).toContain('…(+1500 chars)');
    expect(agentPrompt({ id: 'a', messages: [], updatedAt: '' }, { message: { role: 'user', text: 'x' }, workflowName: 'w', graph, runtimes: {}, running: false })).toContain('never copy it back');
  });
});

describe('stopping a turn', () => {
  it('ends the turn from a request of its own, and records the stop', async () => {
    const slowGraph: Graph = { nodes: [], edges: [], settings: { llm: { provider: 'slow-agent', settings: {} } } };
    const pending = agentTurn('tab-stop', { message: { role: 'user', text: 'hi' }, workflowName: '', graph: slowGraph, runtimes: {}, running: false });
    await new Promise((r) => setTimeout(r, 20));
    expect(cancelTurn('tab-stop')).toBe(true);
    const { chat, turn } = await pending;
    expect(turn).toBeNull();
    expect(chat.messages.at(-1)!.error!.code).toBe('CANCELLED');
    expect(cancelTurn('tab-stop')).toBe(false);
  });
});
