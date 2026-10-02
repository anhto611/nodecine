'use client';
import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { getNodeType } from '@/core/nodes/definition';
import { portLabelKey } from '@/core/types/ports';
import { NODE_META } from '@/lib/node-meta';
import { Icon } from '@/capsules/sdk/icons';
import { useT, Btn } from '@/capsules/sdk/ui';
import { useNode, useRuntime, useStudio } from '@/store/useStudio';
import { NODE_BODIES } from '@/capsules/nodes/index.client';
import { hasTranslation } from '@/lib/i18n';

/** A message as text: markup an upstream sent back (an error page) is dropped, its spaces folded. */
const plainText = (message: string) =>
  message
    .replace(/<[!/a-z][^>]*?(>|(?= · )|$)/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

/**
 * What a graph issue says. The graph's own checks have `issue.<code>` strings; a node's `validate` reports
 * with its capsule's error codes, whose strings are `error.<code>`; a code with neither shows its message.
 */
const issueText = (t: (key: string) => string, issue: { code: string; message: string }) =>
  hasTranslation(`issue.${issue.code}`) ? t(`issue.${issue.code}`) : hasTranslation(`error.${issue.code}`) ? t(`error.${issue.code}`) : issue.message;

export type NcNode = Node<{ nodeId: string }, 'nc'>;

const HDR_H = 24;
const PORT_PAD = 4;
const PORT_ROW = 18;
const handleTop = (i: number) => HDR_H + PORT_PAD + i * PORT_ROW + PORT_ROW / 2;

/** Every node on the canvas: header with state badge, type-specific body, left/right ports. */
export const NodeCard: React.FC<NodeProps<NcNode>> = ({ data }) => {
  const t = useT();
  const node = useNode(data.nodeId);
  const rt = useRuntime(data.nodeId);
  const allIssues = useStudio((s) => s.issues);
  // Both kinds are drawn: an error is a graph that cannot run, a warning is this node saying it is
  // not finished — an empty port, a setting still blank. Filtering warnings out left the card silent
  // until a run reached the node and blocked, which is exactly when it is too late to be told.
  const issues = React.useMemo(() => allIssues.filter((i) => i.nodeId === data.nodeId), [allIssues, data.nodeId]);
  // A standing issue and a failed run can be the same thing said twice: a node that will not run without
  // a brief says so before it is run, and says so again when it is. The error is the fuller of the two —
  // it carries what to do next — so the issue steps aside when they share a code. Kept apart from
  // `issues` because the card's warning ring should still come on for a node with something to say.
  const shown = React.useMemo(() => issues.filter((i) => i.code !== rt?.error?.code && i.code !== rt?.blockedBy?.code), [issues, rt?.error?.code, rt?.blockedBy?.code]);
  const runNode = useStudio((s) => s.runNode);
  const running = useStudio((s) => s.running);
  const toggleBypass = useStudio((s) => s.toggleBypass);
  const togglePin = useStudio((s) => s.togglePin);
  // The ring means "this is the node the panel is showing", which is not what React Flow calls
  // selected: it selects a card the moment a drag presses on it, and a drag is not a choice.
  const selected = useStudio((s) => s.selectedNodeId === data.nodeId);
  if (!node || !rt) return null;
  const def = getNodeType(node.type);
  if (!def)
    return (
      <div className="nc-node">
        <div className="nc-hdr">
          <span className="nc-title">{node.type}</span>
        </div>
      </div>
    );
  const meta = NODE_META[node.type];
  const IconC = meta ? Icon[meta.icon] : Icon.chip;
  const Body = NODE_BODIES[node.type];

  const stateClass = `s-${rt.state}${rt.blockedBy?.kind === 'capability' ? ' by-capability' : ''}${issues.length || rt.warnings?.length ? ' has-issue' : ''}`;
  const badge = renderBadge(rt, t);
  const flowIns = def.inputs;
  const flowOuts = def.outputs;
  const hasRetry = rt.state === 'error';

  return (
    <div className={`nc-node ${meta?.layout === 'wide' ? 'wide' : ''} ${stateClass} ${selected ? 'selected' : ''}`}>
      <div className="nc-hdr">
        <IconC size={12} />
        <span className="nc-title" title={t(`node.desc.${node.type}`)}>
          {t(`node.${node.type}`)}
        </span>
        {badge}
        {(node.pinned || Object.keys(rt.outputs ?? {}).length > 0) && (
          <button
            className={`nc-hdr-toggle nodrag nopan ${node.pinned ? 'on' : ''}`}
            title={node.pinned ? t('node.unpin') : t('node.pin')}
            onClick={(e) => {
              e.stopPropagation();
              togglePin(node.id);
            }}
            aria-pressed={!!node.pinned}
          >
            <Icon.pin size={9} />
          </button>
        )}
        {/* No switch on an on-demand node: it is out of every Run by type, so the switch would
            promise something it cannot do. Its own button is how it runs. */}
        {def.kind !== 'ondemand' && (
          <button
            className={`nc-hdr-toggle nodrag nopan ${node.bypassed ? 'on' : ''}`}
            title={`${t(node.bypassed ? 'node.bypassOff' : 'node.bypass')} · Ctrl+B`}
            onClick={(e) => {
              e.stopPropagation();
              toggleBypass(node.id);
            }}
            aria-pressed={node.bypassed}
          >
            <Icon.stop size={9} />
          </button>
        )}
      </div>
      {(flowIns.length > 0 || flowOuts.length > 0) && (
        <div className="nc-ports">
          {flowIns.map((p) => (
            <div key={`in-${p.name}`} className="nc-port-row">
              {t(portLabelKey(p.type))}
              {p.required === false ? ` · ${t('port.optional')}` : ''}
            </div>
          ))}
          {flowOuts.map((p) => (
            <div key={`out-${p.name}`} className="nc-port-row" style={{ justifyContent: 'flex-end' }}>
              {t(portLabelKey(p.type))}
            </div>
          ))}
        </div>
      )}
      <div className="nc-body">
        {Body ? <Body nodeId={node.id} /> : null}
        {shown.length > 0 && (
          <div className="nc-hint" style={{ color: 'var(--warn)' }}>
            {shown.map((i) => issueText(t, i)).join(' · ')}
          </div>
        )}
        {rt.warnings?.map((w, i) => {
          // A message can carry what an upstream answered, an HTML error page included: its text only, a few lines of it.
          const text = w.code ? t(`error.${w.code}`) : plainText(w.message);
          return (
            <div key={i} className="nc-hint clamp" style={{ color: 'var(--warn)' }} title={text}>
              {text}
            </div>
          );
        })}
        {rt.blockedBy && (
          <div className="nc-hint" style={{ color: rt.blockedBy.kind === 'capability' ? 'var(--warn)' : 'var(--tx-3)' }}>
            {rt.blockedBy.kind === 'capability' ? t(`error.${rt.blockedBy.code}`) : t(`error.${rt.blockedBy.code}`)}
            {rt.blockedBy.fix ? <div style={{ color: 'var(--tx-2)' }}>$ {rt.blockedBy.fix}</div> : null}
          </div>
        )}
        {rt.error && (
          <div className="nc-hint" style={{ color: 'var(--err)' }}>
            {t(`error.${rt.error.code}`)}
            <div
              className="clamp"
              style={{ color: 'var(--tx-3)', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 4, overflow: 'hidden' }}
              title={plainText(rt.error.message)}
            >
              {plainText(rt.error.message).slice(0, 160)}
            </div>
            {/* Drawn like the one on a blocked node, because it is the same thing: what to do next. */}
            {rt.error.fix ? <div style={{ color: 'var(--tx-2)' }}>$ {rt.error.fix}</div> : null}
          </div>
        )}
        {hasRetry && def.kind !== 'ondemand' && (
          <Btn small className="nodrag" disabled={running} onClick={() => void runNode(node.id)} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
            <Icon.retry /> {t('node.retry')}
          </Btn>
        )}
      </div>
      {flowIns.map((p, i) => (
        <Handle key={p.name} type="target" position={Position.Left} id={p.name} className={rt.state === 'success' || rt.state === 'running' ? 'on' : ''} style={{ top: handleTop(i) }} />
      ))}
      {flowOuts.map((p, i) => (
        <Handle key={p.name} type="source" position={Position.Right} id={p.name} className={rt.state === 'success' ? 'on' : ''} style={{ top: handleTop(flowIns.length + i) }} />
      ))}
    </div>
  );
};

function renderBadge(rt: ReturnType<typeof useRuntime>, t: ReturnType<typeof useT>) {
  if (!rt) return null;
  const dot = (c: string, label: string) => (
    <span className="nc-badge" style={{ color: c }}>
      <span className="nc-dot" style={{ background: c, marginRight: 0 }} />
      {label}
    </span>
  );
  switch (rt.state) {
    case 'running':
      return (
        <span className="nc-badge" style={{ color: 'var(--run)' }}>
          <Icon.spin />
        </span>
      );
    case 'success':
      return dot('var(--ok)', rt.reused ? t('state.reused') : rt.durationMs !== undefined ? `${(rt.durationMs / 1000).toFixed(1)}s` : t('state.success'));
    case 'error':
      return (
        <span className="nc-badge" style={{ color: 'var(--err)' }}>
          <Icon.warn />
        </span>
      );
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
