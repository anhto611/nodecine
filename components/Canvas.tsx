'use client';
import React from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type IsValidConnection,
} from '@xyflow/react';
import { getNodeType } from '@/core/nodes/definition';
import { useStudio } from '@/store/useStudio';
import { NodeCard, type NcNode } from './nodes/NodeCard';
import { Icon } from './icons';
import { useT } from './ui';

const nodeTypes = { nc: NodeCard };

/** The graph canvas: React Flow bound to the store's graph; edges glow once their source has a result. */
function CanvasInner() {
  const t = useT();
  const graph = useStudio((s) => s.graph);
  const runtimes = useStudio((s) => s.runtimes);
  const setNodePosition = useStudio((s) => s.setNodePosition);
  const removeNodes = useStudio((s) => s.removeNodes);
  const removeEdges = useStudio((s) => s.removeEdges);
  const connect = useStudio((s) => s.connect);
  const addNode = useStudio((s) => s.addNode);
  const select = useStudio((s) => s.select);
  const setPanel = useStudio((s) => s.setPanel);
  const rf = useReactFlow();
  const [zoom, setZoom] = React.useState(1);

  const nodes: NcNode[] = React.useMemo(
    () => graph.nodes.map((n) => ({ id: n.id, type: 'nc' as const, position: n.position, data: { nodeId: n.id }, dragHandle: '.nc-hdr' })),
    [graph.nodes],
  );
  const edges: Edge[] = React.useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourcePort,
        target: e.target,
        targetHandle: e.targetPort,
        className: runtimes[e.source]?.outputs[e.sourcePort] && runtimes[e.source]?.state === 'success' ? 'active' : '',
      })),
    [graph.edges, runtimes],
  );

  const onNodesChange = (changes: NodeChange<Node>[]) => {
    const removed: string[] = [];
    for (const c of changes) {
      if (c.type === 'position' && c.position && !c.dragging) setNodePosition(c.id, c.position);
      if (c.type === 'remove') removed.push(c.id);
      if (c.type === 'select') select(c.selected ? c.id : null);
    }
    if (removed.length) removeNodes(removed);
  };
  const onEdgesChange = (changes: EdgeChange[]) => {
    const removed = changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id);
    if (removed.length) removeEdges(removed);
  };
  const onConnect = (c: Connection) => {
    if (c.source && c.target && c.sourceHandle && c.targetHandle) connect({ source: c.source, sourcePort: c.sourceHandle, target: c.target, targetPort: c.targetHandle });
  };
  const isValidConnection: IsValidConnection = (c) => {
    const src = getNodeType(graph.nodes.find((n) => n.id === c.source)?.type ?? '');
    const dst = getNodeType(graph.nodes.find((n) => n.id === c.target)?.type ?? '');
    const sp = src?.outputs.find((p) => p.name === c.sourceHandle);
    const tp = dst?.inputs.find((p) => p.name === c.targetHandle);
    return !!sp && !!tp && sp.type === tp.type && c.source !== c.target;
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/nodecine-node');
    if (!type) return;
    addNode(type, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, background: 'var(--bg-canvas)' }} onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onMove={(_, vp) => setZoom(vp.zoom)}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.3}
        maxZoom={2}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg-canvas)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#23262c" />
        <MiniMap position="bottom-left" style={{ marginBottom: 52, marginLeft: 12, width: 172, height: 96 }} nodeColor="#3d424c" maskColor="rgba(10,10,11,.6)" pannable zoomable />
      </ReactFlow>
      <div className="nc-tools" style={{ bottom: 12 }}>
        <div className="nc-tbar">
          <span className="nc-zoom">{Math.round(zoom * 100)}%</span>
          <button className="nc-tbtn" title={t('canvas.zoomIn')} onClick={() => rf.zoomIn()}><Icon.plus /></button>
          <button className="nc-tbtn" title={t('canvas.zoomOut')} onClick={() => rf.zoomOut()}><Icon.minus /></button>
          <button className="nc-tbtn" title={t('canvas.fit')} onClick={() => rf.fitView({ padding: 0.08 })}><Icon.fit /></button>
          <button className="nc-tbtn" title={t('canvas.add')} onClick={() => setPanel('library')}><Icon.plus /></button>
        </div>
      </div>
    </div>
  );
}

export const Canvas: React.FC = () => (
  <ReactFlowProvider>
    <CanvasInner />
  </ReactFlowProvider>
);
