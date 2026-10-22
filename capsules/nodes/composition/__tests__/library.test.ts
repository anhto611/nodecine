import { describe, expect, it } from 'vitest';
import { withLibrary } from '../node';

describe('a composition with a library wired in', () => {
  it('adds the shelf’s components the kit lacks and keeps the kit’s own file for a name it has', () => {
    const kit = { 'index.html': '<html></html>', 'compositions/components/rain.html': 'kit rain' };
    const files = withLibrary(kit, {
      scope: 'history-story',
      items: [
        { name: 'rain', shelf: 'shared', html: 'shelf rain', description: '' },
        { name: 'war-elephant', shelf: 'scope', html: 'elephant', description: '' },
      ],
    });
    expect(files['compositions/components/rain.html']).toBe('kit rain');
    expect(files['compositions/components/war-elephant.html']).toBe('elephant');
    expect(JSON.parse(files['library.json']!)).toEqual({ scope: 'history-story', components: ['war-elephant'] });
    expect(withLibrary(kit, undefined)).toBe(kit);
    expect(JSON.parse(withLibrary(kit, { scope: 'history-story', items: [] })['library.json']!)).toEqual({ scope: 'history-story', components: [] });
  });
});
