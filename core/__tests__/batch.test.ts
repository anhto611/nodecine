import { describe, expect, it } from 'vitest';
import { batchLines, batchPlan, expandBatch } from '../engine/batch';
import type { Graph } from '../engine/graph';

const input = (id: string, value: string, perRun: boolean) => ({ id, type: 'core/input-trigger', params: { value, perRun }, bypassed: false, position: { x: 0, y: 0 } });
const graphOf = (...nodes: ReturnType<typeof input>[]): Graph => ({ nodes, edges: [] });
const valuesOf = (gs: Graph[], id: string) => gs.map((g) => g.nodes.find((n) => n.id === id)!.params.value);

describe('batchLines', () => {
  it('is empty unless the node asked for it', () => {
    expect(batchLines({ value: 'a\nb', perRun: false })).toEqual([]);
    expect(batchLines({ value: 'a\nb', perRun: true })).toEqual(['a', 'b']);
  });
  it('drops blank lines and the space around each one', () => {
    expect(batchLines({ value: '  a  \n\n\n b \n  ', perRun: true })).toEqual(['a', 'b']);
  });
});

describe('expandBatch', () => {
  it('leaves an ordinary graph exactly as it is', () => {
    const g = graphOf(input('in', 'a\nb\nc', false));
    expect(expandBatch(g)).toEqual([g]);
    expect(batchPlan(g).runs).toBe(1);
  });

  it('makes one graph per line, each carrying only its own line', () => {
    const g = graphOf(input('in', 'https://one\nhttps://two\nhttps://three', true));
    const out = expandBatch(g);
    expect(out).toHaveLength(3);
    expect(valuesOf(out, 'in')).toEqual(['https://one', 'https://two', 'https://three']);
    // The graph handed in is untouched: the canvas still shows every line.
    expect(g.nodes[0]!.params.value).toBe('https://one\nhttps://two\nhttps://three');
  });

  it('leaves every other node alone', () => {
    const out = expandBatch(graphOf(input('a', 'one\ntwo', true), input('b', 'kept\nas is', false)));
    expect(valuesOf(out, 'b')).toEqual(['kept\nas is', 'kept\nas is']);
  });

  it('runs as many times as the longest, a shorter one holding its last line', () => {
    const g = graphOf(input('a', '1\n2\n3', true), input('b', 'x\ny', true));
    expect(batchPlan(g)).toEqual({ runs: 3, nodeIds: ['a', 'b'], counts: [3, 2] });
    const out = expandBatch(g);
    expect(valuesOf(out, 'a')).toEqual(['1', '2', '3']);
    expect(valuesOf(out, 'b')).toEqual(['x', 'y', 'y']);
  });

  it('is one plain run when the box holds a single line, however it is marked', () => {
    expect(expandBatch(graphOf(input('in', 'only one', true)))).toHaveLength(1);
    expect(expandBatch(graphOf(input('in', '  ', true)))).toHaveLength(1);
  });
});
