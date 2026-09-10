'use client';
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { getNodeType } from '@/core/nodes/definition';
import { PORT_LABEL_KEYS, isResourcePort } from '@/core/types/ports';
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
/** The resource band's own rule, padding and margin, on top of one port row. */
const RES_BAND_H = PORT_ROW + 9;
const handleTop = (i: number, bandH: number) => HDR_H + PORT_PAD + bandH + i * PORT_ROW + PORT_ROW / 2;
/** Where handle `i` of `n` sits along an edge: evenly spaced, both ends clear of the corners. */
const handleLeft = (i: number, n: number) => `${((i + 1) * 100) / (n + 1)}%`;
/**
 * A resource label is placed under its own handle, not laid out in a row: the two must line up
 * whatever the count, and a label that wrapped would push every flow handle below it out of true.
 * One label may use the whole card; several share the spacing between handles and clip with an
 * ellipsis, the full text staying on the tooltip.
 */
const resLabel = (i: number, n: number): React.CSSProperties => ({
  position: 'absolute',
  left: handleLeft(i, n),
  transform: 'translateX(-50%)',
  maxWidth: n === 1 ? '100%' : `calc(${100 / (n + 1)}% - 6px)`,
});

/** Every node on the canvas: header with state badge, type-specific body, left/right ports (USER_FLOWS §2). */
export const NodeCard: React.FC<NodeProps<NcNode>> = ({ data, selected }) => {
  const t = useT();
  const node = useNode(data.nodeId);
  const rt = useRuntime(data.nodeId);
  const allIssues = useStudio((s) => s.issues);
  const issues = React.useMemo(() => allIssues.filter((i) => i.nodeId === data.nodeId && i.severity === 'error'), [allIssues, data.nodeId]);
  const runNode = useStudio((s) => s.runNode);
  const running = useStudio((s) => s.running);
  const toggleBypass = useStudio((s) => s.toggleBypass);
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
  const flowIns = def.inputs.filter((p) => !isResourcePort(p.type));
  const resourceIns = def.inputs.filter((p) => isResourcePort(p.type));
  const flowOuts = def.outputs.filter((p) => !isResourcePort(p.type));
  const resourceOuts = def.outputs.filter((p) => isResourcePort(p.type));
  // A resource hangs *below* the node it plugs into (n8n's sub-node shape): the part leaves by its
  // own top edge and arrives at the consumer's bottom edge. So the band that shares the top of the
  // card with the flow rows is the resource *output* one, and it shifts those rows' handles down.
  const bandH = resourceOuts.length > 0 ? RES_BAND_H : 0;
  const hasRetry = rt.state === 'error' || (def.kind === 'resource' && rt.state !== 'running' && rt.state !== 'queued');

  return (
    <div className={`nc-node ${meta?.layout === 'wide' ? 'wide' : ''} ${def.kind === 'resource' ? 'res' : ''} ${stateClass} ${selected ? 'selected' : ''}`}>
      <div className="nc-hdr">
        <IconC size={12} />
        <span className="nc-title" title={t(`node.desc.${node.type}`)}>{t(`node.${node.type}`)}</span>
        {badge}
        <button
          className={`nc-hdr-toggle nodrag nopan ${node.bypassed ? 'on' : ''}`}
          title={`${t(node.bypassed ? 'node.bypassOff' : 'node.bypass')} · Ctrl+B`}
          onClick={(e) => { e.stopPropagation(); toggleBypass(node.id); }}
          aria-pressed={node.bypassed}
        >
          <Icon.stop size={9} />
        </button>
      </div>
      {(resourceOuts.length > 0 || flowIns.length > 0 || flowOuts.length > 0) && (
        <div className="nc-ports">
          {resourceOuts.length > 0 && (
            <div className="nc-port-row nc-port-row-res top">
              {resourceOuts.map((p, i) => (
                <span key={p.name} className="nc-port-res" style={resLabel(i, resourceOuts.length)} title={t(PORT_LABEL_KEYS[p.type])}>{t(PORT_LABEL_KEYS[p.type])}</span>
              ))}
            </div>
          )}
          {flowIns.map((p) => (
            <div key={`in-${p.name}`} className="nc-port-row">
              {t(PORT_LABEL_KEYS[p.type])}{p.required === false ? ` · ${t('port.optional')}` : ''}
            </div>
          ))}
          {flowOuts.map((p) => (
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
            {/* Drawn like the one on a blocked node, because it is the same thing: what to do next. */}
            {rt.error.fix ? <div style={{ color: 'var(--tx-2)' }}>$ {rt.error.fix}</div> : null}
          </div>
        )}
        {hasRetry && def.kind !== 'ondemand' && (
          <Btn small className="nodrag" disabled={running} onClick={() => void runNode(node.id)} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
            <Icon.retry /> {def.kind === 'resource' ? t('node.checkAgain') : t('node.retry')}
          </Btn>
        )}
      </div>
      {resourceIns.length > 0 && (
        <div className="nc-ports foot" title={t('port.resources')}>
          <div className="nc-port-row nc-port-row-res bot">
            {resourceIns.map((p, i) => {
              const name = connectedName(p.name);
              const label = t(PORT_LABEL_KEYS[p.type]);
              return (
                <span key={p.name} className="nc-port-res" style={resLabel(i, resourceIns.length)} title={`${label}${name ? ` · ${name}` : ''}`}>
                  {label}{name ? <span style={{ color: 'var(--accent-2)' }}> {name}</span> : null}{p.required === false ? <span className="nc-dim"> · {t('port.optional')}</span> : null}
                </span>
              );
            })}
          </div>
        </div>
      )}
      {flowIns.map((p, i) => (
        <Handle key={p.name} type="target" position={Position.Left} id={p.name} className={rt.state === 'success' || rt.state === 'running' ? 'on' : ''} style={{ top: handleTop(i, bandH) }} />
      ))}
      {flowOuts.map((p, i) => (
        <Handle key={p.name} type="source" position={Position.Right} id={p.name} className={rt.state === 'success' ? 'on' : ''} style={{ top: handleTop(flowIns.length + i, bandH) }} />
      ))}
      {resourceIns.map((p, i) => (
        <Handle key={p.name} type="target" position={Position.Bottom} id={p.name} className={`res ${rt.state === 'success' || rt.state === 'running' ? 'on' : ''}`} style={{ left: handleLeft(i, resourceIns.length) }} title={t(PORT_LABEL_KEYS[p.type])} />
      ))}
      {resourceOuts.map((p, i) => (
        <Handle key={p.name} type="source" position={Position.Top} id={p.name} className={`res ${rt.state === 'success' ? 'on' : ''}`} style={{ left: handleLeft(i, resourceOuts.length) }} title={t(PORT_LABEL_KEYS[p.type])} />
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
