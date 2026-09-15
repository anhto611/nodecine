import { describe, expect, it } from 'vitest';
import { assemble, FRAMES_MARKER, TIMELINE_FILE } from '../assemble';
import type { Composition } from '@/contracts/types/composition';
import type { Storyboard } from '@/contracts/types/storyboard';
import type { Voiceover } from '@/contracts/types/payloads';

const kit: Composition = {
  engine: 'hyperframes', width: 1080, height: 1920, fps: 30, media: {}, variables: [], values: {},
  files: {
    'index.html': `<html><body><div id="root" data-composition-id="shell">\n  ${FRAMES_MARKER}\n</div></body></html>`,
    'assemble.json': JSON.stringify({ slots: { top: [60, 200, 960, 400], full: [0, 0, 1080, 1920] }, overlays: [{ component: 'captions', box: [40, 1400, 1000, 160], span: 'spoken' }], transition: 0.4 }),
    'compositions/components/card.html': '<template><div data-composition-id="card"></div></template>',
    'compositions/components/chips.html': '<template><div data-composition-id="chips"></div></template>',
    'compositions/components/captions.html': '<template><div data-composition-id="captions"></div></template>',
  },
};

const storyboard: Storyboard = {
  markdown: '',
  frames: [
    { number: 1, title: 'Tin mới', voiceover: 'Kimi vừa ra mắt HighSpeed.', mounts: [{ component: 'card', box: 'top', values: { line1: 'Kimi' } }], values: {}, extra: {} },
    { number: 2, title: 'Ai dùng được', voiceover: 'Mở cho Beta, API và Business.', transitionIn: 'crossfade', mounts: [
      { component: 'chips', box: 'top', values: { cues: '@Beta,@API,@Business' }, at: '@Beta' },
    ], values: {}, extra: {} },
    { number: 3, title: 'Kết', durationSeconds: 3, mounts: [{ component: 'card', box: 'full', values: {} }], values: {}, extra: {} },
  ],
};

const voice: Voiceover = {
  audioUrl: '/api/media/0123456789abcdef.mp3', durationSeconds: 5, voiceName: 'Linh', language: 'vi', speed: 1,
  segments: [{ start: 0, durationSeconds: 2 }, { start: 2, durationSeconds: 3 }],
  words: [
    { text: 'Kimi', start: 0.1, end: 0.4 }, { text: 'vừa', start: 0.4, end: 0.6 }, { text: 'ra', start: 0.6, end: 0.8 }, { text: 'mắt', start: 0.8, end: 1 }, { text: 'HighSpeed.', start: 1, end: 1.6 },
    { text: 'Mở', start: 2.1, end: 2.3 }, { text: 'cho', start: 2.3, end: 2.5 }, { text: 'Beta,', start: 2.6, end: 3 }, { text: 'API', start: 3.2, end: 3.5 }, { text: 'và', start: 3.5, end: 3.7 }, { text: 'Business.', start: 3.9, end: 4.5 },
  ],
};

describe('assembling scenes', () => {
  it('plays each frame for as long as its own narration, and a silent one for its duration', () => {
    const { frames, problems, composition } = assemble(kit, storyboard, voice);
    expect(problems).toEqual([]);
    // Frame 2 fades in over frame 1's last 0.4s, so it starts early and runs that much longer.
    expect(frames.map((f) => [f.start, f.duration])).toEqual([[0, 2], [1.6, 3.4], [5, 3]]);
    expect(composition.values.videoSeconds).toBe(8);
    expect(Object.keys(composition.files).filter((f) => f.startsWith('compositions/frames/'))).toEqual([
      'compositions/frames/01-tin-moi.html', 'compositions/frames/02-ai-dung-duoc.html', 'compositions/frames/03-ket.html',
    ]);
  });

  it('puts each part on its word, and turns @word values into seconds from the part\'s start', () => {
    const frame2 = assemble(kit, storyboard, voice).composition.files['compositions/frames/02-ai-dung-duoc.html']!;
    // "Beta," is said 0.6s into the frame's narration, which starts 0.4s into the frame's clip.
    expect(frame2).toContain('data-start="1" data-duration="2.4"');
    expect(frame2).toContain('"cues":"0,0.6,1.3"');
    expect(frame2).toContain("tl.fromTo(root, { opacity: 0 }");
  });

  it('plays frames spoken back to back from one stretch of the voice, and lays the words on the film\'s clock', () => {
    const { composition } = assemble(kit, storyboard, voice);
    const index = composition.files['index.html']!;
    // Never cut between two spoken frames: a cut right before a frame's first word played it twice.
    expect(index.match(/<audio /g)).toHaveLength(1);
    expect(index).toContain('data-start="0" data-duration="5" data-media-start="0" data-track-index="20" data-var-src="voiceover"');
    expect(index).toContain('data-composition-src="compositions/components/captions.html"');
    const timeline = JSON.parse(composition.files[TIMELINE_FILE]!);
    expect(timeline.words.find((w: { text: string }) => w.text === 'API').start).toBe(3.2);
  });

  it('cuts the voice only where a silent frame sits between spoken ones', () => {
    const withPause: Storyboard = { ...storyboard, frames: [storyboard.frames[0]!, { number: 9, title: 'Nghỉ', durationSeconds: 1.5, mounts: [], values: {}, extra: {} }, storyboard.frames[1]!] };
    const index = assemble(kit, withPause, voice).composition.files['index.html']!;
    expect(index).toContain('data-start="0" data-duration="2" data-media-start="0"');
    expect(index).toContain('data-start="3.5" data-duration="3" data-media-start="2"');
  });

  it('says what does not fit, by frame', () => {
    const broken: Storyboard = { ...storyboard, frames: [{ ...storyboard.frames[0]!, mounts: [{ component: 'card', box: 'side', values: {}, at: '@Nokia' }] }, storyboard.frames[2]!] };
    const { problems } = assemble(kit, broken, { ...voice, segments: [voice.segments![0]!] });
    expect(problems).toContain('frame 1, card: no slot named "side" (the composition has top, full)');
    expect(problems).toContain('frame 1, card: "Nokia" is not said in this frame');
  });

  const block = `<!doctype html>
<html data-composition-id="hook-question" data-composition-variables='[
  { "id": "question", "type": "string", "label": "Question", "default": "?", "maxLength": 20 },
  { "id": "pop_at", "type": "number", "label": "When it pops (s)", "default": 0 },
  { "id": "side", "type": "enum", "label": "Side", "default": "left", "options": [{ "value": "left", "label": "Left" }, { "value": "right", "label": "Right" }] },
  { "id": "effects", "type": "string", "label": "Effects, as JSON", "default": "[]" },
  { "id": "cues", "type": "string", "label": "Cues, seconds separated by commas", "default": "" },
  { "id": "seconds", "type": "number", "label": "Length (s)", "default": 4 }
]'>
<body><template><div id="root" data-composition-id="hook-question" data-width="1080" data-height="1920"></div></template></body></html>`;
  const withBlock: Composition = { ...kit, files: { ...kit.files, 'compositions/hook-question.html': block } };

  it('plays the block a frame names for the whole frame, with the frame\'s values and its words as seconds', () => {
    const played: Storyboard = { ...storyboard, frames: [storyboard.frames[0]!, { ...storyboard.frames[1]!, mounts: [], block: 'hook-question', values: { question: 'Ai dùng được?', pop_at: '@API', side: 'right', effects: [{ type: 'pill', at: '@Business.' }], cues: '@Beta' } }] };
    const { composition, frames, problems } = assemble(withBlock, played, voice);
    expect(problems).toEqual([]);
    expect(frames[1]!.block).toBe('hook-question');
    const frame2 = composition.files['compositions/frames/02-ai-dung-duoc.html']!;
    expect(frame2).toContain('data-composition-id="hook-question" data-composition-src="compositions/hook-question.html"');
    // "API" is said 1.2s into the narration, which starts 0.4s into the frame's clip; the block runs the whole clip.
    expect(frame2).toContain(`data-variable-values='{"question":"Ai dùng được?","pop_at":1.6,"side":"right","effects":"[{\\"type\\":\\"pill\\",\\"at\\":2.3}]","cues":"1","seconds":3.4}'`);
    expect(frame2).toContain('data-start="0" data-duration="3.4" data-track-index="1"');
  });

  it('holds a block\'s values to what the block declares, the way HyperFrames does', () => {
    const played: Storyboard = { ...storyboard, frames: [{ ...storyboard.frames[0]!, mounts: [], block: 'hook-question', values: { side: 'up', colour: 'red', question: 'Một câu hỏi dài quá khung' } }, { ...storyboard.frames[2]!, mounts: [], block: 'outro' }] };
    const { problems } = assemble(withBlock, played, { ...voice, segments: [voice.segments![0]!] });
    expect(problems.some((p) => p.startsWith('frame 1, hook-question:') && p.includes('side'))).toBe(true);
    expect(problems.some((p) => p.startsWith('frame 1, hook-question:') && p.includes('colour'))).toBe(true);
    expect(problems).toContain('frame 1, hook-question: question is 25 characters, the block allows 20');
    expect(problems).toContain('frame 3, outro: the composition has no block outro');
  });

  it('puts the Assets node\'s pictures under assets/, and refuses a value naming one that is not there', () => {
    const pictures = { items: [{ name: 'calendar', url: '/api/assets/' + 'a'.repeat(40) + '.png', note: '' }] };
    const played = (screen: string): Storyboard => ({ ...storyboard, frames: [{ ...storyboard.frames[0]!, mounts: [], block: 'hook-question', values: { question: 'Lịch?', effects: [{ type: 'pill' }], side: 'left' } }, { ...storyboard.frames[2]!, mounts: [{ component: 'card', box: 'full', values: { image: screen } }] }] });
    const ok = assemble(withBlock, played('assets/calendar.png'), { ...voice, segments: [voice.segments![0]!] }, pictures);
    expect(ok.problems).toEqual([]);
    expect(ok.composition.media['assets/calendar.png']).toBe(pictures.items[0]!.url);
    const typo = assemble(withBlock, played('assets/calender.png'), { ...voice, segments: [voice.segments![0]!] }, pictures);
    expect(typo.problems).toEqual(['frame 3, card: no asset assets/calender.png (there are assets/calendar.png)']);
  });
});
