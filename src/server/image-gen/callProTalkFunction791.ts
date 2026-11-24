import { DB } from '../db';
import { getModerationLogUrlFromPg, insertModerationLog, normalizeUserId } from '../db/postgres';
import { formatImageLogChatId } from './persistGeneratedImageToGallery';

export const ALLOWED_ASPECT_RATIOS_791 = [
  'auto',
  '1:1',
  '3:2',
  '2:3',
  '4:3',
  '3:4',
  '5:4',
  '4:5',
  '16:9',
  '9:16',
  '2:1',
  '1:2',
  '3:1',
  '1:3',
  '21:9',
  '9:21'
] as const;

export type AspectRatio791 = typeof ALLOWED_ASPECT_RATIOS_791[number];

export interface Function791Options {
  prompt: string;
  aspect_ratio?: string;
  images_urls?: string;
  debug?: boolean;
  userId?: string | number;
  logUrl?: string;
  logChatId?: string;
}

export interface Function791Result {
  imageUrl: string;
  originalUrl: string;
  mimeType?: string;
  aiModel?: string;
  model?: string;
  taskId?: string;
  totalTokens: number;
  tokensUsed: number;
  costRub: number;
  creditsCharged?: number;
  raw?: any;
}

/**
 * Normalizes comma-separated reference image URLs (1..maxCount public HTTPS links).
 */
export function normalizeReferenceHttpsUrlsCsv(input?: string | string[], maxCount: number = 16): string {
  if (!input) return '';
  const rawList = Array.isArray(input) ? input : String(input).split(/[\s,]+/);
  const cleaned = rawList
    .map((u) => String(u || '').trim())
    .filter((u) => /^https:\/\//i.test(u) || /^http:\/\//i.test(u))
    .slice(0, maxCount);
  return cleaned.join(',');
}

/**
 * Calls ProTalk Function 791 (gpt-image-2.5-sunburst, 1K resolution).
 * Supports infographics, posters, and Cyrillic text of any length up to 5000 chars with zero prompt restrictions.
 */
export async function callProTalkFunction791(options: Function791Options): Promise<Function791Result> {
  const settings = DB.getSettings();
  const botToken = settings.protalkBotToken || process.env.PROTALK_BOT_TOKEN || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';
  const botId = Number(settings.protalkBotId || process.env.PROTALK_BOT_ID || 66275) || 66275;
  const functionId = Number(settings.function791Id || 791) || 791;
  const costPerTokenRub = settings.costPerTokenRub ?? 0.001;

  const cleanPrompt = String(options.prompt || '').trim().slice(0, 5000);
  if (!cleanPrompt) {
    throw new Error('Для генерации по функции 791 необходимо указать описание (prompt).');
  }

  const rawRatio = String(options.aspect_ratio || 'auto').trim();
  const safeAspectRatio = (ALLOWED_ASPECT_RATIOS_791 as readonly string[]).includes(rawRatio)
    ? rawRatio
    : 'auto';

  const normalizedRefs = normalizeReferenceHttpsUrlsCsv(options.images_urls, 16);
  const cleanUid = normalizeUserId(options.userId || '16926299042');
  const logChatId = options.logChatId || formatImageLogChatId(functionId, cleanUid);
  const configuredLogUrl = getModerationLogUrlFromPg();
  const effectiveLogUrl = options.logUrl !== undefined
    ? options.logUrl
    : (configuredLogUrl || 'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing');

  const payload = {
    function_id: functionId,
    functions_base_id: 'appkq3HrzrxYxoAV8',
    bot_id: botId,
    bot_token: botToken,
    arguments: {
      prompt: cleanPrompt,
      ai_model: 'gpt-image-2.5-sunburst',
      aspect_ratio: safeAspectRatio,
      resolution: '1K',
      size: '',
      images_urls: normalizedRefs,
      debug: Boolean(options.debug),
      log_url: effectiveLogUrl,
      log_chat_id: logChatId
    }
  };

  let resData: any = null;
  let lastErr: any = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      const response = await fetch('https://api.pro-talk.ru/api/v1.0/run_function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Ошибка функции 791 (HTTP ${response.status}): ${errText.slice(0, 220)}`);
      }

      const rawJson = await response.json();
      resData = rawJson?.result && typeof rawJson.result === 'object' ? rawJson.result : rawJson;
      break;
    } catch (err: any) {
      lastErr = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  if (!resData) {
    throw new Error(lastErr?.message || 'Не удалось получить ответ от функции 791.');
  }

  const imageUrl = String(
    resData?.image_url ||
    resData?.original_url ||
    resData?.url ||
    resData?.data?.[0]?.url ||
    resData?.images?.[0]?.url ||
    ''
  ).trim();

  if (!imageUrl) {
    const apiErr = resData?.error || resData?.message || JSON.stringify(resData).slice(0, 240);
    throw new Error(`Функция 791 не вернула ссылку на изображение: ${apiErr}`);
  }

  const totalTokens = Number(resData?.total_tokens || resData?.usage?.total_tokens || 0);
  const creditsCharged = Number(resData?.usage?.credits_charged || 0);
  const costRub = Number((totalTokens * costPerTokenRub).toFixed(4));

  insertModerationLog({
    level: 'info',
    message: `Генерация изображения (функция ${functionId}, gpt-image-2.5-sunburst)`,
    details: JSON.stringify({
      aspect_ratio: safeAspectRatio,
      resolution: '1K',
      refs_count: normalizedRefs ? normalizedRefs.split(',').length : 0,
      image_url: imageUrl,
      task_id: resData?.task_id || '',
      credits_charged: creditsCharged
    }),
    tokens_used: totalTokens,
    cost_rub: costRub,
    chat_id: logChatId,
    user_id: cleanUid,
    function_id: functionId,
    decision: 'IMAGE_791_OK'
  });

  return {
    imageUrl,
    originalUrl: resData?.original_url ? String(resData.original_url) : imageUrl,
    mimeType: resData?.mime_type ? String(resData.mime_type) : 'image/png',
    aiModel: resData?.ai_model || 'gpt-image-2.5-sunburst',
    model: resData?.ai_model || 'gpt-image-2.5-sunburst',
    taskId: resData?.task_id ? String(resData.task_id) : undefined,
    totalTokens,
    tokensUsed: totalTokens,
    costRub,
    creditsCharged,
    raw: resData
  };
}
