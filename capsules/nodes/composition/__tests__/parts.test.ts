import { describe, expect, it } from 'vitest';
import { kindOf, pathFor, roleOf, scaffoldPart, storyboardSnippet } from '../parts';

const frame = { width: 1080, height: 1920 };

/** Where a project keeps its parts, and what each is for. */
describe('the parts of a project', () => {
  it('tells blocks from components, and leaves the frames the Assemble node writes out', () => {
    expect(kindOf('compositions/feature-lift.html')).toBe('block');
    expect(kindOf('compositions/components/phone.html')).toBe('component');
    expect(kindOf('compositions/frames/01-open.html')).toBeNull();
    expect(pathFor('block', 'hook-question')).toBe('compositions/hook-question.html');
  });

  it('reads a role from the part, else a component assemble.json runs across the film is an overlay', () => {
    const files = {
      'assemble.json': JSON.stringify({ overlays: [{ component: 'captions' }] }),
      'compositions/hook-question.html': scaffoldPart('block', 'hook-question', frame, 'hook'),
      'compositions/plain.html': scaffoldPart('block', 'plain', frame),
      'compositions/components/captions.html': scaffoldPart('component', 'captions', frame),
      'compositions/components/arrow.html': scaffoldPart('component', 'arrow', frame, 'effect'),
      'compositions/components/stat.html': scaffoldPart('component', 'stat', frame),
    };
    expect(roleOf(files, 'compositions/hook-question.html')).toBe('hook');
    expect(roleOf(files, 'compositions/plain.html')).toBe('scene');
    expect(roleOf(files, 'compositions/components/captions.html')).toBe('overlay');
    expect(roleOf(files, 'compositions/components/arrow.html')).toBe('effect');
    expect(roleOf(files, 'compositions/components/stat.html')).toBe('piece');
  });

  it('writes the storyboard frame that plays a block, from its defaults, leaving its length to the Assemble node', () => {
    expect(storyboardSnippet('plain', scaffoldPart('block', 'plain', frame))).toBe('- block: plain\n\n```json\n{\n  "title": "plain"\n}\n```');
  });
});
