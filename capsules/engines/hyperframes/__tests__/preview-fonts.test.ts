import { describe, expect, it } from 'vitest';
import { stylesheetLinks } from '../preview-fonts.server';

const FONTS = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;700&display=swap';

describe('the web fonts a preview page carries', () => {
  it('collects each remote stylesheet the scenes link, once, from inside their templates', () => {
    const scene = `<!doctype html><html><body><template><link rel="stylesheet" href="${FONTS}" /><style>p{}</style><div id="root"></div></template></body></html>`;
    const links = stylesheetLinks({ 'index.html': '<!doctype html><html></html>', 'compositions/a.html': scene, 'compositions/b.html': scene });
    expect(links).toBe(`<link rel="stylesheet" href="${FONTS}" />`);
  });

  it('leaves out local sheets, other links and files that are not pages', () => {
    const page = '<link rel="stylesheet" href="local.css"><link rel="icon" href="https://example.com/i.png"><link rel="preconnect" href="https://fonts.gstatic.com">';
    expect(stylesheetLinks({ 'index.html': page, 'notes.md': `<link rel="stylesheet" href="${FONTS}">` })).toBe('');
  });
});
