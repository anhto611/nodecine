import { describe, expect, it } from 'vitest';
import { hoistNestedCompositions } from '../hoist.server';

const frame = `<html><body><template>
  <div id="root" data-composition-id="frame-01" data-duration="4">
    <style>[data-composition-id="frame-01"] { position: absolute; }</style>
    <div class="clip" data-composition-id="card" data-composition-src="compositions/components/card.html" data-variable-values='{"title":"Hi"}' data-start="0" data-duration="4" data-track-index="1"></div>
    <script>window.__timelines['frame-01'] = gsap.timeline({ paused: true });</script>
  </div>
</template></body></html>`;
const files: Record<string, string> = {
  'compositions/frames/01.html': frame,
  'compositions/components/card.html': '<template><div data-composition-id="card"></div></template>',
};
const entry = `<!doctype html><html><body><div id="root" data-composition-id="film">
  <div id="frame-01" class="clip" data-composition-id="frame-01" data-composition-src="compositions/frames/01.html" data-start="0" data-duration="4" data-track-index="1"></div>
  <div class="clip" data-composition-id="card" data-composition-src="compositions/components/card.html" data-start="4" data-duration="2" data-track-index="2"></div>
</div></body></html>`;

describe('flattening nested sub-compositions for the preview bundle', () => {
  it('writes a frame that mounts parts into its host, so its parts are hosts of the entry', () => {
    const { html, hoisted } = hoistNestedCompositions(entry, (src) => files[src]);
    expect(hoisted).toBe(1);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toContain('data-composition-src="compositions/frames/01.html"');
    expect(html).toContain('id="frame-01" class="clip" data-composition-id="frame-01"');
    // The frame's part is now in the entry, still carrying its values.
    expect(html).toContain('data-composition-src="compositions/components/card.html"');
    expect(html).toMatch(/data-variable-values=(?:'\{"title":"Hi"\}'|"\{&quot;title&quot;:&quot;Hi&quot;\}")/);
    expect(html).toContain("window.__timelines['frame-01']");
  });

  it('leaves a project without nesting as it was written', () => {
    const flat = entry.replace(/<div id="frame-01"[^>]*><\/div>/, '');
    expect(hoistNestedCompositions(flat, (src) => files[src])).toEqual({ html: flat, hoisted: 0 });
  });
});
