import { getEngineFactory } from '@/contracts/adapters/registry';
import type { StillResult } from '@/contracts/adapters/types';
import { declaredVariables } from '@/contracts/storyboard/blocks';
import { COMPOSITION_ENTRY, type Composition } from '@/contracts/types/composition';
import { stillPage, stillBox } from './component';

export interface StillRequest {
  /** The film's composition: its shell gives the theme tokens and the background, its files what the component may name. */
  files: Record<string, string>;
  media: Record<string, string>;
  /** The component's page. */
  html: string;
  /** The film's size; the still is drawn in a box of its shape. */
  width: number;
  height: number;
  /** When in the component's own length the still is taken. */
  at: number;
  /** How long the component plays. */
  seconds: number;
  values: Record<string, unknown>;
}

/**
 * One component drawn alone, as a picture kept with the uploads: the engine renders a page whose root is
 * the component, at a moment of its own timeline, with the values given.
 */
export async function renderComponentStill(request: StillRequest, signal: AbortSignal = new AbortController().signal): Promise<StillResult> {
  const factory = getEngineFactory('hyperframes');
  const engine = factory?.({});
  if (!engine?.still) throw Object.assign(new Error('the engine cannot draw a still here'), { code: 'ENGINE_NOT_READY' });
  const box = stillBox(request.width, request.height);
  const composition: Composition = {
    engine: 'hyperframes',
    width: box.width,
    height: box.height,
    fps: 30,
    files: { ...request.files, [COMPOSITION_ENTRY]: stillPage(request.files, request.html, box, request.seconds) },
    media: request.media as Composition['media'],
    variables: declaredVariables(request.html).map((v) => ({ id: v.id, type: v.type, label: v.label, default: v.default })) as Composition['variables'],
    values: request.values,
  };
  return engine.still(composition, request.at, signal);
}

export const forgeServices = { 'forge/still': renderComponentStill };
