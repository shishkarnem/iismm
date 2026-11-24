import { useState, useEffect } from 'react';
import { Channel, Scenario } from '../../../../types';
import { canUseOtryv } from '../../../../utils/tariff/tariffUtils';

export const IIRKA_SCENARIO_COST = 5;

export interface IirkaStepDiffItem {
  nodeId: string;
  nodeType: string;
  title: string;
  subtitle: string;
  status: 'added' | 'modified' | 'unchanged' | 'removed';
  cost: number;
}

export interface IirkaClientResult {
  success: boolean;
  mode: 'create' | 'edit';
  savedToDb: boolean;
  chargedCost?: number;
  newBalance?: number;
  assistantSummary: string;
  highlights: string[];
  estimatedRunCost: number;
  scenario: Scenario;
  stepDiffs: IirkaStepDiffItem[];
}

export interface IirkaStageProgress {
  stageIndex: number;
  percent: number;
  stageTitle: string;
  detail: string;
}

interface UseIirkaAssistantParams {
  activeUserId: string;
  userBalance?: number;
  userTariff?: string;
  userRole?: string;
  scenarios: Scenario[];
  currentScenario: Scenario | null;
  channels: Channel[];
  onApplyScenarioToEditor: (scen: Scenario, savedNotice?: string) => void;
  onRefreshScenarios: () => Promise<void>;
  onStatusMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export function useIirkaAssistant({
  activeUserId,
  userBalance = 0,
  userTariff,
  userRole,
  scenarios,
  currentScenario,
  channels,
  onApplyScenarioToEditor,
  onRefreshScenarios,
  onStatusMessage
}: UseIirkaAssistantParams) {
  const defaultChannel =
    (channels[0] as any)?.channel_id || channels[0]?.username || '@SAV_AI';

  const [isOpen, setIsOpen] = useState(false);
  const [isTariffGateOpen, setIsTariffGateOpen] = useState(false);
  const [liveBalance, setLiveBalance] = useState<number>(userBalance);

  useEffect(() => {
    setLiveBalance(userBalance);
  }, [userBalance]);

  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selectedEditId, setSelectedEditId] = useState<string>('');
  const [preferredFormat, setPreferredFormat] = useState<'auto' | 'v2' | 'rich'>('auto');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([defaultChannel]);

  const [taskText, setTaskText] = useState('');
  const [audioUrl, setAudioUrl] = useState('');

  const [isWorking, setIsWorking] = useState(false);
  const [stageProgress, setStageProgress] = useState<IirkaStageProgress>({
    stageIndex: 1,
    percent: 10,
    stageTitle: 'Подготовка нейросферы Иирки',
    detail: 'Настраиваю связь с конструктором сценариев...'
  });

  const [previewResult, setPreviewResult] = useState<IirkaClientResult | null>(null);
  const [refinementText, setRefinementText] = useState('');
  const [refinementAudioUrl, setRefinementAudioUrl] = useState('');
  const [refinementHistory, setRefinementHistory] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const [undoSnapshot, setUndoSnapshot] = useState<Scenario | null>(null);

  const openForCreate = () => {
    if (!canUseOtryv(userTariff, userRole)) {
      setIsTariffGateOpen(true);
      return;
    }
    setMode('create');
    setPreferredFormat('auto');
    const firstCh =
      (channels[0] as any)?.channel_id || channels[0]?.username || '@SAV_AI';
    setSelectedChannels([firstCh]);
    setTaskText('');
    setAudioUrl('');
    setPreviewResult(null);
    setRefinementText('');
    setRefinementAudioUrl('');
    setRefinementHistory([]);
    setErrorText(null);
    setIsOpen(true);
  };

  const openForEdit = (target?: Scenario | null) => {
    if (!canUseOtryv(userTariff, userRole)) {
      setIsTariffGateOpen(true);
      return;
    }
    const chosen = target || currentScenario || scenarios[0] || null;
    if (!chosen) {
      openForCreate();
      return;
    }
    setMode('edit');
    setSelectedEditId(chosen.id);
    setPreferredFormat(chosen.messageFormat === 'rich' ? 'rich' : 'v2');
    setSelectedChannels(
      Array.isArray(chosen.targetChannels) && chosen.targetChannels.length > 0
        ? chosen.targetChannels
        : [defaultChannel]
    );
    setTaskText('');
    setAudioUrl('');
    setPreviewResult(null);
    setRefinementText('');
    setRefinementAudioUrl('');
    setRefinementHistory([]);
    setErrorText(null);
    setIsOpen(true);
  };

  const closeAssistant = () => {
    if (isWorking) return;
    setIsOpen(false);
  };

  const resolveEditingScenario = (): Scenario | null => {
    if (previewResult && previewResult.scenario) {
      return previewResult.scenario;
    }
    if (currentScenario && currentScenario.id === selectedEditId) {
      return currentScenario;
    }
    return scenarios.find((s) => s.id === selectedEditId) || currentScenario || scenarios[0] || null;
  };

  const runIirkaTask = async (isRefinement = false) => {
    const promptToSend = (isRefinement ? refinementText : taskText).trim();
    if (!promptToSend) {
      setErrorText('Пожалуйста, наговорите задачу голосом или напишите текстом.');
      return;
    }

    const effectiveMode: 'create' | 'edit' = isRefinement ? 'edit' : mode;
    const baseScenario =
      effectiveMode === 'edit' ? resolveEditingScenario() : null;

    if (effectiveMode === 'edit' && !baseScenario) {
      setErrorText('Выберите сценарий для редактирования или переключитесь на создание нового.');
      return;
    }

    setErrorText(null);
    setIsWorking(true);
    setStageProgress({
      stageIndex: 1,
      percent: 10,
      stageTitle: 'Анализ задачи и каналов',
      detail: 'Иирка изучает ваше поручение и параметры выбранных каналов...'
    });

    try {
      const cleanSnapshot = baseScenario
        ? {
            ...baseScenario,
            nodes: (baseScenario.nodes || []).map((n) => {
              const copy = { ...n };
              delete copy.lastOutput;
              return copy;
            })
          }
        : null;

      const response = await fetch('/api/scenarios/ai-assistant-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: effectiveMode,
          taskText: promptToSend,
          preferredFormat,
          targetChannels: selectedChannels,
          existingScenario: cleanSnapshot,
          refinementHistory,
          autoSave: false,
          userId: activeUserId
        })
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || 'Не удалось связаться с помощником Ииркой');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: IirkaClientResult | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const trimmed = rawLine.trim();
          if (!trimmed) continue;
          let evt: any = null;
          try {
            evt = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (evt.type === 'stage') {
            setStageProgress({
              stageIndex: Number(evt.stageIndex || 1),
              percent: Number(evt.percent || 25),
              stageTitle: String(evt.stageTitle || 'Настройка сценария'),
              detail: String(evt.detail || '')
            });
          } else if (evt.type === 'done' && evt.result) {
            finalResult = evt.result as IirkaClientResult;
          } else if (evt.type === 'error') {
            throw new Error(evt.error || 'Ошибка обработки задачи Ииркой');
          }
        }
      }

      if (!finalResult) {
        throw new Error('Иирка не вернула итоговый сценарий. Попробуйте уточнить формулировку.');
      }

      if (typeof finalResult.newBalance === 'number') {
        setLiveBalance(finalResult.newBalance);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('iismm-balance-updated', {
              detail: { balance: finalResult.newBalance }
            })
          );
        }
      }

      setPreviewResult(finalResult);
      setRefinementHistory((prev) => [
        ...prev,
        { role: 'user', text: promptToSend },
        { role: 'assistant', text: finalResult!.assistantSummary }
      ]);
      if (isRefinement) {
        setRefinementText('');
        setRefinementAudioUrl('');
      }
    } catch (err: any) {
      setErrorText(err?.message || 'Произошла ошибка при работе Иирки');
    } finally {
      setIsWorking(false);
    }
  };

  const commitResultAndSaveToDb = async () => {
    if (!previewResult?.scenario) return;
    setIsCommitting(true);
    setErrorText(null);

    const targetScen = previewResult.scenario;
    const isExisting = scenarios.some((s) => s.id === targetScen.id);

    if (mode === 'edit') {
      const original =
        scenarios.find((s) => s.id === targetScen.id) || currentScenario || null;
      if (original) {
        setUndoSnapshot(JSON.parse(JSON.stringify(original)));
      }
    }

    try {
      const url = isExisting
        ? `/api/scenarios/${encodeURIComponent(targetScen.id)}`
        : '/api/scenarios';
      const method = isExisting ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...targetScen,
          userId: activeUserId
        })
      });

      const savedData = await res.json();
      if (!res.ok) {
        throw new Error(savedData?.error || 'Не удалось сохранить сценарий на сервере');
      }

      await onRefreshScenarios();
      setIsOpen(false);
      onApplyScenarioToEditor(
        savedData,
        mode === 'edit'
          ? `Иирка обновила и сохранила сценарий «${savedData.name}» в базе данных.`
          : `Иирка создала и зафиксировала на сервере новый сценарий «${savedData.name}».`
      );
    } catch (err: any) {
      setErrorText(err?.message || 'Ошибка сохранения сценария');
    } finally {
      setIsCommitting(false);
    }
  };

  const applyDraftToCanvasOnly = () => {
    if (!previewResult?.scenario) return;
    if (mode === 'edit') {
      const original =
        currentScenario?.id === previewResult.scenario.id
          ? currentScenario
          : scenarios.find((s) => s.id === previewResult.scenario.id) || null;
      if (original) {
        setUndoSnapshot(JSON.parse(JSON.stringify(original)));
      }
    }
    setIsOpen(false);
    onApplyScenarioToEditor(
      previewResult.scenario,
      `Вариант от Иирки открыт в конструкторе «${previewResult.scenario.name}». Проверьте шаги и нажмите «Сохранить».`
    );
  };

  const rollbackUndoSnapshot = async () => {
    if (!undoSnapshot) return;
    try {
      const res = await fetch(`/api/scenarios/${encodeURIComponent(undoSnapshot.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...undoSnapshot,
          userId: activeUserId
        })
      });
      if (res.ok) {
        const restored = await res.json();
        await onRefreshScenarios();
        onApplyScenarioToEditor(
          restored,
          `Правки Иирки отменены — сценарий «${restored.name}» возвращен к прежнему состоянию.`
        );
      } else {
        onApplyScenarioToEditor(
          undoSnapshot,
          `Сценарий «${undoSnapshot.name}» возвращен к прежнему состоянию на холсте.`
        );
      }
      setUndoSnapshot(null);
    } catch {
      onStatusMessage({
        type: 'error',
        text: 'Не удалось откатить сценарий на сервере'
      });
    }
  };

  return {
    isOpen,
    isTariffGateOpen,
    closeTariffGate: () => setIsTariffGateOpen(false),
    liveBalance,
    mode,
    setMode,
    selectedEditId,
    setSelectedEditId,
    preferredFormat,
    setPreferredFormat,
    selectedChannels,
    setSelectedChannels,
    taskText,
    setTaskText,
    audioUrl,
    setAudioUrl,
    isWorking,
    stageProgress,
    previewResult,
    setPreviewResult,
    refinementText,
    setRefinementText,
    refinementAudioUrl,
    setRefinementAudioUrl,
    errorText,
    setErrorText,
    isCommitting,
    undoSnapshot,
    clearUndoSnapshot: () => setUndoSnapshot(null),
    rollbackUndoSnapshot,
    openForCreate,
    openForEdit,
    closeAssistant,
    runIirkaTask,
    commitResultAndSaveToDb,
    applyDraftToCanvasOnly
  };
}
