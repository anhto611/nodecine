'use client';
import { create } from 'zustand';
import { applyAgentActions } from '@/contracts/agent/actions';
import { agentIdFor, focusOf, summarizeRuntimes, type AgentChat, type AgentMessage } from '@/contracts/agent/chat';
import { agentApi } from '@/lib/agent.client';
import type { SampleProfile } from '@/contracts/agent/sample';
import type { KitSession } from '@/contracts/agent/kit';
import { summarizeKit } from '@/contracts/agent/chat';
import { useStudio } from './useStudio';

/**
 * Every open workflow's agent, in the browser: its conversation as last read, whether it is
 * thinking, and how to stop it. Keyed by agent id, so a reply that arrives after the person moved to
 * another tab still lands on the workflow that asked.
 */

/** How many times in a row the agent is told about a run it started, so a fix-and-rerun loop ends. */
const MAX_FOLLOW_UPS = 3;

export interface AgentSlot {
  chat: AgentChat | null;
  busy: boolean;
  /** What the app could not do for the agent, shown under the conversation, never sent. */
  notice?: string;
  /** A message typed but not yet answered, shown while the agent thinks. */
  pending?: AgentMessage;
  /** A kit a coding agent is building for this workflow, followed until it is done. */
  kit?: KitSession;
}

interface AgentState {
  slots: Record<string, AgentSlot>;
  load(id: string): Promise<void>;
  /** `sample`: a sample video the person attached, read already (`agentApi.sample`). */
  send(tabKey: string, text: string, sample?: SampleProfile): Promise<void>;
  stop(id: string): void;
  /** Stop the kit being built, if any. */
  stopKit(id: string): void;
  clear(id: string): Promise<void>;
}

/**
 * The turn each agent is waiting on. Stop does not abort the request — an aborted fetch surfaced as an
 * error in the page — it asks the server to stop and forgets the turn, so the answer, when it comes,
 * is dropped.
 */
const waiting = new Map<string, symbol>();

export const useAgent = create<AgentState>((set, get) => {
  const patch = (id: string, p: Partial<AgentSlot>) => set((s) => ({ slots: { ...s.slots, [id]: { chat: null, busy: false, ...s.slots[id], ...p } } }));

  /** One question, then the edits on the canvas and the run the agent asked for. */
  const turn = async (tabKey: string, message: { role: 'user' | 'event'; text: string }, depth: number, sample?: SampleProfile): Promise<void> => {
    const studio = useStudio.getState();
    const tab = studio.tabs.find((t) => t.key === tabKey);
    if (!tab) return;
    const id = agentIdFor(tab);
    if (get().slots[id]?.busy) return;
    const active = studio.activeTab === tabKey;
    // The node the person has selected goes whole with what they write; the app's own reports are about the run, not a node.
    const selected = active && message.role === 'user' ? studio.graph.nodes.find((n) => n.id === studio.selectedNodeId) : undefined;
    const focus = selected ? focusOf(selected.id, studio.runtimes[selected.id], selected.pinned?.outputs) : undefined;
    const ticket = Symbol(id);
    waiting.set(id, ticket);
    const attached = sample ? { id: sample.id, name: sample.name, seconds: sample.durationSeconds, segments: sample.segments.length, thumbs: sample.frames.slice(0, 6).map((f) => f.url) } : undefined;
    patch(id, {
      busy: true,
      notice: undefined,
      pending: { id: 'pending', at: new Date().toISOString(), role: message.role, text: message.text, ...(focus ? { focus: focus.nodeId } : {}), ...(attached ? { sample: attached } : {}) },
    });
    let answer: Awaited<ReturnType<typeof agentApi.turn>>;
    try {
      answer = await agentApi.turn(id, {
        message,
        workflowName: tab.name,
        graph: tab.graph,
        runtimes: active ? summarizeRuntimes(studio.runtimes) : {},
        running: active && studio.running,
        ...(focus ? { focus } : {}),
        ...(sample ? { sample: sample.id } : {}),
      });
    } catch (e) {
      if (waiting.get(id) !== ticket) return;
      waiting.delete(id);
      patch(id, { busy: false, pending: undefined, notice: e instanceof Error ? e.message : String(e) });
      // The server kept the question even when the answer never came back.
      void get().load(id);
      return;
    }
    // Stopped while it was thinking: the server recorded the stop, nothing of the answer applies.
    if (waiting.get(id) !== ticket) {
      if (!get().slots[id]?.busy) void get().load(id);
      return;
    }
    waiting.delete(id);
    patch(id, { busy: false, pending: undefined, chat: answer.chat });
    if (!answer.turn?.actions.length) return;

    // The edits go onto the graph as it is now, which may have moved on while the model thought.
    const now = useStudio.getState();
    const current = now.tabs.find((t) => t.key === tabKey);
    if (!current) return;
    const applied = applyAgentActions(current.graph, answer.turn.actions);
    const edits = answer.turn.actions.some((a) => a.op !== 'run' && a.op !== 'runNode');
    if (edits && applied.results.some((r) => r.ok)) now.applyAgentGraph(tabKey, applied.graph, applied.touched);
    // A kit comes before any run: running would only show the old look.
    if (applied.kit) {
      await buildKit(tabKey, id, applied.kit, depth);
      return;
    }
    if (!applied.run) return;

    const later = useStudio.getState();
    if (later.activeTab !== tabKey) {
      patch(id, { notice: 'run skipped: open this workflow on the canvas to run it' });
      return;
    }
    if (later.running) {
      patch(id, { notice: 'run skipped: another run is going on' });
      return;
    }
    if ('nodeId' in applied.run) await later.runNode(applied.run.nodeId);
    else await later.run({ force: applied.run.force });

    // Tell the agent how its run went, unless the person moved on or it has been told enough times.
    const after = useStudio.getState();
    if (after.activeTab !== tabKey || depth + 1 >= MAX_FOLLOW_UPS) return;
    const states = Object.values(after.runtimes).map((r) => r.state);
    const count = (s: string) => states.filter((x) => x === s).length;
    const failed = Object.entries(after.runtimes)
      .filter(([, r]) => r.state === 'error' || r.state === 'blocked')
      .map(([nodeId, r]) => `${nodeId}: ${r.error?.code ?? r.blockedBy?.code ?? r.state}`);
    const text = `The run you started has finished: ${count('success')} succeeded, ${count('error')} failed, ${count('blocked')} blocked, ${count('cancelled')} cancelled.${failed.length ? ` Problems: ${failed.join('; ')}.` : ''}`;
    await turn(tabKey, { role: 'event', text }, depth + 1);
  };

  /**
   * Hand the kit to a coding agent and follow it. When it is done the files go into the Composition
   * node — one undo step — and the workflow's agent is told what came of it.
   */
  const buildKit = async (tabKey: string, id: string, kit: { nodeId: string; request: string }, depth: number): Promise<void> => {
    const tab = useStudio.getState().tabs.find((t) => t.key === tabKey);
    if (!tab) return;
    const sample = [...(get().slots[id]?.chat?.messages ?? [])].reverse().find((m) => m.sample)?.sample?.id;
    let session: KitSession;
    try {
      session = await agentApi.kitStart(id, { nodeId: kit.nodeId, request: kit.request, graph: tab.graph, ...(sample ? { sample } : {}) });
    } catch (e) {
      patch(id, { notice: `kit: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    patch(id, { kit: session });
    while (session.state === 'running') {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        session = await agentApi.kitRead(id, session.id);
      } catch {
        // The server restarted, or the session is gone: there is nothing more to follow.
        patch(id, { kit: { ...session, state: 'failed', error: 'the kit session was lost (the server restarted?)' } });
        return;
      }
      patch(id, { kit: session });
    }
    if (session.state === 'cancelled') return;
    if (session.state === 'done' && session.files) {
      const studio = useStudio.getState();
      const current = studio.tabs.find((t) => t.key === tabKey);
      const node = current?.graph.nodes.find((n) => n.id === kit.nodeId);
      if (current && node) {
        const graph = { ...current.graph, nodes: current.graph.nodes.map((n) => (n.id === kit.nodeId ? { ...n, params: { ...n.params, files: session.files } } : n)) };
        studio.applyAgentGraph(tabKey, graph, [kit.nodeId]);
      }
    }
    if (depth + 1 >= MAX_FOLLOW_UPS) return;
    const blocks = session.files
      ? Object.entries(summarizeKit(session.files))
          .filter(([, v]) => v.startsWith('block'))
          .map(([p, v]) => `${p}: ${v}`)
      : [];
    const text =
      session.state === 'done'
        ? `The kit you asked for is built and now in ${kit.nodeId} (${Object.keys(session.files ?? {}).length} files).\nBlocks:\n${blocks.join('\n')}${session.problems?.length ? `\nStill wrong after the repair rounds:\n${session.problems.join('\n')}` : ''}${session.summary ? `\nThe coding agent said: ${session.summary}` : ''}`
        : `The kit could not be built: ${session.error ?? 'unknown error'}.`;
    await turn(tabKey, { role: 'event', text }, depth + 1);
  };

  return {
    slots: {},

    async load(id) {
      try {
        const chat = await agentApi.read(id);
        // A reply that came in while this was being read is newer than what was read.
        if (!get().slots[id]?.busy) patch(id, { chat });
      } catch (e) {
        patch(id, { notice: e instanceof Error ? e.message : String(e) });
      }
    },

    async send(tabKey, text, sample) {
      if (!text.trim()) return;
      await turn(tabKey, { role: 'user', text: text.trim() }, 0, sample);
    },

    stopKit(id) {
      const kit = get().slots[id]?.kit;
      if (kit?.state === 'running') void agentApi.kitCancel(id, kit.id).catch(() => undefined);
    },

    stop(id) {
      if (!waiting.delete(id)) return;
      patch(id, { busy: false, pending: undefined });
      void agentApi
        .cancel(id)
        .catch(() => undefined)
        .then(() => get().load(id));
    },

    async clear(id) {
      get().stop(id);
      patch(id, { chat: await agentApi.clear(id), notice: undefined });
    },
  };
});
