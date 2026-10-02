import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createOllamaProvider, modelIsPulled, ollamaUrl } from '..';

const OLD = { ...process.env };
afterEach(() => {
  process.env = { ...OLD };
});

/** A fetch that answers only the routes it is given, and refuses the rest the way a dead port does. */
function fakeFetch(routes: Record<string, { status?: number; body: unknown }>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const hit = Object.entries(routes).find(([path]) => url.endsWith(path));
    if (!hit) throw new Error('connect ECONNREFUSED');
    const { status = 200, body } = hit[1];
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

const deps = (impl: typeof globalThis.fetch) => ({ fetch: impl, timeoutMs: 100 });

describe('ollamaUrl', () => {
  it('defaults to the loopback port ollama serves on', () => {
    delete process.env.NODECINE_OLLAMA_URL;
    expect(ollamaUrl()).toBe('http://127.0.0.1:11434');
  });

  it('takes the override, keeping only the origin', () => {
    process.env.NODECINE_OLLAMA_URL = 'http://ollama.box:11434/some/path?x=1';
    expect(ollamaUrl()).toBe('http://ollama.box:11434');
  });

  it('ignores an override that is not http', () => {
    process.env.NODECINE_OLLAMA_URL = 'file:///etc/passwd';
    expect(ollamaUrl()).toBe('http://127.0.0.1:11434');
    process.env.NODECINE_OLLAMA_URL = 'not a url';
    expect(ollamaUrl()).toBe('http://127.0.0.1:11434');
  });
});

describe('modelIsPulled', () => {
  it('matches the implicit latest tag', () => {
    expect(modelIsPulled('llama3.2', ['llama3.2:latest'])).toBe(true);
    expect(modelIsPulled('llama3.2', ['llama3.2:1b'])).toBe(true);
  });

  it('matches an explicit tag exactly', () => {
    expect(modelIsPulled('llama3.2:1b', ['llama3.2:1b'])).toBe(true);
    expect(modelIsPulled('llama3.2:1b', ['llama3.2:3b'])).toBe(false);
  });

  it('is false for anything that is not there', () => {
    expect(modelIsPulled('mistral', ['llama3.2:latest'])).toBe(false);
    expect(modelIsPulled('', ['llama3.2:latest'])).toBe(false);
    expect(modelIsPulled('llama3.2', [])).toBe(false);
  });
});

describe('probe with no server running', () => {
  it('reports every capability as not connected, with the fix, and never throws', async () => {
    const p = createOllamaProvider({}, deps(fakeFetch({})));
    const caps = await p.probe();
    for (const key of ['installed', 'authenticated', 'structuredOutput'] as const) {
      const c = caps[key];
      expect(c.status).toBe('unavailable');
      if (c.status === 'unavailable') {
        expect(c.code).toBe('PROVIDER_NOT_CONNECTED');
        expect(c.reason).toContain('11434');
        expect(c.fix).toContain('ollama serve');
      }
    }
  });

  it('treats a server that answers with an error status as unreachable', async () => {
    const p = createOllamaProvider({}, deps(fakeFetch({ '/api/tags': { status: 500, body: {} } })));
    expect((await p.probe()).installed.status).toBe('unavailable');
  });
});

describe('probe with a server running', () => {
  it('blocks on the model rather than the server when the model is not pulled', async () => {
    const p = createOllamaProvider(
      { model: 'mistral' },
      deps(
        fakeFetch({
          '/api/tags': { body: { models: [{ name: 'llama3.2:latest' }] } },
          '/api/version': { body: { version: '0.5.7' } },
        }),
      ),
    );
    const caps = await p.probe();
    expect(caps.authenticated.status).toBe('ready');
    expect(caps.structuredOutput.status).toBe('ready');
    expect(caps.version).toBe('0.5.7');
    expect(caps.installed.status).toBe('unavailable');
    if (caps.installed.status === 'unavailable') {
      expect(caps.installed.code).toBe('PROVIDER_NOT_INSTALLED');
      expect(caps.installed.fix).toBe('ollama pull mistral');
    }
  });

  it('is ready once the model is there', async () => {
    const p = createOllamaProvider(
      { model: 'llama3.2' },
      deps(
        fakeFetch({
          '/api/tags': { body: { models: [{ name: 'llama3.2:latest' }] } },
          '/api/version': { body: { version: '0.5.7' } },
        }),
      ),
    );
    const caps = await p.probe();
    expect(caps.installed.status).toBe('ready');
  });

  it('stays ready when the server is too old to report a version', async () => {
    const p = createOllamaProvider(
      { model: 'llama3.2' },
      deps(
        fakeFetch({
          '/api/tags': { body: { models: [{ name: 'llama3.2:latest' }] } },
        }),
      ),
    );
    const caps = await p.probe();
    expect(caps.installed.status).toBe('ready');
    expect(caps.version).toBeUndefined();
  });
});

describe('pictures', () => {
  const tags = { '/api/tags': { body: { models: [{ name: 'gemma3:latest' }] } } };

  it('reads pictures only with a model that lists vision among its capabilities', async () => {
    const seeing = createOllamaProvider({ model: 'gemma3' }, deps(fakeFetch({ ...tags, '/api/show': { body: { capabilities: ['completion', 'vision'] } } })));
    expect((await seeing.probe()).vision?.status).toBe('ready');
    const blind = createOllamaProvider({ model: 'gemma3' }, deps(fakeFetch({ ...tags, '/api/show': { body: { capabilities: ['completion'] } } })));
    const caps = await blind.probe();
    expect(caps.vision?.status).toBe('unavailable');
    if (caps.vision?.status === 'unavailable') expect(caps.vision.fix).toContain('vision model');
  });

  it('sends the pictures inline with the prompt', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const os = await import('node:os');
    const dir = await mkdtemp(`${os.tmpdir()}/nodecine-ollama-test-`);
    // A 1×1 PNG.
    const png = `${dir}/dot.png`;
    await writeFile(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    let sent: { images?: string[] } = {};
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ response: '{"headline":"SEEN"}' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    const p = createOllamaProvider({ model: 'gemma3' }, deps(fetchImpl));
    await expect(p.complete('what is this', z.object({ headline: z.string() }), new AbortController().signal, { images: [{ path: png, mediaType: 'image/png' }] })).resolves.toEqual({
      headline: 'SEEN',
    });
    expect(sent.images).toHaveLength(1);
    expect(sent.images![0]).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe('complete', () => {
  const Schema = z.object({ headline: z.string() });

  it('parses the model output against the caller schema', async () => {
    const p = createOllamaProvider(
      { model: 'llama3.2' },
      deps(
        fakeFetch({
          '/api/generate': { body: { response: '{"headline":"SHIP IT"}' } },
        }),
      ),
    );
    await expect(p.complete('write a headline', Schema, new AbortController().signal)).resolves.toEqual({ headline: 'SHIP IT' });
  });

  it('keeps the raw output when the shape is wrong, so the node can show it', async () => {
    const p = createOllamaProvider(
      { model: 'llama3.2' },
      deps(
        fakeFetch({
          '/api/generate': { body: { response: '{"nope":1}' } },
        }),
      ),
    );
    const err = await p.complete('x', Schema, new AbortController().signal).catch((e: unknown) => e);
    expect((err as { code: string }).code).toBe('LLM_SCHEMA_INVALID');
    expect((err as { raw: string }).raw).toBe('{"nope":1}');
  });

  it('reports an unreachable server as not connected, not as a model failure', async () => {
    const p = createOllamaProvider({ model: 'llama3.2' }, deps(fakeFetch({})));
    const err = await p.complete('x', Schema, new AbortController().signal).catch((e: unknown) => e);
    expect((err as { code: string }).code).toBe('PROVIDER_NOT_CONNECTED');
  });

  it('surfaces an error envelope from the server', async () => {
    const p = createOllamaProvider(
      { model: 'llama3.2' },
      deps(
        fakeFetch({
          '/api/generate': { body: { error: 'model requires more system memory' } },
        }),
      ),
    );
    const err = await p.complete('x', Schema, new AbortController().signal).catch((e: unknown) => e);
    expect((err as { code: string }).code).toBe('LLM_UPSTREAM');
    expect((err as Error).message).toContain('system memory');
  });
});

describe('the model name is the only thing that travels with the graph', () => {
  it('never calls a host the settings asked for', async () => {
    delete process.env.NODECINE_OLLAMA_URL;
    const seen: string[] = [];
    const spy = (async (input: string | URL | Request) => {
      seen.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      throw new Error('connect ECONNREFUSED');
    }) as typeof fetch;
    await createOllamaProvider({ model: 'llama3.2', baseUrl: 'http://169.254.169.254' }, deps(spy)).probe();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe('http://127.0.0.1:11434/api/tags');
  });
});
