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
  type FinalConnectionState,
  type Edge as RfEdge,
  applyNodeChanges,
} from '@xyflow/react';
import { getNodeType, listNodeTypes } from '@/core/nodes/definition';
import { PORT_LABEL_KEYS, type PortType } from '@/core/types/ports';
import { NODE_META } from '@/lib/node-meta';
import { layoutGraph } from '@/lib/layout';
import { useStudio } from '@/store/useStudio';
import { NodeCard, type NcNode } from './nodes/NodeCard';
import { Icon } from './icons';
import { useT } from './ui';
import { edgeKind } from '@/core/engine/graph';

const nodeTypes = { nc: NodeCard };

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

type GraphNode = { id: string; position: { x: number; y: number } };

/**
 * What a wire dropped on empty canvas can lead to: every node type with a free port of that type,
 * on the other side of the wire. Picking one drops it where the wire ended and connects it.
 */
const PortPicker: React.FC<{ pick: { x: number; y: number; type: PortType; from: 'source' | 'target' }; onAdd: (type: string) => void; onClose: () => void }> = ({ pick, onAdd, onClose }) => {
  const t = useT();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as globalThis.Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  const options = listNodeTypes().filter((d) => (pick.from === 'source' ? d.inputs : d.outputs).some((p) => p.type === pick.type));
  return (
    <div ref={ref} className="nc-menu" style={{ position: 'fixed', left: pick.x, top: pick.y, bottom: 'auto', minWidth: 200, maxHeight: 280, overflowY: 'auto' }} role="menu">
      <div className="nc-menu-title">{t('canvas.connectTo', { port: t(PORT_LABEL_KEYS[pick.type]) })}</div>
      {options.length === 0 && <div className="nc-menu-item nc-dim">{t('canvas.connectNone')}</div>}
      {options.map((d) => {
        const IconC = Icon[NODE_META[d.type]?.icon ?? 'chip'];
        return <button key={d.type} className="nc-menu-item" onClick={() => onAdd(d.type)}><span className="nc-menu-check"><IconC size={11} /></span>{t(`node.${d.type}`)}</button>;
      })}
    </div>
  );
};

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
  const modalOpen = useStudio((s) => !!s.codeEditor);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.canUndo);
  const canRedo = useStudio((s) => s.canRedo);
  const removeNodes = useStudio((s) => s.removeNodes);
  const removeEdges = useStudio((s) => s.removeEdges);
  const connect = useStudio((s) => s.connect);
  const reconnectWire = useStudio((s) => s.reconnect);
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
        // React Flow's own animated edge: a dashed stroke that marches along the wire. Resource wires use it.
        animated: edgeKind(graph, e) === 'resource',
        className: `${edgeKind(graph, e) === 'resource' ? 'nc-edge-resource' : 'nc-edge-flow'} ${runtimes[e.source]?.outputs[e.sourcePort] && runtimes[e.source]?.state === 'success' ? 'active' : ''}`,
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

  // Dragging the end of a wire: onto another port it moves there, into empty space it comes off.
  // React Flow reports the move first and the release second, so a flag tells the two apart.
  const reconnected = React.useRef(false);
  const onReconnectStart = () => { reconnected.current = false; };
  const onReconnect = (oldEdge: RfEdge, c: Connection) => {
    if (!c.source || !c.target || !c.sourceHandle || !c.targetHandle) return;
    reconnected.current = true;
    reconnectWire(oldEdge.id, { source: c.source, sourcePort: c.sourceHandle, target: c.target, targetPort: c.targetHandle });
  };
  const onReconnectEnd = (_e: MouseEvent | TouchEvent, edge: RfEdge) => { if (!reconnected.current) removeEdges([edge.id]); };

  // A wire dropped on empty canvas asks what should go there: only nodes with a port of that type.
  const [pick, setPick] = React.useState<{ x: number; y: number; flow: { x: number; y: number }; nodeId: string; port: string; type: PortType; from: 'source' | 'target' } | null>(null);
  const onConnectEnd = (e: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    // Only a drop on bare canvas asks the question; a drop on a node either connected or was refused.
    if (state.isValid || state.toNode || !state.fromNode || !state.fromHandle?.id) return setPick(null);
    const def = getNodeType(graph.nodes.find((n) => n.id === state.fromNode!.id)?.type ?? '');
    const from = state.fromHandle.type === 'source' ? 'source' : 'target';
    const port = (from === 'source' ? def?.outputs : def?.inputs)?.find((p) => p.name === state.fromHandle!.id);
    if (!port) return setPick(null);
    const point = 'changedTouches' in e ? { x: e.changedTouches[0]!.clientX, y: e.changedTouches[0]!.clientY } : { x: e.clientX, y: e.clientY };
    setPick({ ...point, flow: rf.screenToFlowPosition(point), nodeId: state.fromNode.id, port: port.name, type: port.type, from });
  };
  const addFromPick = (type: string) => {
    if (!pick) return;
    // Dropped left of the card it came from, the new node reads as the one before it, so it goes there.
    const id = addNode(type, { x: pick.flow.x - (pick.from === 'source' ? 0 : 220), y: pick.flow.y - 40 });
    const def = getNodeType(type)!;
    const port = (pick.from === 'source' ? def.inputs : def.outputs).find((p) => p.type === pick.type)!;
    connect(pick.from === 'source'
      ? { source: pick.nodeId, sourcePort: pick.port, target: id, targetPort: port.name }
      : { source: id, sourcePort: port.name, target: pick.nodeId, targetPort: pick.port });
    setPick(null);
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
        onConnectEnd={onConnectEnd}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        reconnectRadius={14}
        isValidConnection={isValidConnection}
        // Shift and drag draws a selection box; the nodes it catches move and delete as one.
        selectionKeyCode="Shift"
        selectionOnDrag={false}
        onPaneClick={() => setPick(null)}
        onMove={(_, vp) => setZoom(vp.zoom)}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        deleteKeyCode={modalOpen ? null : ['Delete', 'Backspace']}
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
      {pick && <PortPicker pick={pick} onAdd={addFromPick} onClose={() => setPick(null)} />}
      <div className="nc-tools" style={{ bottom: 12 }}>
        <div className="nc-tbar">
          <span className="nc-zoom">{Math.round(zoom * 100)}%</span>
          <button className="nc-tbtn" title={t('canvas.zoomIn')} onClick={() => rf.zoomIn()}><Icon.plus /></button>
          <button className="nc-tbtn" title={t('canvas.zoomOut')} onClick={() => rf.zoomOut()}><Icon.minus /></button>
          <button className="nc-tbtn" title={t('canvas.fit')} onClick={() => rf.fitView({ padding: 0.08 })}><Icon.fit /></button>
          <button className="nc-tbtn" title={t('canvas.undo')} disabled={!canUndo} onClick={undo}><Icon.undo /></button>
          <button className="nc-tbtn" title={t('canvas.redo')} disabled={!canRedo} onClick={redo}><Icon.redo /></button>
          <button className="nc-tbtn" title={t('canvas.layout')} onClick={() => {
            // Sizes come from what is actually on screen. React Flow's own `measured` can lag a card
            // that grew after it was first measured — the Video Output player is the usual one — and a
            // resource node hangs *below* its consumer, so a height reported short puts it on top of it.
            const sizes = Object.fromEntries(rf.getNodes().map((n) => {
              const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(n.id)}"]`);
              return [n.id, { width: el?.offsetWidth || n.measured?.width || 220, height: el?.offsetHeight || n.measured?.height || 180 }];
            }));
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
