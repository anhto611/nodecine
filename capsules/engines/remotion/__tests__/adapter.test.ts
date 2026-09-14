import { describe, expect, it } from 'vitest';
import { createRemotionAdapter } from '../adapter';

describe('Remotion adapter', () => {
  it('reports preview in the browser half and render only where a renderer is injected', async () => {
    const browser = await createRemotionAdapter({}, { mountPlayer: () => ({ unmount() {}, seekTo() {}, play() {}, pause() {}, onFrame: () => () => {} }) }).probe();
    expect(browser.preview.status).toBe('ready');
    expect(browser.render.status).toBe('unavailable');
    const server = await createRemotionAdapter({}, { render: async () => ({ outputUrl: '/api/media/0123456789abcdef.mp4', bytes: 1 }) }).probe();
    expect(server.render.status).toBe('ready');
  });

  it('refuses to mount or render where the half is missing, with a code the node can show', async () => {
    const a = createRemotionAdapter({}, {});
    expect(() => a.mountPlayer({} as HTMLElement, {} as never)).toThrow();
    await expect(a.render({} as never, {} as never, () => {}, new AbortController().signal)).rejects.toMatchObject({ code: 'ENGINE_NOT_READY' });
  });
});
