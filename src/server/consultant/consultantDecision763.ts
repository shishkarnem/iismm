import { DB } from '../db';
import { insertModerationLog } from '../db/postgres';

export const DEFAULT_CONSULTANT_LOG_URL =
  'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing';

export type ConsultantDbCategoryKey =
  | 'academy'
  | 'tariffs_pricing'
  | 'user_balance_profile'
  | 'channels_posts_scenarios'
  | 'folders_selections_teams'
  | 'oferta_rules_general';

export const CONSULTANT_763_OPTIONS = [
  'academy::Уроки и инструкции Академии: как пользоваться редактором постов, сценариями, календарем, кросспостингом, галереей, соцсетью и функциями платформы (таблица academy_articles)',
  'tariffs_pricing::Тарифы Старт, Разгон, Отрыв, Космос, цены в рублях, пакеты Иирок, скидки и стоимость генерации постов или картинок (таблицы tariffs и protalk_settings)',
  'user_balance_profile::Личный профиль пользователя, его текущий баланс Иирок, активный тариф, реферальный баланс и история транзакций (таблицы users и transactions)',
  'channels_posts_scenarios::Подключенные каналы пользователя, черновики и посты, расписание в календаре крон и цепочки автопостинга (таблицы channels, posts, sceneries, cron)',
  'folders_selections_teams::Папки взаимного пиара, тематические подборки каналов, команды соавторов и публикации блога (таблицы promo_folders, promo_selections, teams, blog_posts)',
  'oferta_rules_general::Договор публичной оферты, юридические реквизиты, правила модерации и общие вопросы о сервисе'
].join(';;');

const DEFAULT_CONSULTANT_763_INSTRUCTION = `Ты — интеллектуальный маршрутизатор запросов к базе данных платформы ИиSMM.
Проанализируй вопрос пользователя (и текущую страницу, на которой он находится) и выбери один наиболее точный ключ раздела базы данных PostgreSQL ProTalk, откуда код должен извлечь строки и колонки для формирования ответа:
- Выбирай "academy", если пользователь спрашивает, как работает какой-либо инструмент, кнопка, редактор V2 или Rich, сценарии, кросспостинг, календарь, галерея или просит инструкцию по шагам.
- Выбирай "tariffs_pricing", если вопрос касается стоимости тарифов (Старт, Разгон, Отрыв, Космос), цен, скидок, курса Иирок или сколько стоит генерация текста/картинки.
- Выбирай "user_balance_profile", если пользователь спрашивает про свой собственный баланс Иирок, свой текущий тариф, свои списания/пополнения, профиль или рефералов.
- Выбирай "channels_posts_scenarios", если пользователь спрашивает про свои подключенные каналы, свои созданные или запланированные посты, расписание выходов или свои сценарии автопостинга.
- Выбирай "folders_selections_teams", если вопрос про папки взаимного пиара, подборки каналов, рабочие команды или ленту блога.
- Выбирай "oferta_rules_general", если вопрос про публичную оферту, юридические условия, возврат, модерацию или общее приветствие/знакомство с сервисом.`;

export interface ProTalk763DecisionParams {
  text: string;
  instruction?: string;
  options?: string;
  decision_type?: 'choice' | 'noul' | 'score';
  images_urls?: string;
  ai_model?:
    | '~typesafe/jev-latest'
    | 'perplexity/pplx-decider-v1-27b'
    | 'openai/gpt-6-luna-decisions';
  debug?: boolean;
  chatId: string;
  userId?: string;
  currentPath?: string;
  recentContext?: string;
}

export interface ProTalk763DecisionResult {
  selectedKey: ConsultantDbCategoryKey;
  rawSelected: string;
  probabilities: Record<string, number>;
  tokensUsed: number;
  costRub: number;
  usedFallback: boolean;
}

function fallbackClassifyByKeywords(rawQuestion: string, currentPath: string = ''): ConsultantDbCategoryKey {
  const q = `${rawQuestion} ${currentPath}`.toLowerCase();

  if (/(мой баланс|сколько у меня|мои иирк|мои транзакц|мой тариф|мой профил|реферал|списал|пополнен)/i.test(q)) {
    return 'user_balance_profile';
  }
  if (/(тариф|разгон|отрыв|космос|скольк.*стоит|цена|цены|стоимост|подписк|оплат|бесплатн.*иир)/i.test(q)) {
    return 'tariffs_pricing';
  }
  if (/(мои канал|мой канал|мои пост|черновик|мои сценар|расписан|запланирован|крон)/i.test(q)) {
    return 'channels_posts_scenarios';
  }
  if (/(папк|подборк|взаимн|команд|соавтор|бирж)/i.test(q)) {
    return 'folders_selections_teams';
  }
  if (/(оферт|договор|юридич|инн|огрн|рентроп|правил.*модерац|закон)/i.test(q)) {
    return 'oferta_rules_general';
  }
  if (/(как |инструкц|настро|создат|подключ|редактор|сценари|галере|календар|академи|кнопк|формат)/i.test(q)) {
    return 'academy';
  }
  if (currentPath.startsWith('/tarif') || currentPath === '/prices') return 'tariffs_pricing';
  if (currentPath.startsWith('/folders')) return 'folders_selections_teams';
  if (currentPath.startsWith('/oferta')) return 'oferta_rules_general';
  return 'academy';
}

function normalizeSelectedCategory(rawSelected: any, fallbackQuestion: string, currentPath?: string): ConsultantDbCategoryKey {
  const val = String(rawSelected || '').trim().toLowerCase();
  const validKeys: ConsultantDbCategoryKey[] = [
    'academy',
    'tariffs_pricing',
    'user_balance_profile',
    'channels_posts_scenarios',
    'folders_selections_teams',
    'oferta_rules_general'
  ];

  for (const key of validKeys) {
    if (val === key || val.startsWith(`${key}::`) || val.includes(key)) {
      return key;
    }
  }

  return fallbackClassifyByKeywords(fallbackQuestion, currentPath);
}

/**
 * Calls ProTalk Function 763 (protalk_ai_decision) to classify the user's question
 * and determine which PostgreSQL table/section holds the ground-truth data.
 * Always passes the unified log_chat_id and Google Sheets log_url.
 */
export async function classifyConsultantQuestionWith763(
  params: ProTalk763DecisionParams
): Promise<ProTalk763DecisionResult> {
  const rawQuestion = String(params.text || '').trim();
  const chatId = String(params.chatId || 'iismm_consultant_guest_default').trim();
  const cleanUid = String(params.userId || 'guest').trim() || 'guest';
  const currentPath = String(params.currentPath || '/').trim();

  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken =
    settings?.protalkBotToken?.trim() ||
    process.env.PROTALK_BOT_TOKEN ||
    'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

  // Always pass log_url to Google Sheets per requirement (allowing custom URL if non-empty, else mandatory default)
  const configuredLogUrl = (settings?.moderationLogUrl || '').trim();
  const logUrl = configuredLogUrl || DEFAULT_CONSULTANT_LOG_URL;

  const dbPrompt = DB.getSystemPromptByKey('ai_consultant_763');
  const effectiveInstruction =
    params.instruction?.trim() || dbPrompt?.promptText?.trim() || DEFAULT_CONSULTANT_763_INSTRUCTION;

  const composedText = [
    `Вопрос пользователя: ${rawQuestion}`,
    `Текущая страница интерфейса: ${currentPath}`,
    params.recentContext ? `Краткий контекст диалога:\n${params.recentContext}` : ''
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 30000);

  const cleanImagesUrls = String(params.images_urls || '').trim();
  const hasImages = cleanImagesUrls.length > 0;

  const effectiveAiModel =
    params.ai_model ||
    (hasImages || composedText.length > 28000
      ? 'perplexity/pplx-decider-v1-27b'
      : '~typesafe/jev-latest');

  const argumentsPayload: Record<string, any> = {
    text: composedText,
    instruction: effectiveInstruction,
    options: params.options || CONSULTANT_763_OPTIONS,
    decision_type: params.decision_type || 'choice',
    ai_model: effectiveAiModel,
    debug: Boolean(params.debug ?? false),
    log_chat_id: chatId,
    log_url: logUrl
  };

  if (hasImages) {
    argumentsPayload.images_urls = cleanImagesUrls;
  }

  try {
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
      signal: AbortSignal.timeout(18000)
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Function 763 HTTP ${res.status}: ${errBody}`);
    }

    const data = (await res.json()) as any;
    const rawSelected = String(
      data?.result?.selected ?? data?.result?.raw_decision?.choice ?? ''
    ).trim();
    const probabilities: Record<string, number> =
      data?.result?.probabilities || data?.result?.raw_decision?.probabilities || {};

    const selectedKey = normalizeSelectedCategory(rawSelected, rawQuestion, currentPath);

    const rawTokens = Number(data?.usage?.total_tokens || 14);
    const tokensUsed = rawTokens * 2;
    const costPerTokenRub = Number(settings?.costPerTokenRub || 0.001);
    const costRub = Number((tokensUsed * costPerTokenRub).toFixed(4));

    try {
      insertModerationLog({
        level: 'info',
        message: `[Ии-консультант 763] Выбран источник базы: ${selectedKey}. Токенов: ${tokensUsed} (${costRub} ₽)`,
        details: JSON.stringify({
          context: 'ai_consultant_db_router',
          function_id: 763,
          selected_key: selectedKey,
          raw_selected: rawSelected,
          probabilities,
          ai_model: effectiveAiModel,
          images_urls: cleanImagesUrls || undefined,
          log_chat_id: chatId,
          log_url: logUrl,
          question_preview: rawQuestion.slice(0, 180)
        }),
        tokens_used: tokensUsed,
        cost_rub: costRub,
        chat_id: chatId,
        user_id: cleanUid,
        function_id: 763,
        decision: selectedKey
      });
    } catch {}

    return {
      selectedKey,
      rawSelected: rawSelected || selectedKey,
      probabilities,
      tokensUsed,
      costRub,
      usedFallback: false
    };
  } catch (err: any) {
    const fallbackKey = fallbackClassifyByKeywords(rawQuestion, currentPath);
    try {
      insertModerationLog({
        level: 'warn',
        message: `[Ии-консультант 763 резерв] Классификация по локальным правилам: ${fallbackKey} (${err?.message || 'ошибка сети'})`,
        details: JSON.stringify({
          context: 'ai_consultant_db_router_fallback',
          error: String(err?.message || err),
          fallback_key: fallbackKey,
          log_chat_id: chatId,
          log_url: logUrl,
          question_preview: rawQuestion.slice(0, 180)
        }),
        tokens_used: 0,
        cost_rub: 0,
        chat_id: chatId,
        user_id: cleanUid,
        function_id: 763,
        decision: fallbackKey
      });
    } catch {}

    return {
      selectedKey: fallbackKey,
      rawSelected: fallbackKey,
      probabilities: {},
      tokensUsed: 0,
      costRub: 0,
      usedFallback: true
    };
  }
}
