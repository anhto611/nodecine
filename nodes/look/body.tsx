'use client';
import React from 'react';
import { BlockDefSchema, BlockSetSchema, StageDefSchema, type BlockDef, type BlockSet, type StageDef } from '@/core/types/payloads';

const BlockDefSchemaOk = (b: unknown): b is BlockDef => BlockDefSchema.safeParse(b).success;
import { Kv, useT, stopFlow } from '@/components/ui';
import { useStudio } from '@/store/useStudio';
import { DEFAULT_BLOCK as DEFAULT_TEXT_CARD } from '@/nodes/look/blocks';
import { DEFAULT_STAGE } from '@/nodes/look/stage';
import { LookPreview } from '@/nodes/look/preview';
import { FRAME_PRESETS, frameOf } from '@/core/look/frame';
import { FontsEditor, PaletteEditor, PropsEditor, Section, TonesEditor } from '@/nodes/look/forms';

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

/** The frame the workflow renders at (the assembler's width × height), for every preview. */
export function useFrame(): { width: number; height: number } {
  const nodes = useStudio((s) => s.graph.nodes);
  return React.useMemo(() => frameOf({ nodes }), [nodes]);
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
 * block at a time. Structured parts (palette, fonts, tones, scene fields, props) have form editors
 * in `forms.tsx`; the Zod schema on the node is the last line of defence, not the interface.
 */
type BodyProps = { nodeId: string };

function useParams<T extends Record<string, unknown>>(nodeId: string): [T, (patch: Partial<T>) => void] {
  const node = useStudio((s) => s.graph.nodes.find((n) => n.id === nodeId));
  const setParams = useStudio((s) => s.setParams);
  return [(node?.params ?? {}) as T, (patch) => setParams(nodeId, patch as Record<string, unknown>)];
}

/**
 * The name is the user's; the id is generated once, when the stage or block is created, and never
 * edited — beats, plans, the IR and the logs all point at it, and a stable id is what keeps those
 * pointers true. It is shown dimmed so it can be recognised where it appears.
 */
const Identity: React.FC<{ id?: string; name: string; onChange: (patch: { name?: string }) => void }> = ({ id, name, onChange }) => {
  const t = useT();
  return (
    <Kv k={t('node.name')} v={
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
        <input className={`nc-input ${stopFlow}`} style={{ flex: 1, minWidth: 0 }} value={name} onChange={(e) => onChange({ name: e.target.value })} />
        {id && <span className="nc-k" style={{ flex: 'none' }} title={t('node.idHint')}>#{id}</span>}
      </span>
    } />
  );
};

/** `Text card` → `text-card`, unique among `taken`. */
export function slugFor(name: string, taken: string[]): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'block';
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}

export const StageBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<StageDef>(nodeId);
  const tokens = p.tokens ?? { palette: {}, fonts: {} };
  const frame = p.frame ?? { width: 1080, height: 1920 };
  const [open, setOpen] = React.useState<'palette' | 'fonts' | 'tones' | null>(null);
  const openCode = useStudio((s) => s.setCodeEditor);
  const valid = StageDefSchema.safeParse(p);
  return (
    <>
      {valid.success ? <LookPreview options={{ stage: valid.data, ...frame }} onClick={() => openCode({ nodeId })} style={{ cursor: 'pointer' }} /> : null}
      <button className={`nc-btn nc-btn-sm ${stopFlow}`} style={{ justifyContent: 'center' }} onClick={() => openCode({ nodeId })}>{t('node.editCode')}</button>
      <Identity name={p.name ?? ''} onChange={set} />
      <Kv k={t('node.frame')} v={
        <select className={`nc-select ${stopFlow}`} value={FRAME_PRESETS.find((f) => f.width === frame.width && f.height === frame.height)?.id ?? 'custom'} onChange={(e) => { const f = FRAME_PRESETS.find((x) => x.id === e.target.value); if (f) set({ frame: { width: f.width, height: f.height } }); }}>
          {FRAME_PRESETS.map((f) => <option key={f.id} value={f.id} title={`${f.width}×${f.height}`}>{f.label}</option>)}
          {!FRAME_PRESETS.some((f) => f.width === frame.width && f.height === frame.height) && <option value="custom" disabled>{frame.width}×{frame.height}</option>}
        </select>
      } />
      <Section title={t('look.palette')} count={Object.keys(tokens.palette).length} open={open === 'palette'} onToggle={() => setOpen(open === 'palette' ? null : 'palette')}>
        <PaletteEditor palette={tokens.palette} code={p.code?.source ?? ''} onChange={(palette) => set({ tokens: { ...tokens, palette } })} />
      </Section>
      <Section title={t('look.fonts')} count={Object.keys(tokens.fonts).length} open={open === 'fonts'} onToggle={() => setOpen(open === 'fonts' ? null : 'fonts')}>
        <FontsEditor fonts={tokens.fonts} onChange={(fonts) => set({ tokens: { ...tokens, fonts } })} />
      </Section>
      <Section title={t('node.tones')} count={Object.keys(p.tones ?? {}).length} open={open === 'tones'} onToggle={() => setOpen(open === 'tones' ? null : 'tones')}>
        <div className="nc-hint">{t('look.tonesHint')}</div>
        <TonesEditor tones={p.tones ?? {}} palette={tokens.palette} onChange={(tones) => set({ tones })} />
      </Section>
    </>
  );
};

/** The form for one block; the Blocks node shows it for the selected entry. */
const BlockEditor: React.FC<{ block: BlockDef; onChange: (patch: Partial<BlockDef>) => void }> = ({ block: p, onChange: set }) => {
  const t = useT();
  const [propsOpen, setPropsOpen] = React.useState(false);
  const doc = p.doc ?? { example: '', when: '' };
  return (
    <>
      <Identity id={p.id ?? ''} name={p.name ?? ''} onChange={set} />
      <div className="nc-kv"><span className="nc-k">{t('node.when')}</span></div>
      <textarea className={`nc-textarea ${stopFlow}`} rows={3} value={doc.when} onChange={(e) => set({ doc: { ...doc, when: e.target.value } })} />
      <Section title={t('node.props')} count={Object.keys(p.props ?? {}).length} open={propsOpen} onToggle={() => setPropsOpen(!propsOpen)}>
        <div className="nc-hint">{t('look.propsHint')}</div>
        <PropsEditor props={p.props ?? {}} onChange={(props) => set({ props })} />
      </Section>
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
  const frame = useFrame();
  const openCode = useStudio((s) => s.setCodeEditor);
  const list = p.blocks ?? [];
  const [open, setOpen] = React.useState<number | null>(null);
  const update = (i: number, patch: Partial<BlockDef>) => set({ blocks: list.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const fresh = (base: BlockDef, name: string): BlockDef => ({ ...structuredClone(base), id: slugFor(name, list.map((b) => b.id)), name });
  const add = () => { const b = fresh(list[list.length - 1] ?? DEFAULT_TEXT_CARD, `Block ${list.length + 1}`); set({ blocks: [...list, b] }); setOpen(list.length); };
  const duplicate = (i: number) => { const b = fresh(list[i]!, `${list[i]!.name} copy`); set({ blocks: [...list.slice(0, i + 1), b, ...list.slice(i + 1)] }); setOpen(i + 1); };
  const remove = (i: number) => { set({ blocks: list.filter((_, j) => j !== i) }); setOpen(null); };
  return (
    <>
      {list.map((b, i) => (
        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(open === i ? null : i)}>
            {BlockDefSchemaOk(b) ? <LookPreview options={{ stage, block: b, ...frame }} style={{ width: 36, flex: 'none' }} /> : <div style={{ width: 36, aspectRatio: `${frame.width} / ${frame.height}`, background: '#000' }} />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="nc-k" style={{ color: open === i ? 'var(--accent-2)' : undefined }}>{open === i ? '▾' : '▸'} {b.id}</div>
              <div className="nc-v nc-dim" style={{ textAlign: 'left' }}>{b.name} · {Object.keys(b.props ?? {}).length} {t('node.props')}</div>
            </div>
          </div>
          {open === i && (
            <>
              {BlockDefSchemaOk(b) ? <LookPreview options={{ stage, block: b, ...frame }} onClick={() => openCode({ nodeId, blockIndex: i })} style={{ cursor: 'pointer' }} /> : null}
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
