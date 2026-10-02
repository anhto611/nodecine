import { registerDocMigration, registerGraphStep, registerResourceFold, type SavedDoc } from '@/core/engine/migrate';
import type { Graph } from '@/core/engine/graph';

/**
 * How a saved document written by an older build becomes one this build can open. This is the one
 * file allowed to name node types that no longer exist beside ones that do, because that is exactly
 * what a migration is: a sentence about history. Core holds the mechanism and knows none of it.
 *
 * A step is written once, when the format is bumped, and then never touched again. `core/__tests__`
 * keeps a real file of each old format so a step that stops working fails the build.
 */

/** One node per provider became one node per port type, the way ComfyUI's Load Checkpoint works. */
const PROVIDER_NODES_V2: Record<string, { type: string; providerId: string }> = {
  'core/system-tts-provider': { type: 'core/tts-provider', providerId: 'system-tts' },
  'core/piper-provider': { type: 'core/tts-provider', providerId: 'piper' },
  'core/claude-code-provider': { type: 'core/llm-provider', providerId: 'claude-code' },
};

/**
 * A model, a voice and an engine were nodes of their own until 2026-09-12, wired into everything
 * that used them. Each is a setting on the node that needs it now, so a saved
 * graph has them folded onto their consumers and the four nodes, with every wire, taken out.
 */
function registerResourceFolds(): void {
  registerResourceFold('core/llm-provider', (p) => ({ llmProvider: p.providerId ?? '', llmSettings: p.settings ?? {} }));
  registerResourceFold('core/tts-provider', (p) => ({ ttsProvider: p.providerId ?? '', ttsSettings: p.settings ?? {} }));
  // The engine is named by the composition now, so the node it folded into keeps nothing of it.
  registerResourceFold('core/hyperframes-engine', () => ({}));
}

/**
 * Captions were a node of their own until 2026-09-12, and they could only ever sit behind Transcribe:
 * nothing else produces a voice carrying words. They are a second port on that node now.
 *
 * A saved graph keeps the transcribe node; the captions node's line length moves onto it and
 * anything that read its `captions` port is re-pointed at the same port on the transcribe node.
 */
function mergeCaptionsIntoTranscribe(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const captions = graph.nodes.filter((n) => n.type === 'core/captions');
  if (!captions.length) return graph;
  const transcribes = graph.nodes.filter((n) => n.type === 'transcribe');
  // Each captions node belongs to the transcribe wired into it; one with none joins the first there is.
  const hostOf = (id: string) => {
    const wire = graph.edges.find((e) => e.target === id && e.targetPort === 'voiceover');
    return transcribes.find((n) => n.id === wire?.source) ?? transcribes[0];
  };
  const moved = new Map<string, string>();
  for (const c of captions) {
    const host = hostOf(c.id);
    if (host) moved.set(c.id, host.id);
  }
  // A captions node with no transcribe anywhere has nowhere to go; leaving it alone would leave an
  // unknown type behind, so it goes and its wires go with it. Nothing downstream could run anyway.
  const gone = new Set(captions.map((c) => c.id));
  const chars = (id: string) => (graph.nodes.find((n) => n.id === id)?.params as { maxChars?: unknown } | undefined)?.maxChars;
  const nodes = graph.nodes
    .filter((n) => !gone.has(n.id))
    .map((n) => {
      const from = [...moved].find(([, host]) => host === n.id)?.[0];
      if (!from) return n;
      notes.push({ nodeId: n.id, code: 'NODE_REPLACED', message: '"core/captions" moved onto "transcribe" in 2026-09-12' });
      const maxChars = chars(from);
      return { ...n, params: { ...n.params, ...(typeof maxChars === 'number' ? { maxChars } : {}) } };
    });
  const edges = graph.edges
    // The wire that fed the captions node is the merge itself; it has nothing left to join.
    .filter((e) => !(gone.has(e.target) && e.targetPort === 'voiceover'))
    .map((e) => (gone.has(e.source) ? { ...e, source: moved.get(e.source) ?? e.source } : e))
    .filter((e) => !gone.has(e.source) && !gone.has(e.target));
  return { nodes, edges };
}

/** What the Storyboard Writer asked for itself until 2026-09-15, and a Brief node holds now. Everything else it asked for stays: it is the writer's. */
const BRIEF_FIELDS = ['about'] as const;
/** How far apart two columns of wide nodes sit on the canvas. */
const COLUMN = 430;

/**
 * Until 2026-09-15 the Storyboard Writer held what a video is about and read the page it linked to. A
 * Brief node holds that now, and Research reads the links, finds out more and brings the pictures.
 *
 * A saved graph whose writer still holds a brief gets a Brief node with those fields, and a Research node
 * between it and the writer, set up with the writer's model; the Assets node wired into the writer finds
 * pictures for the same brief. The describe box's placeholder, which the workflow's storyboard
 * guide carried, moves onto the Brief. Research starts with its default settings.
 */
function briefAndResearchBeforeTheWriter(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const writers = graph.nodes.filter((n) => n.type === 'storyboard-writer' && 'about' in n.params && !graph.edges.some((e) => e.target === n.id && e.targetPort === 'brief'));
  if (!writers.length) return graph;
  const ids = new Set(graph.nodes.map((n) => n.id));
  const fresh = (base: string) => {
    let id = base;
    for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
    ids.add(id);
    return id;
  };
  const edgeIds = new Set(graph.edges.map((e) => e.id));
  const edgeId = () => {
    let i = graph.edges.length + 1;
    while (edgeIds.has(`e${i}`)) i++;
    edgeIds.add(`e${i}`);
    return `e${i}`;
  };
  let nodes = [...graph.nodes];
  const edges = [...graph.edges];
  for (const writer of writers) {
    const briefId = fresh('brief');
    const researchId = fresh('research');
    const params = writer.params as Record<string, unknown>;
    const composition = graph.edges.find((e) => e.target === writer.id && e.targetPort === 'composition');
    const assets = graph.edges.find((e) => e.target === writer.id && e.targetPort === 'assets');
    const guide = composition ? String((graph.nodes.find((n) => n.id === composition.source)?.params as { files?: Record<string, string> } | undefined)?.files?.['storyboard-guide.md'] ?? '') : '';
    const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(guide)?.[1] ?? '';
    const hint = Object.fromEntries([...header.matchAll(/^\s*hint\.([a-z-]+)\s*:\s*(.+?)\s*$/gim)].map((m) => [m[1]!.toLowerCase(), m[2]!]));
    // Two new columns at the start of the flow: everything already there moves right to make room.
    const left = Math.min(...nodes.map((n) => n.position?.x ?? 0));
    const top = Math.min(...nodes.map((n) => n.position?.y ?? 0));
    nodes = nodes.map((n) => ({
      ...n,
      position: { x: (n.position?.x ?? 0) + COLUMN * 2, y: n.position?.y ?? 0 },
      ...(n.id === writer.id ? { params: Object.fromEntries(Object.entries(params).filter(([k]) => !(BRIEF_FIELDS as readonly string[]).includes(k))) } : {}),
    }));
    nodes.push(
      {
        id: briefId,
        type: 'brief',
        params: { ...Object.fromEntries(BRIEF_FIELDS.filter((k) => params[k] !== undefined).map((k) => [k, params[k]])), hint },
        bypassed: false,
        position: { x: left, y: top },
      },
      { id: researchId, type: 'research', params: { llmProvider: params.llmProvider ?? '', llmSettings: params.llmSettings ?? {} }, bypassed: false, position: { x: left + COLUMN, y: top } },
    );
    edges.push(
      { id: edgeId(), source: briefId, sourcePort: 'brief', target: researchId, targetPort: 'brief' },
      { id: edgeId(), source: briefId, sourcePort: 'brief', target: writer.id, targetPort: 'brief' },
      { id: edgeId(), source: researchId, sourcePort: 'research', target: writer.id, targetPort: 'research' },
      // The Assets node the writer reads finds pictures for the same brief.
      ...(assets ? [{ id: edgeId(), source: briefId, sourcePort: 'brief', target: assets.source, targetPort: 'brief' }] : []),
    );
    if (assets)
      nodes = nodes.map((n) =>
        n.id === assets.source && !(n.params as { llmProvider?: string }).llmProvider
          ? { ...n, params: { ...n.params, llmProvider: params.llmProvider ?? '', llmSettings: params.llmSettings ?? {} } }
          : n,
      );
    notes.push({ nodeId: writer.id, code: 'NODE_REPLACED', message: 'what the video is about moved from the Storyboard Writer onto a Brief node, and Research now reads its links (2026-09-15)' });
  }
  return { ...graph, nodes, edges };
}

/**
 * For an evening on 2026-09-15 Research read what to look for from `research-guide.md` in the composition
 * wired into it. What a workflow's research looks for is Research's own settings now: the guide's header
 * becomes `search` and `pictures`, its body `guide`, and the wire and the file go.
 */
function researchGuideOntoTheNode(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const wires = graph.edges.filter((e) => e.targetPort === 'composition' && graph.nodes.some((n) => n.id === e.target && n.type === 'research'));
  if (!wires.length) return graph;
  const files = (id: string) => (graph.nodes.find((n) => n.id === id)?.params as { files?: Record<string, string> } | undefined)?.files ?? {};
  const settings = new Map<string, Record<string, unknown>>();
  for (const wire of wires) {
    const text = files(wire.source)['research-guide.md'];
    if (text === undefined) continue;
    const header = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
    const field = (name: string) => new RegExp(`^\\s*${name}\\s*:\\s*(.*?)\\s*$`, 'im').exec(header?.[1] ?? '')?.[1];
    const pictures = Number.parseInt(field('pictures') ?? '', 10);
    settings.set(wire.target, {
      search: field('search') === 'web' ? 'web' : 'sources',
      ...(Number.isFinite(pictures) ? { pictures: Math.max(0, Math.min(20, pictures)) } : {}),
      guide: (header ? text.slice(header[0].length) : text).trim(),
    });
  }
  const sources = new Set(wires.map((w) => w.source));
  const nodes = graph.nodes.map((n) => {
    if (settings.has(n.id)) {
      notes.push({ nodeId: n.id, code: 'NODE_VERSION', message: 'what to look for moved from research-guide.md in the composition onto this node (2026-09-15)' });
      return { ...n, params: { ...n.params, ...settings.get(n.id) } };
    }
    if (sources.has(n.id) && files(n.id)['research-guide.md'] !== undefined) {
      const { 'research-guide.md': _moved, ...rest } = files(n.id);
      return { ...n, params: { ...n.params, files: rest } };
    }
    return n;
  });
  return { ...graph, nodes, edges: graph.edges.filter((e) => !wires.includes(e)) };
}

/**
 * For an evening on 2026-09-15 Research also brought pictures, handed to the Assets node on an Assets wire.
 * Finding pictures is the Assets node's own work now, from the brief wired into it: the wire goes, the
 * brief's comes, and how many pictures to find moves across with the model that finds them.
 */
function picturesOntoAssets(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const research = new Map(graph.nodes.filter((n) => n.type === 'research').map((n) => [n.id, n]));
  const wires = graph.edges.filter((e) => research.has(e.source) && e.sourcePort === 'assets');
  const counted = graph.nodes.filter((n) => research.has(n.id) && 'pictures' in n.params);
  if (!wires.length && !counted.length) return graph;
  const edgeIds = new Set(graph.edges.map((e) => e.id));
  const edgeId = () => {
    let i = graph.edges.length + 1;
    while (edgeIds.has(`e${i}`)) i++;
    edgeIds.add(`e${i}`);
    return `e${i}`;
  };
  const edges = graph.edges.filter((e) => !wires.includes(e));
  const patches = new Map<string, Record<string, unknown>>();
  for (const wire of wires) {
    const from = research.get(wire.source)!.params as Record<string, unknown>;
    const briefWire = graph.edges.find((e) => e.target === wire.source && e.targetPort === 'brief');
    const has = (port: string) => edges.some((e) => e.target === wire.target && e.targetPort === port);
    if (briefWire && !has('brief')) edges.push({ id: edgeId(), source: briefWire.source, sourcePort: briefWire.sourcePort, target: wire.target, targetPort: 'brief' });
    patches.set(wire.target, { ...(typeof from.pictures === 'number' ? { pictures: from.pictures } : {}), llmProvider: from.llmProvider ?? '', llmSettings: from.llmSettings ?? {} });
    notes.push({ nodeId: wire.target, code: 'NODE_VERSION', message: 'this node finds its pictures itself now, from the brief wired into it (2026-09-15)' });
  }
  const nodes = graph.nodes.map((n) => {
    if (research.has(n.id) && 'pictures' in n.params) {
      const { pictures: _moved, ...rest } = n.params;
      return { ...n, params: rest };
    }
    const patch = patches.get(n.id);
    if (!patch) return n;
    const own = n.params as { llmProvider?: string };
    return { ...n, params: { ...n.params, ...patch, ...(own.llmProvider ? { llmProvider: own.llmProvider, llmSettings: (n.params as { llmSettings?: unknown }).llmSettings } : {}) } };
  });
  return { ...graph, nodes, edges };
}

/**
 * Data Merge wrote caption lines into `captions.json` until 2026-09-15; no composition read them, karaoke
 * captions read the words in `voiceover.json`. A wire into the port that is gone goes with it.
 */
function captionsOffDataMerge(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const merges = new Set(graph.nodes.filter((n) => n.type === 'fill').map((n) => n.id));
  const gone = graph.edges.filter((e) => merges.has(e.target) && e.targetPort === 'captions');
  if (!gone.length) return graph;
  for (const e of gone) notes.push({ nodeId: e.target, code: 'NODE_VERSION', message: 'Data Merge no longer takes caption lines; that wire was removed (2026-09-15)' });
  return { ...graph, edges: graph.edges.filter((e) => !gone.includes(e)) };
}

/** What a Brief held for an evening on 2026-09-15 and only the Storyboard Writer uses. */
const WRITER_FIELDS = ['durationSeconds', 'language', 'tone', 'notes'] as const;

/**
 * For an evening on 2026-09-15 the Brief held the video's length, the narration's language and tone, and
 * what it must or must not say. Only the Storyboard Writer uses them, so they are its settings: they move
 * onto the writers the brief feeds.
 */
function writerChoicesOntoTheWriter(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const briefs = graph.nodes.filter((n) => n.type === 'brief' && WRITER_FIELDS.some((f) => f in n.params));
  if (!briefs.length) return graph;
  const moves = new Map<string, Record<string, unknown>>();
  for (const brief of briefs) {
    for (const e of graph.edges.filter((x) => x.source === brief.id && x.targetPort === 'brief')) {
      const target = graph.nodes.find((n) => n.id === e.target);
      if (target?.type !== 'storyboard-writer') continue;
      const fields = Object.fromEntries(WRITER_FIELDS.filter((f) => f in brief.params && !(f in target.params)).map((f) => [f, brief.params[f]]));
      if (Object.keys(fields).length) moves.set(target.id, { ...(moves.get(target.id) ?? {}), ...fields });
    }
  }
  const nodes = graph.nodes.map((n) => {
    if (briefs.includes(n)) return { ...n, params: Object.fromEntries(Object.entries(n.params).filter(([k]) => !(WRITER_FIELDS as readonly string[]).includes(k))) };
    const fields = moves.get(n.id);
    if (!fields) return n;
    notes.push({ nodeId: n.id, code: 'NODE_VERSION', message: `${Object.keys(fields).join(' and ')} moved from the Brief onto this node (2026-09-15)` });
    return { ...n, params: { ...n.params, ...fields } };
  });
  return { ...graph, nodes };
}

/**
 * For a night on 2026-09-15 Assets also read the research, for the pages it had read. It finds its own
 * pages now, with a model that searches the web, so the wire from Research goes.
 */
function researchOffAssets(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const assets = new Set(graph.nodes.filter((n) => n.type === 'assets').map((n) => n.id));
  const gone = graph.edges.filter((e) => assets.has(e.target) && e.targetPort === 'research');
  if (!gone.length) return graph;
  for (const e of gone) notes.push({ nodeId: e.target, code: 'NODE_VERSION', message: 'Assets no longer reads the research; that wire was removed (2026-09-16)' });
  return { ...graph, edges: graph.edges.filter((e) => !gone.includes(e)) };
}

export function registerDocMigrations(): void {
  registerResourceFolds();
  registerGraphStep(mergeCaptionsIntoTranscribe);
  registerGraphStep(briefAndResearchBeforeTheWriter);
  registerGraphStep(researchGuideOntoTheNode);
  registerGraphStep(picturesOntoAssets);
  registerGraphStep(researchOffAssets);
  registerGraphStep(captionsOffDataMerge);
  registerGraphStep(writerChoicesOntoTheWriter);
  registerDocMigration(1, (doc: SavedDoc): SavedDoc => ({
    ...doc,
    graph: {
      ...doc.graph,
      nodes: doc.graph.nodes.map((n) => {
        const moved = PROVIDER_NODES_V2[n.type];
        if (!moved) return n;
        // The vendor moved into `providerId`, and what used to be loose parameters became `settings`.
        const { defaultVoice, rate, model } = n.params as Record<string, unknown>;
        const settings = moved.providerId === 'claude-code' ? (model !== undefined ? { model } : {}) : { rate: typeof rate === 'number' ? rate : 1 };
        return { ...n, type: moved.type, params: { providerId: moved.providerId, settings, ...(defaultVoice !== undefined ? { defaultVoice } : {}) } };
      }),
    },
  }));
}
