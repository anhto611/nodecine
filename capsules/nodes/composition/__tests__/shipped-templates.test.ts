import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { registerNodes } from '@/capsules/nodes';
import { WorkflowDocumentSchema } from '@/core/engine/document';
import { hasBlockingIssues, validateGraph } from '@/core/engine/graph';
import { readBlockCatalog } from '@/contracts/storyboard/blocks';
import { inspectComposition } from '@/capsules/nodes/composition/server';

/**
 * Every template the gallery ships, held to the same bar: its graph must survive validation and its
 * scene kit must be one the engine accepts. A new template is a folder, so nothing else would notice
 * a kit that fails to parse or a scene the engine refuses — this walks the folder instead.
 */
describe('the shipped templates', () => {
  it('each carries a valid graph and a kit the engine accepts', async () => {
    registerNodes();
    const templatesDir = path.join(process.cwd(), 'templates');
    const folders = (await readdir(templatesDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .sort();
    expect(folders.length).toBeGreaterThan(0);

    for (const folder of folders) {
      const raw = JSON.parse(await readFile(path.join(templatesDir, folder, 'workflow.json'), 'utf8')) as unknown;
      const workflow = WorkflowDocumentSchema.parse(raw);
      const issues = validateGraph(workflow.graph);
      expect(hasBlockingIssues(issues), `${folder}: ${JSON.stringify(issues)}`).toBe(false);

      const files = workflow.graph.nodes.find((node) => node.params && 'files' in node.params)?.params.files as Record<string, string> | undefined;
      expect(files, `${folder}: no node carries a file map`).toBeDefined();
      expect(readBlockCatalog(files!).length, `${folder}: the composition has no blocks`).toBeGreaterThan(0);

      const inspection = await inspectComposition(files!);
      expect(
        inspection.findings.filter((finding) => finding.severity === 'error'),
        folder,
      ).toEqual([]);
    }
  }, 60_000);
});
