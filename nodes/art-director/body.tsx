'use client';
import React from 'react';
import { BlockDefSchema, CoverDefSchema, StageDefSchema, type BlockDef, type CoverDef, type LookDef, type StageDef } from '@/core/types/payloads';
import type { Casting } from '@/nodes/art-director/cast';

const BlockDefSchemaOk = (b: unknown): b is BlockDef => BlockDefSchema.safeParse(b).success;
import { Kv, useT, stopFlow } from '@/components/ui';
import { useStudio } from '@/store/useStudio';
import { DEFAULT_BLOCK as DEFAULT_TEXT_CARD } from '@/nodes/art-director/blocks';
import { DEFAULT_STAGE } from '@/nodes/art-director/node';
import { coverAsBlock, coverStage } from '@/core/look/cover';
import { LookPreview } from '@/nodes/art-director/preview';
import { FRAME_PRESETS, frameOf } from '@/core/look/frame';
import { FontsEditor, PaletteEditor, PropsEditor, Section, TonesEditor, VarsEditor } from '@/nodes/art-director/forms';
import { CoverFields } from '@/nodes/cover-fields';

/**
 * The roles the script upstream will send, read from that node's parameters (the screenwriter's beats or
 * the static script's scenes) so the casting table can be filled before anything has run.
 */
export function useUpstreamRoles(nodeId: string): string[] {
  const graph = useStudio((s) => s.graph);
  return React.useMemo(() => {
    const edge = graph.edges.find((e) => e.target === nodeId && e.targetPort === 'scenes');
    const params = graph.nodes.find((n) => n.id === edge?.source)?.params as { beats?: { role: string }[]; scenes?: { role: string }[] } | undefined;
    const roles = (params?.beats ?? params?.scenes ?? []).map((x) => x.role).filter(Boolean);
    return [...new Set(roles)];
  }, [graph, nodeId]);
}

/** The frame the workflow renders at (the assembler's width × height), for every preview. */
export function useFrame(): { width: number; height: number } {
  const nodes = useStudio((s) => s.graph.nodes);
  return React.useMemo(() => frameOf({ nodes }), [nodes]);
}

/**
 * Bodies for the Art Director node. Their parameters are the whole definition, so the body is a
 * small form over the parts a person edits by hand: identity, the code, and — for a block — what the
 * model may write and when to use it. The blocks section shows the catalogue as a list and edits one
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

export const ArtDirectorBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<LookDef & { casting: Casting }>(nodeId);
  const roles = useUpstreamRoles(nodeId);
  const tokens = p.tokens ?? { palette: {}, fonts: {} };
  const frame = p.frame ?? { width: 1080, height: 1920 };
  const [open, setOpen] = React.useState<'palette' | 'fonts' | 'tones' | 'vars' | 'blocks' | 'covers' | 'casting' | null>(null);
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
      <Kv k={t('node.transition')} v={
        <span style={{ display: 'flex', gap: 4 }}>
          {/* Leaving a cut carries no length worth keeping: while the type was `cut` the seconds
              beside it did nothing, so a stage that happened to store 0.1 would hand the person a
              three-frame fade — which looks exactly like the cut they just left. */}
          <select className={`nc-select ${stopFlow}`} value={p.transition?.type ?? 'fade'} onChange={(e) => set({ transition: { type: e.target.value as 'cut' | 'fade' | 'slide' | 'zoom', seconds: p.transition?.type === 'cut' ? 0.4 : p.transition?.seconds ?? 0.4 } })}>
            {(['cut', 'fade', 'slide', 'zoom'] as const).map((k) => <option key={k} value={k}>{t(`node.transition.${k}`)}</option>)}
          </select>
          {(p.transition?.type ?? 'fade') !== 'cut' && <input className={`nc-input ${stopFlow}`} style={{ width: 52 }} type="number" min={0.1} max={2} step={0.1} value={p.transition?.seconds ?? 0.4} title="s" onChange={(e) => set({ transition: { type: p.transition?.type ?? 'fade', seconds: Math.min(2, Math.max(0.1, Number(e.target.value) || 0.4)) } })} />}
        </span>
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
      <Section title={t('look.vars')} count={Object.keys(p.vars ?? {}).length} open={open === 'vars'} onToggle={() => setOpen(open === 'vars' ? null : 'vars')}>
        <div className="nc-hint">{t('look.varsHint')}</div>
        <VarsEditor vars={p.vars ?? {}} onChange={(vars) => set({ vars })} />
      </Section>
      <Section title={t('node.blocksSection')} count={(p.blocks ?? []).length} open={open === 'blocks'} onToggle={() => setOpen(open === 'blocks' ? null : 'blocks')}>
        <div className="nc-hint">{t('look.blocksHint')}</div>
        <BlocksSection nodeId={nodeId} stage={valid.success ? valid.data : DEFAULT_STAGE} />
      </Section>
      <Section title={t('look.covers')} count={(p.covers ?? []).length} open={open === 'covers'} onToggle={() => setOpen(open === 'covers' ? null : 'covers')}>
        <div className="nc-hint">{t('look.coversHint')}</div>
        <CoversSection nodeId={nodeId} stage={valid.success ? valid.data : DEFAULT_STAGE} />
      </Section>
      <Section title={t('look.casting')} count={(p.casting ?? []).filter((c) => c.block || c.tone).length} open={open === 'casting'} onToggle={() => setOpen(open === 'casting' ? null : 'casting')}>
        <div className="nc-hint">{t('look.castingHint')}</div>
        <CastingTable roles={roles} casting={p.casting ?? []} blocks={(p.blocks ?? []).map((b) => b.id)} tones={Object.keys(p.tones ?? {})} onChange={(casting) => set({ casting })} />
      </Section>
    </>
  );
};

/**
 * Who plays which role: one row per role the script sends, a block (or "by content") and a tone.
 * Roles that are cast but no longer upstream stay listed, dimmed, so a choice is never lost silently.
 */
const CastingTable: React.FC<{ roles: string[]; casting: Casting; blocks: string[]; tones: string[]; onChange: (c: Casting) => void }> = ({ roles, casting, blocks, tones, onChange }) => {
  const t = useT();
  const all = [...roles, ...casting.map((c) => c.role).filter((r) => !roles.includes(r))];
  const entry = (role: string) => casting.find((c) => c.role === role);
  const update = (role: string, patch: { block?: string; tone?: string }) => {
    const cur = entry(role) ?? { role };
    const next = { ...cur, ...patch };
    if (!next.block) delete next.block;
    if (!next.tone) delete next.tone;
    const rest = casting.filter((c) => c.role !== role);
    onChange(next.block || next.tone ? [...rest, next] : rest);
  };
  if (all.length === 0) return <div className="nc-hint">{t('look.noRoles')}</div>;
  return (
    <>
      {all.map((role) => {
        const c = entry(role);
        const stale = !roles.includes(role);
        return (
          <div key={role} className="nc-scene-row" title={stale ? t('look.roleGone') : undefined} style={stale ? { opacity: 0.5 } : undefined}>
            <span className="nc-k" style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--tx)' }}>{role}</span>
            <select className={`nc-select ${stopFlow}`} style={{ width: 96 }} value={c?.block ?? ''} onChange={(e) => update(role, { block: e.target.value })}>
              <option value="">{t('look.castAuto')}</option>
              {blocks.map((id) => <option key={id} value={id}>{id}</option>)}
              {c?.block && !blocks.includes(c.block) ? <option value={c.block}>{c.block} !</option> : null}
            </select>
            {tones.length > 0 && (
              <select className={`nc-select ${stopFlow}`} style={{ width: 72 }} value={c?.tone ?? ''} onChange={(e) => update(role, { tone: e.target.value })}>
                <option value="">{t('node.toneBase')}</option>
                {tones.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            )}
          </div>
        );
      })}
    </>
  );
};

/** The form for one block; the blocks section shows it for the selected entry. */
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

/** The form for one cover: what it is called, what shape it is, and what a person fills in. */
const CoverEditor: React.FC<{ cover: CoverDef; onChange: (patch: Partial<CoverDef>) => void }> = ({ cover: p, onChange: set }) => {
  const t = useT();
  const [propsOpen, setPropsOpen] = React.useState(false);
  const [defaultsOpen, setDefaultsOpen] = React.useState(false);
  const preset = FRAME_PRESETS.find((f) => f.width === p.frame?.width && f.height === p.frame?.height);
  return (
    <>
      <Identity id={p.id ?? ''} name={p.name ?? ''} onChange={set} />
      {/* A cover picks its own shape, and that is the whole reason it is not a block: a 16:9 film
          still wants a 9:16 cover, because that is what a feed shows beside every portrait video. */}
      <Kv k={t('node.frame')} v={
        <select className={`nc-select ${stopFlow}`} value={preset?.id ?? ''} onChange={(e) => { const f = FRAME_PRESETS.find((x) => x.id === e.target.value); if (f) set({ frame: { width: f.width, height: f.height } }); }}>
          {!preset && <option value="">{p.frame ? `${p.frame.width}×${p.frame.height}` : '—'}</option>}
          {FRAME_PRESETS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      } />
      <Section title={t('node.props')} count={Object.keys(p.props ?? {}).length} open={propsOpen} onToggle={() => setPropsOpen(!propsOpen)}>
        <div className="nc-hint">{t('look.coverPropsHint')}</div>
        <PropsEditor props={p.props ?? {}} onChange={(props) => set({ props })} />
      </Section>
      {/* The cover is finished here, ground and all, and the Cover Image node only swaps one of
          these for one export. Designed with nothing in it, it renders as a black rectangle. */}
      <Section title={t('look.coverDefaults')} count={Object.keys(p.defaults ?? {}).length} open={defaultsOpen} onToggle={() => setDefaultsOpen(!defaultsOpen)}>
        <CoverFields
          cover={p}
          values={p.defaults ?? {}}
          placeholderHint={t('look.coverDefaultsHint')}
          onChange={(name, v) => {
            const next = { ...(p.defaults ?? {}) };
            if (v === undefined || v === '') delete next[name];
            else next[name] = v;
            set({ defaults: next });
          }}
        />
      </Section>
    </>
  );
};

const DEFAULT_COVER: CoverDef = {
  id: 'cover',
  name: 'Cover',
  frame: { width: 1080, height: 1920 },
  props: { title: { type: 'text', required: true, max: 90 } },
  code: {
    format: 'html-gsap',
    source: [
      '<div class="cv"><div class="cv-title" data-prop="title"></div></div>',
      '<style>',
      '  .cv { position: absolute; inset: 0; }',
      '  .cv-title { position: absolute; left: 220px; right: 220px; top: 50%; transform: translateY(-50%); text-align: center; font: 700 58px/1.35 var(--font-body); color: #fff; -webkit-text-stroke: .14em rgba(0,0,0,.92); paint-order: stroke fill; }',
      '</style>',
    ].join('\n'),
  },
};

/**
 * The covers a look carries: one row each, the selected one open for editing.
 *
 * Mirrors the block catalogue, and the previews go through the same `LookPreview` — a cover is
 * block-shaped once you hand it its own bare stage, so nothing here needed a second renderer. The
 * one thing that differs is that each preview is drawn at **that cover's** frame rather than the
 * video's, which is what makes a portrait cover next to a landscape film readable at a glance.
 */
const CoversSection: React.FC<BodyProps & { stage: StageDef }> = ({ nodeId, stage }) => {
  const t = useT();
  const [p, set] = useParams<Pick<LookDef, 'covers'>>(nodeId);
  const openCode = useStudio((s) => s.setCodeEditor);
  const list = p.covers ?? [];
  const [open, setOpen] = React.useState<number | null>(null);
  const update = (i: number, patch: Partial<CoverDef>) => set({ covers: list.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const fresh = (base: CoverDef, name: string): CoverDef => ({ ...structuredClone(base), id: slugFor(name, list.map((c) => c.id)), name });
  const add = () => { const c = fresh(list[list.length - 1] ?? DEFAULT_COVER, `Cover ${list.length + 1}`); set({ covers: [...list, c] }); setOpen(list.length); };
  const remove = (i: number) => { set({ covers: list.filter((_, j) => j !== i) }); setOpen(null); };
  const ok = (c: CoverDef) => CoverDefSchema.safeParse(c).success;
  return (
    <>
      {list.map((c, i) => (
        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(open === i ? null : i)}>
            {ok(c) ? <LookPreview options={{ stage: coverStage(stage, c), block: coverAsBlock(c), ...c.frame }} style={{ width: 36, flex: 'none' }} /> : <div style={{ width: 36, aspectRatio: '9 / 16', background: '#000' }} />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="nc-k" style={{ color: open === i ? 'var(--accent-2)' : undefined }}>{open === i ? '▾' : '▸'} {c.id}</div>
              <div className="nc-v nc-dim" style={{ textAlign: 'left' }}>{c.name} · {c.frame?.width}×{c.frame?.height}</div>
            </div>
          </div>
          {open === i && (
            <>
              {ok(c) ? <LookPreview options={{ stage: coverStage(stage, c), block: coverAsBlock(c), ...c.frame }} onClick={() => openCode({ nodeId, coverIndex: i })} style={{ cursor: 'pointer' }} /> : null}
              <button className={`nc-btn nc-btn-sm ${stopFlow}`} style={{ justifyContent: 'center' }} onClick={() => openCode({ nodeId, coverIndex: i })}>{t('node.editCode')}</button>
              <CoverEditor cover={c} onChange={(patch) => update(i, patch)} />
              <button className={`nc-chip ${stopFlow}`} onClick={() => remove(i)}>{t('node.removeCover')}</button>
            </>
          )}
        </div>
      ))}
      <button className={`nc-chip ${stopFlow}`} style={{ alignSelf: 'flex-start' }} onClick={add}>+ {t('node.addCover')}</button>
    </>
  );
};

/** The block catalogue of a stage: one row per block, the selected one open for editing; add, duplicate, remove. */
const BlocksSection: React.FC<BodyProps & { stage: StageDef }> = ({ nodeId, stage }) => {
  const t = useT();
  const [p, set] = useParams<Pick<LookDef, 'blocks'>>(nodeId);
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
