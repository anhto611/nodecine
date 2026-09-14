import { beforeEach, describe, expect, it } from 'vitest';
import { _resetNodeRegistry } from '@/core/nodes/definition';
import { registerNodes } from '@/nodes';
import { pinnedPayload, platesInGraph } from '../visual/plate-store';
import { STYLE } from './scene-fixtures';
import type { Graph } from '@/core/engine/graph';
import type { Plate, StyleSheet } from '../types/payloads';

/**
 * A workflow's plate store: every layout its own graph holds.
 *
 * The store belongs to the workflow, so what it shows comes from the graph on the canvas — the
 * plates a run just produced, and the pins for whatever has not run. Nothing is gathered from other
 * workflows: a plate is drawn against one style sheet and means nothing beside another.
 */

// The store reads the ports rather than node names, so it needs the registry to know what a port
// carries — the same thing the app has when the panel is open.
beforeEach(() => { _resetNodeRegistry(); registerNodes(); });

const sheet: StyleSheet = { style: STYLE, guide: 'g', frame: { width: 1080, height: 1920 }, transparent: false };
const plate = (id: string): Plate => ({ id, keys: ['title'], source: `<div data-slot="title">${id}</div>` });
const at = '2026-01-01T00:00:00.000Z';

function graphOf(plates: Plate[], o: { style?: StyleSheet | null; wired?: boolean; pinned?: boolean } = {}): Graph {
  const style = o.style === undefined ? sheet : o.style;
  return {
    nodes: [
      { id: 'set', type: 'core/set', params: {}, bypassed: false, position: { x: 0, y: 0 }, ...(style ? { pinned: { outputs: { style }, at } } : {}) },
      { id: 'pl', type: 'core/plates', params: {}, bypassed: false, position: { x: 0, y: 0 }, ...(o.pinned === false ? {} : { pinned: { outputs: { plates: { plates } }, at } }) },
    ],
    edges: o.wired === false ? [] : [{ id: 'e', source: 'set', sourcePort: 'style', target: 'pl', targetPort: 'style' }],
  };
}

const held = (graph: Graph) => platesInGraph(graph, pinnedPayload(graph));

describe('the plates a workflow holds', () => {
  it('are the ones its graph carries, each with the style it was drawn against', () => {
    const found = held(graphOf([plate('a'), plate('b')]));
    expect(found.map((p) => p.plate.id)).toEqual(['a', 'b']);
    expect(found[0]!.style.style.name).toBe(STYLE.name);
    expect(found[0]!.signature).toBe('title');
    expect(found[0]!.nodeId).toBe('pl');
  });

  it('are none while nothing has been drawn or pinned', () => {
    expect(held(graphOf([plate('a')], { pinned: false }))).toEqual([]);
  });

  it('are none with no sheet behind them: a layout nobody can draw is worse than a gap', () => {
    // The markup names classes and variables the sheet defines. Shown against another sheet it is
    // not a plate that came out badly, it is a plate rendered wrong.
    expect(held(graphOf([plate('a')], { style: null }))).toEqual([]);
    expect(held(graphOf([plate('a')], { wired: false }))).toEqual([]);
  });

  it('come from the run when there was one, over what the pin holds', () => {
    const graph = graphOf([plate('pinned')]);
    const pinned = pinnedPayload(graph);
    const ran = platesInGraph(graph, (nodeId, port) =>
      nodeId === 'pl' && port === 'plates' ? { plates: [plate('fresh')] } : pinned(nodeId, port));
    expect(ran.map((p) => p.plate.id)).toEqual(['fresh']);
  });

  it('count one when two plate makers in the graph drew the same thing', () => {
    const graph = graphOf([plate('a')]);
    graph.nodes.push({ id: 'pl2', type: 'core/plates', params: {}, bypassed: false, position: { x: 0, y: 0 }, pinned: { outputs: { plates: { plates: [plate('a')] } }, at } });
    graph.edges.push({ id: 'e2', source: 'set', sourcePort: 'style', target: 'pl2', targetPort: 'style' });
    expect(held(graph)).toHaveLength(1);
  });
});
