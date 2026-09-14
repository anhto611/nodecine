/**
 * The composition a new node starts with: the smallest HyperFrames project that passes the linter,
 * with two variables so the Fill node has something to fill. Portrait, five seconds.
 */
export const STARTER_INDEX = `<!doctype html>
<html lang="en" data-composition-variables='[{"id":"title","type":"string","label":"Title","default":"Hello"},{"id":"accent","type":"color","label":"Accent","default":"#7c5cff"}]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="gsap.min.js"></script>
    <style>
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #0b0c10; }
      #stage { position: relative; width: 1080px; height: 1920px; overflow: hidden; }
      .title { position: absolute; left: 96px; right: 96px; top: 760px; color: #fff; font: 800 110px/1.1 system-ui, sans-serif; opacity: 0; }
      .bar { position: absolute; left: 96px; top: 700px; width: 160px; height: 16px; background: var(--accent); transform-origin: left; }
    </style>
  </head>
  <body>
    <div id="stage" data-composition-id="starter" data-start="0" data-width="1080" data-height="1920">
      <div class="bar"></div>
      <div class="title" data-var-text="title">Hello</div>
      <script>
        const tl = gsap.timeline({ paused: true });
        tl.fromTo('.bar', { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power3.out' }, 0);
        tl.fromTo('.title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.2);
        tl.set({}, {}, 5);
        window.__timelines['starter'] = tl;
      </script>
    </div>
  </body>
</html>
`;
