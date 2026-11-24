import React, { useState } from 'react';
import { Scenario, WorkflowEdge, WorkflowNode } from '../../../types';
import { NodeTypeDefinition, buildBasicNodeSubtitle } from '../scenarioDefinitions';
import {
  CanvasWireMode,
  ScenarioEdgeFocusPart,
  ScenarioEdgeModalState,
  insertNodeOnEdge,
  reconnectEdgeEndpoint,
  addParallelEdgeToExisting,
  addParallelNodeAndEdge
} from './edgeOperations';

interface UseScenarioEdgesControllerParams {
  currentScenario: Scenario | null;
  setCurrentScenario: React.Dispatch<React.SetStateAction<Scenario | null>>;
  saveScenarioNodesToDb: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setStatusMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void;
}

export function useScenarioEdgesController({
  currentScenario,
  setCurrentScenario,
  saveScenarioNodesToDb,
  setSelectedNodeId,
  setStatusMessage
}: UseScenarioEdgesControllerParams) {
  const [activeEdgeModal, setActiveEdgeModal] = useState<ScenarioEdgeModalState | null>(null);
  const [canvasWireMode, setCanvasWireMode] = useState<CanvasWireMode | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectingSourceNodeId, setConnectingSourceNodeId] = useState<string | null>(null);
  const [connectingBranch, setConnectingBranch] = useState<'yes' | 'no' | undefined>(undefined);

  const openEdgeModal = (edgeId: string, focus: ScenarioEdgeFocusPart = 'line') => {
    setActiveEdgeModal({ edgeId, focus });
  };

  const closeEdgeModal = () => setActiveEdgeModal(null);

  const handleConnectNodes = (
    sourceId: string,
    targetId: string,
    branch?: 'yes' | 'no' | 'default'
  ) => {
    if (!currentScenario || sourceId === targetId) return;
    const sourceNode = currentScenario.nodes?.find((n) => n.id === sourceId);
    const resolvedBranch: 'yes' | 'no' | 'default' =
      sourceNode?.type === 'logic_filter'
        ? branch === 'no'
          ? 'no'
          : 'yes'
        : 'default';

    const edges = currentScenario.edges || [];
    const existingIdx = edges.findIndex(
      (e) => e.sourceNodeId === sourceId && e.targetNodeId === targetId
    );
    const updatedEdges: WorkflowEdge[] =
      existingIdx >= 0
        ? edges.map((e, i) => (i === existingIdx ? { ...e, branch: resolvedBranch } : e))
        : [
            ...edges,
            {
              id: `edge_${Date.now()}`,
              sourceNodeId: sourceId,
              targetNodeId: targetId,
              branch: resolvedBranch
            }
          ];

    setCurrentScenario((prev) => (prev ? { ...prev, edges: updatedEdges } : prev));
    saveScenarioNodesToDb(currentScenario.nodes || [], updatedEdges);
    setConnectingSourceNodeId(null);
    setConnectingBranch(undefined);
    setIsConnectModalOpen(false);
    setStatusMessage({ type: 'success', text: 'Связь между блоками сохранена.' });
  };

  const handleDeleteEdge = (edgeId: string) => {
    if (!currentScenario) return;
    const updatedEdges = (currentScenario.edges || []).filter((e) => e.id !== edgeId);
    setCurrentScenario((prev) => (prev ? { ...prev, edges: updatedEdges } : prev));
    saveScenarioNodesToDb(currentScenario.nodes || [], updatedEdges);
    setStatusMessage({ type: 'success', text: 'Линия связи удалена.' });
  };

  const handleInsertBlockOnEdge = (edgeId: string, def: NodeTypeDefinition) => {
    if (!currentScenario) return;
    const res = insertNodeOnEdge({
      nodes: currentScenario.nodes || [],
      edges: currentScenario.edges || [],
      edgeId,
      def,
      scenario: currentScenario
    });
    if (!res) return;
    res.insertedNode.subtitle = buildBasicNodeSubtitle(res.insertedNode, currentScenario);
    setCurrentScenario((prev) =>
      prev ? { ...prev, nodes: res.nodes, edges: res.edges } : prev
    );
    saveScenarioNodesToDb(res.nodes, res.edges);
    setSelectedNodeId(res.insertedNode.id);
    setStatusMessage({
      type: 'success',
      text: `Блок «${def.title}» встроен на линию связи и сохранен.`
    });
  };

  const handleReconnectEndpoint = (
    edgeId: string,
    side: 'start' | 'end',
    newNodeId: string
  ): string | undefined => {
    if (!currentScenario) return 'Сценарий не открыт';
    const res = reconnectEdgeEndpoint({
      edges: currentScenario.edges || [],
      nodes: currentScenario.nodes || [],
      edgeId,
      side,
      newNodeId
    });
    if (res.error) return res.error;
    setCurrentScenario((prev) => (prev ? { ...prev, edges: res.edges } : prev));
    saveScenarioNodesToDb(currentScenario.nodes || [], res.edges);
    return undefined;
  };

  const handleChangeEdgeBranch = (edgeId: string, branch: 'yes' | 'no' | 'default') => {
    if (!currentScenario) return;
    const updatedEdges = (currentScenario.edges || []).map((e) =>
      e.id === edgeId ? { ...e, branch } : e
    );
    setCurrentScenario((prev) => (prev ? { ...prev, edges: updatedEdges } : prev));
    saveScenarioNodesToDb(currentScenario.nodes || [], updatedEdges);
  };

  const handleAddParallelToExisting = (
    sourceNodeId: string,
    targetNodeId: string,
    branch: 'yes' | 'no' | 'default'
  ): string | undefined => {
    if (!currentScenario) return 'Сценарий не открыт';
    const res = addParallelEdgeToExisting({
      edges: currentScenario.edges || [],
      nodes: currentScenario.nodes || [],
      sourceNodeId,
      targetNodeId,
      branch
    });
    if (res.error) return res.error;
    setCurrentScenario((prev) => (prev ? { ...prev, edges: res.edges } : prev));
    saveScenarioNodesToDb(currentScenario.nodes || [], res.edges);
    setStatusMessage({ type: 'success', text: 'Параллельная линия связи добавлена и сохранена.' });
    return undefined;
  };

  const handleAddParallelNewBlock = (
    sourceNodeId: string,
    def: NodeTypeDefinition,
    branch: 'yes' | 'no' | 'default'
  ) => {
    if (!currentScenario) return;
    const res = addParallelNodeAndEdge({
      nodes: currentScenario.nodes || [],
      edges: currentScenario.edges || [],
      sourceNodeId,
      def,
      scenario: currentScenario,
      branch
    });
    if (!res) return;
    res.createdNode.subtitle = buildBasicNodeSubtitle(res.createdNode, currentScenario);
    setCurrentScenario((prev) =>
      prev ? { ...prev, nodes: res.nodes, edges: res.edges } : prev
    );
    saveScenarioNodesToDb(res.nodes, res.edges);
    setSelectedNodeId(res.createdNode.id);
    setStatusMessage({
      type: 'success',
      text: `Параллельный блок «${def.title}» создан и соединен линией.`
    });
  };

  const handleCanvasWireNodeClick = (clickedNodeId: string): boolean => {
    if (!canvasWireMode || !currentScenario) return false;
    if (canvasWireMode.kind === 'move_start' || canvasWireMode.kind === 'move_end') {
      const side = canvasWireMode.kind === 'move_start' ? 'start' : 'end';
      const err = handleReconnectEndpoint(canvasWireMode.edgeId, side, clickedNodeId);
      if (err) {
        setStatusMessage({ type: 'error', text: err });
      } else {
        setStatusMessage({
          type: 'success',
          text:
            side === 'start'
              ? 'Начало линии перенесено на выбранный блок.'
              : 'Конец линии перенесен на выбранный блок.'
        });
      }
      setCanvasWireMode(null);
      return true;
    }

    if (canvasWireMode.kind === 'add_parallel') {
      const err = handleAddParallelToExisting(
        canvasWireMode.sourceNodeId,
        clickedNodeId,
        canvasWireMode.branch
      );
      if (err) {
        setStatusMessage({ type: 'error', text: err });
      }
      setCanvasWireMode(null);
      return true;
    }
    return false;
  };

  const activeEdgeObj =
    activeEdgeModal && currentScenario
      ? (currentScenario.edges || []).find((e) => e.id === activeEdgeModal.edgeId) || null
      : null;

  return {
    activeEdgeModal,
    activeEdgeObj,
    canvasWireMode,
    setCanvasWireMode,
    isConnectModalOpen,
    setIsConnectModalOpen,
    connectingSourceNodeId,
    setConnectingSourceNodeId,
    connectingBranch,
    setConnectingBranch,
    openEdgeModal,
    closeEdgeModal,
    handleConnectNodes,
    handleDeleteEdge,
    handleInsertBlockOnEdge,
    handleReconnectEndpoint,
    handleChangeEdgeBranch,
    handleAddParallelToExisting,
    handleAddParallelNewBlock,
    handleCanvasWireNodeClick
  };
}
