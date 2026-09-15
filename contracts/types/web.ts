/** The web as nodes read it: a page as text with the pictures it shows. Read on the server (`server/contracts/web.ts`). */

/** A picture a page shows: where it is, what the page says it is, and the page. */
export interface FoundPicture { url: string; alt: string; page: string }

/** A page read as text, with the pictures it shows. */
export interface LinkedPage { url: string; title: string; text: string; pictures: FoundPicture[] }

/** A picture from the web, brought onto this machine as an asset. */
export interface FetchedPicture { url: string; width?: number; height?: number }
