# Fonts bundled with a composition

Files, not links: a render must not depend on Google Fonts answering, and a frame captured while a
webfont was still swapping would show the fallback. Every file here is copied into the render's
project directory (`FONT_FILES` in `contracts/visual/markup.ts` is the one list) and declared with
`font-display: block`.

| Font | Files | Licence |
|---|---|---|
| JetBrains Mono | `JetBrainsMono-*.woff2` (400, 700, 800) | SIL Open Font License 1.1 — see `OFL.txt` |
| Comfortaa | `Comfortaa-latin.woff2`, `Comfortaa-latin-ext.woff2`, `Comfortaa-vietnamese.woff2` | SIL Open Font License 1.1 |

Comfortaa came from Google Fonts (`fonts.googleapis.com/css2?family=Comfortaa`), v47, as the three
subsets Google itself serves. Each file is the **variable** face, weight 300 to 700 — asking for 800
makes the browser fake the weight by smearing, which shows as a furred edge over a photograph. Split
by unicode range the way Google splits it, so a Vietnamese caption pulls 7 KB and an English one
never loads that file at all.

Its Vietnamese subset was checked before the face was chosen: a beautiful font missing the marks
fails silently, falling back to another face on exactly the letters that carry them — which is most
of a Vietnamese sentence.
