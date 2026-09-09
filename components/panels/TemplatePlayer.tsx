'use client';
import React from 'react';
import type { Graph } from '@/core/engine/graph';
import { LookDefSchema, type LookDef } from '@/core/types/payloads';
import { sampleProps } from '@/core/look/markup';
import { LookPreview } from '@/nodes/art-director/preview';
import { useT } from '@/components/ui';

/** How long each block plays before the next; the animation loop matches it, so every slide runs once. */
const SLIDE_SECONDS = 3.6;

/** gsap's source, fetched once for every card on the page. */
let gsapPromise: Promise<string> | null = null;
const loadGsap = () => (gsapPromise ??= import('@/engines/hyperframes/player.client').then((m) => m.gsapSource()));

/** The look a template ships: its Art Director's parameters, or nothing when the template has none. */
export function lookOfTemplate(graph: Graph): LookDef | null {
  const node = graph.nodes.find((n) => n.type === 'core/art-director');
  const parsed = node ? LookDefSchema.safeParse(node.params) : null;
  return parsed?.success ? parsed.data : null;
}

/**
 * What the card says a template makes: the shape of its frame and how many frames a second.
 *
 * Both were a single hardcoded string in the dictionary ("9:16 · 30 fps") back when every template
 * was a portrait video. The first 16:9 template made the line a lie on every card that showed it,
 * and a lie about the one thing a person picks a template by. Read from the graph instead: the frame
 * from the Art Director's stage, the rate from the Timeline Assembler, both absent on a template
 * that has neither.
 */
export function shapeOfTemplate(graph: Graph): { ratio: string; fps: number } | null {
  const frame = lookOfTemplate(graph)?.frame;
  if (!frame) return null;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const d = gcd(frame.width, frame.height) || 1;
  const fps = graph.nodes.find((n) => n.type === 'core/timeline-assembler')?.params.fps;
  return { ratio: `${frame.width / d}:${frame.height / d}`, fps: typeof fps === 'number' ? fps : 30 };
}

/**
 * A template card that plays (USER_FLOWS §1.3, after cutdown's gallery): the template's own stage
 * with its blocks one after another, each with its sample props and a tone, animated by the same
 * scripts the render runs. Starts when the card scrolls into view and stops when it leaves, so a
 * gallery of many cards costs only what is on screen.
 */
export const TemplatePlayer: React.FC<{ look: LookDef; playing?: boolean; style?: React.CSSProperties }> = ({ look, playing = true, style }) => {
  const t = useT();
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  const [gsap, setGsap] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  React.useEffect(() => {
    if (!visible || gsap) return;
    let alive = true;
    void loadGsap().then((s) => { if (alive) setGsap(s); }).catch(() => undefined);
    return () => { alive = false; };
  }, [visible, gsap]);
  const active = visible && playing;
  React.useEffect(() => {
    if (!active || look.blocks.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % look.blocks.length), SLIDE_SECONDS * 1000);
    return () => clearInterval(id);
  }, [active, look.blocks.length]);

  const { blocks, ...stage } = look;
  const block = blocks[index % blocks.length]!;
  const tones = Object.keys(stage.tones);
  const tone = tones.length ? tones[index % (tones.length + 1)] : undefined; // one turn on the base palette per cycle
  const fields = stage.sceneFields.some((f) => f.name === 'kicker') ? { kicker: block.name.toUpperCase() } : undefined;
  const options = React.useMemo(() => ({
    stage,
    block,
    props: sampleProps(block),
    fields,
    tone,
    width: stage.frame.width,
    height: stage.frame.height,
    ...(active && gsap ? { animate: { gsapSource: gsap, loopSeconds: SLIDE_SECONDS }, captions: t('preview.captionSample') } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [look, index, active, gsap]);

  // The previous slide stays underneath for the length of the stage's transition while the new one
  // fades or slides in over it — the same change the render makes between scenes.
  const tr = stage.transition ?? { type: 'fade', seconds: 0.4 };
  const [prev, setPrev] = React.useState<typeof options | null>(null);
  const lastRef = React.useRef(options);
  React.useEffect(() => {
    const before = lastRef.current;
    lastRef.current = options;
    if (before === options || tr.type === 'cut') return;
    setPrev(before);
    const id = setTimeout(() => setPrev(null), tr.seconds * 1000 + 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);
  const enter = tr.type === 'cut' ? undefined : `nc-enter-${tr.type} ${tr.seconds}s ease-out both`;
  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative', ...style }}>
      {prev && <LookPreview key="prev" options={prev} fit style={{ position: 'absolute', inset: 0 }} />}
      <LookPreview key={index} options={options} fit style={{ position: 'absolute', inset: 0, animation: enter }} />
    </div>
  );
};
