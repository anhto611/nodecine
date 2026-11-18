# Building a NodeCine kit

You are in a HyperFrames project that is a **NodeCine kit**: the look and motion of every video one
workflow makes. NodeCine fills it, video after video: a model writes a storyboard that picks one of
your blocks per scene and gives it values, a voice reads the narration, and NodeCine assembles the
frames on the clock of that voice. You build the kit once; it must work for any topic the workflow is
given, never only for the sample.

Use the HyperFrames skills you have (`hyperframes`, `hyperframes-core`, `hyperframes-animation`,
`hyperframes-creative`, `hyperframes-keyframes`) for how compositions, timelines and motion work.
This file says only what NodeCine adds.

## Files

- `index.html` — the shell: the whole video. Its root element carries `data-composition-id`,
  `data-width` and `data-height` (1080 × 1920 for a vertical film, 1920 × 1080 for a horizontal one)
  and `data-duration` (any length: NodeCine sets the real one),
  sets the background and anything that runs under every scene, and holds the comment
  `<!-- nodecine:frames -->` inside the root, where NodeCine puts the scenes. Keep one paused GSAP
  timeline registered on `window.__timelines`.
- `compositions/<name>.html` — a **block**: one scene, self-contained, played by one storyboard frame.
  Names are lowercase with dashes, 2–41 characters.
- `compositions/components/<name>.html` — a **component**: a piece a block or a frame mounts inside it.
  Optional.
- `storyboard-guide.md` — what the storyboard writer reads: how this kit's films are built.
- `assemble.json` — optional: `{ "slots": {…}, "overlays": [...], "transition": 0.4 }` — named boxes
  frames may mount components into, parts that run across the whole film (captions), and the length of
  a soft transition between scenes.
- Shared JavaScript or CSS (for example `parts.js`) may sit at the top level and be loaded by blocks.

## A block

```html
<!doctype html>
<html lang="en" data-composition-duration="4" data-role="feature"
      data-composition-variables="[…JSON, HTML-escaped…]">
<head><meta charset="UTF-8" /><meta name="description" content="What this scene shows, for whoever picks it" /></head>
<body><template>
  <div id="root" data-composition-id="<name>" data-width="1080" data-height="1920" data-duration="4">…</div>
  <script>(function () {
    var root = document.getElementById('root');
    var v = window.__hyperframes && window.__hyperframes.getVariables ? window.__hyperframes.getVariables() : {};
    // fill the markup from v, falling back to each variable's default
    var tl = gsap.timeline({ paused: true });
    // … the motion …
    tl.set({}, {}, 4);
    tl.seek(0);
    window.__timelines = window.__timelines || {}; window.__timelines['<name>'] = tl;
  })();</script>
</template></body></html>
```

- The root carries `data-width` and `data-height`, the same as the shell's.
- `data-role` is one of `hook`, `feature`, `proof`, `scene`, `outro` (what the scene is for), or
  `overlay` for a block that plays as a layer over several scenes.
- `<meta name="description">` says what the scene shows and when to pick it. The storyboard writer
  chooses blocks by it.
- `data-composition-variables` declares every value the block takes: `id`, `type` (`string`,
  `number`, `color`, `boolean`, `image`…), `label` (English), `labels: { "vi": "…" }`, `default`,
  `maxLength` for text, and `"required": true` for what the scene cannot do without. Text defaults
  are empty or neutral — never words about the sample's topic.
- Call `window.__hyperframes.getVariables()` **in the block's own inline script**. Called from a
  shared file it returns the root's values, and every value comes out empty.
- The scene must hold for any length NodeCine gives it: build the motion in the first seconds, then
  rest or loop gently; never end on an empty frame.
- Pictures a value names (`assets/<file>`) arrive with each video. Do not put the sample's pictures
  or its words in the kit.
- A shared file (`parts.js`) must not read a library's global (`window.THREE`, `window.gsap`) when it
  loads: NodeCine's preview may run your own scripts before the ones from a CDN. Read the global inside
  the function that uses it. NodeCine plays every block in its preview and sends you any script error.
- Deterministic: no `Math.random()` without a seed, no `Date.now()`, no network fetches at render
  time except scripts loaded by `<script src>` from a pinned CDN URL (three.js, for example, at an
  exact version). Everything must seek correctly: the renderer jumps to any time.

## The storyboard guide

```
---
first: hook
last: outro
repeat: 2
---
How these films are built: who they speak to, the tone, how long, which blocks to use when, how
many scenes, and the rules for numbers and claims. Name the blocks by file name.
```

`first`/`last` are the roles the first and last scene must have; `repeat` is how many scenes in a row
may use the same block.

## Done means

- Every file above that the kit needs exists, and `npx hyperframes lint` reports no errors (run it if
  you can; NodeCine runs it too and sends you what it finds).
- At least a hook, two or three feature or scene blocks with different layouts, and an outro, so a
  film does not repeat one picture.
- When you finish, answer with a short summary: the blocks and what each is for, and anything you
  could not do.
