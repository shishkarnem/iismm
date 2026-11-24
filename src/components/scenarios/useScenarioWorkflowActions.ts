import React, { useState } from 'react';
import {
  Scenario,
  ScenarioNodeTestRecord,
  ScenarioTestProgressState,
  WorkflowNode
} from '../../types';
import { ScenarioImageCosts } from './ScenarioImageNodeConfig';
import {
  calculateTotalCost,
  computeChainToTarget,
  getScenarioActiveFormat,
  runScenarioNodeStreamClient
} from './scenarioDefinitions';

interface UseScenarioWorkflowActionsParams {
  currentScenario: Scenario | null;
  activeUserId: string;
  telegramId?: number | string;
  costs: ScenarioImageCosts;
  nameError: string | null;
  handleSaveScenario: () => Promise<boolean>;
  fetchScenarioTestResultsFromDb: (scenarioId: string) => Promise<void>;
  fetchScenariosAndLogs: () => Promise<void>;
  onRefreshPosts?: () => Promise<void> | void;
  setScenarios: React.Dispatch<React.SetStateAction<Scenario[]>>;
  setDbTestResults: React.Dispatch<React.SetStateAction<Record<string, ScenarioNodeTestRecord>>>;
  setStatusMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
  setTestChoiceNode: React.Dispatch<React.SetStateAction<WorkflowNode | null>>;
  setResultModalNode: React.Dispatch<React.SetStateAction<WorkflowNode | null>>;
}

export function useScenarioWorkflowActions({
  currentScenario,
  activeUserId,
  telegramId,
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
}: UseScenarioWorkflowActionsParams) {
  const [isTestingNode, setIsTestingNode] = useState(false);
  const [testProgress, setTestProgress] = useState<ScenarioTestProgressState | null>(null);
  const [isExecutingWorkflow, setIsExecutingWorkflow] = useState(false);
  const [duplicatingScenarioId, setDuplicatingScenarioId] = useState<string | null>(null);

  const handleRunWholeScenario = async () => {
    if (!currentScenario) return;
    const savedOk = await handleSaveScenario();
    if (!savedOk) return;

    const activeNodes = (currentScenario.nodes || []).filter((n) => n.enabled !== false);
    setIsExecutingWorkflow(true);
    setStatusMessage(null);
    setTestProgress({
      isRunning: true,
      mode: 'chain',
      percent: 2,
      activeNodeId: activeNodes[0]?.id || '',
      activeNodeTitle: activeNodes[0]?.title || currentScenario.name,
      statusText: `Запуск сценария: ${activeNodes[0]?.title || currentScenario.name}...`,
      steps: activeNodes.map((n, idx) => ({
        nodeId: n.id,
        nodeTitle: n.title || 'Шаг сценария',
        nodeType: n.type,
        status: idx === 0 ? 'running' : 'pending',
        stepPercent: idx === 0 ? 5 : 0
      }))
    });

    try {
      const data = await runScenarioNodeStreamClient({
        endpoint: `/api/scenarios/${encodeURIComponent(currentScenario.id)}/run-stream`,
        scenarioId: currentScenario.id,
        payload: { userId: activeUserId, telegramId },
        onProgressUpdate: (updater) => setTestProgress(updater),
        onStepRecord: (nodeId, record) =>
          setDbTestResults((prev) => ({ ...prev, [nodeId]: record }))
      });

      if (data.testResults) setDbTestResults(data.testResults);
      else await fetchScenarioTestResultsFromDb(currentScenario.id);

      const billed = data.cost !== undefined ? data.cost : calculateTotalCost(currentScenario, costs);
      const runPublishErr =
        data.deliveryError ||
        data.publishError ||
        (data.success === false ? data.message || 'Не удалось доставить публикацию в Telegram' : '');
      if (runPublishErr) {
        setStatusMessage({
          type: 'error',
          text: `Сценарий завершен с ошибкой доставки в канал: ${runPublishErr}`
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `${data.message ? `${data.message}. ` : 'Сценарий выполнен! '}Списано: ${billed} Иирок.`
        });
      }
      fetchScenariosAndLogs();
      void onRefreshPosts?.();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Ошибка запуска' });
    } finally {
      setIsExecutingWorkflow(false);
      setTestProgress(null);
    }
  };

  const handleRunNodeOrChainTest = async (
    targetNode: WorkflowNode,
    mode: 'single' | 'chain',
    allowLivePublish = false
  ) => {
    if (!currentScenario) return;
    if (nameError) {
      setStatusMessage({ type: 'error', text: nameError });
      return;
    }

    const plannedNodes =
      mode === 'chain'
        ? computeChainToTarget(currentScenario.nodes || [], currentScenario.edges || [], targetNode.id)
        : [targetNode];

    setIsTestingNode(true);
    setStatusMessage(null);
    setTestProgress({
      isRunning: true,
      mode,
      percent: 2,
      activeNodeId: plannedNodes[0]?.id || targetNode.id,
      activeNodeTitle: plannedNodes[0]?.title || targetNode.title,
      statusText: `Запуск проверки: ${plannedNodes[0]?.title || targetNode.title}...`,
      steps: plannedNodes.map((n, idx) => ({
        nodeId: n.id,
        nodeTitle: n.title || 'Шаг сценария',
        nodeType: n.type,
        status: idx === 0 ? 'running' : 'pending',
        stepPercent: idx === 0 ? 5 : 0
      }))
    });

    try {
      const cleanNodes = (currentScenario.nodes || []).map((n) => {
        const copy = { ...n };
        delete copy.lastOutput;
        return copy;
      });

      const finalData = await runScenarioNodeStreamClient({
        scenarioId: currentScenario.id,
        payload: {
          scenarioId: currentScenario.id,
          scenarioSnapshot: {
            ...currentScenario,
            messageFormat: getScenarioActiveFormat(currentScenario),
            userId: activeUserId,
            nodes: cleanNodes
          },
          targetNodeId: targetNode.id,
          testMode: mode,
          allowLivePublish,
          nodeType: targetNode.type,
          config: targetNode.config || {},
          userId: activeUserId,
          telegramId
        },
        onProgressUpdate: (updater) => setTestProgress(updater),
        onStepRecord: (nodeId, record) =>
          setDbTestResults((prev) => ({ ...prev, [nodeId]: record }))
      });

      if (finalData.testResults) setDbTestResults(finalData.testResults);
      else await fetchScenarioTestResultsFromDb(currentScenario.id);

      setTestChoiceNode(null);
      setResultModalNode(targetNode);
      const testDeliveryErr =
        finalData.deliveryError ||
        finalData.output?.publishError ||
        plannedNodes
          .map((pn) => finalData.testResults?.[pn.id]?.output)
          .find((out) => out?.published === false || out?.publishError)?.publishError ||
        (finalData.success === false ? finalData.message : '');
      setStatusMessage({
        type: testDeliveryErr ? 'error' : 'success',
        text: testDeliveryErr
          ? `Тест завершен с ошибкой доставки в Telegram: ${testDeliveryErr}`
          : `${finalData.message} ${finalData.cost > 0 ? `(Списано: ${finalData.cost} Иирок)` : '(Бесплатно)'}`
      });
      fetchScenariosAndLogs();
      void onRefreshPosts?.();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Ошибка тестирования блока' });
    } finally {
      setIsTestingNode(false);
      setTestProgress(null);
    }
  };

  const handleDuplicateScenario = async (scen: Scenario) => {
    if (!scen?.id || duplicatingScenarioId) return;
    setDuplicatingScenarioId(scen.id);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/scenarios/${encodeURIComponent(scen.id)}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUserId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось создать копию сценария');
      }
      setScenarios((prev) => [data, ...prev.filter((s) => s.id !== data.id)]);
      setStatusMessage({
        type: 'success',
        text: `Создана копия сценария «${data.name}» и сохранена на сервере.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Ошибка при копировании сценария'
      });
    } finally {
      setDuplicatingScenarioId(null);
    }
  };

  return {
    isTestingNode,
    testProgress,
    isExecutingWorkflow,
    duplicatingScenarioId,
    handleRunWholeScenario,
    handleRunNodeOrChainTest,
    handleDuplicateScenario
  };
}
