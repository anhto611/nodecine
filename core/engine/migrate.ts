import { getNodeType, getRetiredNodeType } from '../nodes/definition';
import type { Graph, NodeInstance } from './graph';

/**
 * Bringing a saved workflow forward (ARCHITECTURE §2). A file somebody saved months ago has to open
 * today, and there are three separate ways it can be behind:
 *
 * 1. The **document** around the graph changed shape. That is `schemaVersion`, and it moves one step
 *    at a time through `DOC_MIGRATIONS`.
 * 2. A **node type** changed what its parameters mean. That is `NodeDefinition.version` against the
 *    `version` stamped on the saved node, and the capsule's own `migrate` closes the gap.
 * 3. A **node type is gone**. Nothing can be derived there, so it is declared: `nodes/retired.json`
 *    says what replaced it, or says plainly that nothing did.
 *
 * Everything here is a pure function of the graph and the registries. What it cannot do it reports
 * rather than swallows, because a graph that came back subtly wrong is worse than one that says so.
 */

/** The version stamped on every saved document. Bump it when the shape around the graph changes. */
export const PROJECT_SCHEMA_VERSION = 2;

/** A saved node with no `version` predates the stamp, so it is as old as the format allows. */
export const FIRST_NODE_VERSION = 1;

export interface SavedDoc {
  schemaVersion: number;
  graph: Graph;
  [key: string]: unknown;
}

/**
 * One step each, `from` → `from + 1`. Empty here like every other registry: a migration has to name
 * the node types it moved between, and those names belong outside the core (`nodes/migrations.ts`).
 */
export type DocMigration = (doc: SavedDoc) => SavedDoc;
const steps = new Map<number, DocMigration>();

export function registerDocMigration(from: number, step: DocMigration): void {
  if (from < 1 || from >= PROJECT_SCHEMA_VERSION) throw new Error(`a migration from ${from} leads nowhere; the current format is ${PROJECT_SCHEMA_VERSION}`);
  steps.set(from, step);
}

/** Every document version this build opens: the ones with a way forward, plus the current one. */
export function readableSchemaVersions(): number[] {
  return [...steps.keys(), PROJECT_SCHEMA_VERSION].sort((a, b) => a - b);
}

/** Test-only. */
export function _resetDocMigrations(): void {
  steps.clear();
}

export class DocVersionUnsupportedError extends Error {
  readonly code = 'WORKFLOW_VERSION_UNSUPPORTED';
  constructor(public readonly found: number) {
    super(`this workflow was saved in format ${found}; this build opens ${readableSchemaVersions().join(', ')}`);
    this.name = 'DocVersionUnsupportedError';
  }
}

/** What changed on the way forward, so the person can be told rather than surprised. */
export interface MigrationNote {
  nodeId?: string;
  code: 'DOC_FORMAT' | 'NODE_VERSION' | 'NODE_REPLACED' | 'NODE_RETIRED' | 'PARAMS_RESET' | 'PARAMS_DROPPED' | 'NODE_RESOURCE_FOLDED';
  message: string;
}

/** Step the document up to the current format, one version at a time. */
export function migrateDoc(doc: SavedDoc): { doc: SavedDoc; notes: MigrationNote[] } {
  const from = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : PROJECT_SCHEMA_VERSION;
  const older = from !== PROJECT_SCHEMA_VERSION;
  if (older && !readableSchemaVersions().includes(from)) throw new DocVersionUnsupportedError(from);

  let current = doc;
  for (let v = from; older && v < PROJECT_SCHEMA_VERSION; v++) {
    const step = steps.get(v);
    if (!step) throw new DocVersionUnsupportedError(from);
    current = step(current);
  }
  // The graph is brought forward whatever the document says. A node type retired today is retired
  // for files written yesterday too, and most changes to a node never touch the document format —
  // returning early on a current file meant every one of them was skipped, so a workflow saved this
  // morning opened this afternoon full of node types this build no longer has.
  const migrated = migrateGraph(current.graph);
  return {
    doc: { ...current, graph: migrated.graph, schemaVersion: PROJECT_SCHEMA_VERSION },
    notes: [...(older ? [{ code: 'DOC_FORMAT' as const, message: `brought forward from format ${from} to ${PROJECT_SCHEMA_VERSION}` }] : []), ...migrated.notes],
  };
}

/**
 * Bring every node of a graph up to the type it is today. Safe to run on a graph that is already
 * current: a node at its definition's version and not retired comes back untouched.
 */
export function migrateGraph(graph: Graph): { graph: Graph; notes: MigrationNote[] } {
  const notes: MigrationNote[] = [];
  // Per-node first: an old per-vendor provider is renamed to the plain one here, and only then is it
  // something the fold recognises. Folding first would leave it behind as a node nothing can run.
  const nodes = graph.nodes.map((node) => migrateNode(node, notes));
  return { graph: graphSteps.reduce((g, step) => step(g, notes), foldResourceNodes({ ...graph, nodes }, notes)), notes };
}

/**
 * A model, a voice or an engine used to be a node of its own, wired into everything that needed it.
 * Each is now a setting on the node that needs it (CORE_CONTRACTS §1.3), so a saved graph has its
 * providers folded into its consumers and the four old nodes, with every wire they were on, removed.
 * Folding has to happen here and not in a node's own `migrate`: the id being moved lives in a
 * different node, which a per-node migration never sees.
 */
const folds = new Map<string, (params: Record<string, unknown>) => Record<string, unknown>>();

/**
 * Say that a node type is gone and what its settings became on whoever it fed. Filled by
 * `nodes/migrations.ts`, the one file whose subject is node ids across time; core holds the
 * mechanism and names none of them.
 */
const graphSteps: ((graph: Graph, notes: MigrationNote[]) => Graph)[] = [];

/**
 * A change to the shape of a graph that no single node can make: two nodes becoming one, a wire
 * moving. Filled by `nodes/migrations.ts`, the one file whose subject is node ids across time.
 */
export function registerGraphStep(step: (graph: Graph, notes: MigrationNote[]) => Graph): void {
  graphSteps.push(step);
}

/** Test-only. */
export function _resetGraphSteps(): void {
  graphSteps.length = 0;
}

export function registerResourceFold(type: string, fields: (params: Record<string, unknown>) => Record<string, unknown>): void {
  folds.set(type, fields);
}

/** Test-only. */
export function _resetResourceFolds(): void {
  folds.clear();
}

function foldResourceNodes(graph: Graph, notes: MigrationNote[]): Graph {
  const resources = new Map(graph.nodes.filter((n) => folds.has(n.type)).map((n) => [n.id, n]));
  if (!resources.size) return graph;
  const patches = new Map<string, Record<string, unknown>>();
  for (const edge of graph.edges) {
    const from = resources.get(edge.source);
    if (!from) continue;
    patches.set(edge.target, { ...(patches.get(edge.target) ?? {}), ...folds.get(from.type)!(from.params) });
  }
  for (const [nodeId, patch] of patches) {
    notes.push({ nodeId, code: 'NODE_RESOURCE_FOLDED', message: `${Object.keys(patch).join(' and ')} moved onto this node; the resource nodes it was wired to are gone` });
  }
  return {
    nodes: graph.nodes.filter((n) => !resources.has(n.id)).map((n) => (patches.has(n.id) ? { ...n, params: { ...n.params, ...patches.get(n.id) } } : n)),
    edges: graph.edges.filter((e) => !resources.has(e.source) && !resources.has(e.target)),
  };
}

function migrateNode(node: NodeInstance, notes: MigrationNote[]): NodeInstance {
  let current = node;

  const retired = getRetiredNodeType(current.type);
  if (retired) {
    if (!retired.replacedBy) {
      notes.push({ nodeId: current.id, code: 'NODE_RETIRED', message: `"${current.type}" was removed in ${retired.since} and nothing replaced it` });
      return current;
    }
    notes.push({ nodeId: current.id, code: 'NODE_REPLACED', message: `"${current.type}" became "${retired.replacedBy}" in ${retired.since}` });
    // A replacement is a different node, so its parameters start at its own first version.
    current = { ...current, type: retired.replacedBy, version: FIRST_NODE_VERSION };
  }

  const def = getNodeType(current.type);
  if (!def) return current;

  const from = current.version ?? FIRST_NODE_VERSION;
  if (from < def.version && def.migrate) {
    current = { ...current, params: def.migrate(current.params, from) };
    notes.push({ nodeId: current.id, code: 'NODE_VERSION', message: `"${current.type}" settings brought from version ${from} to ${def.version}` });
  }

  const parsed = def.paramsSchema.safeParse(current.params);

  // A node that needed nothing goes back exactly as it came, down to the missing `version` stamp.
  // Opening a workflow must not be an edit: a graph that changed here would show as unsaved work
  // the person never did, and the stamp is put on at save time by `stampVersions`.
  // "Needed nothing" means the type is current, the version is current and the schema is happy.
  // A node behind its definition's version needed something even when the capsule wrote no
  // `migrate`: at the very least its stale settings have to be named and dropped.
  const changed = current !== node || from < def.version;
  if (!changed && parsed.success) return node;

  if (!parsed.success) {
    // Falling back to the defaults loses a setting; keeping parameters the schema refuses loses the
    // whole workflow, because validation stops the run before it starts.
    notes.push({
      nodeId: current.id,
      code: 'PARAMS_RESET',
      message: `"${current.type}" settings could not be carried over (${parsed.error.issues[0]?.message ?? 'invalid'}); the defaults were used`,
    });
    return { ...current, params: { ...(def.defaultParams as Record<string, unknown>) }, version: def.version };
  }

  // The schema accepting the parameters is not the same as the parameters still meaning something:
  // Zod drops a key it does not know without a word. Say which ones went, and drop them for real
  // rather than carrying them in the file forever.
  const data = parsed.data as Record<string, unknown>;
  const dropped = Object.keys(current.params).filter((key) => !(key in data));
  if (dropped.length) {
    notes.push({ nodeId: current.id, code: 'PARAMS_DROPPED', message: `"${current.type}" no longer has ${dropped.join(', ')}; ${dropped.length > 1 ? 'those settings were' : 'that setting was'} dropped` });
  }
  return { ...current, params: data, version: def.version };
}

/** The version to stamp on a node as it is saved, so a later build knows what wrote its parameters. */
export function stampVersions(graph: Graph): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const def = getNodeType(n.type);
      return def ? { ...n, version: def.version } : n;
    }),
  };
}
