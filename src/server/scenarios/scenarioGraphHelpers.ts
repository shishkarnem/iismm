import { DB, getDefaultChannelIdentifier } from '../db';
import { prepareRichMarkdown } from '../telegramRich';
import { normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';
import { enforceParagraphsAndRichBlocks } from '../formatting/textParagraphFormatter';
import { sendPromptToTelegram } from '../telegram';
import {
  resolveImageNodeFnMode,
  executeRichPartVisualNode
} from './runners/scenarioVisualRunner';
import {
  ScenarioConditionRule,
  ScenarioPublishTimingMode,
  ScenarioRichPart
} from '../../types';
import { syncPublishedPostToPlatformBlog } from '../social/blogFeedSyncHelper';
import { getPricingConfigFromDb } from '../pricing/pricingService';
import { getZonedPartsInTimezone, parseScheduleDateTimeInTimezone } from '../domains/posts/postStatusHelpers';
import { applyScenarioTemplateVariables, buildScenarioMacroContext } from './scenarioAiHelpers';

export { resolveImageNodeFnMode, executeRichPartVisualNode };

export function isVisualGeneratorNodeType(nodeType: string): boolean {
  return (
    nodeType === 'ai_generate_image' ||
    nodeType === 'ai_generate_image_with_text' ||
    nodeType === 'ai_generate_image_free' ||
    nodeType === 'ai_generate_image_no_text' ||
    nodeType === 'rich_part_image' ||
    nodeType === 'rich_part_slideshow' ||
    nodeType === 'rich_part_collage'
  );
}

export function computeSingleNodeExecutionCost(
  nodeType: string,
  config: any,
  settings: any,
  activePartsCount = 1
): number {
  const pricing = getPricingConfigFromDb();
  const cost621 = Number(settings?.costImage621Iirky ?? settings?.costImageNoTextIirky ?? pricing.imageModels.func_621);
  const cost784 = Number(settings?.costImage784Iirky ?? settings?.costImageWithTextIirky ?? pricing.imageModels.func_784);
  const cost787 = Number(settings?.costImage787Iirky ?? pricing.imageModels.func_787);
  const cost791 = Number(settings?.costImage791Iirky ?? pricing.imageModels.func_791);
  const getUnitCost = (fnMode: string) =>
    fnMode === 'func_791'
      ? cost791
      : fnMode === 'func_784'
      ? cost784
      : fnMode === 'func_621'
      ? cost621
      : cost787;

  if (nodeType === 'ai_rewrite' || nodeType === 'publish_crosspost') return 0;
  if (nodeType === 'ai_generate_topic') return pricing.scenarioAi.topicArchive;
  if (nodeType === 'ai_generate_topic_fast') return pricing.scenarioAi.topicFast;
  if (nodeType === 'ai_generate_text') return pricing.scenarioAi.textGeneration;
  if (nodeType === 'format_beauty_post') {
    if (config?.messageFormat === 'v2' || config?.formattingEngine === 'smart_rules') return 0;
    return pricing.textAi.beautyPostAi;
  }

  if (nodeType === 'ai_generate_image_prompt') {
    const perPrompt = pricing.scenarioAi.imagePromptPerItem;
    const isPerPart =
      config?.promptSourceMode !== 'whole_post' &&
      (config?.promptSourceMode === 'per_part' ||
        config?.promptSourceMode === 'each_rich_part' ||
        config?.handoffMode === 'parts_stream' ||
        activePartsCount > 1);
    if (isPerPart) {
      return perPrompt * Math.min(10, Math.max(1, Number(activePartsCount || config?.partsCount || 1)));
    }
    return perPrompt;
  }

  if (nodeType === 'rich_split_parts') {
    return config?.splitMode === 'headings_paragraphs' ? 0 : pricing.scenarioAi.richSplitAi;
  }

  if (nodeType === 'format_inline_buttons') {
    return config?.buttonsMode === 'ai_from_post' ? pricing.textAi.inlineButtons : 0;
  }

  if (
    nodeType === 'rich_part_image' ||
    nodeType === 'rich_part_slideshow' ||
    nodeType === 'rich_part_collage'
  ) {
    const fnMode = resolveImageNodeFnMode(nodeType, config);
    const unitCost = getUnitCost(fnMode);
    const perPartImages =
      nodeType === 'rich_part_image'
        ? 1
        : Math.min(10, Math.max(2, Number(config?.slidesPerPart || config?.imageCount || 3)));
    const isSelectedMode =
      config?.applyToParts === 'selected' || config?.partTargetMode === 'selected';
    const targetedParts =
      isSelectedMode && Array.isArray(config?.selectedPartNumbers)
        ? Math.max(1, config.selectedPartNumbers.length)
        : Math.max(1, activePartsCount);
    return unitCost * perPartImages * targetedParts;
  }

  if (isVisualGeneratorNodeType(nodeType)) {
    const fnMode = resolveImageNodeFnMode(nodeType, config);
    const imgCount = Math.min(10, Math.max(1, Number(config?.imageCount || 1)));
    const unitCost = getUnitCost(fnMode);
    return unitCost * imgCount;
  }

  return 0;
}

export function collectRecentAuthorHistory(cleanUserId: string, daysLimit: number = 30): string[] {
  const safeDays = Math.min(365, Math.max(1, Number(daysLimit || 30)));
  const cutoffDate = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const authorPubs = DB.getPublications(cleanUserId);
  const authorDrafts = DB.getDayRequests(cleanUserId);
  const historyTitles: string[] = [];
  (authorPubs || []).forEach((p) => {
    const d = new Date(p.publishedAt || p.scheduledFor || 0);
    if (isNaN(d.getTime()) || d >= cutoffDate) {
      if (p.promptTitle && p.promptTitle.trim()) historyTitles.push(p.promptTitle.trim());
    }
  });
  (authorDrafts || []).forEach((d) => {
    const dt = new Date((d as any).createdAt || (d as any).scheduledAt || (d as any).updatedAt || 0);
    if (isNaN(dt.getTime()) || dt >= cutoffDate) {
      if (d.title && d.title.trim()) historyTitles.push(d.title.trim());
    }
  });
  return Array.from(new Set(historyTitles)).slice(0, 50);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatZonedDateTimeLocalInput(date: Date, timeZone: string = 'Europe/Moscow'): string {
  const z = getZonedPartsInTimezone(date, timeZone || 'Europe/Moscow');
  return `${z.year}-${pad2(z.month)}-${pad2(z.day)}T${pad2(z.hours)}:${pad2(z.minutes)}`;
}

function formatRuInTz(date: Date, timeZone: string = 'Europe/Moscow'): string {
  return date.toLocaleString('ru-RU', { timeZone: timeZone || 'Europe/Moscow' });
}

/**
 * Вычисляет целевое время отложенной публикации относительно старта сценария T_start,
 * гарантируя T_pub >= T_start в указанном часовом поясе.
 */
export function computeDynamicPublishSchedule(
  config: Record<string, any>,
  runStartedAt?: Date | string,
  timeZone: string = 'Europe/Moscow'
): {
  mode: ScenarioPublishTimingMode;
  scheduledForIso?: string;
  adjustedReason?: string;
  humanSummary: string;
} {
  const tz = String(timeZone || config?.timezone || 'Europe/Moscow').trim() || 'Europe/Moscow';
  const mode: ScenarioPublishTimingMode = config?.publishTimingMode || 'immediate';
  const parsedStart =
    runStartedAt instanceof Date
      ? runStartedAt
      : runStartedAt
      ? new Date(runStartedAt)
      : new Date();
  const safeStartDate = Number.isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
  const startMs = safeStartDate.getTime();

  if (mode === 'draft_only') {
    return {
      mode,
      humanSummary: 'Только сохранение в черновики (ручная публикация автором)'
    };
  }

  if (mode === 'immediate') {
    return {
      mode,
      scheduledForIso: safeStartDate.toISOString(),
      humanSummary: 'Сохранение в черновики и мгновенная публикация'
    };
  }

  if (mode === 'delay_after_start') {
    const addHours = Math.max(0, Number(config?.delayHours ?? config?.publishDelayHours ?? 2));
    const addMinutes = Math.max(0, Number(config?.delayMinutesAfterStart ?? config?.publishDelayMinutes ?? 0));
    const totalMs = Math.max(60 * 1000, (addHours * 60 + addMinutes) * 60 * 1000);
    const target = new Date(startMs + totalMs);
    return {
      mode,
      scheduledForIso: target.toISOString(),
      humanSummary: `Через ${addHours > 0 ? `${addHours} ч. ` : ''}${addMinutes} мин. после старта (${formatRuInTz(target, tz)})`
    };
  }

  const zonedNow = getZonedPartsInTimezone(safeStartDate, tz);

  if (mode === 'same_day_time') {
    const rawTime = String(config?.publishTimeOfDay || config?.publishExactTime || '14:00').trim();
    const [hh, mm] = rawTime.split(':').map((n) => parseInt(n, 10));
    const h = Number.isNaN(hh) ? 14 : hh;
    const m = Number.isNaN(mm) ? 0 : mm;
    let candidate = parseScheduleDateTimeInTimezone(
      `${zonedNow.year}-${pad2(zonedNow.month)}-${pad2(zonedNow.day)}T${pad2(h)}:${pad2(m)}`,
      tz
    ) || new Date(safeStartDate);

    let adjustedReason: string | undefined;
    if (candidate.getTime() < startMs) {
      const fallback = config?.sameDayFallback || config?.publishLateFallback || 'plus_15m';
      if (fallback === 'plus_15m') {
        candidate = new Date(startMs + 15 * 60 * 1000);
        adjustedReason = 'Время дня уже прошло на момент старта — сдвинуто на +15 минут от старта';
      } else {
        const nextCal = new Date(Date.UTC(zonedNow.year, zonedNow.month - 1, zonedNow.day + 1));
        candidate = parseScheduleDateTimeInTimezone(
          `${nextCal.getUTCFullYear()}-${pad2(nextCal.getUTCMonth() + 1)}-${pad2(nextCal.getUTCDate())}T${pad2(h)}:${pad2(m)}`,
          tz
        ) || new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
        adjustedReason = 'Время дня уже прошло на момент старта — перенесено на следующий день';
      }
    }

    return {
      mode,
      scheduledForIso: candidate.toISOString(),
      adjustedReason,
      humanSummary: `В ${rawTime} (${formatRuInTz(candidate, tz)})`
    };
  }

  // offset_days_time
  const offsetDays = Math.min(30, Math.max(1, Number(config?.offsetDays ?? config?.publishOffsetDays ?? 1)));
  const rawTime = String(config?.publishTimeOfDay || config?.publishExactTime || '12:00').trim();
  const [hh, mm] = rawTime.split(':').map((n) => parseInt(n, 10));
  const targetCal = new Date(Date.UTC(zonedNow.year, zonedNow.month - 1, zonedNow.day + offsetDays));
  let candidate = parseScheduleDateTimeInTimezone(
    `${targetCal.getUTCFullYear()}-${pad2(targetCal.getUTCMonth() + 1)}-${pad2(targetCal.getUTCDate())}T${pad2(Number.isNaN(hh) ? 12 : hh)}:${pad2(Number.isNaN(mm) ? 0 : mm)}`,
    tz
  ) || new Date(startMs + offsetDays * 24 * 60 * 60 * 1000);
  if (candidate.getTime() < startMs) {
    candidate = new Date(startMs + 60 * 1000);
  }

  return {
    mode: 'offset_days_time',
    scheduledForIso: candidate.toISOString(),
    humanSummary: `Через ${offsetDays} дн. в ${rawTime} (${formatRuInTz(candidate, tz)})`
  };
}

/**
 * Собирает части Rich-сообщения (1..10) со встроенными картинками, слайдерами и коллажами в единый Rich Markdown
 */
export function assembleRichPartsIntoMessage(params: {
  title?: string;
  parts: ScenarioRichPart[];
  fallbackText?: string;
  includeTitle?: boolean;
  includePartHeadings?: boolean;
  headingLevel?: 'h1' | 'h2' | 'h3';
  separator?: 'blank_line' | 'blank' | 'divider' | 'line' | 'space' | 'none';
  signature?: string;
  attachSignature?: boolean;
  coverUrl?: string;
}): string {
  const { parts } = params;
  const isCompactSep = params.separator === 'none' || params.separator === 'space';

  if (!Array.isArray(parts) || parts.length === 0) {
    let base = params.fallbackText || '';
    if (params.includeTitle && params.title && !base.startsWith('#')) {
      base = `# ${params.title.trim()}\n\n${base}`.trim();
    }
    if (params.attachSignature && params.signature?.trim()) {
      base = `${base}\n\n${params.signature.trim()}`.trim();
    }
    return prepareRichMarkdown(base, {
      attachmentUrl: params.coverUrl,
      preserveCompactSpacing: isCompactSep
    }).slice(0, 32000);
  }

  const hPrefix =
    params.headingLevel === 'h1' ? '#' : params.headingLevel === 'h3' ? '###' : '##';
  const blocks: string[] = [];

  if (params.includeTitle !== false && params.title?.trim()) {
    blocks.push(`# ${params.title.trim().replace(/^#+\s*/, '')}`);
  }

  const buildVisualTag = (part: ScenarioRichPart): string => {
    const urls = (part.imageUrls || [])
      .map((u) => normalizeProTalkMediaUrl(String(u || '').trim()))
      .filter(Boolean);
    if (urls.length === 0 || part.visualType === 'none') return '';
    if (part.visualType === 'slideshow' && urls.length >= 2) {
      return `<tg-slideshow>\n${urls.map((u) => `![](${u})`).join('\n')}\n</tg-slideshow>`;
    }
    if (part.visualType === 'collage' && urls.length >= 2) {
      return `<tg-collage>\n${urls.map((u) => `![](${u})`).join('\n')}\n</tg-collage>`;
    }
    return `![](${urls[0]})`;
  };

  const allowHeadings = params.includePartHeadings !== false;

  parts.forEach((part) => {
    const cleanHeadingText = part.heading?.trim()
      ? part.heading.trim().replace(/^#+\s*/, '')
      : '';
    const headingLine = allowHeadings && cleanHeadingText ? `${hPrefix} ${cleanHeadingText}` : '';
    const visualBlock = buildVisualTag(part);
    let bodyText = String(part.text || '').trim();

    if (!allowHeadings) {
      bodyText = bodyText.replace(/^#{1,4}\s+[^\n]+\n*/gm, '').trim();
    } else if (cleanHeadingText) {
      const escaped = cleanHeadingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      bodyText = bodyText
        .replace(new RegExp(`^(?:#{1,4}\\s+|\\*\\*)?${escaped}(?:\\*\\*)?\\s*\\n*`, 'i'), '')
        .trim();
    }

    const pos = part.visualPosition || 'after_heading';
    const sub: string[] = [];
    if (pos === 'before_heading' || pos === 'before_text') {
      if (visualBlock) sub.push(visualBlock);
      if (headingLine) sub.push(headingLine);
      if (bodyText) sub.push(bodyText);
    } else if (pos === 'after_text') {
      if (headingLine) sub.push(headingLine);
      if (bodyText) sub.push(bodyText);
      if (visualBlock) sub.push(visualBlock);
    } else {
      if (headingLine) sub.push(headingLine);
      if (visualBlock) sub.push(visualBlock);
      if (bodyText) sub.push(bodyText);
    }

    const joined = sub.filter(Boolean).join('\n\n');
    if (joined) blocks.push(joined);
  });

  const sep =
    params.separator === 'divider' || params.separator === 'line'
      ? '\n\n---\n\n'
      : isCompactSep
      ? '\n'
      : '\n\n';
  let combined = blocks.join(sep);

  if (params.attachSignature && params.signature?.trim()) {
    combined = `${combined}\n\n${params.signature.trim()}`.trim();
  }

  return prepareRichMarkdown(combined, {
    attachmentUrl: params.coverUrl && !combined.includes(params.coverUrl) ? params.coverUrl : undefined,
    preserveCompactSpacing: isCompactSep
  }).slice(0, 32000);
}

/**
 * Проверка условий блока logic_filter (если / иначе)
 */
export function evaluateLogicFilterNode(
  config: Record<string, any>,
  runningContext: Record<string, any>
): { passed: boolean; branch: 'yes' | 'no'; details: string[] } {
  const rules: ScenarioConditionRule[] =
    Array.isArray(config?.conditionRules) && config.conditionRules.length > 0
      ? config.conditionRules
      : [
          {
            id: 'default_rule',
            field: (config?.filterCondition as any) || 'has_media',
            value: config?.filterValue || 'true'
          }
        ];

  const isOrMode = config?.conditionLogic === 'or' || config?.conditionLogic === 'any';
  const text = String(runningContext.text || '');
  const lowerText = text.toLowerCase();
  const hasEmbeddedRichMedia = /<(?:tg-slideshow|tg-collage)>[\s\S]*?<\/(?:tg-slideshow|tg-collage)>|!\[[^\]]*\]\(https?:\/\/[^\s)]+\)/i.test(
    text
  );
  const hasMedia = Boolean(
    hasEmbeddedRichMedia ||
      runningContext.imageUrl ||
      (Array.isArray(runningContext.imageUrls) && runningContext.imageUrls.length > 0) ||
      (Array.isArray(runningContext.parts) &&
        runningContext.parts.some((p: ScenarioRichPart) => (p.imageUrls || []).length > 0))
  );
  const partsCount = Array.isArray(runningContext.parts) ? runningContext.parts.length : 0;
  const jsDay = new Date().getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  const outcomes: boolean[] = [];
  const details: string[] = [];

  const macroVars = buildScenarioMacroContext(runningContext);
  for (const rule of rules) {
    const val = applyScenarioTemplateVariables(String(rule.value || '').trim(), macroVars).trim();
    let ok = true;
    switch (rule.field) {
      case 'has_media':
      case 'has_image': {
        const expected = val !== 'false';
        ok = expected ? hasMedia : !hasMedia;
        details.push(`Наличие медиа: ${ok ? 'да' : 'нет'}`);
        break;
      }
      case 'no_media': {
        ok = !hasMedia;
        details.push(`Медиа отсутствует: ${ok ? 'да' : 'нет'}`);
        break;
      }
      case 'has_text':
        ok = text.trim().length > 0;
        details.push(`Наличие текста: ${ok ? 'да' : 'нет'}`);
        break;
      case 'text_length_gte':
      case 'text_length_gt': {
        const minLen = Number(val || 300);
        ok = text.length >= minLen;
        details.push(`Длина текста (${text.length}) >= ${minLen}: ${ok ? 'да' : 'нет'}`);
        break;
      }
      case 'text_length_lte':
      case 'text_length_lt': {
        const maxLen = Number(val || 4096);
        ok = text.length <= maxLen;
        details.push(`Длина текста (${text.length}) <= ${maxLen}: ${ok ? 'да' : 'нет'}`);
        break;
      }
      case 'contains_keyword': {
        const keywords = val
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        ok = keywords.length > 0 ? keywords.some((kw) => lowerText.includes(kw)) : true;
        details.push(`Содержит [${keywords.join(', ') || val}]: ${ok ? 'да' : 'нет'}`);
        break;
      }
      case 'not_contains_keyword': {
        const stopWords = val
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        ok = stopWords.length > 0 ? stopWords.every((sw) => !lowerText.includes(sw)) : true;
        details.push(`Не содержит [${stopWords.join(', ') || val}]: ${ok ? 'да' : 'нет'}`);
        break;
      }
      case 'day_of_week_in':
      case 'day_of_week': {
        const allowed = val
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => n >= 1 && n <= 7);
        ok = allowed.length > 0 ? allowed.includes(isoDay) : true;
        details.push(`День недели (${isoDay}) в списке [${allowed.join(', ')}]: ${ok ? 'да' : 'нет'}`);
        break;
      }
      case 'rich_parts_gte':
      case 'parts_count_gte': {
        const minParts = Number(val || 2);
        ok = partsCount >= minParts;
        details.push(`Частей Rich (${partsCount}) >= ${minParts}: ${ok ? 'да' : 'нет'}`);
        break;
      }
      default:
        ok = true;
    }
    outcomes.push(ok);
  }

  const passed = isOrMode ? outcomes.some(Boolean) : outcomes.every(Boolean);

  return {
    passed,
    branch: passed ? 'yes' : 'no',
    details
  };
}

// executeRichPartVisualNode is re-exported from ./runners/scenarioVisualRunner

export function hasV2MediaInScenarioChain(
  nodes?: any[],
  runningContext?: Record<string, any>
): { hasMedia: boolean; signatureReserve: number } {
  const activeNodes = Array.isArray(nodes) ? nodes.filter((n) => n && n.enabled !== false) : [];
  const hasNodeMedia = activeNodes.some((n) => {
    if (isVisualGeneratorNodeType(n.type)) return true;
    if (n.type === 'v2_media_attachment' || n.type === 'format_media') {
      const kind = String(n.config?.v2AttachmentKind || n.config?.mediaType || 'photo');
      return kind !== 'none' && kind !== 'video_note';
    }
    return false;
  });
  const hasCtxMedia = Boolean(
    runningContext?.imageUrl ||
      (Array.isArray(runningContext?.imageUrls) && runningContext!.imageUrls.length > 0) ||
      (Array.isArray(runningContext?.attachmentUrls) && runningContext!.attachmentUrls.length > 0) ||
      (runningContext?.attachmentType && !['none', 'video_note'].includes(runningContext.attachmentType))
  );
  const sigNode = activeNodes.find((n) => n.type === 'format_signature');
  const pubNode = activeNodes.find((n) => n.type === 'publish_post' || n.type === 'publish_telegram');
  const sigText = String(sigNode?.config?.signature || pubNode?.config?.signature || runningContext?.signature || '').trim();
  return { hasMedia: hasNodeMedia || hasCtxMedia, signatureReserve: sigText ? Math.min(250, sigText.length + 4) : 0 };
}

export function clampV2MediaCaptionText(rawText: string, maxCharsLimit = 1024): string {
  const clean = String(rawText || '').trim();
  const stripForCount = (s: string) => s.replace(/<[^>]+>/g, '');
  if (clean.length <= maxCharsLimit && stripForCount(clean).length <= maxCharsLimit) return clean;

  const computeClosingSuffix = (fragment: string): string => {
    const stack: string[] = [];
    const tokenRe =
      /<\/?(b|strong|i|em|u|ins|s|strike|del|code|pre|blockquote|tg-spoiler|a)(?:\s+[^>]*)?>/gi;
    let tm: RegExpExecArray | null;
    while ((tm = tokenRe.exec(fragment)) !== null) {
      const full = tm[0];
      const tag = tm[1].toLowerCase();
      if (full.startsWith('</')) {
        const idx = stack.lastIndexOf(tag);
        if (idx !== -1) stack.splice(idx, 1);
      } else if (!full.endsWith('/>')) {
        stack.push(tag);
      }
    }
    let suffix = '';
    for (let k = stack.length - 1; k >= 0; k--) {
      suffix += `</${stack[k]}>`;
    }
    const countToken = (str: string, re: RegExp) => (str.match(re) || []).length;
    if (countToken(fragment, /\|\|/g) % 2 !== 0) suffix += '||';
    const hasUnclosedFence = countToken(fragment, /```/g) % 2 !== 0;
    const withoutFences = fragment.replace(/```[\s\S]*?```/g, '');
    const cleanedSingleScope = hasUnclosedFence
      ? withoutFences.replace(/```[\s\S]*$/, '')
      : withoutFences;
    if (countToken(cleanedSingleScope, /`/g) % 2 !== 0) suffix += '`';
    if (hasUnclosedFence) suffix += '\n```';
    return suffix;
  };

  // Preserve footer block separated by 🔻🔻🔻 if it fits within budget
  const footerMatch = clean.match(/\r?\n*((?:🔻){3,}[\s\S]+)$/u);
  const footerBlock = footerMatch?.[1]?.trim() || '';
  const footerStartIdx = footerMatch?.index ?? -1;
  if (
    footerBlock &&
    footerStartIdx > 120 &&
    footerBlock.length + 140 <= maxCharsLimit &&
    stripForCount(footerBlock).length + 140 <= maxCharsLimit
  ) {
    const headRaw = clean.slice(0, footerStartIdx).trim();
    const headBudget = maxCharsLimit - footerBlock.length - 4;
    const clampedHead = clampV2MediaCaptionText(headRaw, headBudget);
    const combined = `${clampedHead}\n\n${footerBlock}`;
    if (combined.length <= maxCharsLimit && stripForCount(combined).length <= maxCharsLimit) {
      return combined;
    }
  }

  let budget = Math.max(80, maxCharsLimit - 24);
  for (let pass = 0; pass < 4; pass++) {
    let slice = clean.slice(0, budget);
    const lastLt = slice.lastIndexOf('<');
    const lastGt = slice.lastIndexOf('>');
    if (lastLt > lastGt) {
      slice = slice.slice(0, lastLt);
    }
    const boundary = Math.max(
      slice.lastIndexOf('\n\n'),
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('\n'),
      slice.lastIndexOf(' ')
    );
    const body = (boundary > Math.floor(budget * 0.55) ? slice.slice(0, boundary) : slice).trim();
    const closingSuffix = computeClosingSuffix(body);
    const endsInsideCodeFence = (body.match(/```/g) || []).length % 2 !== 0;
    const candidate = endsInsideCodeFence
      ? `${body}…${closingSuffix}`
      : `${body}…${closingSuffix}`;
    if (candidate.length <= maxCharsLimit && stripForCount(candidate).length <= maxCharsLimit) {
      return candidate;
    }
    const overshoot = Math.max(candidate.length, stripForCount(candidate).length) - maxCharsLimit;
    budget = Math.max(60, body.length - overshoot - 8);
  }

  return stripForCount(clean).slice(0, Math.max(60, maxCharsLimit - 1)).trim() + '…';
}

export async function executePublishPostNode(params: {
  nodeType: string;
  config: Record<string, any>;
  runningContext: Record<string, any>;
  cleanUserId: string;
  isTestRun: boolean;
  allowLivePublishInTest?: boolean;
  runStartedAt: Date;
  scenarioMeta?: { id?: string; name?: string; category?: string; targetChannels?: string[]; messageFormat?: 'v2' | 'rich' };
}): Promise<{ output: Record<string, any>; message: string; actualCost: number }> {
  const { nodeType, config, runningContext, cleanUserId, isTestRun, allowLivePublishInTest, runStartedAt, scenarioMeta } = params;
  const effectiveConfig = { ...config };
  if (nodeType === 'save_draft' && !effectiveConfig.publishTimingMode) effectiveConfig.publishTimingMode = 'draft_only';
  else if (nodeType === 'publish_telegram' && !effectiveConfig.publishTimingMode) effectiveConfig.publishTimingMode = 'immediate';

  const upstreamDelayMins = Number(runningContext.extraDelayMinutes) || 0;
  if (upstreamDelayMins > 0) {
    if (effectiveConfig.publishTimingMode === 'delay_after_start') {
      effectiveConfig.delayMinutesAfterStart =
        (Number(effectiveConfig.delayMinutesAfterStart ?? effectiveConfig.publishDelayMinutes ?? 0) || 0) + upstreamDelayMins;
    } else if (effectiveConfig.publishTimingMode === 'immediate' && effectiveConfig.applyUpstreamDelay === true) {
      effectiveConfig.publishTimingMode = 'delay_after_start';
      effectiveConfig.delayHours = 0;
      effectiveConfig.delayMinutesAfterStart = upstreamDelayMins;
    }
  }

  const defaultChan = getDefaultChannelIdentifier();
  const explicitEmptyDraft =
    effectiveConfig.publishTimingMode === 'draft_only' &&
    Array.isArray(effectiveConfig.channels) &&
    effectiveConfig.channels.length === 0 &&
    !effectiveConfig.channelId;

  const targetChannels: string[] = explicitEmptyDraft
    ? []
    : Array.isArray(effectiveConfig.channels) && effectiveConfig.channels.length > 0
    ? effectiveConfig.channels
    : effectiveConfig.channelId
    ? [effectiveConfig.channelId]
    : Array.isArray(scenarioMeta?.targetChannels) && scenarioMeta!.targetChannels!.length > 0
    ? scenarioMeta!.targetChannels!
    : [defaultChan];

  const activeFormat: 'v2' | 'rich' =
    (effectiveConfig.messageFormat ||
      runningContext.messageFormat ||
      scenarioMeta?.messageFormat ||
      'v2') === 'rich'
      ? 'rich'
      : 'v2';

  let finalPostText = enforceParagraphsAndRichBlocks(
    String(runningContext.text || '').trim(),
    activeFormat
  );
  if (
    activeFormat === 'rich' &&
    Array.isArray(runningContext.parts) &&
    runningContext.parts.length > 0 &&
    !runningContext.richAssembled
  ) {
    const hasPartImages = runningContext.parts.some(
      (p: any) => Array.isArray(p?.imageUrls) && p.imageUrls.length > 0
    );
    finalPostText = assembleRichPartsIntoMessage({
      title: runningContext.title || runningContext.topic,
      parts: runningContext.parts,
      fallbackText: finalPostText,
      includeTitle: true,
      includePartHeadings: runningContext.keepPartHeadings !== false,
      signature: effectiveConfig.signature || runningContext.signature || '',
      attachSignature: false,
      coverUrl: !hasPartImages && runningContext.imageUrl ? String(runningContext.imageUrl).trim() : undefined
    });
    runningContext.text = finalPostText;
  } else if (
    activeFormat === 'rich' &&
    Array.isArray(runningContext.imageUrls) &&
    runningContext.imageUrls.length > 1
  ) {
    const richTag = runningContext.mediaType === 'collage' ? 'tg-collage' : 'tg-slideshow';
    const hasAnyMultiRichTag = /<(?:tg-slideshow|tg-collage)>[\s\S]*?<\/(?:tg-slideshow|tg-collage)>/i.test(
      finalPostText
    );
    if (!hasAnyMultiRichTag) {
      const normalizedImgs = runningContext.imageUrls
        .map((u: string) => normalizeProTalkMediaUrl(String(u || '').trim()))
        .filter(Boolean);
      if (normalizedImgs.length >= 2) {
        const tagBlock = `<${richTag}>\n${normalizedImgs
          .map((u: string) => `![](${u})`)
          .join('\n')}\n</${richTag}>`;
        finalPostText = `${tagBlock}\n\n${finalPostText}`.trim();
        runningContext.text = finalPostText;
      }
    }
  }

  const finalTitle =
    runningContext.title || runningContext.topic || scenarioMeta?.name || 'Пост из сценария';
  if (!finalPostText) {
    finalPostText = String(runningContext.topic || runningContext.title || '').trim();
  }
  const v2FilesUrls: string[] = Array.isArray(runningContext.v2Files)
    ? runningContext.v2Files.map((f: any) => String(f?.url || '').trim()).filter(Boolean)
    : [];
  const rawUrls: string[] =
    Array.isArray(runningContext.imageUrls) && runningContext.imageUrls.filter(Boolean).length > 0
      ? runningContext.imageUrls.filter(Boolean)
      : Array.isArray(runningContext.attachmentUrls) &&
        runningContext.attachmentUrls.filter(Boolean).length > 0
      ? runningContext.attachmentUrls.filter(Boolean)
      : v2FilesUrls.length > 0
      ? v2FilesUrls
      : runningContext.imageUrl
      ? [runningContext.imageUrl]
      : [];
  const finalUrls = Array.from(
    new Set(
      rawUrls
        .map((u) =>
          activeFormat === 'rich' ? normalizeProTalkMediaUrl(String(u || '').trim()) : String(u || '').trim()
        )
        .filter(Boolean)
    )
  );

  const hasEmbeddedRichMediaInBody =
    activeFormat === 'rich' &&
    /<(?:tg-slideshow|tg-collage)>[\s\S]*?<\/(?:tg-slideshow|tg-collage)>|!\[[^\]]*\]\(https?:\/\/[^\s)]+\)/i.test(
      finalPostText
    );
  const firstNormalizedRichUrl = finalUrls[0] || '';

  const finalAttachmentType =
    activeFormat === 'rich'
      ? finalUrls.length === 1 &&
        !hasEmbeddedRichMediaInBody &&
        !finalPostText.includes(firstNormalizedRichUrl)
        ? 'photo'
        : 'none'
      : runningContext.attachmentType ||
        (finalUrls.length > 1 ? 'album' : finalUrls[0] ? 'photo' : 'none');

  const pubMacroVars = buildScenarioMacroContext(runningContext, {}, {
    channels: targetChannels.join(', '),
    channel: targetChannels[0] || ''
  });
  const sigStr = applyScenarioTemplateVariables(
    String(effectiveConfig.signature || runningContext.signature || '').trim(),
    pubMacroVars
  ).trim();
  const inlineBtnsList = Array.isArray(runningContext.inlineButtons)
    ? runningContext.inlineButtons
    : [];
  const totalInlineBtnsCount = inlineBtnsList.reduce(
    (acc: number, row: any) => acc + (Array.isArray(row) ? row.length : 0),
    0
  );
  const isMediaCaption =
    activeFormat === 'v2' &&
    finalAttachmentType !== 'none' &&
    finalAttachmentType !== 'video_note' &&
    finalUrls.length > 0;
  const hardV2Limit = isMediaCaption ? 1024 : 4096;
  const sigExtra = sigStr && !finalPostText.includes(sigStr) ? sigStr.length + 2 : 0;
  const maxBodyChars = Math.max(120, hardV2Limit - sigExtra);

  if (activeFormat === 'v2' && finalPostText) {
    finalPostText = clampV2MediaCaptionText(finalPostText, maxBodyChars);
    runningContext.text = finalPostText;
  }

  const buttonsAttachedToPost = !(
    activeFormat === 'v2' &&
    (finalAttachmentType === 'album' || finalAttachmentType === 'video_note')
  );
  const systemicAssembly = {
    format: activeFormat,
    hasMedia: finalUrls.length > 0 && finalAttachmentType !== 'none',
    attachmentType: finalAttachmentType,
    mediaCount: finalUrls.length,
    charLimitApplied: activeFormat === 'v2' ? hardV2Limit : 32000,
    textLength: finalPostText.length,
    signatureLength: sigStr.length,
    buttonsCount: totalInlineBtnsCount,
    buttonsAttached: buttonsAttachedToPost && totalInlineBtnsCount > 0
  };

  const effectiveCoverUrlForRichOrV2 =
    activeFormat === 'rich' ? (finalAttachmentType === 'photo' ? firstNormalizedRichUrl : '') : finalUrls[0] || '';
  const effectiveTimezone = String(effectiveConfig.timezone || 'Europe/Moscow').trim() || 'Europe/Moscow';
  const scheduleCalc = computeDynamicPublishSchedule(effectiveConfig, runStartedAt, effectiveTimezone);
  const shouldPublishImmediately = scheduleCalc.mode === 'immediate' || (isTestRun && Boolean(allowLivePublishInTest));

  if (isTestRun && !allowLivePublishInTest && nodeType !== 'save_draft') {
    return {
      output: {
        readyToPublish: true, publishTimingMode: scheduleCalc.mode, scheduledFor: scheduleCalc.scheduledForIso,
        timingSummary: scheduleCalc.humanSummary, scheduleSummary: scheduleCalc.humanSummary, adjustedReason: scheduleCalc.adjustedReason,
        channels: targetChannels, channel: targetChannels.join(', '), title: finalTitle, text: finalPostText,
        messageFormat: activeFormat, attachmentType: finalAttachmentType, audioTitle: runningContext.audioTitle || '',
        audioPerformer: runningContext.audioPerformer || '', protectContent: Boolean(runningContext.protectContent),
        imageUrl: finalUrls[0] || '', imageUrls: finalUrls, inlineButtons: inlineBtnsList,
        systemicAssembly
      },
      message: `Системная сборка (${finalPostText.length} симв., медиа: ${finalUrls.length}, кнопок: ${totalInlineBtnsCount}) и проверка: ${scheduleCalc.humanSummary} -> ${targetChannels.join(', ')}`,
      actualCost: 0
    };
  }

  const isDelayedScheduled = !shouldPublishImmediately && scheduleCalc.mode !== 'draft_only' && Boolean(scheduleCalc.scheduledForIso);
  const postTriggerSchedule = isDelayedScheduled
    ? {
        enabled: true, frequency: 'once',
        exactDateTime: scheduleCalc.scheduledForIso ? formatZonedDateTimeLocalInput(new Date(scheduleCalc.scheduledForIso), effectiveTimezone) : undefined,
        timezone: effectiveTimezone, notifyUser: true, publishToSocialFeed: effectiveConfig.publishToSocialFeed !== false
      }
    : { enabled: false, publishToSocialFeed: effectiveConfig.publishToSocialFeed !== false };

  const initialDraftStatus = isDelayedScheduled ? 'запланирован' : 'создается';

  const draftPayload = {
    title: finalTitle,
    category: scenarioMeta?.category || runningContext.category || 'Сценарии',
    requestTemplate: `Сгенерировано сценарием: ${finalTitle}`,
    postText: finalPostText || finalTitle,
    imagePrompt: runningContext.imagePrompt || '',
    channel: explicitEmptyDraft ? '' : targetChannels[0] || defaultChan,
    channels: targetChannels,
    signature: sigStr,
    linkPreviewEnabled: runningContext.linkPreviewEnabled !== false,
    messageFormat: activeFormat,
    attachmentType: (finalAttachmentType === 'voice' ? 'audio' : finalAttachmentType) as any,
    audioFormat:
      runningContext.audioFormat || (finalAttachmentType === 'voice' ? 'voice' : undefined),
    audioTitle: runningContext.audioTitle || '',
    audioPerformer: runningContext.audioPerformer || '',
    protectContent: Boolean(runningContext.protectContent),
    attachmentUrl: effectiveCoverUrlForRichOrV2,
    attachmentUrls: finalUrls,
    albumUrls: finalUrls,
    inlineButtons: runningContext.inlineButtons || [],
    triggerSchedule: postTriggerSchedule,
    scheduledTime: scheduleCalc.scheduledForIso,
    publishToSocialFeed: effectiveConfig.publishToSocialFeed !== false,
    status: initialDraftStatus,
    userId: cleanUserId
  };

  const existingDraft = runningContext.draftId
    ? DB.getDayRequestById(String(runningContext.draftId))
    : undefined;
  const draftObj = existingDraft
    ? await DB.updateDayRequestAsync(existingDraft.id, draftPayload)
    : await DB.addDayRequestAsync(draftPayload);

  runningContext.draftId = draftObj.id;
  runningContext.targetChannels = targetChannels;

  if (scheduleCalc.mode === 'draft_only') {
    return {
      output: {
        draftId: draftObj.id,
        published: false,
        scheduled: false,
        savedDraft: true,
        publishTimingMode: 'draft_only',
        timingSummary: scheduleCalc.humanSummary,
        scheduleSummary: scheduleCalc.humanSummary,
        channels: targetChannels,
        channel: targetChannels.join(', '),
        title: finalTitle,
        text: finalPostText
      },
      message: `Пост сохранен в черновики (${draftObj.id}) для ручной проверки и публикации`,
      actualCost: 0
    };
  }

  if (shouldPublishImmediately) {
    const sendRes = await sendPromptToTelegram(finalTitle, finalPostText || finalTitle, draftObj as any, {
      signature: sigStr,
      messageFormat: activeFormat,
      linkPreviewEnabled: runningContext.linkPreviewEnabled !== false,
      attachmentType: finalAttachmentType as any,
      audioFormat: runningContext.audioFormat,
      audioTitle: runningContext.audioTitle,
      audioPerformer: runningContext.audioPerformer,
      protectContent: Boolean(runningContext.protectContent),
      attachmentUrl: effectiveCoverUrlForRichOrV2,
      attachmentUrls: finalUrls,
      inlineButtons: runningContext.inlineButtons,
      channels: targetChannels,
      telegramId: runningContext.telegramId,
      dedupKey: `scen_live:${draftObj.id}`
    });

    const sentAtIso = new Date().toISOString();
    const fallbackExact = formatZonedDateTimeLocalInput(new Date(sentAtIso), effectiveTimezone);
    const preservedSched: Record<string, any> = existingDraft?.triggerSchedule || {};
    await DB.updateDayRequestAsync(draftObj.id, {
      status: sendRes.ok ? 'опубликован' : 'ошибка',
      publishedAt: sendRes.ok ? sentAtIso : undefined,
      triggerSchedule: {
        ...preservedSched,
        ...postTriggerSchedule,
        enabled: Boolean(preservedSched.enabled || postTriggerSchedule.enabled),
        frequency: preservedSched.frequency || (postTriggerSchedule as any).frequency || 'once',
        exactDateTime: preservedSched.exactDateTime || (postTriggerSchedule as any).exactDateTime || fallbackExact,
        timezone: preservedSched.timezone || (postTriggerSchedule as any).timezone || effectiveTimezone,
        publishToSocialFeed: effectiveConfig.publishToSocialFeed !== false
      }
    });

    DB.addPublication({
      id: draftObj.id,
      userId: cleanUserId,
      promptId: draftObj.id,
      promptTitle: finalTitle,
      category: scenarioMeta?.category || 'Сценарии',
      text: finalPostText,
      channel: targetChannels.join(', '),
      status: sendRes.ok,
      statusType: sendRes.ok ? 'published' : 'failed',
      publishedAt: sentAtIso,
      messageId: sendRes.messageId,
      response: sendRes.ok ? 'Опубликовано сценарием' : sendRes.error || 'Ошибка отправки',
      attachmentType: (finalAttachmentType === 'voice' ? 'audio' : finalAttachmentType) as any,
      audioFormat: runningContext.audioFormat,
      attachmentUrl: effectiveCoverUrlForRichOrV2,
      attachmentUrls: finalUrls,
      inlineButtons: runningContext.inlineButtons,
      messageFormat: activeFormat,
      signature: effectiveConfig.signature || runningContext.signature || '',
      triggerSchedule: {
        enabled: false,
        publishToSocialFeed: effectiveConfig.publishToSocialFeed !== false
      },
      publishToSocialFeed: effectiveConfig.publishToSocialFeed !== false,
      skipPostsTable: true
    });

    let syncedBlogPost: any = null;
    if (sendRes.ok && effectiveConfig.publishToSocialFeed !== false) {
      syncedBlogPost = syncPublishedPostToPlatformBlog({
        sourcePostId: draftObj.id,
        userId: cleanUserId,
        title: finalTitle,
        content: finalPostText || finalTitle,
        attachmentType: finalAttachmentType === 'voice' ? 'audio' : finalAttachmentType,
        attachmentUrl: effectiveCoverUrlForRichOrV2,
        attachmentUrls: finalUrls,
        inlineButtons: runningContext.inlineButtons,
        messageFormat: activeFormat,
        category: scenarioMeta?.category || runningContext.category || 'Сценарии',
        channel: targetChannels[0] || defaultChan,
        prompt: runningContext.topic || finalTitle
      });
    }

    return {
      output: {
        draftId: draftObj.id,
        published: sendRes.ok,
        scheduled: false,
        messageId: sendRes.messageId,
        blogPostSlug: syncedBlogPost?.slug || syncedBlogPost?.id,
        publishError: sendRes.ok ? undefined : sendRes.error || 'Ошибка отправки в Telegram',
        publishTimingMode: 'immediate',
        timingSummary: scheduleCalc.humanSummary,
        channels: targetChannels,
        channel: targetChannels.join(', '),
        title: finalTitle,
        text: finalPostText
      },
      message: sendRes.ok
        ? `Пост сохранен в черновики и сразу опубликован в ${targetChannels.join(', ')} (сообщение #${sendRes.messageId || '1'})`
        : `Пост сохранен в черновики, ошибка отправки: ${sendRes.error}`,
      actualCost: 0
    };
  }

  const scheduledPub = DB.addPublication({
    id: draftObj.id,
    userId: cleanUserId,
    promptId: draftObj.id,
    promptTitle: finalTitle,
    category: scenarioMeta?.category || 'Сценарии',
    text: finalPostText,
    channel: targetChannels.join(', '),
    status: false,
    statusType: 'scheduled',
    scheduledFor: scheduleCalc.scheduledForIso,
    publishedAt: scheduleCalc.scheduledForIso || new Date().toISOString(),
    response: `Ожидает автопубликации (${scheduleCalc.humanSummary}). До этого времени пост можно редактировать в черновиках.`,
    attachmentType: (finalAttachmentType === 'voice' ? 'audio' : finalAttachmentType) as any,
    audioFormat: runningContext.audioFormat,
    attachmentUrl: effectiveCoverUrlForRichOrV2,
    attachmentUrls: finalUrls,
    inlineButtons: runningContext.inlineButtons,
    messageFormat: activeFormat,
    signature: effectiveConfig.signature || runningContext.signature || '',
    triggerSchedule: postTriggerSchedule,
    publishToSocialFeed: effectiveConfig.publishToSocialFeed !== false,
    skipPostsTable: true
  });

  return {
    output: {
      draftId: draftObj.id,
      publicationId: scheduledPub.id,
      published: false,
      scheduled: true,
      publishTimingMode: scheduleCalc.mode,
      scheduledFor: scheduleCalc.scheduledForIso,
      timingSummary: scheduleCalc.humanSummary,
      scheduleSummary: scheduleCalc.humanSummary,
      adjustedReason: scheduleCalc.adjustedReason,
      channels: targetChannels,
      channel: targetChannels.join(', '),
      title: finalTitle,
      text: finalPostText
    },
    message: `Пост сохранен в черновики и поставлен в очередь на публикацию: ${scheduleCalc.humanSummary}`,
    actualCost: 0
  };
}
