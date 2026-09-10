import { describe, expect, it } from 'vitest';
import { describeFrame, frameOf } from '../frame';
import staticScript from '@/lib/first-run.json';
import type { Graph } from '@/core/engine/graph';

describe('frameOf', () => {
  it('reads the Illustrator frame, falls back to portrait, and ignores junk', () => {
    expect(frameOf(staticScript.graph as Graph)).toEqual({ width: 1080, height: 1920 });
    expect(frameOf({ nodes: [] })).toEqual({ width: 1080, height: 1920 });
    const g = { nodes: [{ id: 'a', type: 'core/illustrator', params: { frame: '16:9' }, bypassed: false, position: { x: 0, y: 0 } }] } as unknown as Graph;
    expect(frameOf(g)).toEqual({ width: 1920, height: 1080 });
    const bad = { nodes: [{ id: 'a', type: 'core/illustrator', params: { frame: 'nope' }, bypassed: false, position: { x: 0, y: 0 } }] } as unknown as Graph;
    expect(frameOf(bad)).toEqual({ width: 1080, height: 1920 });
  });
  it('names the orientation', () => {
    expect(describeFrame({ width: 1920, height: 1080 })).toBe('1920×1080 landscape');
    expect(describeFrame({ width: 1080, height: 1080 })).toBe('1080×1080 square');
  });
});

describe('render scale and output size', () => {
  it('scales by the short side: 1080p is the design size, 2160p doubles a 1080-wide frame', async () => {
    const { outputSizeFor, renderScaleFor } = await import('../frame');
    expect(renderScaleFor({ width: 1080, height: 1920 }, '1080p')).toBe(1);
    expect(renderScaleFor({ width: 1080, height: 1920 }, '2160p')).toBe(2);
    expect(outputSizeFor({ width: 1080, height: 1920 }, '1440p')).toEqual({ width: 1440, height: 2560 });
    expect(outputSizeFor({ width: 1920, height: 1080 }, '2160p')).toEqual({ width: 3840, height: 2160 });
    expect(outputSizeFor({ width: 1080, height: 1350 }, '1440p')).toEqual({ width: 1440, height: 1800 });
  });
});
