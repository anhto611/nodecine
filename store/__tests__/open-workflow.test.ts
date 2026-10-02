import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useStudio } from '@/store/useStudio';
import { workflowsApi } from '@/lib/workflows.client';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { registerNodes } from '@/capsules/nodes';

/**
 * A file that will not open has a reason, and clicking it must not simply do nothing. The store used
 * to swallow every failure with `.catch(() => null)` and return, so the panel had nothing to show.
 */

let seq = 0;
beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
  useStudio.setState({ graph: { nodes: [], edges: [] }, tabs: [], activeTab: `open-${seq++}`, executor: null });
});
afterEach(() => vi.restoreAllMocks());

describe('opening a saved workflow', () => {
  it('says what had to be brought forward, and leaves the tab unsaved so it can be written back', async () => {
    vi.spyOn(workflowsApi, 'read').mockResolvedValue({
      id: 'old', name: 'Old', category: 'mine', graph: { nodes: [], edges: [] },
      migrations: [{ code: 'NODE_REPLACED', message: '"core/art-director" became "core/illustrator" in 2026-09-10' }],
    });
    const outcome = await useStudio.getState().openWorkflow('old');
    expect(outcome).toMatchObject({ kind: 'migrated' });
    expect(outcome!.why).toContain('core/illustrator');
    expect(useStudio.getState().tabs[0]!.dirty).toBe(true);
  });

  it('hands back why the server refused it', async () => {
    vi.spyOn(workflowsApi, 'read').mockRejectedValue(
      Object.assign(new Error('this workflow was saved in format 1; this build reads 2'), { code: 'WORKFLOW_VERSION_UNSUPPORTED' }),
    );
    const outcome = await useStudio.getState().openWorkflow('from-an-older-build');
    expect(outcome).toMatchObject({ kind: 'failed' });
    expect(outcome!.why).toContain('saved in format 1');
    expect(useStudio.getState().tabs).toHaveLength(0);
  });

  it('opens the file in a tab and reports nothing when it works', async () => {
    vi.spyOn(workflowsApi, 'read').mockResolvedValue({ id: 'mine', name: 'Mine', category: 'mine', graph: { nodes: [], edges: [] } });
    const outcome = await useStudio.getState().openWorkflow('mine');
    expect(outcome).toBeNull();
    expect(useStudio.getState().tabs.map((t) => t.fileId)).toEqual(['mine']);
  });

  it('reports nothing when the file is already open in a tab, and opens no second tab', async () => {
    vi.spyOn(workflowsApi, 'read').mockResolvedValue({ id: 'mine', name: 'Mine', category: 'mine', graph: { nodes: [], edges: [] } });
    await useStudio.getState().openWorkflow('mine');
    expect(await useStudio.getState().openWorkflow('mine')).toBeNull();
    expect(useStudio.getState().tabs).toHaveLength(1);
  });

  it('gives an open tab with nothing unsaved the file\'s version when the file changed on disk, and leaves unsaved work alone', async () => {
    const node = (about: string) => ({ id: 'b', type: 'brief', params: { about }, bypassed: false, position: { x: 0, y: 0 } });
    const read = vi.spyOn(workflowsApi, 'read').mockResolvedValue({ id: 'mine', name: 'Mine', category: 'mine', graph: { nodes: [node('first')], edges: [] } });
    await useStudio.getState().openWorkflow('mine');
    read.mockResolvedValue({ id: 'mine', name: 'Mine', category: 'mine', graph: { nodes: [node('changed on disk')], edges: [] } });
    await useStudio.getState().openWorkflow('mine');
    expect(useStudio.getState().tabs[0]!.graph.nodes[0]!.params.about).toBe('changed on disk');
    expect(useStudio.getState().tabs[0]!.dirty).toBe(false);

    useStudio.setState({ tabs: useStudio.getState().tabs.map((t) => ({ ...t, dirty: true, graph: { nodes: [node('my unsaved edit')], edges: [] } })) });
    read.mockResolvedValue({ id: 'mine', name: 'Mine', category: 'mine', graph: { nodes: [node('changed again')], edges: [] } });
    await useStudio.getState().openWorkflow('mine');
    expect(useStudio.getState().tabs[0]!.graph.nodes[0]!.params.about).toBe('my unsaved edit');
  });
});

describe('saving a workflow', () => {
  it('keeps the tab dirty when the graph changes while its save request is in flight', async () => {
    vi.spyOn(workflowsApi, 'read').mockResolvedValue({ id: 'mine', name: 'Mine', category: 'mine', graph: { nodes: [], edges: [] } });
    let finish!: () => void;
    const replace = vi.spyOn(workflowsApi, 'replace').mockImplementation(async () => {
      await new Promise<void>((resolve) => { finish = resolve; });
      return { id: 'mine', name: 'Mine', category: 'mine', graph: { nodes: [], edges: [] } };
    });
    await useStudio.getState().openWorkflow('mine');
    const pending = useStudio.getState().saveWorkflow();
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    const tab = useStudio.getState().tabs[0]!;
    useStudio.setState({ tabs: [{ ...tab, name: 'New name', dirty: true }] });
    finish();
    await pending;
    expect(useStudio.getState().tabs[0]).toMatchObject({ name: 'New name', dirty: true });
    expect(replace.mock.calls[0]![1].name).toBe('Mine');
  });

  it('keeps a deleted file attached when deletion fails', async () => {
    vi.spyOn(workflowsApi, 'read').mockResolvedValue({ id: 'mine', name: 'Mine', category: 'mine', graph: { nodes: [], edges: [] } });
    vi.spyOn(workflowsApi, 'remove').mockRejectedValue(new Error('disk unavailable'));
    await useStudio.getState().openWorkflow('mine');
    await expect(useStudio.getState().deleteWorkflow('mine')).rejects.toThrow('disk unavailable');
    expect(useStudio.getState().tabs[0]!.fileId).toBe('mine');
  });
});

describe('using a template', () => {
  it('opens an independent draft while keeping its source unchanged', () => {
    const source = { id: 'sample', name: 'Sample', category: 'template', graph: { nodes: [], edges: [] } };
    useStudio.getState().createFromTemplate(source);
    const draft = useStudio.getState().tabs[0]!;
    expect(draft).toMatchObject({ fileId: null, name: 'Sample', dirty: true });
    expect(draft.graph).not.toBe(source.graph);
    expect(draft.graph).toEqual(source.graph);
  });

});
