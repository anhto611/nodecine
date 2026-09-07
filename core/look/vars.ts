import type { StageDef } from '../types/payloads';

/**
 * What the stage draws the same way in every scene (CORE_CONTRACTS §2.6): the values it declares,
 * plus `date` and `time` of the run for a stage that did not declare them — so a daily bulletin
 * needs no edit before it is made. Shared by the assembler and by every preview, so what the modal
 * shows in that corner is what the render puts there.
 */
export function videoVars(stage: Pick<StageDef, 'vars'>, language: string, now: number): Record<string, string> {
  const d = new Date(now);
  const fmt = (o: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(language, o).format(d);
    } catch {
      // A language tag the platform does not know must not cost the video its date.
      return new Intl.DateTimeFormat('en-GB', o).format(d);
    }
  };
  return {
    date: fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: fmt({ hour: '2-digit', minute: '2-digit', hour12: false }),
    ...(stage.vars ?? {}),
  };
}
