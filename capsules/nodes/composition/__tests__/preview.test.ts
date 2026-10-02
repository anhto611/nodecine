import { describe, expect, it } from 'vitest';
import { partHost, PREVIEW_ROOT_ID } from '../preview.server';

const entry = `<!doctype html><html><head><style>#root { --brand: #3f8f1f; }</style><script src="gsap.min.js"></script></head>
<body><div id="root" data-composition-id="app" data-width="1080" data-height="1920">
<div class="clip" data-composition-id="cta-close" data-composition-src="compositions/components/cta-close.html" data-variable-values='{"button_label":"Download free"}' data-start="27" data-duration="3.5" data-track-index="3"></div>
</div></body></html>`;
const component = '<template><div id="root" data-composition-id="cta-close"></div></template>';
const block = '<html data-composition-duration="6"><template><div id="root" data-composition-id="logo-outro" data-width="1920" data-height="1080"></div></template></html>';

/** The page one part is played on by itself. */
describe('a part played on its own', () => {
  it('wears the project style and plays with the values and length the entry mounts it with', () => {
    const host = partHost({ 'index.html': entry, 'compositions/components/cta-close.html': component }, 'compositions/components/cta-close.html');
    expect(host).toMatchObject({ width: 1080, height: 1920, duration: 3.5 });
    expect(host.html).toContain('#root { --brand: #3f8f1f; }');
    expect(host.html).toContain(`id="root" data-composition-id="${PREVIEW_ROOT_ID}"`);
    expect(host.html).toContain('data-composition-src="compositions/components/cta-close.html"');
    expect(host.html).toContain('data-variable-values="{&quot;button_label&quot;:&quot;Download free&quot;}"');
    expect(host.html).toContain('data-start="0" data-duration="3.5"');
  });

  it('gives a block its own size and length when the entry does not mount it', () => {
    const host = partHost({ 'index.html': entry, 'compositions/logo-outro.html': block }, 'compositions/logo-outro.html');
    expect(host).toMatchObject({ width: 1920, height: 1080, duration: 6 });
    expect(host.html).not.toContain('data-variable-values');
  });

  it('refuses a file that is not a part', () => {
    expect(() => partHost({ 'index.html': entry, 'notes.html': '<p>hi</p>' }, 'notes.html')).toThrow(/data-composition-id/);
  });

  it("plays a part the entry does not mount with its variables' samples, and its own length", () => {
    const block = `<html data-composition-id="hook" data-composition-duration="3" data-composition-variables='[{"id":"name","type":"string","label":"Name","default":"","sample":"Pig Money"},{"id":"icon","type":"image","label":"Icon","default":""},{"id":"seconds","type":"number","label":"s","default":4}]'><body><template><div data-composition-id="hook" data-width="1080" data-height="1920"></div></template></body></html>`;
    const host = partHost({ 'index.html': '<html><head></head><body><div id="root" data-composition-id="film"></div></body></html>', 'compositions/hook.html': block }, 'compositions/hook.html');
    expect(host.duration).toBe(3);
    expect(host.html).toContain('data-variable-values="{&quot;name&quot;:&quot;Pig Money&quot;,&quot;seconds&quot;:3}"');
  });
});
