import { z } from 'zod';
import type { FieldWidget } from '@/nodes/form-body';

export const codexSettings = z.object({
  model: z.string().optional(),
});

export const codexWidgets: Record<string, FieldWidget> = {
  model: { placeholder: 'default (from config.toml)' },
};
