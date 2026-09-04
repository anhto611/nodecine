import { contentHash } from '../hash';
import type { PortType } from './ports';

/** Edge packet (CORE_CONTRACTS §1.2). Payloads must be JSON-serializable. */
export interface Packet<T = unknown> {
  sourceNodeId: string;
  sourcePort: string;
  targetPort: string;
  payloadType: PortType;
  timestamp: number;
  payload: T;
  contentHash: string;
}

export function makePacket<T>(args: {
  sourceNodeId: string;
  sourcePort: string;
  targetPort: string;
  payloadType: PortType;
  payload: T;
  now?: () => number;
}): Packet<T> {
  return {
    sourceNodeId: args.sourceNodeId,
    sourcePort: args.sourcePort,
    targetPort: args.targetPort,
    payloadType: args.payloadType,
    timestamp: (args.now ?? Date.now)(),
    payload: args.payload,
    contentHash: contentHash(args.payload),
  };
}
