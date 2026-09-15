/** Codes Research reports; the strings live in this capsule's locales. */
export const ResearchErrorCode = {
  SOURCE_UNREADABLE: 'SOURCE_UNREADABLE',
  NO_WEB_SEARCH: 'NO_WEB_SEARCH',
} as const;
export type ResearchErrorCode = (typeof ResearchErrorCode)[keyof typeof ResearchErrorCode];
