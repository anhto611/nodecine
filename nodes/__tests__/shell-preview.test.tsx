import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { NODE_BODIES } from '@/nodes/index.client';
import { useStudio } from '@/store/useStudio';
import { _resetNodeRegistry, getNodeType } from '@/core/nodes/definition';
import { registerNodes } from '@/nodes';
import { registerFakeEngineSupport, resetEngineSupport } from '@/contracts/__tests__/fakes';
import { buildScenePreview } from '@/nodes/hyperframes-engine/markup';
import { STYLE } from '@/contracts/__tests__/scene-fixtures';
import type { Graph } from '@/core/engine/graph';
import type { LayerSheet, PlateSheet, StyleSheet } from '@/contracts/types/payloads';

/**
 * Looking at the shell and the plates without running the film (USER_FLOWS §1.10).
 *
 * Both are drawn once and pinned, which is the whole point of them — and until now neither card
 * showed anything but a name and a count. A layout you approve once and every later video is drawn
 * in cannot be approved from a line of text, so both cards draw what they hold.
 */

const sheet: StyleSheet = { style: STYLE, guide: 'g', frame: { width: 1080, height: 1920 }, transparent: true };
const cast: LayerSheet = { layers: [{ kind: 'code', id: 'backdrop', brief: 'b', placement: 'under', startSeconds: 0, width: 1080, height: 1920, source: '<div class="bg"></div><style>.bg{position:absolute;inset:0;background:#07080b}</style>' }] };
const plates: PlateSheet = {
  plates: [
    { id: 'kicker_title', keys: ['kicker', 'title'], source: '<div class="b"><span data-slot="kicker">K</span><h1 data-slot="title">T</h1></div>', budget: { title: 64 } },
    { id: 'quote', keys: ['quote'], source: '<div class="q" data-slot="quote">Q</div>' },
  ],
};

const packet = (payload: unknown, t: string) => ({ type: t, payload, producedAt: 0, signature: 's' });
const params = (type: string) => ({ ...(getNodeType(type)!.defaultParams as Record<string, unknown>) });

/**
 * One node holding the outputs it would hold after a run, with its style already on the wire.
 *
 * The runtimes go on a stub executor rather than straight into the store: mounting a body writes
 * its parameters back, and every write rebuilds the runtime map from the executor. Put them only in
 * the store and the first render wipes them.
 */
function seed(type: string, outputs: Record<string, unknown>, inputs: Record<string, unknown> = {}) {
  const graph: Graph = {
    nodes: [
      { id: 'up', type: 'core/set', params: params('core/set'), bypassed: false, position: { x: 0, y: 0 } },
      { id: 'n', type, params: params(type), bypassed: false, position: { x: 0, y: 0 } },
    ],
    edges: Object.keys(inputs).map((port) => ({ id: `e-${port}`, source: 'up', sourcePort: 'style', target: 'n', targetPort: port })),
  };
  const runtimes = new Map<string, unknown>([
    ['up', { state: 'success', outputs: Object.fromEntries(Object.entries(inputs).map(([port, v]) => [port, packet(v, 'StyleSheet')])) }],
    ['n', { state: 'success', outputs: Object.fromEntries(Object.entries(outputs).map(([port, v]) => [port, packet(v, 'Any')])) }],
  ]);
  const executor = { setGraph() {}, runtimes_: () => runtimes, invalidate() {}, setBypassed() {}, logs: { all: () => [] } };
  useStudio.setState({ graph, executor: executor as never, runtimes: Object.fromEntries(runtimes) as never });
}

const frames = (c: HTMLElement) => c.querySelectorAll('iframe').length;

beforeEach(() => {
  _resetNodeRegistry();
  resetEngineSupport();
  registerNodes();
  registerFakeEngineSupport();
  useStudio.setState({ runtimes: {}, tabs: [], activeTab: 'preview-test', executor: null, locale: 'en' });
});

describe('the set card', () => {
  it('draws the shell once it has one', () => {
    const Body = NODE_BODIES['core/set']!;
    seed('core/set', { style: sheet, layers: cast });
    const { container } = render(<Body nodeId="n" />);
    expect(frames(container)).toBe(1);
  });

  it('draws nothing before it has run', () => {
    const Body = NODE_BODIES['core/set']!;
    seed('core/set', {});
    const { container } = render(<Body nodeId="n" />);
    expect(frames(container)).toBe(0);
  });
});

describe('the plate maker card', () => {
  it('draws one frame per plate, in the style wired into it', () => {
    const Body = NODE_BODIES['core/plates']!;
    seed('core/plates', { plates }, { style: sheet });
    const { container } = render(<Body nodeId="n" />);
    expect(frames(container)).toBe(plates.plates.length);
  });

  it('draws a couple of rows of a long catalogue, and says how many more there are', () => {
    // A card is 220 pixels wide and every frame is a whole document to build. Dumping a catalogue
    // of a hundred onto it stalls the canvas and shows nothing anybody can read.
    const many: PlateSheet = { plates: Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, keys: ['title'] as const, source: `<div data-slot="title">${i}</div>` })) };
    const Body = NODE_BODIES['core/plates']!;
    seed('core/plates', { plates: many }, { style: sheet });
    const { container } = render(<Body nodeId="n" />);
    expect(frames(container)).toBeLessThanOrEqual(12);
    expect(container.textContent).toContain('30 more');
  });

  it('says what is missing when no style reaches it, rather than drawing nothing', () => {
    const Body = NODE_BODIES['core/plates']!;
    seed('core/plates', { plates });
    const { container } = render(<Body nodeId="n" />);
    expect(frames(container)).toBe(0);
    expect(container.textContent).toContain('wire the set in');
  });
});

/**
 * A drawing that spans the film places and reveals itself from its own script — it starts
 * `visibility: hidden` and an `autoAlpha` tween brings it in. A still of one is therefore an empty
 * frame, which is what the member dialog showed until the preview learned to run the script.
 */
describe('a spanning drawing in the preview', () => {
  it('is built with its script when the preview is told to animate', async () => {
    const source = '<div class="hp"></div><style>.hp{visibility:hidden}</style><script>nodecine.timeline(gsap.timeline().to(".hp",{autoAlpha:1}));</script>';
    const still = buildScenePreview({ style: STYLE, source, width: 1080, height: 1920 });
    const moving = buildScenePreview({ style: STYLE, source, width: 1080, height: 1920, animate: { gsapSource: '/* gsap */' } });
    // The still carries no script at all, so nothing ever makes the drawing visible.
    expect(JSON.parse(/id="nodecine-data">([\s\S]*?)<\/script>/.exec(still)![1]!).scripts).toEqual([]);
    expect(JSON.parse(/id="nodecine-data">([\s\S]*?)<\/script>/.exec(moving)![1]!).scripts).toHaveLength(1);
    expect(moving).toContain('/* gsap */');
  });
});
