import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/capsules/nodes';
import { listNodeTypes, _resetNodeRegistry } from '@/core/nodes/definition';

/**
 * What a person who has just installed the app finds in the Library, before they do anything.
 * Everything the app ships is on by default; nothing has to be enabled, fetched or configured to
 * build any of the shipped templates from a blank canvas. This test pins that set, so shipping a
 * template that needs something not listed here fails loudly. Since 2026-09-14 it is only the
 * plumbing every film needs — a voice, word timings, a player, the exports — while the nodes of the
 * first genre are written.
 */

beforeEach(() => {
  _resetNodeRegistry();
  registerNodes();
});

describe('a fresh install', () => {
  it('offers these node types in the Library, and no fewer', () => {
    expect(
      listNodeTypes()
        .map((d) => d.type)
        .sort(),
    ).toEqual([
      'assemble',
      'assets',
      'brief',
      'caption-export',
      'composition',
      'coverage',
      'fill',
      'footage',
      'matte',
      'mp4-export',
      'research',
      'rough-cut',
      'storyboard-writer',
      'transcribe',
      'tts',
      'video-output',
    ]);
  });
});
