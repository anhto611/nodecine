import { describe, expect, it } from 'vitest';
import { coverProps, type BlockDef, type CoverDef } from '@/core/types/payloads';
import { coverAsBlock, coverGround } from '@/core/look/cover';

const COVER: CoverDef = {
  id: 'portrait-cover',
  name: 'Cover',
  frame: { width: 1080, height: 1920 },
  props: {
    picture: { type: 'image', required: false },
    title: { type: 'text', required: true, max: 90 },
    subtitle: { type: 'string', required: false },
  },
  defaults: { picture: '/api/assets/0123456789abcdef0123456789abcdef01234567.png', title: 'As designed' },
  code: { format: 'html-gsap', source: '<div data-prop="title"></div>' },
};

/**
 * A cover is a finished picture the moment the look exists; the export step changes one of its
 * values for one file. When that was the other way round, an untouched cover rendered black.
 */
describe('a cover carries what it was designed with', () => {
  it('renders its own values when the export step says nothing', () => {
    expect(coverProps(COVER)).toEqual({ picture: COVER.defaults!.picture, title: 'As designed' });
  });

  it('lets the export step override one value and keep the rest', () => {
    expect(coverProps(COVER, { title: 'For this one file' })).toEqual({ picture: COVER.defaults!.picture, title: 'For this one file' });
  });

  it('reads an empty box as "leave it as designed", not as "clear it"', () => {
    expect(coverProps(COVER, { title: '', subtitle: undefined })).toEqual({ picture: COVER.defaults!.picture, title: 'As designed' });
  });

  it('previews through the same values, so the design is what comes out', () => {
    const example = JSON.parse(coverAsBlock(COVER).doc.example) as Record<string, unknown>;
    expect(example.title).toBe('As designed');
    expect(example.picture).toBe(COVER.defaults!.picture);
    // A prop nobody has filled still stands in for itself, or the preview would lose the line.
    expect(example.subtitle).toBe('subtitle');
  });
});

/**
 * A cover on a template is only worth having if it belongs to the video it came with: the footage is
 * different every run, so a ground pinned once gives every video the same cover, and picking one by
 * hand after each run is the manual step the node exists to remove.
 */
describe('the ground a cover falls back to', () => {
  const clip = '/api/assets/89abcdef0123456789abcdef0123456789abcdef.mp4';
  const shot = '/api/assets/1123456789abcdef0123456789abcdef01234567.png';
  const bare: CoverDef = { ...COVER, defaults: {} };
  const blocks: BlockDef[] = [
    { id: 'still', name: 'Still', doc: { example: '{}', when: '' }, props: { picture: { type: 'image' as const, content: 'image' as const, required: false } }, code: { format: 'html-gsap' as const, source: '' } },
    { id: 'still-clip', name: 'Clip', doc: { example: '{}', when: '' }, props: { footage: { type: 'video' as const, content: 'clip' as const, required: false } }, code: { format: 'html-gsap' as const, source: '' } },
  ];
  const scene = (blockId: string, props: Record<string, unknown>) => ({ blockId, weight: 1, props });

  it('takes a frame of the first clip when the film is footage', () => {
    expect(coverGround(bare, {}, [scene('still-clip', { footage: clip })], blocks)).toEqual({ prop: 'picture', clip });
  });

  it('takes the picture itself when the film is photographs', () => {
    expect(coverGround(bare, {}, [scene('still', { picture: shot })], blocks)).toEqual({ prop: 'picture', image: shot });
  });

  it('reads the asset off the block, whatever the prop is called', () => {
    const odd: BlockDef[] = [{ ...blocks[0]!, id: 'odd', props: { backdrop: { type: 'image', required: false } } }];
    expect(coverGround(bare, {}, [scene('odd', { backdrop: shot })], odd)).toEqual({ prop: 'picture', image: shot });
  });

  it('leaves a chosen ground alone: designing beats the film, and the film beats nothing', () => {
    expect(coverGround(COVER, coverProps(COVER), [scene('still-clip', { footage: clip })], blocks)).toBeNull();
    expect(coverGround(bare, {}, [scene('still-clip', {})], blocks)).toBeNull();
  });
});
