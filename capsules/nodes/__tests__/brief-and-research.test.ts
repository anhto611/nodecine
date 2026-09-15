import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/capsules/nodes';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { _resetDocMigrations, migrateGraph } from '@/core/engine/migrate';
import { validateGraph, type Graph } from '@/core/engine/graph';

/**
 * Until 2026-09-15 the Storyboard Writer held what a video is about and read its link itself. A workflow
 * saved before then has to open with a Brief holding those fields and Research between it and the writer,
 * wired to the same composition and model, its pictures going to the writer's Assets.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetDocMigrations();
  registerNodes();
});

const saved: Graph = {
  nodes: [
    { id: 'composition', type: 'composition', version: 1, params: { files: { 'index.html': '<html></html>', 'storyboard-guide.md': '---\nhint.vi: Dán link bài viết\nhint.en: Paste the article link\nfirst: hook\n---\nBody' }, media: {} }, bypassed: false, position: { x: 40, y: 692 } },
    { id: 'assets', type: 'assets', version: 1, params: { items: [] }, bypassed: false, position: { x: 40, y: 43 } },
    { id: 'writer', type: 'storyboard-writer', version: 1, params: { llmProvider: 'claude-code', llmSettings: { model: 'opus' }, attempt: 0, rewrites: {}, edits: {}, subject: '', about: 'Kimi K2.7 https://kimi.com', durationSeconds: 90, tone: 'expert', language: 'vi', notes: 'không nói giá' }, bypassed: false, position: { x: 470, y: 576 } },
    { id: 'voice', type: 'tts', version: 1, params: { ttsProvider: 'system-tts', ttsSettings: {}, speed: 1 }, bypassed: false, position: { x: 900, y: 585 } },
  ],
  edges: [
    { id: 'e1', source: 'writer', sourcePort: 'script', target: 'voice', targetPort: 'script' },
    { id: 'e2', source: 'composition', sourcePort: 'composition', target: 'writer', targetPort: 'composition' },
    { id: 'e3', source: 'assets', sourcePort: 'assets', target: 'writer', targetPort: 'assets' },
  ],
};

describe('a workflow whose Storyboard Writer held its brief', () => {
  it('opens with a Brief and Research before the writer, wired, and the writer\'s settings where they belong', () => {
    const { graph, notes } = migrateGraph(structuredClone(saved));
    const byType = (type: string) => graph.nodes.find((n) => n.type === type)!;
    expect(byType('brief').params).toEqual({ about: 'Kimi K2.7 https://kimi.com', durationSeconds: 90, tone: 'expert', language: 'vi', notes: 'không nói giá', hint: { vi: 'Dán link bài viết', en: 'Paste the article link' } });
    expect(byType('research').params).toMatchObject({ llmProvider: 'claude-code', llmSettings: { model: 'opus' } });
    expect(Object.keys(byType('storyboard-writer').params).sort()).toEqual(['attempt', 'edits', 'llmProvider', 'llmSettings', 'rewrites', 'subject']);
    const wire = (e: { source: string; sourcePort: string; target: string; targetPort: string }) => `${e.source}.${e.sourcePort} → ${e.target}.${e.targetPort}`;
    expect(graph.edges.map(wire)).toEqual(expect.arrayContaining([
      'brief.brief → research.brief', 'brief.brief → writer.brief', 'research.research → writer.research',
      'brief.brief → assets.brief', 'research.research → assets.research',
    ]));
    expect(byType('assets').params).toMatchObject({ llmProvider: 'claude-code', llmSettings: { model: 'opus' } });
    expect(graph.edges.some((e) => e.target === byType('research').id && e.targetPort === 'composition')).toBe(false);
    expect(validateGraph(graph).filter((i) => i.severity === 'error')).toEqual([]);
    expect(notes.some((n) => n.nodeId === 'writer' && n.code === 'NODE_REPLACED')).toBe(true);

    // Opening it again changes nothing more.
    expect(migrateGraph(graph).graph).toEqual(graph);
  });
});

describe('a workflow whose Research read its guide from the composition', () => {
  it('opens with the guide as Research\'s own settings, and neither the wire nor the file left', () => {
    const graph: Graph = {
      nodes: [
        { id: 'composition', type: 'composition', version: 1, params: { files: { 'index.html': '<html></html>', 'research-guide.md': '---\nsearch: web\npictures: 6\n---\n# What to find\n- The number behind the claim.\n' }, media: {} }, bypassed: false, position: { x: 0, y: 0 } },
        { id: 'brief', type: 'brief', version: 1, params: { about: 'Kimi K2.7' }, bypassed: false, position: { x: 0, y: 0 } },
        { id: 'research', type: 'research', version: 1, params: { llmProvider: 'claude-code', llmSettings: {} }, bypassed: false, position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'brief', sourcePort: 'brief', target: 'research', targetPort: 'brief' },
        { id: 'e2', source: 'composition', sourcePort: 'composition', target: 'research', targetPort: 'composition' },
      ],
    };
    const { graph: after } = migrateGraph(graph);
    expect(after.nodes.find((n) => n.id === 'research')!.params).toMatchObject({ search: 'web', guide: '# What to find\n- The number behind the claim.' });
    expect(Object.keys((after.nodes.find((n) => n.id === 'composition')!.params as { files: Record<string, string> }).files)).toEqual(['index.html']);
    expect(after.edges.map((e) => e.id)).toEqual(['e1']);
    expect(validateGraph(after).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('a workflow whose Research brought the pictures', () => {
  it('opens with the Assets node finding them itself, from the brief and the research, with the same count and model', () => {
    const graph: Graph = {
      nodes: [
        { id: 'brief', type: 'brief', version: 1, params: { about: 'Kimi K2.7' }, bypassed: false, position: { x: 0, y: 0 } },
        { id: 'research', type: 'research', version: 1, params: { search: 'web', pictures: 6, guide: 'x', llmProvider: 'claude-code', llmSettings: {} }, bypassed: false, position: { x: 0, y: 0 } },
        { id: 'assets', type: 'assets', version: 1, params: { items: [], dropped: [], notes: {} }, bypassed: false, position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'brief', sourcePort: 'brief', target: 'research', targetPort: 'brief' },
        { id: 'e2', source: 'research', sourcePort: 'assets', target: 'assets', targetPort: 'found' },
      ],
    };
    const { graph: after } = migrateGraph(graph);
    const wire = (e: { source: string; sourcePort: string; target: string; targetPort: string }) => `${e.source}.${e.sourcePort} → ${e.target}.${e.targetPort}`;
    expect(after.edges.map(wire).sort()).toEqual(['brief.brief → assets.brief', 'brief.brief → research.brief', 'research.research → assets.research']);
    expect(after.nodes.find((n) => n.id === 'assets')!.params).toMatchObject({ pictures: 6, llmProvider: 'claude-code' });
    expect('pictures' in after.nodes.find((n) => n.id === 'research')!.params).toBe(false);
    expect(validateGraph(after).filter((i) => i.severity === 'error')).toEqual([]);
  });
});
