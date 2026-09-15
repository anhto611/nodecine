import type { TTSRef } from '@/contracts/types/payloads';
import { createServerServices } from '@/server/contracts/services.server';

/**
 * The voices the chosen service offers, for the card's picker while a person edits the node. The same
 * probe a run makes, so the list is what the run will choose from.
 */
export async function voices(providerId: unknown, settings: unknown): Promise<TTSRef> {
  if (typeof providerId !== 'string' || !providerId) throw Object.assign(new Error('no voice service chosen'), { code: 'PROVIDER_NOT_CONNECTED' });
  const given = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings as Record<string, unknown> : {};
  return createServerServices().probeTTS(providerId, given);
}

export const ttsActions = { 'tts/voices': voices };
