import { z } from 'zod';
import { AssetUrlSchema } from './payloads';

/**
 * The pictures a video is made with, as the person bringing them names them: an app's screens, a
 * logo, a product photo. A composition's own files are its style; these are its content, and they
 * change from one video to the next.
 */

/** A name a storyboard can write: lowercase letters, digits and dashes. */
export const ASSET_NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;

/** Where an asset lands in a HyperFrames project, and so how a storyboard refers to it. */
export const ASSETS_DIR = 'assets/';

export const AssetSchema = z.object({
  name: z.string().regex(ASSET_NAME, 'lowercase letters, digits and dashes'),
  url: AssetUrlSchema,
  /** What the picture shows, for whoever writes the storyboard. */
  note: z.string().max(500).default(''),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** The page a picture was found on, when it was found rather than brought. */
  source: z.string().max(2000).optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const AssetsSchema = z.object({ items: z.array(AssetSchema).max(200) });
export type Assets = z.infer<typeof AssetsSchema>;

/** The project path of an asset: `assets/<name>.<the uploaded file's extension>`. */
export const assetProjectPath = (asset: Pick<Asset, 'name' | 'url'>): string => `${ASSETS_DIR}${asset.name}.${asset.url.split('.').pop()}`;

/** A name from any text (a file name, a note) that no other asset has: lowercase, dashed, numbered when taken. */
export function assetNameFor(text: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const whole = text.replace(/\.[a-z0-9]{2,5}$/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = (whole.length <= 36 ? whole : whole.slice(0, 37).replace(/-[^-]*$/, '')).replace(/-+$/, '') || 'image';
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
