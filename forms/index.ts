import { registerForm } from '@/contracts/forms/registry';
import explainer from './explainer.json';
import kineticType from './kinetic-type.json';
import dataStory from './data-story.json';
import deviceDemo from './device-demo.json';
import musicCuts from './music-cuts.json';
import footageFrame from './footage-frame.json';

/**
 * The kinds of film this build ships (CORE_CONTRACTS §6). Each is a JSON file of instructions and
 * defaults — what to write, how to compose it, what moves — and nothing else in the repo learns its
 * name. Adding a kind of video is adding a file and a line.
 */
export const SHIPPED_FORMS: unknown[] = [explainer, kineticType, dataStory, deviceDemo, musicCuts, footageFrame];

export function registerForms(): void {
  for (const f of SHIPPED_FORMS) registerForm(f);
}
