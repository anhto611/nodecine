import { describe, expect, it } from 'vitest';
import { loosenSoundSync, SOUND_DRIFT_SECONDS } from '../player.client';

/** A stand-in for the player's media steering: one sound from the film's start, and what it was asked. */
function media(currentTime: number) {
  const el = { currentTime, paused: false } as unknown as HTMLMediaElement;
  const entry = { el, start: 0, driftSamples: 0 };
  const gated: number[] = [];
  const m = {
    _entries: [entry],
    mirrorTime: (_time: number, _opts?: { force?: boolean }): void => {
      throw new Error('the strict steering should be replaced');
    },
    _refreshEntryBounds: () => {},
    _gateEntryPlayback: (_e: unknown, at: number) => {
      gated.push(at);
      return at >= 0;
    },
  };
  return { player: { _media: m }, m, el, gated };
}

describe('the preview sound kept on the film', () => {
  it('lets the sound drift what nobody hears instead of seeking it, and still starts and stops it at its clip', () => {
    const { player, m, el, gated } = media(10.12);
    expect(loosenSoundSync(player)).toBe(true);
    for (let i = 0; i < 10; i++) m.mirrorTime(10);
    expect(el.currentTime).toBe(10.12);
    expect(gated).toHaveLength(10);
  });

  it('seeks the sound back once it has wandered past the tolerance for a few samples running', () => {
    const { player, m, el } = media(10 + SOUND_DRIFT_SECONDS + 0.2);
    loosenSoundSync(player);
    m.mirrorTime(10);
    m.mirrorTime(10);
    expect(el.currentTime).toBeGreaterThan(10.4);
    m.mirrorTime(10);
    expect(el.currentTime).toBe(10);
  });

  it('leaves a player alone whose insides are not the ones it knows', () => {
    expect(loosenSoundSync({})).toBe(false);
    expect(loosenSoundSync({ _media: { mirrorTime: () => {} } })).toBe(false);
  });
});
