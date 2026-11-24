import { WorkflowEdge, WorkflowNode } from '../../../../types';

/**
 * Lays out workflow nodes in 2D topological layers so parallel branches
 * (e.g. topic -> text & topic -> image, or logic_filter Yes / No branches)
 * sit cleanly side-by-side instead of stacking on a single vertical line.
 */
export function applyParallelAwareGraphLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  let activeEdges = edges.filter(
    (e) =>
      e &&
      e.sourceNodeId &&
      e.targetNodeId &&
      e.sourceNodeId !== e.targetNodeId &&
      nodeIdSet.has(e.sourceNodeId) &&
      nodeIdSet.has(e.targetNodeId)
  );

  // Deduplicate identical source->target pairs
  const seenPairs = new Set<string>();
  activeEdges = activeEdges.filter((e) => {
    const key = `${e.sourceNodeId}->${e.targetNodeId}:${e.branch || 'default'}`;
    if (seenPairs.has(key)) return false;
    seenPairs.add(key);
    return true;
  });

  // Check if every non-trigger node has at least one incoming edge; if graph is disconnected, connect orphans sequentially
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  nodes.forEach((n) => {
    incomingCount.set(n.id, 0);
    outgoingCount.set(n.id, 0);
  });
  activeEdges.forEach((e) => {
    incomingCount.set(e.targetNodeId, (incomingCount.get(e.targetNodeId) || 0) + 1);
    outgoingCount.set(e.sourceNodeId, (outgoingCount.get(e.sourceNodeId) || 0) + 1);
  });

  if (activeEdges.length === 0 && nodes.length > 1) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const src = nodes[i];
      const dst = nodes[i + 1];
      activeEdges.push({
        id: `edge_${i + 1}_${Date.now()}`,
        sourceNodeId: src.id,
        targetNodeId: dst.id,
        branch: src.type === 'logic_filter' ? 'yes' : 'default'
      });
    }
  } else if (nodes.length > 1) {
    // Connect any completely orphaned middle/end nodes that lost an edge during filtering
    for (let i = 1; i < nodes.length; i++) {
      const cur = nodes[i];
      const isTrigger = cur.type === 'trigger_schedule' || cur.type === 'trigger_manual';
      if (!isTrigger && (incomingCount.get(cur.id) || 0) === 0) {
        const prev = nodes[i - 1];
        activeEdges.push({
          id: `edge_auto_${i}_${Date.now()}`,
          sourceNodeId: prev.id,
          targetNodeId: cur.id,
          branch: prev.type === 'logic_filter' ? 'yes' : 'default'
        });
        incomingCount.set(cur.id, 1);
      }
    }
  }

  // Compute longest-path topological layer depth (cycle-safe)
  const depthMap = new Map<string, number>();
  nodes.forEach((n, idx) => {
    const isTrigger = n.type === 'trigger_schedule' || n.type === 'trigger_manual';
    depthMap.set(n.id, isTrigger || idx === 0 ? 0 : -1);
  });

  for (let pass = 0; pass < nodes.length + 1; pass++) {
    let changed = false;
    for (const edge of activeEdges) {
      const srcDepth = depthMap.get(edge.sourceNodeId) ?? 0;
      if (srcDepth < 0) continue;
      const curTargetDepth = depthMap.get(edge.targetNodeId) ?? -1;
      if (srcDepth + 1 > curTargetDepth && srcDepth + 1 <= nodes.length) {
        depthMap.set(edge.targetNodeId, srcDepth + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Fallback depth for any remaining unvisited node
  let fallbackLayer = 0;
  nodes.forEach((n) => {
    const d = depthMap.get(n.id) ?? -1;
    if (d < 0) {
      fallbackLayer += 1;
      depthMap.set(n.id, fallbackLayer);
    } else {
      fallbackLayer = Math.max(fallbackLayer, d);
    }
  });

  const layers = new Map<number, WorkflowNode[]>();
  nodes.forEach((n) => {
    const d = depthMap.get(n.id) || 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(n);
  });

  const sortedDepths = Array.from(layers.keys()).sort((a, b) => a - b);
  const centerX = 320;
  const horizontalGap = 310;
  const verticalGap = 185;

  sortedDepths.forEach((depthKey, layerIdx) => {
    const rowNodes = layers.get(depthKey) || [];
    const count = rowNodes.length;
    rowNodes.forEach((node, colIdx) => {
      if (count === 1) {
        node.x = centerX;
      } else {
        const offsetFromCenter = (colIdx - (count - 1) / 2) * horizontalGap;
        node.x = Math.max(30, Math.round(centerX + offsetFromCenter));
      }
      node.y = 40 + layerIdx * verticalGap;
    });
  });

  return { nodes, edges: activeEdges };
}
