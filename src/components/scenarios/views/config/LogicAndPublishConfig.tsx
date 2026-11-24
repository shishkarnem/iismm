import React, { useState } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  FileEdit,
  AlertTriangle
} from 'lucide-react';
import {
  Channel,
  Scenario,
  WorkflowNode,
  ScenarioConditionRule,
  ScenarioPublishTimingMode
} from '../../../../types';
import { GradientSelect, GradientMultiSelect } from '../../../ui-kit/GradientDropdown';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../../../ui-kit/ResponsiveActionBtn';
import { AutoGrowVoiceTextarea } from '../../../ui-kit/AutoGrowVoiceTextarea';

interface LogicAndPublishConfigProps {
  selectedNode: WorkflowNode;
  currentScenario: Scenario;
  channels: Channel[];
  onUpdateConfig: (patch: Record<string, any>, immediateSave?: boolean) => void;
}

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Понедельник (Пн)' },
  { value: '2', label: 'Вторник (Вт)' },
  { value: '3', label: 'Среда (Ср)' },
  { value: '4', label: 'Четверг (Чт)' },
  { value: '5', label: 'Пятница (Пт)' },
  { value: '6', label: 'Суббота (Сб)' },
  { value: '7', label: 'Воскресенье (Вс)' }
];

const RULE_FIELD_OPTIONS: Array<{ value: ScenarioConditionRule['field']; label: string }> = [
  { value: 'has_media', label: 'Есть картинка или медиа-вложение' },
  { value: 'no_media', label: 'Медиа-вложение отсутствует' },
  { value: 'text_length_gte', label: 'Длина текста не менее N символов' },
  { value: 'text_length_lte', label: 'Длина текста не более N символов' },
  { value: 'contains_keyword', label: 'Текст содержит ключевое слово или фразу' },
  { value: 'not_contains_keyword', label: 'Текст не содержит стоп-слово' },
  { value: 'day_of_week_in', label: 'День запуска входит в выбранные дни недели' },
  { value: 'rich_parts_gte', label: 'Количество частей Rich не менее N' }
];

export const LogicAndPublishConfig: React.FC<LogicAndPublishConfigProps> = ({
  selectedNode,
  currentScenario,
  channels,
  onUpdateConfig
}) => {
  const cfg = selectedNode.config || {};
  const [customChannelInput, setCustomChannelInput] = useState('');

  /* ========================================================================= */
  /* 1. LOGIC FILTER (IF / ELSE BRANCHING WITH VERTICAL DROPDOWNS)             */
  /* ========================================================================= */
  if (selectedNode.type === 'logic_filter') {
    const logicMode: 'all' | 'any' = cfg.conditionLogic === 'any' ? 'any' : 'all';
    const rules: ScenarioConditionRule[] =
      Array.isArray(cfg.conditionRules) && cfg.conditionRules.length > 0
        ? cfg.conditionRules
        : [
            {
              id: 'rule_1',
              field: cfg.filterCondition === 'has_text' ? 'text_length_gte' : 'has_media',
              value: cfg.filterCondition === 'has_text' ? '100' : 'true'
            }
          ];

    const outgoingEdges = (currentScenario.edges || []).filter(
      (e) => e.sourceNodeId === selectedNode.id
    );
    const yesTargets = outgoingEdges
      .filter((e) => !e.branch || e.branch === 'yes' || e.branch === 'default')
      .map((e) => currentScenario.nodes?.find((n) => n.id === e.targetNodeId)?.title)
      .filter(Boolean);
    const noTargets = outgoingEdges
      .filter((e) => e.branch === 'no')
      .map((e) => currentScenario.nodes?.find((n) => n.id === e.targetNodeId)?.title)
      .filter(Boolean);

    const updateRule = (idx: number, patch: Partial<ScenarioConditionRule>) => {
      const next = rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      onUpdateConfig({ conditionRules: next, conditionLogic: logicMode }, true);
    };

    const addRule = () => {
      const next: ScenarioConditionRule[] = [
        ...rules,
        { id: `rule_${Date.now()}`, field: 'text_length_gte', value: '300' }
      ];
      onUpdateConfig({ conditionRules: next, conditionLogic: logicMode }, true);
    };

    const removeRule = (idx: number) => {
      if (rules.length <= 1) return;
      onUpdateConfig(
        { conditionRules: rules.filter((_, i) => i !== idx), conditionLogic: logicMode },
        true
      );
    };

    return (
      <div className="space-y-3.5 pt-1 text-[14px]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <GitBranch size={16} className="text-pink-600 shrink-0" />
            <span>При истинности идет по ветке «Да», иначе по ветке «Нет» без списания за неактивную ветку.</span>
          </div>
          <UnboxedMetaLine
            items={[
              `Ветка «Да»: ${yesTargets.length > 0 ? yesTargets.join(', ') : 'не подключена'}`,
              `Ветка «Нет»: ${noTargets.length > 0 ? noTargets.join(', ') : 'остановка'}`
            ]}
          />
        </div>

        <GradientSelect
          label="Логика объединения правил"
          value={logicMode}
          onChange={(val) =>
            onUpdateConfig({ conditionLogic: val as 'all' | 'any', conditionRules: rules }, true)
          }
          options={[
            { value: 'all', label: 'Выполнены все правила («И»)' },
            { value: 'any', label: 'Хотя бы одно правило («Или»)' }
          ]}
        />

        <div className="space-y-2.5">
          {rules.map((rule, idx) => {
            const needsInput =
              rule.field === 'text_length_gte' ||
              rule.field === 'text_length_lte' ||
              rule.field === 'contains_keyword' ||
              rule.field === 'not_contains_keyword' ||
              rule.field === 'rich_parts_gte';

            const selectedDays = String(rule.value || '1,2,3,4,5')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

            return (
              <div
                key={rule.id || idx}
                className="p-3 rounded-2xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 border border-pink-300 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">Правило #{idx + 1}</span>
                  {rules.length > 1 && (
                    <ResponsiveActionBtn
                      variant="danger"
                      showLabelFrom="never"
                      icon={<Trash2 size={14} />}
                      label="Удалить правило"
                      onClick={() => removeRule(idx)}
                    />
                  )}
                </div>

                <GradientSelect
                  value={rule.field}
                  onChange={(val) => {
                    const nextField = val as ScenarioConditionRule['field'];
                    const defaultVal =
                      nextField === 'text_length_gte'
                        ? '300'
                        : nextField === 'text_length_lte'
                        ? '4000'
                        : nextField === 'day_of_week_in'
                        ? '1,2,3,4,5'
                        : nextField === 'rich_parts_gte'
                        ? '2'
                        : '';
                    updateRule(idx, { field: nextField, value: defaultVal });
                  }}
                  options={RULE_FIELD_OPTIONS}
                />

                {needsInput &&
                  (rule.field === 'contains_keyword' || rule.field === 'not_contains_keyword' ? (
                    <AutoGrowVoiceTextarea
                      label={
                        rule.field === 'contains_keyword'
                          ? 'Ключевые слова или фразы (через запятую)'
                          : 'Стоп-слова (через запятую)'
                      }
                      value={rule.value || ''}
                      onChange={(val) => updateRule(idx, { value: val })}
                      minRows={2}
                      showClearButton
                      placeholder="Слова или фразы через запятую"
                    />
                  ) : (
                    <input
                      type="number"
                      value={rule.value || ''}
                      onChange={(e) => updateRule(idx, { value: e.target.value })}
                      placeholder="Введите число"
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 font-medium text-slate-900"
                    />
                  ))}

                {rule.field === 'day_of_week_in' && (
                  <GradientMultiSelect
                    label="Дни недели"
                    values={selectedDays}
                    onChange={(vals) =>
                      updateRule(idx, { value: vals.length > 0 ? vals.join(',') : '1' })
                    }
                    options={WEEKDAY_OPTIONS}
                    selectAllLabel="Вся неделя"
                  />
                )}
              </div>
            );
          })}

          <ResponsiveActionBtn
            variant="outline"
            icon={<Plus size={15} />}
            label="Добавить правило"
            onClick={addRule}
          />
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* 2. UNIFIED PUBLISH POST (DRAFTS + MULTI-CHANNEL + COMPACT DROPDOWN)       */
  /* ========================================================================= */
  if (
    selectedNode.type === 'publish_post' ||
    selectedNode.type === 'publish_telegram' ||
    selectedNode.type === 'save_draft'
  ) {
    const defaultCh = (channels[0] as any)?.channel_id || channels[0]?.username || '@SAV_AI';
    const selectedChs: string[] =
      Array.isArray(cfg.channels) && cfg.channels.length > 0
        ? cfg.channels
        : cfg.channelId
        ? [cfg.channelId]
        : [defaultCh];

    const timingMode: ScenarioPublishTimingMode =
      selectedNode.type === 'save_draft'
        ? cfg.publishTimingMode || 'draft_only'
        : cfg.publishTimingMode || 'immediate';

    const scheduleTrigger = (currentScenario.nodes || []).find(
      (n) => n.type === 'trigger_schedule' && n.enabled !== false
    );
    const startTimeStr = scheduleTrigger?.config?.cronTime || '10:00';
    const [startH, startM] = String(startTimeStr)
      .split(':')
      .map((v) => parseInt(v, 10) || 0);
    const startTotalMins = startH * 60 + startM;

    const delayHours = Math.min(72, Math.max(0, Number(cfg.delayHours ?? cfg.publishDelayHours ?? 2)));
    const delayMins = Math.min(59, Math.max(0, Number(cfg.delayMinutesAfterStart ?? cfg.publishDelayMinutes ?? 0)));
    const publishTimeOfDay = cfg.publishTimeOfDay || '14:00';
    const [pubH, pubM] = String(publishTimeOfDay)
      .split(':')
      .map((v) => parseInt(v, 10) || 0);
    const pubTotalMins = pubH * 60 + pubM;
    const isSameDayBeforeStart =
      timingMode === 'same_day_time' && Boolean(scheduleTrigger) && pubTotalMins < startTotalMins;

    const computedDelayClock = (() => {
      const total = (startTotalMins + delayHours * 60 + delayMins) % (24 * 60);
      const hh = String(Math.floor(total / 60)).padStart(2, '0');
      const mm = String(total % 60).padStart(2, '0');
      const extraDays = Math.floor((startTotalMins + delayHours * 60 + delayMins) / (24 * 60));
      return `${hh}:${mm}${extraDays > 0 ? ` (+${extraDays} дн.)` : ''}`;
    })();

    const knownChannelOptions = (channels || []).map((ch, idx) => {
      const chId = (ch as any).channel_id || (ch as any).id || ch.username || `ch-${idx}`;
      const titleText = (ch as any).title || ch.name || chId;
      return { value: String(chId), label: String(titleText), sublabel: String(chId) };
    });

    const extraChannelOptions = selectedChs
      .filter((id) => !knownChannelOptions.some((o) => o.value === id))
      .map((id) => ({ value: id, label: id }));

    const allChannelOptions = [...knownChannelOptions, ...extraChannelOptions];

    const addCustomChannel = () => {
      const clean = customChannelInput.trim();
      if (!clean) return;
      const formatted = clean.startsWith('@') || clean.startsWith('-') ? clean : `@${clean}`;
      if (!selectedChs.includes(formatted)) {
        const next = [...selectedChs, formatted];
        onUpdateConfig({ channels: next, channelId: next[0] }, true);
      }
      setCustomChannelInput('');
    };

    const timingOptions: Array<{
      value: ScenarioPublishTimingMode;
      label: string;
      sublabel: string;
    }> = [
      {
        value: 'delay_after_start',
        label: 'Через сколько часов и минут после старта (рекомендуется)',
        sublabel: 'Например, через 8 часов и 12 минут — пост сохранится в черновики и выйдет точно по задержке'
      },
      {
        value: 'same_day_time',
        label: 'В точное время того же дня',
        sublabel: `Старт в ${startTimeStr}, выход в ${publishTimeOfDay} того же дня`
      },
      {
        value: 'offset_days_time',
        label: 'Через выбранное число дней в точное время',
        sublabel: 'Подготовка контента заранее на завтра или несколько дней вперед'
      },
      {
        value: 'immediate',
        label: 'Опубликовать сразу после генерации',
        sublabel: 'Сохранить в черновики и мгновенно отправить в выбранные каналы'
      },
      {
        value: 'draft_only',
        label: 'Только сохранить в черновики',
        sublabel: 'Без автоотправки в Telegram — ручная публикация после проверки'
      }
    ];

    const timelineSummary =
      timingMode === 'draft_only'
        ? 'Только в черновики (вручную автором)'
        : timingMode === 'immediate'
        ? 'Выход сразу после генерации'
        : timingMode === 'delay_after_start'
        ? `Через ${delayHours} ч. ${delayMins} мин. (${computedDelayClock})`
        : timingMode === 'same_day_time'
        ? `Тот же день в ${publishTimeOfDay}`
        : `Через ${cfg.offsetDays || 1} дн. в ${publishTimeOfDay}`;

    return (
      <div className="space-y-3.5 pt-1 text-[14px]">
        <div className="flex items-start gap-2 text-slate-800">
          <FileEdit size={16} className="text-pink-600 shrink-0 mt-0.5" />
          <span>
            Сначала пост всегда сохраняется в черновики редактора, где его можно поправить до выхода в Telegram.
          </span>
        </div>

        <div className="space-y-2">
          <GradientMultiSelect
            label="Каналы для сохранения и публикации"
            values={selectedChs}
            onChange={(vals) => {
              const safe = vals.length > 0 ? vals : [defaultCh];
              onUpdateConfig({ channels: safe, channelId: safe[0] }, true);
            }}
            options={allChannelOptions}
            selectAllLabel="Все каналы"
            placeholder="Выберите каналы"
          />

          <div className="flex items-center gap-2 min-w-0">
            <input
              type="text"
              value={customChannelInput}
              onChange={(e) => setCustomChannelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomChannel();
                }
              }}
              placeholder="Добавить канал вручную (@канал или номер чата)"
              className="flex-1 min-w-0 bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 text-slate-900"
            />
            <ResponsiveActionBtn
              variant="outline"
              icon={<Plus size={16} />}
              label="Добавить"
              onClick={addCustomChannel}
            />
          </div>
        </div>

        <GradientSelect
          label="Режим времени выхода поста"
          value={timingMode}
          onChange={(val) =>
            onUpdateConfig({ publishTimingMode: val as ScenarioPublishTimingMode }, true)
          }
          options={timingOptions}
        />

        <div
          onClick={() =>
            onUpdateConfig(
              { publishToSocialFeed: cfg.publishToSocialFeed === false ? true : false },
              true
            )
          }
          role="switch"
          aria-checked={cfg.publishToSocialFeed !== false}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onUpdateConfig(
                { publishToSocialFeed: cfg.publishToSocialFeed === false ? true : false },
                true
              );
            }
          }}
          className="flex items-start gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 border border-pink-300/90 cursor-pointer select-none transition-all hover:border-pink-400"
        >
          <span
            className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-all ${
              cfg.publishToSocialFeed !== false
                ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 shadow-xs'
                : 'bg-white/90 border border-pink-300'
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full transition-transform shadow-xs ${
                cfg.publishToSocialFeed !== false
                  ? 'translate-x-5 bg-white'
                  : 'translate-x-0 bg-pink-300'
              }`}
            />
          </span>
          <span className="text-[14px] text-slate-900 font-medium leading-snug break-words min-w-0">
            Дублировать публикацию в открытую ленту блога платформы{' '}
            <a
              href="/posts"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                window.history.pushState(null, '', '/posts');
                window.dispatchEvent(new Event('popstate'));
              }}
              className="font-bold text-pink-700 hover:text-sky-700 underline underline-offset-2"
            >
              iismm.ru/posts
            </a>
          </span>
        </div>

        {timingMode === 'immediate' &&
          (currentScenario.nodes || []).some(
            (n) => n.type === 'logic_delay' && n.enabled !== false
          ) && (
            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 border border-pink-300 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(cfg.applyUpstreamDelay)}
                onChange={(e) => onUpdateConfig({ applyUpstreamDelay: e.target.checked }, true)}
                className="w-4 h-4 rounded border-pink-300 text-pink-600 cursor-pointer shrink-0"
              />
              <span className="font-semibold text-slate-900">
                Учитывать паузу из блока задержки выше
              </span>
            </label>
          )}

        {timingMode === 'delay_after_start' && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 border border-pink-300 space-y-2.5">
            <div className="font-bold text-slate-900">
              Задержка отправки после старта: часы и минуты
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Через сколько часов (0–72)</label>
                <input
                  type="number"
                  min={0}
                  max={72}
                  value={delayHours}
                  onChange={(e) => {
                    const nextHours = Math.min(72, Math.max(0, parseInt(e.target.value, 10) || 0));
                    onUpdateConfig({ delayHours: nextHours, publishDelayHours: nextHours }, true);
                  }}
                  className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 font-bold text-slate-900 text-[14px]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">И через сколько минут (0–59)</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={delayMins}
                  onChange={(e) => {
                    const nextMins = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0));
                    onUpdateConfig(
                      {
                        delayMinutesAfterStart: nextMins,
                        publishDelayMinutes: nextMins
                      },
                      true
                    );
                  }}
                  className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 font-bold text-slate-900 text-[14px]"
                />
              </div>
            </div>
            <div className="text-[14px] text-slate-800 font-medium">
              Запланированная отправка: через{' '}
              <span className="font-bold text-slate-900">
                {delayHours} ч. {delayMins} мин.
              </span>{' '}
              (ориентировочно в {computedDelayClock})
            </div>
          </div>
        )}

        {timingMode === 'same_day_time' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Время публикации (не раньше {startTimeStr})
                </label>
                <input
                  type="time"
                  value={publishTimeOfDay}
                  onChange={(e) => onUpdateConfig({ publishTimeOfDay: e.target.value }, true)}
                  className={`w-full bg-white/85 border rounded-xl px-3 py-2 font-bold text-slate-900 ${
                    isSameDayBeforeStart ? 'border-rose-400' : 'border-pink-300'
                  }`}
                />
              </div>
              <GradientSelect
                label="Если старт прошел позже часа выхода"
                value={cfg.sameDayFallback || 'plus_15m'}
                onChange={(val) => onUpdateConfig({ sameDayFallback: val }, true)}
                options={[
                  { value: 'plus_15m', label: 'Отложить на +15 минут' },
                  { value: 'next_day', label: 'Перенести на следующий день' }
                ]}
              />
            </div>

            {isSameDayBeforeStart && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-100/80 border border-rose-300 text-rose-900 font-semibold">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                <span>
                  Время выхода ({publishTimeOfDay}) раньше старта триггера ({startTimeStr}) — сработает резервное правило.
                </span>
              </div>
            )}
          </div>
        )}

        {timingMode === 'offset_days_time' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Через сколько дней (1–30)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={Math.max(1, Number(cfg.offsetDays || 1))}
                onChange={(e) =>
                  onUpdateConfig(
                    { offsetDays: Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)) },
                    true
                  )
                }
                className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Точное время выхода</label>
              <input
                type="time"
                value={publishTimeOfDay}
                onChange={(e) => onUpdateConfig({ publishTimeOfDay: e.target.value }, true)}
                className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 font-bold text-slate-900"
              />
            </div>
          </div>
        )}

        <div className="pt-1 border-t border-pink-300/60">
          <UnboxedMetaLine
            items={[
              scheduleTrigger ? `Старт: ${startTimeStr}` : 'Ручной старт',
              `Каналов: ${selectedChs.length}`,
              timelineSummary
            ]}
          />
        </div>
      </div>
    );
  }

  return null;
};
