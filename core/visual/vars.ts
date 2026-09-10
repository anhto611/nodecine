/**
 * The values a video draws once for the whole run (CORE_CONTRACTS §2.6): the plan's own `vars`
 * — a channel, an episode, a character — plus the day and the time of the run, in the video's
 * language, unless the plan sets them itself. A scene draws one with `data-var="name"`.
 */
export function videoVars(vars: Record<string, string> | undefined, language: string, now: number): Record<string, string> {
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
    ...(vars ?? {}),
  };
}
