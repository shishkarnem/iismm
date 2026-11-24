import {
  WorkflowNode,
  WorkflowEdge,
  Scenario,
  ScenarioNodeTestRecord
} from '../../../types';
import {
  CANVAS_CARD_WIDTH,
  CANVAS_CARD_HEIGHT,
  NodeTypeDefinition,
  getScenarioActiveFormat
} from '../scenarioDefinitions';

export type ScenarioEdgeFocusPart = 'line' | 'start' | 'end';

export interface ScenarioEdgeModalState {
  edgeId: string;
  focus: ScenarioEdgeFocusPart;
}

export type CanvasWireMode =
  | { kind: 'move_start'; edgeId: string }
  | { kind: 'move_end'; edgeId: string }
  | { kind: 'add_parallel'; sourceNodeId: string; branch: 'yes' | 'no' | 'default' };

export interface ComputedEdgeGeometry {
  edge: WorkflowEdge;
  src: WorkflowNode;
  dst: WorkflowNode;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  midX: number;
  midY: number;
  pathD: string;
  strokeColor: string;
}

/**
 * Computes Bezier geometry and non-overlapping parallel handle offsets
 * so multiple parallel dotted lines leaving or entering a block are clearly visible and clickable.
 */
export function computeScenarioEdgeGeometry(
  edge: WorkflowEdge,
  nodes: WorkflowNode[],
  allEdges: WorkflowEdge[]
): ComputedEdgeGeometry | null {
  const src = nodes.find((n) => n.id === edge.sourceNodeId);
  const dst = nodes.find((n) => n.id === edge.targetNodeId);
  if (!src || !dst) return null;

  const siblingsOut = allEdges.filter((e) => e.sourceNodeId === src.id);
  const siblingsIn = allEdges.filter((e) => e.targetNodeId === dst.id);
  const outIdx = Math.max(0, siblingsOut.findIndex((e) => e.id === edge.id));
  const inIdx = Math.max(0, siblingsIn.findIndex((e) => e.id === edge.id));

  let startX = src.x + CANVAS_CARD_WIDTH / 2;
  if (src.type === 'logic_filter') {
    startX =
      edge.branch === 'no'
        ? src.x + CANVAS_CARD_WIDTH * 0.72
        : src.x + CANVAS_CARD_WIDTH * 0.28;
  } else if (siblingsOut.length > 1) {
    const spread = Math.min(36, 120 / siblingsOut.length);
    startX += (outIdx - (siblingsOut.length - 1) / 2) * spread;
  }

  let endX = dst.x + CANVAS_CARD_WIDTH / 2;
  if (siblingsIn.length > 1) {
    const spread = Math.min(34, 110 / siblingsIn.length);
    endX += (inIdx - (siblingsIn.length - 1) / 2) * spread;
  }

  const startY = src.y + CANVAS_CARD_HEIGHT;
  const endY = dst.y;
  const deltaY = endY - startY;
  const curveOffset = Math.max(46, Math.abs(deltaY) * 0.45);
  const c1x = startX;
  const c1y = startY + curveOffset;
  const c2x = endX;
  const c2y = endY - curveOffset;

  const pathD = `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;

  // Cubic Bezier midpoint at t = 0.5
  const midX = 0.125 * startX + 0.375 * c1x + 0.375 * c2x + 0.125 * endX;
  const midY = 0.125 * startY + 0.375 * c1y + 0.375 * c2y + 0.125 * endY;

  const strokeColor =
    edge.branch === 'no' ? '#f97316' : edge.branch === 'yes' ? '#0284c7' : '#ec4899';

  return {
    edge,
    src,
    dst,
    startX,
    startY,
    endX,
    endY,
    midX,
    midY,
    pathD,
    strokeColor
  };
}

function buildFreshNodeConfig(def: NodeTypeDefinition, scenario: Scenario): Record<string, any> {
  const activeFmt = getScenarioActiveFormat(scenario);
  const freshConfig = JSON.parse(JSON.stringify(def.defaultConfig || {}));
  if (def.type === 'ai_generate_text') {
    freshConfig.messageFormat = activeFmt;
    freshConfig.maxChars = activeFmt === 'rich' ? 8000 : 2500;
    if (activeFmt === 'v2') {
      freshConfig.includeTopicHeading = true;
      freshConfig.headingDecor = 'sparkle';
      freshConfig.topicHeadingTemplate = '{{topic}}';
      freshConfig.v2LayoutPreset = 'magazine_v2';
      freshConfig.v2UseBoldAccents = true;
      freshConfig.v2UseItalicLead = true;
      freshConfig.v2UseMonospace = true;
      freshConfig.v2UseBlockquote = true;
      freshConfig.v2UseEmojiBullets = true;
    }
  }
  if (def.type === 'format_beauty_post') {
    freshConfig.includeTopicHeading = true;
    freshConfig.topicHeadingTemplate = '{{topic}}';
    freshConfig.v2LayoutPreset = 'magazine_v2';
    freshConfig.richLayoutPreset = 'editorial_longread';
  }
  if (def.type === 'publish_post' && scenario.targetChannels?.length) {
    freshConfig.channels = [...scenario.targetChannels];
    freshConfig.channelId = scenario.targetChannels[0];
  }
  return freshConfig;
}

/**
 * Inserts a new block directly onto an existing dotted edge (A -> NewBlock -> B)
 * and shifts lower nodes down if needed so cards remain clean and readable.
 */
export function insertNodeOnEdge(params: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeId: string;
  def: NodeTypeDefinition;
  scenario: Scenario;
}): { nodes: WorkflowNode[]; edges: WorkflowEdge[]; insertedNode: WorkflowNode } | null {
  const { nodes, edges, edgeId, def, scenario } = params;
  const targetEdge = edges.find((e) => e.id === edgeId);
  if (!targetEdge) return null;

  const src = nodes.find((n) => n.id === targetEdge.sourceNodeId);
  const dst = nodes.find((n) => n.id === targetEdge.targetNodeId);
  if (!src || !dst) return null;

  const nowTag = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const newNodeId = `node_${nowTag}`;
  const midX = Math.max(30, Math.round((src.x + dst.x) / 2));
  const desiredY = src.y + 185;
  const shiftDown = dst.y < desiredY + 165 ? desiredY + 185 - dst.y : 0;

  const updatedNodes = nodes.map((n) => {
    if (shiftDown > 0 && n.id !== src.id && n.y >= dst.y) {
      return { ...n, y: n.y + shiftDown };
    }
    return n;
  });

  const insertedNode: WorkflowNode = {
    id: newNodeId,
    type: def.type,
    title: def.title,
    subtitle: def.categoryTitle,
    x: midX,
    y: desiredY,
    enabled: true,
    isUnderDevelopment: Boolean(def.isUnderDevelopment),
    cost: def.cost,
    config: buildFreshNodeConfig(def, scenario)
  };

  const srcIdx = updatedNodes.findIndex((n) => n.id === src.id);
  const nextNodes = [...updatedNodes];
  if (srcIdx >= 0) {
    nextNodes.splice(srcIdx + 1, 0, insertedNode);
  } else {
    nextNodes.push(insertedNode);
  }

  const edge1: WorkflowEdge = {
    id: `edge_${nowTag}_a`,
    sourceNodeId: src.id,
    targetNodeId: newNodeId,
    branch: targetEdge.branch || (src.type === 'logic_filter' ? 'yes' : 'default')
  };
  const edge2: WorkflowEdge = {
    id: `edge_${nowTag}_b`,
    sourceNodeId: newNodeId,
    targetNodeId: dst.id,
    branch: def.type === 'logic_filter' ? 'yes' : 'default'
  };

  const nextEdges = edges.flatMap((e) => (e.id === edgeId ? [edge1, edge2] : [e]));
  return { nodes: nextNodes, edges: nextEdges, insertedNode };
}

/**
 * Moves the start (sourceNodeId) or end (targetNodeId) of an existing dotted line to another block.
 */
export function reconnectEdgeEndpoint(params: {
  edges: WorkflowEdge[];
  nodes: WorkflowNode[];
  edgeId: string;
  side: 'start' | 'end';
  newNodeId: string;
}): { edges: WorkflowEdge[]; error?: string } {
  const { edges, nodes, edgeId, side, newNodeId } = params;
  const edge = edges.find((e) => e.id === edgeId);
  if (!edge) return { edges, error: 'Линия связи не найдена' };

  const nextSource = side === 'start' ? newNodeId : edge.sourceNodeId;
  const nextTarget = side === 'end' ? newNodeId : edge.targetNodeId;

  if (nextSource === nextTarget) {
    return { edges, error: 'Нельзя соединить блок сам с собой' };
  }

  const targetNode = nodes.find((n) => n.id === nextTarget);
  if (targetNode && (targetNode.type === 'trigger_schedule' || targetNode.type === 'trigger_manual')) {
    return { edges, error: 'Стартовый триггер не может принимать входящую линию' };
  }

  const duplicate = edges.some(
    (e) =>
      e.id !== edgeId &&
      e.sourceNodeId === nextSource &&
      e.targetNodeId === nextTarget
  );
  if (duplicate) {
    return { edges, error: 'Такая линия связи между этими блоками уже существует' };
  }

  const srcNode = nodes.find((n) => n.id === nextSource);
  const nextBranch: 'yes' | 'no' | 'default' =
    srcNode?.type === 'logic_filter'
      ? edge.branch === 'no'
        ? 'no'
        : 'yes'
      : 'default';

  const updated = edges.map((e) =>
    e.id === edgeId
      ? { ...e, sourceNodeId: nextSource, targetNodeId: nextTarget, branch: nextBranch }
      : e
  );
  return { edges: updated };
}

/**
 * Adds a parallel dotted line from sourceNodeId to an existing targetNodeId.
 */
export function addParallelEdgeToExisting(params: {
  edges: WorkflowEdge[];
  nodes: WorkflowNode[];
  sourceNodeId: string;
  targetNodeId: string;
  branch?: 'yes' | 'no' | 'default';
}): { edges: WorkflowEdge[]; newEdge?: WorkflowEdge; error?: string } {
  const { edges, nodes, sourceNodeId, targetNodeId, branch } = params;
  if (sourceNodeId === targetNodeId) {
    return { edges, error: 'Выберите другой целевой блок для параллельной линии' };
  }
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  if (targetNode && (targetNode.type === 'trigger_schedule' || targetNode.type === 'trigger_manual')) {
    return { edges, error: 'Нельзя вести параллельную линию в стартовый триггер' };
  }
  const exists = edges.some(
    (e) => e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId
  );
  if (exists) {
    return { edges, error: 'Линия между этими блоками уже проведена' };
  }
  const srcNode = nodes.find((n) => n.id === sourceNodeId);
  const resolvedBranch: 'yes' | 'no' | 'default' =
    srcNode?.type === 'logic_filter' ? (branch === 'no' ? 'no' : 'yes') : 'default';

  const newEdge: WorkflowEdge = {
    id: `edge_par_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    sourceNodeId,
    targetNodeId,
    branch: resolvedBranch
  };
  return { edges: [...edges, newEdge], newEdge };
}

/**
 * Creates a brand-new parallel block side-by-side and connects a parallel dotted line from sourceNodeId.
 */
export function addParallelNodeAndEdge(params: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  sourceNodeId: string;
  def: NodeTypeDefinition;
  scenario: Scenario;
  branch?: 'yes' | 'no' | 'default';
}): { nodes: WorkflowNode[]; edges: WorkflowEdge[]; createdNode: WorkflowNode; createdEdge: WorkflowEdge } | null {
  const { nodes, edges, sourceNodeId, def, scenario, branch } = params;
  const src = nodes.find((n) => n.id === sourceNodeId);
  if (!src) return null;

  const existingTargets = edges
    .filter((e) => e.sourceNodeId === sourceNodeId)
    .map((e) => nodes.find((n) => n.id === e.targetNodeId))
    .filter(Boolean) as WorkflowNode[];

  const targetY = existingTargets.length > 0 ? existingTargets[0].y : src.y + 185;
  const maxExistingX =
    existingTargets.length > 0
      ? Math.max(...existingTargets.map((t) => t.x))
      : src.x;
  const parallelX = existingTargets.length > 0 ? maxExistingX + 305 : src.x + 305;

  const nowTag = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const createdNode: WorkflowNode = {
    id: `node_par_${nowTag}`,
    type: def.type,
    title: def.title,
    subtitle: def.categoryTitle,
    x: parallelX,
    y: targetY,
    enabled: true,
    isUnderDevelopment: Boolean(def.isUnderDevelopment),
    cost: def.cost,
    config: buildFreshNodeConfig(def, scenario)
  };

  const resolvedBranch: 'yes' | 'no' | 'default' =
    src.type === 'logic_filter' ? (branch === 'no' ? 'no' : 'yes') : 'default';

  const createdEdge: WorkflowEdge = {
    id: `edge_par_${nowTag}`,
    sourceNodeId: src.id,
    targetNodeId: createdNode.id,
    branch: resolvedBranch
  };

  return {
    nodes: [...nodes, createdNode],
    edges: [...edges, createdEdge],
    createdNode,
    createdEdge
  };
}

export interface LiveStepPreviewSummary {
  headline: string;
  snippet: string;
  imageUrl?: string;
  imageCount: number;
}

/**
 * Extracts a concise, readable real-time result preview from a completed step's DB/stream record
 * so blocks immediately show their generated result while subsequent steps are still running.
 */
export function summarizeStepLivePreview(
  record?: ScenarioNodeTestRecord | null
): LiveStepPreviewSummary | null {
  if (!record) return null;
  const out: any = record.output || {};
  const imgs: string[] = Array.isArray(out.imageUrls)
    ? out.imageUrls.filter(Boolean)
    : out.imageUrl
    ? [out.imageUrl]
    : [];

  const cleanStrip = (raw: string) =>
    String(raw || '')
      .replace(/<[^>]+>/g, '')
      .replace(/^[#>*\-\s]+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

  const rawTopic = cleanStrip(out.topic || out.title || '');
  const rawText = cleanStrip(out.text || out.imagePrompt || out.message || out.summary || '');

  let headline = rawTopic;
  let snippet = rawText;

  if (!headline && snippet) {
    headline = snippet.slice(0, 72) + (snippet.length > 72 ? '…' : '');
    snippet = snippet.length > 72 ? snippet.slice(0, 140) + '…' : '';
  } else if (snippet) {
    if (snippet.toLowerCase().startsWith(headline.toLowerCase())) {
      snippet = snippet.slice(headline.length).trim();
    }
    if (snippet.length > 130) {
      snippet = snippet.slice(0, 130) + '…';
    }
  }

  if (!headline && imgs.length > 0) {
    headline = `Сгенерировано медиа: ${imgs.length} шт.`;
  }
  if (!headline && out.message) {
    headline = cleanStrip(out.message).slice(0, 90);
  }
  if (!headline) return null;

  return {
    headline,
    snippet,
    imageUrl: imgs[0],
    imageCount: imgs.length
  };
}

/**
 * Background real-time poller for /api/scenarios/:id/live-status during active chain runs.
 * Guarantees immediate delivery of every completed step's DB record and live % progress
 * even if an upstream HTTP proxy buffers small stream frames.
 */
export function startLiveScenarioStatusPoller(params: {
  scenarioId?: string;
  onProgressUpdate: (
    updater: (prev: any) => any
  ) => void;
  onStepRecord: (nodeId: string, record: ScenarioNodeTestRecord) => void;
}): () => void {
  const cleanId = String(params.scenarioId || '').trim();
  if (!cleanId) return () => {};

  let stopped = false;
  const deliveredSignatures = new Map<string, string>();

  const pollOnce = async () => {
    if (stopped) return;
    try {
      const res = await fetch(
        `/api/scenarios/${encodeURIComponent(cleanId)}/live-status?t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!res.ok || stopped) return;
      const data = await res.json();
      if (stopped) return;

      const records: Record<string, ScenarioNodeTestRecord> = data?.testResults || {};
      Object.entries(records).forEach(([nodeId, rec]) => {
        if (!rec) return;
        const sig = `${rec.testedAt || ''}_${rec.mode || ''}`;
        if (deliveredSignatures.get(nodeId) !== sig) {
          deliveredSignatures.set(nodeId, sig);
          params.onStepRecord(nodeId, rec);
        }
      });

      const live = data?.liveProgress;
      if (live && live.isRunning) {
        params.onProgressUpdate((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            percent: Math.max(prev.percent || 0, Number(live.percent || 0)),
            activeNodeId: live.activeNodeId || prev.activeNodeId,
            activeNodeTitle: live.activeNodeTitle || prev.activeNodeTitle,
            statusText: live.statusText || prev.statusText,
            steps:
              Array.isArray(live.steps) && live.steps.length > 0
                ? live.steps
                : prev.steps
          };
        });
      }
    } catch {
      // ignore transient poll error
    }
  };

  const timer = setInterval(pollOnce, 1050);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

