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

export type BodyProps = { nodeId: string };

function useParams<T extends Record<string, unknown>>(nodeId: string): [T, (patch: Partial<T>) => void] {
  const node = useNode(nodeId);
  const setParams = useStudio((s) => s.setParams);
  return [(node?.params ?? {}) as T, (patch) => setParams(nodeId, patch as Record<string, unknown>)];
}

const LANGS = ['en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'pt', 'id', 'th'];

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
  const [p, set] = useParams<{ language: string; theme: string; script: string; scenes: SceneRow[] }>(nodeId);
  const scenes = listScenes();
  const update = (i: number, patch: Partial<SceneRow>) => set({ scenes: p.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const remove = (i: number) => set({ scenes: p.scenes.filter((_, j) => j !== i) });
  const add = () => set({ scenes: [...p.scenes, { sceneType: 'core/title-card', weight: 1, props: { headline: 'New scene' } }] });
  return (
    <>
      <Kv k={t('node.language')} v={<select className={`nc-select ${stopFlow}`} style={{ width: 90 }} value={p.language} onChange={(e) => set({ language: e.target.value })}>{LANGS.map((l) => <option key={l} value={l}>{l}</option>)}</select>} />
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
const capRow = (payload: unknown, key: string, t: (k: string) => string) => {
  const c = readCapability(payload, key);
  if (!c) return null;
  const ok = c.status === 'ready';
  return (
    <Kv key={key} k={key} v={<span style={{ color: ok ? 'var(--ok)' : 'var(--warn)' }}><Dot color={ok ? 'var(--ok)' : 'var(--warn)'} />{ok ? t('state.ready') : (c.reason ?? t('state.notReady'))}</span>} />
  );
};

const ClaudeCodeBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const [p, set] = useParams<{ model?: string }>(nodeId);
  const ref = rt?.outputs.llm?.payload as LLMRef | undefined;
  return (
    <>
      <Kv k={t('node.tool')} v={ref?.capabilities.version ? `claude ${ref.capabilities.version}` : '—'} />
      {ref ? ['installed', 'authenticated'].map((k) => capRow(ref, k, t)) : null}
      {readCapability(ref, 'authenticated')?.fix && <div className="nc-hint" style={{ color: 'var(--tx-2)' }}>$ {readCapability(ref, 'authenticated')?.fix}</div>}
      <Kv k={t('node.model')} v={<input className={`nc-input ${stopFlow}`} style={{ width: 100 }} placeholder={t('node.default')} value={p.model ?? ''} onChange={(e) => set({ model: e.target.value || undefined })} />} />
      <div className="nc-hint">{t('node.probeEveryRun')}</div>
    </>
  );
};

const SystemTtsBody: React.FC<BodyProps> = ({ nodeId }) => {
  const t = useT();
  const rt = useRuntime(nodeId);
  const [p, set] = useParams<{ defaultVoice?: string; rate: number }>(nodeId);
  const ref = rt?.outputs.tts?.payload as TTSRef | undefined;
  return (
    <>
      {ref ? ['installed', 'encoder'].map((k) => capRow(ref, k, t)) : <Kv k={t('node.status')} v="—" dim />}
      {readCapability(ref, 'encoder')?.fix && <div className="nc-hint" style={{ color: 'var(--tx-2)' }}>$ {readCapability(ref, 'encoder')?.fix}</div>}
      <Kv k={t('node.voices')} v={ref ? String(ref.voices.length) : '—'} />
      <Kv k={t('node.default')} v={<select className={`nc-select ${stopFlow}`} style={{ width: 110 }} value={p.defaultVoice ?? ''} onChange={(e) => set({ defaultVoice: e.target.value || undefined })}>
        <option value="">{t('node.auto')}</option>
        {ref?.voices.map((v) => <option key={v.id} value={v.id}>{v.displayName} · {v.language}</option>)}
      </select>} />
    </>
  );
};

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
          <Kv k={t('node.backend')} v={<select className={`nc-select ${stopFlow}`} style={{ width: 100 }} value={p.glBackend ?? 'angle'} onChange={(e) => set({ glBackend: e.target.value })}><option value="angle">angle</option><option value="swiftshader">swiftshader</option></select>} />
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
      <Kv k={t('node.voice')} v={<select className={`nc-select ${stopFlow}`} style={{ width: 110 }} value={p.voice ?? ''} onChange={(e) => set({ voice: e.target.value || undefined })}>
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
      <Kv k={t('node.codec')} v={<select className={`nc-select ${stopFlow}`} style={{ width: 80 }} value={p.codec} onChange={(e) => set({ codec: e.target.value })}><option value="h264">H.264</option><option value="h265">H.265</option></select>} />
      <Kv k={t('node.quality')} v={<select className={`nc-select ${stopFlow}`} style={{ width: 110 }} value={p.quality} onChange={(e) => set({ quality: e.target.value })}>{['high', 'medium', 'low'].map((q) => <option key={q} value={q}>{t(`node.quality.${q}`)}</option>)}</select>} />
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
  'core/claude-code-provider': ClaudeCodeBody,
  'core/system-tts-provider': SystemTtsBody,
  'core/remotion-engine': EngineBody,
  'core/hyperframes-engine': EngineBody,
  'core/tts-engine': TtsBody,
  'core/timeline-assembler': AssemblerBody,
  'core/mp4-export': ExportBody,
};
