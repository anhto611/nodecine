import { beforeEach, describe, expect, it } from 'vitest';
import { registerCoreNodes } from '@/core/nodes';
import { listNodeTypes, _resetNodeRegistry } from '@/core/nodes/definition';
import { registerCoreScenes } from '@/core/scenes/title-card';
import { _resetSceneRegistry, listScenes } from '@/core/scenes/registry';
import { installExtras } from '@/extras/installed';

/**
 * What a person who has just installed the app finds in the Library, before they do anything.
 * Everything the app ships is on by default; nothing has to be enabled, fetched or configured to
 * build any of the shipped templates from a blank canvas. This test pins that set, so shipping a
 * template that needs something not listed here fails loudly.
 */

beforeEach(() => {
  _resetNodeRegistry();
  _resetSceneRegistry();
  registerCoreScenes();
  registerCoreNodes();
  installExtras();
});

describe('a fresh install', () => {
  it('offers these node types in the Library, and no fewer', () => {
    expect(listNodeTypes().map((d) => d.type).sort()).toEqual([
      'core/ai-director',
      'core/hyperframes-engine',
      'core/input-trigger',
      'core/llm-provider',
      'core/mp4-export',
      'core/remotion-engine',
      'core/static-script',
      'core/timeline-assembler',
      'core/tts-engine',
      'core/tts-provider',
      'core/video-output',
      'github-showcase/github-fetcher',
    ]);
  });

  it('offers these scene types to the Static Script and AI Director pickers', () => {
    expect(listScenes().map((s) => s.sceneType).sort()).toEqual([
      'core/title-card',
      'github-showcase/cta',
      'github-showcase/hook',
      'github-showcase/mockup',
      'quote-cards/quote',
    ]);
  });
});
