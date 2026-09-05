'use client';
import React from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type IsValidConnection,
  applyNodeChanges,
} from '@xyflow/react';
import { getNodeType } from '@/core/nodes/definition';
import { layoutGraph } from '@/lib/layout';
import { useStudio } from '@/store/useStudio';
import { NodeCard, type NcNode } from './nodes/NodeCard';
import { Icon } from './icons';
import { useT } from './ui';

const nodeTypes = { nc: NodeCard };

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

type GraphNode = { id: string; position: { x: number; y: number } };
function syncNodes(prev: NcNode[], graphNodes: GraphNode[]): NcNode[] {
  const byId = new Map(prev.map((n) => [n.id, n]));
  return graphNodes.map((n) => {
    const p = byId.get(n.id);
    if (p && p.position.x === n.position.x && p.position.y === n.position.y) return p;
    return { ...(p ?? { data: { nodeId: n.id } }), id: n.id, type: 'nc' as const, position: n.position, dragHandle: '.nc-hdr' };
  });
}

/** The graph canvas: React Flow bound to the store's graph; edges glow once their source has a result. */
function CanvasInner() {
  const t = useT();
  const graph = useStudio((s) => s.graph);
  const runtimes = useStudio((s) => s.runtimes);
  const setNodePosition = useStudio((s) => s.setNodePosition);
  const setNodePositions = useStudio((s) => s.setNodePositions);
  const removeNodes = useStudio((s) => s.removeNodes);
  const removeEdges = useStudio((s) => s.removeEdges);
  const connect = useStudio((s) => s.connect);
  const addNode = useStudio((s) => s.addNode);
  const importWorkflow = useStudio((s) => s.importWorkflow);
  const importVideo = useStudio((s) => s.importWorkflowVideo);
  const select = useStudio((s) => s.select);
  const setPanel = useStudio((s) => s.setPanel);
  const rf = useReactFlow();

  const [zoom, setZoom] = React.useState(1);


  // React Flow owns node positions while a drag is in progress (so the node follows the pointer
  // every frame); the store is only written on drop. `syncNodes` reuses node objects whose
  // position did not change so untouched cards do not re-render.
  const [nodes, setNodes] = React.useState<NcNode[]>(() => syncNodes([], graph.nodes));
  React.useEffect(() => {
    setNodes((prev) => syncNodes(prev, graph.nodes));
  }, [graph.nodes]);
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
    setNodes((ns) => applyNodeChanges(changes, ns as Node[]) as NcNode[]);
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
    if (type) {
      addNode(type, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      return;
    }
    // A workflow file, or a video that carries one: import it, open it in a tab, show the Workflows panel.
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void (async () => {
      const why = /\.mp4$/i.test(file.name) || file.type === 'video/mp4' ? await importVideo(file) : await importWorkflow(await file.text());
      if (why) console.warn(`[nodecine] import failed: ${why}`);
      else if (useStudio.getState().panel !== 'workflows') setPanel('workflows');
    })();
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
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg-canvas)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#23262c" />
        <MiniMap
          pannable
          zoomable
          // The default renders an SVG <title>, which the browser shows as a tooltip on hover. The
          // library falls back to its default for null, so only an empty string removes it, and it
          // forwards no other attributes, so the element ends up without an accessible name.
          ariaLabel=""
          onClick={(_, p) => rf.setCenter(p.x, p.y, { zoom: rf.getZoom(), duration: 200 })}
          bgColor="#242832"
          maskColor="rgba(8,9,12,.86)"
          nodeColor={(n) => {
            const st = runtimes[n.id]?.state;
            return st === 'running' ? '#58a6ff' : st === 'success' ? '#3fb950' : st === 'error' ? '#f85149' : st === 'blocked' ? '#d29922' : '#4a5060';
          }}
          nodeStrokeColor="#5f6570"
          nodeStrokeWidth={6}
          nodeBorderRadius={2}
          style={{ width: 172, height: 97, marginRight: 12, marginBottom: 12 }}
        />
      </ReactFlow>
      <div className="nc-tools" style={{ bottom: 12 }}>
        <div className="nc-tbar">
          <span className="nc-zoom">{Math.round(zoom * 100)}%</span>
          <button className="nc-tbtn" title={t('canvas.zoomIn')} onClick={() => rf.zoomIn()}><Icon.plus /></button>
          <button className="nc-tbtn" title={t('canvas.zoomOut')} onClick={() => rf.zoomOut()}><Icon.minus /></button>
          <button className="nc-tbtn" title={t('canvas.fit')} onClick={() => rf.fitView({ padding: 0.08 })}><Icon.fit /></button>
          <button className="nc-tbtn" title={t('canvas.layout')} onClick={() => {
            // Measured sizes come from React Flow; a node not yet measured gets the default.
            const sizes = Object.fromEntries(rf.getNodes().map((n) => [n.id, { width: n.measured?.width ?? 220, height: n.measured?.height ?? 180 }]));
            setNodePositions(layoutGraph(graph, sizes));
            requestAnimationFrame(() => void rf.fitView({ padding: 0.08, duration: 300 }));
          }}><Icon.branch /></button>
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
