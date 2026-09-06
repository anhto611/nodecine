'use client';
import React from 'react';
import { StageDefSchema, LookDefSchema, type BlockDef, type StageDef } from '@/core/types/payloads';
import { useStudio } from '@/store/useStudio';
import { Btn, useT } from '@/components/ui';
import { Icon } from '@/components/icons';
import { DEFAULT_STAGE } from '@/nodes/look/node';
import { useFrame } from '@/nodes/look/body';
import { applyBoxToCode, type MeasuredRect } from '@/core/look/layout-edit';
import { draftStage, removeElementDraft, useDraft } from './draft';
import { ElementsTab } from './ElementsTab';
import { CodeTab } from './CodeTab';
import { AskBar } from './AskBar';
import { PreviewPane } from './PreviewPane';

const TAB_KEY = 'nodecine.codeEditorTab';

/**
 * The look editor for one stage or one block (CORE_CONTRACTS §2.6): on the left its elements
 * (stage only) or its code, below them the words-to-code bar, on the right the live preview.
 * Everything edits a draft; Save writes the draft into the node and keeps the modal open.
 */
export const CodeEditorDialog: React.FC = () => {
  const t = useT();
  const target = useStudio((s) => s.codeEditor);
  const close = useStudio((s) => s.setCodeEditor);
  const node = useStudio((s) => s.graph.nodes.find((n) => n.id === target?.nodeId));
  const setParams = useStudio((s) => s.setParams);
  const isBlock = target?.blockIndex !== undefined;
  // The Look's parameters carry both parts; parsing them as a StageDef strips the blocks.
  const stageParsed = React.useMemo(() => StageDefSchema.safeParse(node?.params), [node]);
  const stage: StageDef | null = stageParsed.success ? stageParsed.data : null;
  const blocks = React.useMemo(() => (isBlock ? LookDefSchema.safeParse(node?.params) : null), [isBlock, node]);
  const block: BlockDef | undefined = blocks?.success ? blocks.data.blocks[target!.blockIndex!] : undefined;
  const initial = isBlock ? block?.code.source ?? '' : stage?.code.source ?? '';
  const resetKey = `${target?.nodeId ?? ''}#${target?.blockIndex ?? ''}`;
  const draft = useDraft(initial, resetKey);
  const frame = useFrame();
  const FRAME = React.useMemo(() => ({ w: frame.width, h: frame.height }), [frame]);

  const [leftTab, setLeftTab] = React.useState<'elements' | 'code'>(() => { try { return localStorage.getItem(TAB_KEY) === 'code' ? 'code' : 'elements'; } catch { return 'elements'; } });
  const chooseTab = (tab: 'elements' | 'code') => { setLeftTab(tab); try { localStorage.setItem(TAB_KEY, tab); } catch { /* private mode */ } };
  const layout = !isBlock && leftTab === 'elements';
  const [rects, setRects] = React.useState<MeasuredRect[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  React.useEffect(() => { setSavedAt(null); setSelected(null); }, [resetKey]);

  const { commit, sourceRef, partsRef } = draft;
  const onBox = React.useCallback((key: string, box: { x: number; y: number; w: number; h: number }, resized: boolean) => {
    commit((cur) => ({ source: applyBoxToCode(cur.source, key, box, FRAME, { resized }) }));
    setSelected(key);
  }, [FRAME, commit]);

  const save = React.useCallback(() => {
    if (!target) return;
    const src = sourceRef.current;
    const p = partsRef.current;
    if (isBlock && blocks?.success) {
      setParams(target.nodeId, { blocks: blocks.data.blocks.map((b, i) => (i === target.blockIndex ? { ...b, ...(p.props ? { props: p.props } : {}), ...(p.doc ? { doc: p.doc } : {}), code: { format: 'html-gsap', source: src } } : b)) });
    } else {
      setParams(target.nodeId, { ...(p.tokens ? { tokens: p.tokens } : {}), ...(p.tones ? { tones: p.tones } : {}), ...(p.sceneFields ? { sceneFields: p.sceneFields } : {}), code: { format: 'html-gsap', source: src } });
    }
    draft.markSaved();
    setSavedAt(Date.now());
  }, [target, isBlock, blocks, setParams, sourceRef, partsRef, draft]);
  const saveIfDirty = React.useCallback(() => { if (draft.dirty) save(); }, [draft.dirty, save]);
  const doClose = React.useCallback(() => close(null), [close]);

  if (!target || !node) return null;

  const previewStage: StageDef = isBlock ? (stage ?? DEFAULT_STAGE) : draftStage(stage ?? DEFAULT_STAGE, draft.parts, draft.source);
  const previewBlock: BlockDef | undefined = isBlock && block ? { ...block, ...(draft.parts.props ? { props: draft.parts.props } : {}), code: { format: 'html-gsap', source: draft.source } } : undefined;
  const title = isBlock ? t('code.block', { id: block?.id ?? '' }) : t('code.stage', { id: stage?.name ?? '' });

  return (
    <div className="nc-modal-bg" onClick={doClose}>
      <div
        className="nc-modal"
        style={{ width: 'min(1500px, 95vw)', height: 'min(900px, 93vh)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDownCapture={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); saveIfDirty(); }
          const inEditor = !!(e.target as HTMLElement | null)?.closest?.('.cm-editor');
          const inField = inEditor || !!(e.target as HTMLElement | null)?.closest?.('input, textarea, select');
          if (e.key === 'Delete' || e.key === 'Backspace') {
            // Never let a Delete reach the canvas behind the modal, where it would remove the node.
            if (!inField) { e.preventDefault(); e.stopPropagation(); if (layout && selected) { commit((cur) => removeElementDraft(cur, selected, stage)); setSelected(null); } }
          }
          if ((e.metaKey || e.ctrlKey) && !inEditor && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
            e.preventDefault(); e.stopPropagation();
            if (e.key.toLowerCase() === 'y' || e.shiftKey) draft.redo(); else draft.undo();
          }
        }}
      >
        <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--accent-2)' }}><Icon.layers size={14} /></span>
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-title)' }}>{title}</span>
          {draft.dirty ? <span className="nc-tab-dot" title={t('tabs.unsaved')}>•</span> : savedAt ? <span style={{ fontSize: 'var(--fs-hint)', color: 'var(--ok)' }}>{t('code.saved', { at: new Date(savedAt).toLocaleTimeString() })}</span> : null}
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-3)' }}>{t('code.hint')}</span>
          <div style={{ flex: 1 }} />
          <Btn small disabled={!draft.dirty} onClick={() => { commit(() => ({ source: initial, parts: {} })); draft.setChanges([]); }}>{t('code.revert')}</Btn>
          <Btn small onClick={doClose}>{t('code.close')}</Btn>
          <Btn small primary disabled={!draft.dirty} onClick={save} title="Ctrl+S">{t('code.save')}</Btn>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)' }}>
            {!isBlock && (
              <div className="nc-tabs" style={{ flex: '0 0 32px' }}>
                <div className="nc-tabs-list">
                  {(['elements', 'code'] as const).map((tab) => (
                    <button key={tab} className={`nc-tab ${leftTab === tab ? 'on' : ''}`} style={{ border: 0, borderRight: '1px solid var(--line)', background: leftTab === tab ? undefined : 'none', font: 'inherit' }} onClick={() => chooseTab(tab)}>{t(tab === 'elements' ? 'code.tabElements' : 'code.tabCode')}</button>
                  ))}
                </div>
              </div>
            )}
            {layout
              ? <ElementsTab source={draft.source} parts={draft.parts} stage={stage ?? DEFAULT_STAGE} rects={rects} selected={selected} onSelect={setSelected} commit={commit} frame={FRAME} />
              : <CodeTab value={draft.source} onChange={draft.typeSource} onSave={saveIfDirty} onClose={doClose} />}
            <AskBar
              kind={isBlock ? 'block' : 'stage'}
              changes={draft.changes}
              getRequest={() => {
                const p = partsRef.current;
                const base = stage;
                const s = base ? draftStage(base, p) : null;
                return {
                  source: sourceRef.current,
                  stage: s ? { name: s.name, frame: s.frame, tokens: s.tokens, tones: s.tones, sceneFields: s.sceneFields } : undefined,
                  block: isBlock && block ? { id: block.id, name: block.name, doc: p.doc ?? block.doc, props: p.props ?? block.props } : undefined,
                  frame,
                };
              }}
              onAnswer={(a) => {
                commit((cur) => ({ source: a.source, parts: { ...cur.parts, ...(a.tokens ? { tokens: a.tokens } : {}), ...(a.tones ? { tones: a.tones } : {}), ...(a.sceneFields ? { sceneFields: a.sceneFields } : {}), ...(a.props ? { props: a.props } : {}), ...(a.doc ? { doc: a.doc } : {}) } }));
                draft.setChanges((prev) => [...prev, ...(a.changes ?? [])]);
              }}
            />
            <div style={{ height: 26, display: 'flex', alignItems: 'center', gap: 14, padding: '0 12px', borderTop: '1px solid var(--line)', fontSize: 'var(--fs-hint)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span>{t('code.lines', { n: draft.source.split('\n').length })}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(isBlock ? 'code.cheatBlock' : 'code.cheatStage')}</span>
            </div>
          </div>
          <PreviewPane stage={previewStage} block={previewBlock} frame={frame} layout={layout} rects={rects} onRects={setRects} selected={selected} onSelect={setSelected} onBox={onBox} resetKey={resetKey} />
        </div>
      </div>
    </div>
  );
};
