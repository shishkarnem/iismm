import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { getPgDB, normalizeUserId, fetchAllBlogPostsFromPg } from '../db/postgres';
import { getAllTariffsFromDb } from '../db/tariffsTable';
import { ConsultantDbCategoryKey } from './consultantDecision763';

export interface ConsultantDbLookupResult {
  tableUsed: string;
  matchedRowsCount: number;
  briefLabel: string;
  formattedDbContext: string;
}

function extractSearchStems(text: string): string[] {
  const cleaned = String(text || '')
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s-]/gi, ' ');
  const stopWords = new Set([
    'как', 'что', 'где', 'когда', 'почему', 'зачем', 'какой', 'какая', 'какие',
    'можно', 'нужно', 'мне', 'мой', 'моя', 'мои', 'вас', 'ваш', 'это', 'для',
    'при', 'или', 'про', 'подскажите', 'расскажи', 'помоги', 'есть', 'тут', 'здесь'
  ]);
  return Array.from(
    new Set(
      cleaned
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3 && !stopWords.has(w))
        .map((w) => (w.length > 5 ? w.slice(0, Math.max(4, w.length - 2)) : w))
    )
  ).slice(0, 12);
}

function stripHtmlTags(raw: string): string {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryAcademyRows(db: Database, questionText: string, currentPath: string): { count: number; text: string } {
  try {
    const stems = extractSearchStems(`${questionText} ${currentPath}`);
    const stmt = db.prepare(`SELECT * FROM academy_articles WHERE is_published = 1 ORDER BY sort_order ASC`);

    const allArticles: Array<Record<string, string>> = [];
    while (stmt.step()) {
      const r = stmt.getAsObject() as Record<string, any>;
      allArticles.push({
        id: String(r.id || ''),
        sectionSlug: String(r.section_slug || ''),
        sectionTitle: String(r.section_title || ''),
        title: String(r.title || ''),
        summary: String(r.summary || ''),
        content: stripHtmlTags(String(r.content || ''))
      });
    }
    stmt.free();

    if (allArticles.length === 0) {
      return { count: 0, text: 'Таблица academy_articles пуста.' };
    }

    const scored = allArticles.map((art) => {
      let score = 0;
      const titleLow = `${art.sectionTitle} ${art.title} ${art.summary}`.toLowerCase();
      const bodyLow = art.content.toLowerCase();
      for (const st of stems) {
        if (titleLow.includes(st)) score += 5;
        if (bodyLow.includes(st)) score += 2;
      }
      if (currentPath.includes('scen') && art.sectionSlug.includes('scen')) score += 3;
      if (currentPath.includes('folder') && art.sectionSlug.includes('folder')) score += 3;
      if (currentPath.includes('calendar') && art.sectionSlug.includes('calendar')) score += 3;
      if (currentPath.includes('gallery') && art.sectionSlug.includes('gallery')) score += 3;
      if (currentPath.includes('post') && art.sectionSlug.includes('post')) score += 3;
      return { art, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3).map((s) => s.art);

    const lines = top.map((a, idx) => {
      return [
        `Строка #${idx + 1} [таблица: academy_articles, id="${a.id}"]:`,
        `  • колонка section_title: "${a.sectionTitle}"`,
        `  • колонка title: "${a.title}"`,
        `  • колонка summary: "${a.summary}"`,
        `  • колонка content: "${a.content.slice(0, 1400)}"`
      ].join('\n');
    });

    return { count: top.length, text: lines.join('\n\n') };
  } catch (err: any) {
    return { count: 0, text: `Ошибка чтения academy_articles: ${err?.message || err}` };
  }
}

function queryTariffsAndSettingsRows(db: Database, questionText: string): { count: number; text: string } {
  const qLow = questionText.toLowerCase();
  const allTariffs = getAllTariffsFromDb(db).filter((r) => !r.is_custom && r.is_active !== 0);

  const specific = allTariffs.filter((r) => qLow.includes(String(r.name || '').toLowerCase()));
  const targetRows = specific.length === 1 ? specific : allTariffs.slice(0, 5);

  const tariffBlocks = targetRows.map((r, idx) => {
    let parsedFeatures = '';
    try {
      const fArr = typeof r.features === 'string' ? JSON.parse(r.features) : r.features;
      if (Array.isArray(fArr)) {
        parsedFeatures = fArr
          .slice(0, 8)
          .map((f: any) => `${f.title}: ${f.desc}`)
          .join(' | ');
      }
    } catch {}

    return [
      `Строка #${idx + 1} [таблица: tarifs, id="${r.id}"]:`,
      `  • колонка name: "${r.name}"`,
      `  • колонка price_rub: ${Number(r.price_rub || 0)} ₽`,
      `  • колонка price_iirky: "${r.price_iirky || ''}"`,
      `  • колонка monthly_iirky: ${Number(r.monthly_iirky || 0)} Иирок в месяц`,
      `  • колонка sub: "${r.sub || ''}"`,
      `  • колонка duration_text: "${r.duration_text || ''}"`,
      `  • скидки (discount_3m / 6m / 12m): ${r.discount_3m || 0}% / ${r.discount_6m || 0}% / ${r.discount_12m || 0}%`,
      `  • колонка features: "${parsedFeatures}"`
    ].join('\n');
  });

  let settingsInfo = '';
  try {
    const sStmt = db.prepare(`SELECT * FROM protalk_settings LIMIT 1`);
    if (sStmt.step()) {
      const sRow = sStmt.getAsObject() as Record<string, any>;
      settingsInfo = `\nСтрока [таблица: protalk_settings]:\n  • Генерация картинки без текста (функция 621): ${sRow.cost_image_no_text_iirky ?? 5} Иирок\n  • Генерация картинки с текстом (функция 784): ${sRow.cost_image_with_text_iirky ?? 10} Иирок\n  • Генерация бесплатной картинки (функция 787): ${sRow.cost_image_787_iirky ?? 0} Иирок\n  • Генерация поста с Ии: 10 Иирок, рерайт: 1.5–2 Иирки, курс пополнения: 1 ₽ = 1 Иирка.`;
    }
    sStmt.free();
  } catch {}

  return {
    count: targetRows.length,
    text: tariffBlocks.join('\n\n') + settingsInfo
  };
}

function queryUserProfileRows(db: Database, userId?: string): { count: number; text: string } {
  const rawUid = String(userId || '').trim();
  if (!rawUid || rawUid === 'guest' || rawUid === 'anonymous') {
    return {
      count: 0,
      text: 'Пользователь сейчас не авторизован (гостевой режим). Для просмотра личного баланса Иирок, активного тарифа и транзакций предложите войти в личный кабинет.'
    };
  }

  try {
    const normUid = normalizeUserId(rawUid);
    const stmt = db.prepare(`
      SELECT * FROM users
      WHERE id = ? OR id = ? OR CAST(telegram_id AS TEXT) = ?
      LIMIT 1
    `);
    stmt.bind([normUid, rawUid, rawUid]);

    let userRow: Record<string, any> | null = null;
    if (stmt.step()) {
      userRow = stmt.getAsObject() as Record<string, any>;
    }
    stmt.free();

    if (!userRow) {
      return {
        count: 0,
        text: `В таблице users запись для id="${normUid}" не найдена (пользователь в гостевой сессии).`
      };
    }

    const txStmt = db.prepare(`
      SELECT * FROM transactions
      WHERE user_id = ? OR user_id = ?
      ORDER BY created_at DESC
      LIMIT 6
    `);
    txStmt.bind([String(userRow.id), normUid]);
    const txs: string[] = [];
    while (txStmt.step()) {
      const t = txStmt.getAsObject() as Record<string, any>;
      txs.push(`${t.created_at}: ${t.amount} Иирок (${t.type}) — ${t.description || ''}`);
    }
    txStmt.free();

    const text = [
      `Строка пользователя [таблица: users, id="${userRow.id}"]:`,
      `  • имя (first_name / last_name): "${userRow.first_name || ''} ${userRow.last_name || ''}"`,
      `  • колонка username: "${userRow.username || ''}"`,
      `  • колонка tariff: "${userRow.tariff || 'Старт'}"`,
      `  • колонка tariff_expires_at: "${userRow.tariff_expires_at || 'бессрочно'}"`,
      `  • колонка balance (доступно Иирок): ${Number(userRow.balance ?? 0)}`,
      `  • колонки пакетов (balance_pay / balance_tarif / balance_start / balance_ref): ${Number(userRow.balance_pay || 0)} / ${Number(userRow.balance_tarif || 0)} / ${Number(userRow.balance_start || 0)} / ${Number(userRow.balance_ref || 0)}`,
      `  • колонка referral_reward_balance: ${Number(userRow.referral_reward_balance || 0)} ₽`,
      txs.length > 0
        ? `Последние строки [таблица: transactions]:\n  • ${txs.join('\n  • ')}`
        : 'Таблица transactions: операций пока нет.'
    ].join('\n');

    return { count: 1 + txs.length, text };
  } catch (err: any) {
    return { count: 0, text: `Ошибка чтения профиля пользователя: ${err?.message || err}` };
  }
}

function queryChannelsPostsScenariosRows(db: Database, userId?: string): { count: number; text: string } {
  const normUid = userId && userId !== 'guest' ? normalizeUserId(userId) : '';
  const blocks: string[] = [];
  let totalCount = 0;

  try {
    const chStmt = normUid
      ? db.prepare(`SELECT * FROM channels WHERE user_id = ? OR user_id = ? LIMIT 10`)
      : db.prepare(`SELECT * FROM channels LIMIT 6`);
    if (normUid) chStmt.bind([normUid, String(userId)]);
    const chList: string[] = [];
    while (chStmt.step()) {
      const c = chStmt.getAsObject() as Record<string, any>;
      chList.push(`"${c.name}" (${c.username || c.id}), подписчиков: ${c.subscribers_count || 0}, активен: ${c.is_active ? 'да' : 'нет'}`);
    }
    chStmt.free();
    totalCount += chList.length;
    blocks.push(
      chList.length > 0
        ? `Строки [таблица: channels]:\n  • ${chList.join('\n  • ')}`
        : 'В таблице channels у пользователя пока нет подключенных каналов.'
    );
  } catch {}

  try {
    const pStmt = normUid
      ? db.prepare(`SELECT * FROM posts WHERE user_id = ? OR user_id = ? ORDER BY created_at DESC LIMIT 6`)
      : db.prepare(`SELECT * FROM posts ORDER BY created_at DESC LIMIT 5`);
    if (normUid) pStmt.bind([normUid, String(userId)]);
    const pList: string[] = [];
    while (pStmt.step()) {
      const p = pStmt.getAsObject() as Record<string, any>;
      pList.push(`[${p.id}] "${p.title || 'Без заголовка'}" -> канал: ${p.channel || 'не указан'}, статус: ${p.status || 'черновик'}`);
    }
    pStmt.free();
    totalCount += pList.length;
    if (pList.length > 0) {
      blocks.push(`Строки [таблица: posts]:\n  • ${pList.join('\n  • ')}`);
    }
  } catch {}

  try {
    const scStmt = db.prepare(`SELECT * FROM sceneries ORDER BY created_at DESC LIMIT 6`);
    const scList: string[] = [];
    while (scStmt.step()) {
      const s = scStmt.getAsObject() as Record<string, any>;
      scList.push(
        `"${s.name}" (формат: ${s.message_format || 'v2'}, каналы: ${s.target_channels || '-'}, включен: ${s.enabled ? 'да' : 'нет'}, расписание: ${s.schedule || '-'}, след. запуск: ${s.next_run_at || '-'})`
      );
    }
    scStmt.free();
    totalCount += scList.length;
    if (scList.length > 0) {
      blocks.push(`Строки [таблица: sceneries]:\n  • ${scList.join('\n  • ')}`);
    }
  } catch {}

  return { count: totalCount, text: blocks.join('\n\n') };
}

function queryFoldersSelectionsTeamsRows(db: Database): { count: number; text: string } {
  const blocks: string[] = [];
  let count = 0;

  try {
    const fStmt = db.prepare(`
      SELECT id, title, categories, min_subscribers, max_participants, scheduled_at, status
      FROM promo_folders
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const fRows: string[] = [];
    while (fStmt.step()) {
      const f = fStmt.getAsObject() as Record<string, any>;
      fRows.push(`Папка "${f.title}" | категории: ${f.categories || '-'} | мин. подписчиков: ${f.min_subscribers || 0} | макс. мест: ${f.max_participants || 0} | статус: ${f.status}`);
    }
    fStmt.free();
    count += fRows.length;
    if (fRows.length > 0) {
      blocks.push(`Строки [таблица: promo_folders]:\n  • ${fRows.join('\n  • ')}`);
    }
  } catch {}

  try {
    const sStmt = db.prepare(`
      SELECT id, title, categories, min_subscribers, max_participants, status
      FROM promo_selections
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const sRows: string[] = [];
    while (sStmt.step()) {
      const s = sStmt.getAsObject() as Record<string, any>;
      sRows.push(`Подборка "${s.title}" | категории: ${s.categories || '-'} | мин. подписчиков: ${s.min_subscribers || 0} | статус: ${s.status}`);
    }
    sStmt.free();
    count += sRows.length;
    if (sRows.length > 0) {
      blocks.push(`Строки [таблица: promo_selections]:\n  • ${sRows.join('\n  • ')}`);
    }
  } catch {}

  try {
    const blogPosts = fetchAllBlogPostsFromPg({ limit: 4 } as any).slice(0, 4);
    count += blogPosts.length;
    if (blogPosts.length > 0) {
      blocks.push(
        `Свежие публикации блога:\n  • ` +
          blogPosts.map((b: any) => `"${b.title}" (автор: ${b.author?.name || 'Автор'})`).join('\n  • ')
      );
    }
  } catch {}

  if (blocks.length === 0) {
    blocks.push(
      'Раздел Папки и подборки (/folders) позволяет бесплатно создавать совместные папки Telegram и тематические подборки взаимного пиара с автопроверкой размещения ботом @IIrkiBot.'
    );
  }

  return { count, text: blocks.join('\n\n') };
}

function queryOfertaAndGeneralInfo(db: Database): { count: number; text: string } {
  let usersTotal = 0;
  let articlesTotal = 0;
  try {
    usersTotal = Number(db.exec('SELECT COUNT(*) FROM users')?.[0]?.values?.[0]?.[0] || 0);
    articlesTotal = Number(db.exec('SELECT COUNT(*) FROM academy_articles')?.[0]?.values?.[0]?.[0] || 0);
  } catch {}

  const text = [
    `Официальные сведения о платформе и публичной оферте:`,
    `  • Платформа: облачный сервис автопостинга, нейрогенерации и взаимного продвижения «ИиSMM» (веб-версия и Telegram Mini App @IIrkiBot).`,
    `  • Правообладатель (Лицензиар): ООО «РентРоп» (ОГРН 1217700234157, ИНН 7726477438).`,
    `  • Внутренняя валюта: «Иирки» (курс 1 рубль = 1 Иирка). Ручные посты, каналы и календарь бесплатны и безлимитны на всех тарифах, включая «Старт» (где начисляется 300 бесплатных Иирок ежемесячно).`,
    `  • Модерация: автоматическая нейромодерация сообщений, комментариев, отзывов и подборок через функцию 763 на соответствие законодательству РФ.`,
    `  • Статистика базы PostgreSQL ProTalk: зарегистрировано пользователей — ${usersTotal}, обучающих материалов Академии — ${articlesTotal}.`
  ].join('\n');

  return { count: 1, text };
}

/**
 * Queries PostgreSQL database tables/rows/columns according to the decision returned by Function 763.
 */
export async function queryDatabaseForConsultant(params: {
  categoryKey: ConsultantDbCategoryKey;
  questionText: string;
  userId?: string;
  currentPath?: string;
}): Promise<ConsultantDbLookupResult> {
  const db = await getPgDB();
  const { categoryKey, questionText, userId, currentPath = '/' } = params;
  const qLow = questionText.toLowerCase();

  const sections: string[] = [];
  const tablesUsed: string[] = [];
  let totalRows = 0;
  let briefLabel = '';

  if (categoryKey === 'academy') {
    const res = queryAcademyRows(db, questionText, currentPath);
    sections.push(res.text);
    tablesUsed.push('academy_articles');
    totalRows += res.count;
    briefLabel = 'База знаний Академии';
  } else if (categoryKey === 'tariffs_pricing') {
    const res = queryTariffsAndSettingsRows(db, questionText);
    sections.push(res.text);
    tablesUsed.push('tariffs', 'protalk_settings');
    totalRows += res.count;
    briefLabel = 'Тарифы и стоимость функций';
  } else if (categoryKey === 'user_balance_profile') {
    const res = queryUserProfileRows(db, userId);
    sections.push(res.text);
    tablesUsed.push('users', 'transactions');
    totalRows += res.count;
    briefLabel = 'Профиль и баланс пользователя';
  } else if (categoryKey === 'channels_posts_scenarios') {
    const res = queryChannelsPostsScenariosRows(db, userId);
    sections.push(res.text);
    tablesUsed.push('channels', 'posts', 'sceneries');
    totalRows += res.count;
    briefLabel = 'Каналы, посты и сценарии';
  } else if (categoryKey === 'folders_selections_teams') {
    const res = queryFoldersSelectionsTeamsRows(db);
    sections.push(res.text);
    tablesUsed.push('promo_folders', 'promo_selections');
    totalRows += res.count;
    briefLabel = 'Папки, подборки и команды';
  } else {
    const res = queryOfertaAndGeneralInfo(db);
    sections.push(res.text);
    tablesUsed.push('oferta', 'users');
    totalRows += res.count;
    briefLabel = 'Оферта и общие сведения';
  }

  // Cross-enrich if user also asks about tariffs or academy how-to in a combined question
  if (categoryKey !== 'tariffs_pricing' && /(тариф|разгон|отрыв|космос|стоимост|цена)/i.test(qLow)) {
    const extra = queryTariffsAndSettingsRows(db, questionText);
    sections.push(extra.text);
    tablesUsed.push('tariffs');
    totalRows += extra.count;
  } else if (categoryKey !== 'academy' && /(как |настро|создат|подключ|инструкц)/i.test(qLow)) {
    const extra = queryAcademyRows(db, questionText, currentPath);
    sections.push(extra.text);
    tablesUsed.push('academy_articles');
    totalRows += extra.count;
  }

  return {
    tableUsed: Array.from(new Set(tablesUsed)).join(', '),
    matchedRowsCount: totalRows,
    briefLabel,
    formattedDbContext: sections.join('\n\n---\n\n')
  };
}
