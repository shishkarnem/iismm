import React, { useState } from 'react';
import {
  CalendarClock,
  Clock,
  Globe,
  Loader2,
  Plus,
  Sparkles,
  Trash2
} from 'lucide-react';
import { CollapsibleSection } from '../../ui-kit/CollapsibleSection';
import { GradientMultiSelect, GradientSelect } from '../../ui-kit/GradientDropdown';
import { ResponsiveActionBtn } from '../../ui-kit/ResponsiveActionBtn';
import { AutoGrowVoiceTextarea } from '../../ui-kit/AutoGrowVoiceTextarea';
import {
  MONTH_DAYS_OPTIONS,
  SCENARIO_SCHEDULE_TYPE_OPTIONS,
  SCENARIO_TIMEZONE_OPTIONS,
  ScenarioScheduleRule,
  ScenarioScheduleRuleType,
  WEEKDAY_MULTI_OPTIONS,
  buildLegacySyncFields,
  formatRuleShortLabel,
  getTodayIsoDateInMsk,
  normalizeFrontendSchedules
} from './scheduleTypes';
import { usePricingConfig } from '../../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../../shared/pricingConfig';

interface TriggerScheduleConfigProps {
  config: Record<string, any>;
  activeUserId: string;
  userBalance?: number;
  onUpdateConfig: (patch: Record<string, any>, immediateSave?: boolean) => void;
}

export const TriggerScheduleConfig: React.FC<TriggerScheduleConfigProps> = ({
  config,
  activeUserId,
  userBalance,
  onUpdateConfig
}) => {
  const { pricing } = usePricingConfig(activeUserId);
  const scheduleAiCostLabel = formatIirkyCount(pricing.textAi.scheduleAiFill);
  const { timezone, schedules } = normalizeFrontendSchedules(config);
  const [aiWishText, setAiWishText] = useState<string>(String(config.aiScheduleWish || ''));
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const commitSchedulesAndTz = (
    nextSchedules: ScenarioScheduleRule[],
    nextTimezone = timezone,
    extraPatch: Record<string, any> = {}
  ) => {
    const legacyFields = buildLegacySyncFields(nextSchedules);
    onUpdateConfig(
      {
        timezone: nextTimezone,
        schedules: nextSchedules,
        ...legacyFields,
        ...extraPatch
      },
      true
    );
  };

  const handleUpdateRule = (index: number, patch: Partial<ScenarioScheduleRule>) => {
    const next = schedules.map((item, idx) => {
      if (idx !== index) return item;
      const merged: ScenarioScheduleRule = {
        ...item,
        ...patch,
        // Clear completedAt if user edits date/time/type of a once rule so it runs again!
        ...(patch.exactDate !== undefined || patch.time !== undefined || patch.type !== undefined
          ? { completedAt: null }
          : {})
      };
      return merged;
    });
    commitSchedulesAndTz(next);
  };

  const handleAddRule = () => {
    const todayIso = getTodayIsoDateInMsk();
    const newRule: ScenarioScheduleRule = {
      id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      enabled: true,
      type: schedules.length === 1 && schedules[0].type === 'daily' ? 'monthly' : 'daily',
      time: '18:00',
      exactDate: todayIso,
      daysOfWeek: [2, 4],
      daysOfMonth: [15],
      intervalHours: 4,
      intervalMinutes: 30,
      completedAt: null
    };
    commitSchedulesAndTz([...schedules, newRule]);
  };

  const handleDeleteRule = (index: number) => {
    if (schedules.length <= 1) return;
    commitSchedulesAndTz(schedules.filter((_, idx) => idx !== index));
  };

  const handleAiFillSchedule = async () => {
    const trimmed = aiWishText.trim();
    if (!trimmed) {
      setAiNotice({
        type: 'err',
        text: 'Опишите словами или надиктуйте голосом желаемое расписание запусков.'
      });
      return;
    }

    setIsAiParsing(true);
    setAiNotice(null);
    try {
      const res = await fetch('/api/scenarios/ai-parse-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          prompt: trimmed,
          currentTimezone: timezone
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось заполнить расписание через ИИ');
      }

      if (typeof data.balance === 'number') {
        window.dispatchEvent(
          new CustomEvent('iismm-balance-updated', { detail: { balance: data.balance } })
        );
      }

      if (Array.isArray(data.schedules) && data.schedules.length > 0) {
        commitSchedulesAndTz(data.schedules, data.timezone || timezone, {
          aiScheduleWish: trimmed
        });
        setAiNotice({
          type: 'ok',
          text: `Настроено запусков: ${data.schedules.length} (${data.summary || 'сохранено автоматически'}). Списано: ${formatIirkyCount(data.cost ?? pricing.textAi.scheduleAiFill)}.`
        });
      }
    } catch (err: any) {
      setAiNotice({
        type: 'err',
        text: err?.message || 'Ошибка ИИ-заполнения расписания'
      });
    } finally {
      setIsAiParsing(false);
    }
  };

  return (
    <div className="space-y-4 pt-1 text-[14px] min-w-0">
      {/* 1. Timezone Selection (+3 MSK by default) */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 border border-pink-300 space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-bold text-slate-900 flex items-center gap-2">
            <Globe size={16} className="text-pink-600 shrink-0" />
            <span>Часовой пояс всех запусков сценария</span>
          </span>
          <span className="text-[14px] font-semibold text-pink-700">По умолчанию +3 мск</span>
        </div>

        <GradientSelect
          value={timezone}
          onChange={(nextTz) => commitSchedulesAndTz(schedules, nextTz)}
          options={SCENARIO_TIMEZONE_OPTIONS}
          searchable
        />
      </div>

      {/* 2. AI Schedule Fill with Voice Input & Auto-Grow 2-row Textarea */}
      <CollapsibleSection
        title="ИИ-заполнение расписания по описанию"
        summary={`Настроит один или несколько запусков и часовой пояс · ${scheduleAiCostLabel}${
          typeof userBalance === 'number' ? ` (баланс: ${userBalance})` : ''
        }`}
        icon={<Sparkles size={16} />}
        defaultOpen={false}
      >
        <div className="space-y-3 min-w-0">
          <AutoGrowVoiceTextarea
            label="Опишите когда и как часто запускать сценарий (можно несколько режимов сразу)"
            value={aiWishText}
            onChange={(val) => {
              setAiWishText(val);
              onUpdateConfig({ aiScheduleWish: val }, false);
            }}
            onBlur={() => onUpdateConfig({ aiScheduleWish: aiWishText }, true)}
            minRows={2}
            showClearButton
            placeholder="Например: каждый понедельник и четверг в 10:30, раз в месяц 15 числа в 18:00 и один раз завтра в 14:00 по мск"
          />

          <ResponsiveActionBtn
            variant="vivid"
            showLabelFrom="always"
            icon={
              isAiParsing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )
            }
            label={
              isAiParsing
                ? 'Распознаем расписание...'
                : `Заполнить расписание через ИИ (${scheduleAiCostLabel})`
            }
            disabled={isAiParsing}
            onClick={handleAiFillSchedule}
            className="w-full"
          />

          {aiNotice && (
            <div
              className={`p-3 rounded-xl border font-medium break-words ${
                aiNotice.type === 'ok'
                  ? 'bg-sky-100/80 border-sky-300 text-slate-900'
                  : 'bg-rose-100/80 border-rose-300 text-rose-900'
              }`}
            >
              {aiNotice.text}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 3. Multi-Launch Rules List */}
      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-bold text-[15px] bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent flex items-center gap-2">
            <CalendarClock size={17} className="text-pink-600 shrink-0" />
            <span>Настроенные запуски ({schedules.length})</span>
          </span>

          <ResponsiveActionBtn
            variant="vivid"
            showLabelFrom="always"
            icon={<Plus size={15} />}
            label="Добавить запуск"
            title="Добавить еще одно правило запуска другого типа в это же окно"
            onClick={handleAddRule}
          />
        </div>

        <div className="space-y-3 min-w-0">
          {schedules.map((rule, idx) => {
            const selectedDows = (
              rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [1, 3, 5]
            ).map(String);
            const selectedDoms = (
              rule.daysOfMonth && rule.daysOfMonth.length > 0 ? rule.daysOfMonth : [1]
            ).map(String);

            return (
              <div
                key={rule.id || idx}
                className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xs min-w-0"
              >
                <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-3.5 space-y-3 min-w-0">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-0">
                      <input
                        type="checkbox"
                        checked={rule.enabled !== false}
                        onChange={(e) => handleUpdateRule(idx, { enabled: e.target.checked })}
                        className="w-4 h-4 accent-pink-600 rounded cursor-pointer shrink-0"
                      />
                      <span className="font-bold text-slate-900 break-words">
                        Запуск #{idx + 1} · {formatRuleShortLabel(rule)}
                      </span>
                    </label>

                    {schedules.length > 1 && (
                      <ResponsiveActionBtn
                        variant="danger"
                        showLabelFrom="sm"
                        icon={<Trash2 size={14} />}
                        label="Удалить"
                        title="Удалить этот запуск"
                        onClick={() => handleDeleteRule(idx)}
                      />
                    )}
                  </div>

                  {/* Periodicity Type Selector */}
                  <GradientSelect
                    label="Периодичность запуска"
                    value={rule.type}
                    onChange={(val) =>
                      handleUpdateRule(idx, {
                        type: val as ScenarioScheduleRuleType,
                        ...(val === 'once' && !rule.exactDate
                          ? { exactDate: getTodayIsoDateInMsk() }
                          : {})
                      })
                    }
                    options={SCENARIO_SCHEDULE_TYPE_OPTIONS}
                  />

                  {/* Contextual Fields Per Periodicity */}
                  {rule.type === 'once' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                      <div className="min-w-0">
                        <label className="block text-[14px] font-bold text-slate-900 mb-1">
                          Дата единоразового запуска
                        </label>
                        <input
                          type="date"
                          value={rule.exactDate || getTodayIsoDateInMsk()}
                          onChange={(e) => handleUpdateRule(idx, { exactDate: e.target.value })}
                          className="w-full min-h-[42px] bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="block text-[14px] font-bold text-slate-900 mb-1">
                          Время запуска
                        </label>
                        <input
                          type="time"
                          value={rule.time || '10:00'}
                          onChange={(e) => handleUpdateRule(idx, { time: e.target.value })}
                          className="w-full min-h-[42px] bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                        />
                      </div>
                    </div>
                  )}

                  {rule.type === 'daily' && (
                    <div className="min-w-0 sm:max-w-xs">
                      <label className="block text-[14px] font-bold text-slate-900 mb-1">
                        Время ежедневного запуска
                      </label>
                      <input
                        type="time"
                        value={rule.time || '10:00'}
                        onChange={(e) => handleUpdateRule(idx, { time: e.target.value })}
                        className="w-full min-h-[42px] bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                      />
                    </div>
                  )}

                  {rule.type === 'weekly' && (
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3 min-w-0">
                      <GradientMultiSelect
                        label="Дни недели для запуска"
                        values={selectedDows}
                        onChange={(vals) => {
                          const nums = vals
                            .map(Number)
                            .filter((n) => n >= 1 && n <= 7)
                            .sort((a, b) => a - b);
                          handleUpdateRule(idx, { daysOfWeek: nums.length > 0 ? nums : [1] });
                        }}
                        options={WEEKDAY_MULTI_OPTIONS}
                        selectAllLabel="Все дни недели"
                      />

                      <div className="min-w-0">
                        <label className="block text-[14px] font-bold text-slate-900 mb-1.5">
                          Время запуска
                        </label>
                        <input
                          type="time"
                          value={rule.time || '10:00'}
                          onChange={(e) => handleUpdateRule(idx, { time: e.target.value })}
                          className="w-full min-h-[42px] bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                        />
                      </div>
                    </div>
                  )}

                  {rule.type === 'monthly' && (
                    <div className="space-y-2 min-w-0">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3 min-w-0">
                        <GradientMultiSelect
                          label="Числа месяца (1–31)"
                          values={selectedDoms}
                          onChange={(vals) => {
                            const nums = vals
                              .map(Number)
                              .filter((n) => n >= 1 && n <= 31)
                              .sort((a, b) => a - b);
                            handleUpdateRule(idx, { daysOfMonth: nums.length > 0 ? nums : [1] });
                          }}
                          options={MONTH_DAYS_OPTIONS}
                          placeholder="Выберите дату (число месяца)"
                        />

                        <div className="min-w-0">
                          <label className="block text-[14px] font-bold text-slate-900 mb-1.5">
                            Время запуска
                          </label>
                          <input
                            type="time"
                            value={rule.time || '10:00'}
                            onChange={(e) => handleUpdateRule(idx, { time: e.target.value })}
                            className="w-full min-h-[42px] bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                          />
                        </div>
                      </div>
                      <p className="text-[14px] text-slate-700 leading-snug">
                        Если в коротком месяце нет 30 или 31 числа, запуск автоматически сработает в последний день месяца.
                      </p>
                    </div>
                  )}

                  {rule.type === 'interval_hours' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0 items-end">
                      <GradientSelect
                        label="Быстрый выбор интервала в часах"
                        value={String(rule.intervalHours || 2)}
                        onChange={(val) =>
                          handleUpdateRule(idx, { intervalHours: Math.max(1, Number(val) || 2) })
                        }
                        options={[1, 2, 3, 4, 6, 8, 12, 24].map((h) => ({
                          value: String(h),
                          label: `Каждые ${h} ч.`
                        }))}
                      />

                      <div className="min-w-0">
                        <label className="block text-[14px] font-bold text-slate-900 mb-1">
                          Или свое число часов (1–72)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={72}
                          value={rule.intervalHours || 2}
                          onChange={(e) =>
                            handleUpdateRule(idx, {
                              intervalHours: Math.min(
                                72,
                                Math.max(1, parseInt(e.target.value, 10) || 1)
                              )
                            })
                          }
                          className="w-full min-h-[42px] bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {rule.type === 'interval_minutes' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0 items-end">
                      <GradientSelect
                        label="Быстрый выбор интервала в минутах"
                        value={String(rule.intervalMinutes || 30)}
                        onChange={(val) =>
                          handleUpdateRule(idx, {
                            intervalMinutes: Math.max(5, Number(val) || 30)
                          })
                        }
                        options={[10, 15, 20, 30, 45, 60, 90, 120].map((m) => ({
                          value: String(m),
                          label: `Каждые ${m} мин.`
                        }))}
                      />

                      <div className="min-w-0">
                        <label className="block text-[14px] font-bold text-slate-900 mb-1">
                          Или свое число минут (5–720)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={720}
                          value={rule.intervalMinutes || 30}
                          onChange={(e) =>
                            handleUpdateRule(idx, {
                              intervalMinutes: Math.min(
                                720,
                                Math.max(5, parseInt(e.target.value, 10) || 15)
                              )
                            })
                          }
                          className="w-full min-h-[42px] bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Night Pause (Sleep Mode) */}
      <CollapsibleSection
        title="Тихий ночной режим"
        summary={
          config.sleepMode
            ? `Пауза с ${config.sleepStartTime || '23:00'} до ${config.sleepEndTime || '08:00'}`
            : 'Отключен (запуск по настроенным слотам без ночной паузы)'
        }
        icon={<Clock size={16} />}
        defaultOpen={Boolean(config.sleepMode)}
      >
        <label className="flex items-center gap-2.5 font-semibold text-slate-900 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(config.sleepMode)}
            onChange={(e) => onUpdateConfig({ sleepMode: e.target.checked }, true)}
            className="w-4 h-4 rounded border-pink-300 text-pink-600 cursor-pointer shrink-0"
          />
          <span>Не запускать сценарий в ночные часы</span>
        </label>

        {config.sleepMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Начало паузы</label>
              <input
                type="time"
                value={config.sleepStartTime || '23:00'}
                onChange={(e) => onUpdateConfig({ sleepStartTime: e.target.value }, true)}
                className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Окончание паузы</label>
              <input
                type="time"
                value={config.sleepEndTime || '08:00'}
                onChange={(e) => onUpdateConfig({ sleepEndTime: e.target.value }, true)}
                className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 font-bold text-slate-900"
              />
            </div>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
};
