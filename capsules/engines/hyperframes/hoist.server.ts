import { parseHTMLContent } from '@hyperframes/core/compiler';

/**
 * A project whose sub-compositions mount sub-compositions of their own, flattened one level for the
 * preview bundle.
 *
 * `bundleToSingleHtml` gives each host it finds in the entry a runtime identity and hands it the
 * `data-variable-values` it carries; hosts it meets inside an inlined sub-composition are inlined too,
 * but without an identity, so their values never reach them and every nested part plays its
 * defaults (HyperFrames core 0.8.29, and still so on its main branch). The producer's own compile
 * does not have this gap, so renders are right and only the preview is wrong.
 *
 * So, for the preview only: a host whose file itself mounts sub-compositions has that file's content
 * written into the host, which keeps its id, timing and track. Its nested hosts are then hosts of the
 * entry, and the bundler treats them like any other. A sub-composition that means to be inlined this
 * way styles and scripts itself through `[data-composition-id="…"]`, never `#root`.
 */
export function hoistNestedCompositions(entry: string, readFile: (path: string) => string | undefined): { html: string; hoisted: number } {
  const doc = parseHTMLContent(entry);
  let hoisted = 0;
  for (const host of Array.from(doc.querySelectorAll('[data-composition-src]'))) {
    const src = host.getAttribute('data-composition-src') ?? '';
    const file = readFile(src);
    if (!file || !/data-composition-src\s*=/.test(file)) continue;
    const sub = parseHTMLContent(file);
    const template = sub.querySelector('template');
    const inner = template ? parseHTMLContent(template.innerHTML) : sub;
    const root = inner.querySelector('[data-composition-id]');
    if (!root) continue;
    host.innerHTML = root.innerHTML;
    host.removeAttribute('data-composition-src');
    hoisted++;
  }
  if (!hoisted) return { html: entry, hoisted };
  const doctype = /^\s*<!doctype[^>]*>/i.exec(entry)?.[0] ?? '<!doctype html>';
  return { html: `${doctype}\n${doc.documentElement.outerHTML}`, hoisted };
}
