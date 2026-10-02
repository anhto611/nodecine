import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { COMPOSITION_ENTRY, ProjectPathSchema, type CompositionVariable } from '@/contracts/types/composition';

import { previewPart } from './preview.server';

export interface Inspection {
  width: number | null;
  height: number | null;
  variables: CompositionVariable[];
  findings: { severity: 'error' | 'warning' | 'info'; code: string; message: string; fixHint?: string; file?: string }[];
}

/**
 * What HyperFrames itself says about a project: the root's size, the variables its `<html>` declares
 * (parsed by HyperFrames, so a declaration it would drop is dropped here too), and what its project
 * linter finds — the entry, the blocks under `compositions/`, and the stylesheets they link, the way
 * `hyperframes lint` sees them. The linter reads a directory, so the text files are written to a
 * scratch one for it. Server-side, because the linter is not built for the browser.
 */
export async function inspectComposition(files: Record<string, string>): Promise<Inspection> {
  const entry = files[COMPOSITION_ENTRY] ?? '';
  const [{ lintProject }, { parseCompositionVariables }] = await Promise.all([import('@hyperframes/lint'), import('@hyperframes/core/variables')]);
  const declared = /<html\b[^>]*\bdata-composition-variables\s*=\s*(['"])([\s\S]*?)\1/i.exec(entry)?.[2] ?? null;
  const variables = parseCompositionVariables({ getAttribute: (name: string) => (name === 'data-composition-variables' ? declared : null) } as unknown as Element) as CompositionVariable[];

  const dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-lint-'));
  const findings: Inspection['findings'] = [];
  try {
    for (const [relative, text] of Object.entries(files)) {
      const target = path.join(dir, ProjectPathSchema.parse(relative));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, text, 'utf8');
    }
    const lint = await lintProject(dir);
    for (const { file, result } of lint.results) {
      for (const f of result.findings) {
        findings.push({ severity: f.severity, code: f.code, message: f.message, ...(f.fixHint ? { fixHint: f.fixHint } : {}), file });
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const root = /<[a-z][^>]*\bdata-composition-id\s*=[^>]*>/i.exec(entry)?.[0] ?? '';
  const dim = (name: string) => {
    const m = new RegExp(`\\bdata-${name}\\s*=\\s*["']?(\\d+)`, 'i').exec(root);
    return m ? Number(m[1]) : null;
  };
  return { width: dim('width'), height: dim('height'), variables, findings };
}

export const compositionServices = { 'composition/inspect': inspectComposition };

/** What the node's dialog asks for while a person writes the project's blocks and components. */
export const compositionActions = { 'composition/preview-part': previewPart };
