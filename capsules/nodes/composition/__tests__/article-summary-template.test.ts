import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { registerNodes } from '@/capsules/nodes';
import { WorkflowDocumentSchema } from '@/core/engine/document';
import { hasBlockingIssues, validateGraph } from '@/core/engine/graph';
import { readBlockCatalog } from '@/contracts/storyboard/blocks';
import { inspectComposition } from '@/capsules/nodes/composition/server';

describe('article summary template workflow', () => {
  it('has a valid graph and a renderable scene kit', async () => {
    registerNodes();
    const file = path.join(process.cwd(), 'templates', 'article-summary', 'workflow.json');
    const workflow = WorkflowDocumentSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    const issues = validateGraph(workflow.graph);
    expect(hasBlockingIssues(issues), JSON.stringify(issues)).toBe(false);
    const composition = workflow.graph.nodes.find((node) => node.type === 'composition');
    expect(composition).toBeDefined();
    const files = composition!.params.files as Record<string, string>;
    const blocks = readBlockCatalog(files);
    expect(blocks.map((block) => block.role)).toEqual(['outro', 'hook', 'feature']);
    for (const block of blocks) {
      expect(block.variables.filter((variable) => variable.required).map((variable) => variable.id)).toEqual(
        block.name === 'summary-point' ? ['title', 'detail', 'source', 'number'] : ['title', 'detail', 'source'],
      );
      expect(files[`compositions/${block.name}.html`]).toContain('gsap.timeline({paused:true})');
    }
    const inspection = await inspectComposition(files);
    expect(inspection.findings.filter((finding) => finding.severity === 'error')).toEqual([]);
  }, 30_000);
});
