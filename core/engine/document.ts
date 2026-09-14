import { z } from 'zod';

/**
 * A saved graph as a file: the shape of a workflow on disk, in an MP4's tag, and in a job request.
 * It names node types by string and owns nothing, so a file saved here, one pasted in from someone
 * else and one read out of a video are the same thing.
 */

/** A string, or one per locale. What a person typed has the first; a file written for several languages the second. */
export const LocalizedTextSchema = z.union([z.string(), z.record(z.string(), z.string())]);
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

const NodeInstanceSchema = z.object({
  id: z.string().min(1),
  /** A shipped type is a bare name (`tts`); an older build's, and a test's, carry a prefix (`core/tts-engine`). */
  type: z.string().regex(/^[a-z0-9][a-z0-9-]*(\/[a-z0-9-]+)?$/),
  params: z.record(z.string(), z.unknown()),
  bypassed: z.boolean(),
  position: z.object({ x: z.number(), y: z.number() }),
  /** Which version of the node type wrote `params`; absent on anything saved before the stamp. */
  version: z.number().int().positive().optional(),
  /** Frozen outputs: the node hands these back instead of running. */
  pinned: z.object({ outputs: z.record(z.string(), z.unknown()), at: z.string().min(1) }).optional(),
});
const EdgeSchema = z.object({ id: z.string().min(1), source: z.string(), sourcePort: z.string(), target: z.string(), targetPort: z.string() });
export const GraphSchema = z.object({ nodes: z.array(NodeInstanceSchema), edges: z.array(EdgeSchema) });

export const WorkflowDocumentSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema.optional(),
  /** Grouping in the workflow list. */
  category: z.string().min(1),
  graph: GraphSchema,
});
export type WorkflowDocument = z.infer<typeof WorkflowDocumentSchema>;

export function localized(text: LocalizedText | undefined, locale: string, fallback = ''): string {
  if (text === undefined) return fallback;
  if (typeof text === 'string') return text;
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? fallback;
}
