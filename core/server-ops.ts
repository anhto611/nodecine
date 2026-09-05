/**
 * Server-side operations a node may call (CORE_CONTRACTS §9). A node runs in the browser; when it
 * needs the network or the filesystem it calls `services.serverOp(op, input)`, the app forwards
 * that to `POST /api/ops/<op>`, and the route looks the op up here.
 *
 * One flat namespace keyed by name, like the node registry itself: an op belongs to whoever
 * registered it, and the core keeps only the empty table. Tests stub `serverOp` and never touch it.
 */

export type ServerOp = (input: unknown, signal: AbortSignal) => Promise<unknown>;

const ops = new Map<string, ServerOp>();

export function registerServerOp(op: string, handler: ServerOp): void {
  ops.set(op, handler);
}

export function getServerOp(op: string): ServerOp | undefined {
  return ops.get(op);
}

/** Test-only. */
export function _resetServerOps(): void {
  ops.clear();
}
