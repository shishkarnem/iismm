import { DB } from './db';
import {
  enforceParagraphsAndRichBlocks,
  ensureTitleHeadingInPostText,
  repairAiCodeFences
} from './formatting/textParagraphFormatter';
import {
  combineSystemAndUserPrompt,
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from './scenarios/prompts/scenarioPromptsRepo';
import { clampV2MediaCaptionText } from './scenarios/scenarioGraphHelpers';

export interface ProTalkResponse {
  title: string;
  content: string;
  imagePrompt?: string;
}

/**
 * Generate a new topic by analyzing historical posts strictly via DB prompt `ai_generate_topic`
 */
export async function generateTopicFromHistory(
  topicCategory: string,
  recentPublications: string[],
  options?: {
    excludeHistory?: boolean;
    historyDaysLimit?: number;
    upstreamContext?: string;
    userId?: string;
  }
): Promise<string> {
  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  const excludeHistory = options?.excludeHistory !== false;
  const historyDaysLimit = Math.max(1, Number(options?.historyDaysLimit || 30));
  const cleanPubs = excludeHistory && Array.isArray(recentPublications) ? recentPublications.slice(0, 50) : [];
  const hasHistory = cleanPubs.length > 0;

  const promptRecord = await getRequiredScenarioPrompt(
    'ai_generate_topic',
    hasHistory ? 'with_history' : 'without_history'
  );

  const historyTitles = cleanPubs.map((t, idx) => `${idx + 1}. "${t}"`).join('\n');
  const renderedUserPrompt = renderPromptTemplate(promptRecord.user_prompt_template, {
    topic_category: topicCategory,
    history_days_limit: historyDaysLimit,
    history_count: cleanPubs.length,
    history_titles: historyTitles,
    upstream_context: String(options?.upstreamContext || '').trim().slice(0, 1200)
  });
  const promptForTopic = combineSystemAndUserPrompt(promptRecord.system_prompt, renderedUserPrompt);

  if (protalkBotId && protalkBotToken) {
    try {
      console.log(`[ProTalk Topic] Executing ProTalk API call with Bot ID: ${protalkBotId}...`);
      const rawRes = await callProTalkBotApi(promptForTopic, protalkBotId, protalkBotToken, options?.userId);
      const clean = rawRes.replace(/^\s*\d+[.)]\s+/, '').replace(/^[#"«»'\-\s]+|[#"«»'\s]+$/g, '').slice(0, 140);
      if (clean && clean.length > 5) {
        return clean;
      }
    } catch (err: any) {
      console.warn('[ProTalk Topic Warning]: ProTalk API call failed for Bot ID ' + protalkBotId + ':', err?.message);
    }
  }

  const fallbackTopics = [
    `Инновации и свежие кейсы в сфере ${topicCategory}`,
    `Разбор главных ошибок и решений в ${topicCategory}`,
    `Практическое руководство по автоматизации для ${topicCategory}`,
    `Ключевые тренды и перспективы в ${topicCategory}`
  ];
  return fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
}

/**
 * Direct call to ProTalk Bot API using send_message_async & get_last_reply polling protocol
 */
export async function callProTalkBotApi(
  promptText: string,
  botId?: string,
  botToken?: string,
  userChatId?: string
): Promise<string> {
  const settings = DB.getSettings();
  const rawId = botId || settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const token = botToken || settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  if (!rawId || !token) {
    throw new Error('ProTalk API не настроен. Укажите ID бота (bot_id) и Токен API (bot_token) в Настройках системы.');
  }

  const numericBotId = isNaN(Number(rawId)) ? rawId : Number(rawId);
  // Ensure chat_id is strictly formatted as post{UID} (e.g. post16926299042) or custom moderator id
  let chatId = 'post16926299042';
  if (userChatId) {
    const sId = String(userChatId).trim();
    if (sId.startsWith('iismm_moderator_') || sId.startsWith('iismm_consultant_')) {
      chatId = sId;
    } else {
      const cleanUid = sId.replace(/^post/, '').trim();
      chatId = `post${cleanUid || '16926299042'}`;
    }
  }

  console.log(`[ProTalk] Sending async message to bot_id=${numericBotId}, chat_id=${chatId}...`);

  // Step 1: Send message asynchronously
  const sendUrl = 'https://eu1.api.pro-talk.ru/api/v1.0/send_message_async';
  const sendRes = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bot_id: numericBotId,
      bot_token: token,
      bot_chat_id: chatId,
      message: promptText
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text().catch(() => '');
    console.warn(`[ProTalk Send Error] HTTP ${sendRes.status}: ${errText}`);
    // Try fallback endpoint if primary domain is blocked
    const fallbackSend = await fetch(`https://pro-talk.ru/api/v1/bot/${numericBotId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        bot_id: numericBotId,
        bot_token: token,
        message: promptText
      }),
      signal: AbortSignal.timeout(25000)
    }).catch(() => null);

    if (fallbackSend && fallbackSend.ok) {
      const fbData = await fallbackSend.json() as any;
      const fbMsg = fbData.response || fbData.message || fbData.text;
      if (fbMsg) return fbMsg.trim();
    }
  }

  // Step 2: Poll for last reply using get_last_reply
  const pollUrl = 'https://eu1.api.pro-talk.ru/api/v1.0/get_last_reply';
  const timeoutMs = 95000; // 95 seconds max for long posts
  const pollIntervalMs = 3000; // poll every 3 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    try {
      const pollRes = await fetch(pollUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id: numericBotId,
          bot_token: token,
          bot_chat_id: chatId
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (pollRes.ok) {
        const replyData = await pollRes.json() as any;
        const msg = replyData.message || replyData.data?.message || replyData.text || replyData.reply;
        if (msg && typeof msg === 'string' && msg.trim().length > 0) {
          console.log(`[ProTalk Success] Received response for bot_id=${numericBotId} in ${Math.round((Date.now() - startTime)/1000)}s`);
          return msg.trim();
        }
      }
    } catch (pollErr: any) {
      console.warn('[ProTalk Poll Retry Error]:', pollErr?.message);
    }
  }

  throw new Error(`ProTalk API timeout: ответ не получен от бота ${numericBotId} за 95 секунд.`);
}

export function removeMarkdownEscaping(text: string): string {
  if (!text) return '';
  // Removes escaping backslashes before markdown symbols: \_, \*, \[, \], \(, \), \~, \`, \>, \#, \+, \-, \=, \|, \{, \}, \., \!
  return text.replace(/\\([_*\\[\]()~`>#+\-=|{}.!\\])/g, '$1');
}

/**
 * Generate Prokhor Prompt / Post using ProTalk API & System Prompts from DB
 */

export async function generateProkhorPrompt(
  dayOfWeek: string,
  category: string,
  requestTemplate: string,
  customInstructions?: string,
  recentPublications?: string[],
  extraParams?: {
    title?: string;
    currentText?: string;
    minChars?: number;
    maxChars?: number;
    messageFormat?: string;
    escapeMode?: boolean;
    postStyle?: string;
    styleDesc?: string;
    userId?: string;
    handoffPayload?: string;
    needImagePrompt?: boolean;
    imagePromptMaxChars?: number;
    beautyVars?: {
      presetTitle?: string;
      presetRules?: string;
      headingRule?: string;
      formatFlagsRules?: string;
      exampleSection?: string;
      extraWishes?: string;
    };
    structureFlags?: {
      includeHeading?: boolean;
      includeLists?: boolean;
      includeChecklist?: boolean;
      includeQuotes?: boolean;
      includeSpoilers?: boolean;
      includeTable?: boolean;
      includeCallout?: boolean;
      includeRichButtons?: boolean;
    };
  }
): Promise<ProTalkResponse> {
  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  const titleVal = extraParams?.title?.trim() || '';
  const userPromptVal = [requestTemplate?.trim(), customInstructions?.trim()].filter(Boolean).join('\n');

  // Calculate character bounds (honoring explicit minChars & explicit character targets in instructions)
  const maxCharsVal = extraParams?.maxChars ? Number(extraParams.maxChars) : 2500;
  const isCompactMediaCaption = maxCharsVal <= 1024;
  let minCharsVal =
    extraParams?.minChars !== undefined && extraParams?.minChars !== null && Number(extraParams.minChars) > 0
      ? Math.min(maxCharsVal, Math.max(100, Number(extraParams.minChars)))
      : Math.round(maxCharsVal * 0.8);
  if (!(extraParams?.minChars && Number(extraParams.minChars) > 0)) {
    if (maxCharsVal <= 500) minCharsVal = Math.max(180, Math.round(maxCharsVal * 0.55));
    else if (maxCharsVal <= 1024) minCharsVal = Math.max(350, Math.min(600, Math.round(maxCharsVal * 0.6)));
    else if (maxCharsVal <= 2000) minCharsVal = 1600;
    else if (maxCharsVal <= 2500) minCharsVal = 2000;
    else if (maxCharsVal <= 3600) minCharsVal = 2900;
    else if (maxCharsVal <= 4096) minCharsVal = 3050;
    else if (maxCharsVal <= 10000) minCharsVal = 8000;
    else if (maxCharsVal <= 20000) minCharsVal = 16000;
    else if (maxCharsVal <= 32000) minCharsVal = 25600;
  }

  // Parse explicit character volume targets from instructions/example context (e.g. "примерно в 3200 символов", "3000-3800 символов")
  if (!isCompactMediaCaption && userPromptVal) {
    const rangeMatch = userPromptVal.match(/(\d{3,5})\s*[-–—]\s*(\d{3,5})\s*(?:символ|знак)/i);
    const approxMatch = userPromptVal.match(/(?:примерно\s*(?:в|на)?|около|объ[её]мом?\s*(?:в|до)?|не\s+менее|от|на)\s*(\d{3,5})\s*(?:символ|знак)/i);
    let detectedTarget = 0;
    if (rangeMatch?.[1]) {
      detectedTarget = Number(rangeMatch[1]);
    } else if (approxMatch?.[1]) {
      detectedTarget = Number(approxMatch[1]);
    }
    if (detectedTarget >= 400 && detectedTarget <= maxCharsVal) {
      minCharsVal = Math.max(minCharsVal, Math.min(maxCharsVal, Math.round(detectedTarget * 0.90)));
    }
  }

  const currentTextVal = extraParams?.currentText?.trim() || '';
  const styleVal = extraParams?.postStyle || 'Стандартный SMM';
  const styleDescVal = extraParams?.styleDesc || 'Экспертный и увлекательный стиль';
  const userChatId = extraParams?.userId ? String(extraParams.userId) : '16926299042';
  const isRichFormat = extraParams?.messageFormat === 'rich';
  const sFlags = extraParams?.structureFlags;
  const includeHeading = sFlags?.includeHeading !== false;
  const needImagePrompt = extraParams?.needImagePrompt !== false;
  const imagePromptMaxChars = Math.min(5000, Math.max(200, Number(extraParams?.imagePromptMaxChars || 450)));

  // STRICT DB lookup: throws immediately if missing or disabled in scenario_block_prompts
  const promptRecord = await getRequiredScenarioPrompt('ai_generate_text', isRichFormat ? 'rich' : 'v2');

  const structureParts: string[] = [];
  if (sFlags?.includeLists === false) {
    structureParts.push('без маркированных и нумерованных списков — подавай мысли чистыми короткими абзацами');
  } else {
    structureParts.push(
      isRichFormat
        ? 'разрешены и приветствуются нумерованные (1., 2.) и маркированные (-) списки, особенно если они заданы в задании или эталонном примере'
        : 'разрешены и приветствуются нумерованные (1., 1), 1️⃣) и маркированные (🔹 / •) списки на отдельных строках, особенно если они заданы в задании или эталонном примере'
    );
  }
  if (sFlags?.includeChecklist) {
    structureParts.push(isRichFormat ? 'добавь чек-лист (- [ ] / - [x])' : 'добавь компактный чек-лист действий с галочками (✅ / ☑️)');
  }
  if (sFlags?.includeQuotes) {
    structureParts.push(isRichFormat ? 'используй цитату > или <blockquote expandable>...</blockquote>' : 'выдели ключевой инсайт в тег <blockquote>...</blockquote>');
  }
  if (isRichFormat && sFlags?.includeTable) {
    structureParts.push('включи наглядную таблицу | ... |');
  }
  if (isRichFormat && sFlags?.includeSpoilers) {
    structureParts.push('добавь скрытый спойлер через <details><summary>...</summary>...</details>');
  }
  if (isRichFormat && sFlags?.includeCallout) {
    structureParts.push('оформи ключевой вывод через <aside>...</aside>');
  }

  let uniquenessContext = 'Отсутствует (нет совпадений)';
  if (recentPublications && recentPublications.length > 0) {
    const rawTitles = recentPublications.map(p => {
      const lines = p.split('\n').filter(l => l.trim().length > 0);
      return (lines[0] || p).slice(0, 100).replace(/^[#*"\s]+|[#*"\s]+$/g, '');
    }).filter(t => t.length > 2);
    const uniqueTitles = Array.from(new Set(rawTitles)).slice(0, 35);
    uniquenessContext = `\n[Использованные ранее темы]:\nРанее в канале уже выходили посты со следующими заголовками:\n` +
      uniqueTitles.map((t, idx) => `${idx + 1}. "${t}"`).join('\n') +
      `\nЗапрещено повторять или дублировать эти темы и идеи — придумай свежий угол подачи и уникальные формулировки.`;
  }

  const renderedUserPrompt = renderPromptTemplate(promptRecord.user_prompt_template, {
    topic: titleVal || 'Придумай выразительный заголовок в тему',
    user_prompt: userPromptVal,
    handoff_payload: String(extraParams?.handoffPayload || '').trim(),
    current_text: currentTextVal,
    style_title: styleVal,
    style_desc: styleDescVal,
    category: category || 'Контент и нейросети',
    preset_title: extraParams?.beautyVars?.presetTitle || '',
    preset_rules: extraParams?.beautyVars?.presetRules || '',
    heading_rule: extraParams?.beautyVars?.headingRule || '',
    format_flags_rules: extraParams?.beautyVars?.formatFlagsRules || '',
    example_section: extraParams?.beautyVars?.exampleSection || '',
    extra_wishes: extraParams?.beautyVars?.extraWishes || '',
    structure_requirements: structureParts.join('; '),
    include_rich_buttons: Boolean(isRichFormat && sFlags?.includeRichButtons),
    uniqueness_context: uniquenessContext,
    min_chars: minCharsVal,
    max_chars: maxCharsVal,
    is_compact_media_caption: isCompactMediaCaption,
    include_heading: includeHeading,
    need_image_prompt: needImagePrompt,
    image_prompt_max_chars: imagePromptMaxChars
  });
  const promptTemplate = combineSystemAndUserPrompt(promptRecord.system_prompt, renderedUserPrompt);

  // 1. TRY PROTALK API
  if (protalkBotId && protalkBotToken) {
    try {
      console.log(`[ProTalk API] Requesting generation via bot_id: ${protalkBotId} for user ${userChatId} (min=${minCharsVal}, max=${maxCharsVal})...`);
      const parseProTalkPostReply = (rawResp: string) => {
        const normalizedRaw = String(rawResp || '').replace(/[\u2028\u2029]/g, '\n');
        let pTitle = '';
        let pContent = '';
        let pImagePrompt = '';

        const imgM = normalizedRaw.match(/\[IMAGE_PROMPT\]:\s*([^\n\r]+)/i);
        if (imgM?.[1]) pImagePrompt = imgM[1].trim();

        const cleanedResp = normalizedRaw
          .replace(/\[IMAGE_PROMPT\]:[^\n\r]+/gi, '')
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        const jMatch = cleanedResp.match(/\{[\s\S]*\}/);
        if (jMatch) {
          const jCand = jMatch[0];
          try {
            const parsed = JSON.parse(jCand);
            if (parsed.title || parsed.content) {
              pTitle = String(parsed.title || titleVal || `Пост на тему ${category || 'SMM'}`).trim();
              pContent = String(parsed.content || cleanedResp).replace(/##INLINE:[^#]+##/gi, '').trim();
              if (parsed.imagePrompt || parsed.image_prompt) {
                pImagePrompt = String(parsed.imagePrompt || parsed.image_prompt).trim();
              }
            }
          } catch {
            const tM = jCand.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
            const iM = jCand.match(/"(?:imagePrompt|image_prompt)"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
            const cM = jCand.match(/"content"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"(?:imagePrompt|image_prompt)"|\s*\})/i);
            if (tM?.[1]) pTitle = tM[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
            if (iM?.[1]) pImagePrompt = iM[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
            if (cM?.[1]) {
              pContent = cM[1]
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/##INLINE:[^#]+##/gi, '')
                .trim();
            }
          }
        }

        if (!pContent) {
          const strippedJsonNoise = cleanedResp
            .replace(/^\s*\{\s*$/gm, '')
            .replace(/^\s*\}\s*$/gm, '')
            .trim();
          const lines = strippedJsonNoise.split('\n').filter((l) => l.trim().length > 0 && l.trim() !== '{' && l.trim() !== '}');
          const firstLine = lines[0] ? lines[0].replace(/^[#*"\s]+|[#*"\s]+$/g, '') : `Пост: ${category || 'SMM'}`;
          pTitle = firstLine.length > 1 && firstLine.length < 120 ? firstLine : (titleVal || `Пост на тему ${category || 'SMM'}`);
          pContent = strippedJsonNoise.replace(/##INLINE:[^#]+##/gi, '').trim();
        }
        return { pTitle, pContent, pImagePrompt };
      };

      const rawResponse = await callProTalkBotApi(promptTemplate, protalkBotId, protalkBotToken, userChatId);
      const firstParsed = parseProTalkPostReply(rawResponse);
      let parsedTitle = firstParsed.pTitle;
      let parsedContent = firstParsed.pContent;
      let parsedImagePrompt = firstParsed.pImagePrompt;

      const normalizeCandidateContent = (rawC: string, rTitle: string) => {
        const formatMode = isRichFormat ? 'rich' : 'v2';
        const repaired = repairAiCodeFences(removeMarkdownEscaping(rawC));
        const normalizedParagraphs = enforceParagraphsAndRichBlocks(repaired, formatMode);
        return includeHeading && !extraParams?.beautyVars?.exampleSection
          ? ensureTitleHeadingInPostText(normalizedParagraphs, rTitle, formatMode)
          : normalizedParagraphs;
      };

      let resolvedParsedTitle = parsedTitle || titleVal || `Пост на тему ${category || 'SMM'}`;
      parsedContent = normalizeCandidateContent(parsedContent, resolvedParsedTitle);

      // Automatic expansion pass when LLM under-delivers long posts (< 85% of minCharsVal)
      const minThreshold = Math.round(minCharsVal * 0.85);
      for (let expandPass = 1; expandPass <= 2; expandPass++) {
        if (!(minCharsVal >= 1200 && !isCompactMediaCaption && parsedContent.length < minThreshold)) {
          break;
        }
        console.log(
          `[ProTalk Volume Guard] Draft too short (${parsedContent.length} < ${minThreshold}, target ${minCharsVal}..${maxCharsVal}). Running expansion pass #${expandPass}...`
        );
        const expandPrompt = `ВНИМАНИЕ: твой предыдущий черновик получился слишком коротким (${parsedContent.length} символов), а по заданию нужен подробный развернутый пост объёмом строго от ${minCharsVal} до ${maxCharsVal} символов!

НЕ УДАЛЯЙ И НЕ СОКРАЩАЙ существующие блоки, заголовки <b>...</b>, нумерованные списки (1., 2., ... или 1), 2), ...), блоки кода \`\`\`Prompt...\`\`\`, \`\`\`RR...\`\`\`, \`\`\`SAV...\`\`\` и разделитель 🔻🔻🔻 с подвалом (если они присутствуют).
Раскрой и расширь содержательную часть, этапы, параметры и практические детали внутри основного контента и промпт-инструкций так, чтобы итоговый готовый пост составлял от ${minCharsVal} до ${maxCharsVal} символов (и не превышал ${maxCharsVal} символов).
Верни строго валидный JSON с ключом "content" (и "title"):
{"title": ${JSON.stringify(resolvedParsedTitle)}, "content": "..."}

Исходное задание автора:
${userPromptVal.slice(0, 1200)}
${extraParams?.beautyVars?.exampleSection ? `\n${extraParams.beautyVars.exampleSection.slice(0, 2200)}` : ''}

Текущий короткий черновик (${parsedContent.length} симв.), который нужно углубить и расширить до ${minCharsVal}–${maxCharsVal} симв.:
"""
${parsedContent}
"""`;
        try {
          const expRaw = await callProTalkBotApi(expandPrompt, protalkBotId, protalkBotToken, userChatId);
          const expParsed = parseProTalkPostReply(expRaw);
          if (expParsed.pContent && expParsed.pContent.trim().length > 100) {
            const expTitle = expParsed.pTitle || resolvedParsedTitle;
            const expNormalized = normalizeCandidateContent(expParsed.pContent, expTitle);
            const hardExpandCap = isRichFormat ? 32000 : Math.min(4096, maxCharsVal + 400);
            if (expNormalized.length > parsedContent.length && expNormalized.length <= hardExpandCap + 500) {
              parsedContent = expNormalized;
              resolvedParsedTitle = expTitle;
            }
          }
        } catch (expErr: any) {
          console.warn(`[ProTalk Volume Guard] Expansion pass #${expandPass} warning:`, expErr?.message);
          break;
        }
      }

      // Upper-bound & fixed-footer integrity guard for V2 so long posts never overshoot Telegram limit and chop off footer blocks (e.g. 🔻🔻🔻 / ```RR / ```SAV)
      if (!isRichFormat) {
        const rawExampleTxt = String(extraParams?.beautyVars?.exampleSection || '');
        const quotedExampleMatch = rawExampleTxt.match(/"""\r?\n([\s\S]+?)\r?\n"""\s*$/);
        const actualExampleBody = quotedExampleMatch?.[1] || '';
        const allFooterMatches = Array.from(actualExampleBody.matchAll(/(?:🔻){3,}/gu));
        const lastFooterMatch = allFooterMatches[allFooterMatches.length - 1];
        const expectedFooter =
          lastFooterMatch && typeof lastFooterMatch.index === 'number'
            ? actualExampleBody.slice(lastFooterMatch.index).trim()
            : '';
        const hardV2Budget = Math.min(maxCharsVal >= 3500 ? 3960 : 4020, maxCharsVal);
        const footerTailToken = expectedFooter
          ? expectedFooter.replace(/[\s`]+/g, '').slice(-12)
          : '';
        const matchesFooter = (txt: string) =>
          !expectedFooter ||
          (txt.includes('🔻🔻🔻') &&
            (!footerTailToken || txt.replace(/[\s`]+/g, '').includes(footerTailToken)));
        const hasFullExpectedFooter = matchesFooter(parsedContent);
        const overshotV2Budget = parsedContent.length > hardV2Budget;

        if (overshotV2Budget || !hasFullExpectedFooter) {
          console.log(
            `[ProTalk Budget Guard] Triggered (len=${parsedContent.length}, budget=${hardV2Budget}, hasFullFooter=${hasFullExpectedFooter}). Refining draft cleanly...`
          );
          const targetUpper = Math.max(minCharsVal + 120, hardV2Budget - 90);
          const condensePrompt = `КРИТИЧЕСКИ ВАЖНО — КОРРЕКЦИЯ ДЛИНЫ И СОХРАНЕНИЕ ПОДВАЛА:
Текущий черновик (${parsedContent.length} символов) ${overshotV2Budget ? `превысил допустимый лимит Telegram (${hardV2Budget} символов)` : 'потерял обязательный разделитель и финальный подвал из эталонного примера'}.

Твоя задача: перепиши этот пост так, чтобы итоговый готовый текст целиком (от первой строки до самого конца подвала) уложился СТРОГО в диапазон от ${minCharsVal} до ${targetUpper} символов!
1. Сохрани ВСЕ заголовки <b>...</b>, вступление, нумерованные списки (1., 2., ... и 1), 2), ...) и закрывающий тег \`\`\` у блока \`\`\`Prompt ...\`\`\`.
2. Чуть лаконичнее сожми второстепенные описания внутри \`\`\`Prompt ...\`\`\`, чтобы весь пост вместе с подвалом строго уложился в ${targetUpper} символов (не больше ${hardV2Budget} символов!).
${expectedFooter ? `3. Сразу после закрытия \`\`\` блока Prompt ОБЯЗАТЕЛЬНО дословно вставь весь разделитель и финальный подвал без сокращений:\n${expectedFooter}` : ''}

Верни строго валидный JSON с ключами "title" и "content":
{"title": ${JSON.stringify(resolvedParsedTitle)}, "content": "..."}

Черновик для корректировки:
"""
${parsedContent.slice(0, 7500)}
"""`;
          try {
            const cRaw = await callProTalkBotApi(condensePrompt, protalkBotId, protalkBotToken, userChatId);
            const cParsed = parseProTalkPostReply(cRaw);
            if (cParsed.pContent && cParsed.pContent.trim().length > 200) {
              const cNorm = normalizeCandidateContent(cParsed.pContent, cParsed.pTitle || resolvedParsedTitle);
              const cHasFooter = matchesFooter(cNorm);
              if (
                cNorm.length <= hardV2Budget + 60 ||
                (cHasFooter && cNorm.length < parsedContent.length)
              ) {
                parsedContent = cNorm;
                if (cParsed.pTitle) resolvedParsedTitle = cParsed.pTitle;
              }
            }
          } catch (condErr: any) {
            console.warn('[ProTalk Budget Guard] Warning:', condErr?.message);
          }

          // Deterministic safety net: guarantee expectedFooter is verbatim and total length <= hardV2Budget
          if (expectedFooter) {
            const stillHasFullFooter = matchesFooter(parsedContent);
            if (!stillHasFullFooter) {
              const withoutPartialFooter = parsedContent.replace(/\r?\n*🔻[\s\S]*$/u, '').trim();
              const bodyAllowance = Math.max(400, hardV2Budget - expectedFooter.length - 6);
              const trimmedHead = clampV2MediaCaptionText(withoutPartialFooter, bodyAllowance);
              parsedContent = `${trimmedHead}\n${expectedFooter}`;
            } else if (parsedContent.length > hardV2Budget) {
              parsedContent = clampV2MediaCaptionText(parsedContent, hardV2Budget);
            }
          } else if (parsedContent.length > hardV2Budget) {
            parsedContent = clampV2MediaCaptionText(parsedContent, hardV2Budget);
          }
        }
      }

      // Clean and cap image prompt according to downstream model capacity (up to 5000 for 791, ~450-500 otherwise)
      parsedImagePrompt = parsedImagePrompt
        .replace(/[\u2028\u2029]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, imagePromptMaxChars);

      if (needImagePrompt && !parsedImagePrompt) {
        parsedImagePrompt = `Качественная эстетичная иллюстрация к публикации на тему "${(parsedTitle || category || 'SMM').slice(0, 120)}", современная цифровая графика, мягкий свет, высокая детализация`;
      }

      // Log to PostgreSQL logs
      try {
        const { insertModerationLog } = await import('./db/postgres');
        insertModerationLog({
          level: 'info',
          message: `[Генерация поста] Создан пост по теме "${category || 'SMM'}". Токенов: 1200 (2.40 ₽)`,
          details: JSON.stringify({
            category: category || 'SMM',
            title: parsedTitle,
            post_style: styleVal,
            user_id: userChatId,
            tokens_used: 1200,
            cost_rub: 2.40
          }),
          tokens_used: 1200,
          cost_rub: 2.40,
          chat_id: `post_${userChatId}`,
          user_id: userChatId,
          function_id: 620,
          decision: 'OK'
        });
      } catch (logErr) {}

      return {
        title: resolvedParsedTitle,
        content: parsedContent,
        imagePrompt: parsedImagePrompt
      };
    } catch (protalkError: any) {
      console.warn('[ProTalk API Fallback]:', protalkError?.message);
    }
  }

  // 2. ULTIMATE LOCAL NETWORK-FAILURE FALLBACK
  const fallbackTitle = titleVal || `🔥 Экспертный пост: ${category || 'SMM & AI'}`;
  const fallbackContentRaw = extraParams?.currentText 
    ? `${extraParams.currentText}\n\n✨ Дополнение: Настройте автопостинг и интеграцию с ProTalk для непрерывного роста вашей аудитории!`
    : `Искусственный интеллект и автоматизация SMM помогают привлекать новых подписчиков 24/7.\n\n✨ Ключевые преимущества:\n1. Глубокая уникализация контента.\n2. Публикации по расписанию.\n3. Умные автоответчики в чатах.\n\n👉 Запустите автопилот уже сегодня!`;

  const fallbackImgPrompt = needImagePrompt
    ? `Качественная иллюстрация к посту на тему "${fallbackTitle}", профессиональная фотография, яркие оттенки, детализация 8k`
    : '';

  return {
    title: fallbackTitle,
    content: includeHeading
      ? ensureTitleHeadingInPostText(removeMarkdownEscaping(fallbackContentRaw), fallbackTitle, isRichFormat ? 'rich' : 'v2')
      : removeMarkdownEscaping(fallbackContentRaw),
    imagePrompt: fallbackImgPrompt
  };
}

/**
 * Direct call to ProTalk Function 621 for Image Generation
 * POST https://api.pro-talk.ru/api/v1.0/run_function
 */
export async function callProTalkFunction621(options: {
  prompt: string;
  aspectRatio?: string;
  outputFormat?: string;
  logUrl?: string;
  logChatId?: string;
  userId?: string;
  model?: string;
  skipGallerySave?: boolean;
  skipHiddenRule?: boolean;
  hostProtocol?: { host: string; protocol: string };
}): Promise<{
  imageUrl: string;
  originalUrl: string;
  downloadUrl: string;
  width?: number;
  height?: number;
  fileSize?: number;
  tokensUsed: number;
  costRub: number;
}> {
  const { 
    prompt, 
    aspectRatio = '16:9', 
    outputFormat = 'png', 
    userId = '16926299042',
    model = 'flux',
    skipGallerySave = false,
    skipHiddenRule = false,
    hostProtocol
  } = options;

  const { formatImageLogChatId, persistGeneratedImageToGallery } = await import(
    './image-gen/persistGeneratedImageToGallery'
  );

  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  const effectiveLogChatId = formatImageLogChatId(621, userId);
  const effectiveLogUrl = options.logUrl || settings?.moderationLogUrl || 'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing';

  console.log(`[ProTalk Function 621] Running image generation for prompt: "${prompt.slice(0, 60)}..." (model: ${model}, chat_id: ${effectiveLogChatId})`);

  const base621Prompt = (prompt || '')
    .replace(/[\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1100) || 'A beautiful futuristic concept art, high detailed 8k';
  const hiddenRule621 = 'Избегать текста и избегать инфографики.';
  const outbound621Prompt =
    skipHiddenRule || base621Prompt.toLowerCase().includes('избегать текста и избегать инфографики')
      ? base621Prompt
      : `${base621Prompt.replace(/[.!?\s]+$/, '')}. Обязательное правило: ${hiddenRule621}`;

  try {
    const payload = {
      function_id: 621,
      functions_base_id: "appkq3HrzrxYxoAV8",
      bot_id: Number(protalkBotId) || 66275,
      bot_token: protalkBotToken,
      arguments: {
        prompt: outbound621Prompt,
        aspect_ratio: aspectRatio,
        output_format: outputFormat,
        log_url: effectiveLogUrl,
        log_chat_id: effectiveLogChatId
      }
    };

    let resData: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch('https://api.pro-talk.ru/api/v1.0/run_function', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(75000)
        });
        if (res.ok) {
          resData = await res.json();
          break;
        }
        if (attempt < 2 && res.status >= 500) {
          await new Promise((r) => setTimeout(r, 900 * attempt));
          continue;
        }
      } catch (innerErr: any) {
        if (attempt < 2 && !String(innerErr?.name || '').includes('Timeout')) {
          await new Promise((r) => setTimeout(r, 900 * attempt));
          continue;
        }
        throw innerErr;
      }
    }

    const imgObj = resData?.images?.[0] || resData?.result?.images?.[0] || resData?.data?.[0];
    const rawOriginalUrl = imgObj?.url || resData?.url || resData?.result?.url;
    const originalUrl = rawOriginalUrl
      ? String(rawOriginalUrl).trim().replace(/^https?:\/\/filestore\.pro-talk\.ru\//i, 'https://file.pro-talk.ru/tgf/')
      : '';

    if (originalUrl) {
      const tokensUsed = Number(resData?.usage?.total_tokens || resData?.result?.usage?.total_tokens || 1000);
      const costRub = Number(resData?.usage?.cost_rub || resData?.result?.usage?.cost_rub || 2.0);
      const defaultW = aspectRatio === '9:16' ? 768 : aspectRatio === '1:1' ? 1024 : 1344;
      const defaultH = aspectRatio === '9:16' ? 1344 : aspectRatio === '1:1' ? 1024 : 768;

      try {
        const { insertModerationLog } = await import('./db/postgres');
        insertModerationLog({
          level: 'info',
          message: `[Генерация картинок 621] Изображение создано (${costRub} ₽, ${tokensUsed} токенов, ${aspectRatio})`,
          details: JSON.stringify({
            function_id: 621,
            prompt: prompt.slice(0, 200),
            aspect_ratio: aspectRatio,
            log_chat_id: effectiveLogChatId,
            url: originalUrl,
            tokens_used: tokensUsed,
            cost_rub: costRub,
            model: resData?.model || model
          }),
          tokens_used: tokensUsed,
          cost_rub: costRub,
          chat_id: effectiveLogChatId,
          user_id: String(userId),
          function_id: 621,
          decision: 'OK'
        });
      } catch (logErr) {}

      let finalPublicUrl = originalUrl;
      if (!skipGallerySave) {
        const saved = await persistGeneratedImageToGallery({
          imageUrl: originalUrl,
          originalUrl,
          userId,
          fnNumber: 621,
          width: imgObj?.width || defaultW,
          height: imgObj?.height || defaultH,
          hostProtocol
        });
        if (saved.publicUrl) finalPublicUrl = saved.publicUrl;
      }

      return {
        imageUrl: finalPublicUrl,
        originalUrl,
        downloadUrl: finalPublicUrl,
        width: imgObj?.width || defaultW,
        height: imgObj?.height || defaultH,
        fileSize: imgObj?.size_bytes || imgObj?.file_size || 0,
        tokensUsed,
        costRub
      };
    }
  } catch (err: any) {
    console.warn('[ProTalk Function 621 Fallback to Neural Engine]:', err.message);
  }

  // High-reliability Neural fallback with model parameter
  const fallbackUrl = await generateFluxImage(outbound621Prompt, userId, model);
  let persistedFallbackUrl = fallbackUrl;
  if (!skipGallerySave) {
    const saved = await persistGeneratedImageToGallery({
      imageUrl: fallbackUrl,
      originalUrl: fallbackUrl,
      userId,
      fnNumber: 621,
      width: 1080,
      height: 1080,
      hostProtocol
    });
    if (saved.publicUrl) persistedFallbackUrl = saved.publicUrl;
  }
  return {
    imageUrl: persistedFallbackUrl,
    originalUrl: fallbackUrl,
    downloadUrl: persistedFallbackUrl,
    width: 1080,
    height: 1080,
    fileSize: 450000,
    tokensUsed: 1000,
    costRub: 2.0
  };
}

/**
 * Generate image URL via ProTalk Function 621
 */
export async function generateProTalkImage(
  promptText: string, 
  options?: { userId?: string; logChatId?: string; aspectRatio?: string }
): Promise<string> {
  const uid = options?.userId || '16926299042';
  const result = await callProTalkFunction621({
    prompt: promptText,
    userId: uid,
    aspectRatio: options?.aspectRatio || '16:9'
  });
  return result.imageUrl;
}

/**
 * Analyze up to 10 channel posts to generate a unique author style prompt
 */
export async function analyzeChannelStyleFromPosts(
  posts: string[], 
  styleName?: string, 
  userId: string = '16926299042'
): Promise<{ title: string; prompt: string; desc: string }> {
  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  const postsText = posts
    .slice(0, 10)
    .map((p, idx) => `--- ПОСТ ${idx + 1} ---\n${p.trim()}`)
    .join('\n\n');

  const styleDbPrompt = await getRequiredScenarioPrompt('author_style', 'analyze_posts');
  const renderedStyleUser = renderPromptTemplate(styleDbPrompt.user_prompt_template, {
    style_name: styleName || 'Мой авторский стиль',
    posts_text: postsText
  });
  const systemAnalysisPrompt = combineSystemAndUserPrompt(styleDbPrompt.system_prompt, renderedStyleUser);

  let title = styleName || 'Мой авторский стиль';
  let desc = 'Уникальный авторский стиль, созданный на основе постов канала';
  let prompt = 'Пиши в характерном авторском тоне, используя живой язык, яркие примеры, четкое разделение на короткие абзацы через пустую строку и чистую разметку без экранирования бэкслешами.';

  if (protalkBotId && protalkBotToken) {
    try {
      const response = await callProTalkBotApi(systemAnalysisPrompt, protalkBotId, protalkBotToken, `style_${userId}`);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.prompt) prompt = parsed.prompt;
        if (parsed.title) title = parsed.title;
        if (parsed.desc) desc = parsed.desc;
      } else if (response.length > 50) {
        prompt = response.trim();
      }
    } catch (e) {
      console.warn('[ProTalk Style Analysis Error]:', e);
    }
  }

  prompt = removeMarkdownEscaping(prompt);

  // Log to PostgreSQL 'logs' table
  try {
    const { insertModerationLog } = await import('./db/postgres');
    insertModerationLog({
      level: 'info',
      message: `[Создание стиля] Проанализировано ${posts.length} постов канала для стиля "${title}". Токенов: 1500 (3.00 ₽)`,
      details: JSON.stringify({
        title,
        desc,
        posts_count: posts.length,
        user_id: userId,
        tokens_used: 1500,
        cost_rub: 3.00
      }),
      tokens_used: 1500,
      cost_rub: 3.00,
      chat_id: `style_${userId}`,
      user_id: userId,
      function_id: 764,
      decision: 'OK'
    });
  } catch (e) {}

  return { title, prompt, desc };
}

export interface NeuroplanTopicItem {
  id: string;
  title: string;
  postText: string;
  imagePrompt: string;
  scheduledDate: string;
  scheduledTime: string;
  selected?: boolean;
}

/**
 * Generate 15 post topics for Neuroplan with full post texts, Russian image prompts and scheduled dates
 */
export async function generateNeuroplanTopics(
  idea: string, 
  userId: string = '16926299042',
  historyTitles: string[] = []
): Promise<NeuroplanTopicItem[]> {
  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  let historySection = '';
  if (historyTitles && historyTitles.length > 0) {
    const limitedHistory = historyTitles.slice(0, 40);
    historySection = `
[ИСТОРИЯ ПОСТОВ И ЗАГОЛОВКОВ АВТОРА ЗА ПОСЛЕДНИЕ 30 ДНЕЙ]:
Ранее автор уже писал и публиковал следующие посты и темы:
${limitedHistory.map((t, idx) => `${idx + 1}. "${t}"`).join('\n')}

[КАТЕГОРИЧЕСКИЙ ЗАПРЕТ НА ПОВТОРЫ И ДУБЛИ]:
Категорически запрещено повторять, дублировать или перефразировать темы, заголовки и идеи из списка выше! 
Все 15 предлагаемых тем для Нейроплана обязаны быть строго новыми, свежими, с другими хуками, ракурсами и идеями.
`;
  }

  const neuroplanDbPrompt = await getRequiredScenarioPrompt('neuroplan', 'plan_15_days');
  const renderedNeuroplanUser = renderPromptTemplate(neuroplanDbPrompt.user_prompt_template, {
    idea: idea.trim(),
    history_section: historySection.trim()
  });
  const prompt = combineSystemAndUserPrompt(neuroplanDbPrompt.system_prompt, renderedNeuroplanUser);

  const fallbackTopicsTemplates = [
    { title: `5 критических ошибок в ${idea || 'вашей сфере'}, из-за которых сливают бюджет`, text: `В любой нише есть действия, которые кажутся логичными, но ведут к убыткам.\n\nГлавная ошибка — отсутствие четкой системы и хаотичный маркетинг. Когда процессы не оцифрованы, каждый шаг стоит втрое дороже.\n\nПроанализируйте ваши текущие показатели и автоматизируйте рутину уже сейчас.` },
    { title: `Кейс: как новый подход в ${idea || 'проекте'} увеличил конверсию на 40%`, text: `Показываем внутреннюю кухню недавнего запуска.\n\nМы полностью перестроили воронку взаимодействия с подписчиками и внедрили ИИ-автоматизацию ответов. Результат превзошел ожидания — конверсия выросла без увеличения рекламного бюджета.\n\nКлюч к успеху — скорость реакции и персонализированный контент.` },
    { title: `Пошаговый чек-лист: с чего начать в ${idea || 'этой теме'} с нуля`, text: `Сохраняйте проверенный план действий:\n\n1. Определите ядро целевой аудитории.\n2. Сформулируйте одно сильное торговое предложение.\n3. Настройте стабильный поток контента с помощью расписания.\n4. Подключите автоответчики и аналитику.\n\nДействуйте последовательно, чтобы избежать выгорания.` },
    { title: `Разбор мифа: почему старые методы в ${idea || 'бизнесе'} больше не работают`, text: `Рынок меняется с невероятной скоростью. То, что работало год назад, сегодня лишь сжигает время команды.\n\nСегодня выигрывают те, кто внедряет нейросети и омниканальность. Алгоритмы помогают анализировать аудиторию быстрее любого отдела маркетинга.` },
    { title: `3 инструмента с искусственным интеллектом, которые экономят часы в ${idea || 'работе'}`, text: `Подборка проверенных ИИ-сервисов для экономии ресурсов:\n\n1. Генераторы визуального контента высокого разрешения.\n2. Интеллектуальные автоворонки для мессенджеров.\n3. Системы глубокого анализа стилей и текстов.\n\nДелегируйте рутину технологиям, чтобы сосредоточиться на стратегии.` },
    { title: `Честный отзыв и закулисье: с какими трудностями мы столкнулись в ${idea || 'текущем месяце'}`, text: `Любой рост сопровождается преодолением вызовов.\n\nВ этом месяце мы тестировали новые гипотезы и столкнулись с техническими ограничениями сторонних платформ. Но именно это помогло разработать собственные надежные решения.\n\nДелимся выводами и готовыми рекомендациями.` },
    { title: `Сравнение: что выбрать в ${idea || 'этой нише'} — бюджетный или премиальный вариант?`, text: `Частый вопрос при выборе решения — стоит ли переплачивать за премиум?\n\nБюджетный вариант подходит для проверки начальных гипотез. Но если вы масштабируетесь, премиальные инструменты окупаются за счет стабильности и расширенного функционала.` },
    { title: `Главный тренд в ${idea || 'этой теме'}: к чему готовиться в ближайшие полгода`, text: `Анализируем ключевые изменения рынка.\n\nОчевидно смещение фокуса на скорость внедрения и автономность систем. Те, кто научился совмещать качественный контент с автоматизацией, займут лидерские позиции в ближайшие сезоны.` },
    { title: `Инструкция: как за 15 минут автоматизировать рутину в ${idea || 'деле'}`, text: `Простая пошаговая настройка базовых сценариев:\n\n1. Настройте контент-план на 2 недели вперед.\n2. Включите отложенные публикации по часовым поясам.\n3. Настройте правила автоответов для входящих заявок.\n\nВсего 15 минут внимания освободят вам десятки часов работы.` },
    { title: `Секреты упаковки: как сделать подачу в ${idea || 'Telegram'} запоминающейся`, text: `Визуальная и смысловая упаковка решает первое впечатление.\n\nИспользуйте фирменное форматирование текста, четкую структуру абзацев и визуальные обложки в едином узнаваемом стиле.\n\nУзнаваемость формирует лояльность аудитории с первых секунд.` },
    { title: `Ответы на популярные вопросы подписчиков о ${idea || 'нашей сфере'}`, text: `Собрали самые актуальные вопросы аудитории за последнее время.\n\nРазбираем нюансы ценообразования, сроки реализации и практические результаты внедрения.\n\nОткрытость и прозрачность — основа долгосрочного доверия.` },
    { title: `Разбор частых возражений клиентов в ${idea || 'этой теме'}`, text: `«Это слишком сложно» и «У меня нет времени» — классические возражения.\n\nНа самом деле современные системы настраиваются в пару кликов и берут на себя до 80% рутины.\n\nРазвенчиваем страхи реальными фактами и цифрами.` },
    { title: `Как не перегореть, управляя контентом и продвижением в ${idea || 'бизнесе'}`, text: `Постоянная необходимость генерировать идеи истощает.\n\nРешение — регулярная работа с Нейропланом и пакетирование задач. Сгенерируйте темы и тексты на 2 недели вперед за один присест, и занимайтесь стратегией.` },
    { title: `Гайд по удержанию аудитории: почему от вас не должны отписываться`, text: `Привлечь подписчика — половина дела. Гораздо важнее удержать его интерес.\n\nЧередуйте экспертные посты с инсайтами, практическими инструкциями и визуальными материалами. Разнообразие формата удерживает внимание.` },
    { title: `Итоги и дорожная карта развития в сфере ${idea || 'проекта'}`, text: `Подводим промежуточные итоги и намечаем ориентиры на будущее.\n\nМы продолжаем улучшать функционал, расширять возможности автоматизации и делиться проверенным опытом с нашим сообществом.\n\nДвигаемся вперед к новым вершинам!` }
  ];

  let rawTopicsList: Array<{ title: string; postText: string; imagePrompt: string }> = [];

  if (protalkBotId && protalkBotToken) {
    try {
      const response = await callProTalkBotApi(prompt, protalkBotId, protalkBotToken, `neuroplan_${userId}`);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rawTopicsList = parsed.map(item => ({
            title: item.title ? String(item.title).trim() : 'Тема поста',
            postText: item.postText ? removeMarkdownEscaping(String(item.postText).trim()) : '',
            imagePrompt: item.imagePrompt ? String(item.imagePrompt).trim() : `Иллюстрация к теме ${item.title || idea}, современный стиль, высокое качество`
          }));
        }
      }
    } catch (e) {
      console.warn('[ProTalk Neuroplan Error]:', e);
    }
  }

  // Ensure 15 topics
  const finalTopics: NeuroplanTopicItem[] = [];
  const now = new Date();

  for (let i = 0; i < 15; i++) {
    const targetDate = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().split('T')[0];
    const timeStr = '10:00';

    const fallback = fallbackTopicsTemplates[i % fallbackTopicsTemplates.length];
    const candidate = rawTopicsList[i];

    const title = candidate?.title || fallback.title;
    const postText = candidate?.postText || fallback.text;
    const imagePrompt = candidate?.imagePrompt || `Качественная иллюстрация к публикации на тему "${title}", профессиональная композиция, яркие цвета, 8k`;

    finalTopics.push({
      id: `np_top_${Date.now()}_${i + 1}`,
      title,
      postText: enforceParagraphsAndRichBlocks(removeMarkdownEscaping(postText), 'v2'),
      imagePrompt,
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      selected: true
    });
  }

  // Log to PostgreSQL 'logs' table
  try {
    const { insertModerationLog } = await import('./db/postgres');
    insertModerationLog({
      level: 'info',
      message: `[Нейроплан] Сгенерировано 15 тем с текстами и обложками для идеи "${idea.slice(0, 50)}". Токенов: 2500 (5.00 ₽)`,
      details: JSON.stringify({
        idea,
        topics_count: 15,
        user_id: userId,
        tokens_used: 2500,
        cost_rub: 5.00
      }),
      tokens_used: 2500,
      cost_rub: 5.00,
      chat_id: `neuroplan_${userId}`,
      user_id: userId,
      function_id: 765,
      decision: 'OK'
    });
  } catch (e) {}

  return finalTopics;
}

/**
 * Generate Image Prompt based on Post text via ProTalk API in Russian (Request 6)
 */
export async function generateImagePromptFromPost(
  postTitle: string,
  postText: string,
  styleGuide?: string
): Promise<string> {
  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  // STRICT DB lookup from scenario_block_prompts
  const promptRecord = await getRequiredScenarioPrompt('ai_generate_image_prompt', 'whole_post_621');
  const renderedUserPrompt = renderPromptTemplate(promptRecord.user_prompt_template, {
    source_title: postTitle || 'Экспертная публикация',
    source_text: String(postText || '').slice(0, 900),
    visual_style: styleGuide || '',
    negative_hint: '',
    custom_instruction: '',
    aspect_ratio: '16:9',
    max_prompt_chars: 450
  });
  const promptRequest = combineSystemAndUserPrompt(promptRecord.system_prompt, renderedUserPrompt);

  if (protalkBotId && protalkBotToken) {
    try {
      const res = await callProTalkBotApi(promptRequest, protalkBotId, protalkBotToken);
      if (res && res.trim().length > 10) {
        return res.replace(/^["']|["']$/g, '').trim();
      }
    } catch (e) {
      console.warn('ProTalk image prompt generation fallback:', e);
    }
  }

  return `Качественная иллюстрация к публикации "${postTitle || 'Искусственный интеллект'}", кинематографичное освещение, высокая детализация 8k`;
}

/**
 * Generate image URL via ProTalk / Flux image engine using system prompt from DB (legacy fallback)
 */
export async function generatePollinationsImage(promptText: string, model: string = 'flux'): Promise<string> {
  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  const cleanPrompt = promptText.trim() || 'Futuristic AI concept art, 8k resolution';

  // Fetch system prompt for image generation from DB
  const sysPromptObj = DB.getSystemPromptByKey('image_prompt_generator');
  const baseSysPrompt = sysPromptObj?.promptText || 'Ты — профессиональный арт-директор. Составляй сочный англоязычный промпт для нейросети.';

  let enhancedPrompt = cleanPrompt;

  // Try calling ProTalk to optimize the image prompt if bot is configured
  if (protalkBotId && protalkBotToken) {
    try {
      const fullReq = `${baseSysPrompt}\n\n[ИСХОДНЫЙ ПРОМПТ ПОЛЬЗОВАТЕЛЯ]: "${cleanPrompt}"\nВыдай ТОЛЬКО итоговый оптимизированный англоязычный промпт для картинки.`;
      const res = await callProTalkBotApi(fullReq, protalkBotId, protalkBotToken);
      if (res && res.trim().length > 10) {
        enhancedPrompt = res.replace(/^["']|["']$/g, '').trim();
      }
    } catch (e) {
      console.warn('[ProTalk Image Prompt Optimization Warning]:', e);
    }
  }

  const seed = Math.floor(Math.random() * 1000000);
  const encoded = encodeURIComponent(enhancedPrompt);
  
  // Model mapping
  let modelParam = 'flux';
  if (model === 'midjourney') modelParam = 'midjourney';
  else if (model === 'dalle3') modelParam = 'dalle';
  else if (model === 'sd35' || model === 'turbo') modelParam = 'turbo';

  // Direct ProTalk FLUX image generator endpoint
  return `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1080&nologo=true&seed=${seed}&model=${modelParam}`;
}

export async function generateFluxImage(promptText: string, userId: string = '16926299042', model: string = 'flux'): Promise<string> {
  return generatePollinationsImage(promptText, model);
}

const DEFAULT_MODERATION_INSTRUCTION = `Ты — официальный ИИ-контролер и строгий модератор текстовых сообщений в защищенной сети ИИSMM.
Твоя задача — объективно, строго и беспристрастно проверить сообщение пользователя на соответствие законодательству Российской Федерации, нормам общественной безопасности и правилам цифровых сообществ.

КРИТЕРИИ НАРУШЕНИЙ (Отказ / VIOLATION):
1. Законодательство РФ и общественная безопасность:
   - Призывы к терроризму, экстремизму, насилию, свержению конституционного строя.
   - Разжигание национальной, расовой, религиозной, социальной или иной вражды.
   - Пропаганда, продажа или распространение наркотических средств, психотропных веществ, оружия, взрывчатки.
   - Заведомо ложная общественно значимая информация (фейки), клевета, прямые угрозы жизни или здоровью людей, шантаж и вымогательство.
   - Порнографический контент, материалы сексуального насилия или любая эксплуатация несовершеннолетних.
2. Мошенничество и вредоносная деятельность:
   - Фишинг, вредоносные ссылки, вредоносное ПО, вирусы, стилеры.
   - Реклама нелегальных онлайн-казино, азартных игр, финансовых пирамид, сомнительных схем быстрого обогащения и скама.
   - Массовый спам, агрессивная реклама сторонних каналов и навязчивая рассылка.
3. Этика и культура общения:
   - Нецензурная брань, грубый мат, унижение человеческого достоинства, травля (буллинг), токсичные оскорбления.

ПРАВИЛО ПРИНЯТИЯ РЕШЕНИЯ:
- Если сообщение нарушает хотя бы один пункт выше: выбери "Отказ" (VIOLATION).
- Если сообщение чистое, безопасное, не содержит спама, мата, мошенничества и не нарушает законы РФ: выбери "Согласие" (OK).`;

/**
 * Direct AI Moderator for personal and group chat messages via Function 763 API.
 * Bypasses the bot chat completely.
 * Directly queries https://api.pro-talk.ru/api/v1.0/run_function with function_id 763.
 * Logs API decision, token usage, and ruble costs to the PostgreSQL 'logs' table.
 */
export async function runProTalkModeratorForMessage(msg: {
  id: string;
  userId?: string;
  sender?: string;
  text?: string;
  chatId?: string;
}): Promise<boolean> {
  if (!msg || !msg.id || !msg.text) return true;
  // Strictly moderate user-authored messages, never incoming or bot messages
  if (msg.sender && msg.sender !== 'me') return true;
  const rawText = msg.text.trim();
  if (!rawText) return true;

  // Use the actual account UID (never raw 'me' or 'them')
  const cleanUid = (msg.userId && msg.userId !== 'me' && msg.userId !== 'them' && msg.userId !== 'unknown') 
    ? String(msg.userId) 
    : '16926299042';
  const moderatorChatId = `iismm_moderator_${cleanUid}_${msg.id}`;

  try {
    const settings = DB.getSettings();
    const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
    const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

    // Retrieve instruction prompt from database system_prompts table, fallback to default
    const dbPrompt = DB.getSystemPromptByKey('chat_moderator');
    const instructionPrompt = (dbPrompt?.promptText?.trim()) || DEFAULT_MODERATION_INSTRUCTION;

    // Configurable log_url from database settings
    let logUrl = (settings?.moderationLogUrl !== undefined ? settings.moderationLogUrl : '').trim();
    if (logUrl === '' && settings?.moderationLogUrl === undefined) {
      logUrl = 'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing';
    }

    // Prepare Function 763 payload arguments
    const argumentsPayload: Record<string, any> = {
      text: rawText.slice(0, 30000),
      instruction: instructionPrompt,
      options: 'Отказ::VIOLATION;;Согласие::OK',
      decision_type: 'choice',
      debug: false,
      log_chat_id: moderatorChatId
    };

    // Include log_url only if configured (allows user to remove or add Google Sheets logging)
    if (logUrl) {
      argumentsPayload.log_url = logUrl;
    }

    const payload = {
      function_id: 763,
      functions_base_id: 'appkq3HrzrxYxoAV8',
      bot_id: Number(protalkBotId) || 66275,
      bot_token: protalkBotToken,
      arguments: argumentsPayload
    };

    const res = await fetch('https://api.pro-talk.ru/api/v1.0/run_function', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Function 763 returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();

    // Parse decision from Function 763
    const selected = data?.result?.selected || data?.result?.raw_decision?.choice;
    const otkazProb = Number(data?.result?.probabilities?.['Отказ'] ?? data?.result?.raw_decision?.probabilities?.['Отказ'] ?? 0);
    const soglasieProb = Number(data?.result?.probabilities?.['Согласие'] ?? data?.result?.raw_decision?.probabilities?.['Согласие'] ?? 0);

    const isViolation = (
      selected === 'Отказ' ||
      selected === 'VIOLATION' ||
      String(selected || '').toLowerCase().includes('отказ') ||
      otkazProb > 0.5
    );

    const isApproved = !isViolation;
    // Moderation coefficient: multiply tokens by 2 per user requirement
    const rawTokens = Number(data?.usage?.total_tokens || 10);
    const tokensUsed = rawTokens * 2;
    const costPerTokenRub = Number(settings?.costPerTokenRub || 0.001);
    const costRub = Number((tokensUsed * costPerTokenRub).toFixed(4));

    // Log to PostgreSQL 'logs' table
    const { insertModerationLog, deleteChatMessageFromPg } = await import('./db/postgres');
    insertModerationLog({
      level: isApproved ? 'info' : 'warn',
      message: isApproved
        ? `[Модерация 763] Сообщение одобрено (Согласие / OK). Токенов: ${tokensUsed} (${costRub} ₽)`
        : `[Модерация 763] Сообщение отклонено (Отказ / VIOLATION). Токенов: ${tokensUsed} (${costRub} ₽)`,
      details: JSON.stringify({
        function_id: 763,
        status: data?.status,
        decision: isApproved ? 'OK' : 'VIOLATION',
        selected,
        probabilities: { 'Отказ': otkazProb, 'Согласие': soglasieProb },
        tokens_used: tokensUsed,
        cost_rub: costRub,
        log_chat_id: moderatorChatId,
        log_url: logUrl || null,
        preview: rawText.slice(0, 150)
      }),
      tokens_used: tokensUsed,
      cost_rub: costRub,
      chat_id: msg.chatId || '',
      user_id: cleanUid,
      function_id: 763,
      decision: isApproved ? 'OK' : 'VIOLATION'
    });

    if (isViolation) {
      console.warn(`[AI Moderator 763] Message ${msg.id} by user ${cleanUid} was flagged as VIOLATION. Deleting from DB...`);
      deleteChatMessageFromPg(msg.id);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[AI Moderator 763 Warning] Could not complete Function 763 check:', err);
    try {
      const { insertModerationLog } = await import('./db/postgres');
      insertModerationLog({
        level: 'error',
        message: `[Модерация 763 Ошибка]: ${err?.message || 'Неизвестная ошибка вызова функции'}`,
        details: JSON.stringify({
          error: String(err?.message || err),
          chat_id: msg.chatId,
          user_id: cleanUid,
          preview: rawText.slice(0, 100)
        }),
        tokens_used: 0,
        cost_rub: 0,
        chat_id: msg.chatId || '',
        user_id: cleanUid,
        function_id: 763,
        decision: 'ERROR_FALLBACK'
      });
    } catch (logErr) {}
    return true;
  }
}

export const DEFAULT_COMMENT_MODERATION_INSTRUCTION = `Ты — официальный ИИ-контролер и строгий модератор комментариев под публикациями в защищенной сети ИИSMM.
Твоя задача — объективно, строго и беспристрастно проверить текст комментария пользователя на соответствие законодательству Российской Федерации, правилам платформы и этическим нормам общения.

КРИТЕРИИ НАРУШЕНИЙ (Отказ / VIOLATION):
1. Законодательство РФ и общественная безопасность:
   - Призывы к терроризму, экстремизму, насилию, разжигание национальной, расовой, религиозной или социальной вражды.
   - Пропаганда, продажа или распространение наркотических веществ, оружия, взрывчатки.
   - Заведомо ложная информация (фейки), клевета, прямые угрозы расправой, шантаж, вымогательство.
   - Порнографический контент или эксплуатация несовершеннолетних.
2. Спам, мошенничество и реклама:
   - Несанкционированная реклама, сторонние фишинговые ссылки, вредоносное ПО, вирусы.
   - Реклама нелегальных онлайн-казино, сомнительных финансовых пирамид, крипто-скама и сомнительных схем быстрого обогащения.
   - Бессмысленный автоматический спам, массовый флуд, накрутки.
3. Этика и токсичность:
   - Нецензурная брань, отборный мат, токсичные персональные оскорбления, травля (буллинг), унижение достоинства.

ПРАВИЛО ПРИНЯТИЯ РЕШЕНИЯ:
- Если комментарий нарушает хотя бы один пункт выше: выбери "Отказ" (VIOLATION).
- Если комментарий конструктивный, вежливый или нейтральный, не содержит спама, мата и нарушений: выбери "Согласие" (OK).`;

export const DEFAULT_REVIEW_MODERATION_INSTRUCTION = `Ты — официальный ИИ-контролер и строгий модератор отзывов пользователей на официальном лендинге сервиса ИИSMM.
Твоя задача — проверить текст предложенного отзыва на соответствие законодательству Российской Федерации, отсутствие спама, мата и вредоносного контента.

КРИТЕРИИ НАРУШЕНИЙ (Отказ / VIOLATION):
1. Законодательство РФ:
   - Призывы к экстремизму, насилию, разжигание розни, пропаганда запрещенных веществ.
   - Клевета, угрозы, фейки, шантаж.
2. Неприемлемый контент, спам и реклама:
   - Нецензурная брань, грубый мат, оскорбления в адрес создателей или пользователей.
   - Реклама сторонних сайтов, конкурентов, ссылки на внешние сервисы, скам, фишинг.
   - Бессвязный бред, машинный спам, случайный набор букв, не имеющий отношения к отзыву о сервисе.

ПРАВИЛО ПРИНЯТИЯ РЕШЕНИЯ:
- Если отзыв содержит нецензурную лексику, рекламу, спам, угрозы или нарушает законы РФ: выбери "Отказ" (VIOLATION).
- Если отзыв является адекватным пользовательским мнением (позитивным, нейтральным или конструктивной критикой без оскорблений и спама): выбери "Согласие" (OK).`;

/**
 * Direct AI Moderator for blog/social comments via ProTalk Function 763 API.
 * Uses its own system prompt from the database (scenario_key: 'comment_moderator').
 * Directly queries https://api.pro-talk.ru/api/v1.0/run_function with function_id 763.
 * Logs API decision, token usage, and ruble costs to the PostgreSQL 'logs' table.
 */
export async function runProTalkModeratorForComment(comment: {
  text: string;
  authorUserId?: string;
  postId?: string;
  authorName?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const rawText = String(comment.text || '').trim();
  if (!rawText) return { ok: true };

  const cleanUid = (comment.authorUserId && comment.authorUserId !== 'me' && comment.authorUserId !== 'unknown')
    ? String(comment.authorUserId)
    : '16926299042';
  const moderatorChatId = `iismm_comment_moderator_${cleanUid}_${Date.now()}`;

  try {
    const settings = DB.getSettings();
    const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
    const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

    // Retrieve instruction prompt from database system_prompts table, fallback to default
    const dbPrompt = DB.getSystemPromptByKey('comment_moderator');
    const instructionPrompt = (dbPrompt?.promptText?.trim()) || DEFAULT_COMMENT_MODERATION_INSTRUCTION;

    let logUrl = (settings?.moderationLogUrl !== undefined ? settings.moderationLogUrl : '').trim();
    if (logUrl === '' && settings?.moderationLogUrl === undefined) {
      logUrl = 'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing';
    }

    const argumentsPayload: Record<string, any> = {
      text: rawText.slice(0, 30000),
      instruction: instructionPrompt,
      options: 'Отказ::VIOLATION;;Согласие::OK',
      decision_type: 'choice',
      debug: false,
      log_chat_id: moderatorChatId
    };

    if (logUrl) {
      argumentsPayload.log_url = logUrl;
    }

    const payload = {
      function_id: 763,
      functions_base_id: 'appkq3HrzrxYxoAV8',
      bot_id: Number(protalkBotId) || 66275,
      bot_token: protalkBotToken,
      arguments: argumentsPayload
    };

    const res = await fetch('https://api.pro-talk.ru/api/v1.0/run_function', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Function 763 returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const selected = data?.result?.selected || data?.result?.raw_decision?.choice;
    const otkazProb = Number(data?.result?.probabilities?.['Отказ'] ?? data?.result?.raw_decision?.probabilities?.['Отказ'] ?? 0);
    const soglasieProb = Number(data?.result?.probabilities?.['Согласие'] ?? data?.result?.raw_decision?.probabilities?.['Согласие'] ?? 0);

    const isViolation = (
      selected === 'Отказ' ||
      selected === 'VIOLATION' ||
      String(selected || '').toLowerCase().includes('отказ') ||
      otkazProb > 0.5
    );

    const isApproved = !isViolation;
    // Moderation coefficient: multiply tokens by 2 per user requirement
    const rawTokens = Number(data?.usage?.total_tokens || 10);
    const tokensUsed = rawTokens * 2;
    const costPerTokenRub = Number(settings?.costPerTokenRub || 0.001);
    const costRub = Number((tokensUsed * costPerTokenRub).toFixed(4));

    const { insertModerationLog } = await import('./db/postgres');
    insertModerationLog({
      level: isApproved ? 'info' : 'warn',
      message: isApproved
        ? `[Модерация 763] Комментарий к публикации одобрен (Согласие / OK). Токенов: ${tokensUsed} (${costRub} ₽)`
        : `[Модерация 763] Комментарий к публикации отклонен (Отказ / VIOLATION). Токенов: ${tokensUsed} (${costRub} ₽)`,
      details: JSON.stringify({
        context: 'post_comment',
        post_id: comment.postId,
        author: comment.authorName,
        function_id: 763,
        decision: isApproved ? 'OK' : 'VIOLATION',
        selected,
        probabilities: { 'Отказ': otkazProb, 'Согласие': soglasieProb },
        tokens_used: tokensUsed,
        cost_rub: costRub,
        preview: rawText.slice(0, 150)
      }),
      tokens_used: tokensUsed,
      cost_rub: costRub,
      chat_id: comment.postId ? `post_${comment.postId}` : '',
      user_id: cleanUid,
      function_id: 763,
      decision: isApproved ? 'OK' : 'VIOLATION'
    });

    if (isViolation) {
      console.warn(`[AI Moderator 763] Comment by ${comment.authorName || cleanUid} for post ${comment.postId} was flagged as VIOLATION.`);
      return { ok: false, reason: 'VIOLATION' };
    }

    return { ok: true };
  } catch (err: any) {
    console.warn('[AI Moderator 763 Warning] Could not complete comment check:', err);
    try {
      const { insertModerationLog } = await import('./db/postgres');
      insertModerationLog({
        level: 'error',
        message: `[Модерация 763 Ошибка комментариев]: ${err?.message || 'Ошибка вызова функции'}`,
        details: JSON.stringify({
          error: String(err?.message || err),
          context: 'post_comment',
          post_id: comment.postId,
          user_id: cleanUid,
          preview: rawText.slice(0, 100)
        }),
        tokens_used: 0,
        cost_rub: 0,
        chat_id: comment.postId ? `post_${comment.postId}` : '',
        user_id: cleanUid,
        function_id: 763,
        decision: 'ERROR_FALLBACK'
      });
    } catch (logErr) {}
    // Fallback to allow if moderation service is temporarily down
    return { ok: true };
  }
}

/**
 * Direct AI Moderator for landing page reviews via ProTalk Function 763 API.
 * Uses its own system prompt from the database (scenario_key: 'review_moderator').
 * Directly queries https://api.pro-talk.ru/api/v1.0/run_function with function_id 763.
 * Logs API decision, token usage, and ruble costs to the PostgreSQL 'logs' table.
 */
export async function runProTalkModeratorForReview(review: {
  text: string;
  name?: string;
  rating?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const rawText = String(review.text || '').trim();
  if (!rawText) return { ok: true };

  const moderatorChatId = `iismm_review_moderator_${Date.now()}`;

  try {
    const settings = DB.getSettings();
    const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
    const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

    // Retrieve instruction prompt from database system_prompts table, fallback to default
    const dbPrompt = DB.getSystemPromptByKey('review_moderator');
    const instructionPrompt = (dbPrompt?.promptText?.trim()) || DEFAULT_REVIEW_MODERATION_INSTRUCTION;

    let logUrl = (settings?.moderationLogUrl !== undefined ? settings.moderationLogUrl : '').trim();
    if (logUrl === '' && settings?.moderationLogUrl === undefined) {
      logUrl = 'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing';
    }

    const argumentsPayload: Record<string, any> = {
      text: `Имя автора: ${review.name || 'Аноним'}\nОценка: ${review.rating || 5} из 5\nТекст отзыва: ${rawText}`.slice(0, 30000),
      instruction: instructionPrompt,
      options: 'Отказ::VIOLATION;;Согласие::OK',
      decision_type: 'choice',
      debug: false,
      log_chat_id: moderatorChatId
    };

    if (logUrl) {
      argumentsPayload.log_url = logUrl;
    }

    const payload = {
      function_id: 763,
      functions_base_id: 'appkq3HrzrxYxoAV8',
      bot_id: Number(protalkBotId) || 66275,
      bot_token: protalkBotToken,
      arguments: argumentsPayload
    };

    const res = await fetch('https://api.pro-talk.ru/api/v1.0/run_function', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Function 763 returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const selected = data?.result?.selected || data?.result?.raw_decision?.choice;
    const otkazProb = Number(data?.result?.probabilities?.['Отказ'] ?? data?.result?.raw_decision?.probabilities?.['Отказ'] ?? 0);
    const soglasieProb = Number(data?.result?.probabilities?.['Согласие'] ?? data?.result?.raw_decision?.probabilities?.['Согласие'] ?? 0);

    const isViolation = (
      selected === 'Отказ' ||
      selected === 'VIOLATION' ||
      String(selected || '').toLowerCase().includes('отказ') ||
      otkazProb > 0.5
    );

    const isApproved = !isViolation;
    // Moderation coefficient: multiply tokens by 2 per user requirement
    const rawTokens = Number(data?.usage?.total_tokens || 10);
    const tokensUsed = rawTokens * 2;
    const costPerTokenRub = Number(settings?.costPerTokenRub || 0.001);
    const costRub = Number((tokensUsed * costPerTokenRub).toFixed(4));

    const { insertModerationLog } = await import('./db/postgres');
    insertModerationLog({
      level: isApproved ? 'info' : 'warn',
      message: isApproved
        ? `[Модерация 763] Отзыв лендинга одобрен (Согласие / OK). Токенов: ${tokensUsed} (${costRub} ₽)`
        : `[Модерация 763] Отзыв лендинга отклонен (Отказ / VIOLATION). Токенов: ${tokensUsed} (${costRub} ₽)`,
      details: JSON.stringify({
        context: 'landing_review',
        author: review.name,
        rating: review.rating,
        function_id: 763,
        decision: isApproved ? 'OK' : 'VIOLATION',
        selected,
        probabilities: { 'Отказ': otkazProb, 'Согласие': soglasieProb },
        tokens_used: tokensUsed,
        cost_rub: costRub,
        preview: rawText.slice(0, 150)
      }),
      tokens_used: tokensUsed,
      cost_rub: costRub,
      chat_id: 'landing_reviews',
      user_id: 'landing_visitor',
      function_id: 763,
      decision: isApproved ? 'OK' : 'VIOLATION'
    });

    if (isViolation) {
      console.warn(`[AI Moderator 763] Landing review by ${review.name} was flagged as VIOLATION.`);
      return { ok: false, reason: 'VIOLATION' };
    }

    return { ok: true };
  } catch (err: any) {
    console.warn('[AI Moderator 763 Warning] Could not complete review check:', err);
    try {
      const { insertModerationLog } = await import('./db/postgres');
      insertModerationLog({
        level: 'error',
        message: `[Модерация 763 Ошибка отзывов]: ${err?.message || 'Ошибка вызова функции'}`,
        details: JSON.stringify({
          error: String(err?.message || err),
          context: 'landing_review',
          author: review.name,
          preview: rawText.slice(0, 100)
        }),
        tokens_used: 0,
        cost_rub: 0,
        chat_id: 'landing_reviews',
        user_id: 'landing_visitor',
        function_id: 763,
        decision: 'ERROR_FALLBACK'
      });
    } catch (logErr) {}
    // Fallback to allow if moderation service is temporarily down
    return { ok: true };
  }
}

/**
 * AI Moderator for selection channel promo texts via ProTalk Function 763 API.
 * Rules: Exclude spam and links checks (links/self-promo allowed).
 * Focus strictly on: no profanity/mats, compliance with RF legislation, and topic/category suitability.
 */
export async function moderateSelectionTextWith763(params: {
  text: string;
  categories: string[];
  channelName: string;
  channelUsername?: string;
  userId?: string;
}): Promise<{ ok: boolean; reason?: string; selected?: string; details?: any }> {
  const rawText = String(params.text || '').trim();
  if (!rawText) {
    return { ok: false, reason: 'Текст описания канала не может быть пустым' };
  }

  const cleanUid = params.userId ? String(params.userId) : '16926299042';
  const moderatorChatId = `iismm_sel_mod_${cleanUid}_${Date.now()}`;
  const catsStr = (params.categories || []).join(', ') || 'Общая тематика';

  const instructionPrompt = `Ты — строгий ИИ-модератор рекламных описаний каналов для взаимной подборки.
Категории подборки: ${catsStr}.
Канал: ${params.channelName} (${params.channelUsername || ''}).
ВАЖНОЕ ПРАВИЛО: ИСКЛЮЧИ проверку на спам и ссылки! Ссылки на Telegram-каналы, ботов, сайты и рекламные формулировки РАЗРЕШЕНЫ и являются нормой.
ПРОВЕРЯЙ ТОЛЬКО:
1) Отсутствие нецензурной лексики, мата, грубых оскорблений и токсичности.
2) Полное соответствие законодательству РФ: категорический запрет пропаганды наркотиков, оружия, порнографии, казино без лицензий, мошенничества, экстремизма.
3) Адекватность и соответствие описания заявленным категориям подборки (${catsStr}).
Если текст чист от мата, законен и подходит подборке — выбирай "Согласие".
Если в тексте мат, нарушение законов или категорически неподходящая тема — выбирай "Отказ".`;

  try {
    const settings = DB.getSettings();
    const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
    const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

    let logUrl = (settings?.moderationLogUrl !== undefined ? settings.moderationLogUrl : '').trim();
    if (logUrl === '' && settings?.moderationLogUrl === undefined) {
      logUrl = 'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing';
    }

    const argumentsPayload: Record<string, any> = {
      text: rawText.slice(0, 1000),
      instruction: instructionPrompt,
      options: 'Отказ::VIOLATION;;Согласие::OK',
      decision_type: 'choice',
      debug: false,
      log_chat_id: moderatorChatId
    };

    if (logUrl) {
      argumentsPayload.log_url = logUrl;
    }

    const payload = {
      function_id: 763,
      functions_base_id: 'appkq3HrzrxYxoAV8',
      bot_id: Number(protalkBotId) || 66275,
      bot_token: protalkBotToken,
      arguments: argumentsPayload
    };

    const res = await fetch('https://api.pro-talk.ru/api/v1.0/run_function', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Function 763 returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const selected = data?.result?.selected || data?.result?.raw_decision?.choice;
    const otkazProb = Number(data?.result?.probabilities?.['Отказ'] ?? data?.result?.raw_decision?.probabilities?.['Отказ'] ?? 0);
    const soglasieProb = Number(data?.result?.probabilities?.['Согласие'] ?? data?.result?.raw_decision?.probabilities?.['Согласие'] ?? 0);

    const isViolation = (
      selected === 'Отказ' ||
      selected === 'VIOLATION' ||
      String(selected || '').toLowerCase().includes('отказ') ||
      otkazProb > 0.5
    );

    const isApproved = !isViolation;
    const rawTokens = Number(data?.usage?.total_tokens || 12);
    const tokensUsed = rawTokens * 2;
    const costPerTokenRub = Number(settings?.costPerTokenRub || 0.001);
    const costRub = Number((tokensUsed * costPerTokenRub).toFixed(4));

    try {
      const { insertModerationLog } = await import('./db/postgres');
      insertModerationLog({
        level: isApproved ? 'info' : 'warn',
        message: isApproved
          ? `[Модерация 763] Текст канала ${params.channelName} для подборки одобрен (Согласие / OK). Токенов: ${tokensUsed} (${costRub} ₽)`
          : `[Модерация 763] Текст канала ${params.channelName} для подборки отклонен (Отказ / VIOLATION). Токенов: ${tokensUsed} (${costRub} ₽)`,
        details: JSON.stringify({
          context: 'selection_channel_promo',
          channel: params.channelName,
          categories: params.categories,
          decision: isApproved ? 'OK' : 'VIOLATION',
          selected,
          probabilities: { 'Отказ': otkazProb, 'Согласие': soglasieProb },
          tokens_used: tokensUsed,
          cost_rub: costRub,
          preview: rawText.slice(0, 150)
        }),
        tokens_used: tokensUsed,
        cost_rub: costRub,
        chat_id: moderatorChatId,
        user_id: cleanUid,
        function_id: 763,
        decision: isApproved ? 'OK' : 'VIOLATION'
      });
    } catch (logErr) {}

    if (isViolation) {
      return { 
        ok: false, 
        reason: 'Текст отклонен нейромодератором (Функция 763): обнаружены недопустимые выражения, мат, нарушение законодательства или несоответствие категории подборки.',
        selected,
        details: { otkazProb, soglasieProb }
      };
    }

    return { ok: true, selected };
  } catch (err: any) {
    console.warn('[AI Moderator 763 Warning] Selection text check error:', err);
    // Fallback: check basic profanity filter if API request failed
    const lower = rawText.toLowerCase();
    const badWords = ['хуй', 'пизд', 'ебать', 'ебан', 'бляд', 'сука', 'мудак', 'закладк', 'наркот', 'оружие'];
    const hasBadWord = badWords.some(bw => lower.includes(bw));
    if (hasBadWord) {
      return {
        ok: false,
        reason: 'Текст отклонен: обнаружены недопустимые выражения или нецензурная лексика.'
      };
    }
    return { ok: true, selected: 'FALLBACK_OK' };
  }
}


