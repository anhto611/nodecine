'use client';
import React from 'react';
import { useStudio } from '@/store/useStudio';
import { useAgent } from '@/store/useAgent';
import { agentIdFor, type AgentMessage } from '@/contracts/agent/chat';
import { workflowModel } from '@/contracts/workflow-model';
import type { SampleProfile } from '@/contracts/agent/sample';
import type { KitSession } from '@/contracts/agent/kit';
import { agentApi } from '@/lib/agent.client';
import { providersOfKind } from '@/capsules/providers/installed';
import { Icon } from '@/capsules/sdk/icons';
import { Btn, useT } from '@/capsules/sdk/ui';

/**
 * The active workflow's agent, in a column on the right of the canvas. Every workflow has its own:
 * switching tabs switches the conversation, and a reply still on its way lands on the workflow that
 * asked. The agent edits the canvas the way a person would, so Ctrl+Z takes back what it did.
 */
export const AgentPanel: React.FC = () => {
  const t = useT();
  const tab = useStudio((s) => s.tabs.find((x) => x.key === s.activeTab));
  const toggle = useStudio((s) => s.toggleAgent);
  const focused = useStudio((s) => s.graph.nodes.find((n) => n.id === s.selectedNodeId));
  const select = useStudio((s) => s.select);
  const asked = useStudio((s) => s.agentAsk);
  const box = React.useRef<HTMLTextAreaElement>(null);
  // A node card's "Ask the agent" lands the cursor here.
  React.useEffect(() => {
    if (asked) box.current?.focus();
  }, [asked]);
  const id = tab ? agentIdFor(tab) : '';
  const slot = useAgent((s) => s.slots[id]);
  const { load, send, stop, clear } = useAgent.getState();
  const providers = React.useMemo(() => providersOfKind('llm'), []);
  const [draft, setDraft] = React.useState('');
  const list = React.useRef<HTMLDivElement>(null);
  // A sample video attached to the next message: read first (about two minutes for a new one), then sent with it.
  const [attached, setAttached] = React.useState<SampleProfile | null>(null);
  const [reading, setReading] = React.useState<string | null>(null);
  const [readError, setReadError] = React.useState<string | null>(null);
  const picker = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    setAttached(null);
    setReadError(null);
  }, [id]);
  // A link instead of a file: pasted into a small box that opens under the message.
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [link, setLink] = React.useState('');
  const attach = async (from: File | string) => {
    setReading(typeof from === 'string' ? from : from.name);
    setReadError(null);
    try {
      setAttached(typeof from === 'string' ? await agentApi.sampleLink(id, from) : await agentApi.sample(id, from));
      setLinkOpen(false);
      setLink('');
    } catch (e) {
      const err = e as Error & { fix?: string };
      setReadError(`${err.message}${err.fix ? ` · ${err.fix}` : ''}`);
    } finally {
      setReading(null);
    }
  };

  React.useEffect(() => {
    if (id && !useAgent.getState().slots[id]?.chat) void load(id);
  }, [id, load]);

  const chat = slot?.chat;
  // The workflow's own model: set on it, or the one its nodes name, or the first this build ships.
  const setModel = useStudio((s) => s.setWorkflowModel);
  const model = tab ? workflowModel(tab.graph, providers[0] ? { provider: providers[0].id, settings: { ...providers[0].defaultSettings } } : null) : null;

  const messages = React.useMemo(() => [...(chat?.messages ?? []), ...(slot?.pending ? [slot.pending] : [])], [chat?.messages, slot?.pending]);
  React.useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length, slot?.busy]);

  if (!tab) return null;
  const busy = !!slot?.busy;
  const submit = () => {
    if (busy || reading || (!draft.trim() && !attached)) return;
    // A video sent with nothing typed asks for the obvious thing.
    const text = draft.trim() || t('agent.sampleAsk');
    const sample = attached ?? undefined;
    setDraft('');
    setAttached(null);
    void send(tab.key, text, sample);
  };

  return (
    <aside className="nc-panel nc-agent">
      <div className="nc-pn-h">
        <Icon.bot size={13} />
        {t('agent.title')}
        <span style={{ color: 'var(--tx-3)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>· {tab.name}</span>
        <button className="nc-chip" style={{ marginLeft: 'auto', border: 0 }} title={t('agent.clear')} disabled={!messages.length} onClick={() => void clear(id)}>
          <Icon.trash size={12} />
        </button>
        <button className="nc-chip" style={{ border: 0 }} onClick={toggle}>
          <Icon.x size={12} />
        </button>
      </div>
      <div className="nc-agent-model">
        <span title={t('agent.modelHint')}>{t('agent.model')}</span>
        <select
          className="nc-select"
          value={model?.provider ?? ''}
          title={t('agent.modelHint')}
          disabled={busy}
          onChange={(e) => {
            const next = providers.find((p) => p.id === e.target.value);
            if (next) setModel({ provider: next.id, settings: { ...next.defaultSettings } });
          }}
        >
          {!model && <option value="">—</option>}
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {t(p.nameKey)}
            </option>
          ))}
        </select>
      </div>
      <ModelStatus provider={model?.provider ?? ''} settings={model?.settings ?? {}} wantsWeb={!!tab.graph.nodes.some((n) => n.params.search === 'web' && !n.bypassed)} />
      <div className="nc-agent-list" ref={list}>
        {!messages.length && (
          <div className="nc-agent-empty">
            <p>{t('agent.empty')}</p>
            {(['agent.example1', 'agent.example2', 'agent.example3'] as const).map((k) => (
              <button key={k} className="nc-chip" onClick={() => setDraft(t(k))}>
                {t(k)}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {busy && (
          <div className="nc-agent-thinking">
            <Icon.spin /> {t('agent.thinking')}
          </div>
        )}
        {slot?.kit && <KitCard kit={slot.kit} onStop={() => useAgent.getState().stopKit(id)} />}
        {slot?.notice && <div className="nc-agent-notice">{slot.notice}</div>}
      </div>
      <div className="nc-agent-input">
        {focused && (
          <div className="nc-agent-focus" title={t('agent.focusHint')}>
            <Icon.bot size={10} />
            <span>{t('agent.focus', { node: t(`node.${focused.type}`) })}</span>
            <code>{focused.id}</code>
            <button className="nc-chip" style={{ border: 0, marginLeft: 'auto' }} title={t('agent.focusClear')} onClick={() => select(null)}>
              <Icon.x size={10} />
            </button>
          </div>
        )}
        {(attached || reading || readError) && (
          <div className="nc-agent-sample">
            {reading ? (
              <span>
                <Icon.spin /> {t('agent.sampleReading', { name: reading })}
              </span>
            ) : readError ? (
              <span className="warn">
                <Icon.warn size={10} /> {readError}
              </span>
            ) : attached ? (
              <>
                <div className="thumbs">
                  {attached.frames.slice(0, 6).map((f) => (
                    <img key={f.url} src={f.url} alt="" />
                  ))}
                </div>
                <span>{t('agent.sampleInfo', { name: attached.name, seconds: Math.round(attached.durationSeconds), segments: attached.segments.length })}</span>
              </>
            ) : null}
            {!reading && (
              <button
                className="nc-chip"
                style={{ border: 0, marginLeft: 'auto' }}
                onClick={() => {
                  setAttached(null);
                  setReadError(null);
                }}
              >
                <Icon.x size={10} />
              </button>
            )}
          </div>
        )}
        {linkOpen && !reading && (
          <input
            className="nc-input nc-agent-link"
            autoFocus
            value={link}
            placeholder={t('agent.sampleLinkPlaceholder')}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && link.trim()) {
                e.preventDefault();
                void attach(link.trim());
              }
              if (e.key === 'Escape') setLinkOpen(false);
            }}
          />
        )}
        <input
          ref={picker}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void attach(file);
          }}
        />
        <textarea
          ref={box}
          className="nc-input"
          rows={3}
          value={draft}
          placeholder={model ? t('agent.placeholder') : t('agent.noModel')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="nc-agent-actions">
          <button className="nc-chip" title={t('agent.sampleAttach')} disabled={!!reading || busy} onClick={() => picker.current?.click()}>
            <Icon.film size={12} /> {t('agent.sampleButton')}
          </button>
          <button className={`nc-chip ${linkOpen ? 'on' : ''}`} title={t('agent.sampleLinkHint')} disabled={!!reading || busy} onClick={() => setLinkOpen(!linkOpen)}>
            {t('agent.sampleLink')}
          </button>
          <span style={{ flex: 1 }} />
          {busy ? (
            <Btn danger small onClick={() => stop(id)}>
              <Icon.stop /> {t('agent.stop')}
            </Btn>
          ) : (
            <Btn primary small disabled={(!draft.trim() && !attached) || !!reading || !model} onClick={submit}>
              {t('agent.send')}
            </Btn>
          )}
        </div>
      </div>
    </aside>
  );
};

/** A kit a coding agent is building: how far it is, what it is doing, and a way to stop it. */
const KitCard: React.FC<{ kit: KitSession; onStop: () => void }> = ({ kit, onStop }) => {
  const t = useT();
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (kit.state !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [kit.state]);
  const seconds = Math.round(((kit.endedAt ? Date.parse(kit.endedAt) : now) - Date.parse(kit.startedAt)) / 1000);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const title =
    kit.state === 'running'
      ? t(kit.phase === 'check' ? 'agent.kitChecking' : kit.round > 1 ? 'agent.kitRepairing' : 'agent.kitBuilding', { round: kit.round })
      : kit.state === 'done'
        ? t('agent.kitDone', { files: Object.keys(kit.files ?? {}).length })
        : kit.state === 'cancelled'
          ? t('agent.kitCancelled')
          : t('agent.kitFailed', { why: kit.error ?? '' });
  return (
    <div className={`nc-agent-kit ${kit.state}`}>
      <div className="head">
        {kit.state === 'running' ? <Icon.spin /> : kit.state === 'done' ? <Icon.check /> : <Icon.warn size={10} />}
        <span>{title}</span>
        <span className="clock">{clock}</span>
        {kit.state === 'running' && (
          <button className="nc-chip" onClick={onStop}>
            <Icon.stop /> {t('agent.stop')}
          </button>
        )}
      </div>
      {kit.state === 'running' &&
        kit.log.slice(-3).map((l, i) => (
          <div key={i} className="line">
            {l}
          </div>
        ))}
      {kit.state === 'done' && kit.problems?.length ? <div className="line warn">{t('agent.kitProblems', { n: kit.problems.length })}</div> : null}
    </div>
  );
};

type Cap = { status: string; reason?: string; fix?: string } | undefined;

/**
 * What the workflow's model can do here, said before a run finds out: not installed or not signed in,
 * and whether it sees pictures and searches the web — what the nodes that write with it lean on.
 */
const ModelStatus: React.FC<{ provider: string; settings: Record<string, unknown>; wantsWeb: boolean }> = ({ provider, settings, wantsWeb }) => {
  const t = useT();
  const [caps, setCaps] = React.useState<Record<string, Cap> | null>(null);
  const key = JSON.stringify([provider, settings]);
  React.useEffect(() => {
    if (!provider) return;
    let live = true;
    setCaps(null);
    fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, settings }) })
      .then((r) => r.json())
      .then((b: { capabilities?: Record<string, Cap> }) => live && setCaps(b.capabilities ?? {}))
      .catch(() => live && setCaps({}));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!provider || !caps) return null;
  const down = [caps.installed, caps.authenticated].find((c) => c && c.status !== 'ready');
  const yes = (c: Cap) => c?.status === 'ready';
  return (
    <div className="nc-agent-caps">
      {down ? (
        <div className="warn">
          <Icon.warn size={10} /> {down.reason}
          {down.fix && <code>{down.fix}</code>}
        </div>
      ) : (
        <div>
          {t('agent.capVision')} {yes(caps.vision) ? '✓' : '✗'} · {t('agent.capWeb')} {yes(caps.webSearch) ? '✓' : '✗'}
        </div>
      )}
      {!down && wantsWeb && !yes(caps.webSearch) && (
        <div className="warn">
          <Icon.warn size={10} /> {t('agent.noWeb')}
        </div>
      )}
    </div>
  );
};

const Message: React.FC<{ m: AgentMessage }> = ({ m }) => {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  if (m.role === 'event') return <div className="nc-agent-event">{m.text}</div>;
  if (m.role === 'user')
    return (
      <div className="nc-agent-msg user">
        {m.focus && <div className="nc-agent-about">@{m.focus}</div>}
        {m.sample && (
          <div className="nc-agent-sample in-msg">
            <div className="thumbs">
              {m.sample.thumbs.map((u) => (
                <img key={u} src={u} alt="" />
              ))}
            </div>
            <span>{t('agent.sampleInfo', { name: m.sample.name, seconds: Math.round(m.sample.seconds), segments: m.sample.segments })}</span>
          </div>
        )}
        {m.text}
      </div>
    );
  // Stopping is something the person did, not something that went wrong.
  if (m.error?.code === 'CANCELLED') return <div className="nc-agent-event">{t('agent.stopped')}</div>;
  if (m.error) {
    return (
      <div className="nc-agent-msg error">
        <Icon.warn /> {m.error.message}
        {m.error.fix && <div className="nc-hint">{m.error.fix}</div>}
      </div>
    );
  }
  const results = m.results ?? [];
  const ok = results.filter((r) => r.ok).length;
  return (
    <div className="nc-agent-msg assistant">
      {m.text}
      {results.length > 0 && (
        <div className="nc-agent-edits">
          <button className={`nc-chip ${ok < results.length ? 'warn' : ''}`} onClick={() => setOpen(!open)}>
            {ok < results.length ? <Icon.warn size={10} /> : <Icon.check size={10} />} {t('agent.edits', { ok, n: results.length })}
          </button>
          {open && (
            <ul>
              {results.map((r, i) => (
                <li key={i} className={r.ok ? 'ok' : 'bad'}>
                  {r.ok ? '✓' : '✗'} {r.note}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
