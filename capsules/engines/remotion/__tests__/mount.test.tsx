import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { gsap } from 'gsap';
import { SceneInstance, mountSceneInto, type PreparedScene } from '../scene-runtime';

/**
 * Who owns a scene's DOM.
 *
 * On 2026-09-11 a real Remotion render came out with a drifting background and no text on it, while
 * HyperFrames drew the same film in full. The cause was React 19: it compares the
 * `dangerouslySetInnerHTML` prop by the identity of the `{ __html }` object, not by the string in it,
 * so a component that builds that object inline rewrites the element's children on every render.
 * Under Remotion that is every frame — gsap writes the frame's inline styles, React puts the pristine
 * markup back, and the timeline seeks nodes that have left the document.
 *
 * These are the two halves of the guard: the plain-React one reproduces the wipe, and the other shows
 * that mounting the markup ourselves survives it.
 */

const scene: PreparedScene = {
  id: 's1', index: 0, start: 0, duration: 4,
  html: '<div class="card"><h1 class="title">Hello</h1></div>',
  css: '', scripts: ["nodecine.timeline(gsap.timeline().fromTo('.title', { opacity: 0 }, { opacity: 1, duration: 1 }, 0));"],
  facts: {}, words: [], cues: [], beat: true, overlapFrames: 0, transitionIn: null, transitionOut: null,
};
const film = { vars: {}, beats: [], analysis: {} };

/** What the composition used to do: hand the markup to React and mount a timeline over it. */
const ReactOwned: React.FC<{ tick: number }> = ({ tick }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const inst = React.useRef<SceneInstance | null>(null);
  React.useLayoutEffect(() => {
    if (!ref.current || inst.current) return;
    inst.current = new SceneInstance(ref.current, scene, film);
  }, []);
  React.useLayoutEffect(() => { inst.current?.seek(tick); }, [tick]);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: scene.html }} />;
};

/** What it does now: the markup is written once, outside React, and stays. */
const OurOwn: React.FC<{ tick: number }> = ({ tick }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const inst = React.useRef<SceneInstance | null>(null);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const mounted = mountSceneInto(ref.current, scene, film);
    inst.current = mounted.instance;
    return () => { mounted.dispose(); inst.current = null; };
  }, []);
  React.useLayoutEffect(() => { inst.current?.seek(tick); }, [tick]);
  return <div ref={ref} />;
};

const opacityOf = (host: HTMLElement) => host.querySelector<HTMLElement>('.title')?.style.opacity ?? '';

describe('a scene under a component that re-renders every frame', () => {
  it('is wiped when React owns the markup — the bug, kept as the reason for the shape of the fix', () => {
    const { container, rerender } = render(<ReactOwned tick={0} />);
    const host = container.firstElementChild as HTMLElement;
    rerender(<ReactOwned tick={0.9} />);
    // The timeline ran, but its target left the document with the re-set markup.
    expect(opacityOf(host)).toBe('');
  });

  it('survives when the markup is ours: the same element, carrying the frame gsap wrote', () => {
    const { container, rerender } = render(<OurOwn tick={0} />);
    const host = container.firstElementChild as HTMLElement;
    const first = host.querySelector('.title');
    expect(opacityOf(host)).toBe('0');
    rerender(<OurOwn tick={0.9} />);
    expect(host.querySelector('.title'), 'the element was replaced under the timeline').toBe(first);
    expect(Number(opacityOf(host))).toBeGreaterThan(0.5);
    rerender(<OurOwn tick={2} />);
    expect(Number(opacityOf(host))).toBe(1);
  });

  it('leaves nothing behind when it goes', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const mounted = mountSceneInto(root, scene, film);
    expect(root.querySelector('.title')).toBeTruthy();
    mounted.dispose();
    expect(root.innerHTML).toBe('');
    expect(gsap.globalTimeline.getChildren().some((c) => c === mounted.instance.master)).toBe(false);
    root.remove();
  });
});
