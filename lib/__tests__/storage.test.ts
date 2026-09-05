import { describe, expect, it } from 'vitest';
import { PROJECT_SCHEMA_VERSION, migrateProject, type ProjectDoc } from '../storage';

const doc = (schemaVersion: number, nodes: ProjectDoc['graph']['nodes']): ProjectDoc =>
  ({ schemaVersion, name: 'p', graph: { nodes, edges: [] } }) as ProjectDoc;
const at = { x: 0, y: 0 };

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

  it('v2 → the two per-video directors become the core director with their old behaviour as parameters', () => {
    const out = migrateProject(doc(2, [
      { id: 'g', type: 'github-showcase/ai-director', params: { outputLanguage: 'vi' }, bypassed: false, position: at },
      { id: 'q', type: 'quote-cards/quote-director', params: { outputLanguage: 'auto', count: 6 }, bypassed: false, position: at },
    ]));
    const g = out.graph.nodes[0]!;
    expect(g.type).toBe('core/ai-director');
    expect(g.params.outputLanguage).toBe('vi');
    expect(g.params.theme).toBe('github-showcase/developer-dark');
    expect((g.params.scenes as { sceneType: string }[]).map((s) => s.sceneType)).toEqual(['github-showcase/hook', 'github-showcase/mockup', 'github-showcase/cta']);

    const q = out.graph.nodes[1]!;
    expect(q.type).toBe('core/ai-director');
    expect(q.params.theme).toBe('quote-cards/ink');
    const slots = q.params.scenes as { sceneType: string; count: number }[];
    expect(slots.map((s) => s.sceneType)).toEqual(['core/title-card', 'quote-cards/quote']);
    expect(slots[1]!.count).toBe(6); // the user's chosen count survives
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

  it('leaves a current document alone', () => {
    const input = doc(PROJECT_SCHEMA_VERSION, [{ id: 'x', type: 'core/ai-director', params: { prompt: 'p', scenes: [] }, bypassed: false, position: at }]);
    expect(migrateProject(input).graph).toEqual(input.graph);
  });
});
