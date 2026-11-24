import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { callProTalkBotApi } from '../protalk';
import {
  combineSystemAndUserPrompt,
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from '../scenarios/prompts/scenarioPromptsRepo';

export interface LandingReviewSeedItem {
  id: string;
  name: string;
  rating: number;
  text: string;
  role: string;
  avatar: string;
  status: string;
  created_at: string;
  ai_reply: string;
  ai_replied_at: string;
  admin_reply: string;
  admin_replied_at: string;
}

export const OCTOBER_REVIEW_SEEDS: LandingReviewSeedItem[] = [];

function stripCapsLockWords(input: string): string {
  return String(input || '').trim();
}

export function ensureLandingReviewsColumns(_db: Database): void {
  // Columns are managed by PostgreSQL ProTalk schemaInitializer.
}

export function seedAndMigrateLandingReviews(_db: Database): void {
  // Reviews are persisted in PostgreSQL ProTalk (iismm2); hardcoded seeds removed.
}

export function buildFallbackAiReviewReply(name: string, rating: number, text: string): string {
  const cleanFirstName = (name || 'Пользователь')
    .replace(/\([^)]*\)/g, '')
    .replace(/@\S+/g, '')
    .trim()
    .split(/\s+/)[0] || 'Коллега';

  const lower = (text || '').toLowerCase();
  if (rating <= 3) {
    return `${cleanFirstName}, благодарим за честную обратную связь! Мы передали ваши замечания команде разработки и службе заботы, чтобы оперативно сделать работу на платформе удобнее.`;
  }
  if (lower.includes('картин') || lower.includes('иллюстрац') || lower.includes('галере')) {
    return `${cleanFirstName}, благодарим за ваш отзыв! Очень рады, что генерация иллюстраций и облачная медиагалерея помогают вам оформлять яркие публикации быстрее.`;
  }
  if (lower.includes('сценари') || lower.includes('календар') || lower.includes('автопост')) {
    return `${cleanFirstName}, большое спасибо за высокую оценку! Рады, что умные сценарии и календарь автопостинга экономят ваше время каждый день.`;
  }
  return `${cleanFirstName}, искренне благодарим вас за теплый отзыв и доверие к платформе! Желаем высоких охватов, вовлеченной аудитории и вдохновения в каждом новом посте.`;
}

/**
 * Автоматическая генерация вежливого персонализированного ответа от ИИ на опубликованный отзыв
 */
export async function generateAiReplyForReview(params: {
  name: string;
  rating: number;
  text: string;
}): Promise<string> {
  const { name, rating, text } = params;
  const fallback = buildFallbackAiReviewReply(name, rating, text);

  try {
    const dbPrompt = await getRequiredScenarioPrompt('ai_review_reply', 'default');
    const renderedUser = renderPromptTemplate(dbPrompt.user_prompt_template, {
      author_name: name || 'Пользователь',
      rating: rating || 5,
      review_text: text || 'Положительный отзыв о платформе'
    });
    const prompt = combineSystemAndUserPrompt(dbPrompt.system_prompt, renderedUser);
    const rawReply = await Promise.race([
      callProTalkBotApi(prompt, undefined, undefined, `review_reply_${Date.now()}`),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('AI reply timeout')), 8500))
    ]);

    const cleaned = stripCapsLockWords(
      String(rawReply || '')
        .replace(/^["«„]+|["»“]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );

    if (cleaned.length >= 25 && cleaned.length <= 550) {
      return cleaned;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function updateLandingReviewRepliesInDb(
  db: Database,
  reviewId: string,
  payload: { adminReply?: string | null; aiReply?: string | null }
): Record<string, any> | null {
  ensureLandingReviewsColumns(db);
  const nowIso = new Date().toISOString();

  if (payload.adminReply !== undefined) {
    const trimmedAdmin = (payload.adminReply || '').trim();
    db.run(
      'UPDATE landing_reviews SET admin_reply = ?, admin_replied_at = ? WHERE id = ?',
      [trimmedAdmin || null, trimmedAdmin ? nowIso : null, reviewId]
    );
  }

  if (payload.aiReply !== undefined) {
    const trimmedAi = stripCapsLockWords((payload.aiReply || '').trim());
    db.run(
      'UPDATE landing_reviews SET ai_reply = ?, ai_replied_at = ? WHERE id = ?',
      [trimmedAi || null, trimmedAi ? nowIso : null, reviewId]
    );
  }

  const res = db.exec('SELECT * FROM landing_reviews WHERE id = ?', [reviewId]);
  if (!res[0] || res[0].values.length === 0) return null;
  const cols = res[0].columns;
  const row: Record<string, any> = {};
  cols.forEach((col, i) => {
    row[col] = res[0].values[0][i];
  });
  return row;
}
