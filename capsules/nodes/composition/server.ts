import type { CompositionVariable } from '@/contracts/types/composition';
import { COMPOSITION_ENTRY } from '@/contracts/types/composition';

export interface Inspection {
  width: number | null;
  height: number | null;
  variables: CompositionVariable[];
  findings: { severity: 'error' | 'warning' | 'info'; code: string; message: string; fixHint?: string }[];
}

/**
 * What HyperFrames itself says about a project: the root's size, the variables its `<html>` declares
 * (parsed by HyperFrames, so a declaration it would drop is dropped here too), and the linter's
 * findings on the entry file. Server-side, because the linter is not built for the browser.
 */
export async function inspectComposition(files: Record<string, string>): Promise<Inspection> {
  const entry = files[COMPOSITION_ENTRY] ?? '';
  const [{ lintHyperframeHtml }, { parseCompositionVariables }] = await Promise.all([import('@hyperframes/core/lint'), import('@hyperframes/core/variables')]);
  const declared = /<html\b[^>]*\bdata-composition-variables\s*=\s*(['"])([\s\S]*?)\1/i.exec(entry)?.[2] ?? null;
  const variables = parseCompositionVariables({ getAttribute: (name: string) => (name === 'data-composition-variables' ? declared : null) } as unknown as Element) as CompositionVariable[];
  const lint = await lintHyperframeHtml(entry);
  const root = /<[a-z][^>]*\bdata-composition-id\s*=[^>]*>/i.exec(entry)?.[0] ?? '';
  const dim = (name: string) => { const m = new RegExp(`\\bdata-${name}\\s*=\\s*["']?(\\d+)`, 'i').exec(root); return m ? Number(m[1]) : null; };
  return {
    width: dim('width'),
    height: dim('height'),
    variables,
    findings: (lint.findings ?? []).map((f: { severity: string; code: string; message: string; fixHint?: string }) => ({ severity: f.severity as Inspection['findings'][number]['severity'], code: f.code, message: f.message, ...(f.fixHint ? { fixHint: f.fixHint } : {}) })),
  };
}

export const compositionServices = { 'composition/inspect': inspectComposition };
