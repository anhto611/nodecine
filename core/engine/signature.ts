import { contentHash } from '../hash';

/**
 * Node signature = hash(type, version, code fingerprint, normalized params, input content hashes).
 *
 * `version` is what a person bumps when a node's meaning changes. The fingerprint is what the host
 * measures: the code that runs the node. Without it an edit that forgot the bump went on being
 * answered from the cache — an emphasis fix shipped, and the film kept its asterisks.
 */
export function computeSignature(args: {
  type: string;
  version: number;
  fingerprint?: string;
  params: Record<string, unknown>;
  inputHashes: Record<string, string>;
}): string {
  return contentHash({ t: args.type, v: args.version, ...(args.fingerprint ? { c: args.fingerprint } : {}), p: args.params, i: args.inputHashes });
}
