import { describe, expect, it } from 'vitest';
import { audioDir, audioPath } from '../paths';

describe('audioPath', () => {
  it('resolves a plain file name inside the folder it belongs to', () => {
    expect(audioPath('music', "Slow Piano (loop)_1.mp3")).toBe(`${audioDir('music')}/Slow Piano (loop)_1.mp3`);
    expect(audioPath('voice', 'take 3.wav')).toBe(`${audioDir('voice')}/take 3.wav`);
  });

  it('keeps the two folders apart', () => {
    expect(audioDir('music')).not.toBe(audioDir('voice'));
  });

  it('refuses anything that could leave the folder or is not audio', () => {
    for (const bad of ['../secrets.mp3', 'sub/bed.mp3', '/etc/passwd', '.hidden.mp3', 'bed.mp3\n', 'bed.exe', 'bed.mp3.sh', '']) {
      expect(() => audioPath('music', bad), bad).toThrow();
    }
  });
});
