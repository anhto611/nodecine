import { z } from 'zod';
import type { FieldWidget } from '@/nodes/form-body';

/**
 * What this provider takes, said once. The bounds are the schema's, so the server refuses a rate it
 * would not accept and the form draws the same range without being told twice.
 */
export const piperSettings = z.object({ rate: z.number().min(0.5).max(2).default(1) });

/** What the schema alone cannot say about drawing a field. */
export const piperWidgets: Record<string, FieldWidget> = { rate: { step: 0.05 } };
