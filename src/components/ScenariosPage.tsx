import React, { useState, useEffect, useRef } from 'react';
import {
  Scenario,
  ScenarioLog,
  Channel,
  WorkflowNode,
  ScenarioNodeTestRecord
} from '../types';
import { ScenarioImageCosts } from './scenarios/ScenarioImageNodeConfig';
import {
  NODE_DEFINITIONS,
  NodeTypeDefinition,
  calculateTotalCost,
  createDefaultWorkflow,
  buildBasicNodeSubtitle,
  getScenarioActiveFormat
} from './scenarios/scenarioDefinitions';
import { useScenarioWorkflowActions } from './scenarios/useScenarioWorkflowActions';
import { ScenarioCanvasAndList } from './scenarios/ScenarioCanvasAndList';
import { ScenarioBlockConfigModal } from './scenarios/ScenarioBlockConfigModal';
import {
  ScenarioTestChoiceModal,
  ScenarioTestResultModal,
  ScenarioCatalogModal,
  ScenarioConnectModal
} from './scenarios/views/ScenarioModals';
import {
  ScenarioListTab,
  ScenarioLogsTab,
  ScenarioImageBuilderBridge,
  ScenarioHelpModal,
  ScenarioDeleteConfirmModal
} from './scenarios/views/ScenarioListAndLogsView';
import {
  ScenarioCreateModal,
  ScenarioValidationBar
} from './scenarios/views/assistant/ScenarioCreateModal';
import {
  IirkaAssistantModal,
  IirkaUndoBanner
} from './scenarios/views/assistant/IirkaAssistantModal';
import { useIirkaAssistant } from './scenarios/views/assistant/useIirkaAssistant';
import {
  ScenarioTopNavBanner,
  ScenarioEditorToolbar,
  ScenarioLiveTestBanner
} from './scenarios/views/config/ScenarioEditorHeader';
import { useScenarioAutoSave } from './scenarios/schedule/useScenarioAutoSave';
import { useScenarioEdgesController } from './scenarios/edges/useScenarioEdgesController';
import { ScenarioEdgeInfoModal } from './scenarios/edges/ScenarioEdgeModals';
import { TariffGateModal } from './tariffs/TariffGateBanner';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { formatIirkyCount } from '../shared/pricingConfig';

export { NODE_DEFINITIONS };

interface ScenariosPageProps {
  currentUser: any;
  channels: Channel[];
  onRefreshPosts?: () => Promise<void> | void;
}

export const ScenariosPage: React.FC<ScenariosPageProps> = ({
  currentUser,
  channels,
  onRefreshPosts
}) => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [logs, setLogs] = useState<ScenarioLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'editor' | 'logs'>('list');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [dbTestResults, setDbTestResults] = useState<Record<string, ScenarioNodeTestRecord>>({});
  const [editorViewMode, setEditorViewMode] = useState<'canvas' | 'list'>('canvas');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [nameError, setNameError] = useState<string | null>(null);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const nameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeUserId = String(currentUser?.id || currentUser?.telegramId || '16926299042');
  const { pricing } = usePricingConfig(activeUserId);
  const costs: ScenarioImageCosts = {
    cost787: pricing.imageModels.func_787,
    cost621: pricing.imageModels.func_621,
    cost784: pricing.imageModels.func_784,
    cost791: pricing.imageModels.func_791,
    pricingConfig: pricing
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isImageBuilderOpen, setIsImageBuilderOpen] = useState(false);

  const [testChoiceNode, setTestChoiceNode] = useState<WorkflowNode | null>(null);
  const [resultModalNode, setResultModalNode] = useState<WorkflowNode | null>(null);
  const [isSavingScenario, setIsSavingScenario] = useState(false);

  const [scenarioToDelete, setScenarioToDelete] = useState<Scenario | null>(null);
  const [blockToDeleteId, setBlockToDeleteId] = useState<string | null>(null);
  const [helpPopup, setHelpPopup] = useState<{
    title: string;
    summary: string;
    instructionText: string;
    examples?: string;
  } | null>(null);
  const [instructions, setInstructions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/scenarios/instructions')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setInstructions(data);
      })
      .catch(() => {});
  }, []);

  const fetchScenariosAndLogs = async () => {
    setIsLoading(true);
    try {
      const [scenRes, logsRes] = await Promise.all([
        fetch(`/api/scenarios?userId=${encodeURIComponent(activeUserId)}`),
        fetch('/api/scenarios/logs')
      ]);
      if (scenRes.ok) {
        const scenData = await scenRes.json();
        if (Array.isArray(scenData)) setScenarios(scenData);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (Array.isArray(logsData)) setLogs(logsData);
      }
    } catch (err) {
      console.error('Failed fetching scenarios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScenariosAndLogs();
  }, []);

  const fetchScenarioTestResultsFromDb = async (scenarioId: string) => {
    if (!scenarioId) return;
    try {
      const res = await fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}/test-results`);
      if (res.ok) {
        const data = await res.json();
        setDbTestResults(data?.testResults || {});
      }
    } catch (err) {
      console.error('Failed loading DB test results:', err);
    }
  };

  const validateScenarioName = (rawName: string, excludeId?: string) => {
    const trimmed = String(rawName || '').trim();
    if (!trimmed) {
      setNameError('Введите название сценария.');
      return false;
    }

    const normalized = trimmed.toLowerCase();
    const localConflict = scenarios.some(
      (s) => s.id !== excludeId && String(s.name || '').trim().toLowerCase() === normalized
    );
    if (localConflict) {
      setNameError('Сценарий с таким названием уже есть в базе данных. Укажите уникальное название.');
      return false;
    }

    setNameError(null);
    if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    nameCheckTimerRef.current = setTimeout(async () => {
      setIsCheckingName(true);
      try {
        const params = new URLSearchParams({
          name: trimmed,
          ...(excludeId ? { excludeId } : {})
        });
        const res = await fetch(`/api/scenarios/check-name?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.taken || data?.available === false) {
            setNameError('Сценарий с таким названием уже есть в базе данных. Укажите уникальное название.');
          }
        }
      } catch {
        // ignore transient network check error
      } finally {
        setIsCheckingName(false);
      }
    }, 260);

    return true;
  };

  const {
    saveScenarioNodesToDb,
    handleUpdateNode,
    flushPendingSave,
    scheduleAutoSave
  } = useScenarioAutoSave({
    currentScenario,
    setCurrentScenario,
    setScenarios,
    activeUserId
  });

  const edgesCtrl = useScenarioEdgesController({
    currentScenario,
    setCurrentScenario,
    saveScenarioNodesToDb,
    setSelectedNodeId,
    setStatusMessage
  });

  const handleScenarioNameChange = (nextName: string) => {
    if (!currentScenario) return;
    const nextSnap = { ...currentScenario, name: nextName };
    setCurrentScenario(nextSnap);
    if (validateScenarioName(nextName, currentScenario.id) && nextName.trim()) {
      scheduleAutoSave(nextSnap, false);
    }
  };

  const openHelp = (
    e: React.MouseEvent,
    targetKey: string,
    fallbackTitle: string,
    fallbackText: string
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const inst = instructions.find(
      (i) => i.id === targetKey || i.block_type === targetKey || i.field_name === targetKey
    );
    setHelpPopup({
      title: inst?.title || fallbackTitle,
      summary: inst?.summary || '',
      instructionText: inst?.instruction_text || fallbackText,
      examples: inst?.examples || ''
    });
  };

  const openNodeConfig = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setIsConfigModalOpen(true);
  };

  const handleOpenScenario = (scen: Scenario) => {
    let prepared = scen;
    const fmt = getScenarioActiveFormat(scen);
    if (!scen.nodes || scen.nodes.length === 0) {
      const converted = createDefaultWorkflow(
        scen.name,
        scen.category || scen.topicCategory || 'Технологии и нейросети',
        channels,
        fmt
      );
      prepared = { ...scen, messageFormat: fmt, nodes: converted.nodes, edges: converted.edges };
    } else if (!scen.messageFormat) {
      prepared = { ...scen, messageFormat: fmt };
    }
    setNameError(null);
    setCurrentScenario(prepared);
    setDbTestResults(prepared.testResults || {});
    setSelectedNodeId(prepared.nodes?.[0]?.id || null);
    setActiveTab('editor');
    setEditorViewMode('canvas');
    fetchScenarioTestResultsFromDb(prepared.id);
  };

  const handleConfirmCreateScenario = async (params: {
    name: string;
    format: 'v2' | 'rich';
    templateId: string;
    category: string;
    targetChannels: string[];
  }) => {
    const newScen = createDefaultWorkflow(
      params.name,
      params.category,
      channels,
      params.format,
      params.templateId,
      params.targetChannels
    );
    setIsCreateModalOpen(false);
    setNameError(null);
    setDbTestResults({});
    setCurrentScenario(newScen);
    setSelectedNodeId(newScen.nodes?.[0]?.id || null);
    setActiveTab('editor');
    setEditorViewMode('canvas');

    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newScen, userId: activeUserId })
      });
      if (res.ok) {
        const saved = await res.json();
        setCurrentScenario(saved);
        setScenarios((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
        setStatusMessage({
          type: 'success',
          text: `Сценарий «${saved.name}» (${params.format === 'rich' ? 'Rich' : 'v2'}) создан и зафиксирован на сервере.`
        });
      }
    } catch (err) {
      console.error('Failed creating initial scenario in DB:', err);
    }
  };

  const handleSaveScenario = async (): Promise<boolean> => {
    if (!currentScenario) return false;
    const trimmedName = String(currentScenario.name || '').trim();
    if (!trimmedName) {
      setNameError('Введите название сценария.');
      setStatusMessage({ type: 'error', text: 'Название сценария не может быть пустым.' });
      return false;
    }

    const checkParams = new URLSearchParams({ name: trimmedName, excludeId: currentScenario.id });
    const checkRes = await fetch(`/api/scenarios/check-name?${checkParams.toString()}`);
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData?.taken || checkData?.available === false) {
        const dupMsg =
          'Сценарий с таким названием уже есть в базе данных. Укажите уникальное название.';
        setNameError(dupMsg);
        setStatusMessage({ type: 'error', text: dupMsg });
        return false;
      }
    }

    setIsSavingScenario(true);
    try {
      const isExisting = scenarios.some((s) => s.id === currentScenario.id);
      const url = isExisting
        ? `/api/scenarios/${encodeURIComponent(currentScenario.id)}`
        : '/api/scenarios';
      const method = isExisting ? 'PUT' : 'POST';

      const cleanNodes = (currentScenario.nodes || []).map((n) => {
        const copy = { ...n };
        delete copy.lastOutput;
        return copy;
      });
      const activeFormat = getScenarioActiveFormat(currentScenario);

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentScenario,
          name: trimmedName,
          messageFormat: activeFormat,
          userId: activeUserId,
          nodes: cleanNodes,
          edges: currentScenario.edges || [],
          workflowLayout: editorViewMode
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setNameError(data.error || 'Сценарий с таким названием уже существует.');
        }
        throw new Error(data.error || 'Ошибка сохранения сценария');
      }

      setNameError(null);
      setCurrentScenario((prev) =>
        prev ? { ...prev, name: trimmedName, messageFormat: activeFormat, nodes: cleanNodes } : prev
      );
      setStatusMessage({
        type: 'success',
        text: 'Сценарий и расписание крона сохранены и зафиксированы в базе данных на сервере.'
      });
      await fetchScenariosAndLogs();
      return true;
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Ошибка сохранения' });
      return false;
    } finally {
      setIsSavingScenario(false);
    }
  };

  const {
    isTestingNode,
    testProgress,
    isExecutingWorkflow,
    duplicatingScenarioId,
    handleRunWholeScenario,
    handleRunNodeOrChainTest,
    handleDuplicateScenario
  } = useScenarioWorkflowActions({
    currentScenario,
    activeUserId,
    telegramId: currentUser?.telegramId,
    costs,
    nameError,
    handleSaveScenario,
    fetchScenarioTestResultsFromDb,
    fetchScenariosAndLogs,
    onRefreshPosts,
    setScenarios,
    setDbTestResults,
    setStatusMessage,
    setTestChoiceNode,
    setResultModalNode
  });

  const handleCloseConfigModal = () => {
    flushPendingSave();
    setIsConfigModalOpen(false);
  };

  const handleMoveNode = (nodeId: string, newX: number, newY: number, commitToDb: boolean) => {
    if (!currentScenario) return;
    const updatedNodes = (currentScenario.nodes || []).map((n) =>
      n.id === nodeId ? { ...n, x: newX, y: newY } : n
    );
    setCurrentScenario((prev) => (prev ? { ...prev, nodes: updatedNodes } : prev));
    if (commitToDb) saveScenarioNodesToDb(updatedNodes, currentScenario.edges || []);
  };

  const handleRenameNode = (nodeId: string, newTitle: string) => {
    if (!currentScenario || !newTitle.trim()) return;
    const cleanTitle = newTitle.trim();
    const updatedNodes = (currentScenario.nodes || []).map((n) =>
      n.id === nodeId ? { ...n, title: cleanTitle } : n
    );
    setCurrentScenario((prev) => (prev ? { ...prev, nodes: updatedNodes } : prev));
    saveScenarioNodesToDb(updatedNodes, currentScenario.edges || []);
  };

  const handleAddNode = (def: NodeTypeDefinition) => {
    if (def.isUnderDevelopment) {
      setStatusMessage({
        type: 'error',
        text: 'Блок «Рерайт и уникализация» и чтение внешних ссылок находятся в разработке.'
      });
      return;
    }
    if (!currentScenario) return;

    const activeFmt = getScenarioActiveFormat(currentScenario);
    const existingNodes = currentScenario.nodes || [];
    const maxY = existingNodes.reduce((max, n) => Math.max(max, n.y), 0);
    const initialConfig = {
      ...def.defaultConfig,
      ...(def.type === 'ai_generate_text' || def.type === 'ai_generate_image'
        ? {
            messageFormat: activeFmt,
            ...(def.type === 'ai_generate_text' && activeFmt === 'rich'
              ? { maxChars: 8000 }
              : {})
          }
        : {})
    };

    const newNode: WorkflowNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: def.type,
      title: def.title,
      subtitle: def.categoryTitle,
      x: 320,
      y: existingNodes.length > 0 ? maxY + 185 : 40,
      enabled: true,
      cost: def.cost,
      isUnderDevelopment: def.isUnderDevelopment,
      config: initialConfig
    };
    newNode.subtitle = buildBasicNodeSubtitle(newNode, currentScenario, costs);

    const updatedNodes = [...existingNodes, newNode];
    const updatedEdges = [...(currentScenario.edges || [])];
    if (edgesCtrl.connectingSourceNodeId) {
      const srcNode = existingNodes.find((n) => n.id === edgesCtrl.connectingSourceNodeId);
      updatedEdges.push({
        id: `edge_${Date.now()}`,
        sourceNodeId: edgesCtrl.connectingSourceNodeId,
        targetNodeId: newNode.id,
        branch: srcNode?.type === 'logic_filter' ? edgesCtrl.connectingBranch || 'yes' : 'default'
      });
    }

    setCurrentScenario((prev) =>
      prev ? { ...prev, nodes: updatedNodes, edges: updatedEdges } : prev
    );
    saveScenarioNodesToDb(updatedNodes, updatedEdges);
    setSelectedNodeId(newNode.id);
    setIsCatalogOpen(false);
    edgesCtrl.setConnectingSourceNodeId(null);
    edgesCtrl.setConnectingBranch(undefined);
    setStatusMessage({ type: 'success', text: `Блок «${def.title}» добавлен в сценарий.` });
  };

  const handleRequestDeleteNode = (nodeId: string) => {
    if (!currentScenario) return;
    const firstNode = currentScenario.nodes?.[0];
    if (firstNode && firstNode.id === nodeId) {
      setStatusMessage({
        type: 'error',
        text: 'Первый блок триггера обязателен для сценария и не может быть удален.'
      });
      return;
    }
    setBlockToDeleteId(nodeId);
  };

  const confirmDeleteNode = (nodeId: string) => {
    if (!currentScenario) return;
    const updatedNodes = (currentScenario.nodes || []).filter((n) => n.id !== nodeId);
    const updatedEdges = (currentScenario.edges || []).filter(
      (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
    );
    setCurrentScenario((prev) =>
      prev ? { ...prev, nodes: updatedNodes, edges: updatedEdges } : prev
    );
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setIsConfigModalOpen(false);
    }
    saveScenarioNodesToDb(updatedNodes, updatedEdges);
    setBlockToDeleteId(null);
    setStatusMessage({ type: 'success', text: 'Блок удален из сценария.' });
  };

  const confirmDeleteScenario = async (scenId: string) => {
    try {
      const res = await fetch(`/api/scenarios/${encodeURIComponent(scenId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Не удалось удалить сценарий');
      setScenarios((prev) => prev.filter((s) => s.id !== scenId));
      if (currentScenario?.id === scenId) {
        setCurrentScenario(null);
        setDbTestResults({});
        setActiveTab('list');
      }
      setStatusMessage({ type: 'success', text: 'Сценарий удален из базы данных.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Ошибка удаления сценария' });
    } finally {
      setScenarioToDelete(null);
    }
  };

  const selectedNode = currentScenario?.nodes?.find((n) => n.id === selectedNodeId) || null;
  const blockToDeleteNode =
    currentScenario?.nodes?.find((n) => n.id === blockToDeleteId) || null;
  const totalWorkflowCost = calculateTotalCost(currentScenario, costs);
  const currentScenarioFormat = getScenarioActiveFormat(currentScenario);

  const userIirkaBalance = Number(
    currentUser?.iirky ?? currentUser?.pointsBalance ?? currentUser?.balance ?? currentUser?.tokens ?? 0
  );

  const iirka = useIirkaAssistant({
    activeUserId,
    userBalance: userIirkaBalance,
    userTariff: currentUser?.tariff,
    userRole: currentUser?.role,
    scenarios,
    currentScenario,
    channels,
    onApplyScenarioToEditor: (scen, savedNotice) => {
      handleOpenScenario(scen);
      if (savedNotice) {
        setStatusMessage({ type: 'success', text: savedNotice });
      }
    },
    onRefreshScenarios: fetchScenariosAndLogs,
    onStatusMessage: setStatusMessage
  });

  return (
    <div className="w-full space-y-5 pb-16 font-sans text-[14px]">
      <ScenarioTopNavBanner
        activeTab={activeTab}
        scenariosCount={scenarios.length}
        logsCount={logs.length}
        currentScenario={currentScenario}
        currentScenarioFormat={currentScenarioFormat}
        statusMessage={statusMessage}
        onChangeTab={(tab) => setActiveTab(tab)}
        onClearStatus={() => setStatusMessage(null)}
      />

      <IirkaUndoBanner
        undoScenarioName={iirka.undoSnapshot?.name || null}
        onRollback={iirka.rollbackUndoSnapshot}
        onDismiss={iirka.clearUndoSnapshot}
      />

      {activeTab === 'list' && (
        <ScenarioListTab
          scenarios={scenarios}
          isLoading={isLoading}
          costs={costs}
          duplicatingScenarioId={duplicatingScenarioId}
          onCreateNew={() => setIsCreateModalOpen(true)}
          onOpenIirkaCreate={iirka.openForCreate}
          onOpenIirkaEditScenario={(scen) => iirka.openForEdit(scen)}
          onOpenScenario={handleOpenScenario}
          onDuplicateScenario={handleDuplicateScenario}
          onRequestDelete={(scen) => setScenarioToDelete(scen)}
        />
      )}

      {activeTab === 'editor' && currentScenario && (
        <div className="space-y-4">
          <ScenarioEditorToolbar
            scenarioName={currentScenario.name}
            currentScenarioFormat={currentScenarioFormat}
            nameError={nameError}
            isCheckingName={isCheckingName}
            editorViewMode={editorViewMode}
            isExecutingWorkflow={isExecutingWorkflow}
            isSavingScenario={isSavingScenario}
            totalWorkflowCost={totalWorkflowCost}
            onNameChange={handleScenarioNameChange}
            onChangeViewMode={setEditorViewMode}
            onOpenIirkaEditor={() => iirka.openForEdit(currentScenario)}
            onOpenCatalog={() => {
              edgesCtrl.setConnectingSourceNodeId(null);
              edgesCtrl.setConnectingBranch(undefined);
              setIsCatalogOpen(true);
            }}
            onRunScenario={handleRunWholeScenario}
            onSaveScenario={() => {
              handleSaveScenario();
            }}
          />

          <ScenarioValidationBar scenario={currentScenario} />

          <ScenarioLiveTestBanner
            testProgress={testProgress}
            dbTestResults={dbTestResults}
            onOpenResultByNodeId={(nodeId) => {
              const found = currentScenario.nodes?.find((n) => n.id === nodeId);
              if (found) setResultModalNode(found);
            }}
          />

          <ScenarioCanvasAndList
            currentScenario={currentScenario}
            editorViewMode={editorViewMode}
            selectedNodeId={selectedNodeId}
            connectingSourceNodeId={edgesCtrl.connectingSourceNodeId}
            connectingBranch={edgesCtrl.connectingBranch}
            canvasWireMode={edgesCtrl.canvasWireMode}
            isTestingNode={isTestingNode}
            testProgress={testProgress}
            costs={costs}
            dbTestResults={dbTestResults}
            onSelectNode={(id) => setSelectedNodeId(id)}
            onOpenNodeConfig={openNodeConfig}
            onOpenTestChoice={(node) => setTestChoiceNode(node)}
            onOpenResultModal={(node) => setResultModalNode(node)}
            onOpenConnectModal={(sourceNodeId, preferredBranch) => {
              edgesCtrl.setConnectingSourceNodeId(sourceNodeId);
              edgesCtrl.setConnectingBranch(preferredBranch);
              edgesCtrl.setIsConnectModalOpen(true);
            }}
            onConnectNodes={edgesCtrl.handleConnectNodes}
            onSelectEdge={edgesCtrl.openEdgeModal}
            onCanvasWireNodeClick={edgesCtrl.handleCanvasWireNodeClick}
            onCancelWireMode={() => edgesCtrl.setCanvasWireMode(null)}
            onDeleteEdge={edgesCtrl.handleDeleteEdge}
            onDeleteNode={handleRequestDeleteNode}
            onRenameNode={handleRenameNode}
            onMoveNode={handleMoveNode}
            onOpenHelp={openHelp}
          />
        </div>
      )}

      {activeTab === 'logs' && (
        <ScenarioLogsTab logs={logs} onRefresh={fetchScenariosAndLogs} />
      )}

      <ScenarioCreateModal
        isOpen={isCreateModalOpen}
        existingScenarios={scenarios}
        channels={channels}
        onClose={() => setIsCreateModalOpen(false)}
        onSwitchToIirka={iirka.openForCreate}
        onConfirmCreate={handleConfirmCreateScenario}
      />

      <IirkaAssistantModal
        assistant={iirka}
        scenarios={scenarios}
        currentScenario={currentScenario}
        channels={channels}
      />

      <TariffGateModal
        isOpen={iirka.isTariffGateOpen}
        onClose={iirka.closeTariffGate}
        requiredTariff="Отрыв"
        featureTitle="Генератор Сценариев ИИрка"
        description={`Автоматическое составление и редактирование сценариев автопостинга через ИИрку (${formatIirkyCount(pricing.scenarioAi.assistantBuildOrEdit)} за сценарий) доступно с тарифа Отрыв. Ручная сборка сценариев в конструкторе бесплатна на всех тарифах.`}
      />

      {currentScenario && (
        <ScenarioBlockConfigModal
          isOpen={isConfigModalOpen}
          selectedNode={selectedNode}
          currentScenario={currentScenario}
          channels={channels}
          activeUserId={activeUserId}
          userBalance={userIirkaBalance}
          costs={costs}
          isTestingNode={isTestingNode}
          testProgress={testProgress}
          dbTestResults={dbTestResults}
          onClose={handleCloseConfigModal}
          onUpdateNode={handleUpdateNode}
          onOpenImageConstructor={() => {
            flushPendingSave();
            setIsImageBuilderOpen(true);
          }}
          onOpenTestChoice={(node) => {
            flushPendingSave();
            setTestChoiceNode(node);
          }}
          onOpenResultModal={(node) => {
            flushPendingSave();
            setResultModalNode(node);
          }}
          onOpenHelp={openHelp}
        />
      )}

      <ScenarioTestChoiceModal
        targetNode={testChoiceNode}
        scenario={currentScenario}
        costs={costs}
        isTesting={isTestingNode}
        testProgress={testProgress}
        liveResults={dbTestResults}
        onOpenStepResult={(nodeId) => {
          const found = currentScenario?.nodes?.find((n) => n.id === nodeId);
          if (found) setResultModalNode(found);
        }}
        onClose={() => setTestChoiceNode(null)}
        onRunTest={handleRunNodeOrChainTest}
      />

      <ScenarioTestResultModal
        isOpen={Boolean(resultModalNode)}
        scenario={currentScenario}
        initialNode={resultModalNode}
        liveResults={dbTestResults}
        onClose={() => setResultModalNode(null)}
        onOpenTestChoice={(node) => setTestChoiceNode(node)}
        onSyncResultsFromDb={(map) => setDbTestResults(map)}
        onCopySuccess={(msg) => setStatusMessage({ type: 'success', text: msg })}
      />

      {currentScenario && (
        <ScenarioEdgeInfoModal
          isOpen={Boolean(edgesCtrl.activeEdgeModal && edgesCtrl.activeEdgeObj)}
          edge={edgesCtrl.activeEdgeObj}
          initialFocus={edgesCtrl.activeEdgeModal?.focus || 'line'}
          currentScenario={currentScenario}
          onClose={edgesCtrl.closeEdgeModal}
          onInsertBlockOnEdge={edgesCtrl.handleInsertBlockOnEdge}
          onReconnectEndpoint={edgesCtrl.handleReconnectEndpoint}
          onChangeEdgeBranch={edgesCtrl.handleChangeEdgeBranch}
          onAddParallelToExisting={edgesCtrl.handleAddParallelToExisting}
          onAddParallelNewBlock={edgesCtrl.handleAddParallelNewBlock}
          onStartCanvasWireMode={edgesCtrl.setCanvasWireMode}
          onDeleteEdge={edgesCtrl.handleDeleteEdge}
        />
      )}

      <ScenarioCatalogModal
        isOpen={isCatalogOpen}
        scenarioFormat={currentScenarioFormat}
        costs={costs}
        onClose={() => {
          setIsCatalogOpen(false);
          edgesCtrl.setConnectingSourceNodeId(null);
          edgesCtrl.setConnectingBranch(undefined);
        }}
        onAddNode={handleAddNode}
      />

      <ScenarioConnectModal
        isOpen={edgesCtrl.isConnectModalOpen}
        sourceNodeId={edgesCtrl.connectingSourceNodeId}
        initialBranch={edgesCtrl.connectingBranch}
        nodes={currentScenario?.nodes || []}
        onClose={() => {
          edgesCtrl.setIsConnectModalOpen(false);
          edgesCtrl.setConnectingSourceNodeId(null);
          edgesCtrl.setConnectingBranch(undefined);
        }}
        onConnect={edgesCtrl.handleConnectNodes}
      />

      <ScenarioHelpModal helpPopup={helpPopup} onClose={() => setHelpPopup(null)} />

      <ScenarioDeleteConfirmModal
        scenarioToDelete={scenarioToDelete}
        blockToDeleteNode={blockToDeleteNode}
        onCancel={() => {
          setScenarioToDelete(null);
          setBlockToDeleteId(null);
        }}
        onConfirmScenario={confirmDeleteScenario}
        onConfirmBlock={confirmDeleteNode}
      />

      <ScenarioImageBuilderBridge
        isOpen={isImageBuilderOpen}
        onClose={() => setIsImageBuilderOpen(false)}
        selectedNode={selectedNode}
        currentScenario={currentScenario}
        activeUserId={activeUserId}
        userBalance={userIirkaBalance}
        costs={costs}
        onCommitNodes={(updatedNodes, edges, notice) => {
          setCurrentScenario((prev) => (prev ? { ...prev, nodes: updatedNodes } : prev));
          saveScenarioNodesToDb(updatedNodes, edges);
          if (notice) setStatusMessage({ type: 'success', text: notice });
        }}
      />
    </div>
  );
};

export default ScenariosPage;
