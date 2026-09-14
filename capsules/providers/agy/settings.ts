import { z } from 'zod';
import type { FieldWidget } from '@/capsules/sdk/form-body';

export const agySettings = z.object({
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
});

export const agyWidgets: Record<string, FieldWidget> = {
  model: { placeholder: 'default (e.g. gemini-3.8-flash-high)' },
};
