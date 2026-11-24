import React from 'react';
import {
  Workflow,
  Play,
  Plus,
  History,
  Layers,
  Sliders,
  Loader2,
  Check,
  Smartphone,
  Monitor,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye
} from 'lucide-react';
import {
  Scenario,
  ScenarioNodeTestRecord,
  ScenarioTestProgressState
} from '../../../../types';
import { NeuralSphere } from '../../../NeuralSphere';
import { GradientSelect } from '../../../ui-kit/GradientDropdown';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../../../ui-kit/ResponsiveActionBtn';
import { summarizeStepLivePreview } from '../../edges/edgeOperations';

interface ScenarioTopNavBannerProps {
  activeTab: 'list' | 'editor' | 'logs';
  scenariosCount: number;
  logsCount: number;
  currentScenario: Scenario | null;
  currentScenarioFormat: 'v2' | 'rich';
  statusMessage: { type: 'success' | 'error'; text: string } | null;
  onChangeTab: (tab: 'list' | 'editor' | 'logs') => void;
  onClearStatus: () => void;
}

export const ScenarioTopNavBanner: React.FC<ScenarioTopNavBannerProps> = ({
  activeTab,
  scenariosCount,
  logsCount,
  currentScenario,
  currentScenarioFormat,
  statusMessage,
  onChangeTab,
  onClearStatus
}) => {
  const navOptions = [
    {
      value: 'list',
      label: `Список сценариев (${scenariosCount})`,
      icon: <Layers size={16} />
    },
    ...(currentScenario
      ? [
          {
            value: 'editor',
            label: `Конструктор ${currentScenarioFormat === 'rich' ? 'Rich' : 'v2'}: ${currentScenario.name}`,
            icon: <Sliders size={16} />
          }
        ]
      : []),
    {
      value: 'logs',
      label: `История запусков (${logsCount})`,
      icon: <History size={16} />
    }
  ];

  return (
    <div className="bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md border border-pink-300 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs shrink-0">
            <Workflow size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
              Сценарии и автоматизация
            </h1>
            <p className="text-[14px] font-medium text-slate-700 break-words">
              Конструкторы Rich и v2: генерация тем, промптов, иллюстраций, частей и отложенный выход
            </p>
          </div>
        </div>

        {/* Vertical Gradient Dropdown on Mobile & Compact Screens */}
        <div className="md:hidden w-full">
          <GradientSelect
            value={activeTab}
            onChange={(val) => onChangeTab(val as 'list' | 'editor' | 'logs')}
            options={navOptions}
            buttonVariant="vivid"
          />
        </div>

        {/* Clean Desktop Switcher */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {navOptions.map((opt) => (
            <ResponsiveActionBtn
              key={opt.value}
              variant={activeTab === opt.value ? 'vivid' : 'outline'}
              showLabelFrom="always"
              icon={opt.icon || <Layers size={16} />}
              label={
                opt.value === 'editor'
                  ? `Конструктор ${currentScenarioFormat === 'rich' ? 'Rich' : 'v2'}`
                  : opt.label
              }
              onClick={() => onChangeTab(opt.value as 'list' | 'editor' | 'logs')}
            />
          ))}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-2xl text-[14px] font-medium border flex items-center justify-between gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-sky-100/80 text-slate-900 border-sky-300'
              : 'bg-rose-100/80 text-rose-900 border-rose-300'
          }`}
        >
          <span className="break-words min-w-0 flex-1">{statusMessage.text}</span>
          <button
            type="button"
            onClick={onClearStatus}
            aria-label="Скрыть уведомление"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/60 text-slate-700 cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

interface ScenarioEditorToolbarProps {
  scenarioName: string;
  currentScenarioFormat: 'v2' | 'rich';
  nameError: string | null;
  isCheckingName: boolean;
  editorViewMode: 'canvas' | 'list';
  isExecutingWorkflow: boolean;
  isSavingScenario: boolean;
  totalWorkflowCost: number;
  onNameChange: (val: string) => void;
  onChangeViewMode: (mode: 'canvas' | 'list') => void;
  onOpenIirkaEditor: () => void;
  onOpenCatalog: () => void;
  onRunScenario: () => void;
  onSaveScenario: () => void;
}

export const ScenarioEditorToolbar: React.FC<ScenarioEditorToolbarProps> = ({
  scenarioName,
  currentScenarioFormat,
  nameError,
  isCheckingName,
  editorViewMode,
  isExecutingWorkflow,
  isSavingScenario,
  totalWorkflowCost,
  onNameChange,
  onChangeViewMode,
  onOpenIirkaEditor,
  onOpenCatalog,
  onRunScenario,
  onSaveScenario
}) => {
  return (
    <div className="bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md border border-pink-300 rounded-3xl p-3.5 sm:p-4 shadow-sm space-y-2.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex items-center flex-1 min-w-0">
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => onNameChange(e.target.value)}
              className={`w-full min-h-[42px] bg-white/85 rounded-xl px-3.5 py-2 text-[16px] font-bold text-slate-900 focus:outline-none focus:ring-2 border ${
                nameError
                  ? 'border-rose-400 focus:ring-rose-400'
                  : 'border-pink-300 focus:ring-pink-400'
              }`}
              placeholder="Введите уникальное название сценария"
            />
            {isCheckingName && (
              <Loader2
                size={16}
                className="animate-spin text-pink-500 absolute right-3 pointer-events-none"
              />
            )}
          </div>

          <UnboxedMetaLine
            items={[
              `Формат ${currentScenarioFormat === 'rich' ? 'Rich' : 'v2'}`,
              totalWorkflowCost > 0 ? `${totalWorkflowCost} Иирок / запуск` : 'Бесплатно'
            ]}
            className="shrink-0"
          />
        </div>

        {/* Ergonomic Action Bar: Icon-only >=40x40px on mobile, Icon + Label on desktop */}
        <div className="flex flex-wrap items-center gap-2">
          <ResponsiveActionBtn
            variant={editorViewMode === 'canvas' ? 'vivid' : 'outline'}
            showLabelFrom="md"
            icon={<Monitor size={16} />}
            label="Карта"
            title="Карта блоков сценария"
            onClick={() => onChangeViewMode('canvas')}
          />

          <ResponsiveActionBtn
            variant={editorViewMode === 'list' ? 'vivid' : 'outline'}
            showLabelFrom="md"
            icon={<Smartphone size={16} />}
            label="Список"
            title="Пошаговый список блоков"
            onClick={() => onChangeViewMode('list')}
          />

          <ResponsiveActionBtn
            variant="outline"
            showLabelFrom="md"
            icon={<NeuralSphere size={18} glow={false} />}
            label="Иирка"
            title="Поручить Иирке доработать этот сценарий"
            onClick={onOpenIirkaEditor}
          />

          <ResponsiveActionBtn
            variant="outline"
            showLabelFrom="sm"
            icon={<Plus size={16} />}
            label="Блок"
            title="Добавить новый блок в сценарий"
            onClick={onOpenCatalog}
          />

          <ResponsiveActionBtn
            variant="outline"
            showLabelFrom="md"
            icon={
              isExecutingWorkflow ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )
            }
            label={`Запуск (${totalWorkflowCost})`}
            title={`Запустить весь сценарий (${totalWorkflowCost} Иирок)`}
            disabled={isExecutingWorkflow || Boolean(nameError)}
            onClick={onRunScenario}
          />

          <ResponsiveActionBtn
            variant="vivid"
            showLabelFrom="sm"
            icon={isSavingScenario ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            label="Сохранить"
            title="Сохранить изменения сценария в базу данных"
            disabled={isSavingScenario || Boolean(nameError)}
            onClick={onSaveScenario}
          />
        </div>
      </div>

      {nameError && (
        <div className="flex items-center gap-2 text-[14px] font-semibold text-rose-800 bg-rose-100/80 border border-rose-300 rounded-xl px-3.5 py-2">
          <AlertTriangle size={16} className="shrink-0 text-rose-600" />
          <span>{nameError}</span>
        </div>
      )}
    </div>
  );
};

export const ScenarioLiveTestBanner: React.FC<{
  testProgress: ScenarioTestProgressState | null;
  dbTestResults?: Record<string, ScenarioNodeTestRecord>;
  onOpenResultByNodeId?: (nodeId: string) => void;
}> = ({ testProgress, dbTestResults, onOpenResultByNodeId }) => {
  if (!testProgress || !testProgress.isRunning) return null;

  const pct = Math.min(100, Math.max(0, testProgress.percent));

  return (
    <div className="bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md border-2 border-pink-400 rounded-3xl p-4 shadow-md space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Loader2 size={18} className="animate-spin text-pink-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-[15px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 to-sky-700 bg-clip-text text-transparent">
              Выполнение цепочки в реальном времени
            </div>
            <div className="text-[14px] font-medium text-slate-800 break-words">
              {testProgress.statusText || `Активный этап: ${testProgress.activeNodeTitle}`}
            </div>
          </div>
        </div>

        <span className="text-[17px] font-bold text-pink-700 shrink-0">{pct}%</span>
      </div>

      <div className="w-full h-3 rounded-full bg-white/85 border border-pink-300 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 transition-all duration-300"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>

      {testProgress.steps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {testProgress.steps.map((st, idx) => {
            const running = st.status === 'running';
            const done = st.status === 'done';
            const livePreview = done
              ? summarizeStepLivePreview(dbTestResults?.[st.nodeId])
              : null;

            return (
              <div
                key={st.nodeId}
                className={`rounded-xl border px-3 py-2 flex flex-col gap-1.5 text-[14px] min-w-0 ${
                  running
                    ? 'bg-gradient-to-r from-sky-100/95 via-pink-100/95 to-orange-100/95 border-pink-500 ring-2 ring-pink-300 font-bold text-slate-900'
                    : done
                    ? 'bg-white/90 border-sky-300 text-slate-900 font-semibold'
                    : 'bg-white/60 border-pink-200 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {running ? (
                      <Loader2 size={14} className="animate-spin text-pink-600 shrink-0" />
                    ) : done ? (
                      <CheckCircle2 size={14} className="text-sky-600 shrink-0" />
                    ) : (
                      <Clock size={14} className="text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">
                      {idx + 1}. {st.nodeTitle}
                    </span>
                  </div>
                  <span className="text-pink-700 font-bold shrink-0">
                    {running ? `${st.stepPercent}%` : done ? '100%' : '0%'}
                  </span>
                </div>

                {done && livePreview && (
                  <div className="pt-1 border-t border-pink-200/80 flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {livePreview.imageUrl && (
                        <img
                          src={livePreview.imageUrl}
                          alt=""
                          className="w-7 h-7 rounded-md object-cover border border-pink-300 shrink-0"
                        />
                      )}
                      <span className="text-[14px] font-medium text-slate-800 truncate">
                        {livePreview.headline}
                      </span>
                    </div>
                    {onOpenResultByNodeId && (
                      <button
                        type="button"
                        onClick={() => onOpenResultByNodeId(st.nodeId)}
                        className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white text-[14px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Eye size={13} />
                        <span>Итог</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
