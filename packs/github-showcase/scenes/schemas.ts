/**
 * The pack's three scene types (github-showcase spec §4): props schemas only.
 * Renderers are registered per engine elsewhere (Remotion in ./remotion); the core registry
 * needs the schema first so the Director's plan validates before any renderer exists.
 */
import { z } from 'zod';
import { registerScene } from '@/core/scenes/registry';
import { PACK_ID } from '../constants';

export const HOOK = `${PACK_ID}/hook` as const;
export const MOCKUP = `${PACK_ID}/mockup` as const;
export const CTA = `${PACK_ID}/cta` as const;
export const THEME = `${PACK_ID}/developer-dark` as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'accentColor must be a 6-digit hex colour');

/** Fields the model writes. Facts are added by the assembler through factBindings, never by the model. */
export const HookModelSchema = z.object({
  headline: z.string().min(1).max(60),
  subline: z.string().min(1).max(120),
  badgeText: z.string().min(1).max(30),
  accentColor: hex,
});
export const MockupModelSchema = z.object({
  headline: z.string().min(1).max(60),
  featureHighlights: z.array(z.string().min(1).max(60)).length(3),
  accentColor: hex,
});
export const CtaModelSchema = z.object({
  headline: z.string().min(1).max(60),
  callToActionText: z.string().min(1).max(80),
  accentColor: hex,
});

/** Full props as the renderer sees them: model fields + bound facts (nullable / empty when passthrough). */
export const HookPropsSchema = HookModelSchema.extend({ stars: z.number().int().nullable().optional() });
export const MockupPropsSchema = MockupModelSchema.extend({ installCommand: z.string().optional(), repoName: z.string().optional() });
export const CtaPropsSchema = CtaModelSchema.extend({ brandName: z.string().optional() });

export type HookProps = z.infer<typeof HookPropsSchema>;
export type MockupProps = z.infer<typeof MockupPropsSchema>;
export type CtaProps = z.infer<typeof CtaPropsSchema>;

export function registerGithubShowcaseScenes(): void {
  registerScene({ sceneType: HOOK, propsSchema: HookPropsSchema });
  registerScene({ sceneType: MOCKUP, propsSchema: MockupPropsSchema });
  registerScene({ sceneType: CTA, propsSchema: CtaPropsSchema });
}
