import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CURRENT_WORKFLOW_ID, deleteWorkflow, listWorkflows, readWorkflow, toWorkflowFile, workflowIdFor, workflowsDir, writeWorkflow } from '../workflows';
import { PROJECT_SCHEMA_VERSION } from '@/lib/storage';

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

  it('refuses a file from another schema version (no migrators), says so, and leaves it on disk', async () => {
    const other = { id: 'other', name: 'Other', category: 'mine', schemaVersion: PROJECT_SCHEMA_VERSION + 1, graph: { nodes: [], edges: [] } };
    await writeFile(path.join(dir, 'other.json'), JSON.stringify(other));
    // Refused with a reason, not with `null`: `null` means "no such file", and a person who clicked
    // a workflow that is right there needs to be told why it did not open.
    await expect(readWorkflow('other')).rejects.toMatchObject({ code: 'WORKFLOW_VERSION_UNSUPPORTED' });
    // The list still skips it rather than falling over.
    expect((await listWorkflows()).some((w) => w.id === 'other')).toBe(false);
    expect((await readFile(path.join(dir, 'other.json'), 'utf8')).length).toBeGreaterThan(0);
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

describe('a workflow file that will not open', () => {
  const write = (id: string, body: string) => writeFile(path.join(dir, `${id}.json`), body, 'utf8');

  it('says the file is simply not there', async () => {
    // The one case that is not a failure: nothing to report beyond "no such workflow".
    expect(await readWorkflow('never-saved')).toBeNull();
  });

  it('says which format it was saved in, and which this build reads', async () => {
    await write('from-the-future', JSON.stringify({ id: 'from-the-future', name: 'Old', category: 'mine', graph, schemaVersion: PROJECT_SCHEMA_VERSION + 7 }));
    await expect(readWorkflow('from-the-future')).rejects.toMatchObject({ code: 'WORKFLOW_VERSION_UNSUPPORTED' });
    await expect(readWorkflow('from-the-future')).rejects.toThrow(String(PROJECT_SCHEMA_VERSION + 7));
  });

  it('says what is wrong with a file that is not a workflow', async () => {
    await write('half-written', '{"id": "half-written", "nam');
    await expect(readWorkflow('half-written')).rejects.toMatchObject({ code: 'WORKFLOW_MALFORMED' });

    await write('no-graph', JSON.stringify({ id: 'no-graph', name: 'No graph', category: 'mine', schemaVersion: PROJECT_SCHEMA_VERSION }));
    await expect(readWorkflow('no-graph')).rejects.toMatchObject({ code: 'WORKFLOW_MALFORMED' });
    // The message names the field, so the reason reaches the panel instead of a blank shrug.
    await expect(readWorkflow('no-graph')).rejects.toThrow(/graph/);
  });
});
