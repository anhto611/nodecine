import React from 'react';
import type { BlockDef, StageDef } from '@/core/types/payloads';
import { UndoStack } from '@/lib/undo-stack';
import { fieldNameOf, removeElementFromCode } from '@/core/look/stage-elements';

/** Definition parts an edit may replace besides the code. */
export type DraftParts = Partial<Pick<StageDef, 'tokens' | 'tones' | 'sceneFields'>> & Partial<Pick<BlockDef, 'props' | 'doc'>>;
export interface Draft { source: string; parts: DraftParts }
export type Commit = (next: (cur: Draft) => Partial<Draft>, coalesce?: string) => void;

/**
 * The modal's working copy of a stage or block: the code plus any definition parts changed since
 * the node was last written, with an undo history for everything that is not typing in the editor
 * (drags, adds, removals, text edits, an answer from the model). Typing has CodeMirror's history.
 */
export function useDraft(initial: string, resetKey: string) {
  const [source, setSource] = React.useState(initial);
  const [parts, setParts] = React.useState<DraftParts>({});
  const [changes, setChanges] = React.useState<string[]>([]);
  const sourceRef = React.useRef(source); sourceRef.current = source;
  const partsRef = React.useRef(parts); partsRef.current = parts;
  const hist = React.useRef(new UndoStack<Draft>());
  React.useEffect(() => { hist.current = new UndoStack(); }, [resetKey]);
  React.useEffect(() => { setSource(initial); setParts({}); setChanges([]); }, [initial]);

  const commit = React.useCallback<Commit>((next, coalesce) => {
    const cur = { source: sourceRef.current, parts: partsRef.current };
    const out = next(cur);
    if ((out.source === undefined || out.source === cur.source) && (out.parts === undefined || out.parts === cur.parts)) return;
    hist.current.record(cur, coalesce ? { coalesce } : {});
    if (out.source !== undefined) setSource(out.source);
    if (out.parts !== undefined) setParts(out.parts);
  }, []);
  const undo = React.useCallback(() => { const p = hist.current.undo({ source: sourceRef.current, parts: partsRef.current }); if (p) { setSource(p.source); setParts(p.parts); } }, []);
  const redo = React.useCallback(() => { const n = hist.current.redo({ source: sourceRef.current, parts: partsRef.current }); if (n) { setSource(n.source); setParts(n.parts); } }, []);
  /** After a save the draft is the saved state: nothing pending, history kept. */
  const markSaved = React.useCallback(() => { setParts({}); setChanges([]); }, []);
  const dirty = source !== initial || Object.keys(parts).length > 0;
  return { source, parts, changes, setChanges, dirty, commit, undo, redo, markSaved, typeSource: setSource, sourceRef, partsRef };
}

/** Removing an element that draws a scene field removes the field too, or the director keeps writing into nothing. */
export function removeElementDraft(cur: Draft, cls: string, stage: StageDef | null): Partial<Draft> {
  const field = fieldNameOf(cur.source, cls);
  return {
    source: removeElementFromCode(cur.source, cls),
    ...(field && stage ? { parts: { ...cur.parts, sceneFields: (cur.parts.sceneFields ?? stage.sceneFields).filter((f) => f.name !== field) } } : {}),
  };
}

/** The stage as the draft sees it: saved definition with the pending parts on top. */
export function draftStage(stage: StageDef, parts: DraftParts, source?: string): StageDef {
  return { ...stage, ...(parts.tokens ? { tokens: parts.tokens } : {}), ...(parts.tones ? { tones: parts.tones } : {}), ...(parts.sceneFields ? { sceneFields: parts.sceneFields } : {}), ...(source !== undefined ? { code: { format: 'html-gsap', source } } : {}) };
}
