import type { ZodTypeAny } from 'zod';
import type { FormField } from '@/core/schema-form';
import type { FieldWidget } from '@/nodes/form-body';
import { PROVIDERS } from './.generated/descriptors';

/**
 * The providers this build ships, in a form both sides can read.
 *
 * The factories are server-only: they spawn processes and touch the filesystem. The Studio still has
 * to render the list and the fields of whichever provider is selected, so each capsule keeps its
 * `settings.ts` free of Node imports and the generated descriptors are built from those — the same
 * schema the server validates against, read into fields by `core/schema-form`. One node per port
 * type then covers every provider, the way ComfyUI's Load Checkpoint covers every checkpoint.
 */
export interface ProviderDescriptor {
  id: string;
  kind: 'tts' | 'llm';
  /** Dictionary key for the name shown in the picker; the capsule's own locales carry it. */
  nameKey: string;
  /** Dictionary key for the line under the picker: what this provider needs to work. */
  noteKey: string;
  settingsSchema: ZodTypeAny;
  defaultSettings: Record<string, unknown>;
  /** Read off `settingsSchema`, never written by hand. */
  fields: FormField[];
  /** What the schema alone cannot say about drawing a field: a step, a placeholder. */
  widgets: Record<string, FieldWidget>;
}

export { PROVIDERS };
export const providersOfKind = (kind: 'tts' | 'llm'): ProviderDescriptor[] => PROVIDERS.filter((p) => p.kind === kind);
export const findProvider = (id: string): ProviderDescriptor | undefined => PROVIDERS.find((p) => p.id === id);
/** What a freshly dropped node should select. */
export const defaultProviderId = (kind: 'tts' | 'llm'): string => providersOfKind(kind)[0]?.id ?? '';
