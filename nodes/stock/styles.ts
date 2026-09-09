/**
 * The kinds of picture a video can be built out of (CORE_CONTRACTS §5.19): a **region for the model
 * to choose inside**, not a list for it to walk.
 *
 * The first version of this table in cutdown carried a `query` field beside each style — a string of
 * English keywords, put in the prompt as "for reference". Measured over four consecutive landscape
 * jobs: all four went mountain → lake → sea → meadow → sunset, in the exact order of the string
 * `landscape mountain sea lake meadow horizon`, on four completely different scripts. The model read
 * "for reference" as "storyboard". And because the queries came out the same, the library returned
 * the same photograph: three of four videos opened on the same foggy mountain. That field is gone.
 * What is left is `hint` — a description of the region — and the shared rules below, which are what
 * actually keep two videos from looking alike.
 *
 * Labels are in the dictionaries under `node.style.<id>`; the hints are English because they are
 * written for the model, not for the person.
 */
export const STOCK_STYLES = [
  { id: 'auto', hint: '' },
  { id: 'landscape', hint: 'wide nature: mountains, sea, lakes, meadows, desert, highlands, the horizon' },
  { id: 'street', hint: 'streets at night, alleys, crossings, wet tarmac, signal lights, stations' },
  { id: 'nature', hint: 'forest, trees, cloud, mist, water, stone, moss' },
  { id: 'architecture', hint: 'corridors, staircases, windows, arches, façades, buildings' },
  { id: 'interior', hint: 'an empty room, a corner of a desk, a café, a library, a kitchen, a workshop' },
  { id: 'everyday', hint: 'rain, a curtain, a cup of coffee, a page, sunlight on a wall, keys' },
  {
    id: 'cinematic-dark',
    // Name OBJECTS, not "a room". Measured on Pexels across eleven queries: anchoring on a
    // lamp/curtain/wall/corridor gave five of six photographs with nobody in them; anchoring on
    // "dark room" or "empty room" gave two of five — the library does not understand "empty", and
    // "chiaroscuro" is a *portrait* lighting term, so the first result back is the shadow of a
    // person, which is the one thing this frame forbids.
    hint: 'a dark room with one hard light source falling on a lamp, a wall, a curtain or a table — spare and quiet',
  },
  { id: 'mixed', hint: '' },
] as const;

export type StockStyle = (typeof STOCK_STYLES)[number]['id'];
export const STOCK_STYLE_IDS = STOCK_STYLES.map((s) => s.id) as unknown as [StockStyle, ...StockStyle[]];

/**
 * The named groups, written out from the table itself.
 *
 * This list used to be typed by hand in three places — the `auto` prompt, the `mixed` prompt and the
 * block's documentation. Adding a style and forgetting one of them threw no error: "mixed" simply
 * kept rotating through the old groups, and the catalogue kept telling the model a table that was
 * short one row.
 */
export const STOCK_GROUPS = STOCK_STYLES.filter((s) => s.hint).map((s) => s.id);

/**
 * The part of the prompt that decides what the pictures are of.
 *
 * The three rules at the top are aimed at one failure: every video ending up with the same shots.
 * A stock library searches by keyword and answers deterministically, so two queries that both say
 * "mountain dawn" come back with the same photograph — and the first image anyone thinks of for a
 * group is the image every other video opens with too.
 */
export function stylePrompt(style: StockStyle): string {
  const chosen = STOCK_STYLES.find((s) => s.id === style) ?? STOCK_STYLES[0];
  const groups = `${STOCK_GROUPS.slice(0, -1).join(', ')} or ${STOCK_GROUPS.at(-1)}`;
  const shared = [
    'The picture is only there to set a mood. It must NOT illustrate the narration or match its meaning.',
    'Never search for people acting out the problem, the feeling or the action the narration mentions.',
    'Anchor each query on ONE concrete thing — a cliff face, a railway track, a desk lamp, a curtain —',
    'never on the name of the group itself: a general query returns the photograph everyone else took.',
    'Change the place, the hour of the day and the camera distance between scenes. Do NOT follow the',
    'order things are listed in below, and do not open on the first image the group brings to mind.',
  ].join('\n');
  if (chosen.id === 'auto') {
    return `${shared}\nChoose ONE kind of place for the whole video, out of: ${groups}. Stay in it, but move around inside it.`;
  }
  if (chosen.id === 'mixed') {
    return `${shared}\nEvery scene comes from a different kind of place, out of: ${groups}.`;
  }
  return `${shared}\nThe kind of place the person picked: ${chosen.id} — ${chosen.hint}.\nEvery query must stay inside it.`;
}
