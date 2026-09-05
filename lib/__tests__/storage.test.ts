import { describe, expect, it } from 'vitest';
import { PROJECT_SCHEMA_VERSION, migrateProject, type ProjectDoc } from '../storage';

const doc = (schemaVersion: number, nodes: ProjectDoc['graph']['nodes']): ProjectDoc =>
  ({ schemaVersion, name: 'p', graph: { nodes, edges: [] } }) as ProjectDoc;
const at = { x: 0, y: 0 };
const stageOf = (d: ProjectDoc, id: string) => {
  const e = d.graph.edges.find((e) => e.target === id && e.targetPort === 'stage')!;
  return (d.graph.nodes.find((n) => n.id === e.source)!.params as { id: string }).id;
};
const blocksOf = (d: ProjectDoc, id: string) =>
  d.graph.edges.filter((e) => e.target === id && e.targetPort === 'blocks').flatMap((e) => (d.graph.nodes.find((n) => n.id === e.source)!.params as { blocks: { id: string }[] }).blocks.map((b) => b.id));

describe('project migration', () => {
  it('v1 → provider nodes fold into one node per port type', () => {
    const out = migrateProject(doc(1, [
      { id: 'a', type: 'core/claude-code-provider', params: { model: 'opus' }, bypassed: false, position: at },
      { id: 'b', type: 'core/system-tts-provider', params: { rate: 1.2, defaultVoice: 'Linh' }, bypassed: false, position: at },
    ]));
    expect(out.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(out.graph.nodes[0]).toMatchObject({ type: 'core/llm-provider', params: { providerId: 'claude-code', settings: { model: 'opus' } } });
    expect(out.graph.nodes[1]).toMatchObject({ type: 'core/tts-provider', params: { providerId: 'system-tts', settings: { rate: 1.2 }, defaultVoice: 'Linh' } });
  });

  it('v2 → the two per-video directors become the core director with their old behaviour as beats, and get their look wired in', () => {
    const out = migrateProject(doc(2, [
      { id: 'g', type: 'github-showcase/ai-director', params: { outputLanguage: 'vi' }, bypassed: false, position: at },
      { id: 'q', type: 'quote-cards/quote-director', params: { outputLanguage: 'auto', count: 6 }, bypassed: false, position: at },
    ]));
    const g = out.graph.nodes.find((n) => n.id === 'g')!;
    expect(g.type).toBe('core/ai-director');
    expect(g.params.outputLanguage).toBe('vi');
    const named = (g.params.beats as { blocks: string[] }[]).flatMap((b) => b.blocks);
    expect(named).toEqual(expect.arrayContaining(['hook', 'mockup', 'cta']));
    expect(stageOf(out, 'g')).toBe('developer-dark');
    expect(blocksOf(out, 'g')).toEqual(expect.arrayContaining(['hook', 'mockup', 'cta']));

    const q = out.graph.nodes.find((n) => n.id === 'q')!;
    expect(q.type).toBe('core/ai-director');
    const beats = q.params.beats as { blocks: string[]; count: number }[];
    expect(beats.map((b) => b.blocks)).toEqual([['text-card'], ['quote']]);
    expect(beats[1]!.count).toBe(6); // the user's chosen count survives
    expect(stageOf(out, 'q')).toBe('ink');
  });

  it('v3 → slots become beats, scenes name blocks, theme becomes a Stage node, and the blocks come along', () => {
    const out = migrateProject(doc(3, [
      { id: 'd', type: 'core/ai-director', params: { prompt: 'p', outputLanguage: 'auto', theme: 'github-showcase/developer-dark', scenes: [
        { sceneType: 'core/title-card', weight: 0.5, count: 1, factBindings: {} },
        { sceneType: 'github-showcase/hook', weight: 1, count: 2, factBindings: { stars: 'stars' } },
      ] }, bypassed: false, position: { x: 400, y: 100 } },
      { id: 's', type: 'core/static-script', params: { theme: 'core/dark', script: 'hi', scenes: [{ sceneType: 'core/title-card', weight: 1, props: { headline: 'A', subline: 'B', accentColor: '#112233' } }] }, bypassed: false, position: at },
    ]));
    const d = out.graph.nodes.find((n) => n.id === 'd')!;
    expect('theme' in d.params).toBe(false);
    expect('scenes' in d.params).toBe(false);
    expect(d.params.beats).toEqual([
      { role: 'text-card', brief: '', weight: 0.5, count: 1, blocks: ['text-card'], factBindings: {} },
      { role: 'hook', brief: '', weight: 1, count: 2, blocks: ['hook'], factBindings: { stars: 'stars' } },
    ]);
    expect(stageOf(out, 'd')).toBe('developer-dark');
    expect(blocksOf(out, 'd')).toEqual(['text-card', 'hook']);

    const s = out.graph.nodes.find((n) => n.id === 's')!;
    expect(s.params.scenes).toEqual([{ blockId: 'text-card', weight: 1, props: { headline: 'A', body: 'B' } }]);
    expect(stageOf(out, 's')).toBe('dark');
    expect(blocksOf(out, 's')).toEqual(['text-card']);
  });

  it('v2 → a wire into the old quote director\'s topic port moves to the new source port', () => {
    const input: ProjectDoc = {
      schemaVersion: 2, name: 'p',
      graph: {
        nodes: [{ id: 'q', type: 'quote-cards/quote-director', params: {}, bypassed: false, position: at }],
        edges: [{ id: 'e', source: 'in', sourcePort: 'source', target: 'q', targetPort: 'topic' }],
      },
    } as ProjectDoc;
    expect(migrateProject(input).graph.edges[0]!.targetPort).toBe('source');
  });

  it('v4 → the GitHub fetcher becomes a core node', () => {
    const out = migrateProject(doc(4, [{ id: 'f', type: 'github-showcase/github-fetcher', params: {}, bypassed: false, position: at }]));
    expect(out.graph.nodes[0]!.type).toBe('core/github-fetcher');
  });

  it('v5 → Block nodes on the same port merge into one Blocks node; a lone one becomes its own', () => {
    const block = (id: string) => ({ id: `b-${id}`, type: 'core/block', params: { id, name: id, doc: { example: '', when: '' }, props: {}, code: { format: 'html-gsap', source: '' } }, bypassed: false, position: at });
    const out = migrateProject({
      schemaVersion: 5, name: 'p',
      graph: {
        nodes: [block('hook'), block('cta'), block('spare'), { id: 'd', type: 'core/ai-director', params: { prompt: 'p', beats: [] }, bypassed: false, position: at }],
        edges: [
          { id: 'e1', source: 'b-hook', sourcePort: 'block', target: 'd', targetPort: 'blocks' },
          { id: 'e2', source: 'b-cta', sourcePort: 'block', target: 'd', targetPort: 'blocks' },
        ],
      },
    } as ProjectDoc);
    expect(out.graph.nodes.filter((n) => n.type === 'core/block')).toEqual([]);
    expect(blocksOf(out, 'd')).toEqual(['hook', 'cta']);
    expect(out.graph.edges.filter((e) => e.target === 'd')).toHaveLength(1);
    expect(out.graph.nodes.filter((n) => n.type === 'core/blocks')).toHaveLength(2);
  });

  it('leaves a current document alone', () => {
    const input = doc(PROJECT_SCHEMA_VERSION, [{ id: 'x', type: 'core/ai-director', params: { prompt: 'p', beats: [] }, bypassed: false, position: at }]);
    expect(migrateProject(input).graph).toEqual(input.graph);
  });
});
