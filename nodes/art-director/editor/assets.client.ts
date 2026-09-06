/** Uploads an image for a look and returns its `/api/assets/<hash>.<ext>` URL, or throws with the server's reason. */
export async function uploadImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
  const r = await fetch('/api/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
  const d = (await r.json()) as { url?: string; message?: string; error?: string };
  if (!r.ok || !d.url) throw new Error(d.message ?? d.error ?? String(r.status));
  return d.url;
}
