import type { Graph } from '@/core/engine/graph';
import githubShowcaseJson from '@/templates/github-showcase.json';
import quoteCardsJson from '@/templates/quote-cards.json';
import staticScriptJson from '@/templates/static-script.json';

/**
 * Version 4: the look became data on wires. Scenes name a block instead of a registered scene type,
 * the director's slots became beats, and `theme` became a Stage node. A saved graph is rewritten so
 * that every director and Static Script has a Stage and the Blocks it needs wired in, taken from the
 * shipped templates — which are the same definitions the old registered scenes turned into.
 */

type Node = Graph['nodes'][number];
type BlockLike = { id: string } & Record<string, unknown>;
type Edge = Graph['edges'][number];
type OldSlot = { sceneType: string; weight?: number; count?: number; factBindings?: Record<string, string> };
type OldScene = { sceneType: string; weight?: number; props?: Record<string, unknown> };

const BLOCK_OF_SCENE: Record<string, string> = {
  'core/title-card': 'text-card',
  'github-showcase/hook': 'hook',
  'github-showcase/mockup': 'mockup',
  'github-showcase/cta': 'cta',
  'quote-cards/quote': 'quote',
};
const STAGE_OF_THEME: Record<string, string> = {
  'core/dark': 'dark',
  'github-showcase/developer-dark': 'developer-dark',
  'quote-cards/ink': 'ink',
};

const shipped = [staticScriptJson, githubShowcaseJson, quoteCardsJson] as { graph: Graph }[];
const lookNodes = (type: string) => shipped.flatMap((t) => t.graph.nodes.filter((n) => n.type === type));
const shippedStage = (id: string) => lookNodes('core/stage').find((n) => (n.params as { id: string }).id === id) ?? lookNodes('core/stage')[0]!;
const shippedBlocks = (): BlockLike[] => lookNodes('core/blocks').flatMap((n) => (n.params as { blocks: BlockLike[] }).blocks);
const shippedBlock = (id: string) => shippedBlocks().find((b) => b.id === id);
/** The stage the shipped templates pair with a block, for graphs that never had a theme. */
const stageForBlocks = (ids: string[]): string => {
  const stageOf = (t: { graph: Graph }) => (t.graph.nodes.find((n) => n.type === 'core/stage')!.params as { id: string }).id;
  const blocksOf = (t: { graph: Graph }) => t.graph.nodes.filter((n) => n.type === 'core/blocks').flatMap((n) => (n.params as { blocks: BlockLike[] }).blocks.map((b) => b.id));
  // The template that carries every block wins; otherwise the first that carries any of them.
  const all = shipped.find((t) => ids.every((id) => blocksOf(t).includes(id)));
  const any = shipped.find((t) => ids.some((id) => blocksOf(t).includes(id)));
  return all ? stageOf(all) : any ? stageOf(any) : 'dark';
};

const slugOf = (sceneType: string) => BLOCK_OF_SCENE[sceneType] ?? sceneType.split('/').pop()!;

/** Old title-card props to text-card props; other blocks kept their prop names. */
function convertProps(sceneType: string, props: Record<string, unknown> | undefined): Record<string, unknown> {
  const p = { ...(props ?? {}) };
  if (sceneType === 'core/title-card') {
    if (p.subline !== undefined) p.body = p.subline;
    delete p.subline;
    delete p.accentColor;
  } else {
    delete p.accentColor;
  }
  return p;
}

function convertDirector(params: Record<string, unknown>): { params: Record<string, unknown>; blocks: string[]; theme?: string } {
  if (!Array.isArray(params.scenes)) return { params, blocks: [] };
  const slots = params.scenes as OldSlot[];
  const beats = slots.map((s) => ({
    role: slugOf(s.sceneType),
    brief: '',
    weight: s.weight ?? 1,
    count: s.count ?? 1,
    blocks: [slugOf(s.sceneType)],
    factBindings: s.factBindings ?? {},
  }));
  const { theme, scenes, ...rest } = params;
  void scenes;
  return { params: { ...rest, beats }, blocks: [...new Set(beats.map((b) => b.blocks[0]!))], theme: theme as string | undefined };
}

function convertStaticScript(params: Record<string, unknown>): { params: Record<string, unknown>; blocks: string[]; theme?: string } {
  if (!Array.isArray(params.scenes) || !(params.scenes as OldScene[]).some((s) => 'sceneType' in s)) return { params, blocks: [] };
  const scenes = (params.scenes as OldScene[]).map((s) => ({ blockId: slugOf(s.sceneType), weight: s.weight ?? 1, props: convertProps(s.sceneType, s.props) }));
  const { theme, ...rest } = params;
  return { params: { ...rest, scenes }, blocks: [...new Set(scenes.map((s) => s.blockId))], theme: theme as string | undefined };
}

export function migrateLookV4(graph: Graph): Graph {
  const nodes: Node[] = [];
  const edges: Edge[] = [...graph.edges];
  const added: Node[] = [];
  for (const n of graph.nodes) {
    const isDirector = n.type === 'core/ai-director';
    const isStatic = n.type === 'core/static-script';
    if (!isDirector && !isStatic) {
      nodes.push(n);
      continue;
    }
    const converted = isDirector ? convertDirector(n.params) : convertStaticScript(n.params);
    nodes.push({ ...n, params: converted.params });

    const hasStage = graph.edges.some((e) => e.target === n.id && e.targetPort === 'stage');
    if (hasStage) continue;
    // Blocks the node needs: what its old scenes named, or, for a director already on beats, what the beats name.
    let blockIds = converted.blocks;
    if (!blockIds.length && isDirector && Array.isArray(converted.params.beats)) {
      blockIds = [...new Set((converted.params.beats as { blocks?: string[] }[]).flatMap((b) => b.blocks ?? []))];
    }
    if (!blockIds.length) blockIds = ['text-card'];
    const stageId = (converted.theme && STAGE_OF_THEME[converted.theme]) ?? stageForBlocks(blockIds);

    const x = n.position.x - 300;
    const stageNode: Node = { ...structuredClone(shippedStage(stageId)), id: `${n.id}-stage`, position: { x, y: n.position.y } };
    added.push(stageNode);
    edges.push({ id: `${n.id}-stage-e`, source: stageNode.id, sourcePort: 'stage', target: n.id, targetPort: 'stage' });
    const defs = blockIds.map((id) => structuredClone(shippedBlock(id) ?? { ...shippedBlock('text-card')!, id }));
    const blocksNode: Node = { id: `${n.id}-blocks`, type: 'core/blocks', params: { blocks: defs }, bypassed: false, position: { x, y: n.position.y + 260 } };
    added.push(blocksNode);
    edges.push({ id: `${n.id}-blocks-e`, source: blocksNode.id, sourcePort: 'blocks', target: n.id, targetPort: 'blocks' });
  }
  return { nodes: [...added, ...nodes], edges };
}

/**
 * Version 6: one Block node per block became one Blocks node per catalogue. Block nodes that fed the
 * same port of the same node merge into one Blocks node there; a Block node wired nowhere becomes a
 * Blocks node of its own.
 */
export function migrateBlocksV6(graph: Graph): Graph {
  const oldBlocks = graph.nodes.filter((n) => n.type === 'core/block');
  if (!oldBlocks.length) return graph;
  const groups = new Map<string, Node[]>();
  for (const b of oldBlocks) {
    const edge = graph.edges.find((e) => e.source === b.id);
    const key = edge ? `${edge.target}:${edge.targetPort}` : `lone:${b.id}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const replaced = new Map<string, string>();
  const nodes: Node[] = graph.nodes.filter((n) => n.type !== 'core/block');
  for (const [key, members] of groups) {
    const first = members[0]!;
    const id = key.startsWith('lone:') ? first.id : `${key.split(':')[0]}-blocks`;
    nodes.push({ id, type: 'core/blocks', params: { blocks: members.map((m) => m.params) }, bypassed: members.every((m) => m.bypassed), position: first.position });
    for (const m of members) replaced.set(m.id, id);
  }
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const e of graph.edges) {
    const source = replaced.get(e.source);
    if (!source) { edges.push(e); continue; }
    const key = `${source}->${e.target}:${e.targetPort}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ ...e, id: `${source}-e-${e.target}`, source, sourcePort: 'blocks' });
  }
  return { nodes, edges };
}
