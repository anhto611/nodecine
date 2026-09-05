'use client';
import React from 'react';
import {
  ReactFlow,
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
import { useStudio } from '@/store/useStudio';
import { NodeCard, type NcNode } from './nodes/NodeCard';
import { Icon } from './icons';
import { Minimap } from './Minimap';
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
  const removeNodes = useStudio((s) => s.removeNodes);
  const removeEdges = useStudio((s) => s.removeEdges);
  const connect = useStudio((s) => s.connect);
  const addNode = useStudio((s) => s.addNode);
  const select = useStudio((s) => s.select);
  const setPanel = useStudio((s) => s.setPanel);
  const rf = useReactFlow();
  const paneRef = React.useRef<HTMLDivElement>(null);
  /**
   * Card sizes read from the DOM. Their layout size is already in flow units (the canvas scales them
   * with a CSS transform), and it is the only reliable source: React Flow keeps its measurements in
   * an internal lookup that an externally controlled node array never receives.
   */
  const [sizes, setSizes] = React.useState<Record<string, { w: number; h: number }>>({});
  React.useEffect(() => {
    const read = () => {
      const next: Record<string, { w: number; h: number }> = {};
      paneRef.current?.querySelectorAll<HTMLElement>('.react-flow__node[data-id]').forEach((el) => {
        const id = el.dataset.id;
        if (id && el.offsetWidth) next[id] = { w: el.offsetWidth, h: el.offsetHeight };
      });
      setSizes((prev) => {
        const ids = Object.keys(next);
        const same = ids.length === Object.keys(prev).length && ids.every((id) => prev[id]?.w === next[id]!.w && prev[id]?.h === next[id]!.h);
        return same ? prev : next;
      });
    };
    read();
    const t = setInterval(read, 400);
    return () => clearInterval(t);
  }, []);

  /** Bounding box of the graph in flow units, cards included. */
  const bounds = React.useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of graph.nodes) {
      const s = sizes[n.id] ?? { w: 196, h: 150 };
      x0 = Math.min(x0, n.position.x);
      y0 = Math.min(y0, n.position.y);
      x1 = Math.max(x1, n.position.x + s.w);
      y1 = Math.max(y1, n.position.y + s.h);
    }
    return Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : { x: 0, y: 0, width: 0, height: 0 };
  }, [graph.nodes, sizes]);
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
  // Panning is otherwise unbounded, and dragging inside the minimap makes that obvious: the viewport
  // walks away from the graph, the minimap's box is the union of the nodes and the viewport, so the
  // node squares shrink towards nothing and the canvas ends up empty. Keep the viewport near the graph.
  const translateExtent = React.useMemo((): [[number, number], [number, number]] => {
    // Enough empty canvas on each side to drop a few new nodes, but small enough that part of the
    // graph always stays on screen: the extent bounds the visible flow rect, not the graph.
    const pad = 800;
    return [
      [bounds.x - pad, bounds.y - pad],
      [bounds.x + bounds.width + pad, bounds.y + bounds.height + pad],
    ];
  }, [bounds]);

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
  /**
   * Fit the graph into view. React Flow's own fitView only considers nodes it has measured into its
   * internal lookup, which never happens for the node array we control, so it silently does nothing.
   * Measuring the rendered cards is both reliable and the same source the minimap uses.
   */
  const fitGraph = React.useCallback(() => {
    const pane = paneRef.current;
    if (!pane || bounds.width === 0) return;
    const pad = 0.08;
    const pw = pane.clientWidth;
    const ph = pane.clientHeight;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((pw * (1 - pad)) / bounds.width, (ph * (1 - pad)) / bounds.height)));
    rf.setViewport({ x: pw / 2 - (bounds.x + bounds.width / 2) * zoom, y: ph / 2 - (bounds.y + bounds.height / 2) * zoom, zoom });
  }, [bounds, rf]);

  // One automatic fit once the cards have been laid out, replacing React Flow's `fitView` prop.
  // The cards are measured from the DOM, so wait until they actually have a layout box.
  const fitted = React.useRef(false);
  React.useEffect(() => {
    if (fitted.current || graph.nodes.length === 0) return;
    let tries = 0;
    const t = setInterval(() => {
      const ready = paneRef.current?.querySelector<HTMLElement>('.react-flow__node[data-id]')?.offsetWidth;
      if (ready || ++tries > 20) {
        clearInterval(t);
        fitted.current = true;
        fitGraph();
      }
    }, 50);
    return () => clearInterval(t);
  }, [graph.nodes, fitGraph]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/nodecine-node');
    if (!type) return;
    addNode(type, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  return (
    <div ref={paneRef} style={{ position: 'relative', flex: 1, minWidth: 0, background: 'var(--bg-canvas)' }} onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onMove={(_, vp) => setZoom(vp.zoom)}
        translateExtent={translateExtent}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg-canvas)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#23262c" />
      </ReactFlow>
      <div className="nc-mini"><Minimap extent={translateExtent} nodes={graph.nodes} sizes={sizes} runtimes={runtimes} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} /></div>
      <div className="nc-tools" style={{ bottom: 12 }}>
        <div className="nc-tbar">
          <span className="nc-zoom">{Math.round(zoom * 100)}%</span>
          <button className="nc-tbtn" title={t('canvas.zoomIn')} onClick={() => rf.zoomIn()}><Icon.plus /></button>
          <button className="nc-tbtn" title={t('canvas.zoomOut')} onClick={() => rf.zoomOut()}><Icon.minus /></button>
          <button className="nc-tbtn" title={t('canvas.fit')} onClick={fitGraph}><Icon.fit /></button>
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
