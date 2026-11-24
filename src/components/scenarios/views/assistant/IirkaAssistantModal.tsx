import React from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  Layers,
  Plus,
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react';
import { Channel, Scenario } from '../../../../types';
import { AudioField } from '../../../AudioField';
import { NeuralSphere } from '../../../NeuralSphere';
import { IirkaNeuralOverlay } from './IirkaNeuralOverlay';
import { IirkaResultPreview } from './IirkaResultPreview';
import { usePricingConfig } from '../../../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../../../shared/pricingConfig';

interface IirkaAssistantModalProps {
  assistant: ReturnType<typeof import('./useIirkaAssistant').useIirkaAssistant>;
  scenarios: Scenario[];
  currentScenario: Scenario | null;
  channels: Channel[];
}

const CREATE_STARTER_PROMPTS = [
  'Ежедневно в 10:00 создавай быструю тему про нейросети, пиши пост v2 с картинкой и двумя инлайн-кнопками, выход через 2 часа после старта',
  'Собери Rich-сценарий на 3 смысловые части про технологии с иллюстрацией к каждой главе и сохраняй в черновики',
  'По будням в 12:30 анализируй историю за 30 дней, пиши экспертный пост с подписью и отправляй уведомление автору'
];

const EDIT_STARTER_PROMPTS = [
  'Перенеси время запуска расписания на 14:30 и добавь автогенерацию двух инлайн-кнопок по тексту поста',
  'Добавь перед публикацией логическое условие проверки текста и в конце уведомление автору',
  'Переключи блок публикации в режим сохранения только в черновики без мгновенной отправки в канал'
];

export const IirkaAssistantModal: React.FC<IirkaAssistantModalProps> = ({
  assistant,
  scenarios,
  currentScenario,
  channels
}) => {
  const { pricing } = usePricingConfig();
  const assistantCostLabel = formatIirkyCount(pricing.scenarioAi.assistantBuildOrEdit);
  const {
    isOpen,
    liveBalance,
    mode,
    setMode: onChangeMode,
    selectedEditId,
    setSelectedEditId: onSelectEditId,
    preferredFormat,
    setPreferredFormat: onChangePreferredFormat,
    selectedChannels,
    setSelectedChannels: onChangeSelectedChannels,
    taskText,
    setTaskText: onChangeTaskText,
    audioUrl,
    setAudioUrl: onChangeAudioUrl,
    isWorking,
    stageProgress,
    previewResult,
    setPreviewResult,
    refinementText,
    setRefinementText: onChangeRefinementText,
    refinementAudioUrl,
    setRefinementAudioUrl: onChangeRefinementAudioUrl,
    errorText,
    isCommitting,
    closeAssistant: onClose,
    runIirkaTask,
    commitResultAndSaveToDb: onCommitAndSave,
    applyDraftToCanvasOnly: onApplyToCanvasOnly
  } = assistant;

  const onClearPreviewResult = () => setPreviewResult(null);
  const onSubmitTask = () => runIirkaTask(false);
  const onSubmitRefinement = () => runIirkaTask(true);

  if (!isOpen) return null;

  const editableScenarios: Scenario[] = (() => {
    const map = new Map<string, Scenario>();
    if (currentScenario) map.set(currentScenario.id, currentScenario);
    scenarios.forEach((s) => {
      if (!map.has(s.id)) map.set(s.id, s);
    });
    return Array.from(map.values());
  })();

  const toggleChannel = (chId: string) => {
    if (selectedChannels.includes(chId)) {
      if (selectedChannels.length > 1) {
        onChangeSelectedChannels(selectedChannels.filter((c) => c !== chId));
      }
    } else {
      onChangeSelectedChannels([...selectedChannels, chId]);
    }
  };

  const quickPrompts = mode === 'edit' ? EDIT_STARTER_PROMPTS : CREATE_STARTER_PROMPTS;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-[2vw] py-3 sm:py-5 bg-sky-100/35 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[940px] max-h-[92dvh] p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="relative bg-gradient-to-r from-sky-50/92 via-pink-50/92 via-orange-50/92 via-pink-50/92 to-sky-50/92 backdrop-blur-md rounded-[22px] flex flex-col max-h-[calc(92dvh-4px)] overflow-hidden text-[14px]">
          {/* Neural Sphere Waiting & Working Overlay */}
          <IirkaNeuralOverlay
            isVisible={isWorking}
            mode={mode}
            stageProgress={stageProgress}
          />

          {/* Modal Header */}
          <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3.5 border-b border-pink-200/90 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                <NeuralSphere size={42} glow={true} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[17px] md:text-[19px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 to-pink-600 bg-clip-text text-transparent truncate">
                  Помощник Иирка: сборка и настройка сценариев
                </h3>
                <span className="text-[14px] font-medium text-slate-700 block break-words">
                  Создание и редактирование сценария голосом или текстом · Стоимость:{' '}
                  <strong className="text-pink-700">{assistantCostLabel}</strong>
                  {typeof liveBalance === 'number' && liveBalance > 0 ? (
                    <span className="text-slate-600"> (баланс: {liveBalance} Иирок)</span>
                  ) : null}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isWorking}
              className="p-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-200 text-slate-700 hover:text-slate-900 cursor-pointer shrink-0 disabled:opacity-50"
              title="Закрыть окно Иирки"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 min-h-0">
            {errorText && (
              <div className="bg-gradient-to-r from-sky-50/88 via-pink-50/88 via-orange-50/88 via-pink-50/88 to-sky-50/88 border border-rose-300 rounded-2xl p-3.5 flex items-start gap-2.5 text-rose-800 font-semibold text-[14px]">
                <AlertTriangle size={17} className="text-rose-600 shrink-0 mt-0.5" />
                <span className="break-words">{errorText}</span>
              </div>
            )}

            {previewResult ? (
              <IirkaResultPreview
                result={previewResult}
                refinementText={refinementText}
                refinementAudioUrl={refinementAudioUrl}
                isWorking={isWorking}
                isCommitting={isCommitting}
                onRefinementTextChange={onChangeRefinementText}
                onRefinementAudioChange={onChangeRefinementAudioUrl}
                onRunRefinement={onSubmitRefinement}
                onBackToForm={onClearPreviewResult}
                onApplyToCanvasOnly={onApplyToCanvasOnly}
                onCommitAndSave={onCommitAndSave}
              />
            ) : (
              <>
                {/* 1. Mode Switcher (Create vs Edit — responsive vertical on mobile, 2 cols on sm+) */}
                <div className="space-y-2">
                  <label className="text-[14px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 to-pink-600 bg-clip-text text-transparent block">
                    1. Выберите режим работы Иирки:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onChangeMode('create')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1 ${
                        mode === 'create'
                          ? 'bg-gradient-to-r from-sky-100/92 via-pink-100/92 via-orange-100/92 via-pink-100/92 to-sky-100/92 border-pink-500 ring-2 ring-pink-300 shadow-xs'
                          : 'bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border-pink-200 hover:border-pink-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[15px] text-slate-900 flex items-center gap-2">
                          <Plus size={16} className="text-sky-600 shrink-0" />
                          <span>Создать новый сценарий</span>
                        </span>
                        <span className="text-[14px] font-bold text-pink-700 shrink-0 flex items-center gap-1">
                          <span>{assistantCostLabel}</span>
                          {mode === 'create' && <Check size={16} className="text-pink-600 shrink-0" />}
                        </span>
                      </div>
                      <p className="text-[14px] text-slate-700 leading-snug break-words">
                        Иирка с нуля соберет цепочку блоков, связей, промптов и расписания по вашей задаче.
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={editableScenarios.length === 0}
                      onClick={() => {
                        if (editableScenarios.length === 0) return;
                        onChangeMode('edit');
                        if (!selectedEditId && editableScenarios[0]) {
                          onSelectEditId(editableScenarios[0].id);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1 disabled:opacity-50 ${
                        mode === 'edit'
                          ? 'bg-gradient-to-r from-sky-100/92 via-pink-100/92 via-orange-100/92 via-pink-100/92 to-sky-100/92 border-pink-500 ring-2 ring-pink-300 shadow-xs'
                          : 'bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border-pink-200 hover:border-pink-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[15px] text-slate-900 flex items-center gap-2">
                          <Edit3 size={16} className="text-pink-600 shrink-0" />
                          <span>Отредактировать сценарий</span>
                        </span>
                        <span className="text-[14px] font-bold text-pink-700 shrink-0 flex items-center gap-1">
                          <span>{assistantCostLabel}</span>
                          {mode === 'edit' && <Check size={16} className="text-pink-600 shrink-0" />}
                        </span>
                      </div>
                      <p className="text-[14px] text-slate-700 leading-snug break-words">
                        {editableScenarios.length > 0
                          ? 'Иирка аккуратно изменит текущий или выбранный сценарий: добавит, удалит или перенастроит шаги.'
                          : 'Сначала создайте хотя бы один сценарий, чтобы редактировать его.'}
                      </p>
                    </button>
                  </div>
                </div>

                {/* 2. Scenario Picker (Edit mode) OR Format Picker (Create mode) */}
                {mode === 'edit' ? (
                  <div className="bg-gradient-to-r from-sky-50/82 via-pink-50/82 via-orange-50/82 via-pink-50/82 to-sky-50/82 border border-pink-200 rounded-2xl p-3.5 space-y-2">
                    <label
                      htmlFor="iirka-edit-scenario-select"
                      className="text-[14px] font-bold text-slate-900 block"
                    >
                      2. Какой сценарий редактируем:
                    </label>
                    <select
                      id="iirka-edit-scenario-select"
                      value={selectedEditId || editableScenarios[0]?.id || ''}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        onSelectEditId(nextId);
                        const found = editableScenarios.find((s) => s.id === nextId);
                        if (found) {
                          onChangePreferredFormat(found.messageFormat === 'rich' ? 'rich' : 'v2');
                          if (Array.isArray(found.targetChannels) && found.targetChannels.length > 0) {
                            onChangeSelectedChannels(found.targetChannels);
                          }
                        }
                      }}
                      className="w-full bg-white/95 border-2 border-pink-300 rounded-2xl px-3.5 py-2.5 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400 cursor-pointer"
                    >
                      {editableScenarios.map((sc) => {
                        const isCurrent = currentScenario?.id === sc.id;
                        const fmtLbl = sc.messageFormat === 'rich' ? 'Rich' : 'v2';
                        const cnt = sc.nodes?.length || sc.steps?.length || 0;
                        return (
                          <option key={sc.id} value={sc.id}>
                            {isCurrent ? `[Открыт сейчас] ` : ''}
                            {sc.name} ({fmtLbl}, {cnt} шаг.)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-sky-50/82 via-pink-50/82 via-orange-50/82 via-pink-50/82 to-sky-50/82 border border-pink-200 rounded-2xl p-3.5 space-y-2">
                    <label className="text-[14px] font-bold text-slate-900 block">
                      2. Формат конструктора для нового сценария:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'auto', title: 'Автовыбор Иирки', desc: 'Подберет по смыслу задачи' },
                          { id: 'v2', title: 'Формат v2', desc: 'Посты до 4 096 симв. и медиа' },
                          { id: 'rich', title: 'Формат Rich', desc: 'Статьи по частям и слайдеры' }
                        ] as const
                      ).map((opt) => {
                        const active = preferredFormat === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onChangePreferredFormat(opt.id)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                              active
                                ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-transparent shadow-xs'
                                : 'bg-white/85 border-pink-200 text-slate-800 hover:bg-white'
                            }`}
                          >
                            <div className="font-bold text-[14px] flex items-center justify-between gap-1">
                              <span>{opt.title}</span>
                              {active && <Layers size={14} className="shrink-0" />}
                            </div>
                            <div
                              className={`text-[14px] leading-snug ${
                                active ? 'text-white/95' : 'text-slate-600'
                              }`}
                            >
                              {opt.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Target Channels */}
                <div className="bg-gradient-to-r from-sky-50/82 via-pink-50/82 via-orange-50/82 via-pink-50/82 to-sky-50/82 border border-pink-200 rounded-2xl p-3.5 space-y-2">
                  <label className="text-[14px] font-bold text-slate-900 block">
                    3. Целевые каналы (можно выбрать кнопками или назвать голосом):
                  </label>
                  {channels && channels.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {channels.map((ch, idx) => {
                        const chId =
                          (ch as any).channel_id || (ch as any).id || ch.username || `ch-${idx}`;
                        const labelText = (ch as any).title || ch.name || chId;
                        const isSel = selectedChannels.includes(chId);
                        return (
                          <button
                            key={`${chId}-${idx}`}
                            type="button"
                            onClick={() => toggleChannel(chId)}
                            className={`px-3 py-1.5 rounded-xl border text-[14px] font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                              isSel
                                ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-transparent shadow-2xs'
                                : 'bg-white/90 border-pink-200 text-slate-800 hover:bg-white'
                            }`}
                          >
                            {isSel && <Check size={14} className="shrink-0" />}
                            <span className="break-words">{labelText}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[14px] text-slate-700">
                      Канал по умолчанию: <strong>@SAV_AI</strong>
                    </div>
                  )}
                </div>

                {/* 4. Voice & Text Input via AudioField */}
                <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 rounded-2xl p-4 space-y-3">
                  <AudioField
                    id="iirka-main-task-field"
                    label="4. Поручите задачу Иирке (голосом через микрофон или текстом):"
                    value={taskText}
                    onChange={onChangeTaskText}
                    audioUrl={audioUrl}
                    onAudioChange={onChangeAudioUrl}
                    voiceFriendName="Иирка"
                    titleVoice="Записать голосовое поручение для Иирки"
                    rows={3}
                    placeholder={
                      mode === 'edit'
                        ? 'Скажите голосом или напишите, что поменять в сценарии: расписание, новые блоки, кнопки, промпт или режим выхода...'
                        : 'Скажите голосом или напишите, какой сценарий создать: рубрику, расписание, нужные шаги, картинки, кнопки и канал...'
                    }
                    autoFocus={true}
                  />

                  <div className="space-y-1.5">
                    <span className="text-[14px] font-semibold text-slate-700 block">
                      Быстрые примеры поручений (нажмите, чтобы подставить и дополнить):
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {quickPrompts.map((sample, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onChangeTaskText(sample)}
                          className="p-[1px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-400 via-orange-400 via-pink-400 to-sky-400 text-left cursor-pointer transition-all hover:opacity-95"
                        >
                          <span className="block px-3 py-2 rounded-[11px] bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 text-[14px] text-slate-800 leading-snug break-words">
                            {sample}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Modal Footer (when on main form) */}
          {!previewResult && (
            <div className="px-4 md:px-6 py-3.5 border-t border-pink-200/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0 bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80">
              <button
                type="button"
                onClick={onClose}
                disabled={isWorking}
                className="px-4 py-2.5 rounded-xl bg-white/90 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold cursor-pointer"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={onSubmitTask}
                disabled={!taskText.trim() || isWorking}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-md hover:opacity-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles size={16} className="shrink-0" />
                <span>
                  {mode === 'edit'
                    ? `Поручить Иирке обновить сценарий · ${assistantCostLabel}`
                    : `Поручить Иирке собрать сценарий · ${assistantCostLabel}`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const IirkaUndoBanner: React.FC<{
  undoScenarioName: string | null;
  onRollback: () => void;
  onDismiss: () => void;
}> = ({ undoScenarioName, onRollback, onDismiss }) => {
  if (!undoScenarioName) return null;

  return (
    <div className="bg-gradient-to-r from-sky-50/88 via-pink-50/88 via-orange-50/88 via-pink-50/88 to-sky-50/88 backdrop-blur-md border border-pink-300 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[14px] shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <NeuralSphere size={30} glow={false} />
        <span className="font-medium text-slate-800 break-words">
          Применены изменения от помощника Иирки для сценария <strong>«{undoScenarioName}»</strong>.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onRollback}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <RotateCcw size={14} />
          <span>Вернуть как было</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-xl bg-white/85 border border-pink-200 text-slate-600 hover:text-slate-900 cursor-pointer"
          title="Скрыть подсказку"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
