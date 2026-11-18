import { z } from 'zod';
import { getNodeType } from '@/core/nodes/definition';
import { holdsKit } from './kit';
import type { Edge, Graph, NodeInstance } from '@/core/engine/graph';

/**
 * What a workflow's agent may do to its workflow, and how each thing it asks for lands on the graph.
 *
 * The agent never writes a graph. It answers with a list of small edits, the way a person would make
 * them on the canvas — add a node, set a parameter, draw a wire, run — and this file applies them one
 * by one against the node registry, refusing an edit that names a node, a port or a parameter that
 * does not exist. Each edit reports whether it landed and, when it did not, why: that report goes back
 * to the agent on its next turn, so it can correct itself instead of believing it succeeded.
 *
 * Pure and isomorphic. The server applies the edits to the graph it was sent, to record what
 * happened; the browser applies the same edits again to the graph on the canvas *now*, which may have
 * moved on while the model was thinking.
 */

const NodeRef = z.string().min(1).max(120);
const Params = z.record(z.string(), z.unknown());

export const AgentActionSchema = z.discriminatedUnion('op', [
  /**
   * Start over from a template: its nodes and wires take the place of the workflow's, the workflow's own
   * settings (its model) stay. The model names the template; the server puts the template's graph in
   * `graph` before anyone applies the edit, so both sides apply the same one.
   */
  z.object({ op: z.literal('useTemplate'), id: z.string().min(1).max(80), graph: z.unknown().optional() }),
  /** `ref` names the new node for the edits after it in the same answer. */
  z.object({ op: z.literal('add'), ref: NodeRef, type: z.string().min(1).max(120), params: Params.optional() }),
  z.object({ op: z.literal('remove'), node: NodeRef }),
  /** Merged into the node's parameters, the way a form edit is. */
  z.object({ op: z.literal('set'), node: NodeRef, params: Params }),
  z.object({ op: z.literal('connect'), from: NodeRef, fromPort: z.string().min(1).max(60), to: NodeRef, toPort: z.string().min(1).max(60) }),
  /** Every wire into this input, or only the one from `from`. */
  z.object({ op: z.literal('disconnect'), to: NodeRef, toPort: z.string().min(1).max(60), from: NodeRef.optional() }),
  z.object({ op: z.literal('bypass'), node: NodeRef, bypassed: z.boolean() }),
  /** Run the whole workflow once the edits are in. `force` ignores the result cache. */
  z.object({ op: z.literal('run'), force: z.boolean().optional() }),
  z.object({ op: z.literal('runNode'), node: NodeRef }),
  /**
   * Have a coding agent build a new kit — the look and motion of the films — for a Composition node,
   * from a precise request. It runs for minutes, apart from this turn; the agent hears when it is done.
   */
  z.object({ op: z.literal('buildKit'), node: NodeRef, request: z.string().min(1).max(8000) }),
]);
export type AgentAction = z.infer<typeof AgentActionSchema>;

/** One answer from the agent: what it says, and what it does. */
export const AgentTurnSchema = z.object({
  reply: z.string().max(20_000),
  actions: z.array(AgentActionSchema).max(60).default([]),
});
export type AgentTurn = z.infer<typeof AgentTurnSchema>;

/** Parameters the workflow fills into its nodes (`contracts/workflow-model.ts`), never set on one. */
export const WORKFLOW_OWNED = ['llmProvider', 'llmSettings'];

export interface ActionResult {
  ok: boolean;
  /** What landed (`added tts-… as tts`) or why it did not. */
  note: string;
}

export interface Applied {
  graph: Graph;
  results: ActionResult[];
  /** Nodes whose parameters or inputs changed, so their old results are stale. */
  touched: string[];
  /** The run the agent asked for, if any: the whole workflow, or one node. */
  run: { force: boolean } | { nodeId: string } | null;
  /** A kit the agent asked to have built, if any. */
  kit: { nodeId: string; request: string } | null;
  /** `ref` → id of each node added. */
  added: Record<string, string>;
}

let seq = 0;
const newId = (type: string) => `${type.replace(/[^a-z0-9-]/gi, '-')}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Apply the edits in order. A refused edit is reported and skipped; the ones after it still apply. */
export function applyAgentActions(graph: Graph, actions: AgentAction[], opts: { idFor?: (type: string) => string } = {}): Applied {
  const idFor = opts.idFor ?? newId;
  let nodes: NodeInstance[] = graph.nodes.map((n) => ({ ...n }));
  let edges: Edge[] = graph.edges.map((e) => ({ ...e }));
  let settings = graph.settings;
  const results: ActionResult[] = [];
  const touched = new Set<string>();
  const added: Record<string, string> = {};
  let run: Applied['run'] = null;
  let kit: Applied['kit'] = null;

  const resolve = (ref: string): NodeInstance | undefined => nodes.find((n) => n.id === (added[ref] ?? ref));
  const fail = (note: string) => results.push({ ok: false, note });
  const ok = (note: string) => results.push({ ok: true, note });

  /** Params a node would end up with, held to its schema; a string when they are refused. */
  const checked = (type: string, params: Record<string, unknown>): Record<string, unknown> | string => {
    const def = getNodeType(type);
    if (!def) return `unknown node type "${type}"`;
    const unknown = Object.keys(params).filter((k) => !(k in (def.defaultParams as Record<string, unknown>)));
    // A node's model is the workflow's, filled in by the host as it runs; nothing sets it per node.
    const owned = WORKFLOW_OWNED.filter((k) => params[k] !== undefined && params[k] !== (def.defaultParams as Record<string, unknown>)[k] && JSON.stringify(params[k]) !== '{}');
    if (owned.length) return `${owned.join(', ')} belongs to the workflow, not to one node: the person picks the workflow's model in the agent panel`;
    if (unknown.length) return `${type} has no parameter ${unknown.map((k) => `"${k}"`).join(', ')}`;
    const parsed = def.paramsSchema.safeParse(params);
    if (!parsed.success) {
      return parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || 'params'}: ${i.message}`)
        .join('; ');
    }
    return params;
  };

  for (const action of actions) {
    switch (action.op) {
      case 'useTemplate': {
        const template = action.graph as Graph | undefined;
        if (!template || !Array.isArray(template.nodes) || !Array.isArray(template.edges)) {
          fail(`useTemplate: no template "${action.id}"`);
          break;
        }
        nodes = template.nodes.map((n) => ({ ...n, params: { ...n.params } }));
        edges = template.edges.map((e) => ({ ...e }));
        settings = { ...template.settings, ...graph.settings };
        for (const n of nodes) touched.add(n.id);
        ok(`started from the template ${action.id}: ${nodes.map((n) => `${n.id} (${n.type})`).join(', ')}`);
        break;
      }
      case 'add': {
        const def = getNodeType(action.type);
        if (!def) {
          fail(`add ${action.ref}: unknown node type "${action.type}"`);
          break;
        }
        if (added[action.ref] || nodes.some((n) => n.id === action.ref)) {
          fail(`add ${action.ref}: that name is already taken in this workflow`);
          break;
        }
        const params = checked(action.type, { ...(def.defaultParams as Record<string, unknown>), ...(action.params ?? {}) });
        if (typeof params === 'string') {
          fail(`add ${action.ref}: ${params}`);
          break;
        }
        const id = idFor(action.type);
        nodes.push({ id, type: action.type, version: def.version, params, bypassed: def.defaultBypassed ?? false, position: { x: 0, y: 0 } });
        added[action.ref] = id;
        ok(`added ${action.type} as ${id}`);
        break;
      }
      case 'remove': {
        const node = resolve(action.node);
        if (!node) {
          fail(`remove: no node "${action.node}"`);
          break;
        }
        for (const e of edges) if (e.source === node.id) touched.add(e.target);
        nodes = nodes.filter((n) => n.id !== node.id);
        edges = edges.filter((e) => e.source !== node.id && e.target !== node.id);
        touched.delete(node.id);
        ok(`removed ${node.id}`);
        break;
      }
      case 'set': {
        const node = resolve(action.node);
        if (!node) {
          fail(`set: no node "${action.node}"`);
          break;
        }
        const params = checked(node.type, { ...node.params, ...action.params });
        if (typeof params === 'string') {
          fail(`set ${node.id}: ${params}`);
          break;
        }
        nodes = nodes.map((n) => (n.id === node.id ? { ...n, params } : n));
        touched.add(node.id);
        ok(`set ${Object.keys(action.params).join(', ')} on ${node.id}`);
        break;
      }
      case 'connect': {
        const src = resolve(action.from);
        const dst = resolve(action.to);
        if (!src || !dst) {
          fail(`connect: no node "${!src ? action.from : action.to}"`);
          break;
        }
        const sp = getNodeType(src.type)?.outputs.find((p) => p.name === action.fromPort);
        const tp = getNodeType(dst.type)?.inputs.find((p) => p.name === action.toPort);
        if (!sp) {
          fail(`connect: ${src.type} has no output "${action.fromPort}"`);
          break;
        }
        if (!tp) {
          fail(`connect: ${dst.type} has no input "${action.toPort}"`);
          break;
        }
        if (sp.type !== tp.type) {
          fail(`connect: ${src.id}.${sp.name} carries ${sp.type}, ${dst.id}.${tp.name} takes ${tp.type}`);
          break;
        }
        if (src.id === dst.id) {
          fail('connect: a node cannot feed itself');
          break;
        }
        // One wire per input, unless the input takes many — the same rule as drawing on the canvas.
        edges = tp.multiple
          ? edges.filter((e) => !(e.target === dst.id && e.targetPort === tp.name && e.source === src.id && e.sourcePort === sp.name))
          : edges.filter((e) => !(e.target === dst.id && e.targetPort === tp.name));
        edges.push({ id: `e-${idFor('edge')}`, source: src.id, sourcePort: sp.name, target: dst.id, targetPort: tp.name });
        touched.add(dst.id);
        ok(`wired ${src.id}.${sp.name} → ${dst.id}.${tp.name}`);
        break;
      }
      case 'disconnect': {
        const dst = resolve(action.to);
        const src = action.from ? resolve(action.from) : undefined;
        if (!dst || (action.from && !src)) {
          fail(`disconnect: no node "${!dst ? action.to : action.from}"`);
          break;
        }
        const drop = edges.filter((e) => e.target === dst.id && e.targetPort === action.toPort && (!src || e.source === src.id));
        if (!drop.length) {
          fail(`disconnect: nothing is wired into ${dst.id}.${action.toPort}`);
          break;
        }
        edges = edges.filter((e) => !drop.includes(e));
        touched.add(dst.id);
        ok(`unwired ${drop.length} from ${dst.id}.${action.toPort}`);
        break;
      }
      case 'bypass': {
        const node = resolve(action.node);
        if (!node) {
          fail(`bypass: no node "${action.node}"`);
          break;
        }
        nodes = nodes.map((n) => (n.id === node.id ? { ...n, bypassed: action.bypassed } : n));
        ok(`${action.bypassed ? 'bypassed' : 'un-bypassed'} ${node.id}`);
        break;
      }
      case 'run':
        run = { force: action.force ?? false };
        ok(action.force ? 'run everything again' : 'run');
        break;
      case 'buildKit': {
        const node = resolve(action.node);
        if (!node || !holdsKit(node.type)) {
          fail(`buildKit: "${action.node}" is not a Composition node`);
          break;
        }
        kit = { nodeId: node.id, request: action.request };
        ok(`a coding agent builds a new kit for ${node.id}`);
        break;
      }
      case 'runNode': {
        const node = resolve(action.node);
        if (!node) {
          fail(`runNode: no node "${action.node}"`);
          break;
        }
        run = { nodeId: node.id };
        ok(`run ${node.id}`);
        break;
      }
    }
  }

  return { graph: { ...graph, ...(settings ? { settings } : {}), nodes: placeNew(nodes, edges, new Set(Object.values(added))), edges }, results, touched: [...touched], run, kit, added };
}

/** New nodes go to the right of what feeds them, or past the right edge of the workflow. */
function placeNew(nodes: NodeInstance[], edges: Edge[], fresh: Set<string>): NodeInstance[] {
  if (!fresh.size) return nodes;
  const placed = new Map(nodes.filter((n) => !fresh.has(n.id)).map((n) => [n.id, n.position]));
  const right = () => Math.max(0, ...[...placed.values()].map((p) => p.x)) + 380;
  let loose = 0;
  return nodes.map((n) => {
    if (!fresh.has(n.id)) return n;
    const feeds = edges
      .filter((e) => e.target === n.id)
      .map((e) => placed.get(e.source))
      .filter((p): p is { x: number; y: number } => !!p);
    const position = feeds.length ? { x: Math.max(...feeds.map((p) => p.x)) + 380, y: feeds.reduce((s, p) => s + p.y, 0) / feeds.length } : { x: right(), y: 240 * loose++ };
    // Never on top of another card.
    while ([...placed.values()].some((p) => Math.abs(p.x - position.x) < 200 && Math.abs(p.y - position.y) < 160)) position.y += 260;
    placed.set(n.id, position);
    return { ...n, position };
  });
}
