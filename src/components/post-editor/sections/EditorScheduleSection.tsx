import React from 'react';
import { AlertTriangle, CalendarClock, Moon } from 'lucide-react';
import { ScheduleFrequency } from '../../../types';
import { CollapsibleSection } from '../../ui-kit/CollapsibleSection';
import { GradientMultiSelect, GradientSelect } from '../../ui-kit/GradientDropdown';
import {
  formatCollapsedExactDateTime,
  getCurrentLocalMinDateTime,
  getDefaultLocalPlusOneHour,
  isPastLocalDateTime,
  normalizeToLocalDateTimeInput
} from '../../../utils/schedule/localDateTime';

interface EditorScheduleSectionProps {
  triggerEnabled: boolean;
  onChangeTriggerEnabled: (val: boolean) => void;
  frequency: ScheduleFrequency;
  onChangeFrequency: (val: ScheduleFrequency) => void;
  intervalMinutes: number;
  onChangeIntervalMinutes: (val: number) => void;
  intervalHours: number;
  onChangeIntervalHours: (val: number) => void;
  triggerTime: string;
  onChangeTriggerTime: (val: string) => void;
  exactDateTime: string;
  onChangeExactDateTime: (val: string) => void;
  selectedDaysOfWeek: number[];
  onChangeSelectedDaysOfWeek: (days: number[]) => void;
  selectedDayOfMonth: number;
  onChangeSelectedDayOfMonth: (day: number) => void;
  selectedTimezone: string;
  onChangeSelectedTimezone: (tz: string) => void;
  notifyUser: boolean;
  onChangeNotifyUser: (val: boolean) => void;
  sleepModeEnabled: boolean;
  onChangeSleepModeEnabled: (val: boolean) => void;
  sleepStartTime: string;
  onChangeSleepStartTime: (val: string) => void;
  sleepEndTime: string;
  onChangeSleepEndTime: (val: string) => void;
}

const FREQUENCY_OPTIONS: { value: ScheduleFrequency; label: string; sublabel: string }[] = [
  { value: 'once', label: 'Один раз в точную дату и время', sublabel: 'Отложенный выход конкретного поста' },
  { value: 'daily', label: 'Ежедневно в выбранное время', sublabel: 'Регулярная ежедневная рубрика' },
  { value: 'weekly', label: 'По выбранным дням недели', sublabel: 'Например: понедельник, среда и пятница' },
  { value: 'monthly', label: 'Раз в месяц (число месяца)', sublabel: 'Ежемесячный дайджест или итоги' },
  { value: 'hours', label: 'Через заданный интервал в часах', sublabel: 'Автовыход каждые N часов' },
  { value: 'minutes', label: 'Через интервал в минутах', sublabel: 'Частая лента новостей' }
];

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Понедельник' },
  { value: '2', label: 'Вторник' },
  { value: '3', label: 'Среда' },
  { value: '4', label: 'Четверг' },
  { value: '5', label: 'Пятница' },
  { value: '6', label: 'Суббота' },
  { value: '0', label: 'Воскресенье' }
];

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' }
];

export const EditorScheduleSection: React.FC<EditorScheduleSectionProps> = ({
  triggerEnabled,
  onChangeTriggerEnabled,
  frequency,
  onChangeFrequency,
  intervalMinutes,
  onChangeIntervalMinutes,
  intervalHours,
  onChangeIntervalHours,
  triggerTime,
  onChangeTriggerTime,
  exactDateTime,
  onChangeExactDateTime,
  selectedDaysOfWeek,
  onChangeSelectedDaysOfWeek,
  selectedDayOfMonth,
  onChangeSelectedDayOfMonth,
  selectedTimezone,
  onChangeSelectedTimezone,
  notifyUser,
  onChangeNotifyUser,
  sleepModeEnabled,
  onChangeSleepModeEnabled,
  sleepStartTime,
  onChangeSleepStartTime,
  sleepEndTime,
  onChangeSleepEndTime
}) => {
  const isOnceFreq = frequency === 'once' || (frequency as string) === 'exact_date';
  const freqLabel = FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.label || 'Расписание';

  let scheduleDetail = triggerTime;
  if (isOnceFreq) {
    scheduleDetail = formatCollapsedExactDateTime(exactDateTime) || exactDateTime || 'выберите дату и время';
  } else if (frequency === 'hours') {
    scheduleDetail = `каждые ${intervalHours} ч.`;
  } else if (frequency === 'minutes') {
    scheduleDetail = `каждые ${intervalMinutes} мин.`;
  }

  const summary = triggerEnabled
    ? `Включено · ${freqLabel} · ${scheduleDetail}`
    : 'Выключено (ручная публикация)';

  const minLocalDateTime = getCurrentLocalMinDateTime();
  const isExactDateInPast = Boolean(triggerEnabled && isOnceFreq && isPastLocalDateTime(exactDateTime));

  return (
    <CollapsibleSection
      title="Автопубликация по расписанию"
      summary={summary}
      icon={<CalendarClock size={17} />}
      defaultOpen={triggerEnabled}
    >
      <div className="space-y-3.5">
        <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/75 border border-pink-300/80 cursor-pointer select-none">
          <span className="text-[14px] font-bold text-slate-900">
            Автоматически публиковать по расписанию
          </span>
          <input
            type="checkbox"
            checked={triggerEnabled}
            onChange={(e) => {
              const checked = e.target.checked;
              onChangeTriggerEnabled(checked);
              if (checked && isOnceFreq && (!exactDateTime || isPastLocalDateTime(exactDateTime))) {
                onChangeExactDateTime(getDefaultLocalPlusOneHour());
              }
            }}
            className="w-5 h-5 accent-pink-600 rounded cursor-pointer"
          />
        </label>

        {triggerEnabled && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GradientSelect
                label="Периодичность выхода"
                value={frequency}
                onChange={(val) => {
                  const nextFreq = val as ScheduleFrequency;
                  onChangeFrequency(nextFreq);
                  if (
                    (nextFreq === 'once' || (nextFreq as string) === 'exact_date') &&
                    (!exactDateTime || isPastLocalDateTime(exactDateTime))
                  ) {
                    onChangeExactDateTime(getDefaultLocalPlusOneHour());
                  }
                }}
                options={FREQUENCY_OPTIONS}
              />

              <GradientSelect
                label="Часовой пояс (для сервера и крона)"
                value={selectedTimezone}
                onChange={onChangeSelectedTimezone}
                options={TIMEZONE_OPTIONS}
              />
            </div>

            {isOnceFreq && (
              <div className="space-y-1.5">
                <label className="block text-[14px] font-bold mb-1 text-slate-900">
                  Точная дата и время выхода (по часам устройства)
                </label>
                <input
                  type="datetime-local"
                  value={normalizeToLocalDateTimeInput(exactDateTime) || exactDateTime}
                  min={minLocalDateTime}
                  onChange={(e) => onChangeExactDateTime(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-white/85 border text-[14px] text-slate-900 ${
                    isExactDateInPast ? 'border-orange-500 ring-2 ring-orange-400/40' : 'border-pink-300'
                  }`}
                />
                {isExactDateInPast ? (
                  <p className="flex items-start gap-1.5 text-[14px] font-semibold text-orange-700 leading-snug">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-orange-600" />
                    <span>Нельзя сохранить в отложку прошедшие дату и время. Выберите время позже текущего.</span>
                  </p>
                ) : (
                  <p className="text-[14px] text-slate-700 leading-snug">
                    Время подставляется по локальным часам вашего устройства (+1 час по умолчанию); часовой пояс выше используется сервером при запуске по крону.
                  </p>
                )}
              </div>
            )}

            {(frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly') && (
              <div>
                <label className="block text-[14px] font-bold mb-1 text-slate-900">
                  Время публикации
                </label>
                <input
                  type="time"
                  value={triggerTime}
                  onChange={(e) => onChangeTriggerTime(e.target.value)}
                  className="w-full sm:w-52 px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
                />
              </div>
            )}

            {frequency === 'weekly' && (
              <GradientMultiSelect
                label="Дни недели"
                values={selectedDaysOfWeek.map(String)}
                onChange={(vals) => onChangeSelectedDaysOfWeek(vals.map(Number))}
                options={WEEKDAY_OPTIONS}
                placeholder="Выберите дни недели..."
                selectAllLabel="Все дни недели"
              />
            )}

            {frequency === 'monthly' && (
              <GradientSelect
                label="Число месяца"
                value={String(selectedDayOfMonth)}
                onChange={(val) => onChangeSelectedDayOfMonth(Number(val))}
                options={Array.from({ length: 31 }, (_, i) => ({
                  value: String(i + 1),
                  label: `${i + 1}-е число каждого месяца`
                }))}
              />
            )}

            {frequency === 'hours' && (
              <GradientSelect
                label="Интервал в часах"
                value={String(intervalHours)}
                onChange={(val) => onChangeIntervalHours(Number(val))}
                options={[1, 2, 3, 4, 6, 8, 12, 24].map((h) => ({
                  value: String(h),
                  label: `Каждые ${h} ч.`
                }))}
              />
            )}

            {frequency === 'minutes' && (
              <GradientSelect
                label="Интервал в минутах"
                value={String(intervalMinutes)}
                onChange={(val) => onChangeIntervalMinutes(Number(val))}
                options={[15, 30, 45, 60, 90, 120].map((m) => ({
                  value: String(m),
                  label: `Каждые ${m} мин.`
                }))}
              />
            )}

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notifyUser}
                onChange={(e) => onChangeNotifyUser(e.target.checked)}
                className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
              />
              <span className="text-[14px] text-slate-800 font-medium">
                Присылать отчет о выходе поста в личные сообщения от @IIrkiBot
              </span>
            </label>

            <CollapsibleSection
              title="Тихий ночной режим"
              summary={
                sleepModeEnabled
                  ? `Не публиковать с ${sleepStartTime} до ${sleepEndTime}`
                  : 'Отключен'
              }
              icon={<Moon size={16} />}
              defaultOpen={sleepModeEnabled}
            >
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sleepModeEnabled}
                    onChange={(e) => onChangeSleepModeEnabled(e.target.checked)}
                    className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                  />
                  <span className="text-[14px] text-slate-800 font-semibold">
                    Приостанавливать автовыход постов ночью
                  </span>
                </label>

                {sleepModeEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[14px] font-bold mb-1 text-slate-900">
                        Начало паузы
                      </label>
                      <input
                        type="time"
                        value={sleepStartTime}
                        onChange={(e) => onChangeSleepStartTime(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[14px] font-bold mb-1 text-slate-900">
                        Окончание паузы
                      </label>
                      <input
                        type="time"
                        value={sleepEndTime}
                        onChange={(e) => onChangeSleepEndTime(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
