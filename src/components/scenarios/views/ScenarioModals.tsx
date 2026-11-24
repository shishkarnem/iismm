import React, { useEffect, useState } from 'react';
import {
  X,
  Plus,
  Bot,
  Play,
  Layers,
  Sparkles,
  ArrowDown,
  Loader2,
  Copy,
  RefreshCw,
  CheckCircle2,
  Eye,
  GitBranch,
  Clock
} from 'lucide-react';
import {
  Scenario,
  WorkflowNode,
  ScenarioNodeTestRecord,
  ScenarioRichPart,
  ScenarioTestProgressState
} from '../../../types';
import { ScenarioImageCosts } from '../ScenarioImageNodeConfig';
import {
  NODE_DEFINITIONS,
  NodeTypeDefinition,
  resolveNodeDef,
  getDynamicNodeCost,
  computeChainToTarget
} from '../scenarioDefinitions';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../../ui-kit/ResponsiveActionBtn';
import { summarizeStepLivePreview } from '../edges/edgeOperations';
import { NeurosphereLoader } from '../../loaders/NeurosphereLoader';
import { usePricingConfig } from '../../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../../shared/pricingConfig';

interface ShellProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  zIndexClass?: string;
}

export const ScenarioModalShell: React.FC<ShellProps> = ({
  title,
  subtitle,
  icon,
  onClose,
  footer,
  children,
  zIndexClass = 'z-[60]'
}) => (
  <div
    className={`fixed inset-0 ${zIndexClass} flex items-center justify-center px-[2vw] py-3 sm:py-5 bg-gradient-to-r from-sky-100/55 via-pink-100/55 via-orange-100/55 via-pink-100/55 to-sky-100/55 backdrop-blur-md`}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full md:max-w-[940px] max-h-[92dvh] p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl rounded-[22px] flex flex-col max-h-[calc(92dvh-4px)] overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3.5 border-b border-pink-300/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-2xs shrink-0">
              {icon}
            </span>
            <div className="min-w-0">
              <h3 className="text-[17px] md:text-[18px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent truncate">
                {title}
              </h3>
              {subtitle && (
                <span className="text-[14px] font-medium text-slate-700 block truncate">
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно"
            title="Закрыть"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 text-slate-800 hover:text-slate-950 cursor-pointer transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 min-h-0 text-[14px]">
          {children}
        </div>

        {footer && (
          <div className="px-4 md:px-6 py-3.5 border-t border-pink-300/80 shrink-0 bg-gradient-to-r from-sky-50/60 via-pink-50/60 via-orange-50/60 via-pink-50/60 to-sky-50/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  </div>
);

export const ScenarioTestChoiceModal: React.FC<{
  targetNode: WorkflowNode | null;
  scenario: Scenario | null;
  costs: ScenarioImageCosts;
  isTesting: boolean;
  testProgress?: ScenarioTestProgressState | null;
  liveResults?: Record<string, ScenarioNodeTestRecord>;
  onOpenStepResult?: (nodeId: string) => void;
  onClose: () => void;
  onRunTest: (node: WorkflowNode, mode: 'single' | 'chain', allowLivePublish?: boolean) => void;
}> = ({
  targetNode,
  scenario,
  costs,
  isTesting,
  testProgress,
  liveResults,
  onOpenStepResult,
  onClose,
  onRunTest
}) => {
  const [allowLivePublish, setAllowLivePublish] = useState(true);
  useEffect(() => {
    setAllowLivePublish(true);
  }, [targetNode?.id]);
  if (!targetNode || !scenario) return null;

  const singleCost = getDynamicNodeCost(targetNode, costs, scenario);
  const chainNodes = computeChainToTarget(
    scenario.nodes || [],
    scenario.edges || [],
    targetNode.id
  );
  const chainCost = chainNodes.reduce(
    (acc, n) => acc + getDynamicNodeCost(n, costs, scenario),
    0
  );
  const isPublishType = (t?: string) => t === 'publish_post' || t === 'publish_telegram';
  const includesPublishNode =
    isPublishType(targetNode.type) || chainNodes.some((n) => isPublishType(n.type));

  const livePct = testProgress?.isRunning ? Math.min(100, Math.max(0, testProgress.percent)) : 0;

  return (
    <ScenarioModalShell
      title={isTesting ? 'Выполнение тестирования в реальном времени' : 'Выбор режима тестирования'}
      subtitle={`Целевой шаг: ${targetNode.title}`}
      icon={isTesting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="white" />}
      onClose={() => {
        if (!isTesting) onClose();
      }}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] text-slate-700 font-medium">
            {isTesting
              ? 'Результаты этапов автоматически сохраняются в базу данных'
              : 'Результаты теста сразу фиксируются на сервере'}
          </span>
          <ResponsiveActionBtn
            variant="secondary"
            icon={<X size={16} />}
            label="Отмена"
            title="Отменить тестирование"
            disabled={isTesting}
            onClick={onClose}
          />
        </div>
      }
    >
      {testProgress?.isRunning && (
        <div className="bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 rounded-2xl border-2 border-pink-300 p-4 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 shrink-0">
                <NeurosphereLoader variant="embed" />
              </div>
              <span className="text-[15px] font-bold text-slate-900 break-words">
                {testProgress.statusText || `Работает блок: ${testProgress.activeNodeTitle}`}
              </span>
            </div>
            <span className="text-[16px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-500 bg-clip-text text-transparent shrink-0">
              {livePct}%
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-sky-50/90 border border-pink-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 transition-all duration-300"
              style={{ width: `${Math.max(4, livePct)}%` }}
            />
          </div>

          {testProgress.steps.length > 0 && (
            <div className="space-y-2 pt-1">
              {testProgress.steps.map((st, idx) => {
                const isStepRunning = st.status === 'running';
                const isStepDone = st.status === 'done';
                const isStepSkipped = st.status === 'skipped';
                const stepLivePreview = isStepDone
                  ? summarizeStepLivePreview(liveResults?.[st.nodeId])
                  : null;
                return (
                  <div
                    key={st.nodeId}
                    className={`rounded-xl border px-3 py-2 flex flex-col gap-1.5 transition-all ${
                      isStepRunning
                        ? 'bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 to-sky-100/90 border-pink-500 ring-2 ring-pink-300 shadow-xs'
                        : isStepDone
                        ? 'bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-sky-50/90 border-sky-300'
                        : 'bg-gradient-to-r from-sky-50/65 via-pink-50/65 to-sky-50/65 border-pink-200 opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isStepRunning ? (
                          <Loader2 size={15} className="animate-spin text-pink-600 shrink-0" />
                        ) : isStepDone ? (
                          <CheckCircle2 size={15} className="text-sky-600 shrink-0" />
                        ) : (
                          <Clock size={14} className="text-slate-500 shrink-0" />
                        )}
                        <span className="text-[14px] font-bold text-slate-900 truncate">
                          {idx + 1}. {st.nodeTitle}
                        </span>
                      </div>
                      <span className="text-[14px] font-bold text-pink-700 shrink-0">
                        {isStepRunning
                          ? `В работе · ${st.stepPercent}%`
                          : isStepDone
                          ? 'Готово · 100%'
                          : isStepSkipped
                          ? 'Пропущен веткой'
                          : 'Ожидание'}
                      </span>
                    </div>

                    {isStepDone && stepLivePreview ? (
                      <div className="p-2 rounded-lg bg-white/85 border border-sky-200 flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {stepLivePreview.imageUrl && (
                            <img
                              src={stepLivePreview.imageUrl}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover border border-pink-300 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 break-words">
                              {stepLivePreview.headline}
                            </div>
                            {stepLivePreview.snippet && (
                              <div className="text-slate-700 line-clamp-2 break-words">
                                {stepLivePreview.snippet}
                              </div>
                            )}
                          </div>
                        </div>
                        {onOpenStepResult && (
                          <button
                            type="button"
                            onClick={() => onOpenStepResult(st.nodeId)}
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white font-bold text-[14px] flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Eye size={13} />
                            <span>Результат</span>
                          </button>
                        )}
                      </div>
                    ) : st.message ? (
                      <span className="text-[14px] text-slate-700 break-words">{st.message}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {includesPublishNode && (
        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 cursor-pointer text-[14px]">
          <input
            type="checkbox"
            checked={allowLivePublish}
            onChange={(e) => setAllowLivePublish(e.target.checked)}
            className="w-4 h-4 rounded border-pink-300 text-pink-600 cursor-pointer shrink-0"
          />
          <span className="font-bold text-slate-900">
            Отправить реальный проверочный пост в канал при тесте блока публикации
          </span>
        </label>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 rounded-2xl border-2 border-pink-300 p-4 flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-[16px] text-slate-900">Только этот блок</span>
              <UnboxedMetaLine items={[singleCost > 0 ? `${singleCost} Иирок` : 'Бесплатно']} />
            </div>
            <p className="text-[14px] text-slate-700 leading-relaxed">
              Выполнит только блок «{targetNode.title}» с подстановкой сохраненных данных предыдущих шагов.
            </p>
          </div>

          <button
            type="button"
            disabled={isTesting}
            onClick={() => onRunTest(targetNode, 'single', allowLivePublish)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-xs hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
          >
            {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Play size={15} fill="white" />}
            <span>Тестировать блок</span>
          </button>
        </div>

        <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 rounded-2xl border-2 border-pink-300 p-4 flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-[16px] text-slate-900">
                Цепочка до текущего блока
              </span>
              <UnboxedMetaLine
                items={[
                  `${chainNodes.length} шагов`,
                  chainCost > 0 ? `${chainCost} Иирок` : 'Бесплатно'
                ]}
              />
            </div>
            <p className="text-[14px] text-slate-700 leading-relaxed">
              Последовательно запустит все связанные блоки до текущего и передаст свежие данные по цепочке:
            </p>
            <div className="text-[14px] text-slate-800 font-semibold break-words">
              {chainNodes.map((cn, idx) => `${idx + 1}. ${cn.title}`).join(' → ')}
            </div>
          </div>

          <button
            type="button"
            disabled={isTesting}
            onClick={() => onRunTest(targetNode, 'chain', allowLivePublish)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-xs hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
          >
            {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
            <span>Тестировать цепочку ({chainNodes.length} шт.)</span>
          </button>
        </div>
      </div>
    </ScenarioModalShell>
  );
};

export const ScenarioTestResultModal: React.FC<{
  isOpen: boolean;
  scenario: Scenario | null;
  initialNode: WorkflowNode | null;
  liveResults?: Record<string, ScenarioNodeTestRecord>;
  onClose: () => void;
  onOpenTestChoice: (node: WorkflowNode) => void;
  onSyncResultsFromDb: (results: Record<string, ScenarioNodeTestRecord>) => void;
  onCopySuccess: (msg: string) => void;
}> = ({
  isOpen,
  scenario,
  initialNode,
  liveResults,
  onClose,
  onOpenTestChoice,
  onSyncResultsFromDb,
  onCopySuccess
}) => {
  const [activeNodeId, setActiveNodeId] = useState<string>(initialNode?.id || '');
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbResultsMap, setDbResultsMap] = useState<Record<string, ScenarioNodeTestRecord>>({});

  useEffect(() => {
    if (initialNode?.id) {
      setActiveNodeId(initialNode.id);
    }
  }, [initialNode?.id, isOpen]);

  const loadFromDatabase = async () => {
    if (!scenario?.id) return;
    setIsLoadingDb(true);
    try {
      const res = await fetch(
        `/api/scenarios/${encodeURIComponent(scenario.id)}/test-results`
      );
      if (res.ok) {
        const data = await res.json();
        const map = { ...(data?.testResults || {}), ...(liveResults || {}) };
        setDbResultsMap(map);
        onSyncResultsFromDb(map);
      }
    } catch (e) {
      console.error('Failed loading test results from DB:', e);
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    if (isOpen && scenario?.id) {
      loadFromDatabase();
    }
  }, [isOpen, scenario?.id, initialNode?.id]);

  if (!isOpen || !scenario || !initialNode) return null;

  const mergedResults: Record<string, ScenarioNodeTestRecord> = {
    ...dbResultsMap,
    ...(liveResults || {})
  };

  const currentNode =
    (scenario.nodes || []).find((n) => n.id === activeNodeId) || initialNode;
  const record: ScenarioNodeTestRecord | undefined = mergedResults[currentNode.id];
  const output = record?.output || null;

  const modeLabel =
    record?.mode === 'chain'
      ? 'Тест цепочки до блока'
      : record?.mode === 'full'
      ? 'Полный запуск сценария'
      : 'Тест одного блока';

  const imageList: string[] =
    Array.isArray(output?.imageUrls) && output.imageUrls.length > 0
      ? output.imageUrls.filter(Boolean)
      : output?.imageUrl
      ? [output.imageUrl]
      : [];

  const richParts: ScenarioRichPart[] = Array.isArray(output?.parts) ? output.parts : [];

  const stepOptions = (scenario.nodes || []).map((n, idx) => ({
    value: n.id,
    label: `${idx + 1}. ${n.title}`,
    description: mergedResults[n.id] ? 'Есть сохраненный результат' : 'Еще не тестировался'
  }));

  return (
    <ScenarioModalShell
      title={`Результат тестирования: ${currentNode.title}`}
      subtitle="Данные загружены напрямую из базы данных"
      icon={<Eye size={18} />}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ResponsiveActionBtn
              variant="primary"
              icon={<Play size={15} fill="white" />}
              label="Запустить новый тест"
              title="Запустить новый тест этого шага"
              onClick={() => {
                onClose();
                onOpenTestChoice(currentNode);
              }}
            />

            <ResponsiveActionBtn
              variant="secondary"
              icon={
                <RefreshCw
                  size={15}
                  className={isLoadingDb ? 'animate-spin text-pink-600' : 'text-pink-600'}
                />
              }
              label="Обновить из базы"
              title="Обновить результаты из базы данных"
              disabled={isLoadingDb}
              onClick={loadFromDatabase}
            />
          </div>

          <ResponsiveActionBtn
            variant="secondary"
            icon={<X size={16} />}
            label="Закрыть"
            title="Закрыть окно результатов"
            onClick={onClose}
          />
        </div>
      }
    >
      {stepOptions.length > 1 && (
        <GradientSelect
          label="Просмотр шага сценария"
          value={currentNode.id}
          options={stepOptions}
          onChange={setActiveNodeId}
        />
      )}

      {isLoadingDb ? (
        <NeurosphereLoader variant="inline" label="Загрузка сохраненного результата..." />
      ) : !record || !output ? (
        <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 rounded-2xl border border-pink-300 p-6 text-center space-y-2">
          <p className="text-[15px] font-bold text-slate-900">
            Для шага «{currentNode.title}» пока нет сохраненных результатов
          </p>
          <p className="text-[14px] text-slate-700">
            Запустите проверку блока или цепочки до него — результат сразу сохранится на сервере.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2.5 rounded-2xl border border-pink-300">
            <div className="flex items-center gap-2 font-bold text-pink-700">
              <CheckCircle2 size={16} className="text-sky-600 shrink-0" />
              <span>{modeLabel}</span>
            </div>
            <UnboxedMetaLine
              items={[
                record.cost ? `Стоимость: ${record.cost} Иирок` : 'Бесплатно',
                ...(record.testedAt
                  ? [new Date(record.testedAt).toLocaleString('ru-RU')]
                  : [])
              ]}
            />
          </div>

          {output.scheduleInfo && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200">
              <span className="font-bold text-pink-700 block mb-0.5">Параметры триггера:</span>
              <span className="text-slate-800 font-medium">{output.scheduleInfo}</span>
            </div>
          )}

          {(output.topic || output.title) && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-4 rounded-2xl border border-pink-200 space-y-1">
              <span className="text-[14px] font-bold text-pink-700 block">Тема / заголовок:</span>
              <p className="text-[15px] font-bold text-slate-900 break-words">
                {output.topic || output.title}
              </p>
            </div>
          )}

          {(output.imagePrompt || output.prompt) && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[14px] font-bold text-pink-700">
                  Промпт генерации картинки:
                </span>
                <ResponsiveActionBtn
                  variant="secondary"
                  icon={<Copy size={14} />}
                  label="Копировать промпт"
                  title="Скопировать промпт картинки"
                  onClick={() => {
                    navigator.clipboard.writeText(output.imagePrompt || output.prompt);
                    onCopySuccess('Промпт картинки скопирован в буфер обмена');
                  }}
                />
              </div>
              <p className="text-[14px] text-slate-800 break-words whitespace-pre-line">
                {output.imagePrompt || output.prompt}
              </p>
            </div>
          )}

          {richParts.length > 0 && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-4 rounded-2xl border border-pink-200 space-y-3">
              <span className="text-[14px] font-bold text-pink-700 block">
                Смысловые части Rich ({richParts.length} шт.):
              </span>
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {richParts.map((part, pIdx) => (
                  <div
                    key={part.index || pIdx}
                    className="p-3 rounded-xl bg-sky-50/75 border border-pink-200 space-y-1.5"
                  >
                    <div className="font-bold text-slate-900">
                      Часть {part.index || pIdx + 1}: {part.heading || 'Раздел'}
                    </div>
                    <p className="text-slate-800 whitespace-pre-line break-words">
                      {part.text}
                    </p>
                    {part.imagePrompt && (
                      <div className="text-pink-800 bg-pink-50/75 px-2.5 py-1.5 rounded-lg border border-pink-200">
                        <strong>Промпт к части:</strong> {part.imagePrompt}
                      </div>
                    )}
                    {Array.isArray(part.imageUrls) && part.imageUrls.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {part.imageUrls.map((u, uIdx) => (
                          <img
                            key={uIdx}
                            src={u}
                            alt={`Часть ${part.index || pIdx + 1} кадр ${uIdx + 1}`}
                            className="w-full aspect-video object-cover rounded-lg border border-pink-200"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {output.text && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-4 rounded-2xl border border-pink-200 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[14px] font-bold text-pink-700">
                  Текст публикации ({output.text.length} симв.):
                </span>
                <ResponsiveActionBtn
                  variant="secondary"
                  icon={<Copy size={14} />}
                  label="Копировать текст"
                  title="Скопировать текст публикации"
                  onClick={() => {
                    navigator.clipboard.writeText(output.text);
                    onCopySuccess('Текст результата скопирован в буфер обмена');
                  }}
                />
              </div>
              <div className="text-[14px] text-slate-800 whitespace-pre-line leading-relaxed max-h-[280px] overflow-y-auto p-3.5 bg-sky-50/60 rounded-xl border border-pink-200 break-words">
                {output.text}
              </div>
            </div>
          )}

          {imageList.length > 0 && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-4 rounded-2xl border border-pink-200 space-y-2.5">
              <span className="text-[14px] font-bold text-pink-700 block">
                {imageList.length > 1
                  ? `Медиа-кадры (${imageList.length} шт. · ${output.mediaType || 'альбом'}):`
                  : 'Изображение блока:'}
              </span>
              {imageList.length > 1 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {imageList.map((imgUrl, idx) => (
                    <a
                      key={idx}
                      href={imgUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl overflow-hidden border border-pink-200 bg-sky-50/70"
                    >
                      <img
                        src={imgUrl}
                        alt={`Кадр ${idx + 1}`}
                        className="w-full aspect-square object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-pink-200 max-h-[380px] flex items-center justify-center bg-sky-50/60">
                  <img
                    src={imageList[0]}
                    alt="Результат генерации"
                    className="w-full h-auto object-contain max-h-[360px]"
                  />
                </div>
              )}
            </div>
          )}

          {output.attachmentKind && Array.isArray(output.attachmentUrls) && output.attachmentUrls.length > 0 && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 space-y-1.5">
              <span className="font-bold text-pink-700 block">
                Медиа-вложение v2 ({output.attachmentKind}):
              </span>
              <div className="space-y-1 text-slate-700 break-all">
                {output.attachmentUrls.map((u: string, i: number) => (
                  <div key={i}>
                    #{i + 1}: {u}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(output.inlineButtons) && output.inlineButtons.length > 0 && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 space-y-2">
              <span className="font-bold text-pink-700 block">Инлайн-кнопки под постом:</span>
              <div className="flex flex-wrap gap-2">
                {output.inlineButtons.flat().map((b: any, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-xl bg-sky-50/90 border border-sky-200 text-sky-900 font-semibold break-all"
                  >
                    {b.text} ({b.url})
                  </span>
                ))}
              </div>
            </div>
          )}

          {output.signature && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 space-y-1">
              <span className="font-bold text-pink-700 block">Подпись:</span>
              <p className="whitespace-pre-line text-slate-800">{output.signature}</p>
            </div>
          )}

          {(output.branch || output.condition !== undefined || output.passed !== undefined) && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 text-slate-800 font-medium flex items-center gap-2">
              <GitBranch size={16} className="text-pink-600 shrink-0" />
              <span>
                Результат условия:{' '}
                <strong className={output.branch === 'no' || output.passed === false ? 'text-orange-700' : 'text-sky-700'}>
                  {output.branch === 'no' || output.passed === false
                    ? 'Ветка «Нет» (иначе)'
                    : 'Ветка «Да» (выполнено)'}
                </strong>
                {output.summary ? ` · ${output.summary}` : ''}
              </span>
            </div>
          )}

          {output.publishError && (
            <div className="bg-rose-50/90 p-3.5 rounded-2xl border border-rose-300 text-rose-800 font-bold">
              Ошибка доставки в канал: {output.publishError}
            </div>
          )}

          {output.draftId && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 text-slate-800 font-medium flex items-center gap-2">
              <Sparkles size={16} className="text-pink-600 shrink-0" />
              <span>
                Сохранено в черновиках редактора (код записи:{' '}
                <strong className="text-pink-700">{output.draftId}</strong>)
              </span>
            </div>
          )}

          {(output.timingSummary || output.scheduledFor) && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 text-slate-800 font-medium flex items-center gap-2">
              <Clock size={16} className="text-sky-600 shrink-0" />
              <span>
                Режим выхода:{' '}
                <strong className="text-sky-900">
                  {output.timingSummary ||
                    (output.scheduledFor
                      ? new Date(output.scheduledFor).toLocaleString('ru-RU')
                      : 'По расписанию')}
                </strong>
              </span>
            </div>
          )}

          {(output.channel || (Array.isArray(output.channels) && output.channels.length > 0)) && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 text-slate-800 font-medium">
              Каналы доставки:{' '}
              <strong className="text-pink-700">
                {Array.isArray(output.channels) && output.channels.length > 0
                  ? output.channels.join(', ')
                  : output.channel}
              </strong>
            </div>
          )}

          {output.delayMinutes !== undefined && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 text-slate-800 font-medium">
              Настроенная пауза: <strong className="text-pink-700">{output.delayMinutes} мин.</strong>
            </div>
          )}

          {output.notified && (
            <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 rounded-2xl border border-pink-200 text-slate-800 font-medium">
              Личное уведомление автору активно и проверено.
            </div>
          )}
        </div>
      )}
    </ScenarioModalShell>
  );
};

const CATALOG_CATEGORIES = [
  { value: 'all', label: 'Все блоки формата' },
  { value: 'trigger', label: 'Триггеры' },
  { value: 'ai', label: 'Нейрогенерация' },
  { value: 'format', label: 'Части и оформление' },
  { value: 'logic', label: 'Условия и паузы' },
  { value: 'delivery', label: 'Публикация и черновик' }
];

export const ScenarioCatalogModal: React.FC<{
  isOpen: boolean;
  scenarioFormat: 'v2' | 'rich';
  costs?: ScenarioImageCosts;
  onClose: () => void;
  onAddNode: (def: NodeTypeDefinition) => void;
}> = ({ isOpen, scenarioFormat, costs, onClose, onAddNode }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { pricing } = usePricingConfig();
  const effectiveCosts: ScenarioImageCosts = costs || {
    cost787: pricing.imageModels.func_787,
    cost621: pricing.imageModels.func_621,
    cost784: pricing.imageModels.func_784,
    cost791: pricing.imageModels.func_791,
    pricingConfig: pricing
  };

  if (!isOpen) return null;

  const visibleDefs = NODE_DEFINITIONS.filter((def) => {
    if (def.isLegacyHidden) return false;
    const matchesFormat =
      !def.supportedFormats || def.supportedFormats.includes(scenarioFormat);
    if (!matchesFormat) return false;
    if (activeCategory !== 'all' && def.category !== activeCategory) return false;
    return true;
  });

  return (
    <ScenarioModalShell
      title={`Каталог блоков конструктора ${scenarioFormat === 'rich' ? 'Rich' : 'v2'}`}
      subtitle={
        scenarioFormat === 'rich'
          ? 'Блоки смыслового деления на части (1–10), визуала частей и сборки Rich-поста'
          : 'Блоки разметки v2, 7 типов медиа-вложений, промптов и публикации'
      }
      icon={<Plus size={18} />}
      onClose={onClose}
    >
      <GradientSelect
        label="Категория блоков"
        value={activeCategory}
        options={CATALOG_CATEGORIES}
        onChange={setActiveCategory}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibleDefs.map((def) => {
          const IconComp = def.icon;
          const isExclusiveRich =
            def.supportedFormats?.length === 1 && def.supportedFormats[0] === 'rich';
          const isExclusiveV2 =
            def.supportedFormats?.length === 1 && def.supportedFormats[0] === 'v2';

          const dynamicItemCost = getDynamicNodeCost(
            {
              id: def.type,
              type: def.type,
              title: def.title,
              x: 0,
              y: 0,
              enabled: true,
              cost: def.cost,
              isUnderDevelopment: def.isUnderDevelopment,
              config: def.type === 'format_inline_buttons' ? { buttonsMode: 'ai_from_post' } : {}
            } as WorkflowNode,
            effectiveCosts
          );
          const costText = def.isUnderDevelopment
            ? 'В разработке'
            : dynamicItemCost > 0
            ? formatIirkyCount(dynamicItemCost)
            : 'Бесплатно';

          return (
            <div
              key={def.type}
              onClick={() => onAddNode(def)}
              className={`bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 rounded-2xl p-3.5 space-y-2 transition-all cursor-pointer shadow-2xs hover:border-pink-400 hover:shadow-md ${
                def.isUnderDevelopment ? 'opacity-65 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-2xs shrink-0">
                    <IconComp size={16} />
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-bold text-slate-900 truncate">{def.title}</h4>
                    <UnboxedMetaLine
                      items={[
                        costText,
                        ...(isExclusiveRich
                          ? ['Формат Rich']
                          : isExclusiveV2
                          ? ['Формат v2']
                          : [])
                      ]}
                    />
                  </div>
                </div>
              </div>

              <p className="text-[14px] text-slate-700 line-clamp-2">{def.description}</p>
            </div>
          );
        })}
      </div>
    </ScenarioModalShell>
  );
};

export const ScenarioConnectModal: React.FC<{
  isOpen: boolean;
  sourceNodeId: string | null;
  initialBranch?: 'yes' | 'no';
  nodes: WorkflowNode[];
  onClose: () => void;
  onConnect: (sourceId: string, targetId: string, branch?: 'yes' | 'no' | 'default') => void;
}> = ({ isOpen, sourceNodeId, initialBranch, nodes, onClose, onConnect }) => {
  const [selectedBranch, setSelectedBranch] = useState<'yes' | 'no'>(initialBranch || 'yes');

  useEffect(() => {
    setSelectedBranch(initialBranch || 'yes');
  }, [initialBranch, sourceNodeId, isOpen]);

  if (!isOpen || !sourceNodeId) return null;

  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  const isLogicFilter = sourceNode?.type === 'logic_filter';

  return (
    <ScenarioModalShell
      title={
        isLogicFilter
          ? `Подключить ветку блока «${sourceNode?.title}»`
          : 'Соединить с блоком ниже'
      }
      subtitle="Выберите целевой блок для передачи данных по цепочке"
      icon={<ArrowDown size={18} />}
      onClose={onClose}
    >
      {isLogicFilter && (
        <GradientSelect
          label="Какую ветку условия подключаем"
          value={selectedBranch}
          options={[
            { value: 'yes', label: 'Ветка «Да» — условие выполнено' },
            { value: 'no', label: 'Ветка «Нет» — иначе' }
          ]}
          onChange={(v) => setSelectedBranch(v as 'yes' | 'no')}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {nodes
          .filter(
            (n) =>
              n.id !== sourceNodeId &&
              n.type !== 'trigger_schedule' &&
              n.type !== 'trigger_manual'
          )
          .map((targetNode) => {
            const def = resolveNodeDef(targetNode.type);
            const IconComp = def?.icon || Bot;
            return (
              <button
                key={targetNode.id}
                type="button"
                onClick={() =>
                  onConnect(
                    sourceNodeId,
                    targetNode.id,
                    isLogicFilter ? selectedBranch : 'default'
                  )
                }
                className="w-full text-left bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 hover:opacity-95 border border-pink-300 hover:border-pink-400 p-3 rounded-2xl flex items-center justify-between gap-2 cursor-pointer shadow-2xs transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="p-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
                    <IconComp size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-slate-900 truncate">
                      {targetNode.title}
                    </div>
                    <div className="text-[14px] text-slate-600 truncate">
                      {def?.categoryTitle}
                    </div>
                  </div>
                </div>
                <ArrowDown size={16} className="text-pink-600 shrink-0" />
              </button>
            );
          })}
      </div>
    </ScenarioModalShell>
  );
};
