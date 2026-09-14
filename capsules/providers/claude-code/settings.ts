import { z } from 'zod';
import type { FieldWidget } from '@/capsules/sdk/form-body';

/**
 * What this provider takes, said once. The bounds are the schema's, so the server refuses a rate it
 * would not accept and the form draws the same range without being told twice.
 */
export const claudeCodeSettings = z.object({ model: z.string().optional() });

/** What the schema alone cannot say about drawing a field. */
export const claudeCodeWidgets: Record<string, FieldWidget> = { model: { placeholder: 'default' } };
