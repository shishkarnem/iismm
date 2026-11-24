import React, { useRef, useState } from 'react';
import {
  Bot,
  Plus,
  Minus,
  Trash2,
  Edit3,
  Play,
  Eye,
  ArrowUp,
  ArrowDown,
  Maximize2,
  HelpCircle,
  Lock,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import {
  Scenario,
  WorkflowNode,
  ScenarioNodeTestRecord,
  ScenarioTestProgressState
} from '../../types';
import { ScenarioImageCosts } from './ScenarioImageNodeConfig';
import {
  CANVAS_CARD_WIDTH,
  CANVAS_CARD_HEIGHT,
  resolveNodeDef,
  getDynamicNodeCost,
  buildBasicNodeSubtitle
} from './scenarioDefinitions';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../ui-kit/ResponsiveActionBtn';
import {
  CanvasWireMode,
  ScenarioEdgeFocusPart,
  summarizeStepLivePreview
} from './edges/edgeOperations';
import {
  ScenarioEdgesSvgLayer,
  ScenarioWireModeBanner
} from './edges/ScenarioEdgesSvgLayer';

interface ScenarioCanvasAndListProps {
  currentScenario: Scenario;
  editorViewMode: 'canvas' | 'list';
  selectedNodeId: string | null;
  connectingSourceNodeId: string | null;
  connectingBranch?: 'yes' | 'no';
  canvasWireMode?: CanvasWireMode | null;
  isTestingNode: boolean;
  testProgress?: ScenarioTestProgressState | null;
  costs: ScenarioImageCosts;
  dbTestResults: Record<string, ScenarioNodeTestRecord>;
  onSelectNode: (nodeId: string) => void;
  onOpenNodeConfig: (nodeId: string) => void;
  onOpenTestChoice: (node: WorkflowNode) => void;
  onOpenResultModal: (node: WorkflowNode) => void;
  onOpenConnectModal: (sourceNodeId: string, preferredBranch?: 'yes' | 'no') => void;
  onConnectNodes: (sourceId: string, targetId: string, branch?: 'yes' | 'no' | 'default') => void;
  onSelectEdge: (edgeId: string, focus: ScenarioEdgeFocusPart) => void;
  onCanvasWireNodeClick?: (nodeId: string) => boolean;
  onCancelWireMode?: () => void;
  onDeleteEdge: (edgeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newTitle: string) => void;
  onMoveNode: (nodeId: string, newX: number, newY: number, commitToDb: boolean) => void;
  onOpenHelp: (e: React.MouseEvent, key: string, title: string, fallbackText: string) => void;
}

function formatShortCost(cost: number, isUnderDev: boolean): string {
  if (isUnderDev) return 'Скоро';
  if (cost <= 0) return 'Бесплатно';
  if (cost === 1) return '1 Иирка';
  if (cost >= 2 && cost <= 4) return `${cost} Иирки`;
  return `${cost} Иирок`;
}

export const ScenarioCanvasAndList: React.FC<ScenarioCanvasAndListProps> = ({
  currentScenario,
  editorViewMode,
  selectedNodeId,
  connectingSourceNodeId,
  connectingBranch,
  canvasWireMode,
  isTestingNode,
  testProgress,
  costs,
  dbTestResults,
  onSelectNode,
  onOpenNodeConfig,
  onOpenTestChoice,
  onOpenResultModal,
  onOpenConnectModal,
  onConnectNodes,
  onSelectEdge,
  onCanvasWireNodeClick,
  onCancelWireMode,
  onDeleteEdge,
  onDeleteNode,
  onRenameNode,
  onMoveNode,
  onOpenHelp
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 0.85;
    return 1.0;
  });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({
    clientX: 0,
    clientY: 0,
    canvasX: 0,
    canvasY: 0
  });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({
    clientX: 0,
    clientY: 0,
    initialX: 0,
    initialY: 0
  });
  const [nodeClickStart, setNodeClickStart] = useState<{ x: number; y: number } | null>(null);

  const [editingTitleNodeId, setEditingTitleNodeId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState<string>('');

  const halfCardW = CANVAS_CARD_WIDTH / 2;

  const handlePanToTop = () => {
    const firstNode = currentScenario.nodes?.[0];
    if (canvasRef.current) {
      const cw = canvasRef.current.clientWidth;
      const targetX = firstNode ? firstNode.x + halfCardW : 450;
      setCanvasOffset({
        x: cw / zoom / 2 - targetX,
        y: 40
      });
    }
  };

  const handlePanToBottom = () => {
    const nodes = currentScenario.nodes || [];
    if (nodes.length === 0 || !canvasRef.current) return;
    const lastNode = nodes[nodes.length - 1];
    const cw = canvasRef.current.clientWidth;
    const ch = canvasRef.current.clientHeight;
    setCanvasOffset({
      x: cw / zoom / 2 - (lastNode.x + halfCardW),
      y: ch / zoom / 2 - (lastNode.y + CANVAS_CARD_HEIGHT / 2)
    });
  };

  const handleCenterCanvas = () => {
    const nodes = currentScenario.nodes || [];
    if (nodes.length === 0 || !canvasRef.current) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x + CANVAS_CARD_WIDTH));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y + CANVAS_CARD_HEIGHT));

    const cw = canvasRef.current.clientWidth;
    const ch = canvasRef.current.clientHeight;
    const tapeWidth = Math.max(300, maxX - minX);
    const tapeHeight = Math.max(360, maxY - minY);

    const scaleX = (cw * 0.85) / tapeWidth;
    const scaleY = (ch * 0.85) / tapeHeight;
    const optimalScale = Math.min(1.2, Math.max(0.45, Math.min(scaleX, scaleY)));
    const roundedScale = Math.round(optimalScale * 20) / 20;

    setZoom(roundedScale);
    setCanvasOffset({
      x: cw / roundedScale / 2 - (minX + tapeWidth / 2),
      y: Math.max(20, ch / roundedScale / 2 - (minY + tapeHeight / 2))
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.workflow-node-card')) return;
    setIsDraggingCanvas(true);
    setDragStartPos({
      clientX: e.clientX,
      clientY: e.clientY,
      canvasX: canvasOffset.x,
      canvasY: canvasOffset.y
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      const dx = (e.clientX - dragStartPos.clientX) / zoom;
      const dy = (e.clientY - dragStartPos.clientY) / zoom;
      setCanvasOffset({
        x: dragStartPos.canvasX + dx,
        y: dragStartPos.canvasY + dy
      });
    } else if (draggingNodeId) {
      const dx = (e.clientX - nodeDragOffset.clientX) / zoom;
      const dy = (e.clientY - nodeDragOffset.clientY) / zoom;
      const newX = Math.max(20, Math.round(nodeDragOffset.initialX + dx));
      const newY = Math.max(20, Math.round(nodeDragOffset.initialY + dy));
      onMoveNode(draggingNodeId, newX, newY, false);
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (draggingNodeId && nodeClickStart) {
      const dist = Math.hypot(e.clientX - nodeClickStart.x, e.clientY - nodeClickStart.y);
      if (dist < 6) {
        if (canvasWireMode && onCanvasWireNodeClick?.(draggingNodeId)) {
          // Handled wire reconnection / parallel connection on canvas
        } else {
          onOpenNodeConfig(draggingNodeId);
        }
      } else {
        const moved = currentScenario.nodes?.find((n) => n.id === draggingNodeId);
        if (moved) {
          onMoveNode(draggingNodeId, moved.x, moved.y, true);
        }
      }
    }
    setIsDraggingCanvas(false);
    setDraggingNodeId(null);
    setNodeClickStart(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: WorkflowNode) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    e.stopPropagation();
    onSelectNode(node.id);
    setDraggingNodeId(node.id);
    setNodeClickStart({ x: e.clientX, y: e.clientY });
    setNodeDragOffset({
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: node.x,
      initialY: node.y
    });
  };

  const commitTitleEdit = (nodeId: string) => {
    if (editingTitleText.trim()) {
      onRenameNode(nodeId, editingTitleText.trim());
    }
    setEditingTitleNodeId(null);
  };

  if (editorViewMode === 'canvas') {
    return (
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onWheel={(e) => {
          setCanvasOffset((prev) => ({
            x: prev.x - (e.deltaX * 0.7) / zoom,
            y: prev.y - (e.deltaY * 0.7) / zoom
          }));
        }}
        className="relative w-full h-[640px] md:h-[740px] rounded-3xl border-2 border-pink-300 overflow-hidden select-none bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 backdrop-blur-md shadow-inner cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(236, 72, 153, 0.16) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }}
      >
        <ScenarioWireModeBanner
          wireMode={canvasWireMode || null}
          onCancel={() => onCancelWireMode?.()}
        />

        {/* Canvas Floating Navigation & Zoom Controls */}
        <div className="absolute top-3 right-3 z-30 flex flex-wrap items-center gap-1.5 bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md p-1.5 rounded-2xl border border-pink-300 shadow-md">
          <div className="flex items-center gap-1 bg-white/80 rounded-xl px-1.5 py-1 border border-pink-200">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.05) * 100) / 100))}
              className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white border border-pink-200 text-slate-800 text-[14px] font-bold flex items-center justify-center cursor-pointer"
              title="Уменьшить масштаб (-5%)"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1.0)}
              className="px-2 h-8 rounded-lg bg-white/90 hover:bg-white border border-pink-200 text-slate-900 text-[14px] font-bold flex items-center justify-center cursor-pointer min-w-[54px]"
              title="Сбросить масштаб на 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.05) * 100) / 100))}
              className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white border border-pink-200 text-slate-800 text-[14px] font-bold flex items-center justify-center cursor-pointer"
              title="Увеличить масштаб (+5%)"
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={handlePanToTop}
            className="min-w-[36px] min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-200 text-slate-800 text-[14px] font-bold cursor-pointer flex items-center justify-center gap-1"
            title="В начало ленты"
          >
            <ArrowUp size={15} className="text-pink-600" />
            <span className="hidden sm:inline">Вверх</span>
          </button>

          <button
            type="button"
            onClick={handlePanToBottom}
            className="min-w-[36px] min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-200 text-slate-800 text-[14px] font-bold cursor-pointer flex items-center justify-center gap-1"
            title="Вниз ленты"
          >
            <ArrowDown size={15} className="text-pink-600" />
            <span className="hidden sm:inline">Вниз</span>
          </button>

          <button
            type="button"
            onClick={handleCenterCanvas}
            className="min-w-[36px] min-h-[36px] p-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-200 text-slate-800 cursor-pointer flex items-center justify-center"
            title="Центрировать схему"
          >
            <Maximize2 size={15} className="text-sky-600" />
          </button>
        </div>

        {/* Scaled & Translated Interactive World */}
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `scale(${zoom}) translate(${canvasOffset.x}px, ${canvasOffset.y}px)`
          }}
        >
          <ScenarioEdgesSvgLayer
            nodes={currentScenario.nodes || []}
            edges={currentScenario.edges || []}
            onSelectEdge={onSelectEdge}
          />

          {/* Minimalist Fixed-Size Node Cards (With Real-Time Live Result Preview) */}
          {(currentScenario.nodes || []).map((node, nodeIdx) => {
            const def = resolveNodeDef(node.type);
            const IconComp = def?.icon || Bot;
            const isSelected = selectedNodeId === node.id;
            const isUnderDev = Boolean(node.isUnderDevelopment || node.type === 'ai_rewrite');
            const dynamicCost = getDynamicNodeCost(node, costs, currentScenario);
            const basicSubtitle = buildBasicNodeSubtitle(node, currentScenario, costs);
            const nodeRecord = dbTestResults?.[node.id];
            const hasDbResult = Boolean(nodeRecord);
            const liveSummary = summarizeStepLivePreview(nodeRecord);
            const stepProg = testProgress?.isRunning
              ? testProgress.steps.find((s) => s.nodeId === node.id)
              : undefined;
            const isNodeRunning = Boolean(
              testProgress?.isRunning &&
                (testProgress.activeNodeId === node.id || stepProg?.status === 'running')
            );
            const isNodeDoneInRun = Boolean(stepProg?.status === 'done');

            return (
              <div
                key={node.id}
                id={`node-card-${node.id}`}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${CANVAS_CARD_WIDTH}px`,
                  height: `${CANVAS_CARD_HEIGHT}px`,
                  zIndex: isNodeRunning ? 15 : isSelected ? 10 : 2
                }}
                className={`workflow-node-card absolute rounded-2xl border-2 transition-all cursor-pointer p-3 flex flex-col justify-between backdrop-blur-md shadow-md ${
                  isNodeRunning
                    ? 'bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 border-pink-500 ring-4 ring-sky-400/70 shadow-2xl'
                    : isSelected
                    ? 'bg-gradient-to-r from-sky-100/88 via-pink-100/88 via-orange-100/88 via-pink-100/88 to-sky-100/88 border-pink-500 shadow-xl ring-2 ring-pink-300'
                    : 'bg-gradient-to-r from-sky-100/82 via-pink-100/82 via-orange-100/82 via-pink-100/82 to-sky-100/82 border-pink-300 hover:border-pink-400'
                } ${isUnderDev ? 'opacity-65 cursor-not-allowed' : ''}`}
              >
                {/* Top Input Port */}
                {node.type !== 'trigger_schedule' && node.type !== 'trigger_manual' && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (connectingSourceNodeId && connectingSourceNodeId !== node.id) {
                        onConnectNodes(connectingSourceNodeId, node.id, connectingBranch);
                      }
                    }}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 border-2 border-white shadow-xs cursor-pointer flex items-center justify-center hover:scale-125 transition-transform z-20"
                    title="Вход связи сверху"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}

                {/* Bottom Output Ports */}
                {node.type === 'logic_filter' ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenConnectModal(node.id, 'yes');
                      }}
                      style={{ left: '30%' }}
                      className="absolute -bottom-3.5 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-sky-500 to-pink-500 text-white border-2 border-white shadow-xs cursor-pointer text-[14px] leading-none font-bold hover:scale-110 transition-transform z-20"
                      title="Подключить ветку «Да»"
                    >
                      Да
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenConnectModal(node.id, 'no');
                      }}
                      style={{ left: '70%' }}
                      className="absolute -bottom-3.5 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white border-2 border-white shadow-xs cursor-pointer text-[14px] leading-none font-bold hover:scale-110 transition-transform z-20"
                      title="Подключить ветку «Нет»"
                    >
                      Нет
                    </button>
                  </>
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenConnectModal(node.id);
                    }}
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 border-2 border-white shadow-xs cursor-pointer flex items-center justify-center hover:scale-125 transition-transform z-20"
                    title="Выход связи вниз"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}

                {/* Row 1: Header (Icon + Title + Help) */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="p-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-pink-500 text-white shadow-2xs shrink-0">
                      <IconComp size={14} />
                    </span>

                    {editingTitleNodeId === node.id ? (
                      <input
                        type="text"
                        value={editingTitleText}
                        onChange={(e) => setEditingTitleText(e.target.value)}
                        onBlur={() => commitTitleEdit(node.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitTitleEdit(node.id);
                          if (e.key === 'Escape') setEditingTitleNodeId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white border border-pink-400 rounded-lg px-2 py-0.5 text-[14px] font-bold text-slate-900 w-full focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span
                          className="text-[14px] font-bold text-slate-900 truncate"
                          title={node.title}
                        >
                          {node.title}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTitleNodeId(node.id);
                            setEditingTitleText(node.title);
                          }}
                          className="p-0.5 text-slate-500 hover:text-pink-600 transition-colors shrink-0 cursor-pointer"
                          title="Переименовать блок"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) =>
                      onOpenHelp(
                        e,
                        `block_${node.type}`,
                        node.title,
                        def?.description || 'Справка по блоку'
                      )
                    }
                    className="p-0.5 rounded-lg text-slate-500 hover:text-pink-600 cursor-pointer shrink-0"
                    title="Инструкция к блоку"
                  >
                    <HelpCircle size={15} />
                  </button>
                </div>

                {/* Row 2: Real-Time Summary / Live Step Output */}
                <div className="min-w-0 px-0.5">
                  {isNodeRunning ? (
                    <span className="text-[14px] text-pink-700 font-bold truncate flex items-center gap-1.5">
                      <Loader2 size={13} className="animate-spin shrink-0" />
                      <span className="truncate">
                        В работе · {stepProg?.stepPercent ?? testProgress?.percent ?? 15}%
                      </span>
                    </span>
                  ) : isNodeDoneInRun && liveSummary ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenResultModal(node);
                      }}
                      title={`Готово: ${liveSummary.headline} — нажмите, чтобы открыть результат`}
                      className="flex items-center gap-1.5 text-[14px] text-sky-800 font-bold truncate hover:underline"
                    >
                      <CheckCircle2 size={13} className="text-sky-600 shrink-0" />
                      {liveSummary.imageUrl && (
                        <img
                          src={liveSummary.imageUrl}
                          alt=""
                          className="w-5 h-5 rounded object-cover border border-pink-300 shrink-0"
                        />
                      )}
                      <span className="truncate">{liveSummary.headline}</span>
                    </div>
                  ) : isNodeDoneInRun ? (
                    <span className="text-[14px] text-sky-700 font-bold truncate flex items-center gap-1">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span className="truncate">Выполнено · 100%</span>
                    </span>
                  ) : liveSummary ? (
                    <span
                      className="text-[14px] text-slate-800 font-medium block truncate"
                      title={`Последний результат: ${liveSummary.headline}`}
                    >
                      ✓ {liveSummary.headline}
                    </span>
                  ) : (
                    <span
                      className="text-[14px] text-slate-700 font-medium block truncate"
                      title={basicSubtitle}
                    >
                      {basicSubtitle}
                    </span>
                  )}
                </div>

                {/* Row 3: Unboxed Cost Text + Compact Icon Action Bar (No Duplicate Опции Button) */}
                <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-pink-300/60">
                  <span className="text-[14px] font-bold text-pink-700 truncate">
                    {formatShortCost(dynamicCost, isUnderDev)}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTestChoice(node);
                      }}
                      disabled={isTestingNode || isUnderDev}
                      className="p-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-2xs hover:brightness-105 cursor-pointer disabled:opacity-50"
                      title="Тестировать шаг или цепочку"
                    >
                      <Play size={13} fill="white" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenResultModal(node);
                      }}
                      className={`p-1.5 rounded-xl border cursor-pointer transition-all ${
                        hasDbResult
                          ? 'bg-white/95 border-pink-400 text-pink-700 shadow-2xs'
                          : 'bg-white/75 hover:bg-white border-pink-200 text-slate-600'
                      }`}
                      title="Результат теста из базы данных"
                    >
                      <Eye size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenConnectModal(
                          node.id,
                          node.type === 'logic_filter' ? 'yes' : undefined
                        );
                      }}
                      className="p-1.5 rounded-xl bg-white/75 hover:bg-white border border-pink-200 text-slate-700 cursor-pointer"
                      title="Соединить с блоком ниже"
                    >
                      <ArrowDown size={13} />
                    </button>

                    {nodeIdx > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNode(node.id);
                        }}
                        className="p-1.5 rounded-xl bg-rose-100/80 hover:bg-rose-100 border border-rose-300 text-rose-600 cursor-pointer"
                        title="Удалить блок"
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <div
                        className="p-1.5 text-slate-400 cursor-not-allowed"
                        title="Первый блок обязателен"
                      >
                        <Lock size={13} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Minimalist Canvas Hint */}
        <div className="hidden sm:flex absolute bottom-3 left-3 bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-pink-300 text-[14px] text-slate-800 font-medium shadow-sm pointer-events-none">
          <span>Клик по пунктирной линии или ее концам — вставка блока, перенос и параллельная связь</span>
        </div>
      </div>
    );
  }

  /* Sequential Step List View (No Duplicate Настроить Button, Ergonomic Mobile Icons) */
  return (
    <div className="space-y-3">
      {(currentScenario.nodes || []).map((node, idx) => {
        const def = resolveNodeDef(node.type);
        const IconComp = def?.icon || Bot;
        const isSelected = selectedNodeId === node.id;
        const isUnderDev = Boolean(node.isUnderDevelopment || node.type === 'ai_rewrite');
        const dynamicCost = getDynamicNodeCost(node, costs, currentScenario);
        const basicSubtitle = buildBasicNodeSubtitle(node, currentScenario, costs);
        const hasDbResult = Boolean(dbTestResults?.[node.id]);
        const listLiveSummary = summarizeStepLivePreview(dbTestResults?.[node.id]);
        const listStepProg = testProgress?.isRunning
          ? testProgress.steps.find((s) => s.nodeId === node.id)
          : undefined;
        const isListNodeRunning = Boolean(
          testProgress?.isRunning &&
            (testProgress.activeNodeId === node.id || listStepProg?.status === 'running')
        );

        return (
          <div
            key={node.id}
            onClick={() => onOpenNodeConfig(node.id)}
            className={`backdrop-blur-md rounded-2xl border-2 p-4 space-y-3 transition-all cursor-pointer shadow-sm ${
              isListNodeRunning
                ? 'bg-gradient-to-r from-sky-100/92 via-pink-100/92 via-orange-100/92 via-pink-100/92 to-sky-100/92 border-pink-500 ring-4 ring-sky-400/70 shadow-xl'
                : isSelected
                ? 'bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border-pink-500 ring-2 ring-pink-300'
                : 'bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 border-pink-300 hover:border-pink-400'
            }`}
          >
            {isListNodeRunning && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[14px] font-bold text-pink-700">
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    <span>Сейчас работает этот этап</span>
                  </span>
                  <span>{listStepProg?.stepPercent ?? testProgress?.percent ?? 15}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/85 border border-pink-300 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 transition-all duration-300"
                    style={{ width: `${Math.max(8, listStepProg?.stepPercent ?? 20)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2.5 flex-wrap">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-pink-500 text-white font-bold text-[14px] flex items-center justify-center shadow-2xs shrink-0">
                  {idx + 1}
                </span>
                <span className="p-2 rounded-xl bg-white/80 border border-pink-300 text-pink-700 shrink-0">
                  <IconComp size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h4 className="text-[15px] font-bold text-slate-900 truncate">
                      {node.title}
                    </h4>
                    <button
                      type="button"
                      onClick={(e) =>
                        onOpenHelp(
                          e,
                          `block_${node.type}`,
                          node.title,
                          def?.description || 'Справка'
                        )
                      }
                      className="p-0.5 text-slate-500 hover:text-pink-600 cursor-pointer shrink-0"
                      title="Инструкция к блоку"
                    >
                      <HelpCircle size={15} />
                    </button>
                  </div>
                  <UnboxedMetaLine
                    items={[basicSubtitle, formatShortCost(dynamicCost, isUnderDev)]}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <ResponsiveActionBtn
                  variant="vivid"
                  icon={<Play size={14} fill="white" />}
                  label="Тест"
                  title="Тестировать шаг или цепочку"
                  disabled={isTestingNode || isUnderDev}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTestChoice(node);
                  }}
                />

                <ResponsiveActionBtn
                  variant="outline"
                  icon={<Eye size={15} />}
                  label={hasDbResult ? 'Результат' : 'Итог'}
                  title="Открыть сохраненный результат теста"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenResultModal(node);
                  }}
                />

                {idx > 0 ? (
                  <ResponsiveActionBtn
                    variant="danger"
                    showLabelFrom="never"
                    icon={<Trash2 size={15} />}
                    label="Удалить шаг"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(node.id);
                    }}
                  />
                ) : (
                  <div
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400"
                    title="Первый блок обязателен"
                  >
                    <Lock size={16} />
                  </div>
                )}
              </div>
            </div>

            {listLiveSummary && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenResultModal(node);
                }}
                className="p-2.5 rounded-xl bg-white/80 border border-sky-300 flex items-center justify-between gap-2.5 text-[14px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {listLiveSummary.imageUrl && (
                    <img
                      src={listLiveSummary.imageUrl}
                      alt=""
                      className="w-9 h-9 rounded-lg object-cover border border-pink-300 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {listLiveSummary.headline}
                    </div>
                    {listLiveSummary.snippet && (
                      <div className="text-slate-700 truncate">{listLiveSummary.snippet}</div>
                    )}
                  </div>
                </div>
                <span className="text-pink-700 font-bold shrink-0">Открыть</span>
              </div>
            )}

            {/* Connected Targets (Clickable to manage/insert/parallelize) */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-pink-300/60 text-[14px] text-slate-800">
              <span className="font-semibold">Связи вниз:</span>
              {(currentScenario.edges || [])
                .filter((e) => e.sourceNodeId === node.id)
                .map((edge) => {
                  const targetNode = currentScenario.nodes?.find(
                    (n) => n.id === edge.targetNodeId
                  );
                  if (!targetNode) return null;
                  const isLogic = node.type === 'logic_filter';
                  const branchText = isLogic
                    ? edge.branch === 'no'
                      ? 'Нет → '
                      : 'Да → '
                    : '';
                  return (
                    <span
                      key={edge.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEdge(edge.id, 'line');
                      }}
                      title="Нажмите, чтобы вставить блок на линию, перенести концы или добавить параллельную связь"
                      className="px-2.5 py-1 rounded-xl bg-white/85 hover:bg-white border border-pink-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="truncate max-w-[200px]">
                        {branchText}
                        {targetNode.title}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEdge(edge.id);
                        }}
                        className="text-pink-600 hover:text-rose-600 cursor-pointer font-bold"
                        title="Удалить связь"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}

              {node.type === 'logic_filter' ? (
                <>
                  <ResponsiveActionBtn
                    variant="outline"
                    icon={<Plus size={14} />}
                    label="Ветка «Да»"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenConnectModal(node.id, 'yes');
                    }}
                  />
                  <ResponsiveActionBtn
                    variant="outline"
                    icon={<Plus size={14} />}
                    label="Ветка «Нет»"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenConnectModal(node.id, 'no');
                    }}
                  />
                </>
              ) : (
                <ResponsiveActionBtn
                  variant="outline"
                  icon={<Plus size={14} />}
                  label="Связь"
                  title="Соединить с блоком ниже"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenConnectModal(node.id);
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
