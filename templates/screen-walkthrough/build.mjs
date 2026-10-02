import { editComposition, filmShell, sceneBlock } from '../_kit/build.mjs';

/**
 * Screen walkthrough: a recording somebody made, cut where they paused.
 *
 * Nothing here writes the scenes — the Rough Cut node decides where each one starts and hands every
 * frame the block name `clip-full`, so the kit is that one block: the recording, framed as a screen,
 * playing from the second the scene starts. The film is the clip's own shape, so the kit is landscape.
 */

const screenCss =
  'html,body{margin:0;background:#05080a}*{box-sizing:border-box}' +
  '#root{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;color:#eaf2f5;background:#05080a;font-family:var(--font-body,Inter,Arial,sans-serif)}' +
  '.nc-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 22% 6%,#123240 0,#0a1418 54%,#04070a 100%)}' +
  '.chrome{position:absolute;left:110px;right:110px;top:96px;bottom:168px;background:#f2f5f7;border-radius:22px;box-shadow:0 46px 110px #00000088;overflow:hidden}' +
  '.bar{height:64px;display:flex;align-items:center;gap:12px;padding:0 26px;background:#e4e9ee;color:#54606c;font-size:21px;font-weight:800;letter-spacing:.12em}' +
  '.bar i{display:block;width:14px;height:14px;border-radius:50%;background:#c3ccd4}' +
  '.bar .url{margin-left:16px;flex:1;height:34px;border-radius:17px;background:#f7f9fb;color:#8a949d;font-size:19px;letter-spacing:.06em;display:flex;align-items:center;padding:0 18px}' +
  '.screen{position:absolute;left:0;right:0;top:64px;bottom:0;background:#0a0f14}' +
  '.screen .take{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2}' +
  '.screen .empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#4d5a66;font-size:30px;letter-spacing:.1em}' +
  '.mark{position:absolute;left:110px;bottom:92px;display:flex;align-items:center;gap:16px;color:#7fe0c0;font-size:23px;font-weight:850;letter-spacing:.16em}' +
  '.mark .brand-mark{display:flex;align-items:center;justify-content:center;width:58px;height:58px;border-radius:15px;background:#7fe0c0;color:#04211a;font-size:34px;font-weight:1000;letter-spacing:-.1em}' +
  '.ticks{position:absolute;right:110px;bottom:96px;display:flex;align-items:end;gap:7px;height:30px}' +
  '.ticks b{display:block;width:7px;background:#7fe0c0;border-radius:4px}' +
  '.ticks b:nth-child(1){height:14px}.ticks b:nth-child(2){height:28px}.ticks b:nth-child(3){height:19px}.ticks b:nth-child(4){height:30px}.ticks b:nth-child(5){height:17px}';

const scene = {
  role: 'scene',
  description: 'The recording, framed as a screen, playing from the second this scene starts.',
  css: screenCss,
  markup: `<div class="chrome"><div class="bar"><i></i><i></i><i></i><span class="url">RECORDING</span></div><div class="screen"><span class="empty">THE RECORDING PLAYS HERE</span><video class="take" id="take" data-var-src="clip" data-start="0" muted playsinline></video></div></div>
      <div class="mark"><span class="brand-mark">N<span></span></span><span>WALKTHROUGH</span></div>
      <div class="ticks"><b></b><b></b><b></b><b></b><b></b></div>`,
  motion: `tl.fromTo(q('.chrome'),{y:44,opacity:0},{y:0,opacity:1,duration:.6,ease:'power3.out'},0)
      .fromTo(q('.mark'),{x:-24,opacity:0},{x:0,opacity:1,duration:.5,ease:'power2.out'},.42)
      .fromTo(q('.ticks'),{opacity:0},{opacity:1,duration:.5,ease:'sine.out'},.5);`,
  // The block plays a stretch of the recording: where it starts comes from the Rough Cut node, and how
  // long it runs is the frame's own length, which Assemble hands over as `seconds`.
  extraScript: `var take=root.querySelector('.take');if(take){take.setAttribute('data-media-start',String(Number(v.from)||0));take.setAttribute('data-duration',String(Number(v.seconds)||Number(root.dataset.duration)||4));}`,
  variables: [
    {
      id: 'from',
      type: 'number',
      label: 'Second in the recording this scene starts at (the Rough Cut node gives it)',
      labels: { vi: 'Giây bắt đầu trong bản ghi (node Rough Cut cấp)' },
      default: 0,
      required: true,
    },
    { id: 'seconds', type: 'number', label: 'Length in seconds (the Assemble node gives it)', labels: { vi: 'Độ dài, giây (node Assemble cấp)' }, default: 4 },
  ],
};

// Keep the workflow JSON in sync with that block and the guide that describes the film.
await editComposition(new URL('./workflow.json', import.meta.url), (files) => {
  // The shell the Studio previews and the inspector lints, until a run has Assemble write the entry.
  files['index.html'] = filmShell({ id: 'walkthrough-shell', width: 1920, height: 1080, background: '#05080a' });
  // The name matters: Rough Cut assigns every frame this block, so the file has to be `clip-full`.
  files['compositions/clip-full.html'] = sceneBlock({ ...scene, id: 'clip-full', width: 1920, height: 1080, seconds: 6 });
  files['storyboard-guide.md'] =
    `---\nfirst: clip-full\nlast: clip-full\nrepeat: 0\n---\nA walkthrough cut from a screen recording: the Rough Cut node decides where each scene starts and stops, by where the person paused, so nothing writes scenes here.\nEvery scene shows the recording full-frame in screen chrome, playing from the second the scene starts.\nThe narration is the recorder's own voice; never invent a step, a click or a menu that the recording does not show.`;
});
