'use client';
import React from 'react';
import { BlockDefSchema, BlockSetSchema, StageDefSchema, type BlockDef, type BlockSet, type StageDef } from '@/core/types/payloads';

const BlockDefSchemaOk = (b: unknown): b is BlockDef => BlockDefSchema.safeParse(b).success;
import { Kv, useT, stopFlow } from '@/components/ui';
import { useStudio } from '@/store/useStudio';
import { DEFAULT_BLOCK as DEFAULT_TEXT_CARD } from '@/nodes/look/blocks';
import { DEFAULT_STAGE } from '@/nodes/look/stage';
import { LookPreview } from '@/nodes/look/preview';

/**
 * The stage and blocks wired into a node, read from the source nodes' parameters rather than from
 * run results, so a body can offer them before anything has run. Definitions the schema rejects are
 * left out, the way the executor would leave them out.
 */
export function useWiredLook(nodeId: string): { stage?: StageDef; blocks: BlockDef[] } {
  const graph = useStudio((s) => s.graph);
  return React.useMemo(() => {
    const paramsOf = (port: string) =>
      graph.edges.filter((e) => e.target === nodeId && e.targetPort === port).map((e) => graph.nodes.find((n) => n.id === e.source)?.params);
    const stage = paramsOf('stage').map((p) => StageDefSchema.safeParse(p)).find((r) => r.success)?.data;
    const blocks = paramsOf('blocks').map((p) => BlockSetSchema.safeParse(p)).filter((r) => r.success).flatMap((r) => r.data!.blocks);
    return { stage, blocks };
  }, [graph, nodeId]);
}

/** The stage wired to the same consumer as this node, so a block thumbnail wears the right look. */
function useStageFor(nodeId: string): StageDef {
  const graph = useStudio((s) => s.graph);
  return React.useMemo(() => {
    const out = graph.edges.find((e) => e.source === nodeId);
    const stageEdge = out ? graph.edges.find((e) => e.target === out.target && e.targetPort === 'stage') : undefined;
    const p = stageEdge ? graph.nodes.find((n) => n.id === stageEdge.source)?.params : undefined;
    const r = StageDefSchema.safeParse(p);
    return r.success ? r.data : DEFAULT_STAGE;
  }, [graph, nodeId]);
}

/**
 * Bodies for the Stage and Blocks nodes. Their parameters are the whole definition, so the body is a
 * small form over the parts a person edits by hand: identity, the code, and — for a block — what the
 * model may write and when to use it. The Blocks node shows its catalogue as a list and edits one
 * block at a time. Structured parts (props, tones, scene fields) are edited as
 * JSON here; the Zod schema on the node keeps a bad edit from reaching the graph.
 */
type BodyProps = { nodeId: string };

function useParams<T extends Record<string, unknown>>(nodeId: string): [T, (patch: Partial<T>) => void] {
  const node = useStudio((s) => s.graph.nodes.find((n) => n.id === nodeId));
  const setParams = useStudio((s) => s.setParams);
  return [(node?.params ?? {}) as T, (patch) => setParams(nodeId, patch as Record<string, unknown>)];
}

/** A textarea that holds JSON as typed and only commits when it parses to an object. */
const JsonField: React.FC<{ label: string; value: unknown; rows?: number; onCommit: (v: unknown) => void }> = ({ label, value, rows = 4, onCommit }) => {
  const t = useT();
  const pretty = React.useMemo(() => JSON.stringify(value, null, 1), [value]);
  const [text, setText] = React.useState(pretty);
  const [bad, setBad] = React.useState(false);
  React.useEffect(() => { setText(pretty); setBad(false); }, [pretty]);
  const change = (next: string) => {
    setText(next);
    try {
      const parsed: unknown = JSON.parse(next);
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      setBad(false);
      onCommit(parsed);
    } catch {
      setBad(true);
    }
  };
  return (
    <>
      <div className="nc-kv"><span className="nc-k">{label}</span>{bad ? <span className="nc-v" style={{ color: 'var(--err)' }}>{t('node.invalidJson')}</span> : null}</div>
      <textarea className={`nc-textarea nc-code ${stopFlow}`} rows={rows} value={text} spellCheck={false} onChange={(e) => change(e.target.value)} />
    </>
  );
};

const Identity: React.FC<{ id: string; name: string; onChange: (patch: { id?: string; name?: string }) => void }> = ({ id, name, onChange }) => {
  const t = useT();
  return (
    <>
      <Kv k={t('node.id')} v={<input className={`nc-input ${stopFlow}`} value={id} onChange={(e) => onChange({ id: e.target.value })} />} />
      <Kv k={t('node.name')} v={<input className={`nc-input ${stopFlow}`} value={name} onChange={(e) => onChange({ name: e.target.value })} />} />
    </>
  );
};

export const StageBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<StageDef>(nodeId);
  const openCode = useStudio((s) => s.setCodeEditor);
  const valid = StageDefSchema.safeParse(p);
  return (
    <>
      {valid.success ? <LookPreview options={{ stage: valid.data }} onClick={() => openCode({ nodeId })} style={{ cursor: 'pointer' }} /> : null}
      <button className={`nc-btn nc-btn-sm ${stopFlow}`} style={{ justifyContent: 'center' }} onClick={() => openCode({ nodeId })}>{t('node.editCode')}</button>
      <Identity id={p.id ?? ''} name={p.name ?? ''} onChange={set} />
      <JsonField label={t('node.tokens')} value={p.tokens ?? {}} onCommit={(v) => set({ tokens: v as StageDef['tokens'] })} />
      <JsonField label={t('node.tones')} value={p.tones ?? {}} rows={3} onCommit={(v) => set({ tones: v as StageDef['tones'] })} />
      <JsonField label={t('node.sceneFields')} value={p.sceneFields ?? []} rows={3} onCommit={(v) => set({ sceneFields: v as StageDef['sceneFields'] })} />
    </>
  );
};

/** The form for one block; the Blocks node shows it for the selected entry. */
const BlockEditor: React.FC<{ block: BlockDef; onChange: (patch: Partial<BlockDef>) => void }> = ({ block: p, onChange: set }) => {
  const t = useT();
  const doc = p.doc ?? { example: '', when: '' };
  return (
    <>
      <Identity id={p.id ?? ''} name={p.name ?? ''} onChange={set} />
      <div className="nc-kv"><span className="nc-k">{t('node.when')}</span></div>
      <textarea className={`nc-textarea ${stopFlow}`} rows={3} value={doc.when} onChange={(e) => set({ doc: { ...doc, when: e.target.value } })} />
      <JsonField label={t('node.props')} value={p.props ?? {}} onCommit={(v) => set({ props: v as BlockDef['props'] })} />
      <div className="nc-kv"><span className="nc-k">{t('node.example')}</span></div>
      <textarea className={`nc-textarea nc-code ${stopFlow}`} rows={2} value={doc.example} spellCheck={false} onChange={(e) => set({ doc: { ...doc, example: e.target.value } })} />
    </>
  );
};

/** A catalogue: one row per block, the selected one open for editing; add, duplicate, remove. */
export const BlocksBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<BlockSet>(nodeId);
  const stage = useStageFor(nodeId);
  const openCode = useStudio((s) => s.setCodeEditor);
  const list = p.blocks ?? [];
  const [open, setOpen] = React.useState<number | null>(null);
  const update = (i: number, patch: Partial<BlockDef>) => set({ blocks: list.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const fresh = (base: BlockDef, suffix: string): BlockDef => ({ ...structuredClone(base), id: `${base.id}-${suffix}`.slice(0, 60), name: `${base.name} copy` });
  const add = () => { const b = fresh(list[list.length - 1] ?? DEFAULT_TEXT_CARD, (list.length + 1).toString()); set({ blocks: [...list, b] }); setOpen(list.length); };
  const duplicate = (i: number) => { const b = fresh(list[i]!, 'copy'); set({ blocks: [...list.slice(0, i + 1), b, ...list.slice(i + 1)] }); setOpen(i + 1); };
  const remove = (i: number) => { set({ blocks: list.filter((_, j) => j !== i) }); setOpen(null); };
  return (
    <>
      {list.map((b, i) => (
        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(open === i ? null : i)}>
            {BlockDefSchemaOk(b) ? <LookPreview options={{ stage, block: b }} style={{ width: 36, flex: 'none' }} /> : <div style={{ width: 36, aspectRatio: '9 / 16', background: '#000' }} />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="nc-k" style={{ color: open === i ? 'var(--accent-2)' : undefined }}>{open === i ? '▾' : '▸'} {b.id}</div>
              <div className="nc-v nc-dim" style={{ textAlign: 'left' }}>{b.name} · {Object.keys(b.props ?? {}).length} {t('node.props')}</div>
            </div>
          </div>
          {open === i && (
            <>
              {BlockDefSchemaOk(b) ? <LookPreview options={{ stage, block: b }} onClick={() => openCode({ nodeId, blockIndex: i })} style={{ cursor: 'pointer' }} /> : null}
              <button className={`nc-btn nc-btn-sm ${stopFlow}`} style={{ justifyContent: 'center' }} onClick={() => openCode({ nodeId, blockIndex: i })}>{t('node.editCode')}</button>
              <BlockEditor block={b} onChange={(patch) => update(i, patch)} />
              <div style={{ display: 'flex', gap: 4 }}>
                <button className={`nc-chip ${stopFlow}`} onClick={() => duplicate(i)}>{t('node.duplicate')}</button>
                <button className={`nc-chip ${stopFlow}`} disabled={list.length <= 1} onClick={() => remove(i)}>{t('node.removeBlock')}</button>
              </div>
            </>
          )}
        </div>
      ))}
      <button className={`nc-chip ${stopFlow}`} style={{ alignSelf: 'flex-start' }} onClick={add}>+ {t('node.addBlock')}</button>
    </>
  );
};
