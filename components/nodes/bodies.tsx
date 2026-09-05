'use client';
import React from 'react';
import { listScenes, getScene } from '@/core/scenes/registry';
import type { AudioScript, DirectorPlan, EngineRef, LLMRef, TTSRef, Voiceover } from '@/core/types/payloads';
import type { VideoIR } from '@/core/types/ir';
import { readCapability } from '@/core/nodes/definition';
import { pickVoice } from '@/core/nodes/tts-engine';
import { Kv, Btn, Dot, useT, stopFlow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useInputPayload, useNode, useRuntime, useStudio } from '@/store/useStudio';
import { z } from 'zod';
import { findProvider, providersOfKind } from '@/providers/installed';
import { AiDirectorBody } from './AiDirectorBody';

export type BodyProps = { nodeId: string };

function useParams<T extends Record<string, unknown>>(nodeId: string): [T, (patch: Partial<T>) => void] {
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  return [(node?.params ?? {}) as T, (patch) => setParams(nodeId, patch as Record<string, unknown>)];
}


/* ---------- Input Trigger ---------- */
const InputTriggerBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ value: string }>(nodeId);
  return (
    <>
      <textarea className={`nc-textarea ${stopFlow}`} value={p.value} placeholder="…" onChange={(e) => set({ value: e.target.value })} />
      <div className="nc-hint">{t('node.chars', { n: p.value.trim().length })}</div>
    </>
  );
};

/* ---------- Static Script ---------- */
type SceneRow = { sceneType: string; weight: number; props: Record<string, unknown> };
const StaticScriptBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ theme: string; script: string; scenes: SceneRow[] }>(nodeId);
  const scenes = listScenes();
  const update = (i: number, patch: Partial<SceneRow>) => set({ scenes: p.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const remove = (i: number) => set({ scenes: p.scenes.filter((_, j) => j !== i) });
  const add = () => set({ scenes: [...p.scenes, { sceneType: 'core/title-card', weight: 1, props: { headline: 'New scene' } }] });
  return (
    <>
      <Kv k={t('node.theme')} v={p.theme} dim />
      <div className="nc-k" style={{ marginTop: 4 }}>{t('node.script')}</div>
      <textarea className={`nc-textarea ${stopFlow}`} value={p.script} onChange={(e) => set({ script: e.target.value })} />
      <div className="nc-k" style={{ marginTop: 4 }}>{t('node.scenes')}</div>
      {p.scenes.map((s, i) => {
        const def = getScene(s.sceneType);
        const shape = def && def.propsSchema instanceof z.ZodObject ? (def.propsSchema.shape as Record<string, z.ZodTypeAny>) : {};
        return (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 3, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="nc-scene-row">
              <span className="nc-k" style={{ color: 'var(--accent-2)' }}>{i + 1}</span>
              <select className={`nc-select ${stopFlow}`} value={s.sceneType} onChange={(e) => update(i, { sceneType: e.target.value, props: {} })}>
                {scenes.map((sc) => <option key={sc.sceneType} value={sc.sceneType}>{sc.sceneType}</option>)}
              </select>
              <input className={`nc-input ${stopFlow}`} style={{ width: 38 }} type="number" min={0.1} step={0.5} value={s.weight} title={t('node.weight')} onChange={(e) => update(i, { weight: Number(e.target.value) || 1 })} />
              <button className={`nc-chip ${stopFlow}`} onClick={() => remove(i)} disabled={p.scenes.length <= 1} title="remove"><Icon.x size={9} /></button>
            </div>
            {Object.keys(shape).map((k) => (
              <input key={k} className={`nc-input ${stopFlow}`} placeholder={k} value={(s.props[k] as string) ?? ''} onChange={(e) => update(i, { props: { ...s.props, [k]: e.target.value || undefined } })} />
            ))}
          </div>
        );
      })}
      <Btn small className={stopFlow} onClick={add} style={{ alignSelf: 'flex-start' }}><Icon.plus size={10} /> {t('node.addScene')}</Btn>
    </>
  );
};

/* ---------- Resource nodes ---------- */
/**
 * One capability, as a row: a label and a word. The reason a capability is unavailable is a
 * sentence, not a value, so it does not belong in a column half a node wide — it goes under the
 * rows with the remedy, where a sentence has the width to be read.
 */
const capRow = (payload: unknown, key: string, t: (k: string) => string) => {
  const c = readCapability(payload, key);
  if (!c) return null;
  const ok = c.status === 'ready';
  const color = ok ? 'var(--ok)' : 'var(--warn)';
  return <Kv key={key} k={t(`cap.${key}`)} v={<span title={ok ? undefined : c.reason} style={{ color }}><Dot color={color} />{t(ok ? 'state.ready' : 'state.notReady')}</span>} />;
};

/**
 * What went wrong, once per distinct problem. One provider failure usually takes several
 * capabilities down with it carrying the same reason and the same way out, and repeating that pair
 * per capability says nothing new.
 */
function capIssues(payload: unknown, keys: string[]): { reason?: string; fix?: string }[] {
  const seen = new Set<string>();
  const issues: { reason?: string; fix?: string }[] = [];
  for (const key of keys) {
    const c = readCapability(payload, key);
    if (!c || c.status === 'ready' || (!c.reason && !c.fix)) continue;
    const id = JSON.stringify([c.reason, c.fix]);
    if (seen.has(id)) continue;
    seen.add(id);
    issues.push({ reason: c.reason, fix: c.fix });
  }
  return issues;
}

/**
 * One body for both provider nodes: pick the provider, then whatever fields that provider declares.
 * The picker and the fields come from `providers/installed.ts`, so a new provider needs no UI work.
 */
const ProviderBody: React.FC<BodyProps & { kind: 'tts' | 'llm' }> = ({ nodeId, kind }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const runNode = useStudio((s) => s.runNode);
  const [p, set] = useParams<{ providerId: string; settings: Record<string, unknown> }>(nodeId);
  const options = providersOfKind(kind);
  const chosen = findProvider(p.providerId);
  const ref = (kind === 'tts' ? rt?.outputs.tts?.payload : rt?.outputs.llm?.payload) as TTSRef | LLMRef | undefined;
  const caps = kind === 'tts' ? ['installed', 'encoder'] : ['installed', 'authenticated'];
  const settings = p.settings ?? {};
  const setSetting = (name: string, value: unknown) => set({ settings: { ...settings, [name]: value } });

  // A node dropped from the library starts empty; offer the first provider rather than an error.
  React.useEffect(() => {
    if (!p.providerId && options[0]) set({ providerId: options[0].id, settings: { ...options[0].defaultSettings } });
  }, [p.providerId, options, set]);

  return (
    <>
      <Kv k={t('node.provider')} v={
        <select className={`nc-select ${stopFlow}`} value={p.providerId} onChange={(e) => {
          const next = findProvider(e.target.value);
          set({ providerId: e.target.value, settings: { ...(next?.defaultSettings ?? {}) } });
          // Capabilities and the voice list belong to whichever provider was probed, so leaving the
          // previous one's results under the new name reads as fact. Probe now, not at the next run.
          void runNode(nodeId);
        }}>
          {!p.providerId && <option value="">—</option>}
          {options.map((o) => <option key={o.id} value={o.id}>{t(o.nameKey)}</option>)}
        </select>
      } />
      {chosen?.noteKey && <div className="nc-hint">{t(chosen.noteKey)}</div>}
      {ref ? caps.map((k) => capRow(ref, k, t)) : <Kv k={t('node.status')} v="—" dim />}
      {capIssues(ref, caps).map((issue, i) => (
        <div key={i} className="nc-hint">
          {issue.reason && <div style={{ color: 'var(--warn)' }}>{issue.reason}</div>}
          {issue.fix && <div style={{ color: 'var(--tx-2)' }}>$ {issue.fix}</div>}
        </div>
      ))}
      {kind === 'llm' && (ref as LLMRef | undefined)?.capabilities.version && (
        <Kv k={t('node.tool')} v={`${p.providerId} ${(ref as LLMRef).capabilities.version}`} />
      )}
      {kind === 'tts' && <Kv k={t('node.voices')} v={ref ? String((ref as TTSRef).voices.length) : '—'} />}
      {chosen?.fields.map((f) => (
        <Kv key={f.name} k={t(f.label)} v={
          f.type === 'number' ? (
            <input className={`nc-input ${stopFlow}`} type="number" style={{ width: 70 }} min={f.min} max={f.max} step={f.step}
              value={String(settings[f.name] ?? '')} onChange={(e) => setSetting(f.name, e.target.value === '' ? undefined : Number(e.target.value))} />
          ) : f.type === 'select' ? (
            <select className={`nc-select ${stopFlow}`} value={String(settings[f.name] ?? '')} onChange={(e) => setSetting(f.name, e.target.value)}>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input className={`nc-input ${stopFlow}`} style={{ width: 100 }} placeholder={f.placeholder}
              value={String(settings[f.name] ?? '')} onChange={(e) => setSetting(f.name, e.target.value || undefined)} />
          )
        } />
      ))}
      <div className="nc-hint">{t('node.probeEveryRun')}</div>
    </>
  );
};

const LlmProviderBody: React.FC<BodyProps> = ({ nodeId }) => <ProviderBody nodeId={nodeId} kind="llm" />;
const TtsProviderBody: React.FC<BodyProps> = ({ nodeId }) => <ProviderBody nodeId={nodeId} kind="tts" />;

const EngineBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const node = useNode(nodeId);
  const [p, set] = useParams<{ concurrency?: number; glBackend?: string }>(nodeId);
  const ref = rt?.outputs.engine?.payload as EngineRef | undefined;
  return (
    <>
      <Kv k={t('node.adapter')} v={ref ? `${ref.engineId} ${ref.adapterVersion}` : '—'} />
      {ref ? ['preview', 'render'].map((k) => capRow(ref, k, t)) : null}
      {node?.type === 'core/remotion-engine' && (
        <>
          <Kv k={t('node.concurrency')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 50 }} type="number" min={1} placeholder="auto" value={p.concurrency ?? ''} onChange={(e) => set({ concurrency: e.target.value ? Number(e.target.value) : undefined })} />} />
          <Kv k={t('node.backend')} v={<select className={`nc-select ${stopFlow}`} value={p.glBackend ?? 'angle'} onChange={(e) => set({ glBackend: e.target.value })}><option value="angle">angle</option><option value="swiftshader">swiftshader</option></select>} />
        </>
      )}
    </>
  );
};

/* ---------- TTS Engine ---------- */
const TtsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ voice?: string; speed: number }>(nodeId);
  const script = useInputPayload<AudioScript>(nodeId, 'script');
  const ref = useInputPayload<TTSRef>(nodeId, 'tts');
  const rt = useRuntime(nodeId);
  const vo = rt?.outputs.voiceover?.payload as Voiceover | undefined;
  const lang = script?.language ?? 'en';
  const voices = ref?.voices.filter((v) => v.language.toLowerCase().startsWith(lang.toLowerCase())) ?? [];
  const auto = ref && script ? (() => { try { return pickVoice(ref, lang, p.voice); } catch { return null; } })() : null;
  return (
    <>
      <Kv k={t('node.voice')} v={<select className={`nc-select ${stopFlow}`} value={p.voice ?? ''} onChange={(e) => set({ voice: e.target.value || undefined })}>
        <option value="">{t('node.auto')}{auto ? ` · ${auto.voice.displayName}` : ''}</option>
        {voices.map((v) => <option key={v.id} value={v.id}>{v.displayName}</option>)}
      </select>} />
      <Kv k={t('node.speed')} v={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className={stopFlow} type="range" min={0.5} max={2} step={0.05} value={p.speed} onChange={(e) => set({ speed: Number(e.target.value) })} style={{ width: 70 }} />{p.speed.toFixed(2)}x</span>} />
      <div className="nc-hint">{t('node.matchesLanguage', { lang })}{auto?.fallback ? ` · ${t('state.notReady')}` : ''}</div>
      {vo && <div className="nc-hint" style={{ color: 'var(--tx-2)' }}>{vo.durationSeconds.toFixed(2)}s · {vo.voiceName}</div>}
    </>
  );
};

/* ---------- Timeline Assembler ---------- */
const AssemblerBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ fps: number; minTotalFrames: number; title: string }>(nodeId);
  const rt = useRuntime(nodeId);
  const plan = useInputPayload<DirectorPlan>(nodeId, 'plan');
  const ir = rt?.outputs.ir?.payload as VideoIR | undefined;
  const colors = ['var(--accent)', 'var(--accent-2)', 'var(--ok)', 'var(--run)', 'var(--warn)'];
  return (
    <>
      <Kv k={t('node.total')} v={ir ? `${ir.meta.totalDurationInFrames} ${t('node.frames')}` : '—'} dim={!ir} />
      <Kv k={t('node.fps')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 44 }} type="number" value={p.fps} onChange={(e) => set({ fps: Number(e.target.value) || 30 })} />} />
      <Kv k={t('node.minFrames')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 54 }} type="number" value={p.minTotalFrames} onChange={(e) => set({ minTotalFrames: Number(e.target.value) || 0 })} />} />
      <Kv k={t('node.title')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 100 }} value={p.title} onChange={(e) => set({ title: e.target.value })} />} />
      <div className="nc-alloc">
        {(ir?.timeline ?? plan?.scenes ?? []).map((s, i, arr) => {
          const w = 'durationInFrames' in s ? s.durationInFrames : (s as { weight: number }).weight;
          const sum = arr.reduce((a, x) => a + ('durationInFrames' in x ? x.durationInFrames : (x as { weight: number }).weight), 0);
          return <div key={i} style={{ width: `${(100 * w) / sum}%`, background: ir ? colors[i % colors.length] : 'var(--tx-3)', opacity: ir ? 1 : 0.25 }} />;
        })}
      </div>
      {ir && <div className="nc-hint">{ir.timeline.map((s) => s.durationInFrames).join(' / ')} · {t('node.padTail')} {ir.audioTrack.padTailFrames}f</div>}
    </>
  );
};

/* ---------- MP4 Export ---------- */
const ExportBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const [p, set] = useParams<{ codec: string; quality: string; fileName: string }>(nodeId);
  const rt = useRuntime(nodeId);
  const node = useNode(nodeId);
  const running = useStudio((s) => s.running);
  const runNode = useStudio((s) => s.runNode);
  const cancel = useStudio((s) => s.cancel);
  const toggleBypass = useStudio((s) => s.toggleBypass);
  const ir = useInputPayload<VideoIR>(nodeId, 'ir');
  const engine = useInputPayload<EngineRef>(nodeId, 'engine');
  const canRender = !!ir && !!engine && readCapability(engine, 'render')?.status === 'ready' && !running;
  const result = rt?.result as { outputUrl?: string; bytes?: number; fileName?: string } | undefined;
  if (rt?.state === 'running') {
    return (
      <>
        <Kv k={`${p.codec} · ${p.quality}`} v={rt.progress?.message ?? '…'} />
        <div className="nc-bar"><div style={{ width: `${Math.round((rt.progress?.fraction ?? 0) * 100)}%` }} /></div>
        <Btn small danger className={stopFlow} onClick={cancel} style={{ alignSelf: 'flex-end', marginTop: 4 }}>{t('node.cancel')}</Btn>
      </>
    );
  }
  return (
    <>
      <Kv k={t('node.codec')} v={<select className={`nc-select ${stopFlow}`} value={p.codec} onChange={(e) => set({ codec: e.target.value })}><option value="h264">H.264</option><option value="h265">H.265</option></select>} />
      <Kv k={t('node.quality')} v={<select className={`nc-select ${stopFlow}`} value={p.quality} onChange={(e) => set({ quality: e.target.value })}>{['high', 'medium', 'low'].map((q) => <option key={q} value={q}>{t(`node.quality.${q}`)}</option>)}</select>} />
      <Kv k={t('node.fileName')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 120 }} value={p.fileName} onChange={(e) => set({ fileName: e.target.value })} />} />
      {result?.outputUrl && rt?.state === 'success' && (
        <a className={`nc-btn nc-btn-sm ${stopFlow}`} href={result.outputUrl} download={result.fileName} style={{ justifyContent: 'center', marginTop: 4 }}>
          <Icon.down size={10} /> {t('node.download')} · {((result.bytes ?? 0) / 1024 / 1024).toFixed(1)} MB
        </a>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <Btn small primary className={stopFlow} disabled={!canRender} onClick={() => void runNode(nodeId)} style={{ flex: 1, justifyContent: 'center' }} title={!ir ? t('node.waiting', { port: t('port.videoIR') }) : !engine ? t('node.waiting', { port: t('port.engineRef') }) : readCapability(engine, 'render')?.reason}>
          <Icon.play size={9} /> {t('node.render')}
        </Btn>
        <button className={`nc-chip ${node?.bypassed ? '' : 'on'} ${stopFlow}`} onClick={() => toggleBypass(nodeId)} title="Ctrl+B">{t('node.bypass')}</button>
      </div>
    </>
  );
};

export const NODE_BODIES: Record<string, React.FC<BodyProps>> = {
  'core/input-trigger': InputTriggerBody,
  'core/static-script': StaticScriptBody,
  'core/ai-director': AiDirectorBody,
  'core/llm-provider': LlmProviderBody,
  'core/tts-provider': TtsProviderBody,
  'core/remotion-engine': EngineBody,
  'core/hyperframes-engine': EngineBody,
  'core/tts-engine': TtsBody,
  'core/timeline-assembler': AssemblerBody,
  'core/mp4-export': ExportBody,
};

/** Extras register bodies for their own node types. */
export function registerNodeBody(type: string, body: React.FC<BodyProps>): void {
  NODE_BODIES[type] = body;
}
