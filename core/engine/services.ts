/**
 * Everything a node needs from outside the graph. The executor runs on the server (ARCHITECTURE
 * §1.2); `server/services.server.ts` implements this with the providers and engines directly.
 * Tests implement it with fakes.
 *
 * The core declares only what running a node needs whatever the node is about: a way to call a
 * service a capsule contributed, and a clock. What a video workflow adds — a model, a voice, an
 * engine — is declared in `contracts/services.ts` by augmenting this interface.
 */
export type NodeService = (...args: never[]) => Promise<unknown>;

export interface NodeServices {
  /** Call a service contributed by a node capsule. Core knows only this extension port, never service names. */
  invoke<T>(serviceId: string, args: unknown[]): Promise<T>;
  now(): number;
}
