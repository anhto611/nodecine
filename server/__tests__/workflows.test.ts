import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CURRENT_WORKFLOW_ID, deleteWorkflow, listWorkflows, readWorkflow, toWorkflowFile, workflowIdFor, workflowsDir, writeWorkflow } from '../workflows';
import { PROJECT_SCHEMA_VERSION } from '@/lib/migrate';

let dir = '';
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-wf-'));
  process.env.NODECINE_WORKFLOWS_DIR = dir;
});
afterAll(async () => {
  delete process.env.NODECINE_WORKFLOWS_DIR;
  await rm(dir, { recursive: true, force: true });
});

const graph = { nodes: [{ id: 'a', type: 'core/input-trigger', params: { value: 'x' }, bypassed: false, position: { x: 0, y: 0 } }], edges: [] };

describe('workflow files', () => {
  it('lives where the env says, under the project by default', () => {
    expect(workflowsDir()).toBe(path.resolve(dir));
  });

  it('validates, stamps and defaults the category on the way in', () => {
    const wf = toWorkflowFile({ id: 'my-video', name: 'My video', graph });
    expect(wf.category).toBe('mine');
    expect(wf.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(wf.updatedAt).toMatch(/^\d{4}-/);
    expect(() => toWorkflowFile({ id: '../etc', name: 'x', graph })).toThrow();
    expect(() => toWorkflowFile({ id: 'ok', name: 'x', graph: { nodes: 'nope' } })).toThrow();
  });

  it('writes atomically, lists newest first, reads back, deletes', async () => {
    await writeWorkflow(toWorkflowFile({ id: 'first', name: 'First', graph }, new Date('2026-01-01')));
    await writeWorkflow(toWorkflowFile({ id: 'second', name: 'Second', description: 'd', graph }, new Date('2026-02-01')));
    expect((await readdir(dir)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    const list = await listWorkflows();
    expect(list.map((w) => w.id)).toEqual(['second', 'first']);
    expect(list[0]).toMatchObject({ name: 'Second', description: 'd', category: 'mine', nodes: 1 });
    expect((await readWorkflow('first'))?.name).toBe('First');
    expect(await readWorkflow('nope')).toBeNull();
    expect(await deleteWorkflow('first')).toBe(true);
    expect(await deleteWorkflow('first')).toBe(false);
    expect((await listWorkflows()).map((w) => w.id)).toEqual(['second']);
  });

  it('refuses ids that could leave the directory', async () => {
    await expect(readWorkflow('../x')).rejects.toMatchObject({ code: 'WORKFLOW_ID_INVALID' });
    await expect(deleteWorkflow('a/b')).rejects.toMatchObject({ code: 'WORKFLOW_ID_INVALID' });
  });

  it('keeps the canvas autosave out of the list', async () => {
    await writeWorkflow(toWorkflowFile({ id: CURRENT_WORKFLOW_ID, name: 'canvas', category: 'current', graph }));
    expect((await listWorkflows()).some((w) => w.id === CURRENT_WORKFLOW_ID)).toBe(false);
    expect((await readWorkflow(CURRENT_WORKFLOW_ID))?.name).toBe('canvas');
  });

  it('brings a file from an older app forward on read', async () => {
    const old = { id: 'old', name: 'Old', category: 'mine', schemaVersion: 4, graph: { nodes: [{ id: 'f', type: 'github-showcase/github-fetcher', params: {}, bypassed: false, position: { x: 0, y: 0 } }], edges: [] } };
    await writeFile(path.join(dir, 'old.json'), JSON.stringify(old));
    const wf = await readWorkflow('old');
    expect(wf?.graph.nodes[0]!.type).toBe('core/github-fetcher');
    expect(wf?.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
  });

  it('skips a file that no longer parses instead of failing the list', async () => {
    await writeFile(path.join(dir, 'broken.json'), '{ not json');
    expect((await listWorkflows()).some((w) => w.id === 'broken')).toBe(false);
    expect((await readFile(path.join(dir, 'broken.json'), 'utf8')).length).toBeGreaterThan(0);
  });

  it('makes a file-safe id from a name', () => {
    expect(workflowIdFor('Video giới thiệu #1', 1000)).toBe('video-gioi-thieu-1-rs');
    expect(workflowIdFor('   ', 1000)).toBe('workflow-rs');
  });
});
