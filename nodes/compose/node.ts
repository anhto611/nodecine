import { z } from 'zod';
import { SCENE_FORMAT, type PlateSheet, type ScenePlan, type SceneScript, type StyleSheet } from '@/contracts/types/payloads';
import { ErrorCode, NodeError } from '@/contracts/errors';
import type { NodeDefinition } from '@/core/nodes/definition';
import { fillPlate, plateFor, posed, shapeKey, signatureOf } from '@/contracts/visual/plates';
import { getForm } from '@/contracts/forms/registry';
import { REQUIRED_TRANSITIONS } from '@/contracts/types/ir';
import { listTransitions } from '@/contracts/visual/transitions';

export const COMPOSE = 'core/compose';

const Params = z.object({
  /** How every scene gives way to the next: a name in the transition registry (§2.6). */
  transition: z.string().max(60).default('fade'),
  transitionSeconds: z.number().min(0.1).max(2).default(0.4),
});

/**
 * Scene building: the script's words poured into the plates, and no model anywhere.
 *
 * This is the node the plates exist for. It takes a shape of content to the plate that draws it and
 * fills the holes — so a film costs nothing to draw, and the same script gives the same frames every
 * time, which is the thing the Illustrator could never promise.
 *
 * A shape nobody drew is an error naming it, not a silent blank: the remedy is one more run of the
 * plate maker, or that scene drawn by the Illustrator.
 */
export const compose: NodeDefinition<typeof Params> = {
  type: COMPOSE,
  version: 2,
  kind: 'process',
  inputs: [
    { name: 'scenes', type: 'SceneScript' },
    { name: 'style', type: 'StyleSheet' },
    { name: 'plates', type: 'PlateSheet' },
  ],
  outputs: [{ name: 'plan', type: 'ScenePlan' }],
  paramsSchema: Params,
  defaultParams: { transition: 'fade', transitionSeconds: 0.4 },
  run: async ({ params, inputs, log }) => {
    const script = inputs.scenes!.payload as SceneScript;
    const sheet = inputs.style!.payload as StyleSheet;
    const plates = inputs.plates!.payload as PlateSheet;

    const named = [params.transition, ...script.scenes.flatMap((s) => (s.transitionAfter ? [s.transitionAfter.type] : []))];
    for (const name of new Set(named)) {
      if (!(REQUIRED_TRANSITIONS as readonly string[]).includes(name) && !listTransitions().includes(name)) {
        log('warn', `no engine registers a transition named "${name}"; the output node will block on it`);
      }
    }

    // The same cycle the plate maker used, so a scene lands in the layout drawn for it.
    const form = getForm(script.form);
    const poses = form?.poses ?? [];
    const missing = new Set<string>();
    const scenes = posed(script.scenes, poses.map((p) => p.id)).map((scene) => {
      const pose = poses.find((p) => p.id === scene.pose);
      const plate = plateFor(plates, scene.content, pose?.text);
      if (!plate) {
        missing.add(shapeKey(signatureOf(scene.content), pose?.text));
        return null;
      }
      // Where the film's own things stand while this scene is up, taken from the pose. A scene that
      // says it itself wins; this is the only thing that moves them, and it asks no model.
      const stage = { ...(pose?.stage ?? {}), ...(scene.stage ?? {}) };
      return {
        source: fillPlate(plate, scene.content),
        weight: scene.weight,
        format: SCENE_FORMAT,
        ...(scene.factBindings ? { factBindings: scene.factBindings } : {}),
        ...(Object.keys(stage).length ? { stage } : {}),
        ...(scene.transitionAfter ? { transitionAfter: scene.transitionAfter } : {}),
      };
    });
    if (missing.size) {
      throw new NodeError(ErrorCode.NODE_OUTPUT_INVALID, `no plate draws ${[...missing].join(', ')}`, true)
        .withFix('run the plate maker again so it draws the shapes this script added');
    }

    log('info', `${scenes.length} scene${scenes.length === 1 ? '' : 's'} filled from ${plates.plates.length} layout${plates.plates.length === 1 ? '' : 's'}${poses.length ? ` across ${poses.length} poses` : ''}; no model asked`);
    const plan: ScenePlan = {
      language: script.language,
      style: sheet.style,
      frame: sheet.frame,
      vars: sheet.character ? { character: sheet.character } : {},
      transition: { type: params.transition, seconds: params.transitionSeconds },
      scenes: scenes as NonNullable<(typeof scenes)[number]>[],
    };
    return { plan };
  },
};

export const DEFAULT_COMPOSE = compose.defaultParams;
