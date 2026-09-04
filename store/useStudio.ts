'use client';
import { create } from 'zustand';
import { Executor } from '@/core/engine/executor';
import { validateGraph, type Graph, type GraphIssue, type NodeInstance, GraphInvalidError } from '@/core/engine/graph';
import type { NodeRuntime } from '@/core/engine/state';
import { RunHistory, type RunRecord } from '@/core/engine/history';
import { getNodeType } from '@/core/nodes/definition';
import { staticScriptTemplate } from '@/core/templates/static-script';
import { getTemplate } from '@/core/templates/registry';
import type { VideoIR } from '@/core/types/ir';
import type { EngineRef } from '@/core/types/payloads';
import { clientServices } from '@/lib/services.client';
import { bootstrapClient } from '@/lib/bootstrap.client';
import { loadProject, loadUiPrefs, saveProject, saveUiPrefs, PROJECT_SCHEMA_VERSION } from '@/lib/storage';
import type { Locale } from '@/lib/i18n';

export type Panel = 'library' | 'history' | null;
/** A registered template id (core/templates/registry) or 'blank'. */
export type TemplateId = string;

export interface StudioState {
  ready: boolean;
  graph: Graph;
  runtimes: Record<string, NodeRuntime>;
  issues: GraphIssue[];
  running: boolean;
  step: { nodeId: string; step: number; total: number } | null;
  history: RunRecord[];
  viewingRun: number | null;
  logTick: number;
  unreadErrors: number;
  projectName: string;
  locale: Locale;
  panel: Panel;
  logsOpen: boolean;
  templatesOpen: boolean;
  settingsOpen: boolean;
  selectedNodeId: string | null;
  executor: Executor | null;

  init(): void;
  setParams(nodeId: string, patch: Record<string, unknown>): void;
  setNodePosition(nodeId: string, position: { x: number; y: number }): void;
  addNode(type: string, position: { x: number; y: number }): string;
  removeNodes(ids: string[]): void;
  removeEdges(ids: string[]): void;
  connect(edge: { source: string; sourcePort: string; target: string; targetPort: string }): boolean;
  toggleBypass(nodeId: string): void;
  run(): Promise<void>;
  cancel(): void;
  runNode(nodeId: string): Promise<void>;
  loadTemplate(id: TemplateId): void;
  viewRun(seq: number | null): void;
  setLocale(locale: Locale): void;
  setProjectName(name: string): void;
  setPanel(panel: Panel): void;
  toggleLogs(): void;
  setTemplatesOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  select(nodeId: string | null): void;
  markLogsRead(): void;
}

let uid = 0;
const newId = (type: string) => `${type.split('/')[1] ?? 'node'}-${Date.now().toString(36)}-${(uid++).toString(36)}`;

export const useStudio = create<StudioState>((set, get) => {
  const history = new RunHistory(20);

  const persist = () => {
    const { graph, projectName } = get();
    saveProject({ schemaVersion: PROJECT_SCHEMA_VERSION, name: projectName, graph });
  };
  const persistUi = () => {
    const { locale, panel, logsOpen } = get();
    saveUiPrefs({ locale, panel, logsOpen });
  };
  const refresh = (graph: Graph) => {
    const ex = get().executor;
    ex?.setGraph(graph);
    const runtimes: Record<string, NodeRuntime> = {};
    if (ex) for (const [id, rt] of ex.runtimes_()) runtimes[id] = rt;
    set({ graph, issues: validateGraph(graph), runtimes });
    persist();
  };

  return {
    ready: false,
    graph: { nodes: [], edges: [] },
    runtimes: {},
    issues: [],
    running: false,
    step: null,
    history: [],
    viewingRun: null,
    logTick: 0,
    unreadErrors: 0,
    projectName: 'nodecine-project',
    locale: 'en',
    panel: null,
    logsOpen: false,
    templatesOpen: false,
    settingsOpen: false,
    selectedNodeId: null,
    executor: null,

    init() {
      if (get().ready) return;
      bootstrapClient();
      const saved = loadProject();
      const prefs = loadUiPrefs();
      const graph = saved?.graph ?? staticScriptTemplate();
      const executor = new Executor(graph, clientServices, {
        onStateChange: (nodeId, runtime) => set((s) => ({ runtimes: { ...s.runtimes, [nodeId]: runtime } })),
        onRunStart: ({ stepTotal }) => set({ running: true, step: { nodeId: '', step: 0, total: stepTotal }, viewingRun: null }),
        onStep: ({ nodeId, step, stepTotal }) => set({ step: { nodeId, step, total: stepTotal } }),
        onRunEnd: ({ ok, durationMs }) => {
          const s = get();
          const asm = s.graph.nodes.find((n) => getNodeType(n.type)?.type === 'core/timeline-assembler');
          const irPacket = asm ? s.executor?.runtime(asm.id).outputs.ir : undefined;
          if (irPacket) {
            const out = s.graph.nodes.find((n) => n.type === 'core/video-output' && s.executor?.runtime(n.id).state === 'success');
            const engineEdge = out ? s.graph.edges.find((e) => e.target === out.id && e.targetPort === 'engine') : undefined;
            const engineRef = engineEdge ? (s.executor?.runtime(engineEdge.source).outputs[engineEdge.sourcePort]?.payload as EngineRef | undefined) : undefined;
            history.add({ startedAt: Date.now() - durationMs, durationMs, ir: irPacket.payload as VideoIR, engineId: engineRef?.engineId });
          }
          set({ running: false, step: null, history: [...history.all()] });
          void ok;
        },
      });
      executor.logs.subscribe((e) => set((s) => ({ logTick: s.logTick + 1, unreadErrors: e.level === 'error' && !s.logsOpen ? s.unreadErrors + 1 : s.unreadErrors })));
      set({
        ready: true,
        executor,
        graph,
        projectName: saved?.name ?? 'nodecine-project',
        locale: prefs.locale ?? 'en',
        panel: prefs.panel ?? null,
        logsOpen: prefs.logsOpen ?? false,
        issues: validateGraph(graph),
      });
      const runtimes: Record<string, NodeRuntime> = {};
      for (const [id, rt] of executor.runtimes_()) runtimes[id] = rt;
      set({ runtimes });
      void executor.probeResources();
    },

    setParams(nodeId, patch) {
      const graph = get().graph;
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const next: Graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)) };
      get().executor?.invalidate(nodeId);
      refresh(next);
    },

    setNodePosition(nodeId, position) {
      const graph = get().graph;
      const next: Graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)) };
      set({ graph: next });
      get().executor?.setGraph(next);
      persist();
    },

    addNode(type, position) {
      const def = getNodeType(type);
      if (!def) throw new Error(`unknown node type ${type}`);
      const node: NodeInstance = { id: newId(type), type, params: { ...(def.defaultParams as Record<string, unknown>) }, bypassed: def.defaultBypassed ?? false, position };
      refresh({ ...get().graph, nodes: [...get().graph.nodes, node] });
      if (def.kind === 'resource') void get().executor?.runNode(node.id);
      return node.id;
    },

    removeNodes(ids) {
      const g = get().graph;
      const drop = new Set(ids);
      refresh({ nodes: g.nodes.filter((n) => !drop.has(n.id)), edges: g.edges.filter((e) => !drop.has(e.source) && !drop.has(e.target)) });
    },

    removeEdges(ids) {
      const g = get().graph;
      const drop = new Set(ids);
      const targets = g.edges.filter((e) => drop.has(e.id)).map((e) => e.target);
      refresh({ ...g, edges: g.edges.filter((e) => !drop.has(e.id)) });
      for (const t of targets) get().executor?.invalidate(t);
    },

    connect({ source, sourcePort, target, targetPort }) {
      const g = get().graph;
      const src = getNodeType(g.nodes.find((n) => n.id === source)?.type ?? '');
      const dst = getNodeType(g.nodes.find((n) => n.id === target)?.type ?? '');
      const sp = src?.outputs.find((p) => p.name === sourcePort);
      const tp = dst?.inputs.find((p) => p.name === targetPort);
      if (!sp || !tp || sp.type !== tp.type || source === target) return false;
      // One edge per input: a new connection replaces the old one (USER_FLOWS Scenario 2).
      const edges = g.edges.filter((e) => !(e.target === target && e.targetPort === targetPort));
      edges.push({ id: `e-${newId('edge')}`, source, sourcePort, target, targetPort });
      refresh({ ...g, edges });
      get().executor?.invalidate(target);
      return true;
    },

    toggleBypass(nodeId) {
      const ex = get().executor;
      const node = get().graph.nodes.find((n) => n.id === nodeId);
      if (!ex || !node) return;
      ex.setBypassed(nodeId, !node.bypassed);
      refresh({ ...get().graph, nodes: get().graph.nodes.map((n) => (n.id === nodeId ? { ...n, bypassed: !node.bypassed } : n)) });
    },

    async run() {
      const ex = get().executor;
      if (!ex) return;
      if (get().running) {
        ex.logs.push({ ts: Date.now(), nodeId: 'run', level: 'warn', message: 'run requested while another run is in progress' });
        return;
      }
      try {
        await ex.run();
      } catch (e) {
        if (e instanceof GraphInvalidError) {
          set({ issues: e.issues });
          ex.logs.push({ ts: Date.now(), nodeId: 'run', level: 'error', code: e.issues[0]?.code, message: e.issues.map((i) => `${i.nodeId ?? 'graph'}: ${i.code} ${i.message}`).join('; ') });
          return;
        }
        ex.logs.push({ ts: Date.now(), nodeId: 'run', level: 'error', message: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    },

    cancel() {
      get().executor?.cancel();
    },

    async runNode(nodeId) {
      const ex = get().executor;
      if (!ex || get().running) return;
      set({ running: true });
      try {
        await ex.runNode(nodeId);
      } finally {
        set({ running: false });
      }
    },

    loadTemplate(id) {
      const graph = id === 'blank' ? { nodes: [], edges: [] } : (getTemplate(id)?.() ?? { nodes: [], edges: [] });
      const executor = get().executor;
      executor?.setGraph(graph);
      refresh(graph);
      set({ templatesOpen: false, viewingRun: null });
      void executor?.probeResources();
    },

    viewRun(seq) {
      set({ viewingRun: seq });
    },

    setLocale(locale) {
      set({ locale });
      persistUi();
    },
    setProjectName(name) {
      set({ projectName: name });
      persist();
    },
    setPanel(panel) {
      set((s) => ({ panel: s.panel === panel ? null : panel }));
      persistUi();
    },
    toggleLogs() {
      set((s) => ({ logsOpen: !s.logsOpen, unreadErrors: 0 }));
      persistUi();
    },
    setTemplatesOpen(open) {
      set({ templatesOpen: open });
    },
    setSettingsOpen(open) {
      set({ settingsOpen: open });
    },
    select(nodeId) {
      set({ selectedNodeId: nodeId });
    },
    markLogsRead() {
      set({ unreadErrors: 0 });
    },
  };
});

/** Convenience selectors used by node bodies. */
export function useNode(nodeId: string) {
  return useStudio((s) => s.graph.nodes.find((n) => n.id === nodeId));
}
export function useRuntime(nodeId: string) {
  return useStudio((s) => s.runtimes[nodeId]);
}
/** The packet currently sitting on an input port, following the wire upstream. */
export function useInputPayload<T = unknown>(nodeId: string, port: string): T | undefined {
  return useStudio((s) => {
    const edge = s.graph.edges.find((e) => e.target === nodeId && e.targetPort === port);
    if (!edge) return undefined;
    return s.runtimes[edge.source]?.outputs[edge.sourcePort]?.payload as T | undefined;
  });
}
