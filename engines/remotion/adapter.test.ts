import { describe, it, expect } from 'vitest';
import { _resetSceneRegistry, hasRenderer } from '@/core/scenes/registry';
import { TITLE_CARD } from '@/core/scenes/title-card';
import { registerRemotionRenderers } from './renderers';

describe('remotion renderers', () => {
  it('registers a Remotion renderer for core/title-card', () => {
    _resetSceneRegistry();
    registerRemotionRenderers();
    expect(hasRenderer(TITLE_CARD, 'remotion')).toBe(true);
    expect(hasRenderer(TITLE_CARD, 'hyperframes')).toBe(false);
  });
});
