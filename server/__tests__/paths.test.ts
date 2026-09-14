import { beforeAll, describe, expect, it } from 'vitest';
import { libraryDir, libraryPath, registerLibrary } from '../paths';

// The folders come from the capsules that read them; the server registers them at startup, a test here.
const AUDIO = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac'];
beforeAll(() => {
  registerLibrary('music', { env: 'NODECINE_MUSIC_DIR', extensions: AUDIO });
  registerLibrary('voice', { env: 'NODECINE_VOICE_DIR', extensions: AUDIO });
  registerLibrary('clips', { env: 'NODECINE_CLIPS_DIR', extensions: ['mp4', 'webm', 'mov', 'm4v'] });
});

describe('libraryPath', () => {
  it('resolves a plain file name inside the folder it belongs to', () => {
    expect(libraryPath('music', "Slow Piano (loop)_1.mp3")).toBe(`${libraryDir('music')}/Slow Piano (loop)_1.mp3`);
    expect(libraryPath('voice', 'take 3.wav')).toBe(`${libraryDir('voice')}/take 3.wav`);
    expect(libraryPath('clips', 'b-roll 01.mp4')).toBe(`${libraryDir('clips')}/b-roll 01.mp4`);
  });

  it('keeps the folders apart, and each to its own kinds of file', () => {
    expect(libraryDir('music')).not.toBe(libraryDir('clips'));
    expect(() => libraryPath('music', 'clip.mp4')).toThrow(/Invalid music/);
    expect(() => libraryPath('photos', 'a.jpg')).toThrow(/Unknown library/);
    expect(() => libraryPath('clips', 'bed.mp3')).toThrow(/Invalid clips/);
  });

  it('refuses anything that could leave the folder or is not that kind of file', () => {
    for (const bad of ['../secrets.mp3', 'sub/bed.mp3', '/etc/passwd', '.hidden.mp3', 'bed.mp3\n', 'bed.exe', 'bed.mp3.sh', '', 'no-extension']) {
      expect(() => libraryPath('music', bad), bad).toThrow();
    }
  });
});
