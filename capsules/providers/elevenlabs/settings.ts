import { z } from 'zod';
import type { FieldWidget } from '@/capsules/sdk/form-body';

/**
 * What this provider takes, said once. The bounds are the schema's, so the server refuses a rate it
 * would not accept and the form draws the same range without being told twice.
 */
export const ELEVENLABS_MODELS = ['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5'] as const;

export const elevenlabsSettings = z.object({ model: z.enum(ELEVENLABS_MODELS).default(ELEVENLABS_MODELS[0]), rate: z.number().min(0.7).max(1.2).default(1) });

/** What the schema alone cannot say about drawing a field. */
export const elevenlabsWidgets: Record<string, FieldWidget> = { rate: { step: 0.05 } };
