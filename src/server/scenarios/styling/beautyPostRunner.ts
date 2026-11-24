import { callProTalkBotApi, removeMarkdownEscaping } from '../../protalk';
import {
  applyScenarioTemplateVariables,
  buildScenarioMacroContext,
  normalizeRichGeneratedMarkdown,
  ScenarioMacroVars
} from '../scenarioAiHelpers';
import { clampV2MediaCaptionText, hasV2MediaInScenarioChain } from '../scenarioGraphHelpers';
import { resolvePostStyleForScenario } from './postStylesDb';
import {
  enforceParagraphsAndRichBlocks,
  repairAiCodeFences,
  sanitizeV2NoMarkdownHeadings
} from '../../formatting/textParagraphFormatter';
import { getPricingConfigFromDb } from '../../pricing/pricingService';
import { resolveBeautyLayoutPreset } from '../../../shared/beautyPostPresets';
import {
  combineSystemAndUserPrompt,
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from '../prompts/scenarioPromptsRepo';

function stripAllCapsWords(text: string): string {
  return String(text || '');
}

function getHeadingPrefix(decor?: string): string {
  switch (decor) {
    case 'pin':
      return '📌 ';
    case 'editorial':
      return '🔹 ';
    case 'clean':
      return '';
    case 'sparkle':
    default:
      return '✨ ';
  }
}

function normalizeComparableHeadingText(input: string): string {
  return String(input || '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`~#>\[\]()]/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buildFormattedTopicHeadingLine(params: {
  topic: string;
  format: 'v2' | 'rich';
  headingDecor?: string;
  headingTemplate?: string;
  macroVars?: ScenarioMacroVars;
}): string {
  const cleanTopic = stripAllCapsWords(
    String(params.topic || '')
      .replace(/^#+\s*/, '')
      .replace(/<\/?(?:b|strong)>/gi, '')
      .trim()
  );
  if (!cleanTopic) return '';

  const tpl = String(params.headingTemplate || '{{topic}}').trim() || '{{topic}}';
  const expanded = applyScenarioTemplateVariables(tpl, {
    ...(params.macroVars || {}),
    topic: cleanTopic,
    title: params.macroVars?.title || cleanTopic
  });
  const filled = stripAllCapsWords(
    (expanded || cleanTopic)
      .replace(/^#+\s*/, '')
      .replace(/<\/?(?:b|strong)>/gi, '')
      .trim()
  ).trim();
  if (!filled) return '';

  const prefix = getHeadingPrefix(params.headingDecor);
  const startsWithEmoji = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(filled);
  const appliedPrefix = startsWithEmoji && prefix ? '' : prefix;

  if (params.format === 'rich') {
    return `# ${appliedPrefix}${filled}`;
  }
  return `<b>${appliedPrefix}${filled}</b>`;
}

function ensureTopicHeadingAtTop(params: {
  bodyText: string;
  topic: string;
  format: 'v2' | 'rich';
  includeTopicHeading: boolean;
  headingDecor?: string;
  headingTemplate?: string;
  macroVars?: ScenarioMacroVars;
  preserveExistingHeading?: boolean;
}): string {
  const body = String(params.bodyText || '').trim();
  const normTopic = normalizeComparableHeadingText(params.topic);
  const lines = body.split('\n');
  const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
  const firstLineMatchesTopic = (() => {
    if (firstNonEmptyIdx < 0 || !normTopic) return false;
    const firstPlain = normalizeComparableHeadingText(lines[firstNonEmptyIdx]);
    return (
      Boolean(firstPlain) &&
      (firstPlain === normTopic ||
        firstPlain.includes(normTopic) ||
        normTopic.includes(firstPlain))
    );
  })();

  if (!params.includeTopicHeading || !params.topic.trim()) {
    if (!params.preserveExistingHeading && firstLineMatchesTopic && firstNonEmptyIdx >= 0) {
      const remaining = lines.slice(firstNonEmptyIdx + 1).join('\n').replace(/^\n+/, '').trim();
      return remaining || body;
    }
    return body;
  }

  const headingLine = buildFormattedTopicHeadingLine({
    topic: params.topic,
    format: params.format,
    headingDecor: params.headingDecor,
    headingTemplate: params.headingTemplate,
    macroVars: params.macroVars
  });
  if (!headingLine) return body;

  const editorialRule =
    params.headingDecor === 'editorial' && params.format === 'v2'
      ? '\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯'
      : '';
  const headingBlock = `${headingLine}${editorialRule}`;

  if (firstNonEmptyIdx >= 0 && firstLineMatchesTopic) {
    let restStart = firstNonEmptyIdx + 1;
    // Also remove immediate editorial rule or second repeated topic line if AI duplicated it
    while (restStart < lines.length) {
      const candidate = lines[restStart].trim();
      if (!candidate || /^[⎯─\-]{5,}$/.test(candidate)) {
        restStart += 1;
        continue;
      }
      const candPlain = normalizeComparableHeadingText(candidate);
      if (
        candPlain &&
        normTopic &&
        (candPlain === normTopic || candPlain.includes(normTopic))
      ) {
        restStart += 1;
        continue;
      }
      break;
    }
    const afterHeading = lines.slice(restStart).join('\n').replace(/^\n+/, '').trim();
    return afterHeading ? `${headingBlock}\n\n${afterHeading}` : headingBlock;
  }

  return body ? `${headingBlock}\n\n${body}` : headingBlock;
}

function wrapMetricsWithCodeHtml(text: string): string {
  if (!text || text.includes('<code>')) return text;
  return text.replace(
    /(?<![A-Za-zА-Яа-яЁё0-9_/])(\d+(?:[.,]\d+)?\s*(?:%|сек\.?|мин\.?|ч\.?|час(?:а|ов)?|дн\.?|симв\.?|шт\.?|₽|\$|€))/gi,
    '<code>$1</code>'
  );
}

function buildSmartRulesFormattedText(params: {
  rawText: string;
  topic: string;
  format: 'v2' | 'rich';
  config: Record<string, any>;
  macroVars?: ScenarioMacroVars;
}): string {
  const { rawText, topic, format, config, macroVars } = params;
  const cleaned = stripAllCapsWords(enforceParagraphsAndRichBlocks(rawText || '', format)).trim();
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  let bodyOut = cleaned;

  if (format === 'v2') {
    const presetId = String(config.v2LayoutPreset || 'magazine_v2');
    const useBold = config.v2UseBoldAccents !== false;
    const useItalicLead = config.v2UseItalicLead !== false;
    const useMonospace = config.v2UseMonospace !== false;
    const useQuote = config.v2UseBlockquote !== false;
    const useBullets = config.v2UseEmojiBullets !== false;
    const formatExampleV2 = String(config.formatExampleV2 || config.formatExample || '');
    const useSpoiler = Boolean(
      config.v2UseSpoiler ||
        presetId === 'concise_digest_v2' ||
        /<tg-spoiler>|\|\|/.test(formatExampleV2)
    );
    const bulletMarker =
      presetId === 'expert_cards_v2' ? '📌 ' : presetId === 'concise_digest_v2' ? '⚡ ' : '🔹 ';

    const formattedBlocks = paragraphs.map((para, idx) => {
      let current = para
        .replace(/^\*\*([^*]+)\*\*$/, useBold ? '<b>$1</b>' : '$1')
        .replace(/\*\*([^*]+)\*\*/g, useBold ? '<b>$1</b>' : '$1');

      if (!useBold) {
        current = current.replace(/<\/?b>/gi, '');
      }

      if (useMonospace) {
        current = wrapMetricsWithCodeHtml(current);
      }

      if (
        idx === 0 &&
        useItalicLead &&
        !current.includes('<i>') &&
        !current.startsWith('<b>') &&
        current.length < 280
      ) {
        return `<i>${current}</i>`;
      }
      if (/^[-•*]\s+/m.test(current)) {
        return current
          .split('\n')
          .map((line) => line.replace(/^[-•*]\s+/, useBullets ? bulletMarker : '• '))
          .join('\n');
      }
      if (
        presetId === 'expert_cards_v2' &&
        useBold &&
        idx > 0 &&
        idx < paragraphs.length - 1 &&
        !current.startsWith('<b>') &&
        !current.startsWith('<blockquote') &&
        current.length > 140
      ) {
        const sentenceSplit = current.match(/^([^.!?]{8,65}[.!?])\s+([\s\S]+)$/);
        if (sentenceSplit) {
          return `<b>${sentenceSplit[1]}</b> ${sentenceSplit[2]}`;
        }
      }
      if (
        idx === paragraphs.length - 1 &&
        paragraphs.length >= 2 &&
        useQuote &&
        !current.includes('<blockquote')
      ) {
        return `<blockquote>${useSpoiler ? '' : '💡 '}${current}</blockquote>`;
      }
      return current;
    });

    if (useSpoiler && formattedBlocks.length >= 2) {
      const lastIdx = formattedBlocks.length - 1;
      if (!formattedBlocks[lastIdx].includes('<tg-spoiler>')) {
        formattedBlocks[lastIdx] = `${formattedBlocks[lastIdx]}\n\n<tg-spoiler>Сохраните пост в закладки, чтобы применить на практике.</tg-spoiler>`;
      }
    }

    bodyOut = sanitizeV2NoMarkdownHeadings(formattedBlocks.join('\n\n'));
  } else {
    const richPresetId = String(config.richLayoutPreset || 'editorial_longread');
    const useSubheadings = config.richUseSubheadings !== false;
    const useBoldItalic = config.richUseBoldItalic !== false;
    const useQuote = config.richUseBlockquote !== false;
    const useChecklist = config.richUseChecklist !== false || richPresetId === 'step_by_step_guide';
    const useDividers = config.richUseDividers !== false;

    const formattedBlocks = paragraphs.map((para, idx) => {
      let current = para;
      if (!useBoldItalic) {
        current = current.replace(/\*\*([^*]+)\*\*/g, '$1');
      }
      if (richPresetId === 'step_by_step_guide' && useSubheadings && idx > 0 && !current.startsWith('#') && current.length > 160) {
        current = `### Шаг ${idx}\n\n${current}`;
      }
      if (useChecklist && /^[-*]\s+(?!\[[ x]\])/m.test(current)) {
        return current
          .split('\n')
          .map((line) => line.replace(/^[-*]\s+/, '- [x] '))
          .join('\n');
      }
      if (
        idx === paragraphs.length - 1 &&
        paragraphs.length >= 3 &&
        useQuote &&
        !current.startsWith('>')
      ) {
        return `> ${current.replace(/\n/g, '\n> ')}`;
      }
      if (
        useSubheadings &&
        richPresetId !== 'step_by_step_guide' &&
        idx > 0 &&
        idx < paragraphs.length - 1 &&
        !current.startsWith('#') &&
        current.length > 220
      ) {
        const firstSentenceMatch = current.match(/^([^.!?]{10,65}[.!?])\s+([\s\S]+)$/);
        if (firstSentenceMatch) {
          const cleanSub = firstSentenceMatch[1].replace(/[.!?]+$/, '').trim();
          return `## ${cleanSub}\n\n${firstSentenceMatch[2].trim()}`;
        }
      }
      return current;
    });

    bodyOut = formattedBlocks.join(useDividers ? '\n\n---\n\n' : '\n\n');
    bodyOut = normalizeRichGeneratedMarkdown(bodyOut);
  }

  return ensureTopicHeadingAtTop({
    bodyText: bodyOut,
    topic,
    format,
    includeTopicHeading: config.includeTopicHeading !== false,
    headingDecor: config.headingDecor || 'sparkle',
    headingTemplate: config.topicHeadingTemplate || '{{topic}}',
    macroVars
  });
}

async function callProTalkBeautyStylist(prompt: string, userId: string): Promise<string> {
  const reply = await callProTalkBotApi(
    prompt,
    undefined,
    undefined,
    `scen_beauty_${userId || 'global'}`
  );
  let cleaned = String(reply || '').trim();
  const wrapperOpen = cleaned.match(/^```(?:markdown|html|md|text)\s*\r?\n/i);
  if (wrapperOpen) {
    cleaned = cleaned.slice(wrapperOpen[0].length).replace(/\r?\n```\s*$/i, '').trim();
  }
  if (!cleaned || cleaned.length <= 20) {
    throw new Error('ИИ-оформитель вернул пустой или слишком короткий ответ при выполнении блока «Красивое оформление поста».');
  }
  return cleaned;
}

export async function buildV2TextStylingContext(params: {
  config: Record<string, any>;
  macroVars: ScenarioMacroVars;
  topic: string;
  cleanUserId: string;
}): Promise<{
  resolvedStyleTitle: string;
  resolvedStylePrompt: string;
  presetTitle: string;
  presetRules: string;
  includeTopicHeading: boolean;
  headingDecor: string;
  topicHeadingTemplate: string;
  headingRule: string;
  formatFlagsRules: string;
  rawFormatExample: string;
  exampleSection: string;
  extraWishes: string;
}> {
  const { config, macroVars, topic, cleanUserId } = params;

  const styleOverrideRaw = applyScenarioTemplateVariables(
    String(config.stylePromptOverride || config.styleDesc || config.stylePrompt || '').trim(),
    macroVars
  ).trim();
  const resolvedStyle = await resolvePostStyleForScenario({
    styleId: config.postStyleId,
    styleTitle: config.postStyle,
    stylePromptOverride: styleOverrideRaw || undefined,
    userId: cleanUserId
  });
  const resolvedStylePrompt = applyScenarioTemplateVariables(
    resolvedStyle.prompt || '',
    macroVars
  ).trim();

  const activePreset = resolveBeautyLayoutPreset('v2', config.v2LayoutPreset);
  const presetRules = activePreset.rules.map((r) => `  * ${r}`).join('\n');

  const includeTopicHeading =
    config.includeTopicHeading !== undefined
      ? Boolean(config.includeTopicHeading)
      : config.richIncludeHeadings !== false;
  const headingDecor = String(config.headingDecor || 'sparkle');
  const topicHeadingTemplate = String(config.topicHeadingTemplate || '{{topic}}');
  const headingLinePreview = buildFormattedTopicHeadingLine({
    topic,
    format: 'v2',
    headingDecor,
    headingTemplate: topicHeadingTemplate,
    macroVars
  });

  const extraWishes = applyScenarioTemplateVariables(
    String(config.customFormatNotes || ''),
    macroVars
  ).trim();

  const rawFormatExampleTpl = removeMarkdownEscaping(
    String(config.formatExampleV2 || config.formatExample || '').trim()
  ).trim();
  const rawFormatExample = rawFormatExampleTpl
    ? applyScenarioTemplateVariables(rawFormatExampleTpl, macroVars).trim()
    : '';

  const headingRule = rawFormatExample
    ? includeTopicHeading
      ? `Соблюдай расположение заголовка в эталонном примере, подставляя сгенерированную тему «${topic}» в верхнюю часть без повторов.`
      : 'Строго НЕ добавляй лишний дублирующий заголовок вверху сверх того, что уже задано в первой строке эталонного примера.'
    : includeTopicHeading
    ? `Первой строкой поставь заголовок со сгенерированной темой ровно так: ${headingLinePreview} (и далее пустая строка \\n\\n). Не повторяй этот заголовок во второй строке!`
    : 'Не добавляй технический заголовок темы в начале — сразу начинай с сильного первого абзаца.';

  const v2Flags: string[] = [
    config.v2UseBoldAccents !== false
      ? 'Выделяй ключевые смыслы и микро-подзаголовки тегом <b>жирный текст</b>.'
      : 'Не используй жирный шрифт <b> в основном тексте (кроме заголовка, если он включен).',
    config.v2UseItalicLead !== false
      ? 'Сделай вовлекающую курсивную подводку через <i>курсив</i>.'
      : 'Не используй курсивный лид <i> в первом абзаце.',
    config.v2UseMonospace !== false
      ? 'Оборачивай цифры, метрики, сервисы, промокоды и термины в <code>текст</code> (а многострочные промпты/коды — в ```Prompt...``` / ```...```).'
      : 'Не добавляй моноширинный тег <code> без необходимости.',
    config.v2UseBlockquote !== false
      ? 'Выдели ключевую мысль или вывод в блок <blockquote>текст цитаты</blockquote>.'
      : 'Не добавляй блок цитаты <blockquote>.',
    config.v2UseSpoiler
      ? 'Добавь интригующую деталь или бонусный совет внутрь <tg-spoiler>скрытый текст</tg-spoiler>.'
      : 'Не добавляй спойлер <tg-spoiler>.',
    config.richIncludeLists === false
      ? 'Не используй списки — подавай текст чистыми абзацами.'
      : config.v2UseEmojiBullets !== false
      ? 'Списки (включая нумерованные 1., 1), 1️⃣ и пункты с 🔹 / •) оформляй аккуратно на отдельных строках.'
      : 'Перечисления и нумерованные списки оформляй строгими маркерами (• или 1. / 1)) без лишних декоративных эмодзи.'
  ];

  const exampleSection = rawFormatExample
    ? `ОБЯЗАТЕЛЬНЫЙ ЭТАЛОННЫЙ ПРИМЕР ФОРМАТА И РАЗМЕТКИ ПОСТА (Telegram v2):
ЭТО ГЛАВНЫЙ ШАБЛОН ОФОРМЛЕНИЯ — его структура, последовательность блоков, нумерация, разделители и постоянный подвал важнее общих правил!
1. Точно воспроизведи расположение заголовков, нумерацию этапов/пунктов, разделителей, блоков кода (\`\`\`Prompt ...\`\`\`, \`\`\`RR ...\`\`\`, \`\`\`SAV ...\`\`\`), ссылок, юзернеймов и хэштегов как в примере.
2. Каждый блок кода (\`\`\`Prompt, \`\`\`RR, \`\`\`SAV) ОБЯЗАТЕЛЬНО открывай и закрывай строго тремя обратными кавычками \`\`\` на отдельных строках — КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать <pre>, <code> или </code></pre> вместо закрывающих \`\`\`!
3. Постоянные блоки шаблона (верхний заголовок рубрики, разделитель вроде 🔻🔻🔻, блоки подвала, призывы, ссылки и хэштеги, если они есть в примере) перенеси в итоговый пост ДОСЛОВНО, без экранирования обратным слешем.
4. Сохраняй заданный масштаб и полноту примера (если в примере несколько этапов или длинный подробный промпт — раскрой их так же подробно и полно).
"""
${rawFormatExample.slice(0, 4000)}
"""`
    : '';

  return {
    resolvedStyleTitle: resolvedStyle.title,
    resolvedStylePrompt,
    presetTitle: activePreset.title,
    presetRules,
    includeTopicHeading,
    headingDecor,
    topicHeadingTemplate,
    headingRule,
    formatFlagsRules: v2Flags.join('\n- '),
    rawFormatExample,
    exampleSection,
    extraWishes
  };
}

export async function executeBeautyPostNode(params: {
  config: Record<string, any>;
  runningContext: Record<string, any>;
  handoff: {
    effectiveTopic: string;
    effectiveText: string;
    effectiveSummary: string;
    effectiveImagePrompt: string;
  };
  allNodes?: any[];
  cleanUserId: string;
  scenarioFormat: 'v2' | 'rich';
  onSubProgress?: (fraction: number, detail: string) => void;
}): Promise<{
  output: Record<string, any>;
  message: string;
  actualCost: number;
}> {
  const { config, runningContext, handoff, allNodes, cleanUserId, scenarioFormat, onSubProgress } =
    params;
  const format: 'v2' | 'rich' =
    (config.messageFormat || runningContext.messageFormat || scenarioFormat) === 'rich'
      ? 'rich'
      : 'v2';

  const topic = String(
    handoff.effectiveTopic ||
      runningContext.topic ||
      runningContext.title ||
      config.fallbackTopic ||
      'Актуальный разбор'
  ).trim();

  const sourceText = String(handoff.effectiveText || runningContext.text || '').trim();
  const macroVars = buildScenarioMacroContext(runningContext, handoff, {
    topic,
    title: topic,
    text: sourceText
  });
  const engine: 'ai_stylist' | 'smart_rules' =
    config.formattingEngine === 'smart_rules' ? 'smart_rules' : 'ai_stylist';

  // Honor BOTH config.stylePromptOverride (written by BeautyPostConfig UI) AND legacy config.stylePrompt
  const styleOverrideRaw = applyScenarioTemplateVariables(
    String(config.stylePromptOverride || config.stylePrompt || '').trim(),
    macroVars
  ).trim();
  const resolvedStyle = await resolvePostStyleForScenario({
    styleId: config.postStyleId,
    styleTitle: config.postStyle,
    stylePromptOverride: styleOverrideRaw || undefined,
    userId: cleanUserId
  });
  resolvedStyle.prompt = applyScenarioTemplateVariables(resolvedStyle.prompt || '', macroVars).trim();

  const v2MediaInfo =
    format === 'v2'
      ? hasV2MediaInScenarioChain(allNodes, runningContext)
      : { hasMedia: false, signatureReserve: 0 };

  // Resolve per-format char limit (maxCharsV2 / maxCharsRich -> fallback to maxChars -> adaptive hardCeiling)
  const configuredMaxChars = Number(
    (format === 'rich' ? config.maxCharsRich : config.maxCharsV2) ?? config.maxChars ?? 0
  );

  const hardCeiling =
    format === 'rich'
      ? 32000
      : v2MediaInfo.hasMedia
      ? Math.max(250, 1024 - v2MediaInfo.signatureReserve - 16)
      : Math.max(400, 4096 - v2MediaInfo.signatureReserve - 16);

  const targetMaxChars =
    format === 'v2'
      ? configuredMaxChars > 0
        ? Math.min(hardCeiling, Math.max(250, configuredMaxChars))
        : hardCeiling
      : configuredMaxChars > 0
      ? Math.min(32000, Math.max(400, configuredMaxChars))
      : 32000;

  const targetMinChars = Math.max(150, Math.round(targetMaxChars * 0.78));

  const activePreset = resolveBeautyLayoutPreset(
    format,
    format === 'rich' ? config.richLayoutPreset : config.v2LayoutPreset
  );

  if (!sourceText) {
    const fallbackWithHeading = ensureTopicHeadingAtTop({
      bodyText: '',
      topic,
      format,
      includeTopicHeading: config.includeTopicHeading !== false,
      headingDecor: config.headingDecor || 'sparkle',
      headingTemplate: config.topicHeadingTemplate || '{{topic}}',
      macroVars
    });
    runningContext.text = fallbackWithHeading;
    runningContext.title = topic;
    runningContext.topic = topic;
    return {
      output: {
        title: topic,
        topic,
        text: fallbackWithHeading,
        messageFormat: format,
        appliedStyle: resolvedStyle.title,
        formattingPreset: activePreset.id,
        maxLimitApplied: targetMaxChars
      },
      message: `Добавлен оформленный заголовок по теме «${topic}»`,
      actualCost: 0
    };
  }

  if (engine === 'smart_rules') {
    onSubProgress?.(
      0.6,
      `Применение правил красивой верстки ${format === 'rich' ? 'Rich' : 'v2'} и заголовка с темой...`
    );
    let formatted = buildSmartRulesFormattedText({
      rawText: sourceText,
      topic,
      format,
      config,
      macroVars
    });
    if (format === 'v2') {
      formatted = clampV2MediaCaptionText(sanitizeV2NoMarkdownHeadings(formatted), targetMaxChars);
    } else {
      formatted = formatted.slice(0, targetMaxChars);
    }
    runningContext.text = formatted;
    runningContext.title = topic;
    runningContext.topic = runningContext.topic || topic;
    runningContext.messageFormat = format;

    return {
      output: {
        title: topic,
        topic,
        text: formatted,
        messageFormat: format,
        appliedStyle: resolvedStyle.title,
        formattingEngine: 'smart_rules',
        formattingPreset: activePreset.id,
        maxLimitApplied: targetMaxChars
      },
      message: `Пост оформлен по правилам ${format === 'rich' ? 'Rich' : 'v2'} (${formatted.length} / ${targetMaxChars} симв.)`,
      actualCost: 0
    };
  }

  if (format === 'v2') {
    // In v2, beauty formatting lives inside ai_generate_text; if a legacy format_beauty_post node exists, run 0-cost deterministic cleanup + clamp.
    onSubProgress?.(0.65, 'Системная нормализация разметки v2, абзацев и лимита Telegram...');
    const repaired = repairAiCodeFences(removeMarkdownEscaping(sourceText));
    const normalized = enforceParagraphsAndRichBlocks(sanitizeV2NoMarkdownHeadings(repaired), 'v2');
    const includeHeadingLegacy = config.includeTopicHeading !== false;
    const rawExampleLegacy = String(config.formatExampleV2 || config.formatExample || '').trim();
    const headed = ensureTopicHeadingAtTop({
      bodyText: normalized,
      topic,
      format: 'v2',
      includeTopicHeading: includeHeadingLegacy,
      headingDecor: config.headingDecor || 'sparkle',
      headingTemplate: config.topicHeadingTemplate || '{{topic}}',
      macroVars,
      preserveExistingHeading: Boolean(rawExampleLegacy) || !includeHeadingLegacy
    });
    const clampedV2 = clampV2MediaCaptionText(sanitizeV2NoMarkdownHeadings(headed), targetMaxChars);
    runningContext.text = clampedV2;
    runningContext.title = topic;
    runningContext.topic = runningContext.topic || topic;
    runningContext.messageFormat = 'v2';
    return {
      output: {
        title: topic,
        topic,
        text: clampedV2,
        messageFormat: 'v2',
        appliedStyle: resolvedStyle.title,
        formattingEngine: 'systemic_v2',
        formattingPreset: activePreset.id,
        maxLimitApplied: targetMaxChars
      },
      message: `Системная проверка v2 завершена без ИИ-списания (${clampedV2.length} / ${targetMaxChars} симв.)`,
      actualCost: 0
    };
  }

  // STRICT DB lookup BEFORE calling ProTalk (zero hardcoded fallback!)
  const promptRecord = await getRequiredScenarioPrompt('format_beauty_post', format);

  onSubProgress?.(
    0.4,
    `Художественное оформление поста (${format === 'rich' ? 'Rich' : 'v2'}) в стиле «${resolvedStyle.title}»...`
  );

  const includeHeading = config.includeTopicHeading !== false;
  const headingLinePreview = buildFormattedTopicHeadingLine({
    topic,
    format,
    headingDecor: config.headingDecor || 'sparkle',
    headingTemplate: config.topicHeadingTemplate || '{{topic}}',
    macroVars
  });

  const extraWishes = applyScenarioTemplateVariables(
    String(config.customFormatNotes || ''),
    macroVars
  ).trim();

  const rawFormatExampleTpl = removeMarkdownEscaping(
    String(config.formatExampleRich || config.formatExample || '').trim()
  ).trim();
  const rawFormatExample = rawFormatExampleTpl
    ? applyScenarioTemplateVariables(rawFormatExampleTpl, macroVars).trim()
    : '';

  const presetRulesText = activePreset.rules.map((r) => `  * ${r}`).join('\n');

  const headingRule = rawFormatExample
    ? includeHeading
      ? `Соблюдай расположение заголовка в эталонном примере, подставляя сгенерированную тему «${topic}» в верхнюю часть без повторов.`
      : 'Не добавляй лишний заголовок вверху сверх того, что явно зафиксировано в эталонном примере.'
    : includeHeading
    ? `Первой строкой поставь заголовок со сгенерированной темой ровно так: ${headingLinePreview} (и далее пустая строка \\n\\n). Не повторяй этот заголовок во второй строке!`
    : 'Не добавляй главный заголовок # в самом верху — сразу переходи к лиду.';

  const formatFlagsRules = [
    config.richUseSubheadings !== false
      ? 'Раздели материал на логичные главы с подзаголовками ## и ### (пустая строка до и после).'
      : 'Не используй дополнительные подзаголовки ## внутри текста.',
    config.richUseBoldItalic !== false
      ? 'Используй контраст **жирного текста**, *курсива* и `моноширинного кода` для акцентов и цифр.'
      : 'Используй нейтральное оформление без обильного **жирного** выделения.',
    config.richUseBlockquote !== false
      ? 'Включи экспертную врезку-цитату через > или <blockquote expandable>...</blockquote>.'
      : 'Не добавляй блоки цитат >.',
    config.richUseChecklist !== false
      ? 'Оформи практические шаги в виде интерактивного чек-листа (- [x] / - [ ]) с пустыми строками вокруг.'
      : 'Используй обычные списки через дефис вместо чек-листов [x].',
    config.richUseTable || activePreset.id === 'analytical_review'
      ? 'Включи компактную markdown-таблицу сравнения показателей | Колонка 1 | Колонка 2 | с разделителем | :--- | :--- | и пустыми строками вокруг.'
      : 'Таблицу в этот пост добавлять не нужно.',
    config.richUseDividers !== false
      ? 'Ставь горизонтальные разделители --- на отдельной строке между крупными разделами.'
      : 'Не используй разделители ---.'
  ].join('\n- ');

  const exampleSection = rawFormatExample
    ? `ОБЯЗАТЕЛЬНЫЙ ЭТАЛОННЫЙ ПРИМЕР ФОРМАТА И РАЗМЕТКИ ПОСТА (Rich):
ЭТО ГЛАВНЫЙ ШАБЛОН ОФОРМЛЕНИЯ — его структура и фиксированные блоки важнее общих правил!
1. Точно воспроизведи расположение заголовков, разделителей, блоков кода (\`\`\`Prompt ...\`\`\`, \`\`\`RR ...\`\`\`, \`\`\`SAV ...\`\`\`), ссылок, юзернеймов и хэштегов как в примере.
2. Каждый блок кода (\`\`\`Prompt, \`\`\`RR, \`\`\`SAV) ОБЯЗАТЕЛЬНО открывай и закрывай строго тремя обратными кавычками \`\`\` — КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать <pre>, <code> или </code></pre> вместо закрывающих \`\`\`!
3. Постоянные блоки шаблона (верхний заголовок рубрики, разделитель, блоки подвала, призывы и хэштеги, если они есть в примере) перенеси в итоговый пост ДОСЛОВНО, без экранирования обратным слешем.
4. Подставь сгенерированное содержание по текущей теме внутрь основного контентного блока.
"""
${rawFormatExample.slice(0, 3500)}
"""`
    : '';

  const renderedUserPrompt = renderPromptTemplate(promptRecord.user_prompt_template, {
    topic,
    style_title: resolvedStyle.title,
    style_prompt: resolvedStyle.prompt,
    extra_wishes: extraWishes,
    preset_title: activePreset.title,
    preset_rules: presetRulesText,
    target_min_chars: targetMinChars,
    target_max_chars: targetMaxChars,
    has_media_caption: false,
    heading_rule: headingRule,
    format_flags_rules: formatFlagsRules,
    example_section: exampleSection,
    source_text: sourceText
  });
  const stylistPrompt = combineSystemAndUserPrompt(promptRecord.system_prompt, renderedUserPrompt);

  const aiReply = await callProTalkBeautyStylist(stylistPrompt, cleanUserId);
  onSubProgress?.(0.86, 'Финальная проверка абзацев, шрифтов, лимитов Rich и заголовка...');

  const repairedReply = repairAiCodeFences(aiReply);
  const preNormalized = normalizeRichGeneratedMarkdown(repairedReply);
  const cleanedReply = enforceParagraphsAndRichBlocks(stripAllCapsWords(preNormalized), format);
  let finalFormatted = ensureTopicHeadingAtTop({
    bodyText: cleanedReply,
    topic,
    format,
    includeTopicHeading: includeHeading,
    headingDecor: config.headingDecor || 'sparkle',
    headingTemplate: config.topicHeadingTemplate || '{{topic}}',
    macroVars,
    preserveExistingHeading: Boolean(rawFormatExample)
  });

  finalFormatted = finalFormatted.slice(0, targetMaxChars);

  runningContext.text = finalFormatted;
  runningContext.title = topic;
  runningContext.topic = runningContext.topic || topic;
  runningContext.messageFormat = format;

  const beautyCost = getPricingConfigFromDb().textAi.beautyPostAi;
  return {
    output: {
      title: topic,
      topic,
      text: finalFormatted,
      messageFormat: format,
      appliedStyle: resolvedStyle.title,
      formattingEngine: 'ai_stylist',
      formattingPreset: activePreset.id,
      usedFormatExample: Boolean(rawFormatExample),
      maxLimitApplied: targetMaxChars
    },
    message: `Пост красиво оформлен (Rich, макет «${activePreset.title}», стиль «${resolvedStyle.title}», ${finalFormatted.length} / ${targetMaxChars} симв.)`,
    actualCost: beautyCost
  };
}
