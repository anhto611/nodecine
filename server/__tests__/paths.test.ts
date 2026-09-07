import { describe, expect, it } from 'vitest';
import { musicDir, musicPath } from '../paths';

describe('musicPath', () => {
  it('resolves a plain track name inside the music folder', () => {
    expect(musicPath("Slow Piano (loop)_1.mp3")).toBe(`${musicDir()}/Slow Piano (loop)_1.mp3`);
  });

  it('refuses anything that could leave the folder or is not a track', () => {
    for (const bad of ['../secrets.mp3', 'sub/bed.mp3', '/etc/passwd', '.hidden.mp3', 'bed.mp3\n', 'bed.exe', 'bed.mp3.sh', '']) {
      expect(() => musicPath(bad), bad).toThrow();
    }
  });
});
