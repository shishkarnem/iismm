import { GradientDropdownOption } from '../../ui-kit/GradientDropdown';

export type ScenarioScheduleRuleType =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'interval_hours'
  | 'interval_minutes';

export interface ScenarioScheduleRule {
  id: string;
  enabled: boolean;
  type: ScenarioScheduleRuleType;
  time: string;
  exactDate?: string;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  intervalHours?: number;
  intervalMinutes?: number;
  completedAt?: string | null;
}

export const SCENARIO_TIMEZONE_OPTIONS: GradientDropdownOption[] = [
  { value: 'Europe/Moscow', label: '+3 мск — Москва (по умолчанию)' },
  { value: 'Europe/Kaliningrad', label: '+2 — Калининград' },
  { value: 'Europe/Minsk', label: '+3 — Минск' },
  { value: 'Europe/Samara', label: '+4 — Самара' },
  { value: 'Asia/Dubai', label: '+4 — Дубай' },
  { value: 'Asia/Yekaterinburg', label: '+5 — Екатеринбург' },
  { value: 'Asia/Almaty', label: '+5 — Алматы' },
  { value: 'Asia/Tashkent', label: '+5 — Ташкент' },
  { value: 'Asia/Omsk', label: '+6 — Омск' },
  { value: 'Asia/Novosibirsk', label: '+7 — Новосибирск' },
  { value: 'Asia/Krasnoyarsk', label: '+7 — Красноярск' },
  { value: 'Asia/Irkutsk', label: '+8 — Иркутск' },
  { value: 'Asia/Yakutsk', label: '+9 — Якутск' },
  { value: 'Asia/Vladivostok', label: '+10 — Владивосток' },
  { value: 'Asia/Magadan', label: '+11 — Магадан' },
  { value: 'Asia/Kamchatka', label: '+12 — Камчатка' },
  { value: 'Europe/Berlin', label: '+1 — Берлин / Варшава' },
  { value: 'UTC', label: '0 — UTC (Всемирное время)' }
];

export const SCENARIO_SCHEDULE_TYPE_OPTIONS: GradientDropdownOption[] = [
  {
    value: 'daily',
    label: 'Ежедневно в выбранное время',
    sublabel: 'Запускается каждый день в указанные часы и минуты'
  },
  {
    value: 'weekly',
    label: 'По дням недели',
    sublabel: 'Выбор конкретных дней недели и точного времени запуска'
  },
  {
    value: 'monthly',
    label: 'Раз в месяц (дата и время)',
    sublabel: 'Запуск в выбранные числа месяца (1–31) в заданное время'
  },
  {
    value: 'once',
    label: 'Единоразово (дата и время)',
    sublabel: 'Однократный запуск в точную календарную дату и время'
  },
  {
    value: 'interval_hours',
    label: 'Через интервал в часах',
    sublabel: 'Регулярный автозапуск каждые N часов'
  },
  {
    value: 'interval_minutes',
    label: 'Через интервал в минутах',
    sublabel: 'Частый автозапуск каждые N минут'
  }
];

export const WEEKDAY_MULTI_OPTIONS: GradientDropdownOption[] = [
  { value: '1', label: 'Понедельник (Пн)' },
  { value: '2', label: 'Вторник (Вт)' },
  { value: '3', label: 'Среда (Ср)' },
  { value: '4', label: 'Четверг (Чт)' },
  { value: '5', label: 'Пятница (Пт)' },
  { value: '6', label: 'Суббота (Сб)' },
  { value: '7', label: 'Воскресенье (Вс)' }
];

export const MONTH_DAYS_OPTIONS: GradientDropdownOption[] = Array.from(
  { length: 31 },
  (_, idx) => ({
    value: String(idx + 1),
    label: `${idx + 1}-е число месяца`
  })
);

const SHORT_TZ_LABELS: Record<string, string> = {
  'Europe/Moscow': '+3 мск',
  'Europe/Kaliningrad': '+2 клгд',
  'Europe/Minsk': '+3 Минск',
  'Europe/Samara': '+4 Самара',
  'Asia/Dubai': '+4 Дубай',
  'Asia/Yekaterinburg': '+5 Екб',
  'Asia/Almaty': '+5 Алматы',
  'Asia/Tashkent': '+5 Ташкент',
  'Asia/Omsk': '+6 Омск',
  'Asia/Novosibirsk': '+7 Нск',
  'Asia/Krasnoyarsk': '+7 Крск',
  'Asia/Irkutsk': '+8 Ирк',
  'Asia/Yakutsk': '+9 Якт',
  'Asia/Vladivostok': '+10 Влдв',
  'Asia/Magadan': '+11 Мгд',
  'Asia/Kamchatka': '+12 Камч',
  'Europe/Berlin': '+1 Берлин',
  'UTC': 'UTC+0'
};

const SHORT_DOW_LABELS: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс'
};

export function getTodayIsoDateInMsk(): string {
  const mskNow = new Date(Date.now() + 3 * 3600 * 1000);
  const y = mskNow.getUTCFullYear();
  const m = String(mskNow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(mskNow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeFrontendSchedules(config?: Record<string, any>): {
  timezone: string;
  schedules: ScenarioScheduleRule[];
} {
  const cfg = config || {};
  const timezone =
    typeof cfg.timezone === 'string' && SHORT_TZ_LABELS[cfg.timezone]
      ? cfg.timezone
      : 'Europe/Moscow';
  const todayIso = getTodayIsoDateInMsk();

  if (Array.isArray(cfg.schedules) && cfg.schedules.length > 0) {
    return {
      timezone,
      schedules: cfg.schedules.map((r: any, idx: number) => ({
        id: String(r?.id || `sched_${idx + 1}`),
        enabled: r?.enabled !== false,
        type: (r?.type as ScenarioScheduleRuleType) || 'daily',
        time: String(r?.time || cfg.cronTime || '10:00'),
        exactDate: r?.exactDate || todayIso,
        daysOfWeek:
          Array.isArray(r?.daysOfWeek) && r.daysOfWeek.length > 0
            ? r.daysOfWeek.map(Number)
            : [1, 3, 5],
        daysOfMonth:
          Array.isArray(r?.daysOfMonth) && r.daysOfMonth.length > 0
            ? r.daysOfMonth.map(Number)
            : r?.dayOfMonth
            ? [Number(r.dayOfMonth)]
            : [1],
        intervalHours: Number(r?.intervalHours || 2),
        intervalMinutes: Number(r?.intervalMinutes || 30),
        completedAt: r?.completedAt || null
      }))
    };
  }

  const legacyInterval = String(cfg.cronInterval || 'daily');
  const legacyTime = String(cfg.cronTime || '10:00');
  const legacyDays =
    Array.isArray(cfg.cronDays) && cfg.cronDays.length > 0
      ? cfg.cronDays.map(Number)
      : [1, 2, 3, 4, 5, 6, 7];

  if (legacyInterval === 'once') {
    return {
      timezone,
      schedules: [
        {
          id: 'sched_1',
          enabled: true,
          type: 'once',
          time: legacyTime,
          exactDate: cfg.exactDate || todayIso
        }
      ]
    };
  }
  if (legacyInterval === 'monthly') {
    return {
      timezone,
      schedules: [
        {
          id: 'sched_1',
          enabled: true,
          type: 'monthly',
          time: legacyTime,
          daysOfMonth: [Number(cfg.dayOfMonth || 1)]
        }
      ]
    };
  }
  if (legacyInterval === '15m' || legacyInterval === '30m') {
    return {
      timezone,
      schedules: [
        {
          id: 'sched_1',
          enabled: true,
          type: 'interval_minutes',
          time: legacyTime,
          intervalMinutes: legacyInterval === '15m' ? 15 : 30
        }
      ]
    };
  }
  if (['1h', '2h', '4h', '6h', '12h'].includes(legacyInterval)) {
    return {
      timezone,
      schedules: [
        {
          id: 'sched_1',
          enabled: true,
          type: 'interval_hours',
          time: legacyTime,
          intervalHours: parseInt(legacyInterval, 10) || 2
        }
      ]
    };
  }
  if (legacyInterval === 'weekly' || (legacyInterval === 'daily' && legacyDays.length < 7)) {
    return {
      timezone,
      schedules: [
        {
          id: 'sched_1',
          enabled: true,
          type: 'weekly',
          time: legacyTime,
          daysOfWeek: legacyDays
        }
      ]
    };
  }

  return {
    timezone,
    schedules: [
      {
        id: 'sched_1',
        enabled: true,
        type: 'daily',
        time: legacyTime
      }
    ]
  };
}

export function formatRuleShortLabel(rule: ScenarioScheduleRule): string {
  if (rule.type === 'once') {
    if (rule.exactDate) {
      const [, m, d] = rule.exactDate.split('-');
      return `Разово ${d}.${m} в ${rule.time}`;
    }
    return `Разово в ${rule.time}`;
  }
  if (rule.type === 'monthly') {
    const doms = rule.daysOfMonth?.length ? rule.daysOfMonth : [1];
    return `${doms.join(', ')} числа в ${rule.time}`;
  }
  if (rule.type === 'weekly') {
    const days = rule.daysOfWeek?.length ? rule.daysOfWeek : [1];
    if (days.length === 7) return `Ежедневно в ${rule.time}`;
    return `${days.map((d) => SHORT_DOW_LABELS[d] || d).join(', ')} в ${rule.time}`;
  }
  if (rule.type === 'interval_hours') {
    return `Каждые ${rule.intervalHours || 2} ч.`;
  }
  if (rule.type === 'interval_minutes') {
    return `Каждые ${rule.intervalMinutes || 30} мин.`;
  }
  return `Ежедневно в ${rule.time}`;
}

export function buildTriggerScheduleSubtitle(config?: Record<string, any>): string {
  const { timezone, schedules } = normalizeFrontendSchedules(config);
  const active = schedules.filter((s) => s.enabled !== false);
  const tzShort = SHORT_TZ_LABELS[timezone] || '+3 мск';
  if (active.length === 0) return `Расписание выкл. • ${tzShort}`;
  if (active.length === 1) return `${formatRuleShortLabel(active[0])} • ${tzShort}`;
  return `${active.length} запуска • ${formatRuleShortLabel(active[0])} +${active.length - 1} • ${tzShort}`;
}

export function buildLegacySyncFields(schedules: ScenarioScheduleRule[]) {
  const primary = schedules.find((s) => s.enabled !== false) || schedules[0];
  if (!primary) {
    return { cronInterval: 'daily', cronTime: '10:00' };
  }
  const cronInterval =
    primary.type === 'once'
      ? 'once'
      : primary.type === 'monthly'
      ? 'monthly'
      : primary.type === 'weekly'
      ? 'weekly'
      : primary.type === 'interval_hours'
      ? `${primary.intervalHours || 2}h`
      : primary.type === 'interval_minutes'
      ? `${primary.intervalMinutes || 30}m`
      : 'daily';

  return {
    cronInterval,
    cronTime: primary.time || '10:00',
    ...(primary.daysOfWeek ? { cronDays: primary.daysOfWeek } : {}),
    ...(primary.exactDate ? { exactDate: primary.exactDate } : {}),
    ...(primary.daysOfMonth?.[0] ? { dayOfMonth: primary.daysOfMonth[0] } : {})
  };
}
