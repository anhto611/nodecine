/**
 * What a page URL must be before this machine will fetch it (CORE_CONTRACTS §9.2).
 *
 * A workflow is a file people share, and the fetch happens on the machine that opens it. So the
 * value is not passed through: it is parsed, vetted and rebuilt from its parts, and only a public
 * http(s) address survives. Loopback, private and link-local hosts are refused because they are
 * this machine's own network — the shortest path from a shared graph to somebody's router page or
 * a cloud metadata endpoint.
 */

export interface PageUrl {
  /** Rebuilt from the parsed parts; nothing of the input reaches the network verbatim. */
  url: string;
  host: string;
  /** The host without a leading `www.`, which is what a viewer reads as the source. */
  domain: string;
}

/** Host names that mean "this machine or its network", by name or by literal address. */
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;
const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h || PRIVATE_HOST.test(h)) return true;
  // IPv6 in a URL comes bracketed; ::1 and the unique-local/link-local blocks are all local.
  if (h.startsWith('[')) {
    const v6 = h.slice(1, -1);
    return v6 === '::1' || v6 === '::' || /^(fc|fd|fe8|fe9|fea|feb)/i.test(v6);
  }
  const m = V4.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, Number(m[2]), Number(m[3]), Number(m[4])].some((n) => !Number.isInteger(n) || n > 255)) return true;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local, and the cloud metadata address
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/** Every address in a block of text, one per line at most, in order and without repeats. */
export function parsePageUrls(value: string, max = 10): PageUrl[] {
  const out: PageUrl[] = [];
  const seen = new Set<string>();
  for (const line of value.split(/\r?\n/)) {
    // A line is often a note with the source at the end, so every token gets a try and the first wins.
    for (const token of line.split(/[\s,;]+/)) {
      const u = /^https?:\/\//i.test(token) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(token) ? parsePageUrl(token) : null;
      if (u && !seen.has(u.url)) { seen.add(u.url); out.push(u); break; }
    }
    if (out.length >= max) break;
  }
  return out;
}

/** The vetted address, or null when the value is not one this machine may fetch. */
export function parsePageUrl(value: string): PageUrl | null {
  const v = value.trim();
  if (!v || /\s/.test(v)) return null;
  let u: URL;
  try {
    // A bare domain is the form people paste most; anything with a scheme keeps it, so a
    // `file:` or `javascript:` value fails the protocol check below rather than being coerced.
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname;
  if (!host || !host.includes('.') || isPrivateHost(host)) return null;
  // Rebuilt, not echoed: path and query are re-encoded by URL, and the fragment is dropped.
  const url = `${u.protocol}//${u.host}${u.pathname}${u.search}`;
  return { url, host: u.host, domain: host.replace(/^www\./i, '') };
}
