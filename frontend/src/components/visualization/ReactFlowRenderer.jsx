import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Edit2, Check, X } from 'lucide-react';

export const ReactFlowRenderer = ({
  data,
  visualizationType = 'concept_map',
  isEditable = false,
  onDataChange,
  containerRef,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');

  // Automatically layout nodes in a clean hierarchical or organic grid
  const initialLayout = useMemo(() => {
    if (!data?.nodes) return { nodes: [], edges: [] };

    const rawNodes = data.nodes || [];
    const rawEdges = data.edges || [];

    const isMindMap = visualizationType === 'mind_map';
    const nodeCount = rawNodes.length;

    // Identify root or starting nodes
    const incomingEdgeCounts = {};
    rawNodes.forEach((n) => { incomingEdgeCounts[n.id] = 0; });
    rawEdges.forEach((e) => {
      if (incomingEdgeCounts[e.target] !== undefined) {
        incomingEdgeCounts[e.target] += 1;
      }
    });

    const rootNodes = rawNodes.filter((n) => incomingEdgeCounts[n.id] === 0 || n.type === 'root');
    const rootId = rootNodes[0]?.id || rawNodes[0]?.id;

    // Layout configuration
    const computedNodes = rawNodes.map((n, idx) => {
      let x = 200;
      let y = 100;

      if (isMindMap) {
        // Mind Map Radial/Branch layout
        if (n.id === rootId || n.type === 'root') {
          x = 400;
          y = 300;
        } else if (n.type === 'branch') {
          // Spread main branches in a circle
          const branchIdx = idx;
          const angle = (branchIdx / Math.max(1, nodeCount)) * 2 * Math.PI;
          x = 400 + Math.cos(angle) * 280;
          y = 300 + Math.sin(angle) * 200;
        } else {
          // Subtopics
          const parentEdge = rawEdges.find((e) => e.target === n.id);
          const parentIdx = rawNodes.findIndex((pn) => pn.id === parentEdge?.source);
          const offsetAngle = ((parentIdx + 1) * 0.7) + (idx * 0.4);
          x = 400 + Math.cos(offsetAngle) * 440;
          y = 300 + Math.sin(offsetAngle) * 320;
        }
      } else {
        // Concept Map Layered Grid layout
        const colWidth = 260;
        const rowHeight = 140;
        const cols = Math.ceil(Math.sqrt(nodeCount * 1.5));
        const col = idx % cols;
        const row = Math.floor(idx / cols);

        x = 80 + col * colWidth + (row % 2 === 1 ? 40 : 0);
        y = 60 + row * rowHeight;
      }

      // Styled custom styling based on category
      const isRoot = n.id === rootId || n.type === 'root';
      const isBranch = n.type === 'branch';

      return {
        id: n.id,
        position: { x, y },
        data: {
          label: n.label,
          description: n.description || '',
          type: n.type || 'concept',
          isRoot,
        },
        style: {
          background: isRoot
            ? '#2563EB'
            : isBranch
            ? '#3B82F6'
            : '#FFFFFF',
          color: isRoot || isBranch ? '#FFFFFF' : '#1E293B',
          border: isRoot
            ? '2px solid #1D4ED8'
            : isBranch
            ? '2px solid #2563EB'
            : '1.5px solid #CBD5E1',
          borderRadius: isRoot ? '16px' : '12px',
          padding: '12px 16px',
          fontWeight: isRoot ? '700' : '600',
          fontSize: isRoot ? '14px' : '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          minWidth: '140px',
          maxWidth: '220px',
          textAlign: 'center',
          cursor: isEditable ? 'pointer' : 'default',
        },
      };
    });

    const computedEdges = rawEdges.map((e, idx) => ({
      id: e.id || `edge-${idx}`,
      source: e.source,
      target: e.target,
      label: e.label || '',
      type: isMindMap ? 'smoothstep' : 'default',
      animated: isMindMap,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: '#64748B',
      },
      style: { stroke: '#94A3B8', strokeWidth: 1.5 },
      labelStyle: { fill: '#475569', fontWeight: 600, fontSize: 10 },
      labelBgStyle: { fill: '#F8FAFC', fillOpacity: 0.9, rx: 4, ry: 4 },
    }));

    return { nodes: computedNodes, edges: computedEdges };
  }, [data, visualizationType, isEditable]);

  useEffect(() => {
    setNodes(initialLayout.nodes);
    setEdges(initialLayout.edges);
  }, [initialLayout]);

  const onNodeClick = useCallback(
    (event, node) => {
      setSelectedNode(node);
      setEditingLabel(node.data.label);
    },
    []
  );

  const saveNodeEdit = () => {
    if (!selectedNode) return;
    const updatedNodes = nodes.map((n) => {
      if (n.id === selectedNode.id) {
        return {
          ...n,
          data: { ...n.data, label: editingLabel },
        };
      }
      return n;
    });

    setNodes(updatedNodes);
    setSelectedNode(null);

    if (onDataChange) {
      onDataChange({
        ...data,
        nodes: updatedNodes.map((un) => ({
          id: un.id,
          label: un.data.label,
          description: un.data.description,
          type: un.data.type,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
        })),
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[520px] relative rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-slate-900/30 reactflow-export-target"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls showInteractive={false} className="!bg-white dark:!bg-surface-dark !border-border-light dark:!border-border-dark !shadow-xs" />
        <MiniMap
          nodeColor={(n) => (n.data?.isRoot ? '#2563EB' : '#94A3B8')}
          className="!bg-white/80 dark:!bg-surface-dark/80 !border-border-light dark:!border-border-dark"
        />
        <Background variant="dots" gap={16} size={1} color="#CBD5E1" />
      </ReactFlow>

      {/* Node Editing Modal / Floating Bar */}
      {isEditable && selectedNode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-surface-dark p-3 rounded-xl border border-primary/40 shadow-lg flex items-center gap-2 z-20 animate-in fade-in slide-in-from-bottom-2">
          <Edit2 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-text-secondary uppercase">
              Editing Node: {selectedNode.id}
            </span>
            <input
              type="text"
              value={editingLabel}
              onChange={(e) => setEditingLabel(e.target.value)}
              className="text-xs font-semibold px-2 py-1 border border-border-light dark:border-border-dark rounded-md bg-background-light dark:bg-surface-elevated text-text-primary dark:text-text-darkPrimary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={saveNodeEdit}
            className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
            title="Save Node Label"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedNode(null)}
            className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-text-secondary hover:bg-black/10"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ReactFlowRenderer;
