'use client';
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { getNodeType } from '@/core/nodes/definition';
import { PORT_LABEL_KEYS } from '@/core/types/ports';
import { readCapability } from '@/core/nodes/definition';
import { NODE_META } from '@/lib/node-meta';
import { Icon } from '@/components/icons';
import { useT, Btn } from '@/components/ui';
import { useNode, useRuntime, useStudio } from '@/store/useStudio';
import { NODE_BODIES } from '@/nodes/index.client';

export type NcNode = Node<{ nodeId: string }, 'nc'>;

const HDR_H = 24;
const PORT_PAD = 4;
const PORT_ROW = 18;
const handleTop = (i: number) => HDR_H + PORT_PAD + i * PORT_ROW + PORT_ROW / 2;

/** Every node on the canvas: header with state badge, type-specific body, left/right ports (USER_FLOWS §2). */
export const NodeCard: React.FC<NodeProps<NcNode>> = ({ data, selected }) => {
  const t = useT();
  const node = useNode(data.nodeId);
  const rt = useRuntime(data.nodeId);
  const allIssues = useStudio((s) => s.issues);
  const issues = React.useMemo(() => allIssues.filter((i) => i.nodeId === data.nodeId && i.severity === 'error'), [allIssues, data.nodeId]);
  const runNode = useStudio((s) => s.runNode);
  const running = useStudio((s) => s.running);
  const graph = useStudio((s) => s.graph);
  const runtimes = useStudio((s) => s.runtimes);
  if (!node || !rt) return null;
  const connectedName = (port: string): string | undefined => {
    const edge = graph.edges.find((e) => e.target === data.nodeId && e.targetPort === port);
    const payload = edge ? (runtimes[edge.source]?.outputs[edge.sourcePort]?.payload as { displayName?: string } | undefined) : undefined;
    return payload?.displayName;
  };
  const def = getNodeType(node.type);
  if (!def) return <div className="nc-node"><div className="nc-hdr"><span className="nc-title">{node.type}</span></div></div>;
  const meta = NODE_META[node.type];
  const IconC = meta ? Icon[meta.icon] : Icon.chip;
  const Body = NODE_BODIES[node.type];

  // Resource nodes overlay readiness on the success badge (EXECUTION_ENGINE §1.1 rule 2).
  const ref = def.kind === 'resource' ? Object.values(rt.outputs)[0]?.payload : undefined;
  const caps = ref ? (ref as { capabilities: Record<string, unknown> }).capabilities : undefined;
  const notReady = caps ? Object.keys(caps).some((k) => readCapability(ref, k)?.status === 'unavailable') : false;

  const stateClass = `s-${rt.state}${rt.blockedBy?.kind === 'capability' ? ' by-capability' : ''}${issues.length || rt.warnings?.length ? ' has-issue' : ''}${notReady && rt.state === 'success' ? ' not-ready' : ''}`;
  const badge = renderBadge(rt, notReady, t);
  // A resource node offers its re-check whenever it is not busy. Tying it to `success` took the
  // button away exactly when a setting had just changed and the node had gone stale — the one
  // moment the user has a reason to press it.
  const hasRetry = rt.state === 'error' || (def.kind === 'resource' && rt.state !== 'running' && rt.state !== 'queued');

  return (
    <div className={`nc-node ${node.type === 'core/video-output' ? 'wide' : ''} ${stateClass} ${selected ? 'selected' : ''}`}>
      <div className="nc-hdr">
        <IconC size={12} />
        <span className="nc-title" title={t(`node.desc.${node.type}`)}>{t(`node.${node.type}`)}</span>
        {badge}
      </div>
      {(def.inputs.length > 0 || def.outputs.length > 0) && (
        <div className="nc-ports">
          {def.inputs.map((p) => {
            const name = ['EngineRef', 'LLMRef', 'TTSRef'].includes(p.type) ? connectedName(p.name) : undefined;
            return (
              <div key={`in-${p.name}`} className="nc-port-row">
                {t(PORT_LABEL_KEYS[p.type])}{p.required === false ? ` · ${t('port.optional')}` : ''}{name ? <span style={{ color: 'var(--accent-2)' }}> · {name}</span> : null}
              </div>
            );
          })}
          {def.outputs.map((p) => (
            <div key={`out-${p.name}`} className="nc-port-row" style={{ justifyContent: 'flex-end' }}>{t(PORT_LABEL_KEYS[p.type])}</div>
          ))}
        </div>
      )}
      <div className="nc-body">
        {Body ? <Body nodeId={node.id} /> : null}
        {issues.length > 0 && <div className="nc-hint" style={{ color: 'var(--warn)' }}>{issues.map((i) => t(`issue.${i.code}`)).join(' · ')}</div>}
        {rt.warnings?.map((w, i) => (
          <div key={i} className="nc-hint" style={{ color: 'var(--warn)' }}>{w.code ? t(`error.${w.code}`) : w.message}</div>
        ))}
        {rt.blockedBy && (
          <div className="nc-hint" style={{ color: rt.blockedBy.kind === 'capability' ? 'var(--warn)' : 'var(--tx-3)' }}>
            {rt.blockedBy.kind === 'capability' ? t(`error.${rt.blockedBy.code}`) : t(`error.${rt.blockedBy.code}`)}
            {rt.blockedBy.fix ? <div style={{ color: 'var(--tx-2)' }}>$ {rt.blockedBy.fix}</div> : null}
          </div>
        )}
        {rt.error && (
          <div className="nc-hint" style={{ color: 'var(--err)' }}>
            {t(`error.${rt.error.code}`)}
            <div style={{ color: 'var(--tx-3)', whiteSpace: 'pre-wrap' }}>{rt.error.message.slice(0, 160)}</div>
          </div>
        )}
        {hasRetry && def.kind !== 'ondemand' && (
          <Btn small className="nodrag" disabled={running} onClick={() => void runNode(node.id)} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
            <Icon.retry /> {def.kind === 'resource' ? t('node.checkAgain') : t('node.retry')}
          </Btn>
        )}
      </div>
      {def.inputs.map((p, i) => (
        <Handle key={p.name} type="target" position={Position.Left} id={p.name} className={rt.state === 'success' || rt.state === 'running' ? 'on' : ''} style={{ top: handleTop(i) }} />
      ))}
      {def.outputs.map((p, i) => (
        <Handle key={p.name} type="source" position={Position.Right} id={p.name} className={rt.state === 'success' ? 'on' : ''} style={{ top: handleTop(def.inputs.length + i) }} />
      ))}
    </div>
  );
};

function renderBadge(rt: ReturnType<typeof useRuntime>, notReady: boolean, t: ReturnType<typeof useT>) {
  if (!rt) return null;
  const dot = (c: string, label: string) => (
    <span className="nc-badge" style={{ color: c }}>
      <span className="nc-dot" style={{ background: c, marginRight: 0 }} />
      {label}
    </span>
  );
  switch (rt.state) {
    case 'running':
      return <span className="nc-badge" style={{ color: 'var(--run)' }}><Icon.spin /></span>;
    case 'success':
      if (notReady) return dot('var(--warn)', t('state.notReady'));
      return dot('var(--ok)', rt.reused ? t('state.reused') : rt.durationMs !== undefined ? `${(rt.durationMs / 1000).toFixed(1)}s` : t('state.success'));
    case 'error':
      return <span className="nc-badge" style={{ color: 'var(--err)' }}><Icon.warn /></span>;
    case 'queued':
      return dot('var(--tx-3)', t('state.queued'));
    case 'blocked':
      return rt.blockedBy?.kind === 'capability' ? dot('var(--warn)', t('state.blocked')) : dot('var(--tx-3)', t('state.queued'));
    case 'bypassed':
      return dot('var(--tx-3)', t('state.bypassed'));
    case 'stale':
    case 'cancelled':
      return dot('var(--tx-3)', t('state.stale'));
    default:
      return dot('var(--tx-3)', '');
  }
}
