'use client';
import { create } from 'zustand';
import { RemoteExecutor } from '@/lib/remote-executor';
import { validateGraph, type Graph, type GraphIssue, type NodeInstance, GraphInvalidError } from '@/core/engine/graph';
import { expandBatch } from '@/core/engine/batch';
import type { NodeRuntime } from '@/core/engine/state';
import type { RunRecord } from '@/core/engine/history';
import { UndoStack } from '@/lib/undo-stack';
import { contentHash } from '@/core/hash';
import { getNodeType } from '@/core/nodes/definition';
import firstRunGraph from '@/lib/first-run.json';
import { getTemplate, templateGraph, type TemplateDefinition, localized } from '@/core/templates/registry';
import type { VideoIR } from '@/core/types/ir';
import type { EngineRef } from '@/core/types/payloads';
import { bootstrapClient } from '@/lib/bootstrap.client';
import { loadUserTemplates, saveUserTemplates, loadTabs, loadUiPrefs, saveTabs, saveUiPrefs, PROJECT_SCHEMA_VERSION } from '@/lib/storage';
import { workflowsApi } from '@/lib/workflows.client';
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
  /**
   * Hash of name + graph as last saved (or as opened, for a clean template). `dirty` is derived from
   * it, so undoing back to the saved state clears the dot; absent means "always dirty" (a draft).
   */
  savedHash?: string;
}

/** What "unsaved" compares against: the name and the graph, the two things a file holds. */
export const savedHashOf = (name: string, graph: Graph): string => contentHash({ name, graph });
const dirtyOf = (tab: WorkflowTab, name: string, graph: Graph): boolean => (tab.savedHash ? savedHashOf(name, graph) !== tab.savedHash : true);
/** A registered template id (core/templates/registry). */
export type TemplateId = string;

export interface StudioState {
  ready: boolean;
  graph: Graph;
  runtimes: Record<string, NodeRuntime>;
  issues: GraphIssue[];
  running: boolean;
  /** Which run of a batch is going, when the workflow is queued once per line (EXECUTION_ENGINE §9). */
  batch: { index: number; total: number } | null;
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
  /** One scene of a Static Script node, open in the scene editor. */
  sceneEditor: { nodeId: string; index: number } | null;
  selectedNodeId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  /** The server-side executor for the active tab, mirrored here (ARCHITECTURE §1.2). */
  executor: RemoteExecutor | null;

  init(): void;
  undo(): void;
  redo(): void;
  setParams(nodeId: string, patch: Record<string, unknown>): void;
  /** A node changed its own parameters while running: into the graph and the undo history, nothing invalidated. */
  applyParamsPatch(nodeId: string, patch: Record<string, unknown>): void;
  /** Many at once, for auto-layout; one persist, one dirty mark. */
  setNodePositions(positions: Record<string, { x: number; y: number }>): void;
  addNode(type: string, position: { x: number; y: number }): string;
  removeNodes(ids: string[]): void;
  removeEdges(ids: string[]): void;
  connect(edge: { source: string; sourcePort: string; target: string; targetPort: string }): boolean;
  /** Move the end of an existing wire: one graph change, so one undo step. */
  reconnect(edgeId: string, edge: { source: string; sourcePort: string; target: string; targetPort: string }): boolean;
  toggleBypass(nodeId: string): void;
  /**
   * Run the whole graph. `force` ignores the signature cache — Shift+Run: what a person reaches for
   * when the answer on disk is stale for a reason the signature cannot see (a model that would
   * answer differently today, a file changed under a path, code edited while the app was open).
   */
  run(opts?: { force?: boolean }): Promise<void>;
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
  setSceneEditor(target: { nodeId: string; index: number } | null): void;
  select(nodeId: string | null): void;
  markLogsRead(): void;
}

let uid = 0;
const newId = (type: string) => `${type.split('/')[1] ?? 'node'}-${Date.now().toString(36)}-${(uid++).toString(36)}`;

export const useStudio = create<StudioState>((set, get) => {
  let tabSeq = 0;
  const tabKey = () => `tab-${Date.now().toString(36)}-${(tabSeq++).toString(36)}`;
  const persist = () => {
    const { tabs, activeTab } = get();
    saveTabs({ schemaVersion: PROJECT_SCHEMA_VERSION, active: activeTab, tabs });
  };
  /** Swap the canvas to a tab's graph: executor, validation, runtimes, name. */
  const showTab = (tab: WorkflowTab) => {
    const ex = get().executor;
    set({ activeTab: tab.key, graph: tab.graph, projectName: tab.name, issues: validateGraph(tab.graph), runtimes: {}, running: false, step: null, viewingRun: null, selectedNodeId: null, history: [], canUndo: stackFor(tab.key).canUndo, canRedo: stackFor(tab.key).canRedo });
    persist();
    void ex?.switchTo(tab.key, tab.graph, tab.name).then(() => {
      if (get().activeTab !== tab.key) return;
      const runtimes: Record<string, NodeRuntime> = {};
      for (const [id, rt] of ex.runtimes_()) runtimes[id] = rt;
      set({ runtimes, logTick: get().logTick + 1 });
      void ex.probeResources();
    });
  };
  const addTab = (tab: Omit<WorkflowTab, 'key'>) => {
    // A tab that opens clean remembers what clean looks like.
    const full: WorkflowTab = { key: tabKey(), ...tab, ...(!tab.dirty && !tab.savedHash ? { savedHash: savedHashOf(tab.name, tab.graph) } : {}) };
    set({ tabs: [...get().tabs, full] });
    showTab(full);
    return full;
  };
  const persistUi = () => {
    const { locale, panel, logsOpen } = get();
    saveUiPrefs({ locale, panel, logsOpen });
  };
  // One undo history per open tab, in memory only: a reload starts with a clean slate, like ComfyUI.
  const undoStacks = new Map<string, UndoStack<Graph>>();
  // Set by cancel: a batch must stop between runs, not only inside the one that is going.
  let stopBatch = false;
  const stackFor = (key: string) => { let s = undoStacks.get(key); if (!s) { s = new UndoStack<Graph>(); undoStacks.set(key, s); } return s; };
  const syncUndoFlags = () => { const s = stackFor(get().activeTab); set({ canUndo: s.canUndo, canRedo: s.canRedo }); };
  /** Puts a graph on the active tab and the executor without touching the undo history. */
  const apply = (graph: Graph) => {
    const ex = get().executor;
    ex?.setGraph(graph);
    const runtimes: Record<string, NodeRuntime> = {};
    if (ex) for (const [id, rt] of ex.runtimes_()) runtimes[id] = rt;
    const { tabs, activeTab } = get();
    set({ graph, issues: validateGraph(graph), runtimes, tabs: tabs.map((t) => (t.key === activeTab ? { ...t, graph, dirty: dirtyOf(t, t.name, graph) } : t)) });
    persist();
  };
  /** Every edit goes through here: the graph before it becomes an undo step, coalesced for typing. */
  const refresh = (graph: Graph, opts: { coalesce?: string } = {}) => {
    stackFor(get().activeTab).record(get().graph, opts);
    apply(graph);
    syncUndoFlags();
  };

  return {
    ready: false,
    graph: { nodes: [], edges: [] },
    runtimes: {},
    issues: [],
    running: false,
    batch: null,
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
    sceneEditor: null,
    selectedNodeId: null,
    canUndo: false,
    canRedo: false,
    executor: null,

    init() {
      if (get().ready) return;
      bootstrapClient();
      const prefs = loadUiPrefs();
      // The tabs that were open, or the single project an older build saved, or a first open: the
      // core template as data, so no registry has to be ready yet.
      const stored = loadTabs();
      // A tab stored clean is, by definition, at its saved state: give it the hash it predates.
      const tabs: WorkflowTab[] = stored?.tabs.length
        ? stored.tabs.map((t) => (t.savedHash || t.dirty ? t : { ...t, savedHash: savedHashOf(t.name, t.graph) }))
        // Nothing stored: the app opens on a graph that runs with no network, no model and no key —
        // seven nodes from typed lines to an MP4. It is not in the template browser (a person opens
        // the app to *their* work, not to a demo they must delete first), it is what "first run" is.
        : [{ key: tabKey(), fileId: null, name: 'Static Script', graph: structuredClone(firstRunGraph.graph) as Graph, dirty: false }];
      const active = tabs.find((t) => t.key === stored?.active) ?? tabs[0]!;
      const graph = active.graph;
      const executor = new RemoteExecutor(active.key, graph, active.name, {
        onStateChange: (nodeId, runtime) => set((s) => ({ runtimes: { ...s.runtimes, [nodeId]: runtime } })),
        onRunStart: ({ stepTotal }) => set({ running: true, step: { nodeId: '', step: 0, total: stepTotal }, viewingRun: null }),
        onStep: ({ nodeId, step, stepTotal }) => set({ step: { nodeId, step, total: stepTotal } }),
        onRunEnd: () => set((s) => (s.batch ? { step: null } : { running: false, step: null })),
        onHistory: (history) => set({ history }),
        onParamsPatch: (nodeId, patch) => get().applyParamsPatch(nodeId, patch),
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
      undoStacks.delete(key);
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
      set({ tabs: get().tabs.map((t) => (t.key === tab.key ? { ...t, dirty: false, savedHash: savedHashOf(t.name, t.graph) } : t)), workflowsTick: get().workflowsTick + 1 });
      persist();
      return 'saved';
    },

    async saveWorkflowAs(name) {
      const tab = get().tabs.find((t) => t.key === get().activeTab);
      if (!tab || !name.trim()) return;
      const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'workflow';
      const id = `${base}-${Date.now().toString(36)}`;
      await workflowsApi.save({ id, name: name.trim(), graph: structuredClone(tab.graph) });
      set({ tabs: get().tabs.map((t) => (t.key === tab.key ? { ...t, fileId: id, name: name.trim(), dirty: false, savedHash: savedHashOf(name.trim(), t.graph) } : t)), projectName: name.trim(), workflowsTick: get().workflowsTick + 1 });
      persist();
    },

    setParams(nodeId, patch) {
      const graph = get().graph;
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const next: Graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)) };
      get().executor?.invalidate(nodeId);
      refresh(next, { coalesce: `params:${nodeId}` });
    },

    applyParamsPatch(nodeId, patch) {
      const graph = get().graph;
      if (!graph.nodes.some((n) => n.id === nodeId)) return;
      refresh({ ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)) }, { coalesce: `self:${nodeId}` });
    },

    setNodePositions(positions) {
      const graph = get().graph;
      // React Flow reports a position change on mount and on select even when nothing moved; a
      // no-op must not mark the tab unsaved.
      const moved = Object.entries(positions).filter(([id, pos]) => { const n = graph.nodes.find((x) => x.id === id); return n && (n.position.x !== pos.x || n.position.y !== pos.y); });
      if (!moved.length) return;
      const next: Graph = { ...graph, nodes: graph.nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id]! } : n)) };
      refresh(next);
    },

    undo() {
      const prev = stackFor(get().activeTab).undo(get().graph);
      if (prev) { apply(prev); set({ selectedNodeId: null }); }
      syncUndoFlags();
    },

    redo() {
      const next = stackFor(get().activeTab).redo(get().graph);
      if (next) { apply(next); set({ selectedNodeId: null }); }
      syncUndoFlags();
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

    reconnect(edgeId, edge) {
      const g = get().graph;
      const old = g.edges.find((e) => e.id === edgeId);
      if (!old) return false;
      // The wire comes off first so the check below sees the port it is leaving as free.
      set({ graph: { ...g, edges: g.edges.filter((e) => e.id !== edgeId) } });
      if (get().connect(edge)) { get().executor?.invalidate(old.target); return true; }
      set({ graph: g });
      return false;
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

    async run(opts = {}) {
      const ex = get().executor;
      if (!ex) return;
      if (get().running) {
        ex.logs.push({ ts: Date.now(), nodeId: 'run', level: 'warn', message: 'run requested while another run is in progress' });
        return;
      }
      try {
        stopBatch = false;
        set({ running: true, batch: null });
        // A batch is the same workflow queued once per line, one after another (EXECUTION_ENGINE §9).
        // Sequential on purpose: the render already takes the whole machine, so two at once only
        // makes both slower — the same reason Remotion tells you to render one video at a time.
        const graphs = expandBatch(get().graph);
        if (graphs.length === 1) {
          await ex.run({ force: opts.force });
        } else {
          for (const [i, g] of graphs.entries()) {
            if (stopBatch) break;
            set({ batch: { index: i + 1, total: graphs.length } });
            ex.logs.push({ ts: Date.now(), nodeId: 'run', level: 'info', message: `batch ${i + 1}/${graphs.length}` });
            // One bad line does not abandon the rest, the way a failed prompt does not empty
            // ComfyUI's queue. Only an unusable graph or a lost server throws, and that ends it.
            const { ok } = await ex.run({ graph: g, force: opts.force });
            if (!ok) ex.logs.push({ ts: Date.now(), nodeId: 'run', level: 'warn', message: `batch ${i + 1}/${graphs.length} did not finish; carrying on` });
          }
          // Leave the server holding the graph the canvas shows, not the last variant of the batch.
          ex.setGraph(get().graph);
          set({ running: false, batch: null, step: null });
        }
      } catch (e) {
        set({ running: false, batch: null, step: null });
        if (e instanceof GraphInvalidError) {
          set({ issues: e.issues });
          ex.logs.push({ ts: Date.now(), nodeId: 'run', level: 'error', code: e.issues[0]?.code, message: e.issues.map((i) => `${i.nodeId ?? 'graph'}: ${i.code} ${i.message}`).join('; ') });
          return;
        }
        // The log bar is where a failed run is read; an uncaught rejection would only add the dev overlay.
        ex.logs.push({ ts: Date.now(), nodeId: 'run', level: 'error', code: (e as { code?: string }).code, message: e instanceof Error ? e.message : String(e) });
      }
    },

    cancel() {
      stopBatch = true;
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
      set({ tabs: get().tabs.map((t) => (t.fileId === id ? { ...t, fileId: null, dirty: true, savedHash: undefined } : t)), workflowsTick: get().workflowsTick + 1 });
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
      get().executor?.setName(name);
      set({ projectName: name, tabs: tabs.map((t) => (t.key === activeTab ? { ...t, name, dirty: dirtyOf(t, name, t.graph) } : t)) });
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
    setSceneEditor(target) {
      set({ sceneEditor: target });
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
