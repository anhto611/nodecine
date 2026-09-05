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
const shippedBlock = (id: string) => lookNodes('core/block').find((n) => (n.params as { id: string }).id === id);
/** The stage the shipped templates pair with a block, for graphs that never had a theme. */
const stageForBlocks = (ids: string[]): string => {
  const stageOf = (t: { graph: Graph }) => (t.graph.nodes.find((n) => n.type === 'core/stage')!.params as { id: string }).id;
  const blocksOf = (t: { graph: Graph }) => t.graph.nodes.filter((n) => n.type === 'core/block').map((n) => (n.params as { id: string }).id);
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
    blockIds.forEach((id, i) => {
      const src = shippedBlock(id) ?? { ...shippedBlock('text-card')!, params: { ...(shippedBlock('text-card')!.params as object), id } };
      const blockNode: Node = { ...structuredClone(src), id: `${n.id}-block-${id}`, position: { x, y: n.position.y + 260 * (i + 1) } };
      added.push(blockNode);
      edges.push({ id: `${n.id}-block-${id}-e`, source: blockNode.id, sourcePort: 'block', target: n.id, targetPort: 'blocks' });
    });
  }
  return { nodes: [...added, ...nodes], edges };
}
