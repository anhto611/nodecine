import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readLibrary, writeLibraryItem } from '../store.server';

const part = (name: string, label: string) => `<!doctype html><html data-role="piece"><body><template><div id="root" data-composition-id="${name}">${label}</div></template></body></html>`;

describe('the library shelves', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'nodecine-library-'));
    process.env.NODECINE_LIBRARY_DIR = dir;
  });
  afterEach(async () => {
    delete process.env.NODECINE_LIBRARY_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('keeps what a video put on a shelf for the next one, with what it is for', async () => {
    expect((await readLibrary('history-story')).items).toEqual([]);
    await writeLibraryItem('history-story', 'war-elephant', part('war-elephant', 'elephant'), { description: 'A war elephant, count and facing as values', from: 'test' });
    const shelf = await readLibrary('history-story');
    expect(shelf.items).toEqual([expect.objectContaining({ name: 'war-elephant', shelf: 'scope', description: 'A war elephant, count and facing as values' })]);
    expect(JSON.parse(await readFile(path.join(dir, 'history-story', 'war-elephant.json'), 'utf8'))).toEqual(expect.objectContaining({ from: 'test' }));
  });

  it('reads the template shelf before the shared one, and its own file hides a shared one of the same name', async () => {
    await writeLibraryItem('shared', 'rain', part('rain', 'shared rain'), { description: 'Rain' });
    await writeLibraryItem('shared', 'fire', part('fire', 'shared fire'), { description: 'Fire' });
    await writeLibraryItem('history-story', 'rain', part('rain', 'sepia rain'), { description: 'Rain in sepia' });
    const shelf = await readLibrary('history-story');
    expect(shelf.items.map((i) => [i.name, i.shelf])).toEqual([
      ['rain', 'scope'],
      ['fire', 'shared'],
    ]);
    expect(shelf.items[0]!.html).toContain('sepia rain');
    expect((await readLibrary('history-story', false)).items.map((i) => i.name)).toEqual(['rain']);
  });

  it('refuses a shelf or a name that could reach outside the library', async () => {
    await expect(readLibrary('../etc')).rejects.toThrow(/not a shelf name/);
    await expect(writeLibraryItem('history-story', '../x', '', { description: '' })).rejects.toThrow(/not a component name/);
  });
});


describe('a video and the shelf it was made with', () => {
  it('keeps the components it took at its first run, and takes the whole shelf until then', async () => {
    const { pinnedShelf } = await import('../node');
    const shelf = { scope: 'history-story', items: ['war-elephant', 'ship-portage'].map((name) => ({ name, shelf: 'scope' as const, html: name, description: '' })) };
    expect(pinnedShelf(shelf, null).items.map((i) => i.name)).toEqual(['war-elephant', 'ship-portage']);
    expect(pinnedShelf(shelf, ['war-elephant']).items.map((i) => i.name)).toEqual(['war-elephant']);
    expect(pinnedShelf(shelf, []).items).toEqual([]);
  });
});
