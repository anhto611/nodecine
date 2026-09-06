'use client';
import React from 'react';
import type { BlockDef, StageDef } from '@/core/types/payloads';
import { Btn, useT } from '@/components/ui';
import { useStudio } from '@/store/useStudio';
import { findProvider, providersOfKind } from '@/providers/installed';
import type { DraftParts } from './draft';

const LLM_CHOICE_KEY = 'nodecine.lookEditProvider';
const ASK_MIN = 52;
const ASK_MAX = 180;

export interface AskAnswer extends DraftParts { source: string; summary?: string; warnings?: string[]; changes?: string[]; provider?: string }

/**
 * Edit by words: an instruction, the model that rewrites (any Language Model node in the workflow,
 * or an installed provider), and what came back. The answer is handed up as a draft; nothing is
 * saved here. `getRequest` reads the current draft at send time, so a stale closure cannot send old code.
 */
export const AskBar: React.FC<{
  kind: 'stage' | 'block';
  getRequest: () => { source: string; stage?: Omit<StageDef, 'code'>; block?: Omit<BlockDef, 'code'>; frame: { width: number; height: number } };
  onAnswer: (a: AskAnswer) => void;
  changes: string[];
}> = ({ kind, getRequest, onAnswer, changes }) => {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const graphNodes = useStudio((s) => s.graph.nodes);
  const llmChoices = React.useMemo(() => {
    const fromGraph = graphNodes.filter((n) => n.type === 'core/llm-provider').map((n) => {
      const p = n.params as { providerId?: string; settings?: Record<string, unknown> };
      const model = typeof p.settings?.model === 'string' && p.settings.model ? ` · ${p.settings.model}` : '';
      return { key: `node:${n.id}`, label: `${t(findProvider(p.providerId ?? '')?.nameKey ?? p.providerId ?? '?')}${model} (${t('code.askInWorkflow')})`, providerId: p.providerId || 'claude-code', settings: p.settings ?? {} };
    });
    const present = new Set(fromGraph.map((c) => c.providerId));
    const extra = providersOfKind('llm').filter((d) => !present.has(d.id)).map((d) => ({ key: `provider:${d.id}`, label: t(d.nameKey), providerId: d.id, settings: { ...d.defaultSettings } }));
    return [...fromGraph, ...extra];
  }, [graphNodes, t]);
  const [llmKey, setLlmKey] = React.useState<string>(() => { try { return localStorage.getItem(LLM_CHOICE_KEY) ?? ''; } catch { return ''; } });
  const llm = llmChoices.find((c) => c.key === llmKey) ?? llmChoices[0]!;
  const chooseLlm = (key: string) => { setLlmKey(key); try { localStorage.setItem(LLM_CHOICE_KEY, key); } catch { /* private mode */ } };

  const [ask, setAsk] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [note, setNote] = React.useState<{ kind: 'ok' | 'err'; text: string; warnings?: string[] } | null>(null);
  const askRef = React.useRef<HTMLTextAreaElement>(null);
  // Auto-grow between two and about eight lines; measured, so it works in every browser.
  React.useEffect(() => { const el = askRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(ASK_MAX, Math.max(ASK_MIN, el.scrollHeight + 2))}px`; }, [ask]);
  const ctrlRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => ctrlRef.current?.abort(), []);

  const run = async () => {
    const instruction = ask.trim();
    if (!instruction || asking) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setAsking(true);
    setNote(null);
    try {
      const req = getRequest();
      const body = { kind, instruction, source: req.source, stage: req.stage ? { name: req.stage.name, tokens: req.stage.tokens, tones: req.stage.tones, sceneFields: req.stage.sceneFields } : undefined, block: req.block ? { id: req.block.id, name: req.block.name, doc: req.block.doc, props: req.block.props } : undefined, providerId: llm.providerId, settings: llm.settings, locale, frame: req.frame };
      const res = await fetch('/api/look/edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
      const data = (await res.json()) as Partial<AskAnswer> & { error?: string; message?: string; fix?: string };
      if (!res.ok || !data.source) { setNote({ kind: 'err', text: `${data.message ?? data.error ?? res.status}${data.fix ? ` · ${data.fix}` : ''}` }); return; }
      onAnswer(data as AskAnswer);
      setAsk('');
      setNote({ kind: 'ok', text: `${data.provider ?? llm.providerId}: ${data.summary || t('code.askDone')}`, warnings: data.warnings });
    } catch (e) {
      if (!ctrl.signal.aborted) setNote({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (ctrlRef.current === ctrl) setAsking(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderTop: '1px solid var(--line)', background: 'var(--bg-panel)' }}>
      <textarea
        ref={askRef}
        className="nc-textarea"
        rows={2}
        style={{ resize: 'vertical', minHeight: ASK_MIN, maxHeight: ASK_MAX, fontSize: 'var(--fs-body)', lineHeight: 1.5, overflowY: 'auto' }}
        placeholder={t(kind === 'block' ? 'code.askPlaceholderBlock' : 'code.askPlaceholderStage')}
        value={ask}
        disabled={asking}
        onChange={(e) => setAsk(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void run(); } if (e.key === 'Escape') e.stopPropagation(); }}
      />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 'none', fontSize: 'var(--fs-hint)', color: 'var(--tx-3)' }}>
          <span>{t('code.askVia', { name: '' }).trim()}</span>
          <select className="nc-select" style={{ width: 'auto', height: 24 }} value={llm.key} disabled={asking} onChange={(e) => chooseLlm(e.target.value)}>
            {llmChoices.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-hint)', color: note?.kind === 'err' ? 'var(--err)' : 'var(--tx-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={note?.text}>
          {asking ? t('code.askBusy') : note?.text ?? t('code.askIdle')}
        </span>
        {asking
          ? <Btn small onClick={() => ctrlRef.current?.abort()} style={{ flex: 'none' }}>{t('code.askCancel')}</Btn>
          : <Btn small primary disabled={!ask.trim()} onClick={() => void run()} title="Ctrl+Enter" style={{ flex: 'none' }}>{t('code.askRun')}</Btn>}
      </div>
      {changes.length > 0 && <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--accent-2)' }}>{t('code.changes')}: {changes.join(' · ')}</div>}
      {note?.warnings?.length ? <div style={{ fontSize: 'var(--fs-hint)', color: 'var(--warn)' }}>{note.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div> : null}
    </div>
  );
};
