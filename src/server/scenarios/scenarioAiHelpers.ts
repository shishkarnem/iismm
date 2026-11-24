import { DB } from '../db';
import { getDatabase } from '../db/index';
import {
  InlineButtonsLayoutRule,
  getAiButtonPromptConfigFromDb,
  normalizeLayoutRule
} from '../db/promptsTable';
import { callProTalkBotApi, removeMarkdownEscaping } from '../protalk';
import { enforceParagraphsAndRichBlocks } from '../formatting/textParagraphFormatter';
import { ScenarioHandoffMode, ScenarioInputScope, ScenarioRichPart } from '../../types';
import {
  combineSystemAndUserPrompt,
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from './prompts/scenarioPromptsRepo';
import { getZonedPartsInTimezone } from '../domains/posts/postStatusHelpers';

function stripAllCapsLock(text: string): string {
  return String(text || '');
}

function getProTalkCreds() {
  const settings = DB.getSettings();
  const botId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const botToken =
    settings?.protalkBotToken?.trim() ||
    process.env.PROTALK_BOT_TOKEN ||
    'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';
  return { botId, botToken };
}

/**
 * 1 Иирка: Быстрый генератор темы / идеи по промпту из БД (`ai_generate_topic_fast`)
 */
export async function generateFastTopic1Iirka(params: {
  topicCategory?: string;
  topicAngle?: string;
  targetAudience?: string;
  topicKeywords?: string;
  upstreamContext?: string;
  userId?: string;
}): Promise<string> {
  const category = (params.topicCategory || 'Технологии и нейросети').trim();
  const angleMap: Record<string, string> = {
    guide: 'практическая пошаговая инструкция',
    case_study: 'разбор реального кейса и результатов',
    news: 'свежий обзор трендов и событий',
    mistakes: 'частые ошибки и как их избежать',
    qa: 'ответ на главный вопрос аудитории',
    tips: 'подборка прикладных советов'
  };
  const angleDesc = angleMap[params.topicAngle || 'guide'] || params.topicAngle || 'экспертный разбор';

  const promptRecord = await getRequiredScenarioPrompt('ai_generate_topic_fast', 'default');
  const renderedUserPrompt = renderPromptTemplate(promptRecord.user_prompt_template, {
    topic_category: category,
    topic_angle: angleDesc,
    target_audience: String(params.targetAudience || '').trim(),
    topic_keywords: String(params.topicKeywords || '').trim(),
    upstream_context: String(params.upstreamContext || '').trim().slice(0, 600)
  });
  const prompt = combineSystemAndUserPrompt(promptRecord.system_prompt, renderedUserPrompt);

  const { botId, botToken } = getProTalkCreds();
  if (botId && botToken) {
    try {
      const raw = await callProTalkBotApi(prompt, botId, botToken, params.userId);
      const cleaned = stripAllCapsLock(
        removeMarkdownEscaping(raw)
          .split('\n')[0]
          .replace(/^\s*\d+[.)]\s+/, '')
          .replace(/^[#"«»'\-\s]+|[#"«»'\s]+$/g, '')
          .trim()
      ).slice(0, 140);
      if (cleaned.length >= 6) {
        return cleaned;
      }
    } catch (err: any) {
      console.warn('[Scenario Fast Topic] ProTalk fallback:', err?.message);
    }
  }

  return stripAllCapsLock(`Свежая тема в рубрике «${category}»`).slice(0, 90);
}

/**
 * 1 Иирка: Генератор промпта для картинки под целевую функцию (621 / 784 / 787 / 791)
 */
export async function generateImagePrompt1Iirka(params: {
  sourceTitle?: string;
  sourceText?: string;
  visualStylePreset?: string;
  negativeHint?: string;
  customInstruction?: string;
  targetFunctionMode?: 'func_621' | 'func_784' | 'func_787' | 'func_791';
  aspectRatio?: string;
  mediaType?: string;
  partIndex?: number;
  isPerPart?: boolean;
  userId?: string;
}): Promise<string> {
  const fnMode = params.targetFunctionMode || 'func_621';
  const isPro791 = fnMode === 'func_791';
  const maxPromptChars = isPro791 ? 5000 : 450;
  const maxResultLen = isPro791 ? 5000 : 500;
  const fnSuffix =
    fnMode === 'func_791'
      ? '791'
      : fnMode === 'func_784'
      ? '784'
      : fnMode === 'func_787'
      ? '787'
      : '621';
  const promptType = `${params.isPerPart ? 'per_part' : 'whole_post'}_${fnSuffix}`;

  const promptRecord = await getRequiredScenarioPrompt('ai_generate_image_prompt', promptType);

  const title = (params.sourceTitle || '').trim();
  const bodySnippet = (params.sourceText || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, isPro791 ? 2600 : 900);

  const stylePreset = String(params.visualStylePreset || '').trim();

  const renderedUserPrompt = renderPromptTemplate(promptRecord.user_prompt_template, {
    source_title: title || 'Экспертная публикация',
    source_text: bodySnippet || title || 'Современные технологии и контент',
    part_index: params.partIndex || 1,
    part_heading: title || `Часть ${params.partIndex || 1}`,
    part_text: bodySnippet || title,
    visual_style: stylePreset,
    negative_hint: String(params.negativeHint || '').trim(),
    custom_instruction: String(params.customInstruction || '').trim(),
    aspect_ratio: params.aspectRatio || (isPro791 ? 'auto' : fnMode === 'func_784' ? '9:16' : '16:9'),
    media_type: params.mediaType || 'photo',
    max_prompt_chars: maxPromptChars
  });
  const prompt = combineSystemAndUserPrompt(promptRecord.system_prompt, renderedUserPrompt);

  const { botId, botToken } = getProTalkCreds();
  if (botId && botToken) {
    try {
      const raw = await callProTalkBotApi(prompt, botId, botToken, params.userId);
      const cleaned = stripAllCapsLock(removeMarkdownEscaping(raw).replace(/\s+/g, ' ').trim()).slice(
        0,
        maxResultLen
      );
      if (cleaned.length >= 15) {
        return cleaned;
      }
    } catch (err: any) {
      console.warn('[Scenario Image Prompt] ProTalk fallback:', err?.message);
    }
  }

  return stripAllCapsLock(
    `Детальная иллюстрация по теме «${(title || bodySnippet.slice(0, 70) || 'экспертный материал').slice(0, 90)}»: ${bodySnippet.slice(
      0,
      isPro791 ? 450 : 160
    )}. Стиль: ${stylePreset.slice(0, 120)}.`
  ).slice(0, maxResultLen);
}

/**
 * Очищает Rich-текст от случайных html-тегов (<br>, <b>, <ul>, <li>, <blockquote>)
 * и нормализует отступы вокруг заголовков ##, сохраняя пользовательский регистр и списки
 */
export function normalizeRichGeneratedMarkdown(rawText: string): string {
  if (!rawText) return '';
  let text = removeMarkdownEscaping(String(rawText));

  // Convert HTML line breaks and paragraphs into clean Markdown newlines
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '\n')
    .replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
    .replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*')
    .replace(/<(?:u|ins)>([\s\S]*?)<\/(?:u|ins)>/gi, '__$1__')
    .replace(/<(?:s|strike|del)>([\s\S]*?)<\/(?:s|strike|del)>/gi, '~~$1~~')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
      const lines = String(inner)
        .trim()
        .split('\n')
        .map((l) => `> ${l.trim()}`);
      return `\n\n${lines.join('\n')}\n\n`;
    })
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n- ${String(inner).trim()}`)
    .replace(/<\/?(?:ul|ol|div|span)[^>]*>/gi, '\n')
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Separate inline markdown headings (e.g. "...текст. ## Раздел") onto new paragraphs
  text = text.replace(/([^\n#])\s+(#{1,4}\s+[^\n]+)/g, '$1\n\n$2');
  text = text.replace(/([^\n])\n(#{1,4}\s+[^\n]+)/g, '$1\n\n$2');
  text = text.replace(/(#{1,4}\s+[^\n]+)\n([^\n#])/g, '$1\n\n$2');
  text = enforceParagraphsAndRichBlocks(text, 'rich');

  return stripAllCapsLock(text);
}

function stripLeadingMarkdownHeading(rawChunk: string): {
  extractedHeading?: string;
  bodyWithoutHeading: string;
} {
  const trimmed = String(rawChunk || '').trim();
  const match = trimmed.match(/^#{1,4}\s+([^\n]+)(?:\n+([\s\S]*))?$/);
  if (!match) {
    return { bodyWithoutHeading: trimmed };
  }
  const heading = stripAllCapsLock(match[1].replace(/^#+\s*/, '').trim());
  let rest = String(match[2] || '').trim();
  // Remove immediate duplicate line if AI repeated the heading right below
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  rest = rest.replace(new RegExp(`^(?:#{1,4}\\s+|\\*\\*)?${escapedHeading}(?:\\*\\*)?\\s*\\n*`, 'i'), '').trim();
  return {
    extractedHeading: heading,
    bodyWithoutHeading: rest
  };
}

/**
 * Детерминированное разбиение текста на 1..N смысловых блоков (используется в режиме 0 Иирок и как надежный резерв)
 */
export function splitTextStructurally(
  rawText: string,
  targetCount: number,
  preserveHeadings = true
): ScenarioRichPart[] {
  const count = Math.min(10, Math.max(1, Math.round(targetCount || 3)));
  const clean = normalizeRichGeneratedMarkdown(rawText);
  if (!clean) {
    return [
      {
        index: 1,
        heading: preserveHeadings ? 'Часть 1' : undefined,
        text: 'Текст публикации для обработки'
      }
    ];
  }

  if (count === 1) {
    const stripped = stripLeadingMarkdownHeading(clean);
    return [
      {
        index: 1,
        heading: preserveHeadings ? stripped.extractedHeading : undefined,
        text: stripped.bodyWithoutHeading || stripped.extractedHeading || clean
      }
    ];
  }

  // First try splitting by H2/H3 sections if present, otherwise by paragraphs
  const sectionBlocks = clean
    .split(/\n{2,}(?=#{1,4}\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const paragraphs =
    sectionBlocks.length >= count
      ? sectionBlocks
      : clean
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);

  if (paragraphs.length <= 1) {
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
    const actualParts = Math.min(count, Math.max(1, sentences.length));
    const perPart = Math.ceil(sentences.length / actualParts);
    const result: ScenarioRichPart[] = [];
    for (let i = 0; i < actualParts; i++) {
      const chunk = sentences.slice(i * perPart, (i + 1) * perPart).join(' ').trim();
      const stripped = stripLeadingMarkdownHeading(chunk);
      const body = stripped.bodyWithoutHeading || chunk;
      if (body) {
        result.push({
          index: result.length + 1,
          heading: preserveHeadings
            ? stripped.extractedHeading || `Раздел ${result.length + 1}`
            : undefined,
          text: body
        });
      }
    }
    return result.length > 0 ? result : [{ index: 1, text: clean }];
  }

  const actualCount = Math.min(count, paragraphs.length);
  const buckets: string[][] = Array.from({ length: actualCount }, () => []);
  paragraphs.forEach((p, idx) => {
    const bucketIdx = Math.min(
      actualCount - 1,
      Math.floor((idx * actualCount) / paragraphs.length)
    );
    buckets[bucketIdx].push(p);
  });

  return buckets
    .filter((b) => b.length > 0)
    .map((bucket, idx) => {
      const joined = bucket.join('\n\n').trim();
      const stripped = stripLeadingMarkdownHeading(joined);
      if (stripped.extractedHeading) {
        const body =
          stripped.bodyWithoutHeading ||
          (preserveHeadings ? '' : stripped.extractedHeading);
        return {
          index: idx + 1,
          heading: preserveHeadings ? stripped.extractedHeading : undefined,
          text: body || stripped.extractedHeading
        };
      }
      return {
        index: idx + 1,
        heading: preserveHeadings ? `Смысловой блок ${idx + 1}` : undefined,
        text: joined
      };
    });
}

/**
 * Разделение Rich-текста по смыслу на 1–10 частей (1 Иирка при ai_semantic, 0 Иирок при headings_paragraphs)
 */
export async function splitRichTextIntoParts(params: {
  text: string;
  title?: string;
  partsCount: number;
  splitMode?: 'ai_semantic' | 'headings_paragraphs';
  preserveHeadings?: boolean;
  userId?: string;
}): Promise<ScenarioRichPart[]> {
  const count = Math.min(10, Math.max(1, Number(params.partsCount || 3)));
  const preserveHeadings = params.preserveHeadings !== false;
  const source = normalizeRichGeneratedMarkdown(params.text);

  if (params.splitMode === 'headings_paragraphs' || count === 1) {
    return splitTextStructurally(source, count, preserveHeadings);
  }

  if (!source) {
    return splitTextStructurally('', count, preserveHeadings);
  }

  const promptRecord = await getRequiredScenarioPrompt(
    'rich_split_parts',
    preserveHeadings ? 'ai_semantic_with_headings' : 'ai_semantic_no_headings'
  );
  const renderedUserPrompt = renderPromptTemplate(promptRecord.user_prompt_template, {
    parts_count: count,
    post_title: params.title || 'Публикация',
    source_text: source.slice(0, 12000)
  });
  const prompt = combineSystemAndUserPrompt(promptRecord.system_prompt, renderedUserPrompt);

  const { botId, botToken } = getProTalkCreds();
  if (botId && botToken) {
    try {
      const raw = await callProTalkBotApi(prompt, botId, botToken, params.userId);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validParts: ScenarioRichPart[] = parsed
            .slice(0, 10)
            .map((item: any, idx: number) => {
              const cleanedChunk = normalizeRichGeneratedMarkdown(String(item?.text || ''));
              const stripped = stripLeadingMarkdownHeading(cleanedChunk);
              const candidateHeading = item?.heading
                ? stripAllCapsLock(String(item.heading).replace(/^#+\s*/, '').trim())
                : stripped.extractedHeading;
              let bodyText = stripped.bodyWithoutHeading || cleanedChunk;
              if (candidateHeading && bodyText) {
                const escaped = candidateHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                bodyText = bodyText
                  .replace(new RegExp(`^(?:#{1,4}\\s+|\\*\\*)?${escaped}(?:\\*\\*)?\\s*\\n*`, 'i'), '')
                  .trim();
              }
              return {
                index: idx + 1,
                heading: preserveHeadings && candidateHeading ? candidateHeading : undefined,
                text: bodyText || cleanedChunk
              };
            })
            .filter((p) => p.text.length > 0);
          if (validParts.length > 0) {
            return validParts;
          }
        }
      }
    } catch (err: any) {
      console.warn('[Scenario Rich Split] ProTalk fallback to structural split:', err?.message);
    }
  }

  return splitTextStructurally(source, count, preserveHeadings);
}

type TelegramInlineBtnStyle = 'default' | 'primary' | 'danger' | 'success';

function normalizeAiBtnStyle(raw?: string): TelegramInlineBtnStyle | undefined {
  const clean = String(raw || '').toLowerCase().trim();
  if (clean === 'success' || clean === 'green' || clean === 'зеленый' || clean === 'зелёный') {
    return 'success';
  }
  if (clean === 'primary' || clean === 'blue' || clean === 'синий') {
    return 'primary';
  }
  if (clean === 'danger' || clean === 'red' || clean === 'красный') {
    return 'danger';
  }
  if (clean === 'default' || clean === 'gray' || clean === 'grey' || clean === 'серый') {
    return 'default';
  }
  return undefined;
}

function describeLayoutRule(rule: InlineButtonsLayoutRule): string {
  switch (rule) {
    case '2_per_row':
      return 'по 2 кнопки в строке (в два столбца, текст кнопок делай компактным — до 18 символов)';
    case '3_per_row':
      return 'по 3 кнопки в строке (в три столбца, текст кнопок делай очень коротким — 1–2 слова до 14 символов)';
    case '1_then_2':
      return 'первая главная кнопка отдельно на всю строку, остальные — по 2 кнопки в строке';
    case '2_then_1':
      return 'сначала по 2 кнопки в строке, а последняя итоговая кнопка — отдельно на всю строку снизу';
    default:
      return 'по 1 кнопке в строке (каждая кнопка на отдельной строке, до 28 символов)';
  }
}

export function groupButtonsByLayoutRule<T>(
  flatButtons: T[],
  rule: InlineButtonsLayoutRule
): T[][] {
  if (flatButtons.length === 0) return [];
  const rows: T[][] = [];

  if (rule === '1_then_2') {
    rows.push([flatButtons[0]]);
    for (let i = 1; i < flatButtons.length; i += 2) {
      rows.push(flatButtons.slice(i, i + 2));
    }
    return rows;
  }

  if (rule === '2_then_1') {
    if (flatButtons.length === 1) return [[flatButtons[0]]];
    const head = flatButtons.slice(0, flatButtons.length - 1);
    const last = flatButtons[flatButtons.length - 1];
    for (let i = 0; i < head.length; i += 2) {
      rows.push(head.slice(i, i + 2));
    }
    rows.push([last]);
    return rows;
  }

  const perRow = rule === '3_per_row' ? 3 : rule === '2_per_row' ? 2 : 1;
  for (let i = 0; i < flatButtons.length; i += perRow) {
    rows.push(flatButtons.slice(i, i + perRow));
  }
  return rows;
}

/**
 * 1 Иирка: Генератор инлайн-кнопок согласно тексту поста, правилу раскладки и промпту из базы данных
 */
export async function generateInlineButtonsFromPost1Iirka(params: {
  postTitle?: string;
  postText?: string;
  buttonsCount?: number;
  buttonsPerRow?: 1 | 2 | 3;
  layoutRule?: string;
  customInstruction?: string;
  customPrompt?: string;
  defaultUrl?: string;
  targetUrls?: string[];
  existingRows?: Array<Array<{ id?: string; text: string; url: string; style?: any }>>;
  tone?: string;
  userId?: string;
}): Promise<
  Array<Array<{ id: string; text: string; url: string; style: TelegramInlineBtnStyle }>>
> {
  const count = Math.min(6, Math.max(1, Number(params.buttonsCount || 2)));
  const fallbackUrl =
    (params.defaultUrl || 'https://t.me/IIrkiBot').trim() || 'https://t.me/IIrkiBot';

  const dbPromptRecord = await getRequiredScenarioPrompt('format_inline_buttons', 'ai_from_post');
  const sqlDb = await getDatabase();
  const dbCfg = await getAiButtonPromptConfigFromDb(sqlDb, params.userId);
  const dbPromptText = dbCfg.promptText;
  const dbLayoutRule: InlineButtonsLayoutRule = dbCfg.layoutRule;
  const dbCustomInstruction = dbCfg.customInstruction;

  const resolvedLayoutRule: InlineButtonsLayoutRule = params.layoutRule
    ? normalizeLayoutRule(params.layoutRule)
    : params.buttonsPerRow
    ? normalizeLayoutRule(params.buttonsPerRow)
    : dbLayoutRule;

  const effectiveInstruction =
    String(params.customInstruction ?? params.tone ?? dbCustomInstruction ?? '').trim() ||
    'вовлекающий и полезный призыв по теме поста';

  const existingFlat = (params.existingRows || [])
    .flat()
    .filter((b) => b && (b.url || b.text));
  const explicitUrls = Array.isArray(params.targetUrls)
    ? params.targetUrls.map((u) => String(u || '').trim()).filter(Boolean)
    : [];
  const candidateUrls = existingFlat.map((b) => (b.url || '').trim()).filter(Boolean);

  const resolvedUrls: string[] = Array.from({ length: count }, (_, idx) => {
    const raw =
      explicitUrls[idx] ||
      candidateUrls[idx] ||
      explicitUrls[0] ||
      candidateUrls[0] ||
      fallbackUrl;
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
  });

  const urlHints = resolvedUrls
    .map((u, idx) => {
      const isTg = /t\.me\/|telegram\.me\//i.test(u);
      let host = u;
      try {
        host = new URL(u).hostname.replace(/^www\./i, '');
      } catch {}
      return `${idx + 1}) Кнопка #${idx + 1}: ${u} (${isTg ? 'Telegram' : `сайт ${host}`})`;
    })
    .join('\n');

  const snippet = String(params.postText || params.postTitle || 'Экспертная публикация в канале')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);

  const rawTemplate = String(params.customPrompt || '').trim() || dbPromptText;
  const layoutDesc = describeLayoutRule(resolvedLayoutRule);
  const titleStr = params.postTitle || 'Публикация';

  const renderedTemplate = renderPromptTemplate(rawTemplate, {
    count,
    title: titleStr,
    text: snippet,
    urls: urlHints,
    layout_rule: layoutDesc,
    custom_instruction: effectiveInstruction
  });
  const prompt = combineSystemAndUserPrompt(dbPromptRecord.system_prompt, renderedTemplate);

  const parsedItems: Array<{ text: string; style?: TelegramInlineBtnStyle }> = [];
  const maxLabelLen = resolvedLayoutRule === '3_per_row' ? 20 : resolvedLayoutRule === '2_per_row' ? 26 : 34;

  const { botId, botToken } = getProTalkCreds();
  if (botId && botToken) {
    try {
      const raw = await callProTalkBotApi(prompt, botId, botToken, params.userId);
      const arrMatch = raw.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try {
          const parsed = JSON.parse(arrMatch[0]);
          if (Array.isArray(parsed)) {
            for (const entry of parsed) {
              if (typeof entry === 'string') {
                const txt = stripAllCapsLock(entry.trim()).slice(0, maxLabelLen);
                if (txt) parsedItems.push({ text: txt });
              } else if (entry && typeof entry === 'object') {
                const txt = stripAllCapsLock(String(entry.text || entry.label || entry.title || '').trim()).slice(
                  0,
                  maxLabelLen
                );
                if (txt) {
                  parsedItems.push({
                    text: txt,
                    style: normalizeAiBtnStyle(entry.style || entry.color)
                  });
                }
              }
            }
          }
        } catch {}
      }
      if (parsedItems.length === 0) {
        const lines = raw
          .split('\n')
          .map((l) =>
            stripAllCapsLock(l.replace(/^[\d.\-•*"«»'\s]+|["«»'\s]+$/g, '').trim()).slice(
              0,
              maxLabelLen
            )
          )
          .filter((l) => l.length >= 3 && !l.startsWith('{') && !l.startsWith('['));
        for (const l of lines) {
          parsedItems.push({ text: l });
        }
      }
    } catch (err: any) {
      console.warn('[Scenario AI Buttons] ProTalk fallback:', err?.message);
    }
  }

  for (let idx = 0; idx < count; idx++) {
    if (!parsedItems[idx]) {
      const u = resolvedUrls[idx];
      if (/t\.me\//i.test(u)) {
        parsedItems[idx] = { text: idx === 0 ? 'Перейти в Telegram' : 'Читать в канале', style: idx === 0 ? 'primary' : 'default' };
      } else {
        let host = '';
        try {
          host = new URL(u).hostname.replace(/^www\./i, '');
        } catch {}
        parsedItems[idx] = {
          text: host ? `Открыть ${host}` : 'Перейти на сайт',
          style: idx === 0 ? 'success' : 'default'
        };
      }
    }
  }

  const trimmedItems = parsedItems.slice(0, count);
  const stylesCycle: TelegramInlineBtnStyle[] = ['primary', 'default'];

  const flatButtons = trimmedItems.map((item, idx) => {
    const existingStyle = normalizeAiBtnStyle(existingFlat[idx]?.style);
    const chosenStyle: TelegramInlineBtnStyle =
      item.style || existingStyle || stylesCycle[idx % stylesCycle.length];
    return {
      id: `btn_ai_${Date.now()}_${idx}`,
      text: item.text,
      url: resolvedUrls[idx],
      style: chosenStyle
    };
  });

  return groupButtonsByLayoutRule(flatButtons, resolvedLayoutRule);
}

/**
 * Формирование входного пакета данных для шага сценария согласно настройкам передачи (handoff)
 */
export function resolveStepHandoffContext(params: {
  nodeConfig?: Record<string, any>;
  directUpstreamOutputs: Record<string, any>[];
  selectedNodeOutputs: Record<string, any>[];
  accumulatedContext: Record<string, any>;
}): {
  effectiveTopic: string;
  effectiveText: string;
  effectiveSummary: string;
  effectiveImagePrompt: string;
  effectiveParts: ScenarioRichPart[];
  formattedPayloadText: string;
} {
  const scope: ScenarioInputScope = params.nodeConfig?.inputScope || 'upstream';
  const mode: ScenarioHandoffMode = params.nodeConfig?.handoffMode || 'full';

  const chosenOutputs =
    scope === 'selected_nodes' && params.selectedNodeOutputs.length > 0
      ? params.selectedNodeOutputs
      : scope === 'upstream' && params.directUpstreamOutputs.length > 0
      ? params.directUpstreamOutputs
      : [];

  let topic = String(params.accumulatedContext.topic || params.accumulatedContext.title || '').trim();
  let text = String(params.accumulatedContext.text || '').trim();
  let imagePrompt = String(params.accumulatedContext.imagePrompt || '').trim();
  let parts: ScenarioRichPart[] = Array.isArray(params.accumulatedContext.parts)
    ? params.accumulatedContext.parts
    : [];

  if (chosenOutputs.length > 0) {
    const topics: string[] = [];
    const texts: string[] = [];
    const prompts: string[] = [];
    chosenOutputs.forEach((out) => {
      if (!out) return;
      if (out.topic || out.title) topics.push(String(out.topic || out.title).trim());
      if (out.text) texts.push(String(out.text).trim());
      if (out.imagePrompt || out.prompt) prompts.push(String(out.imagePrompt || out.prompt).trim());
      if (Array.isArray(out.parts) && out.parts.length > 0) {
        parts = out.parts;
      }
    });
    if (topics.length > 0) topic = topics[topics.length - 1];
    if (texts.length > 0) text = texts.join('\n\n');
    if (prompts.length > 0) imagePrompt = prompts[prompts.length - 1];
  }

  const cleanPlain = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const summary = cleanPlain.length > 360 ? `${cleanPlain.slice(0, 360)}...` : cleanPlain || topic;

  let formattedPayloadText = text || topic;
  if (mode === 'title_only') {
    formattedPayloadText = topic || summary.slice(0, 100);
  } else if (mode === 'summary') {
    formattedPayloadText = topic ? `${topic}. ${summary}` : summary;
  } else if (mode === 'structured') {
    formattedPayloadText = [
      topic ? `Тема: ${topic}` : '',
      summary ? `Суть: ${summary}` : '',
      imagePrompt ? `Визуальная идея: ${imagePrompt}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  } else if (mode === 'parts_stream' && parts.length > 0) {
    formattedPayloadText = parts
      .map((p) => `${p.index}. ${p.heading ? `${p.heading}: ` : ''}${p.text}`)
      .join('\n\n');
  }

  return {
    effectiveTopic: topic,
    effectiveText: text,
    effectiveSummary: summary,
    effectiveImagePrompt: imagePrompt,
    effectiveParts: parts,
    formattedPayloadText
  };
}

export interface ScenarioMacroVars {
  topic?: string;
  title?: string;
  category?: string;
  text?: string;
  summary?: string;
  imagePrompt?: string;
  partHeading?: string;
  partText?: string;
  partIndex?: number;
  channel?: string;
  channels?: string;
  date?: string;
  time?: string;
  datetime?: string;
}

export function buildScenarioMacroContext(
  runningContext: Record<string, any> = {},
  handoff: {
    effectiveTopic?: string;
    effectiveText?: string;
    effectiveSummary?: string;
    effectiveImagePrompt?: string;
  } = {},
  overrides: Partial<ScenarioMacroVars> = {}
): ScenarioMacroVars {
  const topicVal = String(
    overrides.topic ?? handoff.effectiveTopic ?? runningContext.topic ?? runningContext.title ?? ''
  ).trim();
  const titleVal = String(
    overrides.title ?? runningContext.title ?? topicVal
  ).trim();
  const textVal = String(
    overrides.text ?? handoff.effectiveText ?? runningContext.text ?? ''
  ).trim();
  const summaryVal = String(
    overrides.summary ?? handoff.effectiveSummary ?? textVal ?? topicVal
  ).trim();
  const imgPromptVal = String(
    overrides.imagePrompt ?? handoff.effectiveImagePrompt ?? runningContext.imagePrompt ?? ''
  ).trim();
  const categoryVal = String(
    overrides.category ?? runningContext.category ?? ''
  ).trim();

  const rawChannels: string[] = Array.isArray(runningContext.targetChannels)
    ? runningContext.targetChannels.map((c: any) => String(c || '').trim()).filter(Boolean)
    : runningContext.channel
    ? [String(runningContext.channel).trim()]
    : [];
  const channelsJoined = String(overrides.channels ?? rawChannels.join(', ')).trim();
  const primaryChannel = String(overrides.channel ?? rawChannels[0] ?? '').trim();

  const tz = String(runningContext.timezone || 'Europe/Moscow').trim() || 'Europe/Moscow';
  const refDate =
    runningContext.runStartedAt instanceof Date
      ? runningContext.runStartedAt
      : runningContext.runStartedAt
      ? new Date(runningContext.runStartedAt)
      : new Date();
  const safeDate = Number.isNaN(refDate.getTime()) ? new Date() : refDate;
  const zp = getZonedPartsInTimezone(safeDate, tz);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = overrides.date ?? `${pad(zp.day)}.${pad(zp.month)}.${zp.year}`;
  const timeStr = overrides.time ?? `${pad(zp.hours)}:${pad(zp.minutes)}`;
  const dateTimeStr = overrides.datetime ?? `${dateStr} ${timeStr}`;

  return {
    topic: topicVal,
    title: titleVal,
    category: categoryVal,
    text: textVal,
    summary: summaryVal,
    imagePrompt: imgPromptVal,
    partHeading: overrides.partHeading ?? '',
    partText: overrides.partText ?? '',
    partIndex: overrides.partIndex,
    channel: primaryChannel,
    channels: channelsJoined,
    date: dateStr,
    time: timeStr,
    datetime: dateTimeStr
  };
}

export function applyScenarioTemplateVariables(
  template: string,
  vars: ScenarioMacroVars
): string {
  if (!template) return '';
  const resolvedTopic = vars.topic || vars.title || '';
  const resolvedTitle = vars.title || vars.topic || '';
  const resolvedText = vars.text || resolvedTopic;
  const resolvedSummary = vars.summary || vars.text || resolvedTopic;
  const resolvedPartIndex = vars.partIndex !== undefined ? String(vars.partIndex) : '';
  return String(template)
    .replace(/\{\{\s*topic\s*\}\}/gi, resolvedTopic)
    .replace(/\[ТЕМА\]/gi, resolvedTopic)
    .replace(/\{\{\s*title\s*\}\}/gi, resolvedTitle)
    .replace(/\{\{\s*category\s*\}\}/gi, vars.category || '')
    .replace(/\{\{\s*text\s*\}\}/gi, resolvedText)
    .replace(/\{\{\s*summary\s*\}\}/gi, resolvedSummary)
    .replace(/\{\{\s*(?:image_prompt|imagePrompt)\s*\}\}/gi, vars.imagePrompt || '')
    .replace(/\{\{\s*(?:part\.heading|part_heading)\s*\}\}/gi, vars.partHeading || '')
    .replace(/\{\{\s*(?:part\.text|part_text)\s*\}\}/gi, vars.partText || '')
    .replace(/\{\{\s*(?:part\.index|part_index)\s*\}\}/gi, resolvedPartIndex)
    .replace(/\{\{\s*channels\s*\}\}/gi, vars.channels || vars.channel || '')
    .replace(/\{\{\s*channel\s*\}\}/gi, vars.channel || vars.channels || '')
    .replace(/\{\{\s*datetime\s*\}\}/gi, vars.datetime || '')
    .replace(/\{\{\s*date\s*\}\}/gi, vars.date || '')
    .replace(/\{\{\s*time\s*\}\}/gi, vars.time || '');
}
