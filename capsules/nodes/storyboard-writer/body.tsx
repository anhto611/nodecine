'use client';
import React from 'react';
import { Btn, Kv, useT, stopFlow } from '@/capsules/sdk/ui';
import { useGraph, useInputPayload, useLocale, useOutputPayload, useParams, useRun, useRuntime, type BodyProps } from '@/capsules/sdk/host';
import { FormBody } from '@/capsules/sdk/form-body';
import { ProviderPick } from '@/capsules/sdk/pickers';
import { labelOf, readBlockCatalog, type BlockInfo, type BlockVariable } from '@/contracts/storyboard/blocks';
import { cueWord } from '@/contracts/storyboard/validate';
import { assetProjectPath, type Assets } from '@/contracts/types/assets';
import type { Composition } from '@/contracts/types/composition';
import type { Storyboard } from '@/contracts/types/storyboard';
import { layerEditKey, type FrameEdit, type WrittenStoryboard } from './output';
import { OUTPUT_LANGUAGES, resolveOutputLanguage } from '@/contracts/text/languages';
import type { Brief } from '@/contracts/types/brief';
import { DURATIONS, TONES } from './node';

type Params = { tone: (typeof TONES)[number]; subject: string; attempt: number; rewrites: Record<string, number>; edits: Record<string, FrameEdit> };
interface Scene {
  title: string;
  voiceover: string;
  block: string;
  values: Record<string, unknown>;
  mounts: { component: string; slot: string; at?: string; until?: string }[];
}

/** A value that names a moment: `@word`, set by picking a word the scene says. */
const isCue = (v: BlockVariable, value: unknown) => (typeof value === 'string' && value.trim().startsWith('@')) || (v.type === 'number' && /(_at|At|_start)$/.test(v.id));

/** The words a scene says, each a chip that sets the moment to itself. */
const WordPick: React.FC<{ id: string; words: string[]; value: unknown; onPick: (word: string) => void }> = ({ id, words, value, onPick }) => {
  const picked = typeof value === 'string' ? value.split(',').map((v) => cueWord(v.trim().replace(/^@/, ''))) : [];
  return (
    <div id={id} role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {words.map((word, i) => {
        const on = picked.includes(cueWord(word));
        return (
          <button key={`${word}-${i}`} className={`nc-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onPick(cueWord(word))}>
            {word}
          </button>
        );
      })}
    </div>
  );
};

/** One value of a scene, with the control its declared type calls for. */
type PictureChoice = { path: string; url: string };

const ValueField: React.FC<{ id: string; variable: BlockVariable; value: unknown; words: string[]; pictures: PictureChoice[]; onChange: (value: unknown) => void }> = ({
  id,
  variable,
  value,
  words,
  pictures,
  onChange,
}) => {
  const t = useT();
  const locale = useLocale();
  const label = (
    <label htmlFor={id}>
      {labelOf(variable, locale)}
      {variable.required ? ' *' : ''}
      {variable.type === 'string' && variable.maxLength && typeof value === 'string' && (
        <span style={{ marginLeft: 6, color: value.length > variable.maxLength ? 'var(--err)' : undefined }}>
          {value.length}/{variable.maxLength}
        </span>
      )}
    </label>
  );
  let control: React.ReactNode;
  // A row of words, pictures or list items does not fit beside its label: it goes under it.
  let wide = false;
  if (isCue(variable, value)) {
    wide = true;
    control = <WordPick id={id} words={words} value={value} onPick={(word) => onChange(`@${word}`)} />;
  } else if (variable.type === 'enum') {
    control = (
      <select id={id} className="nc-select" value={String(value ?? variable.default)} onChange={(e) => onChange(e.target.value)}>
        {variable.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (variable.type === 'boolean') {
    control = <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
  } else if (variable.type === 'image') {
    wide = true;
    // Pictures are chosen by sight: their names are the storyboard's, not the person's.
    const chosen = typeof value === 'string' ? value : '';
    const tile = (on: boolean): React.CSSProperties => ({
      width: 44,
      height: 64,
      padding: 0,
      borderRadius: 4,
      overflow: 'hidden',
      cursor: 'pointer',
      background: 'var(--bg-2, #0002)',
      border: `2px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
      flex: 'none',
    });
    control = (
      <div id={id} role="radiogroup" style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
        <button
          type="button"
          role="radio"
          aria-checked={!chosen}
          title={t('node.writerNoPicture')}
          style={{ ...tile(!chosen), fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}
          onClick={() => onChange('')}
        >
          —
        </button>
        {pictures.map((p, i) => (
          <button key={p.path} type="button" role="radio" aria-checked={chosen === p.path} aria-label={`${i + 1}`} style={tile(chosen === p.path)} onClick={() => onChange(p.path)}>
            <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
          </button>
        ))}
      </div>
    );
  } else if (Array.isArray(value)) {
    wide = true;
    // A list the block reads as JSON (effects): its words are editable, its layout is the writer's.
    control = (
      <div id={id} style={{ display: 'grid', gap: 4 }}>
        {value.map((item, i) => {
          const entry = item as Record<string, unknown>;
          return (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span className="nc-chip" style={{ flex: 'none' }}>
                {String(entry.type ?? '')}
              </span>
              {typeof entry.text === 'string' ? (
                <input
                  aria-label={`${variable.label} ${i + 1}`}
                  className="nc-input"
                  style={{ flex: 1 }}
                  value={entry.text}
                  onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...(x as object), text: e.target.value } : x)))}
                />
              ) : (
                <span className="nc-hint" style={{ flex: 1 }}>
                  {String(entry.target ?? '')}
                </span>
              )}
              <button className="nc-chip" aria-label={t('node.writerRemove')} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          );
        })}
      </div>
    );
  } else if (variable.type === 'number') {
    control = (
      <input id={id} type="number" className="nc-input" value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
    );
  } else {
    control = <input id={id} className="nc-input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  }
  return <Kv wide={wide} k={label} v={control} />;
};

/**
 * The storyboard as scenes a person can read and change: what each says, the block it plays, and
 * that block's values as plain controls. Edits are kept apart from what the model wrote and applied
 * on the next run; a scene can be rewritten on its own, the whole storyboard written again.
 */
export const StoryboardWriterBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<Params>(nodeId);
  const { running, runNode } = useRun();
  const runtime = useRuntime(nodeId);
  const storyboard = useOutputPayload<Storyboard>(nodeId, 'storyboard');
  const composition = useInputPayload<Composition>(nodeId, 'composition');
  const assets = useInputPayload<Assets>(nodeId, 'assets');
  const catalog = React.useMemo(() => new Map((composition ? readBlockCatalog(composition.files) : []).map((b) => [b.name, b] as const)), [composition]);
  const pictures = React.useMemo(() => (assets?.items ?? []).map((a) => ({ path: assetProjectPath(a), url: a.url })), [assets]);
  const edits = p.edits ?? {};
  const rewrites = p.rewrites ?? {};
  const locale = useLocale();
  const graph = useGraph();
  const briefPayload = useInputPayload<Brief>(nodeId, 'brief');
  const briefWire = graph.edges.find((e) => e.target === nodeId && e.targetPort === 'brief');
  const briefAbout = (graph.nodes.find((n) => n.id === briefWire?.source)?.params as { about?: unknown } | undefined)?.about;
  const briefLanguage = resolveOutputLanguage('auto', typeof briefAbout === 'string' ? briefAbout : (briefPayload?.about ?? ''));
  // Language names are only shown in the interface's language; which language the narration is in is this node's.
  const nameOf = React.useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      names = null;
    }
    return (code: string) => {
      try {
        return names?.of(code) ?? code;
      } catch {
        return code;
      }
    };
  }, [locale]);

  const failure = runtime?.state === 'error' ? runtime.error : undefined;
  const draft = failure?.details as { written?: WrittenStoryboard; problems?: string[] } | undefined;
  const scenes: Scene[] = draft?.written
    ? draft.written.frames.map((f) => ({
        title: f.title,
        voiceover: f.voiceover ?? '',
        block: f.block,
        values: f.values,
        mounts: (f.mounts ?? []).map((m) => ({ component: m.component, slot: m.slot, at: m.at ?? undefined, until: m.until ?? undefined })),
      }))
    : (storyboard?.frames ?? []).map((f) => ({
        title: f.title,
        voiceover: f.voiceover ?? '',
        block: f.block ?? '',
        values: f.values,
        mounts: f.mounts.map((m) => ({
          component: m.component,
          slot: typeof m.box === 'string' ? m.box : m.box.join(','),
          at: typeof m.at === 'string' ? m.at : undefined,
          until: typeof m.until === 'string' ? m.until : undefined,
        })),
      }));
  const problemsOf = (i: number) => (draft?.problems ?? []).filter((m) => m.startsWith(`frame ${i + 1}:`) || m.startsWith(`frame ${i + 1},`));
  // Layers: an overlay block over a run of scenes, shown after them with the scenes they cover.
  const layers = draft?.written
    ? (draft.written.layers ?? []).map((l) => ({ title: l.title, block: l.block, from: l.from_frame, to: l.to_frame, values: l.values }))
    : (storyboard?.layers ?? []).map((l) => ({ title: l.title, block: l.block, from: l.from, to: l.to, values: l.values }));
  const layerProblemsOf = (i: number) => (draft?.problems ?? []).filter((m) => m.startsWith(`layer ${i + 1}:`) || m.startsWith(`layer ${i + 1},`));

  const edit = (i: number | string, patch: FrameEdit) => {
    const key = String(i);
    const current = edits[key] ?? {};
    set({ edits: { ...edits, [key]: { ...current, ...patch, ...(patch.values ? { values: { ...current.values, ...patch.values } } : {}) } } });
  };
  const rewrite = (i: number) => {
    const { [String(i)]: _dropped, ...rest } = edits;
    set({ rewrites: { ...rewrites, [String(i)]: (rewrites[String(i)] ?? 0) + 1 }, edits: rest });
    setTimeout(() => runNode(nodeId), 0);
  };
  const writeAgain = () => {
    set({ attempt: (p.attempt ?? 0) + 1, rewrites: {}, edits: {}, subject: '' });
    setTimeout(() => runNode(nodeId), 0);
  };
  const pending = Object.keys(edits).length > 0;
  const subject = draft?.written?.subject ?? storyboard?.subject;
  const [subjectDraft, setSubjectDraft] = React.useState<string | null>(null);
  const message = draft?.written?.message ?? storyboard?.message;
  const fid = (field: string) => `${nodeId}-writer-${field}`;

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ProviderPick nodeId={nodeId} kind="llm" />
      <FormBody
        nodeId={nodeId}
        fields={['durationSeconds', 'language', 'tone', 'notes']}
        widgets={{
          durationSeconds: { labelKey: 'node.writerDuration', options: DURATIONS.map((d) => ({ value: d, label: `${d} s` })) },
          language: {
            labelKey: 'node.writerLanguage',
            options: OUTPUT_LANGUAGES.map((l) => ({ value: l, label: l === 'auto' ? t('node.writerLanguageAuto', { lang: nameOf(briefLanguage) }) : nameOf(l) })),
          },
          tone: { labelKey: 'node.writerTone', options: TONES.map((tone) => ({ value: tone, label: t(`node.writerTone.${tone}`) })) },
          notes: { widget: 'textarea', rows: 2, labelKey: 'node.writerNotes' },
        }}
      />
      {/* The storyboard is written by the workflow's Run; here only what reworks one already written. */}
      {(pending || scenes.length > 0) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pending && (
            <Btn small primary disabled={running} onClick={() => runNode(nodeId)}>
              {t('node.writerApply')}
            </Btn>
          )}
          {scenes.length > 0 && (
            <Btn small disabled={running} onClick={writeAgain}>
              {t('node.writerWriteAgain')}
            </Btn>
          )}
        </div>
      )}
      {subject && (
        <div style={{ display: 'grid', gap: 4, fontSize: 'var(--fs-hint)', color: 'var(--tx-2)', lineHeight: 1.5 }}>
          <Kv
            k={<label htmlFor={fid('subject')}>{t('node.writerSubject')}</label>}
            v={<input id={fid('subject')} className="nc-input" maxLength={120} value={subjectDraft ?? subject} onChange={(e) => setSubjectDraft(e.target.value)} />}
          />
          {subjectDraft !== null && subjectDraft.trim() && subjectDraft.trim() !== subject && (
            <Btn
              small
              style={{ justifySelf: 'start' }}
              disabled={running}
              onClick={() => {
                set({ subject: subjectDraft.trim() });
                setSubjectDraft(null);
                setTimeout(() => runNode(nodeId), 0);
              }}
            >
              {t('node.writerRenameEverywhere')}
            </Btn>
          )}
          {message && <div>{message}</div>}
          <div style={{ color: 'var(--tx-3)' }}>{t('node.writerUnderstoodHint')}</div>
        </div>
      )}
      {failure && <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--err)' }}>{t('node.writerProblems', { count: draft?.problems?.length ?? 1 })}</div>}
      {!scenes.length && !failure && <div className="nc-hint">{t('node.writerEmpty')}</div>}

      <div style={{ display: 'grid', gap: 8, maxHeight: 640, overflowY: 'auto' }}>
        {scenes.map((scene, i) => {
          const e = edits[String(i)] ?? {};
          const voiceover = e.voiceover ?? scene.voiceover;
          const values = { ...scene.values, ...(e.values ?? {}) };
          const block: BlockInfo | undefined = catalog.get(scene.block);
          const words = voiceover.split(/\s+/).filter(Boolean);
          const problems = problemsOf(i);
          const fid = (field: string) => `${nodeId}-scene-${i}-${field}`;
          return (
            <div key={i} style={{ display: 'grid', gap: 6, padding: 8, border: `1px solid ${problems.length ? 'var(--err)' : 'var(--line)'}`, borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <b>
                  {i + 1}. {e.title ?? scene.title}
                </b>
                <span className="nc-chip">
                  {scene.block}
                  {block ? ` · ${t(`node.writerRole.${block.role}`)}` : ''}
                </span>
                {e.voiceover !== undefined || e.values ? <span className="nc-hint">{t('node.writerEdited')}</span> : null}
              </div>
              {scene.voiceover || e.voiceover !== undefined ? (
                <Kv
                  wide
                  k={<label htmlFor={fid('voiceover')}>{t('node.writerVoiceover', { words: words.length })}</label>}
                  v={<textarea id={fid('voiceover')} className="nc-textarea" rows={2} value={voiceover} onChange={(ev) => edit(i, { voiceover: ev.target.value })} />}
                />
              ) : (
                <span className="nc-hint">{t('node.writerSilent')}</span>
              )}
              {(block?.variables ?? [])
                .filter((v) => v.id !== 'seconds' && values[v.id] !== undefined)
                .map((v) => (
                  <ValueField key={v.id} id={fid(v.id)} variable={v} value={values[v.id]} words={words} pictures={pictures} onChange={(value) => edit(i, { values: { [v.id]: value } })} />
                ))}
              {scene.mounts.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="nc-hint">{t('node.writerMounts')}</span>
                  {scene.mounts.map((m, k) => (
                    <span key={k} className="nc-chip" title={[m.at && `${m.at}`, m.until && `→ ${m.until}`].filter(Boolean).join(' ')}>
                      {m.component} · {m.slot}
                      {m.at ? ` · ${m.at}` : ''}
                    </span>
                  ))}
                </div>
              )}
              {problems.map((m) => (
                <div key={m} style={{ fontSize: 'var(--fs-hint)', color: 'var(--err)', overflowWrap: 'anywhere' }}>
                  {m}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn small disabled={running} onClick={() => rewrite(i)}>
                  {t('node.writerRewriteScene')}
                </Btn>
                {edits[String(i)] && (
                  <Btn
                    small
                    onClick={() => {
                      const { [String(i)]: _gone, ...rest } = edits;
                      set({ edits: rest });
                    }}
                  >
                    {t('node.writerUndoEdits')}
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
        {layers.map((layer, i) => {
          const key = layerEditKey(i);
          const e = edits[key] ?? {};
          const values = { ...layer.values, ...(e.values ?? {}) };
          const block: BlockInfo | undefined = catalog.get(layer.block);
          const words = scenes.slice(layer.from - 1, layer.to).flatMap((s, k) => (edits[String(layer.from - 1 + k)]?.voiceover ?? s.voiceover).split(/\s+/).filter(Boolean));
          const problems = layerProblemsOf(i);
          const fid = (field: string) => `${nodeId}-layer-${i}-${field}`;
          return (
            <div key={key} style={{ display: 'grid', gap: 6, padding: 8, border: `1px dashed ${problems.length ? 'var(--err)' : 'var(--line)'}`, borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <b>
                  {t('node.writerLayer')} · {e.title ?? layer.title}
                </b>
                <span className="nc-chip">{layer.block}</span>
                <span className="nc-hint">{t('node.writerLayerScenes', { from: layer.from, to: layer.to })}</span>
                {e.values ? <span className="nc-hint">{t('node.writerEdited')}</span> : null}
              </div>
              {(block?.variables ?? [])
                .filter((v) => v.id !== 'seconds' && values[v.id] !== undefined)
                .map((v) => (
                  <ValueField key={v.id} id={fid(v.id)} variable={v} value={values[v.id]} words={words} pictures={pictures} onChange={(value) => edit(key, { values: { [v.id]: value } })} />
                ))}
              {problems.map((m) => (
                <div key={m} style={{ fontSize: 'var(--fs-hint)', color: 'var(--err)', overflowWrap: 'anywhere' }}>
                  {m}
                </div>
              ))}
              {edits[key] && (
                <div>
                  <Btn
                    small
                    onClick={() => {
                      const { [key]: _gone, ...rest } = edits;
                      set({ edits: rest });
                    }}
                  >
                    {t('node.writerUndoEdits')}
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
