import { describe, expect, it } from 'vitest';
import { addMedia, isPicture, kitColours, removeMedia, replaceMedia, setKitColour, usesMedia, type Project } from '../parts';

const project: Project = {
  files: {
    'index.html': '<html></html>',
    'teach.js': '.tc-teacher.point{background-image:url("art/teacher-point.png")}\n.tc-teacher.think{background-image:url("art/teacher-think.png")}',
  },
  media: {
    'fonts/lexend-700.woff2': '/api/assets/f0.woff2',
    'art/teacher-point.png': '/api/assets/aaa.png',
    'art/teacher-think.png': '/api/assets/bbb.png',
    'preview/left.svg': '/api/assets/ccc.svg',
  },
};

describe('the pictures a kit draws with', () => {
  it('tells a picture from a font', () => {
    expect(isPicture('art/teacher-point.png')).toBe(true);
    expect(isPicture('preview/left.svg')).toBe(true);
    expect(isPicture('fonts/lexend-700.woff2')).toBe(false);
  });

  it('knows which ones the kit still draws', () => {
    expect(usesMedia(project, 'art/teacher-point.png')).toBe(true);
    expect(usesMedia(project, 'preview/left.svg')).toBe(false);
  });

  it('swaps one for another of the same type, in its place', () => {
    const after = replaceMedia(project, 'art/teacher-point.png', '/api/assets/new.png');
    expect(after.media['art/teacher-point.png']).toBe('/api/assets/new.png');
    expect(Object.keys(after.media)).toEqual(Object.keys(project.media));
    expect(after.files).toEqual(project.files);
  });

  it('follows the new type into the path, so the parts draw the file that is there', () => {
    const after = replaceMedia(project, 'art/teacher-point.png', '/api/assets/new.svg');
    expect(after.media['art/teacher-point.svg']).toBe('/api/assets/new.svg');
    expect(after.media['art/teacher-point.png']).toBeUndefined();
    expect(after.files['teach.js']).toContain('url("art/teacher-point.svg")');
    expect(after.files['teach.js']).toContain('url("art/teacher-think.png")');
  });

  it('adds one under art/, named after the file, never over another', () => {
    const one = addMedia(project, 'Thầy Giáo.PNG', '/api/assets/d1.png');
    expect(one.path).toBe('art/thay-giao.png');
    const two = addMedia(one.project, 'thay giao.png', '/api/assets/d2.png');
    expect(two.path).toBe('art/thay-giao-2.png');
    expect(two.project.media['art/thay-giao.png']).toBe('/api/assets/d1.png');
  });

  it('takes one out', () => {
    const after = removeMedia(project, 'preview/left.svg');
    expect(after.media['preview/left.svg']).toBeUndefined();
    expect(Object.keys(after.media)).toHaveLength(3);
  });
});

describe('the kit\'s own colours', () => {
  const shell = `<!doctype html>
<html data-composition-variables='[{"id":"videoSeconds","type":"number","default":45},{"id":"mark","type":"color","label":"Marker colour","default":"#d6263b"}]'>
<style>#root { --mark: #d6263b; --ink: #1f2430; --red: #d6263b; --bg: var(--paper); }</style>
<div class="pill" style="background: #d6263b"></div>
</html>`;

  it('reads the palette its parts paint with, in the order the shell writes it', () => {
    expect(kitColours(shell)).toEqual([
      { name: 'mark', value: '#d6263b' },
      { name: 'ink', value: '#1f2430' },
      { name: 'red', value: '#d6263b' },
    ]);
  });

  it('changes one colour wherever the shell sets it, and nothing else', () => {
    const after = setKitColour(shell, 'mark', '#0f8a63');
    expect(after).toContain('--mark: #0f8a63');
    // A palette colour that happens to hold the same hex is its own decision, and so is a one-off style.
    expect(after).toContain('--red: #d6263b');
    expect(after).toContain('style="background: #d6263b"');
  });

  it('moves the declared default with it, so a film that may override starts from the kit', () => {
    expect(setKitColour(shell, 'mark', '#0f8a63')).toContain('"default":"#0f8a63"');
    // A colour the shell only paints with, declared nowhere, leaves the variables alone.
    expect(setKitColour(shell, 'ink', '#000000')).toContain('"id":"mark","type":"color","label":"Marker colour","default":"#d6263b"');
  });

  it('leaves a shell it cannot read exactly as it was', () => {
    expect(setKitColour('<html></html>', 'mark', '#000000')).toBe('<html></html>');
    expect(kitColours('<html></html>')).toEqual([]);
  });
});
