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
  /** HH:MM for once / daily / weekly / monthly */
  time: string;
  /** YYYY-MM-DD for once */
  exactDate?: string;
  /** 1..7 (Mon..Sun) for weekly */
  daysOfWeek?: number[];
  /** 1..31 for monthly (supports 1 or multiple days in month) */
  daysOfMonth?: number[];
  /** 1..72 for interval_hours */
  intervalHours?: number;
  /** 5..720 for interval_minutes */
  intervalMinutes?: number;
  /** ISO timestamp when a 'once' rule already executed */
  completedAt?: string | null;
}

export const TIMEZONE_OFFSETS_MINUTES: Record<string, { offsetMinutes: number; shortLabel: string }> = {
  'UTC': { offsetMinutes: 0, shortLabel: 'UTC+0' },
  'Europe/Berlin': { offsetMinutes: 60, shortLabel: '+1 Берлин' },
  'Europe/Kaliningrad': { offsetMinutes: 120, shortLabel: '+2 клгд' },
  'Europe/Moscow': { offsetMinutes: 180, shortLabel: '+3 мск' },
  'Europe/Minsk': { offsetMinutes: 180, shortLabel: '+3 Минск' },
  'Europe/Samara': { offsetMinutes: 240, shortLabel: '+4 Самара' },
  'Asia/Dubai': { offsetMinutes: 240, shortLabel: '+4 Дубай' },
  'Asia/Yekaterinburg': { offsetMinutes: 300, shortLabel: '+5 Екб' },
  'Asia/Almaty': { offsetMinutes: 300, shortLabel: '+5 Алматы' },
  'Asia/Tashkent': { offsetMinutes: 300, shortLabel: '+5 Ташкент' },
  'Asia/Omsk': { offsetMinutes: 360, shortLabel: '+6 Омск' },
  'Asia/Novosibirsk': { offsetMinutes: 420, shortLabel: '+7 Нск' },
  'Asia/Krasnoyarsk': { offsetMinutes: 420, shortLabel: '+7 Крск' },
  'Asia/Irkutsk': { offsetMinutes: 480, shortLabel: '+8 Иркутск' },
  'Asia/Yakutsk': { offsetMinutes: 540, shortLabel: '+9 Якутск' },
  'Asia/Vladivostok': { offsetMinutes: 600, shortLabel: '+10 Влдв' },
  'Asia/Magadan': { offsetMinutes: 660, shortLabel: '+11 Магадан' },
  'Asia/Kamchatka': { offsetMinutes: 720, shortLabel: '+12 Камчатка' }
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function resolveTimezoneInfo(tz?: string): {
  timezone: string;
  offsetMinutes: number;
  offsetMs: number;
  shortLabel: string;
} {
  const clean = String(tz || 'Europe/Moscow').trim();
  const known = TIMEZONE_OFFSETS_MINUTES[clean];
  if (known) {
    return {
      timezone: clean,
      offsetMinutes: known.offsetMinutes,
      offsetMs: known.offsetMinutes * 60 * 1000,
      shortLabel: known.shortLabel
    };
  }
  return {
    timezone: 'Europe/Moscow',
    offsetMinutes: 180,
    offsetMs: 180 * 60 * 1000,
    shortLabel: '+3 мск'
  };
}

export function getZonedDateParts(date: Date, tz?: string): {
  year: number;
  month0: number;
  day: number;
  isoDay: number;
  hour: number;
  minute: number;
  dateKey: string;
} {
  const { offsetMs } = resolveTimezoneInfo(tz);
  const shifted = new Date(date.getTime() + offsetMs);
  const year = shifted.getUTCFullYear();
  const month0 = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const rawDow = shifted.getUTCDay();
  const isoDay = rawDow === 0 ? 7 : rawDow;
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const dateKey = `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
  return { year, month0, day, isoDay, hour, minute, dateKey };
}

export function buildZonedTimestampUtc(
  year: number,
  month0: number,
  day: number,
  hour: number,
  minute: number,
  tz?: string
): Date {
  const { offsetMs } = resolveTimezoneInfo(tz);
  return new Date(Date.UTC(year, month0, day, hour, minute, 0, 0) - offsetMs);
}

export function getDaysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function parseHHMM(raw?: string): { hh: number; mm: number; formatted: string } {
  const str = String(raw || '10:00').trim();
  const [rawH, rawM] = str.split(':').map((x) => parseInt(x, 10));
  const hh = Number.isFinite(rawH) ? Math.min(23, Math.max(0, rawH)) : 10;
  const mm = Number.isFinite(rawM) ? Math.min(59, Math.max(0, rawM)) : 0;
  return { hh, mm, formatted: `${pad2(hh)}:${pad2(mm)}` };
}

export function normalizeTriggerSchedulesFromConfig(
  cfg: Record<string, any> | undefined,
  refDate: Date = new Date()
): {
  timezone: string;
  schedules: ScenarioScheduleRule[];
} {
  const safeCfg = cfg || {};
  const tzInfo = resolveTimezoneInfo(safeCfg.timezone);
  const zonedNow = getZonedDateParts(refDate, tzInfo.timezone);

  if (Array.isArray(safeCfg.schedules) && safeCfg.schedules.length > 0) {
    const normalized: ScenarioScheduleRule[] = safeCfg.schedules.map((raw: any, idx: number) => {
      const parsedTime = parseHHMM(raw?.time || safeCfg.cronTime || '10:00');
      const rawType = String(raw?.type || 'daily') as ScenarioScheduleRuleType;
      const validTypes: ScenarioScheduleRuleType[] = [
        'once',
        'daily',
        'weekly',
        'monthly',
        'interval_hours',
        'interval_minutes'
      ];
      const type: ScenarioScheduleRuleType = validTypes.includes(rawType) ? rawType : 'daily';

      const daysOfWeek =
        Array.isArray(raw?.daysOfWeek) && raw.daysOfWeek.length > 0
          ? raw.daysOfWeek.map(Number).filter((d: number) => d >= 1 && d <= 7)
          : [1, 3, 5];

      const rawDomList = Array.isArray(raw?.daysOfMonth)
        ? raw.daysOfMonth
        : raw?.dayOfMonth
        ? [Number(raw.dayOfMonth)]
        : [1];
      const daysOfMonth = rawDomList
        .map(Number)
        .filter((d: number) => d >= 1 && d <= 31)
        .sort((a: number, b: number) => a - b);

      return {
        id: String(raw?.id || `sched_${idx + 1}`),
        enabled: raw?.enabled !== false,
        type,
        time: parsedTime.formatted,
        exactDate:
          typeof raw?.exactDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.exactDate)
            ? raw.exactDate
            : zonedNow.dateKey,
        daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : [1],
        daysOfMonth: daysOfMonth.length > 0 ? daysOfMonth : [1],
        intervalHours: Math.min(72, Math.max(1, Number(raw?.intervalHours || 2))),
        intervalMinutes: Math.min(720, Math.max(5, Number(raw?.intervalMinutes || 30))),
        completedAt: raw?.completedAt || null
      };
    });

    return { timezone: tzInfo.timezone, schedules: normalized };
  }

  // Legacy single-field conversion
  const legacyInterval = String(safeCfg.cronInterval || 'daily');
  const parsedTime = parseHHMM(safeCfg.cronTime || '10:00');
  const legacyDays: number[] =
    Array.isArray(safeCfg.cronDays) && safeCfg.cronDays.length > 0
      ? safeCfg.cronDays.map(Number).filter((d: number) => d >= 1 && d <= 7)
      : [1, 2, 3, 4, 5, 6, 7];

  let rule: ScenarioScheduleRule;
  if (legacyInterval === 'once') {
    rule = {
      id: 'sched_1',
      enabled: true,
      type: 'once',
      time: parsedTime.formatted,
      exactDate: safeCfg.exactDate || zonedNow.dateKey
    };
  } else if (legacyInterval === 'monthly') {
    rule = {
      id: 'sched_1',
      enabled: true,
      type: 'monthly',
      time: parsedTime.formatted,
      daysOfMonth: [Math.min(31, Math.max(1, Number(safeCfg.dayOfMonth || 1)))]
    };
  } else if (legacyInterval === '15m' || legacyInterval === '30m') {
    rule = {
      id: 'sched_1',
      enabled: true,
      type: 'interval_minutes',
      time: parsedTime.formatted,
      intervalMinutes: legacyInterval === '15m' ? 15 : 30
    };
  } else if (['1h', '2h', '4h', '6h', '12h'].includes(legacyInterval)) {
    rule = {
      id: 'sched_1',
      enabled: true,
      type: 'interval_hours',
      time: parsedTime.formatted,
      intervalHours: parseInt(legacyInterval, 10) || 2
    };
  } else if (legacyInterval === 'weekly' || (legacyInterval === 'daily' && legacyDays.length < 7)) {
    rule = {
      id: 'sched_1',
      enabled: true,
      type: 'weekly',
      time: parsedTime.formatted,
      daysOfWeek: legacyDays
    };
  } else {
    rule = {
      id: 'sched_1',
      enabled: true,
      type: 'daily',
      time: parsedTime.formatted
    };
  }

  return { timezone: tzInfo.timezone, schedules: [rule] };
}

const SHORT_DOW: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс'
};

export function formatSingleRuleHuman(rule: ScenarioScheduleRule): string {
  if (rule.type === 'once') {
    if (rule.completedAt) {
      return `Единоразово (${rule.exactDate || ''} ${rule.time} — выполнен)`;
    }
    if (rule.exactDate) {
      const [y, m, d] = rule.exactDate.split('-');
      return `Единоразово ${d}.${m}.${y} в ${rule.time}`;
    }
    return `Единоразово в ${rule.time}`;
  }
  if (rule.type === 'monthly') {
    const doms = rule.daysOfMonth && rule.daysOfMonth.length > 0 ? rule.daysOfMonth : [1];
    return `Раз в месяц (${doms.join(', ')} числа) в ${rule.time}`;
  }
  if (rule.type === 'weekly') {
    const days = rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [1];
    if (days.length === 7) return `Ежедневно в ${rule.time}`;
    return `${days.map((d) => SHORT_DOW[d] || d).join(', ')} в ${rule.time}`;
  }
  if (rule.type === 'interval_hours') {
    return `Каждые ${rule.intervalHours || 2} ч.`;
  }
  if (rule.type === 'interval_minutes') {
    return `Каждые ${rule.intervalMinutes || 30} мин.`;
  }
  return `Ежедневно в ${rule.time}`;
}

function computeNextDateForSingleRule(
  rule: ScenarioScheduleRule,
  timezone: string,
  fromDate: Date,
  legacyAlreadySentOnce: boolean
): { nextDate: Date | null; isOnceRule: boolean; isOnceCompleted: boolean; cronExpr: string } {
  const { hh, mm } = parseHHMM(rule.time);
  const baseZoned = getZonedDateParts(fromDate, timezone);

  if (rule.type === 'once') {
    if (rule.completedAt || legacyAlreadySentOnce) {
      return { nextDate: null, isOnceRule: true, isOnceCompleted: true, cronExpr: '' };
    }
    if (rule.exactDate && /^\d{4}-\d{2}-\d{2}$/.test(rule.exactDate)) {
      const [y, m, d] = rule.exactDate.split('-').map(Number);
      const exactUtc = buildZonedTimestampUtc(y, m - 1, d, hh, mm, timezone);
      if (exactUtc.getTime() > fromDate.getTime()) {
        return {
          nextDate: exactUtc,
          isOnceRule: true,
          isOnceCompleted: false,
          cronExpr: `${mm} ${hh} ${d} ${m} *`
        };
      }
      // If user picked today's date with a future-intended time that just passed within 2 minutes, schedule +1m; otherwise if date already passed without running, treat as next occurrence only if no explicit past date, or schedule +1 day if exactDate was default today
      if (rule.exactDate === baseZoned.dateKey) {
        const tomorrow = buildZonedTimestampUtc(
          baseZoned.year,
          baseZoned.month0,
          baseZoned.day + 1,
          hh,
          mm,
          timezone
        );
        return {
          nextDate: tomorrow,
          isOnceRule: true,
          isOnceCompleted: false,
          cronExpr: `${mm} ${hh} * * *`
        };
      }
      return { nextDate: null, isOnceRule: true, isOnceCompleted: true, cronExpr: '' };
    }

    let candidate = buildZonedTimestampUtc(
      baseZoned.year,
      baseZoned.month0,
      baseZoned.day,
      hh,
      mm,
      timezone
    );
    if (candidate.getTime() <= fromDate.getTime()) {
      candidate = buildZonedTimestampUtc(
        baseZoned.year,
        baseZoned.month0,
        baseZoned.day + 1,
        hh,
        mm,
        timezone
      );
    }
    return {
      nextDate: candidate,
      isOnceRule: true,
      isOnceCompleted: false,
      cronExpr: `${mm} ${hh} * * *`
    };
  }

  if (rule.type === 'interval_minutes') {
    const mins = Math.min(720, Math.max(5, Number(rule.intervalMinutes || 30)));
    return {
      nextDate: new Date(fromDate.getTime() + mins * 60 * 1000),
      isOnceRule: false,
      isOnceCompleted: false,
      cronExpr: mins < 60 ? `*/${mins} * * * *` : `0 */${Math.max(1, Math.round(mins / 60))} * * *`
    };
  }

  if (rule.type === 'interval_hours') {
    const hrs = Math.min(72, Math.max(1, Number(rule.intervalHours || 2)));
    return {
      nextDate: new Date(fromDate.getTime() + hrs * 3600 * 1000),
      isOnceRule: false,
      isOnceCompleted: false,
      cronExpr: `0 */${hrs} * * *`
    };
  }

  if (rule.type === 'monthly') {
    const doms =
      Array.isArray(rule.daysOfMonth) && rule.daysOfMonth.length > 0
        ? rule.daysOfMonth.map(Number).filter((d) => d >= 1 && d <= 31)
        : [1];
    let earliest: Date | null = null;

    for (let monthOffset = 0; monthOffset <= 13; monthOffset++) {
      const targetYear = baseZoned.year + Math.floor((baseZoned.month0 + monthOffset) / 12);
      const targetMonth0 = (baseZoned.month0 + monthOffset) % 12;
      const maxDay = getDaysInMonth(targetYear, targetMonth0);

      for (const reqDom of doms) {
        const effectiveDay = Math.min(reqDom, maxDay);
        const cand = buildZonedTimestampUtc(targetYear, targetMonth0, effectiveDay, hh, mm, timezone);
        if (cand.getTime() > fromDate.getTime()) {
          if (!earliest || cand.getTime() < earliest.getTime()) {
            earliest = cand;
          }
        }
      }
      if (earliest) break;
    }

    return {
      nextDate: earliest,
      isOnceRule: false,
      isOnceCompleted: false,
      cronExpr: `${mm} ${hh} ${doms.join(',')} * *`
    };
  }

  if (rule.type === 'weekly') {
    const allowedDays =
      Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0
        ? rule.daysOfWeek.map(Number).filter((d) => d >= 1 && d <= 7)
        : [1];
    for (let add = 0; add <= 8; add++) {
      const cand = buildZonedTimestampUtc(
        baseZoned.year,
        baseZoned.month0,
        baseZoned.day + add,
        hh,
        mm,
        timezone
      );
      const candZoned = getZonedDateParts(cand, timezone);
      if (allowedDays.includes(candZoned.isoDay) && cand.getTime() > fromDate.getTime()) {
        return {
          nextDate: cand,
          isOnceRule: false,
          isOnceCompleted: false,
          cronExpr: `${mm} ${hh} * * ${allowedDays.join(',')}`
        };
      }
    }
  }

  // daily
  let dailyCand = buildZonedTimestampUtc(
    baseZoned.year,
    baseZoned.month0,
    baseZoned.day,
    hh,
    mm,
    timezone
  );
  if (dailyCand.getTime() <= fromDate.getTime()) {
    dailyCand = buildZonedTimestampUtc(
      baseZoned.year,
      baseZoned.month0,
      baseZoned.day + 1,
      hh,
      mm,
      timezone
    );
  }
  return {
    nextDate: dailyCand,
    isOnceRule: false,
    isOnceCompleted: false,
    cronExpr: `${mm} ${hh} * * *`
  };
}

export function applySleepModeWindow(
  candidate: Date,
  cfg: Record<string, any> | undefined,
  timezone: string,
  fromDate: Date
): Date {
  if (!cfg?.sleepMode || !cfg.sleepStartTime || !cfg.sleepEndTime) {
    return candidate;
  }
  const [sH, sM] = String(cfg.sleepStartTime).split(':').map(Number);
  const [eH, eM] = String(cfg.sleepEndTime).split(':').map(Number);
  const zoned = getZonedDateParts(candidate, timezone);
  const curTotal = zoned.hour * 60 + zoned.minute;
  const sTotal = (Number.isFinite(sH) ? sH : 23) * 60 + (Number.isFinite(sM) ? sM : 0);
  const eTotal = (Number.isFinite(eH) ? eH : 8) * 60 + (Number.isFinite(eM) ? eM : 0);
  const inSleep =
    sTotal <= eTotal
      ? curTotal >= sTotal && curTotal < eTotal
      : curTotal >= sTotal || curTotal < eTotal;

  if (!inSleep) return candidate;

  let wakeCandidate = buildZonedTimestampUtc(
    zoned.year,
    zoned.month0,
    zoned.day,
    Number.isFinite(eH) ? eH : 8,
    Number.isFinite(eM) ? eM : 0,
    timezone
  );
  if (wakeCandidate.getTime() <= fromDate.getTime()) {
    wakeCandidate = buildZonedTimestampUtc(
      zoned.year,
      zoned.month0,
      zoned.day + 1,
      Number.isFinite(eH) ? eH : 8,
      Number.isFinite(eM) ? eM : 0,
      timezone
    );
  }
  return wakeCandidate;
}

export function computeMultiScheduleSlotKey(scenario: any, refDate: Date = new Date()): string {
  const nodes: any[] = Array.isArray(scenario?.nodes) ? scenario.nodes : [];
  const triggerNode = nodes.find((n) => n.type === 'trigger_schedule' && n.enabled !== false);
  const cfg = triggerNode?.config || {};
  const { timezone, schedules } = normalizeTriggerSchedulesFromConfig(cfg, refDate);
  const enabledRules = schedules.filter((r) => r.enabled !== false);

  if (enabledRules.length === 1 && enabledRules[0].type === 'once') {
    return `once:${enabledRules[0].id}:${enabledRules[0].exactDate || 'any'}:${enabledRules[0].time}`;
  }

  // Bucket to 5-minute window in chosen timezone so multiple launches on the same day at different hours don't block each other!
  const zoned = getZonedDateParts(refDate, timezone);
  const fiveMinBucket = Math.floor(zoned.minute / 5) * 5;
  return `slot:${zoned.dateKey}:${pad2(zoned.hour)}:${pad2(fiveMinBucket)}`;
}

export function computeMultiScheduleNextRun(
  scenario: any,
  fromDate: Date = new Date()
): {
  hasScheduleTrigger: boolean;
  isOnce: boolean;
  isCompletedOnce: boolean;
  nextRunIso: string | null;
  humanSchedule: string;
  cronExpr: string;
  activeRuleId?: string;
} {
  const nodes: any[] = Array.isArray(scenario?.nodes) ? scenario.nodes : [];
  const triggerNode = nodes.find((n) => n.type === 'trigger_schedule' && n.enabled !== false);

  if (!triggerNode) {
    return {
      hasScheduleTrigger: false,
      isOnce: false,
      isCompletedOnce: false,
      nextRunIso: null,
      humanSchedule: 'Ручной запуск',
      cronExpr: ''
    };
  }

  const cfg = triggerNode.config || {};
  const { timezone, schedules } = normalizeTriggerSchedulesFromConfig(cfg, fromDate);
  const tzInfo = resolveTimezoneInfo(timezone);
  const enabledRules = schedules.filter((r) => r.enabled !== false);

  if (enabledRules.length === 0) {
    return {
      hasScheduleTrigger: false,
      isOnce: false,
      isCompletedOnce: false,
      nextRunIso: null,
      humanSchedule: 'Расписание отключено',
      cronExpr: ''
    };
  }

  const legacyOnlySingleOnce =
    !Array.isArray(cfg.schedules) &&
    enabledRules.length === 1 &&
    enabledRules[0].type === 'once' &&
    (Boolean(scenario?.isSent) ||
      scenario?.lastRunSlot === 'once' ||
      scenario?.lastStatus === 'completed' ||
      (Boolean(scenario?.lastRunAt) && scenario?.lastStatus === 'success'));

  let earliestDate: Date | null = null;
  let earliestRule: ScenarioScheduleRule | null = null;
  let earliestCron = '';
  let allOnce = true;
  let allOnceDone = true;

  for (const rule of enabledRules) {
    const res = computeNextDateForSingleRule(rule, timezone, fromDate, legacyOnlySingleOnce);
    if (!res.isOnceRule) {
      allOnce = false;
      allOnceDone = false;
    } else if (!res.isOnceCompleted && res.nextDate) {
      allOnceDone = false;
    }

    if (res.nextDate) {
      const adjusted = applySleepModeWindow(res.nextDate, cfg, timezone, fromDate);
      if (!earliestDate || adjusted.getTime() < earliestDate.getTime()) {
        earliestDate = adjusted;
        earliestRule = rule;
        earliestCron = res.cronExpr;
      }
    }
  }

  if (allOnce && (allOnceDone || !earliestDate)) {
    return {
      hasScheduleTrigger: true,
      isOnce: true,
      isCompletedOnce: true,
      nextRunIso: null,
      humanSchedule: `Выполнен (${tzInfo.shortLabel})`,
      cronExpr: ''
    };
  }

  const humanParts = enabledRules.slice(0, 2).map(formatSingleRuleHuman);
  const extraCount = enabledRules.length > 2 ? ` + еще ${enabledRules.length - 2}` : '';
  const humanSchedule =
    enabledRules.length === 1
      ? `${humanParts[0]} (${tzInfo.shortLabel})`
      : `${enabledRules.length} зап.: ${humanParts.join(' · ')}${extraCount} (${tzInfo.shortLabel})`;

  return {
    hasScheduleTrigger: true,
    isOnce: allOnce && enabledRules.length === 1,
    isCompletedOnce: false,
    nextRunIso: earliestDate ? earliestDate.toISOString() : null,
    humanSchedule,
    cronExpr: earliestCron || '0 10 * * *',
    activeRuleId: earliestRule?.id
  };
}

export function markDueOnceRulesCompletedOnScenario(scenario: any, firedAt: Date): any {
  if (!scenario || !Array.isArray(scenario.nodes)) return scenario;
  let changed = false;
  const firedMs = firedAt.getTime();

  const updatedNodes = scenario.nodes.map((node: any) => {
    if (node.type !== 'trigger_schedule' || node.enabled === false) return node;
    const cfg = node.config || {};
    if (!Array.isArray(cfg.schedules) || cfg.schedules.length === 0) return node;

    const tz = cfg.timezone || 'Europe/Moscow';
    const nextSchedules = cfg.schedules.map((r: ScenarioScheduleRule) => {
      if (r.type !== 'once' || r.enabled === false || r.completedAt) return r;
      const { hh, mm } = parseHHMM(r.time);
      if (r.exactDate && /^\d{4}-\d{2}-\d{2}$/.test(r.exactDate)) {
        const [y, m, d] = r.exactDate.split('-').map(Number);
        const dueUtc = buildZonedTimestampUtc(y, m - 1, d, hh, mm, tz);
        if (Math.abs(firedMs - dueUtc.getTime()) <= 30 * 60 * 1000 || firedMs >= dueUtc.getTime()) {
          changed = true;
          return { ...r, completedAt: firedAt.toISOString() };
        }
      }
      return r;
    });

    if (!changed) return node;
    return {
      ...node,
      config: {
        ...cfg,
        schedules: nextSchedules
      }
    };
  });

  return changed ? { ...scenario, nodes: updatedNodes } : scenario;
}
