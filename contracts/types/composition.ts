import { z } from 'zod';
import { AssetUrlSchema, MediaUrlSchema } from './payloads';

/**
 * A composition as it travels on a wire: an engine's own project, carried as data.
 *
 * Each engine keeps its own way of being authored and filled — for HyperFrames, HTML files whose
 * root declares `data-composition-variables`, rendered with values for those variables. NodeCine
 * does not translate a composition into anything; it carries the project, fills in what the steps
 * before it produced, and hands it to the engine it names.
 */

/** A path inside the project: relative, forward slashes, no `..`, no leading dot. */
export const ProjectPathSchema = z
  .string()
  .max(200)
  .regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/, 'must be a relative path inside the project');

/**
 * One declared variable, in the engine's own shape. Only what NodeCine reads is spelled out; the
 * rest of the declaration travels untouched for the engine.
 */
export const CompositionVariableSchema = z
  .object({
    id: z.string().min(1).max(80),
    type: z.string().min(1).max(40),
    label: z.string().max(200).optional(),
    default: z.unknown().optional(),
  })
  .passthrough();
export type CompositionVariable = z.infer<typeof CompositionVariableSchema>;

export const CompositionSchema = z.object({
  /** The engine this project is written for and rendered by. */
  engine: z.string().min(1).max(60),
  width: z.number().int().min(16).max(8192),
  height: z.number().int().min(16).max(8192),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).default(30),
  /** The project's text files by path: the entry, sub-compositions, any JSON the scripts read. */
  files: z.record(ProjectPathSchema, z.string().max(4_000_000)),
  /** The project's binary files by path, each a file this machine already holds. */
  media: z.record(ProjectPathSchema, z.union([MediaUrlSchema, AssetUrlSchema])).default({}),
  /** The variables the project declares. */
  variables: z.array(CompositionVariableSchema).max(200).default([]),
  /** Values for those variables; what is not given keeps its declared default. */
  values: z.record(z.string(), z.unknown()).default({}),
});
export type Composition = z.infer<typeof CompositionSchema>;

/** The file every project starts from. */
export const COMPOSITION_ENTRY = 'index.html';
