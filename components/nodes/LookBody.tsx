'use client';
import React from 'react';
import { BlockDefSchema, StageDefSchema, type BlockDef, type StageDef } from '@/core/types/payloads';
import { Kv, useT, stopFlow } from '@/components/ui';
import { useStudio } from '@/store/useStudio';

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
    const blocks = paramsOf('blocks').map((p) => BlockDefSchema.safeParse(p)).filter((r) => r.success).map((r) => r.data!);
    return { stage, blocks };
  }, [graph, nodeId]);
}

/**
 * Bodies for the Stage and Block nodes. Their parameters are the whole definition, so the body is a
 * small form over the parts a person edits by hand: identity, the code, and — for a block — what the
 * model may write and when to use it. Structured parts (props, tones, scene fields) are edited as
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

const CodeField: React.FC<{ source: string; onChange: (source: string) => void }> = ({ source, onChange }) => {
  const t = useT();
  return (
    <>
      <div className="nc-kv"><span className="nc-k">{t('node.code')}</span><span className="nc-v nc-dim">html-gsap · {t('node.chars', { n: source.length })}</span></div>
      <textarea className={`nc-textarea nc-code ${stopFlow}`} rows={8} value={source} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
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
  return (
    <>
      <Identity id={p.id ?? ''} name={p.name ?? ''} onChange={set} />
      <JsonField label={t('node.tokens')} value={p.tokens ?? {}} onCommit={(v) => set({ tokens: v as StageDef['tokens'] })} />
      <JsonField label={t('node.tones')} value={p.tones ?? {}} rows={3} onCommit={(v) => set({ tones: v as StageDef['tones'] })} />
      <JsonField label={t('node.sceneFields')} value={p.sceneFields ?? []} rows={3} onCommit={(v) => set({ sceneFields: v as StageDef['sceneFields'] })} />
      <CodeField source={p.code?.source ?? ''} onChange={(source) => set({ code: { format: 'html-gsap', source } })} />
    </>
  );
};

export const BlockBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<BlockDef>(nodeId);
  const doc = p.doc ?? { example: '', when: '' };
  return (
    <>
      <Identity id={p.id ?? ''} name={p.name ?? ''} onChange={set} />
      <div className="nc-kv"><span className="nc-k">{t('node.when')}</span></div>
      <textarea className={`nc-textarea ${stopFlow}`} rows={3} value={doc.when} onChange={(e) => set({ doc: { ...doc, when: e.target.value } })} />
      <JsonField label={t('node.props')} value={p.props ?? {}} onCommit={(v) => set({ props: v as BlockDef['props'] })} />
      <div className="nc-kv"><span className="nc-k">{t('node.example')}</span></div>
      <textarea className={`nc-textarea nc-code ${stopFlow}`} rows={2} value={doc.example} spellCheck={false} onChange={(e) => set({ doc: { ...doc, example: e.target.value } })} />
      <CodeField source={p.code?.source ?? ''} onChange={(source) => set({ code: { format: 'html-gsap', source } })} />
    </>
  );
};
