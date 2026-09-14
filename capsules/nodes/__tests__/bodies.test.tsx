import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { NODE_BODIES } from '@/capsules/nodes/index.client';
import { useStudio } from '@/store/useStudio';
// The Studio's own host: these bodies are drawn the way the canvas draws them.
import { StudioNodeHost as wrapper } from '@/components/node-host';
import { _resetNodeRegistry, listNodeTypes } from '@/core/nodes/definition';
import { registerNodes } from '@/capsules/nodes';
import type { Graph } from '@/core/engine/graph';

/**
 * Every node body, mounted with the parameters a fresh node has.
 *
 * The thing this catches cannot be caught by a type checker or by reading the schema: a body asks
 * `FormBody` for a field, `FormBody` labels it `node.<name>`, and if nobody wrote that key the
 * dictionary falls back to the key itself and the person reads "node.maxChars" on their canvas.
 * Which fields a body actually draws is a decision inside the body, so the only way to know is to
 * draw it.
 */

/**
 * A dictionary key that fell through, as opposed to prose that merely contains a full stop. Read off
 * one text node at a time: `textContent` welds neighbouring nodes together, so a key would come back
 * with the next label stuck to it.
 */
const RAW_KEY = /^\s*((?:node|content|cap|state|common|port|error|issue)\.[a-zA-Z][A-Za-z0-9/-]*)\s*$/;

function keysShownIn(container: HTMLElement): string[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const found: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const m = RAW_KEY.exec(n.textContent ?? '');
    if (m) found.push(m[1]!);
  }
  return found;
}

beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
  useStudio.setState({ runtimes: {}, tabs: [], activeTab: 'bodies-test', executor: null, locale: 'en' });
});

const seed = (type: string, params: Record<string, unknown>) => {
  const graph: Graph = { nodes: [{ id: 'n', type, params, bypassed: false, position: { x: 0, y: 0 } }], edges: [] };
  useStudio.setState({ graph });
};

describe('every node body', () => {
  const types = () => listNodeTypes().filter((d) => NODE_BODIES[d.type]);

  it('is mounted by at least one capsule each, so this test covers the library', () => {
    expect(types().length).toBe(listNodeTypes().length);
  });

  for (const locale of ['en', 'vi'] as const) {
    it(`says nothing in ${locale} that is a dictionary key rather than a sentence`, () => {
      const leaks: string[] = [];
      for (const def of listNodeTypes()) {
        const Body = NODE_BODIES[def.type]!;
        useStudio.setState({ locale });
        seed(def.type, { ...(def.defaultParams as Record<string, unknown>) });
        const { container, unmount } = render(<Body nodeId="n" />, { wrapper });
        for (const key of keysShownIn(container)) leaks.push(`${def.type} · ${locale} · ${key}`);
        unmount();
      }
      expect(leaks).toEqual([]);
    });
  }
});
