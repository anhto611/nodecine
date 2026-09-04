import { contentHash } from '../hash';

/** Node signature = hash(type, version, normalized params, input content hashes) (EXECUTION_ENGINE §3). */
export function computeSignature(args: {
  type: string;
  version: number;
  params: Record<string, unknown>;
  inputHashes: Record<string, string>;
}): string {
  return contentHash({ t: args.type, v: args.version, p: args.params, i: args.inputHashes });
}
