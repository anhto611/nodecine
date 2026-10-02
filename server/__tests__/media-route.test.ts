import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GET } from '@/app/api/media/[...path]/route';

describe('media route', () => {
  let tmp: string;
  const fileName = `${'a'.repeat(32)}.mp4`;
  const fileBytes = Buffer.from('0123456789abcdefghij');

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'nodecine-media-test-'));
    process.env.NODECINE_TMP_DIR = tmp;
    await writeFile(path.join(tmp, fileName), fileBytes);
  });

  afterAll(async () => {
    delete process.env.NODECINE_TMP_DIR;
    await rm(tmp, { recursive: true, force: true });
  });

  it('serves full file when no range is requested', async () => {
    const req = new Request('http://localhost/api/media/' + fileName);
    const res = await GET(req, { params: Promise.resolve({ path: [fileName] }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Length')).toBe(String(fileBytes.length));
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes).toEqual(fileBytes);
  });

  it('serves 206 Partial Content when range is requested', async () => {
    const req = new Request('http://localhost/api/media/' + fileName, {
      headers: { range: 'bytes=0-4' },
    });
    const res = await GET(req, { params: Promise.resolve({ path: [fileName] }) });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe(`bytes 0-4/${fileBytes.length}`);
    expect(res.headers.get('Content-Length')).toBe('5');
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes).toEqual(Buffer.from('01234'));
  });

  it('answers 416 for unsatisfiable range', async () => {
    const req = new Request('http://localhost/api/media/' + fileName, {
      headers: { range: 'bytes=100-200' },
    });
    const res = await GET(req, { params: Promise.resolve({ path: [fileName] }) });
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe(`bytes */${fileBytes.length}`);
  });

  it('answers 404 for invalid or missing files', async () => {
    const req = new Request('http://localhost/api/media/missing.mp4');
    const res = await GET(req, { params: Promise.resolve({ path: ['missing.mp4'] }) });
    expect(res.status).toBe(404);
  });
});
