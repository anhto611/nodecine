import { beforeEach, describe, expect, it } from 'vitest';
import { registerNodes } from '@/nodes';
import { listNodeTypes, _resetNodeRegistry } from '@/core/nodes/definition';

/**
 * What a person who has just installed the app finds in the Library, before they do anything.
 * Everything the app ships is on by default; nothing has to be enabled, fetched or configured to
 * build any of the shipped templates from a blank canvas. This test pins that set, so shipping a
 * template that needs something not listed here fails loudly. The look is not in this list on
 * purpose: stage and blocks are data inside the templates, not registered code.
 */

beforeEach(() => {
  _resetNodeRegistry();
      registerNodes();
});

describe('a fresh install', () => {
  it('offers these node types in the Library, and no fewer', () => {
    expect(listNodeTypes().map((d) => d.type).sort()).toEqual([
      'core/art-director',
      'core/audio-input',
      'core/audio-mix',
      'core/caption-export',
      'core/captions',
      'core/github-fetcher',
      'core/hyperframes-engine',
      'core/input-trigger',
      'core/llm-provider',
      'core/mp4-export',
      'core/poster-export',
      'core/remotion-engine',
      'core/screenwriter',
      'core/static-script',
      'core/timeline-assembler',
      'core/transcribe',
      'core/tts-engine',
      'core/tts-provider',
      'core/video-output',
      'core/web-fetcher',
    ]);
  });
});
