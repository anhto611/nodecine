'use client';
import React from 'react';
import { StageDefSchema, BlockSetSchema, type BlockDef, type StageDef } from '@/core/types/payloads';
import { useStudio } from '@/store/useStudio';
import { LookPreview } from '@/nodes/look/preview';
import { Btn, useT } from '../ui';
import { Icon } from '../icons';
import { DEFAULT_STAGE as DEFAULT_PREVIEW_STAGE } from '@/nodes/look/stage';

/**
 * The code of one stage or one block, edited in a modal with the live preview beside it. Saving
 * writes the source back into the node's parameters; nothing else on the node changes.
 */
export const CodeEditorDialog: React.FC = () => {
  const t = useT();
  const target = useStudio((s) => s.codeEditor);
  const close = useStudio((s) => s.setCodeEditor);
  const node = useStudio((s) => s.graph.nodes.find((n) => n.id === target?.nodeId));
  const setParams = useStudio((s) => s.setParams);
  const wired = useStudio((s) => {
    // The stage the Blocks node feeds, for a truthful block preview; otherwise the default look.
    if (!target || target.blockIndex === undefined) return null;
    const out = s.graph.edges.find((e) => e.source === target.nodeId);
    if (!out) return null;
    const stageEdge = s.graph.edges.find((e) => e.target === out.target && e.targetPort === 'stage');
    const p = stageEdge ? s.graph.nodes.find((n) => n.id === stageEdge.source)?.params : null;
    const r = StageDefSchema.safeParse(p);
    return r.success ? r.data : null;
  });
  const isBlock = target?.blockIndex !== undefined;
  const stage = React.useMemo(() => (!isBlock ? StageDefSchema.safeParse(node?.params) : null), [isBlock, node]);
  const blocks = React.useMemo(() => (isBlock ? BlockSetSchema.safeParse(node?.params) : null), [isBlock, node]);
  const block: BlockDef | undefined = blocks?.success ? blocks.data.blocks[target!.blockIndex!] : undefined;
  const initial = isBlock ? block?.code.source ?? '' : stage?.success ? stage.data.code.source : '';
  const [source, setSource] = React.useState(initial);
  React.useEffect(() => { setSource(initial); }, [initial, target?.nodeId, target?.blockIndex]);
  if (!target || !node) return null;

  const previewStage: StageDef | null = isBlock ? (wired ?? DEFAULT_PREVIEW_STAGE) : stage?.success ? { ...stage.data, code: { format: 'html-gsap', source } } : null;
  const previewBlock: BlockDef | undefined = isBlock && block ? { ...block, code: { format: 'html-gsap', source } } : undefined;
  const dirty = source !== initial;
  const save = () => {
    if (isBlock && blocks?.success) {
      setParams(target.nodeId, { blocks: blocks.data.blocks.map((b, i) => (i === target.blockIndex ? { ...b, code: { format: 'html-gsap', source } } : b)) });
    } else {
      setParams(target.nodeId, { code: { format: 'html-gsap', source } });
    }
    close(null);
  };
  const title = isBlock ? t('code.block', { id: block?.id ?? '' }) : t('code.stage', { id: stage?.success ? stage.data.id : '' });

  return (
    <div className="nc-modal-bg" onClick={() => close(null)}>
      <div className="nc-modal" style={{ width: 'min(1400px, 94vw)', height: 'min(860px, 92vh)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--accent-2)' }}><Icon.layers size={14} /></span>
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-title)' }}>{title}</span>
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--tx-3)' }}>{t('code.hint')}</span>
          <div style={{ flex: 1 }} />
          <Btn small onClick={() => close(null)}>{t('code.cancel')}</Btn>
          <Btn small primary disabled={!dirty} onClick={save} title="Ctrl+Enter">{t('code.save')}</Btn>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <textarea
            className="nc-textarea nc-code"
            spellCheck={false}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (dirty) save(); }
              if (e.key === 'Tab') { e.preventDefault(); const el = e.currentTarget; const a = el.selectionStart; const b = el.selectionEnd; setSource(`${source.slice(0, a)}  ${source.slice(b)}`); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 2; }); }
              if (e.key === 'Escape') close(null);
            }}
            style={{ flex: 1, minWidth: 0, height: '100%', resize: 'none', borderRadius: 0, border: 0, borderRight: '1px solid var(--line)', fontSize: 'var(--fs-title)', lineHeight: 1.5, padding: 14 }}
          />
          <div style={{ width: 'min(420px, 36%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg-sunk)' }}>
            {previewStage ? <LookPreview options={{ stage: previewStage, block: previewBlock }} delayMs={300} style={{ width: '100%', maxHeight: '100%' }} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

