import { z } from 'zod';
import type { FieldWidget } from '@/capsules/sdk/form-body';

/**
 * What this provider takes, said once. VieNeu reads at its own pace: it takes no speed, so there is no rate
 * to set. `expressive` is how much the intonation varies (VieNeu's temperature).
 */
export const vieneuSettings = z.object({ expressive: z.number().min(0.1).max(1.5).default(0.8) });

/** What the schema alone cannot say about drawing a field. */
export const vieneuWidgets: Record<string, FieldWidget> = { expressive: { step: 0.05 } };
