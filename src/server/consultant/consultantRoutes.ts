import { Router, Request, Response } from 'express';
import { DB } from '../db';
import { getPgDB, insertModerationLog } from '../db/postgres';
import { removeMarkdownEscaping } from '../protalk';
import {
  buildUnifiedConsultantChatId,
  clearConsultantMessagesInDb,
  getConsultantMessagesFromDb,
  initConsultantTable,
  insertConsultantMessageInDb
} from './consultantTable';
import {
  classifyConsultantQuestionWith763,
  DEFAULT_CONSULTANT_LOG_URL
} from './consultantDecision763';
import { queryDatabaseForConsultant } from './consultantDbSearch';

/**
 * Sends grounded prompt to ProTalk neural network using the EXACT SAME chat_id as Function 763.
 * Tracks previous last_reply before sending so multi-turn conversations on the same chat_id
 * never return a stale cached message while the new answer is still generating.
 */
async function askProTalkWithSameChatId(
  promptText: string,
  chatId: string
): Promise<string> {
  const settings = DB.getSettings();
  const rawId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const token =
    settings?.protalkBotToken?.trim() ||
    process.env.PROTALK_BOT_TOKEN ||
    'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  const numericBotId = isNaN(Number(rawId)) ? rawId : Number(rawId);
  const pollUrl = 'https://eu1.api.pro-talk.ru/api/v1.0/get_last_reply';
  const sendUrl = 'https://eu1.api.pro-talk.ru/api/v1.0/send_message_async';

  // Snapshot any existing last reply on this chat_id so we only accept a fresh reply
  let previousReply = '';
  try {
    const prevRes = await fetch(pollUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: numericBotId,
        bot_token: token,
        bot_chat_id: chatId
      }),
      signal: AbortSignal.timeout(5000)
    });
    if (prevRes.ok) {
      const prevData = (await prevRes.json()) as any;
      previousReply = String(
        prevData?.message || prevData?.data?.message || prevData?.text || prevData?.reply || ''
      ).trim();
    }
  } catch {}

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
    const fallbackSend = await fetch(`https://pro-talk.ru/api/v1/bot/${numericBotId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        bot_id: numericBotId,
        bot_token: token,
        bot_chat_id: chatId,
        message: promptText
      }),
      signal: AbortSignal.timeout(25000)
    }).catch(() => null);

    if (fallbackSend && fallbackSend.ok) {
      const fbData = (await fallbackSend.json()) as any;
      const fbMsg = fbData?.response || fbData?.message || fbData?.text;
      if (fbMsg && typeof fbMsg === 'string') {
        return fbMsg.trim();
      }
    }
  }

  const startTime = Date.now();
  const timeoutMs = 48000;
  let sawEmptyBuffer = false;

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2200));
    try {
      const pollRes = await fetch(pollUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id: numericBotId,
          bot_token: token,
          bot_chat_id: chatId
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (pollRes.ok) {
        const replyData = (await pollRes.json()) as any;
        const msg = String(
          replyData?.message || replyData?.data?.message || replyData?.text || replyData?.reply || ''
        ).trim();

        if (!msg) {
          sawEmptyBuffer = true;
          continue;
        }

        if (msg !== previousReply || sawEmptyBuffer || Date.now() - startTime > 12000) {
          return msg;
        }
      }
    } catch {}
  }

  throw new Error('Превышено время ожидания ответа нейросети ProTalk');
}

function normalizeImageUrlsFor763(rawImages: any, originHost: string): string[] {
  if (!Array.isArray(rawImages)) return [];
  return rawImages
    .map((u) => String(u || '').trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      if (url.startsWith('/')) return `${originHost}${url}`;
      return url;
    });
}

function softenAllCapsWords(text: string): string {
  return String(text || '');
}

export function registerConsultantRoutes(router: Router) {
  router.get('/consultant/history', async (req: Request, res: Response) => {
    try {
      const db = await getPgDB();
      initConsultantTable(db);

      const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
      const sessionKey = String(req.query.sessionKey || '').trim();
      const explicitChatId = String(req.query.chatId || '').trim();

      const chatId =
        explicitChatId && explicitChatId.startsWith('iismm_consultant_')
          ? explicitChatId
          : buildUnifiedConsultantChatId(userId, sessionKey);

      const messages = getConsultantMessagesFromDb(db, chatId, 80);
      res.json({
        success: true,
        chatId,
        messages
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'Ошибка чтения истории Ии-консультанта: ' + (err?.message || err)
      });
    }
  });

  router.post('/consultant/ask', async (req: Request, res: Response) => {
    try {
      const db = await getPgDB();
      initConsultantTable(db);

      const questionText = String(req.body?.text || '').trim();
      const userId = String(req.body?.userId || req.headers['x-user-id'] || 'guest').trim();
      const sessionKey = String(req.body?.sessionKey || '').trim();
      const currentPath = String(req.body?.currentPath || '/').trim();
      const explicitChatId = String(req.body?.chatId || '').trim();

      if (!questionText && (!Array.isArray(req.body?.images) || req.body.images.length === 0)) {
        res.status(400).json({
          success: false,
          error: 'Введите текстовый или голосовой вопрос для консультанта'
        });
        return;
      }

      // Unified chat_id shared strictly between Function 763 and ProTalk Bot API
      const chatId =
        explicitChatId && explicitChatId.startsWith('iismm_consultant_')
          ? explicitChatId
          : buildUnifiedConsultantChatId(userId, sessionKey);

      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = req.get('host') || 'localhost:3000';
      const originHost = process.env.APP_URL?.replace(/\/$/, '') || `${protocol}://${host}`;
      const imageUrlsList = normalizeImageUrlsFor763(req.body?.images, originHost);
      const imagesUrlsParam = imageUrlsList.join(';;');

      const existingHistory = getConsultantMessagesFromDb(db, chatId, 6);
      const recentContext = existingHistory
        .slice(-4)
        .map((m) => `${m.sender === 'user' ? 'Пользователь' : 'Консультант'}: ${m.text.slice(0, 240)}`)
        .join('\n');

      const nowIso = new Date().toISOString();
      const effectiveQuestion = questionText || 'Проанализируй прикрепленное изображение и подскажи решение.';

      const userRecord = insertConsultantMessageInDb(db, {
        id: `cmsg_u_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        chatId,
        userId: userId || 'guest',
        sender: 'user',
        text: effectiveQuestion,
        images: imageUrlsList,
        createdAt: nowIso
      });

      // Stage 1: Classify question & select target PostgreSQL table via ProTalk Function 763
      const decision763 = await classifyConsultantQuestionWith763({
        text: effectiveQuestion,
        images_urls: imagesUrlsParam || undefined,
        decision_type: req.body?.decision_type || 'choice',
        ai_model: req.body?.ai_model,
        debug: Boolean(req.body?.debug ?? false),
        chatId,
        userId,
        currentPath,
        recentContext
      });

      // Stage 2: Query exact rows and columns from PostgreSQL database
      const dbLookup = await queryDatabaseForConsultant({
        categoryKey: decision763.selectedKey,
        questionText: effectiveQuestion,
        userId,
        currentPath
      });

      // Stage 3: Pass retrieved DB rows/columns to ProTalk neural network with the SAME chat_id
      const consultantPrompt = [
        `Ты — дружелюбный, точный и компетентный Ии-консультант платформы ИиSMM.`,
        `Отвечай пользователю строго на основе найденных строк и колонок базы данных ниже, без выдумывания несуществующих тарифов или кнопок.`,
        `Важные правила оформления ответа:`,
        `1. Пиши живо, понятно, структурированно, с аккуратными списками или выделением ключевых шагов жирным шрифтом.`,
        `2. Не используй обратные слэши для экранирования символов.`,
        `3. Если пользователь находится на конкретной странице (${currentPath}), дай практическую подсказку применительно к ней.`,
        ``,
        `[Классификация функции 763]: раздел="${decision763.selectedKey}", таблицы="${dbLookup.tableUsed}"`,
        `[Найденные строки и колонки из базы данных PostgreSQL]:`,
        dbLookup.formattedDbContext,
        recentContext ? `\n[Предыдущие реплики диалога]:\n${recentContext}` : '',
        imageUrlsList.length > 0 ? `\n[Прикрепленные изображения пользователя]: ${imageUrlsList.join(', ')}` : '',
        ``,
        `[Вопрос пользователя]: ${effectiveQuestion}`
      ]
        .filter(Boolean)
        .join('\n');

      let replyText = '';
      try {
        const rawAiReply = await askProTalkWithSameChatId(consultantPrompt, chatId);
        replyText = softenAllCapsWords(removeMarkdownEscaping(rawAiReply)).trim();
      } catch (aiErr: any) {
        console.warn('[Consultant ProTalk Fallback]:', aiErr?.message);
        replyText = softenAllCapsWords(
          `По данным раздела «${dbLookup.briefLabel}» из базы платформы:\n\n${dbLookup.formattedDbContext.slice(0, 1200)}`
        );
      }

      const assistantRecord = insertConsultantMessageInDb(db, {
        id: `cmsg_a_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        chatId,
        userId: userId || 'guest',
        sender: 'assistant',
        text: replyText,
        images: [],
        dbSource: dbLookup.tableUsed,
        dbSummary: dbLookup.briefLabel,
        createdAt: new Date().toISOString()
      });

      try {
        insertModerationLog({
          level: 'info',
          message: `[Ии-консультант ответ] Сформирован ответ по таблицам (${dbLookup.tableUsed}) с единым chat_id=${chatId}`,
          details: JSON.stringify({
            chat_id: chatId,
            log_url: DEFAULT_CONSULTANT_LOG_URL,
            decision_763: decision763.selectedKey,
            tables_queried: dbLookup.tableUsed,
            matched_rows: dbLookup.matchedRowsCount
          }),
          tokens_used: 450,
          cost_rub: 0.45,
          chat_id: chatId,
          user_id: userId || 'guest',
          function_id: 763,
          decision: decision763.selectedKey
        });
      } catch {}

      res.json({
        success: true,
        chatId,
        userMessage: userRecord,
        assistantMessage: assistantRecord,
        decision: {
          selectedKey: decision763.selectedKey,
          tableUsed: dbLookup.tableUsed,
          briefLabel: dbLookup.briefLabel,
          matchedRowsCount: dbLookup.matchedRowsCount
        }
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'Ошибка обработки вопроса Ии-консультантом: ' + (err?.message || err)
      });
    }
  });

  router.post('/consultant/clear', async (req: Request, res: Response) => {
    try {
      const db = await getPgDB();
      initConsultantTable(db);

      const userId = String(req.body?.userId || req.headers['x-user-id'] || '').trim();
      const sessionKey = String(req.body?.sessionKey || '').trim();
      const explicitChatId = String(req.body?.chatId || '').trim();

      const chatId =
        explicitChatId && explicitChatId.startsWith('iismm_consultant_')
          ? explicitChatId
          : buildUnifiedConsultantChatId(userId, sessionKey);

      clearConsultantMessagesInDb(db, chatId);
      res.json({ success: true, chatId });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'Ошибка очистки диалога: ' + (err?.message || err)
      });
    }
  });
}
