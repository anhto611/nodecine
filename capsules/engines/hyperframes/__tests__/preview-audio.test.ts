import { describe, expect, it } from 'vitest';
import { audioClips, mixArguments } from '../preview-audio.server';

const entry = `<!doctype html><html><body><div id="root" data-composition-id="film">
  <audio id="voice-1" data-start="0" data-duration="30" data-media-start="0" data-track-index="20" data-var-src="voiceover"></audio>
  <audio id="voice-2" data-start="33.5" data-duration="4" data-media-start="30" data-track-index="21" data-var-src="voiceover"></audio>
  <audio id="sting" data-start="2" src="sfx/pop.mp3"></audio>
  <audio id="remote" data-start="0" src="https://example.com/x.mp3"></audio>
</div></body></html>`;

/** The sound a preview plays from the Studio's page. */
describe('the preview sound', () => {
  it('reads the film\'s top-level clips, their sources through its values', () => {
    expect(audioClips(entry, { voiceover: 'voiceover.mp3' })).toEqual([
      { file: 'voiceover.mp3', start: 0, mediaStart: 0, duration: 30 },
      { file: 'voiceover.mp3', start: 33.5, mediaStart: 30, duration: 4 },
      { file: 'sfx/pop.mp3', start: 2, mediaStart: 0, duration: null },
    ]);
  });

  it('lays every clip at its moment on the film, from the part of its file it plays', () => {
    const args = mixArguments(audioClips(entry, { voiceover: 'voiceover.mp3' }), '/p', '/p/preview.m4a');
    expect(args.filter((a, i) => args[i - 1] === '-i')).toEqual(['/p/voiceover.mp3', '/p/sfx/pop.mp3']);
    const graph = args[args.indexOf('-filter_complex') + 1]!;
    expect(graph).toContain('[0:a]atrim=start=30:duration=4,asetpts=PTS-STARTPTS,adelay=33500|33500[c1]');
    expect(graph).toContain('[1:a]atrim=start=0,asetpts=PTS-STARTPTS,adelay=2000|2000[c2]');
    expect(graph).toContain('amix=inputs=3:normalize=0:duration=longest[out]');
  });
});
