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
 * that used them. Each is a setting on the node that needs it now (CORE_CONTRACTS §1.3), so a saved
 * graph has them folded onto their consumers and the four nodes, with every wire, taken out.
 */
function registerResourceFolds(): void {
  registerResourceFold('core/llm-provider', (p) => ({ llmProvider: p.providerId ?? '', llmSettings: p.settings ?? {} }));
  registerResourceFold('core/tts-provider', (p) => ({ ttsProvider: p.providerId ?? '', ttsSettings: p.settings ?? {} }));
  registerResourceFold('core/hyperframes-engine', (p) => ({ engineId: 'hyperframes', engineSettings: p ?? {} }));
  registerResourceFold('core/remotion-engine', (p) => ({ engineId: 'remotion', engineSettings: p ?? {} }));
}

/**
 * The style sheet and the things that stay on screen were two nodes until 2026-09-12. Both are drawn
 * once, both are pinned, and one without the other is half an answer — a cast member is drawn in the
 * film's style — so they became one node, `core/set`, with a port out for each of them.
 *
 * A saved graph keeps the style node's id and settings; the cast node's members move onto it and its
 * wires are re-pointed at the `cast` port that is now on the same node.
 */
function mergeStyleAndCast(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  // By now the per-node pass has already renamed `core/style` to `core/set` (retired.json says what
  // it became); what is left to do is the half no single node can: move the cast onto it.
  const styles = graph.nodes.filter((n) => n.type === 'core/set');
  const casts = graph.nodes.filter((n) => n.type === 'core/cast');
  if (!casts.length) return graph;
  // Each cast belongs to the style wired into it; one with none joins the first style there is.
  const styleOf = (castId: string) => {
    const wire = graph.edges.find((e) => e.target === castId && e.targetPort === 'style');
    return styles.find((n) => n.id === wire?.source) ?? styles[0];
  };
  const taken = new Map<string, typeof casts>();
  for (const cast of casts) {
    const host = styleOf(cast.id);
    if (!host) continue;
    taken.set(host.id, [...(taken.get(host.id) ?? []), cast]);
  }
  const gone = new Set(casts.filter((c) => styleOf(c.id)).map((c) => c.id));
  const nodes = graph.nodes.filter((n) => !gone.has(n.id)).map((n) => {
    if (n.type !== 'core/set' || !taken.has(n.id)) return n;
    const members = (taken.get(n.id) ?? []).flatMap((c) => ((c.params as { members?: unknown[] }).members ?? []));
    notes.push({ nodeId: n.id, code: 'NODE_REPLACED', message: '"core/cast" moved onto "core/set" in 2026-09-12' });
    return { ...n, params: { ...n.params, members } };
  });
  const host = (id: string) => [...taken].find(([, list]) => list.some((c) => c.id === id))?.[0];
  const edges = graph.edges
    .filter((e) => !(gone.has(e.target) && e.targetPort === 'style'))
    .map((e) => (gone.has(e.source) ? { ...e, source: host(e.source) ?? e.source } : e))
    .filter((e) => !gone.has(e.source) && !gone.has(e.target));
  return { nodes, edges };
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
  const transcribes = graph.nodes.filter((n) => n.type === 'core/transcribe');
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
  const nodes = graph.nodes.filter((n) => !gone.has(n.id)).map((n) => {
    const from = [...moved].find(([, host]) => host === n.id)?.[0];
    if (!from) return n;
    notes.push({ nodeId: n.id, code: 'NODE_REPLACED', message: '"core/captions" moved onto "core/transcribe" in 2026-09-12' });
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

/**
 * The cast and the layers were two payloads for one idea until 2026-09-13, on two ports of the
 * assembler, which turned the first into the second on the way in. One payload now, one port.
 *
 * Every wire is re-pointed: the Set's `cast` port is `layers`, the Layer node's `layer` port is
 * `layers`, and everything that read either reads `layers`. No node moves and no parameter changes;
 * only the names on the ends of the wires.
 */
const PORTS_RENAMED: { type: string; from: string; to: string; side: 'out' | 'in' }[] = [
  { type: 'core/set', from: 'cast', to: 'layers', side: 'out' },
  { type: 'core/layer', from: 'layer', to: 'layers', side: 'out' },
  { type: 'core/timeline-assembler', from: 'cast', to: 'layers', side: 'in' },
  { type: 'core/illustrator', from: 'cast', to: 'layers', side: 'in' },
];

/** A cast member as a layer: the same thing said the other way, with what the assembler filled in. */
const memberAsLayer = (m: Record<string, unknown>) => ({
  kind: 'code' as const,
  id: m.id,
  brief: m.brief ?? '',
  placement: m.placement ?? 'over',
  width: m.width,
  height: m.height,
  source: m.source ?? '',
  startSeconds: 0,
});

function mergeCastIntoLayers(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const typeOf = (id: string) => graph.nodes.find((n) => n.id === id)?.type;
  let touched = false;
  // A pin is keyed by port name and holds the payload that port carried, so renaming the port
  // without moving the pin leaves a pinned node emitting a payload nothing reads. That is exactly
  // the shape of bug a pin exists to avoid: the node never runs, so nothing would ever correct it.
  const nodes = graph.nodes.map((n) => {
    if (!n.pinned) return n;
    const outs = n.pinned.outputs as Record<string, unknown>;
    if (n.type === 'core/set' && outs.cast) {
      const { cast, ...rest } = outs;
      const members = ((cast as { members?: Record<string, unknown>[] }).members ?? []).map(memberAsLayer);
      touched = true;
      notes.push({ nodeId: n.id, code: 'PIN_MOVED', message: 'the pinned cast became a pinned layer sheet on 2026-09-13' });
      return { ...n, pinned: { ...n.pinned, outputs: { ...rest, layers: { layers: members } } } };
    }
    if (n.type === 'core/layer' && outs.layer) {
      const { layer, ...rest } = outs;
      touched = true;
      return { ...n, pinned: { ...n.pinned, outputs: { ...rest, layers: { layers: [layer] } } } };
    }
    return n;
  });
  const edges = graph.edges.map((e) => {
    let next = e;
    for (const r of PORTS_RENAMED) {
      if (r.side === 'out' && typeOf(e.source) === r.type && e.sourcePort === r.from) { next = { ...next, sourcePort: r.to }; touched = true; }
      if (r.side === 'in' && typeOf(e.target) === r.type && e.targetPort === r.from) { next = { ...next, targetPort: r.to }; touched = true; }
    }
    return next;
  });
  if (touched) notes.push({ code: 'PORT_RENAMED', message: 'the cast and the layers became one payload on 2026-09-13' });
  return touched ? { nodes, edges } : graph;
}

/**
 * The Illustrator drew a style and then every scene of the film, every run. The plates draw one
 * layout per shape of content instead, and the scene builder pours the words in with no model at
 * all — same input, same `ScenePlan` out, and after the first run it costs nothing. It was retired
 * on 2026-09-13 once both did the same job.
 *
 * One node becomes three: a Set holding the look it used to draw itself, a Plate Maker, and a Scene
 * Builder. Its own settings move to the node that now owns each: the brief, the frame, the ground
 * and the character to the Set, the transition to the Scene Builder, and a thing that spanned the
 * film to the Set's list of layers, where such things live now.
 */
const DREW_SCENES = ['core/illustrator', 'core/art-director'];

function retireIllustrator(graph: Graph, notes: { nodeId?: string; code: string; message: string }[]): Graph {
  const drawn = graph.nodes.filter((n) => DREW_SCENES.includes(n.type));
  if (!drawn.length) return graph;
  const nodes = graph.nodes.filter((n) => !DREW_SCENES.includes(n.type));
  const edges = graph.edges.filter((e) => !drawn.some((d) => d.id === e.source || d.id === e.target));
  const wire = (source: string, sourcePort: string, target: string, targetPort: string) =>
    edges.push({ id: `${source}-${sourcePort}-${target}-${targetPort}`, source, sourcePort, target, targetPort });

  for (const ill of drawn) {
    const p = ill.params as Record<string, unknown>;
    const at = ill.position;
    const styleWire = graph.edges.find((e) => e.target === ill.id && e.targetPort === 'style');
    const layerWire = graph.edges.find((e) => e.target === ill.id && e.targetPort === 'layers');
    const scenesWire = graph.edges.find((e) => e.target === ill.id && e.targetPort === 'scenes');
    // A set was wired in, or this node was drawing the look itself and one has to be made for it.
    let setId = styleWire?.source;
    if (!setId) {
      setId = `${ill.id}-set`;
      const spanning = String(p.spanning ?? '').trim();
      nodes.push({
        id: setId,
        type: 'core/set',
        params: {
          llmProvider: p.llmProvider ?? '', llmSettings: p.llmSettings ?? {},
          brief: p.brief ?? '', frame: p.frame ?? '9:16', character: p.character ?? '',
          ground: p.ground ?? 'solid', form: p.form ?? '', language: 'auto',
          members: spanning
            ? [{ id: 'spanning', brief: spanning, placement: p.spanningPlacement ?? 'over', width: p.spanningWidth ?? 0, height: p.spanningHeight ?? 0, source: '' }]
            : [],
        },
        bypassed: false,
        position: { x: at.x, y: at.y + 260 },
      });
      // Whatever read the Illustrator's own layer port now reads the set's.
      for (const e of graph.edges) if (e.source === ill.id && e.sourcePort === 'layer') wire(setId, 'layers', e.target, e.targetPort);
    }
    const plates = `${ill.id}-plates`;
    const compose = ill.id;
    nodes.push(
      { id: plates, type: 'core/plates', params: { llmProvider: p.llmProvider ?? '', llmSettings: p.llmSettings ?? {}, redraw: false }, bypassed: false, position: at },
      // Empty, not just absent: a graph saved before the Illustrator had a transition carries '',
      // and a scene plan with a nameless transition is one no engine can draw.
      { id: compose, type: 'core/compose', params: { transition: String(p.transition ?? '').trim() || 'fade', transitionSeconds: Number(p.transitionSeconds) > 0 ? p.transitionSeconds : 0.4 }, bypassed: false, position: { x: at.x + 340, y: at.y } },
    );
    if (scenesWire) {
      wire(scenesWire.source, scenesWire.sourcePort, plates, 'scenes');
      wire(scenesWire.source, scenesWire.sourcePort, compose, 'scenes');
    }
    wire(setId, 'style', plates, 'style');
    wire(setId, 'style', compose, 'style');
    wire(layerWire ? layerWire.source : setId, layerWire ? layerWire.sourcePort : 'layers', plates, 'layers');
    wire(plates, 'plates', compose, 'plates');
    // The Scene Builder took the Illustrator's id, so everything that read its plan still does.
    for (const e of graph.edges) if (e.source === ill.id && e.sourcePort === 'plan') wire(compose, 'plan', e.target, e.targetPort);
    notes.push({ nodeId: ill.id, code: 'NODE_REPLACED', message: `"${ill.type}" became a Set, a Plate Maker and a Scene Builder on 2026-09-13` });
  }
  return { nodes, edges };
}

export function registerDocMigrations(): void {
  registerResourceFolds();
  registerGraphStep(mergeStyleAndCast);
  registerGraphStep(mergeCaptionsIntoTranscribe);
  registerGraphStep(mergeCastIntoLayers);
  registerGraphStep(retireIllustrator);
  registerDocMigration(1, (doc: SavedDoc): SavedDoc => ({
    ...doc,
    graph: {
      ...doc.graph,
      nodes: doc.graph.nodes.map((n) => {
        const moved = PROVIDER_NODES_V2[n.type];
        if (!moved) return n;
        // The vendor moved into `providerId`, and what used to be loose parameters became `settings`.
        const { defaultVoice, rate, model } = n.params as Record<string, unknown>;
        const settings = moved.providerId === 'claude-code'
          ? (model !== undefined ? { model } : {})
          : { rate: typeof rate === 'number' ? rate : 1 };
        return { ...n, type: moved.type, params: { providerId: moved.providerId, settings, ...(defaultVoice !== undefined ? { defaultVoice } : {}) } };
      }),
    },
  }));
}
