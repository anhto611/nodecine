import { z } from 'zod';
import { registerScene } from './registry';

/** The core's minimal scene type (CORE_CONTRACTS §4) — lets the framework run without any pack. */
export const TITLE_CARD = 'core/title-card' as const;

export const TitleCardPropsSchema = z.object({
  headline: z.string().min(1),
  subline: z.string().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type TitleCardProps = z.infer<typeof TitleCardPropsSchema>;

export function registerCoreScenes(): void {
  registerScene({ sceneType: TITLE_CARD, propsSchema: TitleCardPropsSchema });
}
