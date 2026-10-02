import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { registerNodes } from '@/capsules/nodes';
import { listTemplates, readTemplate, thumbnailFile } from '../templates';
import { workflowStore } from '../workflows';

describe('template storage', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-templates-'));
    process.env.NODECINE_WORKFLOWS_DIR = path.join(dir, 'workflows');
    registerNodes();
  });
  afterEach(async () => {
    delete process.env.NODECINE_WORKFLOWS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('lists the bundled summary template without putting it among personal workflows', async () => {
    const templates = await listTemplates(registerNodes);
    expect(templates).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'article-summary-vi', group: 'video', nodes: 8, thumbnail: '/api/templates/article-summary-vi/thumbnail' })]));
    const cover = await readFile(path.join(process.cwd(), 'templates', 'article-summary-vi', 'thumbnail.svg'), 'utf8');
    expect(cover).toContain('<svg');
    expect((await readTemplate('article-summary-vi', registerNodes))?.graph.nodes).toHaveLength(8);
    expect(await workflowStore(registerNodes).listWorkflows()).toEqual([]);
  });

  it('resolves the card art of a template it ships and of nothing else', async () => {
    const cover = thumbnailFile('article-summary-vi');
    expect(cover?.type).toBe('image/svg+xml');
    // The folder that owns the template owns its art: no file under public/ is involved any more.
    expect(cover?.path).toBe(path.join(process.cwd(), 'templates', 'article-summary-vi', 'thumbnail.svg'));
    expect(await readFile(cover!.path, 'utf8')).toContain('<svg');
    expect(thumbnailFile('my-workflow')).toBeNull();
    // The id is resolved against the registry, so it can never reach outside the template's folder.
    expect(thumbnailFile('../../public/templates/article-summary-vi.svg')).toBeNull();
  });

  it('returns no template for an id outside the shipped gallery', async () => {
    expect(await readTemplate('my-workflow', registerNodes)).toBeNull();
  });
});
