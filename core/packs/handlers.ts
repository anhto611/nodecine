/**
 * Server-side handlers that packs register for their nodes (CORE_CONTRACTS §10).
 *
 * A pack node runs in the browser like every other node; when it needs the network or the
 * filesystem it calls `services.packRequest(pack, op, input)`, which the app forwards to
 * `POST /api/packs/<pack>/<op>`. The route looks the handler up here. The core only holds the
 * registry; packs register on server bootstrap and never import the route.
 */

export type PackHandler = (input: unknown, signal: AbortSignal) => Promise<unknown>;

const handlers = new Map<string, PackHandler>();

const key = (pack: string, op: string) => `${pack}/${op}`;

export function registerPackHandler(pack: string, op: string, handler: PackHandler): void {
  handlers.set(key(pack, op), handler);
}

export function getPackHandler(pack: string, op: string): PackHandler | undefined {
  return handlers.get(key(pack, op));
}

/** Test helper. */
export function _resetPackHandlers(): void {
  handlers.clear();
}
