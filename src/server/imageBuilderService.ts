import { DB } from './db';
import { getPgDB, savePgDB } from './db/postgres';
import { addTransactionWithBalanceUpdate } from './db/transactionsTable';
import { callProTalkFunction621 } from './protalk';
import { callProTalkFunction791 } from './image-gen/callProTalkFunction791';
import {
  formatImageLogChatId,
  persistGeneratedImageToGallery
} from './image-gen/persistGeneratedImageToGallery';
import { getPricingConfig } from './pricing/pricingService';

export interface UnifiedImageGenerationParams {
  mode: 'func_621' | 'func_784' | 'func_787' | 'func_791' | 'no_text' | 'with_text' | 'free';
  prompt: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | 'auto' | string;
  referenceUrl?: string;
  userId?: string;
  resolution?: string;
  logChatId?: string;
  // Function 787 & 791 specific parameters
  ai_model?: string;
  size?: string;
  quality?: string;
  output_format?: string;
  response_format?: string;
  images?: string;
  images_url?: string;
  images_urls?: string;
  background?: string;
  generation_mode?: 'sync' | 'async' | 'stream';
  debug?: boolean;
  skipBilling?: boolean;
  skipHiddenRule?: boolean;
  hostProtocol?: { host: string; protocol: string };
}

export interface UnifiedImageGenerationResult {
  ok: boolean;
  imageUrl?: string;
  originalUrl?: string;
  cost?: number;
  mode?: string;
  aspectRatio?: string;
  size?: string;
  tokensUsed?: number;
  costRub?: number;
  model?: string;
  error?: string;
  status?: number;
}

function sanitizeProTalkError(rawText: string, status: number, fnLabel: string): string {
  if (!rawText) {
    return `${fnLabel} временно недоступна (статус ${status}). Попробуйте повторить генерацию.`;
  }

  let extracted = rawText;
  const titleMatch = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    extracted = titleMatch[1];
  } else {
    try {
      const parsed = JSON.parse(rawText);
      const jsonErr = parsed?.error || parsed?.message || parsed?.result?.error || parsed?.detail;
      if (jsonErr) {
        extracted = typeof jsonErr === 'string' ? jsonErr : JSON.stringify(jsonErr);
      }
    } catch {
      extracted = rawText.replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
    }
  }

  const decoded = extracted
    .replace(/&#39;/g, "'")
    .replace(/&#34;|&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\/\/\s*Werkzeug Debugger/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (/protalk_images/i.test(decoded) || status >= 500) {
    return `${fnLabel}: временная перегрузка внешнего сервера генерации (${status}). Пожалуйста, нажмите «Сгенерировать» еще раз.`;
  }

  return `${fnLabel} вернула ошибку (${status}): ${decoded.slice(0, 200)}`;
}

function normalizeImageUrlsCsv(input?: string): string | undefined {
  if (!input || !input.trim()) return undefined;
  const cleaned = input
    .split(',')
    .map(item => item.trim())
    .filter(item => /^(https?:\/\/|data:image\/)/i.test(item));
  return cleaned.length > 0 ? cleaned.slice(0, 4).join(',') : undefined;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const HIDDEN_FUNCTION_PROMPT_RULES: Record<787 | 621 | 784, string> = {
  787: 'Строго без текста.',
  621: 'Избегать текста и избегать инфографики.',
  784: 'Избегать большого количества текста и инфографики.'
};

function truncateUtf8Safe(input: string, maxChars: number, maxBytes: number): string {
  let text = input.trim();
  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
    const lastSpace = text.lastIndexOf(' ');
    if (lastSpace > Math.floor(maxChars * 0.7)) {
      text = text.slice(0, lastSpace);
    }
  }
  while (Buffer.byteLength(text, 'utf8') > maxBytes && text.length > 20) {
    const cutTarget = Math.max(20, text.length - 25);
    text = text.slice(0, cutTarget);
    const lastSpace = text.lastIndexOf(' ');
    if (lastSpace > Math.floor(cutTarget * 0.7)) {
      text = text.slice(0, lastSpace);
    }
  }
  return text.replace(/[,;:\-\s]+$/, '').trim();
}

export function sanitizeImagePromptText(rawPrompt: string): string {
  let text = String(rawPrompt || '')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim();

  // If raw JSON accidentally leaked into the prompt, extract meaningful text fields
  if (text.includes('"title"') && text.includes('"content"')) {
    const imgPromptField = text.match(/"(?:imagePrompt|image_prompt)"\s*:\s*"([^"]+)"/i);
    const titleField = text.match(/"title"\s*:\s*"([^"]+)"/i);
    if (imgPromptField?.[1]) {
      text = imgPromptField[1];
    } else if (titleField?.[1]) {
      text = `Современная иллюстрация к теме «${titleField[1]}», мягкий свет, высокая детализация`;
    }
  }

  text = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * Скрытно добавляет обязательное правило к промпту перед отправкой в функцию генерации картинки,
 * соблюдая жесткие лимиты провайдера AnyModel по символам и UTF-8 байтам (защита от HTTP 422).
 */
export function appendHiddenImageFunctionRule(
  rawPrompt: string,
  fnId: 787 | 621 | 784,
  maxBaseCharsOverride?: number
): string {
  const cleaned = sanitizeImagePromptText(rawPrompt);
  const rule = HIDDEN_FUNCTION_PROMPT_RULES[fnId];
  const suffix = `. Обязательное правило: ${rule}`;

  // Function 787 (am/flux.2-klein-4b) rejects prompts above ~800 Cyrillic chars (~1500 UTF-8 bytes) with 422
  const defaultMaxChars = fnId === 787 ? 560 : 1100;
  const maxBaseChars = maxBaseCharsOverride ? Math.min(defaultMaxChars, maxBaseCharsOverride) : defaultMaxChars;
  const maxBaseBytes = fnId === 787 ? Math.min(1020, maxBaseChars * 2) : 2100;

  if (!cleaned) {
    return `Современная эстетичная иллюстрация, мягкий свет, высокая детализация${suffix}`;
  }

  const normalizedRuleCheck = rule.replace(/\.$/, '').toLowerCase();
  const withoutExistingRule = cleaned
    .replace(/\.\s*Обязательное правило:\s*[^.]+(?:\.|$)/gi, '')
    .trim();

  const sourceText = withoutExistingRule || cleaned;
  const clampedBase = truncateUtf8Safe(sourceText, maxBaseChars, maxBaseBytes).replace(/[.!?\s]+$/, '');

  if (!clampedBase) {
    return `Современная эстетичная иллюстрация, мягкий свет${suffix}`;
  }
  if (clampedBase.toLowerCase().includes(normalizedRuleCheck)) {
    return clampedBase.endsWith('.') ? clampedBase : `${clampedBase}.`;
  }
  return `${clampedBase}${suffix}`;
}

/**
 * Direct call to ProTalk Function 784 for Image Generation with Text & Reference image
 * POST https://api.pro-talk.ru/api/v1.0/run_function
 */
export async function callProTalkFunction784(options: {
  prompt: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | string;
  filesUrl?: string;
  resolution?: string;
  logUrl?: string;
  logChatId?: string;
  userId?: string;
}): Promise<{
  imageUrl: string;
  originalUrl: string;
  downloadUrl: string;
  width?: number;
  height?: number;
  fileSize?: number;
  tokensUsed: number;
  costRub: number;
  model?: string;
}> {
  const {
    prompt,
    aspectRatio = '9:16',
    filesUrl,
    logChatId,
    userId = '16926299042'
  } = options;

  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';
  const functionId = settings?.function784Id || 784;

  const effectiveLogChatId = formatImageLogChatId(784, userId);
  const effectiveLogUrl = options.logUrl || settings?.moderationLogUrl || 'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing';

  const base784Prompt = prompt.trim() || 'Poster with modern typography and creative graphic design, 4k resolution';
  const outbound784Prompt = appendHiddenImageFunctionRule(base784Prompt, 784);

  const args: Record<string, any> = {
    prompt: outbound784Prompt,
    aspect_ratio: aspectRatio,
    resolution: '1K',
    debug: false,
    log_url: effectiveLogUrl,
    log_chat_id: effectiveLogChatId
  };

  const normalizedFilesUrl = normalizeImageUrlsCsv(filesUrl);
  if (normalizedFilesUrl) {
    args.filesUrl = normalizedFilesUrl;
  }

  const payload = {
    function_id: Number(functionId) || 784,
    functions_base_id: 'appkq3HrzrxYxoAV8',
    bot_id: Number(protalkBotId) || 66275,
    bot_token: protalkBotToken,
    arguments: args
  };

  let resData: any = null;
  let lastErrorMsg = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://api.pro-talk.ru/api/v1.0/run_function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastErrorMsg = sanitizeProTalkError(errText, res.status, 'Функция 784');
        console.warn(`[ImageBuilder 784] Attempt ${attempt} returned HTTP ${res.status}`);
        if (attempt < 2 && res.status >= 500) {
          await delay(900 * attempt);
          continue;
        }
        throw new Error(lastErrorMsg);
      }

      resData = await res.json();
      break;
    } catch (err: any) {
      lastErrorMsg = err?.message || 'Ошибка соединения при вызове функции 784';
      if (attempt < 2 && !err?.name?.includes('Timeout')) {
        await delay(900 * attempt);
        continue;
      }
      throw new Error(lastErrorMsg);
    }
  }

  const imgObj = resData?.images?.[0] || resData?.result?.images?.[0];
  const originalUrl = imgObj?.url;

  if (!originalUrl) {
    const errMsg = resData?.error || resData?.message || resData?.result?.error || 'Функция 784 не вернула изображение';
    throw new Error(String(errMsg));
  }

  const tokensUsed = Number(resData?.usage?.total_tokens || resData?.result?.usage?.total_tokens || 60000);
  const costRub = Number(resData?.usage?.cost_rub || resData?.result?.usage?.cost_rub || 0.9);
  const modelName = resData?.model || resData?.result?.model || 'black-forest-labs/flux-3-image-klein';

  try {
    const { insertModerationLog } = await import('./db/postgres');
    insertModerationLog({
      level: 'info',
      message: `[Генерация картинок с текстом 784] Изображение создано (${costRub} ₽, ${tokensUsed} токенов)`,
      details: JSON.stringify({
        function_id: functionId,
        prompt: prompt.slice(0, 200),
        aspect_ratio: aspectRatio,
        resolution: '1K',
        filesUrl: normalizedFilesUrl || null,
        log_chat_id: effectiveLogChatId,
        url: originalUrl,
        tokens_used: tokensUsed,
        cost_rub: costRub,
        model: modelName
      }),
      tokens_used: tokensUsed,
      cost_rub: costRub,
      chat_id: effectiveLogChatId,
      user_id: String(userId),
      function_id: Number(functionId) || 784,
      decision: 'OK'
    });
  } catch (logErr) {}

  return {
    imageUrl: originalUrl,
    originalUrl,
    downloadUrl: originalUrl,
    fileSize: imgObj?.size_bytes || 0,
    tokensUsed,
    costRub,
    model: modelName
  };
}

/**
 * Direct call to ProTalk Function 787 for Free Image Generation without text
 * Default and single model: am/flux.2-klein-4b (0 ИИрок)
 * POST https://api.pro-talk.ru/api/v1.0/run_function
 */
export async function callProTalkFunction787(options: {
  prompt: string;
  ai_model?: string;
  size?: string;
  quality?: string;
  output_format?: string;
  response_format?: string;
  images?: string;
  images_url?: string;
  background?: string;
  mode?: 'sync' | 'async' | 'stream';
  debug?: boolean;
  logUrl?: string;
  logChatId?: string;
  userId?: string;
}): Promise<{
  imageUrl: string;
  originalUrl: string;
  downloadUrl: string;
  width?: number;
  height?: number;
  fileSize?: number;
  tokensUsed: number;
  costRub: number;
  model?: string;
}> {
  const {
    prompt,
    size = '1024x1024',
    quality = 'auto',
    output_format = 'png',
    response_format = 'url',
    images,
    images_url,
    background = 'auto',
    mode = 'sync',
    debug = false,
    logChatId,
    userId = '16926299042'
  } = options;

  // Function 787 always uses am/flux.2-klein-4b as required
  const fixedModel = 'am/flux.2-klein-4b';

  const settings = DB.getSettings();
  const protalkBotId = settings?.protalkBotId?.trim() || process.env.PROTALK_BOT_ID || '66275';
  const protalkBotToken = settings?.protalkBotToken?.trim() || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';
  const functionId = settings?.function787Id || 787;

  // Requirement: log_chat_id formatted as img<fn>_<uid>
  const effectiveLogChatId = formatImageLogChatId(787, userId);
  const effectiveLogUrl = options.logUrl || settings?.moderationLogUrl || 'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing';

  const allowedSizes = new Set([
    'auto',
    '1024x1024',
    '1792x1024',
    '1024x1792',
    '1536x1024',
    '1024x1536',
    '512x512',
    '256x256'
  ]);
  const allowedQualities = new Set(['auto', 'low', 'medium', 'standard', 'high', 'hd']);
  const allowedBackgrounds = new Set(['auto', 'transparent', 'opaque']);
  const allowedModes = new Set(['sync', 'async', 'stream']);
  const allowedResponseFormats = new Set(['url', 'b64_json']);

  const normalizedFmtRaw = String(output_format || 'png').trim().toLowerCase();
  const safeOutputFormat =
    normalizedFmtRaw === 'jpg' || normalizedFmtRaw === 'jpeg'
      ? 'jpeg'
      : normalizedFmtRaw === 'webp'
      ? 'webp'
      : 'png';
  const safeSize = allowedSizes.has(String(size || '').trim()) ? String(size).trim() : '1024x1024';
  const safeQuality = 'auto';
  const safeBackground = 'auto';
  const safeResponseFormat = 'url';
  const safeMode = 'sync';
  const outbound787Prompt = appendHiddenImageFunctionRule(prompt, 787, 560);

  const baseArgs: Record<string, any> = {
    prompt: outbound787Prompt,
    ai_model: fixedModel,
    model: fixedModel,
    size: safeSize,
    quality: safeQuality,
    output_format: safeOutputFormat,
    response_format: safeResponseFormat,
    background: safeBackground,
    mode: safeMode,
    debug: false,
    log_url: effectiveLogUrl,
    log_chat_id: effectiveLogChatId
  };

  let resData: any = null;
  let lastErrorMsg = '';

  // Up to 3 attempts with progressive parameter normalization to prevent transient worker or 422 errors
  for (let attempt = 1; attempt <= 3; attempt++) {
    const attemptPrompt =
      attempt === 1
        ? outbound787Prompt
        : appendHiddenImageFunctionRule(prompt, 787, attempt === 2 ? 380 : 240);

    const attemptArgs: Record<string, any> = {
      ...baseArgs,
      prompt: attemptPrompt,
      ai_model: fixedModel,
      model: fixedModel,
      size: attempt >= 2 ? '1024x1024' : safeSize,
      quality: 'auto',
      output_format: attempt > 1 ? 'png' : safeOutputFormat,
      background: 'auto',
      response_format: 'url',
      mode: 'sync',
      debug: false
    };

    const payload = {
      function_id: Number(functionId) || 787,
      functions_base_id: 'appkq3HrzrxYxoAV8',
      bot_id: Number(protalkBotId) || 66275,
      bot_token: protalkBotToken,
      arguments: attemptArgs
    };

    try {
      const res = await fetch('https://api.pro-talk.ru/api/v1.0/run_function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastErrorMsg = sanitizeProTalkError(errText, res.status, 'Функция 787');
        console.warn(`[ImageBuilder 787] Attempt ${attempt}/3 returned HTTP ${res.status}: ${lastErrorMsg}`);
        if (attempt < 3) {
          await delay(900 * attempt);
          continue;
        }
        throw new Error(lastErrorMsg);
      }

      const parsed = (await res.json()) as any;
      const candidateImg = parsed?.images?.[0] || parsed?.result?.images?.[0] || parsed?.data?.[0];
      if (!candidateImg?.url && !candidateImg?.b64_json) {
        const upstreamErr = String(
          parsed?.error || parsed?.message || parsed?.result?.error || ''
        ).trim();
        const isModelUnavailable =
          parsed?.code === 'model_not_found' ||
          Number(parsed?.http_status) === 404 ||
          /model_not_found|temporarily unavailable|no endpoints found/i.test(upstreamErr);

        if (isModelUnavailable) {
          throw new Error(
            'Функция 787 временно не работает на стороне провайдера (модель недоступна). Повторите попытку позже или выберите функции 621, 784 или 791.'
          );
        }

        if (upstreamErr) {
          lastErrorMsg = upstreamErr;
        }
        if (attempt < 3) {
          console.warn(
            `[ImageBuilder 787] Attempt ${attempt}/3 returned no image (${upstreamErr || 'empty payload'}), retrying with normalized parameters...`
          );
          await delay(900 * attempt);
          continue;
        }
      }

      resData = parsed;
      break;
    } catch (err: any) {
      lastErrorMsg = err?.message || 'Ошибка соединения при вызове функции 787';
      const isFatalModelError = /временно не работает|модель недоступна/i.test(lastErrorMsg);
      if (attempt < 3 && !isFatalModelError && !err?.name?.includes('Timeout')) {
        await delay(900 * attempt);
        continue;
      }
      throw new Error(lastErrorMsg);
    }
  }

  const imgObj = resData?.images?.[0] || resData?.result?.images?.[0] || resData?.data?.[0];
  let originalUrl = imgObj?.url || resData?.url;

  if (!originalUrl && imgObj?.b64_json) {
    const ext = imgObj.extension || output_format || 'png';
    originalUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${imgObj.b64_json}`;
  }

  if (!originalUrl) {
    const rawMsg = resData?.error || resData?.message || resData?.result?.error || lastErrorMsg || 'Функция 787 временно не вернула изображение. Повторите попытку.';
    throw new Error(typeof rawMsg === 'string' ? rawMsg : 'Функция 787 временно не вернула изображение. Повторите попытку.');
  }

  const tokensUsed = Number(resData?.usage?.total_tokens || 0);
  const costRub = 0;
  const modelName = resData?.model || fixedModel;

  try {
    const { insertModerationLog } = await import('./db/postgres');
    insertModerationLog({
      level: 'info',
      message: `[Генерация картинок без текста 787 (0 ИИрок)] Изображение создано (${modelName})`,
      details: JSON.stringify({
        function_id: functionId,
        prompt: prompt.slice(0, 200),
        ai_model: fixedModel,
        size,
        quality,
        output_format,
        log_chat_id: effectiveLogChatId,
        url: originalUrl.startsWith('data:') ? 'base64 data url' : originalUrl,
        model: modelName
      }),
      tokens_used: tokensUsed,
      cost_rub: costRub,
      chat_id: effectiveLogChatId,
      user_id: String(userId),
      function_id: Number(functionId) || 787,
      decision: 'OK'
    });
  } catch (logErr) {}

  return {
    imageUrl: originalUrl,
    originalUrl,
    downloadUrl: originalUrl,
    fileSize: Number(imgObj?.bytes_size || imgObj?.size_bytes || 0),
    tokensUsed,
    costRub,
    model: modelName
  };
}

/**
 * Unified executor for 4 Functions:
 * 787 - «Без текста», 0 ИИрок (Бесплатная)
 * 621 - «Мало текста», 5 ИИрок
 * 784 - «С текстом», 10 ИИрок
 * 791 - «Про без ограничений (кириллица, инфографика, до 16 референсов)», 15 ИИрок
 */
export async function handleUnifiedImageGeneration(
  params: UnifiedImageGenerationParams
): Promise<UnifiedImageGenerationResult> {
  const {
    mode = 'func_621',
    prompt,
    aspectRatio = '1:1',
    referenceUrl,
    userId = '16926299042',
    size,
    quality = 'auto',
    output_format = 'png',
    response_format = 'url',
    images,
    images_url,
    images_urls,
    background = 'auto',
    generation_mode = 'sync',
    debug = false,
    skipBilling = false,
    hostProtocol
  } = params;

  if (!prompt || !prompt.trim()) {
    return { ok: false, status: 400, error: 'Укажите текстовый промпт для генерации картинки' };
  }

  // Strictly normalize mode to func_787 / func_621 / func_784 / func_791
  let normalizedMode: 'func_621' | 'func_784' | 'func_787' | 'func_791' = 'func_621';
  if (mode === 'func_791') {
    normalizedMode = 'func_791';
  } else if (mode === 'func_621' || mode === 'no_text') {
    normalizedMode = 'func_621';
  } else if (mode === 'func_784' || mode === 'with_text') {
    normalizedMode = 'func_784';
  } else if (mode === 'func_787' || mode === 'free') {
    normalizedMode = 'func_787';
  }

  // 1. Read costs from database pricing config & settings (truth from DB)
  const db = await getPgDB();
  const pricing = await getPricingConfig(db);
  const settings = DB.getSettings();
  const cost621 = Number(pricing?.imageModels?.func_621 ?? settings?.costImage621Iirky ?? settings?.costImageNoTextIirky ?? 5);
  const cost784 = Number(pricing?.imageModels?.func_784 ?? settings?.costImage784Iirky ?? settings?.costImageWithTextIirky ?? 10);
  const cost787 = Number(pricing?.imageModels?.func_787 ?? settings?.costImage787Iirky ?? 0);
  const cost791 = Number(pricing?.imageModels?.func_791 ?? settings?.costImage791Iirky ?? 15);

  let requiredIirky = 0;
  if (normalizedMode === 'func_791') requiredIirky = cost791;
  else if (normalizedMode === 'func_784') requiredIirky = cost784;
  else if (normalizedMode === 'func_621') requiredIirky = cost621;
  else requiredIirky = cost787;

  // 2. Check balance if requiredIirky > 0
  let userBalance = 0;
  try {
    const stmt = db.prepare(`
      SELECT balance, balance_free, balance_pay, balance_start, balance_ref, balance_tarif, balance_admin 
      FROM users WHERE id = ? LIMIT 1
    `);
    stmt.bind([userId]);
    if (stmt.step()) {
      const u = stmt.getAsObject() as any;
      const bPay = Number(u.balance_pay || 0);
      const bFree = Number(u.balance_free || 0);
      const bStart = Number(u.balance_start || 0);
      const bRef = Number(u.balance_ref || 0);
      const bTarif = Number(u.balance_tarif || 0);
      const bAdmin = Number(u.balance_admin || 0);
      const sum = bPay + bFree + bStart + bRef + bTarif + bAdmin;
      userBalance = sum > 0 ? sum : Number(u.balance || 0);
    }
    stmt.free();
  } catch (err) {
    console.warn('[ImageBuilder] Could not query user balance:', err);
    userBalance = 1000;
  }

  if (!skipBilling && requiredIirky > 0 && userBalance < requiredIirky) {
    return {
      ok: false,
      status: 402,
      error: `Недостаточно Иирок на балансе! Требуется: ${requiredIirky} Иирок, доступно: ${userBalance} Иирок.`
    };
  }

  // 3. Execute generation strictly through the chosen function
  let genResult: {
    imageUrl: string;
    originalUrl: string;
    fileSize?: number;
    tokensUsed: number;
    costRub: number;
    model?: string;
    mimeType?: string;
  };

  const fnNumber: 787 | 621 | 784 | 791 =
    normalizedMode === 'func_791'
      ? 791
      : normalizedMode === 'func_784'
      ? 784
      : normalizedMode === 'func_621'
      ? 621
      : 787;

  try {
    if (normalizedMode === 'func_791') {
      const merged791Refs = Array.from(
        new Set(
          [images_urls, images, images_url, referenceUrl]
            .flatMap((v) => String(v || '').split(','))
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
        .slice(0, 16)
        .join(',');
      genResult = await callProTalkFunction791({
        prompt: prompt.trim().slice(0, 5000),
        aspect_ratio: aspectRatio || 'auto',
        images_urls: merged791Refs,
        debug: Boolean(debug),
        userId,
        logChatId: formatImageLogChatId(791, userId)
      });
    } else if (normalizedMode === 'func_784') {
      const merged784Refs = Array.from(
        new Set(
          [images_urls, images, images_url, referenceUrl]
            .flatMap((v) => String(v || '').split(','))
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
        .slice(0, 4)
        .join(',');
      genResult = await callProTalkFunction784({
        prompt: prompt.trim(),
        aspectRatio,
        filesUrl: merged784Refs || undefined,
        resolution: '1K',
        userId,
        logChatId: formatImageLogChatId(784, userId)
      });
    } else if (normalizedMode === 'func_621') {
      genResult = await callProTalkFunction621({
        prompt: prompt.trim(),
        aspectRatio,
        userId,
        logChatId: formatImageLogChatId(621, userId),
        skipGallerySave: true,
        skipHiddenRule: Boolean(params.skipHiddenRule),
        hostProtocol
      });
    } else {
      let effectiveSize = size || '1024x1024';
      if (!size && aspectRatio) {
        if (aspectRatio === '16:9') effectiveSize = '1792x1024';
        else if (aspectRatio === '9:16') effectiveSize = '1024x1792';
        else effectiveSize = '1024x1024';
      }

      genResult = await callProTalkFunction787({
        prompt: prompt.trim(),
        ai_model: 'am/flux.2-klein-4b',
        size: effectiveSize,
        quality,
        output_format,
        response_format,
        images: images || images_urls || referenceUrl?.trim() || undefined,
        images_url,
        background,
        mode: generation_mode,
        debug,
        userId,
        logChatId: formatImageLogChatId(787, userId)
      });
    }
  } catch (genErr: any) {
    const cleanMsg = String(genErr?.message || 'Ошибка генерации изображения нейросетью. Попробуйте еще раз.');
    console.warn(`[ImageBuilder] Generation warning for mode ${normalizedMode}: ${cleanMsg}`);
    return {
      ok: false,
      status: 502,
      error: cleanMsg
    };
  }

  // 4. Billing: Deduct Iirky upon success (if > 0 and not already billed by caller)
  if (!skipBilling) {
    if (requiredIirky > 0) {
      const txDesc =
        normalizedMode === 'func_791'
          ? `Генерация картинки: Про без ограничений (Функция 791, ${aspectRatio || 'auto'})`
          : normalizedMode === 'func_784'
          ? `Генерация картинки: С текстом (Функция 784, ${aspectRatio})`
          : `Генерация картинки: Мало текста (Функция 621, ${aspectRatio})`;
      try {
        addTransactionWithBalanceUpdate(db, {
          userId,
          type: 'cost',
          amount: requiredIirky,
          description: txDesc,
          comment: `Промпт: "${prompt.slice(0, 80)}..."`
        });
      } catch (txErr) {
        console.warn('[ImageBuilder] Warning deducting balance transaction:', txErr);
      }
    } else {
      try {
        addTransactionWithBalanceUpdate(db, {
          userId,
          type: 'cost',
          amount: 0,
          description: `Генерация картинки: Без текста (Функция 787, 0 Иирок)`,
          comment: `Промпт: "${prompt.slice(0, 80)}..."`
        });
      } catch (txErr) {}
    }
  }

  // 5. Persist every generated image to the user's gallery (folder «Картинки») & obtain public URL
  const rawExt = normalizedMode === 'func_787' ? (output_format || 'png').toLowerCase() : 'png';
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const mimeType =
    genResult.mimeType ||
    (ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png');

  const persisted = await persistGeneratedImageToGallery({
    imageUrl: genResult.imageUrl,
    originalUrl: genResult.originalUrl,
    userId,
    fnNumber,
    mimeTypeHint: mimeType,
    hostProtocol
  });

  const finalImageUrl = persisted.publicUrl || genResult.imageUrl;

  savePgDB();

  return {
    ok: true,
    imageUrl: finalImageUrl,
    originalUrl: genResult.originalUrl || finalImageUrl,
    cost: requiredIirky,
    mode: normalizedMode,
    aspectRatio: normalizedMode === 'func_791' ? aspectRatio || 'auto' : aspectRatio,
    tokensUsed: genResult.tokensUsed,
    costRub: genResult.costRub,
    model: genResult.model
  };
}
