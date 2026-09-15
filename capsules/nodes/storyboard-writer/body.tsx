'use client';
import React from 'react';
import { Btn, useT, stopFlow } from '@/capsules/sdk/ui';
import { useInputPayload, useLocale, useOutputPayload, useParams, useRun, useRuntime, type BodyProps } from '@/capsules/sdk/host';
import { ProviderPick } from '@/capsules/sdk/pickers';
import { labelOf, readBlockCatalog, type BlockInfo, type BlockVariable } from '@/contracts/storyboard/blocks';
import { GUIDE_FILE, guideHint, readGuide } from '@/contracts/storyboard/guide';
import { cueWord } from '@/contracts/storyboard/validate';
import { assetProjectPath, type Assets } from '@/contracts/types/assets';
import type { Composition } from '@/contracts/types/composition';
import type { Storyboard } from '@/contracts/types/storyboard';
import { DURATIONS, TONES } from './material';
import type { FrameEdit, WrittenStoryboard } from './output';

type Params = { subject: string; about: string; durationSeconds: number; tone: (typeof TONES)[number]; language: string; notes: string; attempt: number; rewrites: Record<string, number>; edits: Record<string, FrameEdit> };
const LANGUAGES = ['vi', 'en'] as const;
interface Scene { title: string; voiceover: string; block: string; values: Record<string, unknown> }

/** A value that names a moment: `@word`, set by picking a word the scene says. */
const isCue = (v: BlockVariable, value: unknown) => (typeof value === 'string' && value.trim().startsWith('@')) || (v.type === 'number' && /(_at|At|_start)$/.test(v.id));

/** The words a scene says, each a chip that sets the moment to itself. */
const WordPick: React.FC<{ id: string; words: string[]; value: unknown; onPick: (word: string) => void }> = ({ id, words, value, onPick }) => {
  const picked = typeof value === 'string' ? value.split(',').map((v) => cueWord(v.trim().replace(/^@/, ''))) : [];
  return (
    <div id={id} role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {words.map((word, i) => {
        const on = picked.includes(cueWord(word));
        return <button key={`${word}-${i}`} className={`nc-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onPick(cueWord(word))}>{word}</button>;
      })}
    </div>
  );
};

/** One value of a scene, with the control its declared type calls for. */
type PictureChoice = { path: string; url: string };

const ValueField: React.FC<{ id: string; variable: BlockVariable; value: unknown; words: string[]; pictures: PictureChoice[]; onChange: (value: unknown) => void }> = ({ id, variable, value, words, pictures, onChange }) => {
  const t = useT();
  const locale = useLocale();
  const label = (
    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>
      <span>{labelOf(variable, locale)}{variable.required ? ' *' : ''}</span>
      {variable.type === 'string' && variable.maxLength && typeof value === 'string' && <span style={{ color: value.length > variable.maxLength ? 'var(--err)' : undefined }}>{value.length}/{variable.maxLength}</span>}
    </span>
  );
  let control: React.ReactNode;
  if (isCue(variable, value)) {
    control = <WordPick id={id} words={words} value={value} onPick={(word) => onChange(`@${word}`)} />;
  } else if (variable.type === 'enum') {
    control = (
      <select id={id} className="nc-select" value={String(value ?? variable.default)} onChange={(e) => onChange(e.target.value)}>
        {variable.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (variable.type === 'boolean') {
    control = <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
  } else if (variable.type === 'image') {
    // Pictures are chosen by sight: their names are the storyboard's, not the person's.
    const chosen = typeof value === 'string' ? value : '';
    const tile = (on: boolean): React.CSSProperties => ({ width: 44, height: 64, padding: 0, borderRadius: 4, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-2, #0002)', border: `2px solid ${on ? 'var(--accent)' : 'var(--line)'}`, flex: 'none' });
    control = (
      <div id={id} role="radiogroup" style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
        <button type="button" role="radio" aria-checked={!chosen} title={t('node.writerNoPicture')} style={{ ...tile(!chosen), fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }} onClick={() => onChange('')}>—</button>
        {pictures.map((p, i) => (
          <button key={p.path} type="button" role="radio" aria-checked={chosen === p.path} aria-label={`${i + 1}`} style={tile(chosen === p.path)} onClick={() => onChange(p.path)}>
            <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
          </button>
        ))}
      </div>
    );
  } else if (Array.isArray(value)) {
    // A list the block reads as JSON (effects): its words are editable, its layout is the writer's.
    control = (
      <div id={id} style={{ display: 'grid', gap: 4 }}>
        {value.map((item, i) => {
          const entry = item as Record<string, unknown>;
          return (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span className="nc-chip" style={{ flex: 'none' }}>{String(entry.type ?? '')}</span>
              {typeof entry.text === 'string'
                ? <input aria-label={`${variable.label} ${i + 1}`} className="nc-input" style={{ flex: 1 }} value={entry.text} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...(x as object), text: e.target.value } : x)))} />
                : <span style={{ flex: 1, fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{String(entry.target ?? '')}</span>}
              <button className="nc-chip" aria-label={t('node.writerRemove')} onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
            </div>
          );
        })}
      </div>
    );
  } else if (variable.type === 'number') {
    control = <input id={id} type="number" className="nc-input" value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
  } else {
    control = <input id={id} className="nc-input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  }
  return <label htmlFor={id} style={{ display: 'grid', gap: 3 }}>{label}{control}</label>;
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
  const locale = useLocale();
  const hint = React.useMemo(() => guideHint(readGuide(composition?.files[GUIDE_FILE]), locale), [composition, locale]);
  const catalog = React.useMemo(() => new Map((composition ? readBlockCatalog(composition.files) : []).map((b) => [b.name, b] as const)), [composition]);
  const pictures = React.useMemo(() => (assets?.items ?? []).map((a) => ({ path: assetProjectPath(a), url: a.url })), [assets]);
  const edits = p.edits ?? {};
  const rewrites = p.rewrites ?? {};

  const failure = runtime?.state === 'error' ? runtime.error : undefined;
  const draft = (failure?.details as { written?: WrittenStoryboard; problems?: string[] } | undefined);
  const scenes: Scene[] = draft?.written
    ? draft.written.frames.map((f) => ({ title: f.title, voiceover: f.voiceover ?? '', block: f.block, values: f.values }))
    : (storyboard?.frames ?? []).map((f) => ({ title: f.title, voiceover: f.voiceover ?? '', block: f.block ?? '', values: f.values }));
  const problemsOf = (i: number) => (draft?.problems ?? []).filter((m) => m.startsWith(`frame ${i + 1}:`) || m.startsWith(`frame ${i + 1},`));

  const edit = (i: number, patch: FrameEdit) => {
    const current = edits[String(i)] ?? {};
    set({ edits: { ...edits, [String(i)]: { ...current, ...patch, ...(patch.values ? { values: { ...current.values, ...patch.values } } : {}) } } });
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
  const [more, setMore] = React.useState(false);
  const subject = draft?.written?.subject ?? storyboard?.subject;
  const [subjectDraft, setSubjectDraft] = React.useState<string | null>(null);
  const message = draft?.written?.message ?? storyboard?.message;
  const fid = (field: string) => `${nodeId}-writer-${field}`;

  return (
    <div className={stopFlow} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor={fid('about')} style={{ display: 'grid', gap: 3 }}>
        <span style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.writerAbout')}</span>
        <textarea id={fid('about')} className="nc-textarea" style={{ minHeight: 64 }} maxLength={3000} placeholder={hint ?? t('node.writerAboutHint')} value={p.about ?? ''} onChange={(e) => set({ about: e.target.value })} />
      </label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor={fid('duration')} style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.writerDuration')}</label>
        <select id={fid('duration')} className="nc-select" value={p.durationSeconds ?? 30} onChange={(e) => set({ durationSeconds: Number(e.target.value) })}>
          {DURATIONS.map((d) => <option key={d} value={d}>{d} s</option>)}
        </select>
        <button className="nc-chip" aria-expanded={more} onClick={() => setMore(!more)}>{more ? t('node.writerLess') : t('node.writerMore')}</button>
      </div>
      {more && (
        <div style={{ display: 'grid', gap: 6, padding: 6, border: '1px solid var(--line)', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor={fid('tone')} style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.writerTone')}</label>
            <select id={fid('tone')} className="nc-select" value={p.tone ?? 'energetic'} onChange={(e) => set({ tone: e.target.value as Params['tone'] })}>
              {TONES.map((tone) => <option key={tone} value={tone}>{t(`node.writerTone.${tone}`)}</option>)}
            </select>
            <label htmlFor={fid('language')} style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.writerLanguage')}</label>
            <select id={fid('language')} className="nc-select" value={p.language ?? 'vi'} onChange={(e) => set({ language: e.target.value })}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{t(`node.language.${l}`)}</option>)}
            </select>
          </div>
          <label htmlFor={fid('notes')} style={{ display: 'grid', gap: 3 }}>
            <span style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.writerNotes')}</span>
            <textarea id={fid('notes')} className="nc-textarea" style={{ minHeight: 40 }} maxLength={1000} value={p.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
          </label>
          <ProviderPick nodeId={nodeId} kind="llm" />
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn small primary disabled={running} onClick={() => runNode(nodeId)}>{pending ? t('node.writerApply') : t('node.writerWrite')}</Btn>
        {scenes.length > 0 && <Btn small disabled={running} onClick={writeAgain}>{t('node.writerWriteAgain')}</Btn>}
      </div>
      {subject && (
        <div style={{ display: 'grid', gap: 4, fontSize: 'var(--fs-hint)', color: 'var(--tx-2)', lineHeight: 1.5 }}>
          <label htmlFor={fid('subject')} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <b style={{ flex: 'none' }}>{t('node.writerSubject')}</b>
            <input id={fid('subject')} className="nc-input" style={{ flex: 1 }} maxLength={120} value={subjectDraft ?? subject} onChange={(e) => setSubjectDraft(e.target.value)} />
            {subjectDraft !== null && subjectDraft.trim() && subjectDraft.trim() !== subject && (
              <Btn small disabled={running} onClick={() => { set({ subject: subjectDraft.trim() }); setSubjectDraft(null); setTimeout(() => runNode(nodeId), 0); }}>{t('node.writerRenameEverywhere')}</Btn>
            )}
          </label>
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
                <b>{i + 1}. {e.title ?? scene.title}</b>
                <span className="nc-chip">{scene.block}{block ? ` · ${t(`node.writerRole.${block.role}`)}` : ''}</span>
                {e.voiceover !== undefined || e.values ? <span style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.writerEdited')}</span> : null}
              </div>
              {scene.voiceover || e.voiceover !== undefined ? (
                <label htmlFor={fid('voiceover')} style={{ display: 'grid', gap: 3 }}>
                  <span style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.writerVoiceover', { words: words.length })}</span>
                  <textarea id={fid('voiceover')} className="nc-textarea" style={{ minHeight: 48 }} value={voiceover} onChange={(ev) => edit(i, { voiceover: ev.target.value })} />
                </label>
              ) : <span style={{ fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>{t('node.writerSilent')}</span>}
              {(block?.variables ?? []).filter((v) => v.id !== 'seconds' && values[v.id] !== undefined).map((v) => (
                <ValueField key={v.id} id={fid(v.id)} variable={v} value={values[v.id]} words={words} pictures={pictures} onChange={(value) => edit(i, { values: { [v.id]: value } })} />
              ))}
              {problems.map((m) => <div key={m} style={{ fontSize: 'var(--fs-hint)', color: 'var(--err)', overflowWrap: 'anywhere' }}>{m}</div>)}
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn small disabled={running} onClick={() => rewrite(i)}>{t('node.writerRewriteScene')}</Btn>
                {edits[String(i)] && <Btn small onClick={() => { const { [String(i)]: _gone, ...rest } = edits; set({ edits: rest }); }}>{t('node.writerUndoEdits')}</Btn>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
