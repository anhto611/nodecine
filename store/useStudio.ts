'use client';
import { create } from 'zustand';
import { Executor } from '@/core/engine/executor';
import { validateGraph, type Graph, type GraphIssue, type NodeInstance, GraphInvalidError } from '@/core/engine/graph';
import type { NodeRuntime } from '@/core/engine/state';
import { RunHistory, type RunRecord } from '@/core/engine/history';
import { getNodeType } from '@/core/nodes/definition';
import staticScriptJson from '@/templates/static-script.json';
import { getTemplate, templateGraph, type TemplateDefinition, localized } from '@/core/templates/registry';
import type { VideoIR } from '@/core/types/ir';
import type { EngineRef } from '@/core/types/payloads';
import { clientServices } from '@/lib/services.client';
import { bootstrapClient } from '@/lib/bootstrap.client';
import { loadUserTemplates, saveUserTemplates, loadProject, loadTabs, loadUiPrefs, saveTabs, saveUiPrefs, PROJECT_SCHEMA_VERSION } from '@/lib/storage';
import { workflowsApi } from '@/lib/workflows.client';
import { provideWorkflowForRenders } from '@/lib/services.client';
import type { Locale } from '@/lib/i18n';

export type Panel = 'workflows' | 'library' | 'history' | null;

/** One open workflow: a saved file, a template just opened, or a draft that has never been saved. */
export interface WorkflowTab {
  key: string;
  /** The file on the server this tab is, or null for a draft. */
  fileId: string | null;
  name: string;
  graph: Graph;
  dirty: boolean;
}
/** A registered template id (core/templates/registry). */
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
  tabs: WorkflowTab[];
  activeTab: string;
  locale: Locale;
  panel: Panel;
  logsOpen: boolean;
  templatesOpen: boolean;
  /** Bumped whenever the template list changes, so the browser re-reads the registry. */
  /** Bumps whenever a workflow file changes, so lists re-read the directory. */
  workflowsTick: number;
  settingsOpen: boolean;
  /** The stage node, or one block of a Blocks node, open in the code editor. */
  codeEditor: { nodeId: string; blockIndex?: number } | null;
  selectedNodeId: string | null;
  executor: Executor | null;

  init(): void;
  setParams(nodeId: string, patch: Record<string, unknown>): void;
  setNodePosition(nodeId: string, position: { x: number; y: number }): void;
  /** Many at once, for auto-layout; one persist, one dirty mark. */
  setNodePositions(positions: Record<string, { x: number; y: number }>): void;
  addNode(type: string, position: { x: number; y: number }): string;
  removeNodes(ids: string[]): void;
  removeEdges(ids: string[]): void;
  connect(edge: { source: string; sourcePort: string; target: string; targetPort: string }): boolean;
  toggleBypass(nodeId: string): void;
  run(): Promise<void>;
  cancel(): void;
  runNode(nodeId: string): Promise<void>;
  loadTemplate(id: TemplateId): void;
  /** Package the current graph as a template the browser lists and a file that can be shared. */
  /** Tab bar, ComfyUI-style. */
  newWorkflow(): void;
  openWorkflow(fileId: string): Promise<void>;
  activateTab(key: string): void;
  closeTab(key: string): void;
  /** Saves the active tab to its file; a draft has no file and reports `needs-name`. */
  saveWorkflow(): Promise<'saved' | 'needs-name'>;
  saveWorkflowAs(name: string): Promise<void>;
  renameWorkflow(id: string, name: string): Promise<void>;
  deleteWorkflow(id: string): Promise<void>;
  /** Add a template from JSON text; returns a message when it is not one, else null. */
  /** Imports a workflow file, or the workflow a NodeCine MP4 carries; returns why it failed, or null. */
  importWorkflow(json: string): Promise<string | null>;
  importWorkflowVideo(file: File): Promise<string | null>;
  viewRun(seq: number | null): void;
  setLocale(locale: Locale): void;
  setProjectName(name: string): void;
  setPanel(panel: Panel): void;
  toggleLogs(): void;
  setTemplatesOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  setCodeEditor(target: { nodeId: string; blockIndex?: number } | null): void;
  select(nodeId: string | null): void;
  markLogsRead(): void;
}

let uid = 0;
const newId = (type: string) => `${type.split('/')[1] ?? 'node'}-${Date.now().toString(36)}-${(uid++).toString(36)}`;

export const useStudio = create<StudioState>((set, get) => {
  const history = new RunHistory(20);

  let tabSeq = 0;
  const tabKey = () => `tab-${Date.now().toString(36)}-${(tabSeq++).toString(36)}`;
  const persist = () => {
    const { tabs, activeTab } = get();
    saveTabs({ schemaVersion: PROJECT_SCHEMA_VERSION, active: activeTab, tabs });
  };
  /** Swap the canvas to a tab's graph: executor, validation, runtimes, name. */
  const showTab = (tab: WorkflowTab) => {
    const ex = get().executor;
    ex?.setGraph(tab.graph);
    const runtimes: Record<string, NodeRuntime> = {};
    if (ex) for (const [id, rt] of ex.runtimes_()) runtimes[id] = rt;
    set({ activeTab: tab.key, graph: tab.graph, projectName: tab.name, issues: validateGraph(tab.graph), runtimes, viewingRun: null, selectedNodeId: null });
    persist();
    void ex?.probeResources();
  };
  const addTab = (tab: Omit<WorkflowTab, 'key'>) => {
    const full: WorkflowTab = { key: tabKey(), ...tab };
    set({ tabs: [...get().tabs, full] });
    showTab(full);
    return full;
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
    const { tabs, activeTab } = get();
    set({ graph, issues: validateGraph(graph), runtimes, tabs: tabs.map((t) => (t.key === activeTab ? { ...t, graph, dirty: true } : t)) });
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
    tabs: [],
    activeTab: '',
    locale: 'en',
    panel: null,
    logsOpen: false,
    templatesOpen: false,
    workflowsTick: 0,
    settingsOpen: false,
    codeEditor: null,
    selectedNodeId: null,
    executor: null,

    init() {
      if (get().ready) return;
      bootstrapClient();
      const prefs = loadUiPrefs();
      // The tabs that were open, or the single project an older build saved, or a first open: the
      // core template as data, so no registry has to be ready yet.
      const stored = loadTabs();
      const saved = stored ? null : loadProject();
      const tabs: WorkflowTab[] = stored?.tabs.length
        ? stored.tabs
        : saved
          ? [{ key: tabKey(), fileId: null, name: saved.name, graph: saved.graph, dirty: true }]
          : [{ key: tabKey(), fileId: null, name: 'Static Script', graph: structuredClone(staticScriptJson.graph) as Graph, dirty: false }];
      const active = tabs.find((t) => t.key === stored?.active) ?? tabs[0]!;
      const graph = active.graph;
      provideWorkflowForRenders(() => ({ name: get().projectName, graph: get().graph }));
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
        projectName: active.name,
        tabs,
        activeTab: active.key,
        locale: prefs.locale ?? 'en',
        panel: prefs.panel ?? null,
        logsOpen: prefs.logsOpen ?? false,
        issues: validateGraph(graph),
      });
      const runtimes: Record<string, NodeRuntime> = {};
      for (const [id, rt] of executor.runtimes_()) runtimes[id] = rt;
      set({ runtimes });
      void executor.probeResources();
      persist();
      // Whatever an older build left in localStorage moves to the server once, then the key is cleared.
      void (async () => {
        const leftovers = loadUserTemplates();
        if (!leftovers.length) return;
        for (const t of leftovers) await workflowsApi.save(t as TemplateDefinition).catch(() => undefined);
        saveUserTemplates([]);
        set({ workflowsTick: get().workflowsTick + 1 });
      })();
    },

    newWorkflow() {
      const n = get().tabs.filter((t) => t.fileId === null).length + 1;
      addTab({ fileId: null, name: `Untitled ${n}`, graph: { nodes: [], edges: [] }, dirty: false });
    },

    async openWorkflow(fileId) {
      const open = get().tabs.find((t) => t.fileId === fileId);
      if (open) { showTab(open); return; }
      const def = await workflowsApi.read(fileId).catch(() => null);
      if (!def) return;
      addTab({ fileId, name: localized(def.name, get().locale, fileId), graph: structuredClone(def.graph), dirty: false });
    },

    activateTab(key) {
      const tab = get().tabs.find((t) => t.key === key);
      if (tab && tab.key !== get().activeTab) showTab(tab);
    },

    closeTab(key) {
      const { tabs, activeTab } = get();
      const i = tabs.findIndex((t) => t.key === key);
      if (i < 0) return;
      const rest = tabs.filter((t) => t.key !== key);
      set({ tabs: rest });
      if (rest.length === 0) { get().newWorkflow(); return; }
      if (activeTab === key) showTab(rest[Math.min(i, rest.length - 1)]!);
      else persist();
    },

    async saveWorkflow() {
      const tab = get().tabs.find((t) => t.key === get().activeTab);
      if (!tab) return 'saved';
      if (!tab.fileId) return 'needs-name';
      const existing = await workflowsApi.read(tab.fileId).catch(() => null);
      await workflowsApi.replace(tab.fileId, { name: tab.name, ...(existing?.description ? { description: existing.description } : {}), graph: tab.graph });
      set({ tabs: get().tabs.map((t) => (t.key === tab.key ? { ...t, dirty: false } : t)), workflowsTick: get().workflowsTick + 1 });
      persist();
      return 'saved';
    },

    async saveWorkflowAs(name) {
      const tab = get().tabs.find((t) => t.key === get().activeTab);
      if (!tab || !name.trim()) return;
      const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'workflow';
      const id = `${base}-${Date.now().toString(36)}`;
      await workflowsApi.save({ id, name: name.trim(), graph: structuredClone(tab.graph) });
      set({ tabs: get().tabs.map((t) => (t.key === tab.key ? { ...t, fileId: id, name: name.trim(), dirty: false } : t)), projectName: name.trim(), workflowsTick: get().workflowsTick + 1 });
      persist();
    },

    setParams(nodeId, patch) {
      const graph = get().graph;
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const next: Graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)) };
      get().executor?.invalidate(nodeId);
      refresh(next);
    },

    setNodePositions(positions) {
      const graph = get().graph;
      const next: Graph = { ...graph, nodes: graph.nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id]! } : n)) };
      const { tabs, activeTab } = get();
      set({ graph: next, tabs: tabs.map((t) => (t.key === activeTab ? { ...t, graph: next, dirty: true } : t)) });
      get().executor?.setGraph(next);
      persist();
    },

    setNodePosition(nodeId, position) {
      get().setNodePositions({ [nodeId]: position });
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
      // One edge per input: a new connection replaces the old one (USER_FLOWS Scenario 2) — except on a
      // `multiple` port, which keeps every wire and only refuses the very same wire twice.
      const edges = tp.multiple
        ? g.edges.filter((e) => !(e.target === target && e.targetPort === targetPort && e.source === source && e.sourcePort === sourcePort))
        : g.edges.filter((e) => !(e.target === target && e.targetPort === targetPort));
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

    async renameWorkflow(id, name) {
      if (!name.trim()) return;
      const def = await workflowsApi.read(id).catch(() => null);
      if (!def) return;
      await workflowsApi.replace(id, { name: name.trim(), ...(def.description ? { description: def.description } : {}), graph: def.graph });
      const { tabs, activeTab } = get();
      const next = tabs.map((t) => (t.fileId === id ? { ...t, name: name.trim() } : t));
      set({ tabs: next, workflowsTick: get().workflowsTick + 1, projectName: next.find((t) => t.key === activeTab)?.name ?? get().projectName });
      persist();
    },

    async deleteWorkflow(id) {
      await workflowsApi.remove(id).catch(() => undefined);
      // A tab that was this file goes on as a draft; nothing on the canvas is lost.
      set({ tabs: get().tabs.map((t) => (t.fileId === id ? { ...t, fileId: null, dirty: true } : t)), workflowsTick: get().workflowsTick + 1 });
      persist();
    },

    async importWorkflow(json) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return 'not JSON';
      }
      try {
        const def = parsed as TemplateDefinition;
        const saved = await workflowsApi.save({ ...def, id: `${def.id ?? 'workflow'}-${Date.now().toString(36)}`.slice(0, 64), category: 'mine' });
        set({ workflowsTick: get().workflowsTick + 1 });
        await get().openWorkflow(saved.id);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },

    async importWorkflowVideo(file) {
      try {
        const fromVideo = await workflowsApi.fromVideo(file);
        const saved = await workflowsApi.save({ ...fromVideo, id: `${fromVideo.id}-${Date.now().toString(36)}`.slice(0, 64), category: 'mine' });
        set({ workflowsTick: get().workflowsTick + 1 });
        await get().openWorkflow(saved.id);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },

    loadTemplate(id) {
      set({ templatesOpen: false });
      const def = getTemplate(id);
      if (!def) return;
      // A shipped template opens as a fresh draft named after it; saving makes it the user's own file.
      addTab({ fileId: null, name: localized(def.name, get().locale, id), graph: templateGraph(def), dirty: true });
    },

    viewRun(seq) {
      set({ viewingRun: seq });
    },

    setLocale(locale) {
      set({ locale });
      persistUi();
    },
    setProjectName(name) {
      const { tabs, activeTab } = get();
      set({ projectName: name, tabs: tabs.map((t) => (t.key === activeTab ? { ...t, name, dirty: true } : t)) });
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
    setCodeEditor(target) {
      set({ codeEditor: target });
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
