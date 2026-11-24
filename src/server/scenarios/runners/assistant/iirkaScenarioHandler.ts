import { GoogleGenAI } from '@google/genai';
import { DB, getDefaultChannelIdentifier } from '../../../db';
import { callProTalkBotApi } from '../../../protalk';
import { getPgDB, savePgDB } from '../../../db/postgres';
import { upsertScenarioInDb } from '../../../db/sceneriesTable';
import { addTransactionWithBalanceUpdate } from '../../../db/transactionsTable';
import { syncScenarioCronEntry } from '../../scenarioCronSync';
import { getPricingConfig } from '../../../pricing/pricingService';
import { formatIirkyCount } from '../../../../shared/pricingConfig';
import {
  buildIirkaPrompt,
  IIRKA_ASSISTANT_ACTION_COST,
  IirkaAssistantRequest,
  IirkaAssistantResponse
} from './iirkaPromptBuilder';
import {
  buildFallbackScenarioFromIntent,
  normalizeIirkaScenarioOutput,
  resolveChannelsFromIntent
} from './iirkaGraphNormalizer';

function extractJsonObjectFromText(raw: string): any | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

async function generateRawScenarioJsonWithAi(prompt: string): Promise<any | null> {
  const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.35
        }
      });
      const text = response.text || '';
      const parsed = extractJsonObjectFromText(text);
      if (parsed && (parsed.scenario || Array.isArray(parsed.nodes))) {
        return parsed;
      }
    } catch (err: any) {
      console.warn('[Iirka Assistant] Gemini fallback to ProTalk:', err?.message);
    }
  }

  const settings = DB.getSettings();
  const botId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const botToken =
    settings?.protalkBotToken?.trim() ||
    process.env.PROTALK_BOT_TOKEN ||
    'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  if (botId && botToken) {
    try {
      const isolatedSessionId = `iismm_moderator_iirka_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const rawReply = await callProTalkBotApi(prompt, botId, botToken, isolatedSessionId);
      const parsed = extractJsonObjectFromText(rawReply);
      if (parsed && (parsed.scenario || Array.isArray(parsed.nodes))) {
        return parsed;
      }
    } catch (err: any) {
      console.warn('[Iirka Assistant] ProTalk fallback to intent builder:', err?.message);
    }
  }

  return null;
}

function resolveUserBalanceInfo(sqlDb: any, cleanUserId: string): {
  resolvedUserId: string;
  inMemUser: any | null;
  availableBalance: number;
  foundInSql: boolean;
} {
  const inMemUser =
    DB.getUsers().find(
      (u) => String(u.id) === cleanUserId || String(u.telegramId) === cleanUserId
    ) || null;
  const lookupIds = Array.from(
    new Set([cleanUserId, inMemUser?.id ? String(inMemUser.id) : ''].filter(Boolean))
  );

  for (const candidateId of lookupIds) {
    try {
      const stmt = sqlDb.prepare(`
        SELECT id, balance, balance_free, balance_pay, balance_start, balance_ref, balance_tarif, balance_admin
        FROM users WHERE id = ? OR telegram_id = ? LIMIT 1
      `);
      stmt.bind([candidateId, candidateId]);
      if (stmt.step()) {
        const u = stmt.getAsObject() as any;
        stmt.free();
        const sumComponents =
          Number(u.balance_pay || 0) +
          Number(u.balance_start || 0) +
          Number(u.balance_ref || 0) +
          Number(u.balance_tarif || 0) +
          Number(u.balance_admin || 0);
        const bal = sumComponents > 0 ? sumComponents : Number(u.balance || 0);
        return {
          resolvedUserId: String(u.id || candidateId),
          inMemUser,
          availableBalance: bal,
          foundInSql: true
        };
      }
      stmt.free();
    } catch {}
  }

  return {
    resolvedUserId: inMemUser?.id ? String(inMemUser.id) : cleanUserId,
    inMemUser,
    availableBalance: inMemUser ? Number(inMemUser.balance || 0) : 1000,
    foundInSql: false
  };
}

export async function executeIirkaScenarioAssistant(
  reqBody: IirkaAssistantRequest,
  onEvent?: (evt: Record<string, any>) => void
): Promise<IirkaAssistantResponse> {
  const mode: 'create' | 'edit' = reqBody.mode === 'edit' ? 'edit' : 'create';
  const taskText = String(reqBody.taskText || '').trim();
  if (!taskText) {
    throw new Error('Пожалуйста, опишите голосом или текстом задачу для Иирки.');
  }

  const cleanUserId = String(reqBody.userId || '16926299042').trim();
  const sqlDb = await getPgDB();
  const pricing = await getPricingConfig(sqlDb);
  const assistantCost = pricing.scenarioAi.assistantBuildOrEdit ?? IIRKA_ASSISTANT_ACTION_COST;
  const balanceInfo = resolveUserBalanceInfo(sqlDb, cleanUserId);

  if (assistantCost > 0 && balanceInfo.availableBalance < assistantCost) {
    const err: any = new Error(
      `Недостаточно Иирок на балансе для работы помощницы Иирки. Стоимость ${
        mode === 'edit' ? 'редактирования' : 'создания'
      } сценария: ${formatIirkyCount(assistantCost)}, доступно: ${formatIirkyCount(balanceInfo.availableBalance)}.`
    );
    err.statusCode = 402;
    throw err;
  }

  const preferredFormat: 'auto' | 'v2' | 'rich' =
    reqBody.preferredFormat === 'rich'
      ? 'rich'
      : reqBody.preferredFormat === 'v2'
      ? 'v2'
      : 'auto';

  onEvent?.({
    type: 'stage',
    stageIndex: 1,
    percent: 14,
    stageTitle: 'Анализ задачи и каналов',
    detail: 'Иирка разбирает голосовое или текстовое поручение и проверяет подключенные каналы...'
  });

  const allChannels = DB.getChannels(cleanUserId);
  const defaultChan = getDefaultChannelIdentifier();
  const resolvedChannels = resolveChannelsFromIntent(
    taskText,
    reqBody.targetChannels || reqBody.existingScenario?.targetChannels || [],
    allChannels,
    defaultChan
  );

  const userScenarios = DB.getScenarios(cleanUserId);
  const existingNames = userScenarios.map((s) => String(s.name || '').trim()).filter(Boolean);

  let existingScenario = reqBody.existingScenario || null;
  if (mode === 'edit' && existingScenario?.id && (!existingScenario.nodes || existingScenario.nodes.length === 0)) {
    const fromDb = userScenarios.find((s) => s.id === existingScenario!.id);
    if (fromDb) {
      existingScenario = {
        ...fromDb,
        description: fromDb.description || '',
        category: fromDb.category || 'Контент и маркетинг'
      } as any;
    }
  }

  onEvent?.({
    type: 'stage',
    stageIndex: 2,
    percent: 38,
    stageTitle:
      mode === 'edit'
        ? 'Проектирование правок цепочки'
        : 'Подбор формата и архитектуры шагов',
    detail:
      mode === 'edit'
        ? `Иирка анализирует блоки сценария «${existingScenario?.name || 'Текущий сценарий'}» и готовит обновления...`
        : 'Иирка подбирает оптимальные блоки, расписание и промпты под вашу задачу...'
  });

  const prompt = await buildIirkaPrompt({
    mode,
    taskText,
    preferredFormat,
    selectedChannels: resolvedChannels,
    availableChannels: allChannels,
    existingScenario,
    existingNames,
    refinementHistory: reqBody.refinementHistory
  });

  onEvent?.({
    type: 'stage',
    stageIndex: 3,
    percent: 65,
    stageTitle: 'Настройка блоков, промптов и расписания',
    detail: 'Иирка заполняет параметры каждого шага и связывает узлы графа...'
  });

  let rawAiPayload = await generateRawScenarioJsonWithAi(prompt);
  if (!rawAiPayload) {
    rawAiPayload = buildFallbackScenarioFromIntent({
      mode,
      taskText,
      preferredFormat,
      channels: resolvedChannels,
      existingScenario
    });
  }

  onEvent?.({
    type: 'stage',
    stageIndex: 4,
    percent: 88,
    stageTitle: 'Проверка совместимости и расчет стоимости',
    detail: 'Проверка правил формата, координат карты блоков и фиксация операции...'
  });

  const settings = DB.getSettings();
  const normalized = normalizeIirkaScenarioOutput({
    mode,
    rawAiPayload,
    taskText,
    preferredFormat,
    resolvedChannels,
    existingScenario,
    existingNames,
    settings,
    cleanUserId
  });

  let savedToDb = false;
  let persistedScenario = normalized.scenario;

  if (reqBody.autoSave) {
    const dbPayload = {
      ...persistedScenario,
      description: persistedScenario.description || '',
      category: persistedScenario.category || 'Контент и маркетинг',
      topicCategory: persistedScenario.topicCategory || 'Бизнес и Маркетинг'
    };
    const isExistingInDb = userScenarios.some((s) => s.id === persistedScenario.id);
    const savedRecord = isExistingInDb
      ? DB.updateScenario(persistedScenario.id, dbPayload)
      : DB.addScenario(dbPayload);
    persistedScenario = {
      ...savedRecord,
      description: savedRecord.description || persistedScenario.description || '',
      category: savedRecord.category || persistedScenario.category || 'Контент и маркетинг'
    } as any;
    upsertScenarioInDb(sqlDb, savedRecord);
    await syncScenarioCronEntry(savedRecord);
    savedToDb = true;
  }

  // Списание динамической стоимости за создание или редактирование сценария через помощницу Иирку
  let updatedBalance = Math.max(0, balanceInfo.availableBalance - assistantCost);
  if (assistantCost > 0) {
    try {
      const txRes = addTransactionWithBalanceUpdate(sqlDb, {
        userId: balanceInfo.resolvedUserId,
        type: 'cost',
        amount: assistantCost,
        description:
          mode === 'edit'
            ? `Редактирование сценария через Иирку: «${persistedScenario.name}»`
            : `Создание сценария через Иирку: «${persistedScenario.name}»`,
        comment: `Поручение: "${taskText.slice(0, 80)}"`
      });
      if (balanceInfo.foundInSql && typeof txRes?.newBalances?.balance === 'number') {
        updatedBalance = txRes.newBalances.balance;
      }
    } catch (txErr) {
      console.warn('[Iirka Assistant] Transaction record warning:', txErr);
    }
  }

  if (balanceInfo.inMemUser) {
    try {
      const synced = DB.updateUser(balanceInfo.inMemUser.id, { balance: updatedBalance });
      updatedBalance = synced.balance;
    } catch {}
  }

  savePgDB();

  const finalResult: IirkaAssistantResponse = {
    success: true,
    mode,
    savedToDb,
    chargedCost: assistantCost,
    newBalance: updatedBalance,
    assistantSummary: normalized.assistantSummary,
    highlights: normalized.highlights,
    estimatedRunCost: normalized.estimatedRunCost,
    scenario: persistedScenario,
    stepDiffs: normalized.stepDiffs
  };

  onEvent?.({
    type: 'stage',
    stageIndex: 5,
    percent: 100,
    stageTitle: 'Сценарий готов',
    detail: normalized.assistantSummary
  });

  onEvent?.({
    type: 'done',
    result: finalResult
  });

  return finalResult;
}
