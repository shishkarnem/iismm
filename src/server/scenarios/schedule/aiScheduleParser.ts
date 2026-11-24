import { DB } from '../../db';
import { callProTalkBotApi, removeMarkdownEscaping } from '../../protalk';
import {
  combineSystemAndUserPrompt,
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from '../prompts/scenarioPromptsRepo';
import {
  ScenarioScheduleRule,
  ScenarioScheduleRuleType,
  TIMEZONE_OFFSETS_MINUTES,
  formatSingleRuleHuman,
  getZonedDateParts,
  resolveTimezoneInfo
} from './multiScheduleEngine';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function sanitizeTime(raw?: string, fallback = '10:00'): string {
  const m = String(raw || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return fallback;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${pad2(hh)}:${pad2(mm)}`;
}

function detectTimezoneFromText(text: string, fallbackTz: string): string {
  const lower = text.toLowerCase();
  if (/калининград|\+2\b|utc\+2/.test(lower)) return 'Europe/Kaliningrad';
  if (/москв|мск|\+3\b|utc\+3|питер|спб/.test(lower)) return 'Europe/Moscow';
  if (/минск/.test(lower)) return 'Europe/Minsk';
  if (/самар|\+4\b|utc\+4/.test(lower)) return 'Europe/Samara';
  if (/дубай/.test(lower)) return 'Asia/Dubai';
  if (/екатеринбург|екб|урал|\+5\b|utc\+5/.test(lower)) return 'Asia/Yekaterinburg';
  if (/алмат/.test(lower)) return 'Asia/Almaty';
  if (/ташкент/.test(lower)) return 'Asia/Tashkent';
  if (/омск|\+6\b|utc\+6/.test(lower)) return 'Asia/Omsk';
  if (/новосибирск|нск|\+7\b|utc\+7/.test(lower)) return 'Asia/Novosibirsk';
  if (/красноярск/.test(lower)) return 'Asia/Krasnoyarsk';
  if (/иркутск|\+8\b|utc\+8/.test(lower)) return 'Asia/Irkutsk';
  if (/якутск|\+9\b|utc\+9/.test(lower)) return 'Asia/Yakutsk';
  if (/владивосток|\+10\b|utc\+10/.test(lower)) return 'Asia/Vladivostok';
  if (/магадан|\+11\b|utc\+11/.test(lower)) return 'Asia/Magadan';
  if (/камчат|\+12\b|utc\+12/.test(lower)) return 'Asia/Kamchatka';
  if (/\butc\b|\+0\b|гринвич/.test(lower)) return 'UTC';
  return TIMEZONE_OFFSETS_MINUTES[fallbackTz] ? fallbackTz : 'Europe/Moscow';
}

function fallbackParseScheduleFromRussianText(
  promptText: string,
  currentTimezone: string
): { timezone: string; schedules: ScenarioScheduleRule[] } {
  const timezone = detectTimezoneFromText(promptText, currentTimezone);
  const nowParts = getZonedDateParts(new Date(), timezone);
  const chunks = promptText
    .split(/(?:\s+а\s+также\s+|\s+и\s+еще\s+|\s+плюс\s+|;|\n)+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const rules: ScenarioScheduleRule[] = [];

  (chunks.length > 0 ? chunks : [promptText]).forEach((segment, idx) => {
    const lower = segment.toLowerCase();
    const timeMatch = segment.match(/(\d{1,2})[:.](\d{2})/);
    const time = timeMatch
      ? `${pad2(Math.min(23, parseInt(timeMatch[1], 10)))}:${pad2(Math.min(59, parseInt(timeMatch[2], 10)))}`
      : '10:00';

    const minMatch = lower.match(/каждые?\s*(\d{1,3})\s*мин/);
    if (minMatch) {
      rules.push({
        id: `sched_ai_${Date.now()}_${idx}`,
        enabled: true,
        type: 'interval_minutes',
        time,
        intervalMinutes: Math.min(720, Math.max(5, parseInt(minMatch[1], 10) || 30))
      });
      return;
    }

    const hourMatch = lower.match(/каждые?\s*(\d{1,2})\s*час/);
    if (hourMatch) {
      rules.push({
        id: `sched_ai_${Date.now()}_${idx}`,
        enabled: true,
        type: 'interval_hours',
        time,
        intervalHours: Math.min(72, Math.max(1, parseInt(hourMatch[1], 10) || 2))
      });
      return;
    }

    if (/месяц|ежемесячн|числ/.test(lower)) {
      const domMatches = Array.from(lower.matchAll(/\b([1-2]?\d|3[01])(?:-го|-е)?\s*(?:числ|и\s*\d)/g)).map(
        (m) => parseInt(m[1], 10)
      );
      const plainNumbers =
        domMatches.length > 0
          ? domMatches
          : Array.from(lower.matchAll(/\b([1-2]?\d|3[01])\s*числ/g)).map((m) => parseInt(m[1], 10));
      const daysOfMonth =
        plainNumbers.length > 0
          ? Array.from(new Set(plainNumbers.filter((d) => d >= 1 && d <= 31))).sort((a, b) => a - b)
          : [1];
      rules.push({
        id: `sched_ai_${Date.now()}_${idx}`,
        enabled: true,
        type: 'monthly',
        time,
        daysOfMonth
      });
      return;
    }

    const dowMap: Array<{ re: RegExp; day: number }> = [
      { re: /понедельн|\bпн\b/, day: 1 },
      { re: /вторник|\bвт\b/, day: 2 },
      { re: /сред[ауы]|\bср\b/, day: 3 },
      { re: /четверг|\bчт\b/, day: 4 },
      { re: /пятниц|\bпт\b/, day: 5 },
      { re: /суббот|\bсб\b/, day: 6 },
      { re: /воскресен|\bвс\b/, day: 7 }
    ];
    const matchedDows = dowMap.filter((d) => d.re.test(lower)).map((d) => d.day);
    if (/будн/.test(lower)) {
      matchedDows.push(1, 2, 3, 4, 5);
    }
    if (/выходн/.test(lower)) {
      matchedDows.push(6, 7);
    }

    if (matchedDows.length > 0) {
      rules.push({
        id: `sched_ai_${Date.now()}_${idx}`,
        enabled: true,
        type: 'weekly',
        time,
        daysOfWeek: Array.from(new Set(matchedDows)).sort((a, b) => a - b)
      });
      return;
    }

    if (/один раз|единоразов|разово|завтра|послезавтра|\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}/.test(lower)) {
      let exactDate = nowParts.dateKey;
      const isoMatch = segment.match(/(\d{4})-(\d{2})-(\d{2})/);
      const ruDateMatch = segment.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/);
      if (isoMatch) {
        exactDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      } else if (ruDateMatch) {
        const d = Math.min(31, Math.max(1, parseInt(ruDateMatch[1], 10)));
        const m = Math.min(12, Math.max(1, parseInt(ruDateMatch[2], 10)));
        const rawY = ruDateMatch[3] ? parseInt(ruDateMatch[3], 10) : nowParts.year;
        const y = rawY < 100 ? 2000 + rawY : rawY;
        exactDate = `${y}-${pad2(m)}-${pad2(d)}`;
      } else if (/послезавтра/.test(lower)) {
        const d = new Date(Date.now() + 2 * 86400 * 1000);
        exactDate = getZonedDateParts(d, timezone).dateKey;
      } else if (/завтра/.test(lower)) {
        const d = new Date(Date.now() + 86400 * 1000);
        exactDate = getZonedDateParts(d, timezone).dateKey;
      }

      rules.push({
        id: `sched_ai_${Date.now()}_${idx}`,
        enabled: true,
        type: 'once',
        time,
        exactDate
      });
      return;
    }

    rules.push({
      id: `sched_ai_${Date.now()}_${idx}`,
      enabled: true,
      type: 'daily',
      time
    });
  });

  return { timezone, schedules: rules };
}

export async function parseScheduleWithAi1Iirka(params: {
  userPrompt: string;
  currentTimezone?: string;
  userId?: string;
}): Promise<{
  timezone: string;
  schedules: ScenarioScheduleRule[];
  summary: string;
}> {
  const cleanPrompt = String(params.userPrompt || '').trim();
  const baseTz = resolveTimezoneInfo(params.currentTimezone || 'Europe/Moscow').timezone;
  const nowZoned = getZonedDateParts(new Date(), baseTz);

  const settings = DB.getSettings();
  const botId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const botToken =
    settings?.protalkBotToken?.trim() ||
    process.env.PROTALK_BOT_TOKEN ||
    'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  const allowedTimezones = Object.keys(TIMEZONE_OFFSETS_MINUTES).join(', ');
  const promptRecord = await getRequiredScenarioPrompt('trigger_schedule', 'ai_parse_schedule');
  const renderedUser = renderPromptTemplate(promptRecord.user_prompt_template, {
    base_tz: baseTz,
    current_date: nowZoned.dateKey,
    iso_day: nowZoned.isoDay,
    current_time: `${pad2(nowZoned.hour)}:${pad2(nowZoned.minute)}`,
    user_prompt: cleanPrompt,
    allowed_timezones: allowedTimezones
  });
  const aiInstruction = combineSystemAndUserPrompt(promptRecord.system_prompt, renderedUser);

  if (botId && botToken && cleanPrompt) {
    try {
      const raw = await callProTalkBotApi(aiInstruction, botId, botToken, params.userId);
      const cleaned = removeMarkdownEscaping(String(raw || '')).trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && Array.isArray(parsed.schedules) && parsed.schedules.length > 0) {
          const resolvedTz = TIMEZONE_OFFSETS_MINUTES[String(parsed.timezone || '')]
            ? String(parsed.timezone)
            : detectTimezoneFromText(cleanPrompt, baseTz);

          const validTypes: ScenarioScheduleRuleType[] = [
            'once',
            'daily',
            'weekly',
            'monthly',
            'interval_hours',
            'interval_minutes'
          ];

          const mappedSchedules: ScenarioScheduleRule[] = parsed.schedules
            .slice(0, 8)
            .map((item: any, idx: number) => {
              const t: ScenarioScheduleRuleType = validTypes.includes(item?.type)
                ? item.type
                : 'daily';
              const time = sanitizeTime(item?.time, '10:00');
              const dows = Array.isArray(item?.daysOfWeek)
                ? item.daysOfWeek.map(Number).filter((d: number) => d >= 1 && d <= 7)
                : [1, 3, 5];
              const doms = Array.isArray(item?.daysOfMonth)
                ? item.daysOfMonth.map(Number).filter((d: number) => d >= 1 && d <= 31)
                : item?.dayOfMonth
                ? [Math.min(31, Math.max(1, Number(item.dayOfMonth)))]
                : [1];

              return {
                id: `sched_ai_${Date.now()}_${idx}`,
                enabled: true,
                type: t,
                time,
                exactDate:
                  typeof item?.exactDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.exactDate)
                    ? item.exactDate
                    : nowZoned.dateKey,
                daysOfWeek: dows.length > 0 ? dows : [1],
                daysOfMonth: doms.length > 0 ? doms : [1],
                intervalHours: Math.min(72, Math.max(1, Number(item?.intervalHours || 2))),
                intervalMinutes: Math.min(720, Math.max(5, Number(item?.intervalMinutes || 30))),
                completedAt: null
              };
            });

          const tzShort = resolveTimezoneInfo(resolvedTz).shortLabel;
          const summary = `${mappedSchedules.map(formatSingleRuleHuman).join(' · ')} (${tzShort})`;
          return { timezone: resolvedTz, schedules: mappedSchedules, summary };
        }
      }
    } catch (err: any) {
      console.warn('[AI Schedule Parser] ProTalk fallback:', err?.message);
    }
  }

  const fb = fallbackParseScheduleFromRussianText(cleanPrompt, baseTz);
  const tzShort = resolveTimezoneInfo(fb.timezone).shortLabel;
  return {
    timezone: fb.timezone,
    schedules: fb.schedules,
    summary: `${fb.schedules.map(formatSingleRuleHuman).join(' · ')} (${tzShort})`
  };
}
