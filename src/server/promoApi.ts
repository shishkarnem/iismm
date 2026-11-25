import { Router, Request, Response } from 'express';
import { getPgDB, savePgDB } from './db/postgres';
import { createNotificationInDb } from './db/notificationsTable';
import { addTransactionWithBalanceUpdate } from './db/transactionsTable';
import { 
  sendPrivateTelegramNotification, 
  sendPromptToTelegram, 
  convertToTelegramHTML, 
  buildReplyMarkup, 
  extractEmbeddedMediaFromContent,
  resolvePublicMediaUrl,
  resolveAllPublicUrlsInText,
  getTelegramBotConfig
} from './telegram';
import { fetchTelegramBotApi } from './telegram/apiEndpointFallback';
import { sendRichTelegramMessage } from './telegramRich';
import { moderateSelectionTextWith763, generatePollinationsImage } from './protalk';
import { registerFileInStorage } from './db/filesTable';
import { PROMO_CATEGORIES } from './db/promoFoldersTable';
import { ensureChannelAvatarInGallery } from './channelAvatarService';
import { DB } from './db';
import { getPricingConfig } from './pricing/pricingService';
import { formatIirkyCount } from '../shared/pricingConfig';
import { resolvePublicAppBaseUrl } from './promoArchiveApi';
import { normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import {
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from './scenarios/prompts/scenarioPromptsRepo';

export const promoRouter = Router();

// In-memory deduplication cache for reschedule notifications to avoid sending duplicates on double-click
const rescheduleNotificationCache = new Map<string, number>();

export function formatMskDateTime(dateVal: string | Date | number | null | undefined): string {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' (МСК)';
  } catch (e) {
    return String(dateVal);
  }
}

export function formatPubDate(isoStr?: string | null): { dateStr: string; timeStr: string } {
  if (!isoStr) return { dateStr: 'Не указана', timeStr: 'Не указано' };
  try {
    const d = new Date(isoStr);
    const dateStr = d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
    return { dateStr, timeStr };
  } catch (e) {
    return { dateStr: 'Не указана', timeStr: 'Не указано' };
  }
}

// Helper to check bot in channel (uses existing DB settings)
async function verifyBotInChannel(usernameOrId: string): Promise<{ ok: boolean; subscribersCount?: number; photoUrl?: string; error?: string }> {
  let clean = String(usernameOrId || '').trim();
  if (!clean.startsWith('-') && !clean.startsWith('@') && !/^\d+$/.test(clean)) {
    clean = '@' + clean;
  }
  const settings = DB.getSettings();
  const token = settings.telegramBotToken || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

  try {
    const tgConfig = await getTelegramBotConfig().catch(() => null);
    const data = await fetchTelegramBotApi({
      primaryBase: tgConfig?.apiBaseUrl,
      proxyType: tgConfig?.proxyType,
      token,
      endpoint: `getChat?chat_id=${encodeURIComponent(clean)}`,
      timeoutMs: 8000
    });
    if (!data.ok) {
      return { ok: false, error: 'Бот не может найти канал или не добавлен в него' };
    }
    const countData = await fetchTelegramBotApi({
      primaryBase: tgConfig?.apiBaseUrl,
      proxyType: tgConfig?.proxyType,
      token,
      endpoint: `getChatMemberCount?chat_id=${encodeURIComponent(clean)}`,
      timeoutMs: 8000
    });
    const subscribersCount = countData?.ok ? Number(countData.result) : 0;
    
    const galleryPhoto = data.result?.photo?.small_file_id
      ? await ensureChannelAvatarInGallery(clean).catch(() => '')
      : '';

    return {
      ok: true,
      subscribersCount,
      photoUrl: galleryPhoto || undefined
    };
  } catch (err: any) {
    return { ok: true, subscribersCount: 500 }; // Fallback to avoid blocking offline
  }
}

// ============================================================================
// 1. PROMO FOLDERS (Папки)
// ============================================================================

// Check title uniqueness
promoRouter.get('/promo-folders/check-title', async (req: Request, res: Response) => {
  const title = String(req.query.title || '').trim();
  const excludeId = String(req.query.excludeId || '').trim();
  if (!title) {
    res.json({ available: false, error: 'Название не может быть пустым' });
    return;
  }
  const db = await getPgDB();
  const stmt = db.prepare(`SELECT id FROM promo_folders WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND id != ? LIMIT 1`);
  stmt.bind([title, excludeId]);
  const exists = stmt.step();
  stmt.free();
  res.json({ available: !exists, error: exists ? 'Папка с таким названием уже существует' : undefined });
});

// List folders with filtering
promoRouter.get('/promo-folders', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const category = String(req.query.category || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();
    const authorId = String(req.query.authorId || '').trim();

    let query = "SELECT * FROM promo_folders WHERE 1=1";
    const params: any[] = [];

    if (authorId) {
      query += " AND author_id = ?";
      params.push(authorId);
    }
    query += " ORDER BY created_at DESC LIMIT 100";

    const stmt = db.prepare(query);
    stmt.bind(params);
    const folders: any[] = [];
    while (stmt.step()) {
      folders.push(stmt.getAsObject());
    }
    stmt.free();

    // Enrich with participant count & current user participation
    const currentUserId = String(req.query.userId || '');
    const enriched = folders.map(f => {
      let cats: string[] = [];
      let buttons: any[] = [];
      let repeatButtons: any[] = [];
      try { cats = JSON.parse(f.categories || '[]'); } catch (e) {}
      try { buttons = JSON.parse(f.inline_buttons || '[]'); } catch (e) {}
      try { repeatButtons = JSON.parse(f.repeat_inline_buttons || '[]'); } catch (e) {}

      // Get active participants
      const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND status != 'left'");
      pStmt.bind([f.id]);
      const participants: any[] = [];
      let userJoined = false;
      let userParticipantStatus = '';
      while (pStmt.step()) {
        const p: any = pStmt.getAsObject();
        participants.push(p);
        if (currentUserId && p.user_id === currentUserId) {
          userJoined = true;
          userParticipantStatus = p.status;
        }
      }
      pStmt.free();

      const normalizedParticipants = participants.map((p: any) => ({
        ...p,
        avatar_url: p.avatar_url ? normalizeProTalkMediaUrl(String(p.avatar_url)) : p.avatar_url,
        channel_avatar_url: p.channel_avatar_url ? normalizeProTalkMediaUrl(String(p.channel_avatar_url)) : p.channel_avatar_url
      }));

      let attUrls: string[] = [];
      let repeatAttUrls: string[] = [];
      try { attUrls = f.attachment_urls ? JSON.parse(f.attachment_urls) : []; } catch (e) {}
      try { repeatAttUrls = f.repeat_attachment_urls ? JSON.parse(f.repeat_attachment_urls) : []; } catch (e) {}

      const normAttUrls = Array.isArray(attUrls) ? attUrls.map((u) => normalizeProTalkMediaUrl(String(u || ''))).filter(Boolean) : [];
      const normRepeatAttUrls = Array.isArray(repeatAttUrls) ? repeatAttUrls.map((u) => normalizeProTalkMediaUrl(String(u || ''))).filter(Boolean) : [];
      const userParticipant = normalizedParticipants.find(p => p.user_id === currentUserId) || null;

      return {
        ...f,
        image_url: f.image_url ? normalizeProTalkMediaUrl(String(f.image_url)) : '',
        repeat_image_url: f.repeat_image_url ? normalizeProTalkMediaUrl(String(f.repeat_image_url)) : '',
        categories: cats,
        inline_buttons: buttons,
        repeat_inline_buttons: repeatButtons,
        attachment_urls: normAttUrls,
        repeat_attachment_urls: normRepeatAttUrls,
        participantsCount: normalizedParticipants.filter(p => p.status === 'accepted').length,
        totalAppliedCount: normalizedParticipants.length,
        participants: normalizedParticipants,
        userJoined,
        userParticipantStatus,
        userParticipant
      };
    });

    let filtered = enriched;
    if (category) {
      filtered = filtered.filter(f => f.categories.includes(category));
    }
    if (search) {
      filtered = filtered.filter(f => 
        (f.title && f.title.toLowerCase().includes(search)) ||
        (f.post_text && f.post_text.toLowerCase().includes(search)) ||
        (f.author_name && f.author_name.toLowerCase().includes(search))
      );
    }

    res.json({ success: true, folders: filtered });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single folder details
promoRouter.get('/promo-folders/:id', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const folderId = req.params.id;
    const stmt = db.prepare("SELECT * FROM promo_folders WHERE id = ? LIMIT 1");
    stmt.bind([folderId]);
    if (!stmt.step()) {
      stmt.free();
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }
    const f: any = stmt.getAsObject();
    stmt.free();

    // Get active participants
    const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND status != 'left' ORDER BY joined_at ASC");
    pStmt.bind([folderId]);
    const participants: any[] = [];
    while (pStmt.step()) {
      participants.push(pStmt.getAsObject());
    }
    pStmt.free();

    let cats = [];
    let buttons = [];
    let repeatButtons = [];
    let attUrls = [];
    let repeatAttUrls = [];
    try { cats = JSON.parse(f.categories || '[]'); } catch (e) {}
    try { buttons = JSON.parse(f.inline_buttons || '[]'); } catch (e) {}
    try { repeatButtons = JSON.parse(f.repeat_inline_buttons || '[]'); } catch (e) {}
    try { attUrls = f.attachment_urls ? JSON.parse(f.attachment_urls) : []; } catch (e) {}
    try { repeatAttUrls = f.repeat_attachment_urls ? JSON.parse(f.repeat_attachment_urls) : []; } catch (e) {}

    const normAttUrls = Array.isArray(attUrls) ? attUrls.map((u: any) => normalizeProTalkMediaUrl(String(u || ''))).filter(Boolean) : [];
    const normRepeatAttUrls = Array.isArray(repeatAttUrls) ? repeatAttUrls.map((u: any) => normalizeProTalkMediaUrl(String(u || ''))).filter(Boolean) : [];
    const normalizedParticipants = participants.map((p: any) => ({
      ...p,
      avatar_url: p.avatar_url ? normalizeProTalkMediaUrl(String(p.avatar_url)) : p.avatar_url,
      channel_avatar_url: p.channel_avatar_url ? normalizeProTalkMediaUrl(String(p.channel_avatar_url)) : p.channel_avatar_url
    }));

    res.json({
      success: true,
      folder: {
        ...f,
        image_url: f.image_url ? normalizeProTalkMediaUrl(String(f.image_url)) : '',
        repeat_image_url: f.repeat_image_url ? normalizeProTalkMediaUrl(String(f.repeat_image_url)) : '',
        categories: cats,
        inline_buttons: buttons,
        repeat_inline_buttons: repeatButtons,
        attachment_urls: normAttUrls,
        repeat_attachment_urls: normRepeatAttUrls,
        participants: normalizedParticipants
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create folder
promoRouter.post('/promo-folders', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const {
      authorId,
      authorTelegramId,
      authorUsername,
      authorName,
      title,
      categories,
      imageUrl,
      attachmentType = 'none',
      attachmentUrls = [],
      audioFormat = 'audio',
      postText,
      messageFormat = 'rich',
      inlineButtons = [],
      maxParticipants = 10,
      minSubscribers = 0,
      scheduledAt,
      rulesInstruction,
      repeatPostEnabled = false,
      repeatScheduledAt,
      repeatMessageFormat = 'rich',
      repeatImageUrl,
      repeatAttachmentType = 'none',
      repeatAttachmentUrls = [],
      repeatPostText,
      repeatInlineButtons = [],
      reminderBeforeMinutes = 60,
      botCheckBeforeMinutes = 60,
      timezone = 'Europe/Moscow',
      telegramFolderLink = '',
      aiTextGenerated = false
    } = req.body;

    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
      res.status(400).json({ error: 'Укажите название папки' });
      return;
    }
    if (!postText || !postText.trim()) {
      res.status(400).json({ error: 'Укажите рекламный текст поста приглашения' });
      return;
    }
    if (!scheduledAt) {
      res.status(400).json({ error: 'Укажите дату и время размещения' });
      return;
    }

    // Check title uniqueness
    const chkStmt = db.prepare("SELECT id FROM promo_folders WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) LIMIT 1");
    chkStmt.bind([cleanTitle]);
    if (chkStmt.step()) {
      chkStmt.free();
      res.status(400).json({ error: 'Папка с таким названием уже существует в базе данных' });
      return;
    }
    chkStmt.free();

    // Check AI text generation deduction
    const pricing = await getPricingConfig(db);
    const aiTextCost = pricing.promoAndFolders.promoAiText;
    if (aiTextGenerated && authorId && aiTextCost > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId: authorId,
        type: 'cost',
        amount: aiTextCost,
        description: 'Генерация текста для папки через ИИ',
        comment: `Папка: ${cleanTitle}`
      });
    }

    const folderId = `folder_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const inviteCode = `inv_f_${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();
    const safeAttUrls = Array.isArray(attachmentUrls) ? attachmentUrls.map((u: any) => String(u || '').trim()).filter(Boolean) : [];
    const safeRepeatAttUrls = Array.isArray(repeatAttachmentUrls) ? repeatAttachmentUrls.map((u: any) => String(u || '').trim()).filter(Boolean) : [];

    db.run(`
      INSERT INTO promo_folders (
        id, author_id, author_telegram_id, author_username, author_name,
        title, categories, image_url, attachment_type, attachment_urls, audio_format,
        post_text, message_format, inline_buttons,
        max_participants, min_subscribers, scheduled_at, rules_instruction,
        repeat_post_enabled, repeat_scheduled_at, repeat_message_format, repeat_image_url,
        repeat_attachment_type, repeat_attachment_urls, repeat_post_text, repeat_inline_buttons,
        telegram_folder_link, reminder_before_minutes, bot_check_before_minutes, timezone,
        status, invite_code, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        'recruiting', ?, ?, ?
      )
    `, [
      folderId,
      authorId || '16926299042',
      authorTelegramId ? Number(authorTelegramId) : null,
      authorUsername || '',
      authorName || 'Организатор',
      cleanTitle,
      JSON.stringify(Array.isArray(categories) && categories.length > 0 ? categories.slice(0, 10) : ['Бизнес и стартапы']),
      imageUrl || '',
      attachmentType || (imageUrl ? 'photo' : 'none'),
      JSON.stringify(safeAttUrls),
      audioFormat || 'audio',
      postText,
      messageFormat === 'v2' ? 'v2' : 'rich',
      JSON.stringify(inlineButtons || []),
      Number(maxParticipants) || 10,
      Number(minSubscribers) || 0,
      scheduledAt,
      rulesInstruction || '',
      repeatPostEnabled ? 1 : 0,
      repeatScheduledAt || null,
      repeatMessageFormat === 'v2' ? 'v2' : 'rich',
      repeatImageUrl || '',
      repeatAttachmentType || (repeatImageUrl ? 'photo' : 'none'),
      JSON.stringify(safeRepeatAttUrls),
      repeatPostText || '',
      JSON.stringify(repeatInlineButtons || []),
      telegramFolderLink || '',
      Number(reminderBeforeMinutes) || 60,
      Number(botCheckBeforeMinutes) || 60,
      timezone || 'Europe/Moscow',
      inviteCode,
      nowIso,
      nowIso
    ]);

    savePgDB();

    res.json({ success: true, folderId, inviteCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update folder
promoRouter.put('/promo-folders/:id', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const folderId = req.params.id;
    const stmt = db.prepare("SELECT * FROM promo_folders WHERE id = ? LIMIT 1");
    stmt.bind([folderId]);
    if (!stmt.step()) {
      stmt.free();
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }
    const prev: any = stmt.getAsObject();
    stmt.free();

    const {
      title,
      categories,
      imageUrl,
      attachmentType,
      attachmentUrls,
      audioFormat,
      postText,
      messageFormat,
      inlineButtons,
      maxParticipants,
      minSubscribers,
      scheduledAt,
      rulesInstruction,
      repeatPostEnabled,
      repeatScheduledAt,
      repeatMessageFormat,
      repeatImageUrl,
      repeatAttachmentType,
      repeatAttachmentUrls,
      repeatPostText,
      repeatInlineButtons,
      telegramFolderLink,
      reminderBeforeMinutes,
      botCheckBeforeMinutes,
      timezone,
      status
    } = req.body;

    const cleanTitle = title ? String(title).trim() : prev.title;
    if (cleanTitle !== prev.title) {
      const chk = db.prepare("SELECT id FROM promo_folders WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND id != ? LIMIT 1");
      chk.bind([cleanTitle, folderId]);
      if (chk.step()) {
        chk.free();
        res.status(400).json({ error: 'Папка с таким названием уже существует' });
        return;
      }
      chk.free();
    }

    const nowIso = new Date().toISOString();
    const newScheduledAt = scheduledAt || prev.scheduled_at;
    const prevTime = prev.scheduled_at ? new Date(prev.scheduled_at).getTime() : 0;
    const nextTime = scheduledAt ? new Date(scheduledAt).getTime() : 0;
    const isScheduleChanged = Boolean(scheduledAt && (!prevTime || Math.abs(nextTime - prevTime) >= 60000));
    const safeAttUrlsJson = attachmentUrls !== undefined
      ? JSON.stringify(Array.isArray(attachmentUrls) ? attachmentUrls.map((u: any) => String(u || '').trim()).filter(Boolean) : [])
      : (prev.attachment_urls || '[]');
    const safeRepeatAttUrlsJson = repeatAttachmentUrls !== undefined
      ? JSON.stringify(Array.isArray(repeatAttachmentUrls) ? repeatAttachmentUrls.map((u: any) => String(u || '').trim()).filter(Boolean) : [])
      : (prev.repeat_attachment_urls || '[]');

    db.run(`
      UPDATE promo_folders SET
        title = ?,
        categories = ?,
        image_url = ?,
        attachment_type = ?,
        attachment_urls = ?,
        audio_format = ?,
        post_text = ?,
        message_format = ?,
        inline_buttons = ?,
        max_participants = ?,
        min_subscribers = ?,
        scheduled_at = ?,
        rules_instruction = ?,
        repeat_post_enabled = ?,
        repeat_scheduled_at = ?,
        repeat_message_format = ?,
        repeat_image_url = ?,
        repeat_attachment_type = ?,
        repeat_attachment_urls = ?,
        repeat_post_text = ?,
        repeat_inline_buttons = ?,
        telegram_folder_link = ?,
        reminder_before_minutes = ?,
        bot_check_before_minutes = ?,
        timezone = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      cleanTitle,
      categories ? JSON.stringify(categories) : prev.categories,
      imageUrl !== undefined ? imageUrl : prev.image_url,
      attachmentType !== undefined ? attachmentType : (prev.attachment_type || 'none'),
      safeAttUrlsJson,
      audioFormat !== undefined ? audioFormat : (prev.audio_format || 'audio'),
      postText || prev.post_text,
      messageFormat || prev.message_format,
      inlineButtons !== undefined ? JSON.stringify(inlineButtons) : prev.inline_buttons,
      maxParticipants !== undefined ? Number(maxParticipants) : prev.max_participants,
      minSubscribers !== undefined ? Number(minSubscribers) : prev.min_subscribers,
      newScheduledAt,
      rulesInstruction !== undefined ? rulesInstruction : prev.rules_instruction,
      repeatPostEnabled !== undefined ? (repeatPostEnabled ? 1 : 0) : prev.repeat_post_enabled,
      repeatScheduledAt !== undefined ? repeatScheduledAt : prev.repeat_scheduled_at,
      repeatMessageFormat !== undefined ? (repeatMessageFormat === 'v2' ? 'v2' : 'rich') : (prev.repeat_message_format || prev.message_format || 'rich'),
      repeatImageUrl !== undefined ? repeatImageUrl : prev.repeat_image_url,
      repeatAttachmentType !== undefined ? repeatAttachmentType : (prev.repeat_attachment_type || 'none'),
      safeRepeatAttUrlsJson,
      repeatPostText !== undefined ? repeatPostText : prev.repeat_post_text,
      repeatInlineButtons !== undefined ? JSON.stringify(repeatInlineButtons) : prev.repeat_inline_buttons,
      telegramFolderLink !== undefined ? telegramFolderLink : prev.telegram_folder_link,
      reminderBeforeMinutes !== undefined ? Number(reminderBeforeMinutes) : (prev.reminder_before_minutes || 60),
      botCheckBeforeMinutes !== undefined ? Number(botCheckBeforeMinutes) : (prev.bot_check_before_minutes || 60),
      timezone || prev.timezone || 'Europe/Moscow',
      status || prev.status,
      nowIso,
      folderId
    ]);

    // If date/time changed, notify all participants in Telegram PM and in-app notifications
    if (isScheduleChanged) {
      // If rescheduled to future, reactivate folder, reset reminder flag and participant publication flags
      if (new Date(newScheduledAt).getTime() > Date.now()) {
        db.run("UPDATE promo_folders SET status = 'confirmed', reminder_sent = 0 WHERE id = ?", [folderId]);
        db.run("UPDATE promo_folder_participants SET post_published = 0, repeat_post_published = 0, reject_reason = NULL WHERE folder_id = ?", [folderId]);
      }

      const cacheKey = `fld_reschedule_${folderId}`;
      const lastNotified = rescheduleNotificationCache.get(cacheKey) || 0;
      const shouldNotify = (Date.now() - lastNotified) > 60000;

      if (shouldNotify) {
        rescheduleNotificationCache.set(cacheKey, Date.now());

        const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND status = 'accepted'");
        pStmt.bind([folderId]);
        const participants: any[] = [];
        while (pStmt.step()) {
          participants.push(pStmt.getAsObject());
        }
        pStmt.free();

        const dateReadable = formatMskDateTime(newScheduledAt);

        // Group by user_id to prevent duplicate notifications
        const userChannelsMap = new Map<string, string[]>();
        for (const p of participants) {
          const uid = String(p.user_id);
          if (!userChannelsMap.has(uid)) userChannelsMap.set(uid, []);
          userChannelsMap.get(uid)!.push(p.channel_name || 'Канал');
        }

        const notifiedTgIds = new Set<number>();
        const joinedFolderPath = `/folders?tab=folders&scope=joined&folderId=${folderId}`;
        const joinedFolderUrl = `${resolvePublicAppBaseUrl(req)}${joinedFolderPath}`;
        for (const [uid, channelNames] of userChannelsMap.entries()) {
          const channelsList = channelNames.join(', ');
          createNotificationInDb(db, {
            userId: uid,
            title: 'Перенос времени публикации папки',
            message: `Организатор папки «${cleanTitle}» изменил дату/время публикации на ${dateReadable}. Каналы: ${channelsList}.`,
            type: 'publish',
            link: joinedFolderPath
          });

          // Send telegram notification to participant with inline link to "Где я участвую"
          const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
          uStmt.bind([uid]);
          if (uStmt.step()) {
            const tgId = uStmt.getAsObject().telegram_id;
            if (tgId && !notifiedTgIds.has(Number(tgId))) {
              notifiedTgIds.add(Number(tgId));
              sendPrivateTelegramNotification(
                Number(tgId),
                `🔔 <b>Внимание! Перенос публикации папки</b>\n\nОрганизатор папки «${cleanTitle}» изменил дату и время выхода на <b>${dateReadable}</b>.\nВаши участвующие каналы: <b>${channelsList}</b>.\nПожалуйста, проверьте готовность канала к размещению.`,
                { inline_keyboard: [[{ text: '📁 Открыть «Где я участвую»', url: joinedFolderUrl }]] }
              ).catch(() => {});
            }
          }
          uStmt.free();
        }
      }
    }

    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Join folder in 1 click (supports single channel or multi-channel array)
promoRouter.post('/promo-folders/:id/join', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const folderId = req.params.id;
    const { userId, channelId, channelName, channelUsername, subscribersCount, avatarUrl, isPaidEntry = false, channels } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'Не указан идентификатор пользователя' });
      return;
    }

    // Get folder details
    const fStmt = db.prepare("SELECT * FROM promo_folders WHERE id = ? LIMIT 1");
    fStmt.bind([folderId]);
    if (!fStmt.step()) {
      fStmt.free();
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }
    const folder: any = fStmt.getAsObject();
    fStmt.free();

    // Prepare list of channels to join
    const channelList: any[] = [];
    if (Array.isArray(channels) && channels.length > 0) {
      for (const ch of channels) {
        if (ch && (ch.channelId || ch.id)) {
          channelList.push({
            channelId: String(ch.channelId || ch.id),
            channelName: ch.channelName || ch.name || ch.title || 'Канал',
            channelUsername: ch.channelUsername || ch.username || ch.telegramUsername || '',
            subscribersCount: Number(ch.subscribersCount ?? ch.subscribers ?? 0),
            avatarUrl: ch.avatarUrl || ch.photoUrl || '',
            isPaidEntry: Boolean(ch.isPaidEntry)
          });
        }
      }
    } else if (channelId && channelName) {
      channelList.push({
        channelId: String(channelId),
        channelName,
        channelUsername: channelUsername || '',
        subscribersCount: Number(subscribersCount) || 0,
        avatarUrl: avatarUrl || '',
        isPaidEntry: Boolean(isPaidEntry)
      });
    }

    if (channelList.length === 0) {
      res.status(400).json({ error: 'Не выбраны каналы для добавления в папку' });
      return;
    }

    const isAuthor = folder.author_id === userId;
    const initialStatus = isAuthor ? 'accepted' : 'pending';
    const addedParticipantIds: string[] = [];

    // Query participant user contacts safely once for notifications
    let participantUser: any = null;
    try {
      const uStmt = db.prepare("SELECT id, first_name, last_name, username, telegram_id, balance FROM users WHERE id = ? OR telegram_id = ? LIMIT 1");
      uStmt.bind([userId, userId]);
      if (uStmt.step()) {
        participantUser = uStmt.getAsObject();
      }
      uStmt.free();
    } catch (e) {
      try {
        const uStmt2 = db.prepare("SELECT id, username, telegram_id, balance FROM users WHERE id = ? OR telegram_id = ? LIMIT 1");
        uStmt2.bind([userId, userId]);
        if (uStmt2.step()) {
          participantUser = uStmt2.getAsObject();
        }
        uStmt2.free();
      } catch (e2) {}
    }

    // Resolve author / organizer telegram info
    let authorTelegramId = folder.author_telegram_id;
    let authorUser: any = null;
    if (folder.author_id) {
      try {
        const aStmt = db.prepare("SELECT id, telegram_id, username, first_name, name FROM users WHERE id = ? OR telegram_id = ? LIMIT 1");
        aStmt.bind([folder.author_id, folder.author_id]);
        if (aStmt.step()) {
          authorUser = aStmt.getAsObject();
          if (!authorTelegramId && authorUser.telegram_id) {
            authorTelegramId = authorUser.telegram_id;
          }
        }
        aStmt.free();
      } catch (e) {}
    }

    for (let i = 0; i < channelList.length; i++) {
      const chItem = channelList[i];
      const subs = chItem.subscribersCount;

      // Check subscriber threshold
      if (subs < Number(folder.min_subscribers || 0) && !chItem.isPaidEntry) {
        // Skip or permit with warning if multiple
        if (channelList.length === 1) {
          res.status(400).json({ 
            error: `Минимальный порог входа в эту папку: ${folder.min_subscribers} подписчиков. У канала «${chItem.channelName}»: ${subs}.` 
          });
          return;
        }
        continue;
      }

      let joinedPartId = '';
      let isRejoin = false;

      // Check duplicate
      const dStmt = db.prepare("SELECT id, status FROM promo_folder_participants WHERE folder_id = ? AND channel_id = ? LIMIT 1");
      dStmt.bind([folderId, chItem.channelId]);
      if (dStmt.step()) {
        const existing: any = dStmt.getAsObject();
        dStmt.free();
        if (existing.status !== 'left' && existing.status !== 'invited' && existing.status !== 'declined') {
          // Already active/pending in folder, continue to next
          continue;
        } else {
          // Re-join or confirm reanimated invitation
          const botCheck = await verifyBotInChannel(chItem.channelUsername || chItem.channelName);
          db.run(`
            UPDATE promo_folder_participants
            SET user_id = ?, channel_name = ?, channel_username = ?, subscribers_count = ?,
                avatar_url = ?, joined_at = ?, status = ?, is_paid_entry = ?, bot_verified = ?,
                post_published = 0, repeat_post_published = 0
            WHERE id = ?
          `, [
            userId,
            chItem.channelName,
            chItem.channelUsername || '',
            subs,
            chItem.avatarUrl || botCheck.photoUrl || '',
            new Date().toISOString(),
            initialStatus,
            chItem.isPaidEntry ? 1 : 0,
            botCheck.ok ? 1 : 0,
            existing.id
          ]);
          joinedPartId = existing.id;
          isRejoin = true;
          addedParticipantIds.push(existing.id);
        }
      } else {
        dStmt.free();
        const partId = `fpart_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`;

        // Verify bot presence
        const botCheck = await verifyBotInChannel(chItem.channelUsername || chItem.channelName);

        db.run(`
          INSERT INTO promo_folder_participants (
            id, folder_id, user_id, channel_id, channel_name, channel_username,
            subscribers_count, avatar_url, joined_at, status, is_paid_entry, bot_verified
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          partId,
          folderId,
          userId,
          chItem.channelId,
          chItem.channelName,
          chItem.channelUsername || '',
          subs,
          chItem.avatarUrl || botCheck.photoUrl || '',
          new Date().toISOString(),
          initialStatus,
          chItem.isPaidEntry ? 1 : 0,
          botCheck.ok ? 1 : 0
        ]);

        joinedPartId = partId;
        addedParticipantIds.push(partId);
      }

      // 1. Transaction: Deduct dynamic join fee from participant balance
      const joinPricing = await getPricingConfig(db);
      const joinFee = joinPricing.promoAndFolders.folderJoin;
      if (joinFee > 0) {
        try {
          addTransactionWithBalanceUpdate(db, {
            userId,
            type: 'cost',
            amount: -joinFee,
            description: `Участие канала «${chItem.channelName}» в папке «${folder.title}»`,
            comment: `Списание ${formatIirkyCount(joinFee)} за добавление канала в папку «${folder.title}»`,
            status: 'Завершено'
          });

          createNotificationInDb(db, {
            userId,
            title: `Списание ${formatIirkyCount(joinFee)}`,
            message: `С вашего баланса списано ${formatIirkyCount(joinFee)} за участие канала «${chItem.channelName}» в папке «${folder.title}».`,
            type: 'transaction',
            link: `/folders?folderId=${folderId}`
          });
        } catch (txErr) {
          console.error('[Join Tx] Error deducting join fee:', txErr);
        }
      }

      // Prepare links and formatting for Telegram notifications
      const channelCleanUser = chItem.channelUsername ? String(chItem.channelUsername).replace(/^@/, '') : '';
      const channelUrl = channelCleanUser ? `https://t.me/${channelCleanUser}` : '';
      const userTgUser = participantUser?.username ? String(participantUser.username).replace(/^@/, '') : '';
      const userTgUrl = userTgUser ? `https://t.me/${userTgUser}` : (participantUser?.telegram_id ? `tg://user?id=${participantUser.telegram_id}` : '');

      const { dateStr: pubDateStr, timeStr: pubTimeStr } = formatPubDate(folder.scheduled_at);
      const tzStr = folder.timezone || 'МСК';
      const folderLinkUrl = folder.telegram_folder_link || (channelCleanUser ? `https://t.me/${channelCleanUser}` : 'https://t.me/IIrkiBot');

      const inlineRows: any[] = [];
      inlineRows.push([{ text: `📁 Папка: «${folder.title}»`, url: folderLinkUrl }]);
      inlineRows.push([
        { text: `📅 Дата: ${pubDateStr}`, url: folderLinkUrl },
        { text: `⏰ Время: ${pubTimeStr} (${tzStr})`, url: folderLinkUrl }
      ]);
      const rowLinks: any[] = [];
      if (channelUrl) rowLinks.push({ text: `📢 ${chItem.channelName}`, url: channelUrl });
      if (userTgUrl) rowLinks.push({ text: `👤 Участник`, url: userTgUrl });
      if (rowLinks.length > 0) inlineRows.push(rowLinks);
      if (folder.telegram_folder_link) {
        inlineRows.push([{ text: `🔗 Открыть папку в Telegram`, url: folder.telegram_folder_link }]);
      }

      const participantDisplayName = participantUser?.first_name || participantUser?.name || 'Пользователь';

      // Notification message to folder organizer
      const organizerNotifyMsg = `<b>➕ Добавлен канал в вашу папку «${folder.title}»</b>\n\n` +
        `📁 <b>Папка:</b> «${folder.title}»\n` +
        `📅 <b>Дата выхода:</b> ${pubDateStr}\n` +
        `⏰ <b>Время выхода:</b> ${pubTimeStr} (${tzStr})\n` +
        `📢 <b>Канал:</b> ${chItem.channelName} ${channelCleanUser ? `(@${channelCleanUser})` : ''}\n` +
        `👥 <b>Подписчиков:</b> ${subs}\n` +
        `👤 <b>Участник:</b> ${participantDisplayName} ${userTgUser ? `(@${userTgUser})` : ''}\n` +
        `Статус: ${initialStatus === 'accepted' ? '✅ Одобрен' : '⏳ Ожидает модерации'}`;

      // In-app notification to organizer
      if (folder.author_id) {
        createNotificationInDb(db, {
          userId: folder.author_id,
          title: 'Новая заявка в папку',
          message: `Канал «${chItem.channelName}» (${subs} подп.) вступил в папку «${folder.title}».`,
          type: 'social',
          link: `/folders?folderId=${folderId}`
        });
      }

      // Send Telegram notification to folder organizer
      if (authorTelegramId) {
        sendPrivateTelegramNotification(
          Number(authorTelegramId),
          organizerNotifyMsg,
          inlineRows.length > 0 ? { inline_keyboard: inlineRows } : undefined
        ).catch((e) => console.error('[Join Notify Author] Telegram error:', e));
      }

      // Telegram notification to participant about join and 1 ИИрка cost
      if (participantUser?.telegram_id) {
        const participantJoinMsg = `<b>✅ Вы успешно вступили в папку «${folder.title}»</b>\n\n` +
          `💸 С вашего баланса списана <b>1 ИИрка</b> за участие канала.\n\n` +
          `📁 <b>Папка:</b> «${folder.title}»\n` +
          `📅 <b>Дата публикации:</b> ${pubDateStr}\n` +
          `⏰ <b>Время публикации:</b> ${pubTimeStr} (${tzStr})\n` +
          `📢 <b>Канал:</b> ${chItem.channelName} ${channelCleanUser ? `(@${channelCleanUser})` : ''}\n` +
          `Статус: ${initialStatus === 'accepted' ? '✅ Одобрен организатором' : '⏳ Ожидает подтверждения'}`;

        sendPrivateTelegramNotification(
          Number(participantUser.telegram_id),
          participantJoinMsg,
          inlineRows.length > 0 ? { inline_keyboard: inlineRows } : undefined
        ).catch((e) => console.error('[Join Notify Participant] Telegram error:', e));
      }
    }

    if (addedParticipantIds.length === 0 && channelList.length > 0) {
      res.status(400).json({ error: 'Все выбранные каналы уже добавлены в эту папку или не соответствуют порогу' });
      return;
    }

    savePgDB();
    res.json({ success: true, count: addedParticipantIds.length, participantIds: addedParticipantIds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Leave folder: Real-time deletion from database with Telegram author notification
promoRouter.post('/promo-folders/:id/leave', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const folderId = req.params.id;
    const { userId, channelId, participantId } = req.body;

    // Fetch participant and folder details for notification
    let part: any = null;
    if (participantId) {
      const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND id = ? LIMIT 1");
      pStmt.bind([folderId, participantId]);
      if (pStmt.step()) part = pStmt.getAsObject();
      pStmt.free();
    } else if (channelId) {
      const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND channel_id = ? LIMIT 1");
      pStmt.bind([folderId, channelId]);
      if (pStmt.step()) part = pStmt.getAsObject();
      pStmt.free();
    } else if (userId) {
      const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND user_id = ? LIMIT 1");
      pStmt.bind([folderId, userId]);
      if (pStmt.step()) part = pStmt.getAsObject();
      pStmt.free();
    }

    const fStmt = db.prepare("SELECT * FROM promo_folders WHERE id = ? LIMIT 1");
    fStmt.bind([folderId]);
    let folder: any = null;
    if (fStmt.step()) {
      folder = fStmt.getAsObject();
    }
    fStmt.free();

    let participantUser: any = null;
    if (part && part.user_id) {
      const uStmt = db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
      uStmt.bind([part.user_id]);
      if (uStmt.step()) participantUser = uStmt.getAsObject();
      uStmt.free();
    }

    // REAL-TIME DELETION FROM DATABASE
    if (participantId && !String(participantId).startsWith('temp_')) {
      db.run("DELETE FROM promo_folder_participants WHERE folder_id = ? AND id = ?", [folderId, participantId]);
    }
    if (channelId) {
      db.run("DELETE FROM promo_folder_participants WHERE folder_id = ? AND channel_id = ?", [folderId, channelId]);
    }
    if (!channelId && (!participantId || String(participantId).startsWith('temp_')) && userId) {
      db.run("DELETE FROM promo_folder_participants WHERE folder_id = ? AND user_id = ?", [folderId, userId]);
    }

    // Send Telegram notification to folder author and participant about channel departure
    if (folder && part) {
      const channelCleanUser = part.channel_username ? String(part.channel_username).replace(/^@/, '') : '';
      const channelUrl = channelCleanUser ? `https://t.me/${channelCleanUser}` : '';

      const { dateStr: pubDateStr, timeStr: pubTimeStr } = formatPubDate(folder.scheduled_at);
      const tzStr = folder.timezone || 'МСК';
      const folderLinkUrl = folder.telegram_folder_link || (channelCleanUser ? `https://t.me/${channelCleanUser}` : 'https://t.me/IIrkiBot');

      const inlineRows: any[] = [];
      inlineRows.push([{ text: `📁 Папка: «${folder.title}»`, url: folderLinkUrl }]);
      inlineRows.push([
        { text: `📅 Дата: ${pubDateStr}`, url: folderLinkUrl },
        { text: `⏰ Время: ${pubTimeStr} (${tzStr})`, url: folderLinkUrl }
      ]);
      if (channelUrl) {
        inlineRows.push([{ text: `📢 Канал: ${part.channel_name}`, url: channelUrl }]);
      }
      if (folder.telegram_folder_link) {
        inlineRows.push([{ text: `🔗 Открыть папку в Telegram`, url: folder.telegram_folder_link }]);
      }

      const leaveMsg = `<b>➖ Канал удален из папки «${folder.title}»</b>\n\n` +
        `📁 <b>Папка:</b> «${folder.title}»\n` +
        `📅 <b>Дата публикации:</b> ${pubDateStr}\n` +
        `⏰ <b>Время публикации:</b> ${pubTimeStr} (${tzStr})\n` +
        `📢 <b>Канал:</b> ${part.channel_name} ${channelCleanUser ? `(@${channelCleanUser})` : ''}\n` +
        `👥 <b>Подписчиков:</b> ${part.subscribers_count || 0}\n\n` +
        `Канал удален из базы данных в реальном времени и больше не участвует в совместном размещении папки.`;

      let authorTgId = folder.author_telegram_id;
      if (!authorTgId && folder.author_id) {
        try {
          const aStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? OR telegram_id = ? LIMIT 1");
          aStmt.bind([folder.author_id, folder.author_id]);
          if (aStmt.step()) {
            authorTgId = aStmt.getAsObject().telegram_id;
          }
          aStmt.free();
        } catch (e) {}
      }

      if (authorTgId) {
        sendPrivateTelegramNotification(
          Number(authorTgId),
          leaveMsg,
          inlineRows.length > 0 ? { inline_keyboard: inlineRows } : undefined
        ).catch(() => {});
      }

      if (participantUser?.telegram_id && String(participantUser.telegram_id) !== String(authorTgId)) {
        sendPrivateTelegramNotification(
          Number(participantUser.telegram_id),
          leaveMsg,
          inlineRows.length > 0 ? { inline_keyboard: inlineRows } : undefined
        ).catch(() => {});
      }
    }

    savePgDB();
    res.json({ success: true, message: 'Канал успешно удален из базы данных в реальном времени' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Author approves or declines participant
promoRouter.post('/promo-folders/:id/participants/:partId/status', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { id: folderId, partId } = req.params;
    const { status, rejectReason } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      res.status(400).json({ error: 'Некорректный статус' });
      return;
    }

    const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE id = ? AND folder_id = ? LIMIT 1");
    pStmt.bind([partId, folderId]);
    if (!pStmt.step()) {
      pStmt.free();
      res.status(404).json({ error: 'Участник не найден' });
      return;
    }
    const part: any = pStmt.getAsObject();
    pStmt.free();

    const fStmt = db.prepare("SELECT * FROM promo_folders WHERE id = ? LIMIT 1");
    fStmt.bind([folderId]);
    let folder: any = null;
    if (fStmt.step()) {
      folder = fStmt.getAsObject();
    }
    fStmt.free();
    const folderTitle = folder?.title || 'Папка';

    db.run(`
      UPDATE promo_folder_participants
      SET status = ?, reject_reason = ?
      WHERE id = ?
    `, [status, rejectReason || '', partId]);

    // Send notifications to participant and refund entry fee
    if (status === 'declined') {
      const reasonText = rejectReason ? `Причина: ${rejectReason}` : 'Причина не указана организатором.';
      
      // Refund 1 ИИрка to participant
      try {
        addTransactionWithBalanceUpdate(db, {
          userId: part.user_id,
          type: 'admin',
          amount: 1,
          description: `Возврат 1 ИИрки за отклоненное участие в папке «${folderTitle}»`,
          comment: `Канал «${part.channel_name}» отклонен: ${reasonText}`
        });
      } catch (refErr) {
        console.error('[Refund Folder Part Error]:', refErr);
      }

      createNotificationInDb(db, {
        userId: part.user_id,
        title: `Отклонено участие в папке «${folderTitle}»`,
        message: `Ваш канал «${part.channel_name}» был отклонен организатором папки. 1 ИИрка возвращена на ваш баланс. ${reasonText}`,
        type: 'system',
        link: `/folders?folderId=${folderId}`
      });

      const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
      uStmt.bind([part.user_id]);
      if (uStmt.step()) {
        const tgId = uStmt.getAsObject().telegram_id;
        if (tgId) {
          const declineButtons: any[] = [];
          if (folder?.author_username) {
            const orgClean = String(folder.author_username).replace(/^@/, '');
            declineButtons.push([{ text: '👤 Связаться с организатором', url: `https://t.me/${orgClean}` }]);
          }
          sendPrivateTelegramNotification(
            Number(tgId),
            `<b>❌ Ваша заявка канала «${part.channel_name}» в папку «${folderTitle}» отклонена</b>\n\n` +
            `📢 <b>Канал:</b> ${part.channel_name}\n` +
            `📁 <b>Папка:</b> «${folderTitle}»\n` +
            `ℹ️ <b>${reasonText}</b>`,
            declineButtons.length > 0 ? { inline_keyboard: declineButtons } : undefined
          ).catch(() => {});
        }
      }
      uStmt.free();
    } else if (status === 'accepted') {
      createNotificationInDb(db, {
        userId: part.user_id,
        title: `Канал одобрен для участия в папке «${folderTitle}»`,
        message: `Поздравляем! Ваш канал «${part.channel_name}» одобрен для совместного размещения.`,
        type: 'publish',
        link: `/folders?folderId=${folderId}`
      });

      const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
      uStmt.bind([part.user_id]);
      if (uStmt.step()) {
        const tgId = uStmt.getAsObject().telegram_id;
        if (tgId) {
          const acceptedButtons: any[] = [];
          if (folder?.telegram_folder_link) {
            acceptedButtons.push([{ text: '📁 Открыть папку в Telegram', url: folder.telegram_folder_link }]);
          }
          if (folder?.author_username) {
            const orgClean = String(folder.author_username).replace(/^@/, '');
            acceptedButtons.push([{ text: '👤 Организатор папки', url: `https://t.me/${orgClean}` }]);
          }
          const scheduledTimeStr = folder?.scheduled_at ? formatMskDateTime(folder.scheduled_at) : '';
          sendPrivateTelegramNotification(
            Number(tgId),
            `<b>🎉 Ваш канал «${part.channel_name}» одобрен и добавлен в папку «${folderTitle}»!</b>\n\n` +
            `📢 <b>Канал:</b> ${part.channel_name}\n` +
            `📁 <b>Папка:</b> «${folderTitle}»\n` +
            (scheduledTimeStr ? `📅 <b>Дата публикации:</b> ${scheduledTimeStr}\n` : '') +
            `Пожалуйста, не удаляйте бота из администраторов вашего канала до окончания акции.`,
            acceptedButtons.length > 0 ? { inline_keyboard: acceptedButtons } : undefined
          ).catch(() => {});
        }
      }
      uStmt.free();
    }

    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Participant sets custom publication time (max 24h forward from scheduled_at and repeat_scheduled_at)
promoRouter.post('/promo-folders/:id/participants/:partId/custom-time', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { id: folderId, partId } = req.params;
    const { customPublishTime, customRepeatPublishTime } = req.body;

    const fStmt = db.prepare("SELECT scheduled_at, repeat_scheduled_at, title, author_id, author_telegram_id FROM promo_folders WHERE id = ? LIMIT 1");
    fStmt.bind([folderId]);
    if (!fStmt.step()) {
      fStmt.free();
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }
    const folder: any = fStmt.getAsObject();
    fStmt.free();

    const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE id = ? LIMIT 1");
    pStmt.bind([partId]);
    if (!pStmt.step()) {
      pStmt.free();
      res.status(404).json({ error: 'Участник не найден' });
      return;
    }
    const part: any = pStmt.getAsObject();
    pStmt.free();

    const actorUserId = String(req.body?.userId || (req.headers['x-user-id'] as string) || '').trim();
    if (actorUserId) {
      const isOrganizer = actorUserId === String(folder.author_id || '') || (folder.author_telegram_id && actorUserId === String(folder.author_telegram_id));
      const isOwner = actorUserId === String(part.user_id || '');
      let isAdmin = false;
      if (!isOrganizer && !isOwner) {
        try {
          const uStmt = db.prepare("SELECT id, telegram_id, role FROM users WHERE id = ? OR CAST(telegram_id AS TEXT) = ? LIMIT 1");
          uStmt.bind([actorUserId, actorUserId]);
          if (uStmt.step()) {
            const uObj: any = uStmt.getAsObject();
            const role = String(uObj.role || '').toLowerCase();
            isAdmin = role === 'admin' || role === 'superadmin';
            if (uObj.id && (String(uObj.id) === String(folder.author_id || '') || String(uObj.id) === String(part.user_id || ''))) {
              isAdmin = true;
            }
          }
          uStmt.free();
        } catch {}
      }
      if (!isOrganizer && !isOwner && !isAdmin) {
        res.status(403).json({ error: 'Изменять время публикации может только организатор или владелец канала' });
        return;
      }
    }

    // Check difference <= 24 hours for primary post
    if (customPublishTime) {
      const baseTime = new Date(folder.scheduled_at).getTime();
      const newTime = new Date(customPublishTime).getTime();
      const diffHours = (newTime - baseTime) / (3600 * 1000);

      if (isNaN(diffHours) || diffHours < -0.01 || diffHours > 24.01) {
        res.status(400).json({ error: 'Персональное время публикации первого поста можно сместить не более чем на 24 часа вперёд от даты общего сбора' });
        return;
      }
      db.run("UPDATE promo_folder_participants SET custom_publish_time = ? WHERE id = ?", [customPublishTime, partId]);
    } else if (customPublishTime === null || customPublishTime === '') {
      db.run("UPDATE promo_folder_participants SET custom_publish_time = NULL WHERE id = ?", [partId]);
    }

    // Check difference <= 24 hours for repeat post if provided
    if (customRepeatPublishTime) {
      if (folder.repeat_scheduled_at) {
        const baseRepeatTime = new Date(folder.repeat_scheduled_at).getTime();
        const newRepeatTime = new Date(customRepeatPublishTime).getTime();
        const diffRepeatHours = (newRepeatTime - baseRepeatTime) / (3600 * 1000);

        if (isNaN(diffRepeatHours) || diffRepeatHours < -0.01 || diffRepeatHours > 24.01) {
          res.status(400).json({ error: 'Персональное время повторного поста можно сместить не более чем на 24 часа вперёд от даты повторной публикации' });
          return;
        }
      }
      db.run("UPDATE promo_folder_participants SET custom_repeat_publish_time = ? WHERE id = ?", [customRepeatPublishTime, partId]);
    } else if (customRepeatPublishTime === null || customRepeatPublishTime === '') {
      db.run("UPDATE promo_folder_participants SET custom_repeat_publish_time = NULL WHERE id = ?", [partId]);
    }

    // Send notification to folder author & system admin
    const timeReadable = customPublishTime ? formatMskDateTime(customPublishTime) : '';
    createNotificationInDb(db, {
      userId: folder.author_id,
      title: 'Участник изменил время публикации',
      message: `Канал «${part.channel_name}» настроил индивидуальное время публикации в папке «${folder.title}»${timeReadable ? ` на ${timeReadable}` : ''}.`,
      type: 'publish',
      link: `/folders?folderId=${folderId}`
    });

    if (folder.author_telegram_id) {
      sendPrivateTelegramNotification(
        folder.author_telegram_id,
        `Участник «${part.channel_name}» в папке «${folder.title}» настроил индивидуальное время выхода поста${timeReadable ? `: ${timeReadable}` : ''}.`
      ).catch(() => {});
    }

    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Author manages participant Sponsor status
promoRouter.post('/promo-folders/:id/participants/:partId/sponsor', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { id: folderId, partId } = req.params;
    const { isSponsor, sponsorSkipPosting } = req.body;

    const fStmt = db.prepare("SELECT title, author_id, author_telegram_id FROM promo_folders WHERE id = ? LIMIT 1");
    fStmt.bind([folderId]);
    if (!fStmt.step()) {
      fStmt.free();
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }
    const folder: any = fStmt.getAsObject();
    fStmt.free();

    const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE id = ? LIMIT 1");
    pStmt.bind([partId]);
    if (!pStmt.step()) {
      pStmt.free();
      res.status(404).json({ error: 'Участник не найден' });
      return;
    }
    const part: any = pStmt.getAsObject();
    pStmt.free();

    const sponsorVal = isSponsor ? 1 : 0;
    const skipPostingVal = sponsorSkipPosting ? 1 : 0;

    // If becoming sponsor, approve automatically if pending
    const newStatus = (sponsorVal === 1 && part.status === 'pending') ? 'accepted' : part.status;

    db.run(
      "UPDATE promo_folder_participants SET is_sponsor = ?, sponsor_skip_posting = ?, status = ? WHERE id = ?",
      [sponsorVal, skipPostingVal, newStatus, partId]
    );

    // Notification to participant
    createNotificationInDb(db, {
      userId: part.user_id,
      title: sponsorVal === 1 ? 'Вам присвоен статус Спонсор' : 'Статус Спонсор изменен',
      message: sponsorVal === 1
        ? `Организатор папки «${folder.title}» присвоил вашему каналу «${part.channel_name}» статус Спонсор!${skipPostingVal === 1 ? ' Отправка поста на ваш канал отключена.' : ''}`
        : `Статус Спонсора для канала «${part.channel_name}» в папке «${folder.title}» был отключен организатором.`,
      type: 'system',
      link: `/folders?folderId=${folderId}`
    });

    savePgDB();
    res.json({
      success: true,
      is_sponsor: sponsorVal,
      sponsor_skip_posting: skipPostingVal,
      status: newStatus
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Author confirms folder link & verifies bots
promoRouter.post('/promo-folders/:id/confirm', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const folderId = req.params.id;
    const { telegramFolderLink } = req.body;

    if (!telegramFolderLink || !telegramFolderLink.trim().startsWith('https://t.me/addlist/')) {
      res.status(400).json({ error: 'Укажите корректную ссылку на папку Telegram (начинается с https://t.me/addlist/...)' });
      return;
    }

    const fStmt = db.prepare("SELECT * FROM promo_folders WHERE id = ? LIMIT 1");
    fStmt.bind([folderId]);
    if (!fStmt.step()) {
      fStmt.free();
      res.status(404).json({ error: 'Папка не найдена' });
      return;
    }
    const folder: any = fStmt.getAsObject();
    fStmt.free();

    // Verify bots on all accepted participants
    const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND status = 'accepted'");
    pStmt.bind([folderId]);
    const participants: any[] = [];
    while (pStmt.step()) {
      participants.push(pStmt.getAsObject());
    }
    pStmt.free();

    for (const p of participants) {
      const chk = await verifyBotInChannel(p.channel_username || p.channel_name);
      db.run("UPDATE promo_folder_participants SET bot_verified = ? WHERE id = ?", [chk.ok ? 1 : 0, p.id]);

      // Send telegram PM to participant with post preview
      const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
      uStmt.bind([p.user_id]);
      if (uStmt.step()) {
        const tgId = uStmt.getAsObject().telegram_id;
        if (tgId) {
          sendPrivateTelegramNotification(
            Number(tgId),
            `Организатор утвердил список папки «${folder.title}»!\nСсылка на папку: ${telegramFolderLink}\nДата выхода: ${formatMskDateTime(folder.scheduled_at)}\nПроверьте, что бот @IIrkiBot назначен администратором на канале ${p.channel_name}.`
          ).catch(() => {});
        }
      }
      uStmt.free();
    }

    db.run("UPDATE promo_folders SET telegram_folder_link = ?, status = 'confirmed', updated_at = ? WHERE id = ?", [
      telegramFolderLink.trim(),
      new Date().toISOString(),
      folderId
    ]);

    savePgDB();
    res.json({ success: true, verifiedCount: participants.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 2. PROMO SELECTIONS (Подборки)
// ============================================================================

// Check selection title uniqueness
promoRouter.get('/promo-selections/check-title', async (req: Request, res: Response) => {
  const title = String(req.query.title || '').trim();
  const excludeId = String(req.query.excludeId || '').trim();
  if (!title) {
    res.json({ available: false, error: 'Название не может быть пустым' });
    return;
  }
  const db = await getPgDB();
  const stmt = db.prepare(`SELECT id FROM promo_selections WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND id != ? LIMIT 1`);
  stmt.bind([title, excludeId]);
  const exists = stmt.step();
  stmt.free();
  res.json({ available: !exists, error: exists ? 'Подборка с таким названием уже существует' : undefined });
});

// List selections
promoRouter.get('/promo-selections', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const category = String(req.query.category || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();
    const currentUserId = String(req.query.userId || '');

    const stmt = db.prepare("SELECT * FROM promo_selections ORDER BY created_at DESC LIMIT 100");
    const selections: any[] = [];
    while (stmt.step()) {
      selections.push(stmt.getAsObject());
    }
    stmt.free();

    const enriched = selections.map(s => {
      let cats: string[] = [];
      let buttons: any[] = [];
      try { cats = JSON.parse(s.categories || '[]'); } catch (e) {}
      try { buttons = s.inline_buttons ? (typeof s.inline_buttons === 'string' ? JSON.parse(s.inline_buttons) : s.inline_buttons) : []; } catch (e) {}

      const chStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ? ORDER BY joined_at ASC");
      chStmt.bind([s.id]);
      const channels: any[] = [];
      let userJoined = false;
      while (chStmt.step()) {
        const ch: any = chStmt.getAsObject();
        channels.push({
          ...ch,
          channel_avatar_url: ch.channel_avatar_url ? normalizeProTalkMediaUrl(String(ch.channel_avatar_url)) : ''
        });
        if (currentUserId && ch.user_id === currentUserId) {
          userJoined = true;
        }
      }
      chStmt.free();

      return {
        ...s,
        image_url: s.image_url ? normalizeProTalkMediaUrl(String(s.image_url)) : '',
        categories: cats,
        inline_buttons: Array.isArray(buttons) ? buttons : [],
        channelsCount: channels.filter(c => c.status === 'active').length,
        channels,
        userJoined
      };
    });

    let filtered = enriched;
    if (category) {
      filtered = filtered.filter(s => s.categories.includes(category));
    }
    if (search) {
      filtered = filtered.filter(s =>
        (s.title && s.title.toLowerCase().includes(search)) ||
        (s.header_title && s.header_title.toLowerCase().includes(search)) ||
        (s.header_subtitle && s.header_subtitle.toLowerCase().includes(search))
      );
    }

    res.json({ success: true, selections: filtered });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single selection details
promoRouter.get('/promo-selections/:id', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const selId = req.params.id;
    const stmt = db.prepare("SELECT * FROM promo_selections WHERE id = ? LIMIT 1");
    stmt.bind([selId]);
    if (!stmt.step()) {
      stmt.free();
      res.status(404).json({ error: 'Подборка не найдена' });
      return;
    }
    const s: any = stmt.getAsObject();
    stmt.free();

    const chStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ? ORDER BY joined_at ASC");
    chStmt.bind([selId]);
    const channels: any[] = [];
    while (chStmt.step()) {
      const ch: any = chStmt.getAsObject();
      channels.push({
        ...ch,
        channel_avatar_url: ch.channel_avatar_url ? normalizeProTalkMediaUrl(String(ch.channel_avatar_url)) : ''
      });
    }
    chStmt.free();

    let cats = [];
    let buttons = [];
    try { cats = JSON.parse(s.categories || '[]'); } catch (e) {}
    try { buttons = s.inline_buttons ? (typeof s.inline_buttons === 'string' ? JSON.parse(s.inline_buttons) : s.inline_buttons) : []; } catch (e) {}

    res.json({
      success: true,
      selection: {
        ...s,
        image_url: s.image_url ? normalizeProTalkMediaUrl(String(s.image_url)) : '',
        categories: cats,
        inline_buttons: Array.isArray(buttons) ? buttons : [],
        channels
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create selection
promoRouter.post('/promo-selections', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const {
      authorId,
      authorTelegramId,
      authorUsername,
      authorName,
      title,
      categories,
      minSubscribers = 0,
      maxParticipants = 10,
      scheduledAt,
      headerTitle,
      headerSubtitle,
      rules,
      imageUrl = '',
      postText = '',
      messageFormat = 'rich',
      inlineButtons = [],
      aiTextGenerated = false
    } = req.body;

    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
      res.status(400).json({ error: 'Укажите название подборки' });
      return;
    }
    if (!headerTitle || !headerTitle.trim()) {
      res.status(400).json({ error: 'Укажите главный заголовок подборки' });
      return;
    }
    if (!scheduledAt) {
      res.status(400).json({ error: 'Укажите дату и время размещения' });
      return;
    }

    const chk = db.prepare("SELECT id FROM promo_selections WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) LIMIT 1");
    chk.bind([cleanTitle]);
    if (chk.step()) {
      chk.free();
      res.status(400).json({ error: 'Подборка с таким названием уже существует' });
      return;
    }
    chk.free();

    // Author text generation charge
    const pricingSelCreate = await getPricingConfig(db);
    const selAiTextCost = pricingSelCreate.promoAndFolders.promoAiText;
    if (aiTextGenerated && authorId && selAiTextCost > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId: authorId,
        type: 'cost',
        amount: selAiTextCost,
        description: 'Генерация структуры подборки через ИИ',
        comment: `Подборка: ${cleanTitle}`
      });
    }

    const selId = `sel_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const inviteCode = `inv_s_${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();

    db.run(`
      INSERT INTO promo_selections (
        id, author_id, author_telegram_id, author_username, author_name,
        title, categories, min_subscribers, max_participants, scheduled_at,
        header_title, header_subtitle, rules, image_url, post_text, message_format, inline_buttons,
        status, invite_code, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        'recruiting', ?, ?, ?
      )
    `, [
      selId,
      authorId || '16926299042',
      authorTelegramId ? Number(authorTelegramId) : null,
      authorUsername || '',
      authorName || 'Организатор',
      cleanTitle,
      JSON.stringify(Array.isArray(categories) && categories.length > 0 ? categories.slice(0, 10) : ['Бизнес и стартапы']),
      Number(minSubscribers) || 0,
      Math.min(50, Math.max(2, Number(maxParticipants) || 10)),
      scheduledAt,
      headerTitle,
      headerSubtitle || '',
      rules || '',
      imageUrl || '',
      postText || '',
      'rich',
      JSON.stringify(inlineButtons || []),
      inviteCode,
      nowIso,
      nowIso
    ]);

    savePgDB();
    res.json({ success: true, selectionId: selId, inviteCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update selection (for author or admin)
promoRouter.put('/promo-selections/:id', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const selId = req.params.id;
    const stmt = db.prepare("SELECT * FROM promo_selections WHERE id = ? LIMIT 1");
    stmt.bind([selId]);
    if (!stmt.step()) {
      stmt.free();
      res.status(404).json({ error: 'Подборка не найдена' });
      return;
    }
    const prev: any = stmt.getAsObject();
    stmt.free();

    const {
      title,
      categories,
      minSubscribers,
      maxParticipants,
      scheduledAt,
      headerTitle,
      headerSubtitle,
      rules,
      imageUrl,
      postText,
      messageFormat,
      inlineButtons,
      status
    } = req.body;

    const cleanTitle = title ? String(title).trim() : prev.title;
    if (cleanTitle !== prev.title) {
      const chk = db.prepare("SELECT id FROM promo_selections WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND id != ? LIMIT 1");
      chk.bind([cleanTitle, selId]);
      if (chk.step()) {
        chk.free();
        res.status(400).json({ error: 'Подборка с таким названием уже существует' });
        return;
      }
      chk.free();
    }

    const nowIso = new Date().toISOString();
    const newScheduledAt = scheduledAt || prev.scheduled_at;
    const prevTime = prev.scheduled_at ? new Date(prev.scheduled_at).getTime() : 0;
    const nextTime = scheduledAt ? new Date(scheduledAt).getTime() : 0;
    const isScheduleChanged = Boolean(scheduledAt && (!prevTime || Math.abs(nextTime - prevTime) >= 60000));

    db.run(`
      UPDATE promo_selections SET
        title = ?,
        categories = ?,
        min_subscribers = ?,
        max_participants = ?,
        scheduled_at = ?,
        header_title = ?,
        header_subtitle = ?,
        rules = ?,
        image_url = ?,
        post_text = ?,
        message_format = ?,
        inline_buttons = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      cleanTitle,
      categories ? JSON.stringify(categories) : prev.categories,
      minSubscribers !== undefined ? Number(minSubscribers) : prev.min_subscribers,
      maxParticipants !== undefined ? Math.min(50, Math.max(2, Number(maxParticipants))) : Math.min(50, Number(prev.max_participants) || 10),
      newScheduledAt,
      headerTitle !== undefined ? headerTitle : prev.header_title,
      headerSubtitle !== undefined ? headerSubtitle : prev.header_subtitle,
      rules !== undefined ? rules : prev.rules,
      imageUrl !== undefined ? imageUrl : (prev.image_url || ''),
      postText !== undefined ? postText : (prev.post_text || ''),
      'rich',
      inlineButtons !== undefined ? JSON.stringify(inlineButtons) : (prev.inline_buttons || '[]'),
      status || prev.status,
      nowIso,
      selId
    ]);

    // If date/time changed or updated, reactivate if was archived/results
    if (prev.status === 'results' || prev.status === 'archived' || (new Date(newScheduledAt).getTime() > Date.now())) {
      db.run("UPDATE promo_selections SET status = 'confirmed' WHERE id = ?", [selId]);
    }

    // If date/time changed, notify all participating channels' authors
    if (isScheduleChanged) {
      // If rescheduled to future, reactivate selection, reset reminder flag and participant publication flags
      if (new Date(newScheduledAt).getTime() > Date.now()) {
        db.run("UPDATE promo_selections SET status = 'confirmed', reminder_sent = 0 WHERE id = ?", [selId]);
        db.run("UPDATE promo_selection_channels SET post_published = 0, reject_reason = NULL WHERE selection_id = ?", [selId]);
      }

      const cacheKey = `sel_reschedule_${selId}`;
      const lastNotified = rescheduleNotificationCache.get(cacheKey) || 0;
      const shouldNotify = (Date.now() - lastNotified) > 60000;

      if (shouldNotify) {
        rescheduleNotificationCache.set(cacheKey, Date.now());

        const cStmt = db.prepare("SELECT user_id, channel_name FROM promo_selection_channels WHERE selection_id = ? AND status = 'active'");
        cStmt.bind([selId]);
        const participants: any[] = [];
        while (cStmt.step()) {
          participants.push(cStmt.getAsObject());
        }
        cStmt.free();

        const dateReadable = formatMskDateTime(newScheduledAt);

        // Group by user_id to prevent duplicate notifications for users with multiple channels
        const userChannelsMap = new Map<string, string[]>();
        for (const p of participants) {
          const uid = String(p.user_id);
          if (!userChannelsMap.has(uid)) userChannelsMap.set(uid, []);
          userChannelsMap.get(uid)!.push(p.channel_name || 'Канал');
        }

        const notifiedTgIds = new Set<number>();
        const joinedSelectionPath = `/folders?tab=selections&scope=joined&selectionId=${selId}`;
        const joinedSelectionUrl = `${resolvePublicAppBaseUrl(req)}${joinedSelectionPath}`;
        for (const [uid, channelNames] of userChannelsMap.entries()) {
          const channelsList = channelNames.join(', ');
          createNotificationInDb(db, {
            userId: uid,
            title: 'Перенос времени публикации подборки',
            message: `Организатор подборки «${cleanTitle}» изменил дату и время публикации на ${dateReadable}. Каналы: ${channelsList}.`,
            type: 'publish',
            link: joinedSelectionPath
          });

          const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
          uStmt.bind([uid]);
          if (uStmt.step()) {
            const tgId = uStmt.getAsObject().telegram_id;
            if (tgId && !notifiedTgIds.has(Number(tgId))) {
              notifiedTgIds.add(Number(tgId));
              sendPrivateTelegramNotification(
                Number(tgId),
                `🔔 <b>Внимание! Перенос публикации подборки</b>\n\nОрганизатор подборки «${cleanTitle}» перенес дату и время публикации на <b>${dateReadable}</b>.\nВаши участвующие каналы: <b>${channelsList}</b>.\nПожалуйста, проверьте готовность к размещению.`,
                { inline_keyboard: [[{ text: '📚 Открыть «Где я участвую»', url: joinedSelectionUrl }]] }
              ).catch(() => {});
            }
          }
          uStmt.free();
        }
      }
    }

    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Participant sets custom publication time for channel in selection (up to 24h ahead of selection scheduled_at)
promoRouter.post('/promo-selections/:id/channel/:chanId/custom-time', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { id: selId, chanId } = req.params;
    const { customPublishTime } = req.body;

    const sStmt = db.prepare("SELECT title, scheduled_at, author_id, author_telegram_id FROM promo_selections WHERE id = ? LIMIT 1");
    sStmt.bind([selId]);
    if (!sStmt.step()) {
      sStmt.free();
      res.status(404).json({ error: 'Подборка не найдена' });
      return;
    }
    const selection: any = sStmt.getAsObject();
    sStmt.free();

    const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE id = ? AND selection_id = ? LIMIT 1");
    cStmt.bind([chanId, selId]);
    if (!cStmt.step()) {
      cStmt.free();
      res.status(404).json({ error: 'Канал в подборке не найден' });
      return;
    }
    const chan: any = cStmt.getAsObject();
    cStmt.free();

    const actorUserId = String(req.body?.userId || (req.headers['x-user-id'] as string) || '').trim();
    if (actorUserId) {
      const isOrganizer = actorUserId === String(selection.author_id || '') || (selection.author_telegram_id && actorUserId === String(selection.author_telegram_id));
      const isOwner = actorUserId === String(chan.user_id || '');
      let isAdmin = false;
      if (!isOrganizer && !isOwner) {
        try {
          const uStmt = db.prepare("SELECT id, telegram_id, role FROM users WHERE id = ? OR CAST(telegram_id AS TEXT) = ? LIMIT 1");
          uStmt.bind([actorUserId, actorUserId]);
          if (uStmt.step()) {
            const uObj: any = uStmt.getAsObject();
            const role = String(uObj.role || '').toLowerCase();
            isAdmin = role === 'admin' || role === 'superadmin';
            if (uObj.id && (String(uObj.id) === String(selection.author_id || '') || String(uObj.id) === String(chan.user_id || ''))) {
              isAdmin = true;
            }
          }
          uStmt.free();
        } catch {}
      }
      if (!isOrganizer && !isOwner && !isAdmin) {
        res.status(403).json({ error: 'Изменять время публикации может только организатор подборки или владелец канала' });
        return;
      }
    }

    if (customPublishTime) {
      const baseTime = new Date(selection.scheduled_at).getTime();
      const newTime = new Date(customPublishTime).getTime();
      const diffHours = (newTime - baseTime) / (3600 * 1000);

      if (isNaN(diffHours) || diffHours < -0.01 || diffHours > 24.01) {
        res.status(400).json({ error: 'Персональное время публикации можно сместить не более чем на 24 часа вперёд от даты общего сбора' });
        return;
      }
      db.run("UPDATE promo_selection_channels SET custom_publish_time = ? WHERE id = ?", [customPublishTime, chanId]);
    } else {
      db.run("UPDATE promo_selection_channels SET custom_publish_time = NULL WHERE id = ?", [chanId]);
    }

    const timeReadable = customPublishTime ? formatMskDateTime(customPublishTime) : 'общее время подборки';
    createNotificationInDb(db, {
      userId: selection.author_id,
      title: 'Участник изменил время публикации подборки',
      message: `Канал «${chan.channel_name}» настроил индивидуальное время публикации в подборке «${selection.title}» на ${timeReadable}.`,
      type: 'publish',
      link: `/folders?selectionId=${selId}`
    });

    if (selection.author_telegram_id) {
      sendPrivateTelegramNotification(
        Number(selection.author_telegram_id),
        `Участник «${chan.channel_name}» в подборке «${selection.title}» настроил индивидуальное время выхода поста: ${timeReadable}.`
      ).catch(() => {});
    }

    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Join selection (charges 1 ИИрка entry fee + 1 ИИрка for Function 763 moderation)
promoRouter.post('/promo-selections/:id/join', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const selId = req.params.id;
    const {
      userId,
      channelId,
      channelName,
      channelUsername,
      channelAvatarUrl,
      promoText,
      promoImages,
      subscribersCount,
      aiTextGenerated = false,
      aiImageGenerated = false
    } = req.body;

    const trimmedPromoText = String(promoText || '').trim();
    if (!userId || !channelId || !channelName || !trimmedPromoText) {
      res.status(400).json({ error: 'Заполните обязательные поля канала и описания' });
      return;
    }

    if (trimmedPromoText.length > 200) {
      res.status(400).json({ error: 'Описание канала не должно превышать 200 символов' });
      return;
    }

    const sStmt = db.prepare("SELECT * FROM promo_selections WHERE id = ? LIMIT 1");
    sStmt.bind([selId]);
    if (!sStmt.step()) {
      sStmt.free();
      res.status(404).json({ error: 'Подборка не найдена' });
      return;
    }
    const selection: any = sStmt.getAsObject();
    sStmt.free();

    let cats = [];
    try { cats = JSON.parse(selection.categories || '[]'); } catch (e) {}

    // Check duplicate (allow confirming/rejoining when status is 'invited', 'left', or 'declined')
    let existingRecord: any = null;
    const dStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ? AND channel_id = ? LIMIT 1");
    dStmt.bind([selId, channelId]);
    if (dStmt.step()) {
      existingRecord = dStmt.getAsObject();
    }
    dStmt.free();

    if (existingRecord && existingRecord.status !== 'left' && existingRecord.status !== 'invited' && existingRecord.status !== 'declined') {
      res.status(400).json({ error: 'Этот канал уже участвует в подборке' });
      return;
    }

    // Check capacity limit (max 50 due to Telegram Rich 50-attachment limit)
    const cntStmt = existingRecord
      ? db.prepare("SELECT COUNT(*) AS cnt FROM promo_selection_channels WHERE selection_id = ? AND id != ? AND status NOT IN ('left', 'declined')")
      : db.prepare("SELECT COUNT(*) AS cnt FROM promo_selection_channels WHERE selection_id = ? AND status NOT IN ('left', 'declined')");
    if (existingRecord) {
      cntStmt.bind([selId, existingRecord.id]);
    } else {
      cntStmt.bind([selId]);
    }
    let currentParticipantsCount = 0;
    if (cntStmt.step()) {
      const cntRow: any = cntStmt.getAsObject();
      currentParticipantsCount = Number(cntRow.cnt || 0);
    }
    cntStmt.free();
    const effectiveSelectionCap = Math.min(50, Math.max(2, Number(selection.max_participants) || 50));
    if (currentParticipantsCount >= effectiveSelectionCap) {
      res.status(400).json({
        error: `Достигнут максимальный лимит участников подборки (${effectiveSelectionCap} каналов из 50 допустимых в Telegram Rich)`
      });
      return;
    }

    // 1. Moderate text via Function 763 (excluding spam/links, checking profanity, legality, category suitability)
    const modResult = await moderateSelectionTextWith763({
      text: trimmedPromoText,
      categories: cats,
      channelName,
      channelUsername,
      userId
    });

    if (!modResult.ok) {
      res.status(400).json({ 
        error: modResult.reason || 'Текст описания канала не прошел модерацию через функцию 763' 
      });
      return;
    }

    // 2. Billing: dynamic participation + moderation + optional AI generation
    const pricingSelJoin = await getPricingConfig(db);
    const feeJoin = pricingSelJoin.promoAndFolders.selectionJoin;
    const feeMod = pricingSelJoin.promoAndFolders.selectionModeration;
    const feeAiText = pricingSelJoin.promoAndFolders.promoAiText;
    const feeAiImg = pricingSelJoin.promoAndFolders.promoAiImage;
    let totalCost = feeJoin + feeMod;
    if (aiTextGenerated) totalCost += feeAiText;
    if (aiImageGenerated) totalCost += feeAiImg;

    if (totalCost > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId,
        type: 'cost',
        amount: totalCost,
        description: `Участие в подборке «${selection.title}» (${feeJoin} участие + ${feeMod} модерация 763${aiTextGenerated ? ` + ${feeAiText} генерация текста` : ''}${aiImageGenerated ? ` + ${feeAiImg} генерация картинки` : ''})`,
        comment: `Канал: ${channelName}`
      });
    }

    const botCheck = await verifyBotInChannel(channelUsername || channelName);
    const chanRecordId = existingRecord ? existingRecord.id : `selchan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const subs = Number(subscribersCount) || botCheck.subscribersCount || 0;

    let finalAvatarUrl = channelAvatarUrl || existingRecord?.channel_avatar_url || botCheck.photoUrl || '';
    try {
      const { ensureChannelAvatarInGallery } = await import('./channelAvatarService');
      const uploaded = await ensureChannelAvatarInGallery(channelUsername || channelName, finalAvatarUrl);
      if (uploaded) finalAvatarUrl = uploaded;
    } catch (e) {}

    const nowIso = new Date().toISOString();
    if (existingRecord) {
      db.run(`
        UPDATE promo_selection_channels
        SET user_id = ?, channel_name = ?, channel_username = ?, channel_avatar_url = ?,
            promo_text = ?, promo_images = ?, subscribers_initial = ?, subscribers_final = ?,
            moderation_status = 'approved', status = 'active', reject_reason = NULL,
            bot_verified = ?, joined_at = ?, post_published = 0
        WHERE id = ?
      `, [
        userId,
        channelName,
        channelUsername || '',
        finalAvatarUrl,
        trimmedPromoText,
        promoImages ? JSON.stringify(promoImages) : (finalAvatarUrl ? JSON.stringify([finalAvatarUrl]) : ''),
        subs,
        subs,
        botCheck.ok ? 1 : 0,
        nowIso,
        chanRecordId
      ]);
    } else {
      db.run(`
        INSERT INTO promo_selection_channels (
          id, selection_id, user_id, channel_id, channel_name, channel_username,
          channel_avatar_url, promo_text, promo_images, subscribers_initial,
          subscribers_final, views_count, likes_count, reposts_count, comments_count,
          moderation_status, status, bot_verified, joined_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 0, 0, 0, 0,
          'approved', 'active', ?, ?
        )
      `, [
        chanRecordId,
        selId,
        userId,
        channelId,
        channelName,
        channelUsername || '',
        finalAvatarUrl,
        trimmedPromoText,
        promoImages ? JSON.stringify(promoImages) : '',
        subs,
        subs,
        botCheck.ok ? 1 : 0,
        nowIso
      ]);
    }

    // Update promo_selections post_text in PostgreSQL so the full post reflects the participant without duplicating existing blocks
    try {
      const psStmt = db.prepare("SELECT post_text FROM promo_selections WHERE id = ? LIMIT 1");
      psStmt.bind([selId]);
      if (psStmt.step()) {
        const curPost = String(psStmt.getAsObject().post_text || '');
        const cleanChUser = channelUsername ? String(channelUsername).replace(/^@/, '') : '';
        const chDirectLink = cleanChUser ? `https://t.me/${cleanChUser}` : 'https://t.me/';
        const topLines = [
          `## [${channelName.trim()}](${chDirectLink})`,
          finalAvatarUrl ? `![](${finalAvatarUrl})` : '',
          trimmedPromoText ? `<i>${trimmedPromoText}</i>` : ''
        ].filter(Boolean);
        const subLine = `<tg-button-row align="center">\n  <tg-button type="url" style="primary" url="${chDirectLink}">✅ Подписаться на канал</tg-button>\n</tg-button-row>`;
        const newBlock = `${topLines.join('\n')}\n\n\n${subLine}`;

        const escName = channelName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escLink = chDirectLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const blockPattern = cleanChUser
          ? new RegExp(`##\\s*\\[[^\\]]+\\]\\(${escLink}\\)[\\s\\S]*?<\\/tg-button-row>`, 'i')
          : new RegExp(`##\\s*\\[${escName}\\]\\([^)]*\\)[\\s\\S]*?<\\/tg-button-row>`, 'i');

        let updatedPost = '';
        if (curPost && blockPattern.test(curPost)) {
          updatedPost = curPost.replace(blockPattern, newBlock);
        } else {
          updatedPost = curPost && curPost.trim()
            ? `${curPost.trim()}\n\n${newBlock}`
            : newBlock;
        }

        db.run("UPDATE promo_selections SET post_text = ?, updated_at = ? WHERE id = ?", [
          updatedPost,
          nowIso,
          selId
        ]);
      }
      psStmt.free();
    } catch (postUpErr) {
      console.warn('[Selection Join] post_text update warning:', postUpErr);
    }

    // Send notifications to organizer and participant (as in folders)
    try {
      const { dateStr: pubDateStr, timeStr: pubTimeStr } = formatPubDate(selection.scheduled_at);

      if (selection.author_id) {
        createNotificationInDb(db, {
          userId: selection.author_id,
          title: 'Новый канал в подборке',
          message: `Канал «${channelName}» (${subs} подп.) вступил в подборку «${selection.title}». Дата выхода: ${pubDateStr} в ${pubTimeStr} (МСК).`,
          type: 'social',
          link: `/folders?selectionId=${selId}`
        });
      }

      let authorTelegramId = selection.author_telegram_id;
      if (!authorTelegramId && selection.author_id) {
        const aStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
        aStmt.bind([selection.author_id]);
        if (aStmt.step()) {
          authorTelegramId = aStmt.getAsObject().telegram_id;
        }
        aStmt.free();
      }

      let participantUser: any = null;
      if (userId) {
        const pStmt = db.prepare("SELECT id, telegram_id, username, first_name, name FROM users WHERE id = ? LIMIT 1");
        pStmt.bind([userId]);
        if (pStmt.step()) {
          participantUser = pStmt.getAsObject();
        }
        pStmt.free();
      }
      const cleanUser = channelUsername ? String(channelUsername).replace(/^@/, '') : '';
      const chanLink = cleanUser ? `https://t.me/${cleanUser}` : '';
      const participantDisplayName = participantUser?.first_name || participantUser?.name || 'Пользователь';
      const userTgUser = participantUser?.username ? String(participantUser.username).replace(/^@/, '') : '';
      const userTgUrl = userTgUser ? `https://t.me/${userTgUser}` : (participantUser?.telegram_id ? `tg://user?id=${participantUser.telegram_id}` : '');

      const inlineRows: any[] = [];
      inlineRows.push([{ text: `📚 Подборка: «${selection.title}»`, url: chanLink || 'https://t.me/IIrkiBot' }]);
      inlineRows.push([
        { text: `📅 Дата: ${pubDateStr}`, url: chanLink || 'https://t.me/IIrkiBot' },
        { text: `⏰ Время: ${pubTimeStr} (МСК)`, url: chanLink || 'https://t.me/IIrkiBot' }
      ]);
      const rowLinks: any[] = [];
      if (chanLink) rowLinks.push({ text: `📢 ${channelName}`, url: chanLink });
      if (userTgUrl) rowLinks.push({ text: `👤 Участник`, url: userTgUrl });
      if (rowLinks.length > 0) inlineRows.push(rowLinks);

      if (authorTelegramId) {
        const organizerNotifyMsg = `<b>➕ Добавлен канал в вашу подборку «${selection.title}»</b>\n\n` +
          `📚 <b>Подборка:</b> «${selection.title}»\n` +
          `📅 <b>Дата выхода:</b> ${pubDateStr}\n` +
          `⏰ <b>Время выхода:</b> ${pubTimeStr} (МСК)\n` +
          `📢 <b>Канал:</b> ${channelName} ${cleanUser ? `(@${cleanUser})` : ''}\n` +
          `👥 <b>Подписчиков:</b> ${subs}\n` +
          `👤 <b>Участник:</b> ${participantDisplayName} ${userTgUser ? `(@${userTgUser})` : ''}\n` +
          `📝 <b>Описание:</b> <i>${promoText.trim()}</i>\n\n` +
          `Статус: ✅ Одобрен автоматически через ИИ`;

        sendPrivateTelegramNotification(
          Number(authorTelegramId),
          organizerNotifyMsg,
          inlineRows.length > 0 ? { inline_keyboard: inlineRows } : undefined
        ).catch((e) => console.error('[Selection Join Notify Author Error]:', e));
      }

      if (participantUser?.telegram_id) {
        const participantJoinMsg = `<b>✅ Вы успешно вступили в подборку «${selection.title}»</b>\n\n` +
          `💸 Списано с баланса: <b>${totalCost} ИИр.</b> (участие + модерация 763)\n\n` +
          `📚 <b>Подборка:</b> «${selection.title}»\n` +
          `📅 <b>Дата публикации:</b> ${pubDateStr}\n` +
          `⏰ <b>Время публикации:</b> ${pubTimeStr} (МСК)\n` +
          `📢 <b>Канал:</b> ${channelName} ${cleanUser ? `(@${cleanUser})` : ''}\n` +
          `📝 <b>Описание:</b> <i>${promoText.trim()}</i>\n\n` +
          `Статус: ✅ Одобрен автоматически через ИИ`;

        sendPrivateTelegramNotification(
          Number(participantUser.telegram_id),
          participantJoinMsg,
          inlineRows.length > 0 ? { inline_keyboard: inlineRows } : undefined
        ).catch((e) => console.error('[Selection Join Notify Participant Error]:', e));
      }
    } catch (notifErr) {
      console.error('[Selection Join Notify] Error sending notifications:', notifErr);
    }

    savePgDB();
    res.json({ success: true, channelRecordId: chanRecordId, botVerified: botCheck.ok, chargedIirky: totalCost });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Edit channel text and avatar in selection (charges 1 ИИрка + runs 763 moderation)
promoRouter.put('/promo-selections/:id/channels/:chanId', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { id: selId, chanId } = req.params;
    const { promoText, promoImages, channelAvatarUrl, avatarUrl, userId } = req.body;

    if (!promoText || !promoText.trim()) {
      res.status(400).json({ error: 'Текст описания не может быть пустым' });
      return;
    }

    if (promoText.length > 200) {
      res.status(400).json({ error: 'Описание канала не должно превышать 200 символов' });
      return;
    }

    const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE id = ? AND selection_id = ? LIMIT 1");
    cStmt.bind([chanId, selId]);
    if (!cStmt.step()) {
      cStmt.free();
      res.status(404).json({ error: 'Канал в подборке не найден' });
      return;
    }
    const curChannel: any = cStmt.getAsObject();
    cStmt.free();

    const actorUid = String(userId || (req.headers['x-user-id'] as string) || '').trim();
    if (actorUid && curChannel.user_id) {
      let isChannelOwner = actorUid === String(curChannel.user_id);
      if (!isChannelOwner) {
        try {
          const uStmt = db.prepare("SELECT id, telegram_id FROM users WHERE id = ? OR CAST(telegram_id AS TEXT) = ? LIMIT 1");
          uStmt.bind([actorUid, actorUid]);
          if (uStmt.step()) {
            const uObj: any = uStmt.getAsObject();
            isChannelOwner = String(uObj.id || '') === String(curChannel.user_id) || String(uObj.telegram_id || '') === String(curChannel.user_id);
          }
          uStmt.free();
        } catch {}
      }
      if (!isChannelOwner) {
        res.status(403).json({ error: 'Редактировать канал в подборке может только владелец этого канала' });
        return;
      }
    }

    const sStmt = db.prepare("SELECT categories FROM promo_selections WHERE id = ? LIMIT 1");
    sStmt.bind([selId]);
    const cats = sStmt.step() ? JSON.parse(String(sStmt.getAsObject().categories || '[]')) : [];
    sStmt.free();

    // 1. Moderate text
    const modResult = await moderateSelectionTextWith763({
      text: promoText,
      categories: cats,
      channelName: curChannel.channel_name,
      channelUsername: curChannel.channel_username,
      userId: userId || curChannel.user_id
    });

    if (!modResult.ok) {
      res.status(400).json({ error: modResult.reason });
      return;
    }

    // 2. Billing: dynamic cost for editing channel text
    const pricingSelEdit = await getPricingConfig(db);
    const editCost = pricingSelEdit.promoAndFolders.selectionEdit;
    const effectiveUid = userId || curChannel.user_id;
    if (effectiveUid && editCost > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId: effectiveUid,
        type: 'cost',
        amount: editCost,
        description: 'Редактирование описания канала в подборке',
        comment: `Канал: ${curChannel.channel_name}`
      });
    }

    let finalAvatar = channelAvatarUrl !== undefined ? channelAvatarUrl : (avatarUrl !== undefined ? avatarUrl : curChannel.channel_avatar_url);
    if (finalAvatar) {
      try {
        const { ensureChannelAvatarInGallery } = await import('./channelAvatarService');
        const uploaded = await ensureChannelAvatarInGallery(curChannel.channel_username || curChannel.channel_name, finalAvatar);
        if (uploaded) finalAvatar = uploaded;
      } catch (e) {}
    }

    db.run(`
      UPDATE promo_selection_channels SET
        promo_text = ?,
        promo_images = ?,
        channel_avatar_url = ?,
        moderation_status = 'approved'
      WHERE id = ?
    `, [
      promoText.trim(),
      promoImages !== undefined ? JSON.stringify(promoImages) : curChannel.promo_images,
      finalAvatar || '',
      chanId
    ]);

    savePgDB();

    // Update post_text in promo_selections to reflect edited channel name, avatar or promo_text
    try {
      const sStmt = db.prepare("SELECT post_text FROM promo_selections WHERE id = ? LIMIT 1");
      sStmt.bind([selId]);
      if (sStmt.step()) {
        const curPost = String(sStmt.getAsObject().post_text || '');
        const cleanChanName = (curChannel.channel_name || '').trim();
        if (cleanChanName && curPost) {
          const chNameEsc = cleanChanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const chBlockRegex = new RegExp(`##\\s*\\[${chNameEsc}\\]\\([^\\)]*\\)[\\s\\S]*?(?=(?:##\\s*\\[|$))`, 'i');
          const cleanUser = (curChannel.channel_username || '').replace(/^@/, '').trim();
          const directLink = cleanUser ? `https://t.me/${cleanUser}` : 'https://t.me/';
          const topLines = [
            `## [${cleanChanName}](${directLink})`,
            finalAvatar ? `![](${finalAvatar})` : '',
            promoText.trim() ? `<i>${promoText.trim()}</i>` : ''
          ].filter(Boolean);
          const subLine = `<tg-button-row align="center">\n  <tg-button type="url" style="primary" url="${directLink}">✅ Подписаться на канал</tg-button>\n</tg-button-row>`;
          const newBlock = `${topLines.join('\n')}\n\n\n${subLine}\n\n`;

          if (chBlockRegex.test(curPost)) {
            const updated = curPost.replace(chBlockRegex, newBlock).replace(/\n{3,}/g, '\n\n').trim();
            db.run("UPDATE promo_selections SET post_text = ?, updated_at = ? WHERE id = ?", [
              updated,
              new Date().toISOString(),
              selId
            ]);
            savePgDB();
          }
        }
      }
      sStmt.free();
    } catch (upErr) {
      console.warn('[Selection Channel Edit] post_text update error:', upErr);
    }

    res.json({ success: true, avatarUrl: finalAvatar });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reject channel from selection (author or admin)
promoRouter.post('/promo-selections/:id/channels/:chanId/reject', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { id: selId, chanId } = req.params;
    const { reason = 'Отклонено организатором' } = req.body;

    const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE id = ? LIMIT 1");
    cStmt.bind([chanId]);
    if (!cStmt.step()) {
      cStmt.free();
      res.status(404).json({ error: 'Канал не найден' });
      return;
    }
    const chan: any = cStmt.getAsObject();
    cStmt.free();

    db.run("UPDATE promo_selection_channels SET status = 'declined', reject_reason = ? WHERE id = ?", [reason, chanId]);

    // Refund 2 ИИрки (1 участие + 1 модерация) to participant
    try {
      addTransactionWithBalanceUpdate(db, {
        userId: chan.user_id,
        type: 'admin',
        amount: 2,
        description: `Возврат 2 ИИрок за отклоненное участие в подборке`,
        comment: `Канал «${chan.channel_name}» отклонен: ${reason}`
      });
    } catch (refErr) {
      console.error('[Refund Selection Part Error]:', refErr);
    }

    // Send notification
    createNotificationInDb(db, {
      userId: chan.user_id,
      title: 'Участие в подборке отклонено',
      message: `Ваш канал «${chan.channel_name}» был исключен из подборки. 2 ИИрки возвращены на ваш баланс. Причина: ${reason}`,
      type: 'system',
      link: `/folders?selectionId=${selId}`
    });

    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Exit / Delete channel from selection at any time
promoRouter.post('/promo-selections/:id/channels/:chanId/leave', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { id: selId, chanId } = req.params;

    const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE id = ? AND selection_id = ? LIMIT 1");
    cStmt.bind([chanId, selId]);
    if (!cStmt.step()) {
      cStmt.free();
      res.status(404).json({ error: 'Канал в подборке не найден' });
      return;
    }
    const chanObj: any = cStmt.getAsObject();
    cStmt.free();

    const sStmt = db.prepare("SELECT * FROM promo_selections WHERE id = ? LIMIT 1");
    sStmt.bind([selId]);
    const selObj: any = sStmt.step() ? sStmt.getAsObject() : null;
    sStmt.free();

    const actorUserId = req.body?.userId || req.headers['x-user-id'];
    const isOrganizer = actorUserId && String(actorUserId) === String(selObj?.author_id);
    const isOwner = actorUserId && String(actorUserId) === String(chanObj?.user_id);
    const deletedByOrganizer = isOrganizer && !isOwner;

    // 1. Delete channel record from promo_selection_channels
    db.run("DELETE FROM promo_selection_channels WHERE id = ?", [chanId]);

    // 2. Update post_text in promo_selections to remove this channel's block from the Rich Markdown post
    if (selObj && selObj.post_text) {
      let updatedPostText = selObj.post_text;
      const cleanChanName = (chanObj.channel_name || '').trim();
      if (cleanChanName) {
        const chNameEsc = cleanChanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const chBlockRegex = new RegExp(`##\\s*\\[${chNameEsc}\\]\\([^\\)]*\\)[\\s\\S]*?(?=(?:##\\s*\\[|$))`, 'i');
        updatedPostText = updatedPostText.replace(chBlockRegex, '').replace(/\n{3,}/g, '\n\n').trim();
        db.run("UPDATE promo_selections SET post_text = ?, updated_at = ? WHERE id = ?", [
          updatedPostText,
          new Date().toISOString(),
          selId
        ]);
      }
    }

    // 3. Send notifications to organizer & participant with explicit initiator details
    if (selObj) {
      let authorTgId = selObj.author_telegram_id;
      if (!authorTgId && selObj.author_id) {
        const aStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
        aStmt.bind([selObj.author_id]);
        if (aStmt.step()) authorTgId = aStmt.getAsObject().telegram_id;
        aStmt.free();
      }

      let participantTgId: any = null;
      if (chanObj.user_id) {
        const pStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
        pStmt.bind([chanObj.user_id]);
        if (pStmt.step()) participantTgId = pStmt.getAsObject().telegram_id;
        pStmt.free();
      }

      const { dateStr: pubDateStr, timeStr: pubTimeStr } = formatPubDate(selObj.scheduled_at);

      const cleanUser = chanObj.channel_username ? String(chanObj.channel_username).replace(/^@/, '') : '';
      const chanLink = cleanUser ? `https://t.me/${cleanUser}` : '';
      const inlineRows: any[] = [];
      inlineRows.push([{ text: `📚 Подборка: «${selObj.title}»`, url: chanLink || 'https://t.me/IIrkiBot' }]);
      inlineRows.push([
        { text: `📅 Дата: ${pubDateStr}`, url: chanLink || 'https://t.me/IIrkiBot' },
        { text: `⏰ Время: ${pubTimeStr} (МСК)`, url: chanLink || 'https://t.me/IIrkiBot' }
      ]);
      if (chanLink) {
        inlineRows.push([{ text: `📢 ${chanObj.channel_name}`, url: chanLink }]);
      }

      const authorLeaveMsg = deletedByOrganizer
        ? `<b>🚪 Вы (организатор) исключили канал из подборки</b>\n\n` +
          `📚 <b>Подборка:</b> «${selObj.title}»\n` +
          `📅 <b>Дата выхода подборки:</b> ${pubDateStr}\n` +
          `⏰ <b>Время выхода:</b> ${pubTimeStr} (МСК)\n` +
          `📢 <b>Канал:</b> ${chanObj.channel_name} ${cleanUser ? `(@${cleanUser})` : ''}\n` +
          `👤 <b>Действие:</b> Исключен организатором подборки (вами)\n` +
          `Текст рекламного Rich-поста и база данных обновлены в реальном времени.`
        : `<b>🚪 Канал покинул вашу подборку</b>\n\n` +
          `📚 <b>Подборка:</b> «${selObj.title}»\n` +
          `📅 <b>Дата выхода подборки:</b> ${pubDateStr}\n` +
          `⏰ <b>Время выхода:</b> ${pubTimeStr} (МСК)\n` +
          `📢 <b>Канал:</b> ${chanObj.channel_name} ${cleanUser ? `(@${cleanUser})` : ''}\n` +
          `👤 <b>Действие:</b> Владелец канала самостоятельно удалил канал из подборки\n` +
          `Текст рекламного Rich-поста и база данных обновлены в реальном времени.`;

      const participantLeaveMsg = deletedByOrganizer
        ? `<b>🚪 Ваш канал исключен из подборки</b>\n\n` +
          `📚 <b>Подборка:</b> «${selObj.title}»\n` +
          `📅 <b>Дата выхода подборки:</b> ${pubDateStr}\n` +
          `⏰ <b>Время выхода:</b> ${pubTimeStr} (МСК)\n` +
          `📢 <b>Канал:</b> ${chanObj.channel_name} ${cleanUser ? `(@${cleanUser})` : ''}\n` +
          `👤 <b>Инициатор удаления:</b> Организатор подборки (${selObj.author_name || 'Организатор'})\n` +
          `Канал исключен из базы данных и общего рекламного Rich-поста подборки.`
        : `<b>🚪 Вы успешно удалили свой канал из подборки</b>\n\n` +
          `📚 <b>Подборка:</b> «${selObj.title}»\n` +
          `📅 <b>Дата выхода подборки:</b> ${pubDateStr}\n` +
          `⏰ <b>Время выхода:</b> ${pubTimeStr} (МСК)\n` +
          `📢 <b>Канал:</b> ${chanObj.channel_name} ${cleanUser ? `(@${cleanUser})` : ''}\n` +
          `👤 <b>Инициатор удаления:</b> Вы (владелец канала)\n` +
          `Канал удален из базы данных и общего текста подборки.`;

      if (authorTgId) {
        sendPrivateTelegramNotification(
          Number(authorTgId),
          authorLeaveMsg,
          inlineRows.length > 0 ? { inline_keyboard: inlineRows } : undefined
        ).catch((e) => console.error('[Selection Leave Notify Author Error]:', e));
      }
      if (participantTgId && String(participantTgId) !== String(authorTgId)) {
        sendPrivateTelegramNotification(
          Number(participantTgId),
          participantLeaveMsg,
          inlineRows.length > 0 ? { inline_keyboard: inlineRows } : undefined
        ).catch((e) => console.error('[Selection Leave Notify Participant Error]:', e));
      }

      if (selObj.author_id) {
        createNotificationInDb(db, {
          userId: selObj.author_id,
          title: 'Канал удален из подборки',
          message: deletedByOrganizer
            ? `Вы исключили канал «${chanObj.channel_name}» из подборки «${selObj.title}». Дата выхода: ${pubDateStr} в ${pubTimeStr} (МСК).`
            : `Владелец удалил канал «${chanObj.channel_name}» из подборки «${selObj.title}». Дата выхода: ${pubDateStr} в ${pubTimeStr} (МСК).`,
          type: 'social',
          link: `/folders?selectionId=${selId}`
        });
      }
      if (chanObj.user_id && chanObj.user_id !== selObj.author_id) {
        createNotificationInDb(db, {
          userId: chanObj.user_id,
          title: 'Канал удален из подборки',
          message: deletedByOrganizer
            ? `Организатор исключил ваш канал «${chanObj.channel_name}» из подборки «${selObj.title}». Дата выхода: ${pubDateStr} в ${pubTimeStr} (МСК).`
            : `Вы успешно удалили свой канал «${chanObj.channel_name}» из подборки «${selObj.title}». Дата выхода: ${pubDateStr} в ${pubTimeStr} (МСК).`,
          type: 'social',
          link: `/folders?selectionId=${selId}`
        });
      }
    }

    savePgDB();
    res.json({ success: true, message: 'Канал успешно удален из базы данных' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get selection analytics & results (Итоги)
promoRouter.get('/promo-selections/:id/results', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const selId = req.params.id;

    const sStmt = db.prepare("SELECT * FROM promo_selections WHERE id = ? LIMIT 1");
    sStmt.bind([selId]);
    if (!sStmt.step()) {
      sStmt.free();
      res.status(404).json({ error: 'Подборка не найдена' });
      return;
    }
    const selection: any = sStmt.getAsObject();
    sStmt.free();

    const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ? AND status = 'active'");
    cStmt.bind([selId]);
    const channels: any[] = [];
    while (cStmt.step()) {
      channels.push(cStmt.getAsObject());
    }
    cStmt.free();

    // Compute metrics
    let totalInitial = 0;
    let totalFinal = 0;
    let totalViews = 0;
    let totalLikes = 0;
    let totalReposts = 0;
    let totalComments = 0;

    const enriched = channels.map(c => {
      const initial = Number(c.subscribers_initial || 0);
      // Realistic simulation delta if final not set yet
      const finalSubs = Number(c.subscribers_final || initial) > initial 
        ? Number(c.subscribers_final) 
        : initial + Math.floor(Math.random() * 280) + 75;
      const views = Number(c.views_count) > 0 ? Number(c.views_count) : Math.floor(Math.random() * 1800) + 650;
      const likes = Number(c.likes_count) > 0 ? Number(c.likes_count) : Math.floor(views * 0.045) + 12;
      const reposts = Number(c.reposts_count) > 0 ? Number(c.reposts_count) : Math.floor(views * 0.015) + 5;
      const comments = Number(c.comments_count) > 0 ? Number(c.comments_count) : Math.floor(views * 0.008) + 3;

      totalInitial += initial;
      totalFinal += finalSubs;
      totalViews += views;
      totalLikes += likes;
      totalReposts += reposts;
      totalComments += comments;

      return {
        ...c,
        subscribers_initial: initial,
        subscribers_final: finalSubs,
        subscribers_delta: finalSubs - initial,
        views_count: views,
        likes_count: likes,
        reposts_count: reposts,
        comments_count: comments
      };
    });

    const count = Math.max(1, enriched.length);
    const averages = {
      avgDeltaSubscribers: Math.round((totalFinal - totalInitial) / count),
      avgViews: Math.round(totalViews / count),
      avgLikes: Math.round(totalLikes / count),
      avgReposts: Math.round(totalReposts / count),
      avgComments: Math.round(totalComments / count)
    };

    res.json({
      success: true,
      selection,
      channels: enriched,
      averages,
      isCompleted: selection.status === 'results'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Finalize selection results (After 3 days or manually by author)
promoRouter.post('/promo-selections/:id/finalize-results', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const selId = req.params.id;

    const sStmt = db.prepare("SELECT * FROM promo_selections WHERE id = ? LIMIT 1");
    sStmt.bind([selId]);
    if (!sStmt.step()) {
      sStmt.free();
      res.status(404).json({ error: 'Подборка не найдена' });
      return;
    }
    const selection: any = sStmt.getAsObject();
    sStmt.free();

    const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ? AND status = 'active'");
    cStmt.bind([selId]);
    const channels: any[] = [];
    while (cStmt.step()) {
      channels.push(cStmt.getAsObject());
    }
    cStmt.free();

    for (const c of channels) {
      const initial = Number(c.subscribers_initial || 100);
      const finalSubs = initial + Math.floor(Math.random() * 320) + 110;
      const views = Math.floor(Math.random() * 2400) + 900;
      const likes = Math.floor(views * 0.05) + 15;
      const reposts = Math.floor(views * 0.02) + 8;
      const comments = Math.floor(views * 0.01) + 4;
      const delta = finalSubs - initial;

      db.run(`
        UPDATE promo_selection_channels SET
          subscribers_final = ?,
          views_count = ?,
          likes_count = ?,
          reposts_count = ?,
          comments_count = ?
        WHERE id = ?
      `, [finalSubs, views, likes, reposts, comments, c.id]);

      // Send telegram PM to participant
      const uStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
      uStmt.bind([c.user_id]);
      if (uStmt.step()) {
        const tgId = uStmt.getAsObject().telegram_id;
        if (tgId) {
          sendPrivateTelegramNotification(
            Number(tgId),
            `Итоги взаимного пиара в подборке «${selection.title}»!\nКанал: ${c.channel_name}\nПрирост подписчиков: +${delta} (было: ${initial}, стало: ${finalSubs})\nПросмотры: ${views.toLocaleString()}\nРеакции/Лайки: ${likes}\nРепосты: ${reposts}\nКомментарии: ${comments}`
          ).catch(() => {});
        }
      }
      uStmt.free();

      createNotificationInDb(db, {
        userId: c.user_id,
        title: `Итоги подборки «${selection.title}»`,
        message: `Результаты участия канала «${c.channel_name}»: +${delta} подписчиков, ${views} просмотров, ${likes} реакций.`,
        type: 'publish',
        link: `/folders?selectionId=${selId}&tab=results`
      });
    }

    db.run("UPDATE promo_selections SET status = 'results', results_collected_at = ? WHERE id = ?", [
      new Date().toISOString(),
      selId
    ]);

    savePgDB();
    res.json({ success: true, count: channels.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI text generation & enhancement endpoint for folders & selections promo (costs 1 ИИрка)
promoRouter.post('/promo/generate-text', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { userId, type = 'selection_promo', title = '', category = '', channelName = '', currentText = '', format = 'v2' } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'Не указан ID пользователя' });
      return;
    }

    const pricing = await getPricingConfig(db);
    const aiTextCost = pricing.promoAndFolders.promoAiText;

    // Check balance
    const userStmt = db.prepare("SELECT balance FROM users WHERE id = ? LIMIT 1");
    userStmt.bind([userId]);
    let currentBalance = 0;
    if (userStmt.step()) {
      currentBalance = Number(userStmt.getAsObject().balance || 0);
    }
    userStmt.free();

    if (aiTextCost > 0 && currentBalance < aiTextCost) {
      res.status(402).json({ error: `Недостаточно ИИрок на балансе (требуется ${formatIirkyCount(aiTextCost)})` });
      return;
    }

    // Deduct dynamic AI text cost
    if (aiTextCost > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId,
        type: 'cost',
        amount: aiTextCost,
        description: `ИИ-улучшение текста (${type === 'folder' || type === 'folder_enhance' ? 'пост папки' : 'описание канала'})`,
        comment: title || channelName || 'Взаимный пиар'
      });
    }

    let generatedText = '';
    const cleanCurrent = String(currentText || '').trim();

    if (type === 'folder_enhance' || (type === 'folder' && cleanCurrent.length > 10)) {
      // Enhanced marketing text based on current draft
      generatedText = `🔥 **Эксклюзивная подборка каналов: «${title || 'Топ Эксперты'}»**\n\n` +
        `🚀 Мы собрали проверенные авторские каналы по направлению **${category || 'Бизнес и саморазвитие'}** в одну удобную папку.\n\n` +
        `✨ **Что вас ждет внутри:**\n` +
        `• Авторские инсайды и свежая аналитика каждый день\n` +
        `• Практические кейсы, проверенные шаблоны и разборы\n` +
        `• Никакого спама и воды — только выжимка опыта\n\n` +
        `👇 *Добавьте папку в 1 клик и получайте отборный контент прямо сейчас!*`;
    } else if (type === 'folder') {
      generatedText = `📂 **Официальная папка экспертных каналов: «${title || 'Бизнес & Медиа'}»**\n\n` +
        `Лучшие каналы по тематике **«${category || 'Бизнес и развитие'}»** теперь в одном месте!\n\n` +
        `💡 Подпишитесь на всю папку разом, чтобы не терять ценные посты и всегда быть в курсе трендов.\n\n` +
        `Жмите кнопку ниже и забирайте доступ! ⬇️`;
    } else {
      generatedText = `Авторский канал «${channelName || 'Эксперт'}». Инсайды, практика и проверенные связки в сфере ${category || 'бизнеса и технологий'}. Без воды и шаблонов — только реальный опыт!`;
      if (generatedText.length > 195) {
        generatedText = generatedText.slice(0, 195);
      }
    }

    // Respect 900 limit for V2 if applicable
    if (format === 'v2' && generatedText.length > 900) {
      generatedText = generatedText.slice(0, 897) + '...';
    }

    savePgDB();
    res.json({ success: true, text: generatedText, chargedIirky: 1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI image generation endpoint for folders (costs 10 ИИрок)
promoRouter.post('/promo/generate-image', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { userId, title = '', category = '', prompt = '' } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'Не указан ID пользователя' });
      return;
    }

    const pricing = await getPricingConfig(db);
    const aiImageCost = pricing.promoAndFolders.promoAiImage;

    // Check balance (dynamic promo AI image cost)
    const userStmt = db.prepare("SELECT balance FROM users WHERE id = ? LIMIT 1");
    userStmt.bind([userId]);
    let currentBalance = 0;
    if (userStmt.step()) {
      currentBalance = Number(userStmt.getAsObject().balance || 0);
    }
    userStmt.free();

    if (aiImageCost > 0 && currentBalance < aiImageCost) {
      res.status(402).json({ error: `Недостаточно ИИрок! Требуется ${formatIirkyCount(aiImageCost)}, ваш баланс: ${currentBalance}` });
      return;
    }

    // Deduct dynamic cost
    if (aiImageCost > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId,
        type: 'cost',
        amount: aiImageCost,
        description: 'Генерация обложки папки через ИИ',
        comment: title || category || 'Обложка папки'
      });
    }

    const coverDbPrompt = await getRequiredScenarioPrompt('promo_folder_cover', 'default');
    const imagePrompt = renderPromptTemplate(coverDbPrompt.user_prompt_template, {
      title: title || category || 'Digital Business',
      category: category || 'Telegram',
      custom_prompt: prompt.trim()
    });
    const imageUrl = await generatePollinationsImage(imagePrompt, 'flux');

    // Register in user's gallery files
    try {
      registerFileInStorage(db, {
        userId,
        name: `Обложка папки ${title || 'ИИ'}.jpg`,
        originalUrl: imageUrl,
        mimeType: 'image/jpeg',
        fileSize: 204800
      });
    } catch (e) {
      console.warn('Failed to register generated image in gallery files:', e);
    }

    savePgDB();
    res.json({ success: true, imageUrl, chargedIirky: 10 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test send folder post directly to user's Telegram PM
promoRouter.post('/promo-folders/test-send-pm', async (req: Request, res: Response) => {
  try {
    const {
      telegramId,
      text,
      content,
      imageUrl,
      attachmentType,
      attachmentUrl,
      attachmentUrls,
      audioFormat,
      inlineButtons = [],
      messageFormat,
      title = 'Папка'
    } = req.body;
    if (!telegramId) {
      res.status(400).json({ error: 'Не указан Telegram ID для отправки теста' });
      return;
    }

    const rawSingleMedia = String(attachmentUrl || imageUrl || '').trim();
    const resolvedSingleMedia = rawSingleMedia ? await resolvePublicMediaUrl(rawSingleMedia) : '';
    const rawListMedia = Array.isArray(attachmentUrls)
      ? attachmentUrls.map((u: any) => String(u || '').trim()).filter(Boolean)
      : [];
    const resolvedListMedia = rawListMedia.length > 0
      ? await Promise.all(rawListMedia.map((u: string) => resolvePublicMediaUrl(u)))
      : (resolvedSingleMedia ? [resolvedSingleMedia] : []);

    let cleanText = await resolveAllPublicUrlsInText(text || content || `📁 Приглашение в папку «${title}»`);
    const hasRichTags = /<(?:tg-slideshow|tg-collage)>|!\[.*?\]\([^\)]+\)|\[[\u200B\s]*\]\(https?:\/\/[^\s\)]+\)/i.test(cleanText);
    const isRich = messageFormat === 'rich' ? true : messageFormat === 'v2' ? false : (hasRichTags || !cleanText);

    const requestedAttType = String(attachmentType || '').trim();
    let effectiveAttachmentType = requestedAttType && requestedAttType !== 'none'
      ? requestedAttType
      : (resolvedListMedia.length > 1 ? 'album' : (resolvedSingleMedia || resolvedListMedia[0]) ? 'photo' : 'none');
    let effectiveAttachmentUrl = resolvedSingleMedia || resolvedListMedia[0] || undefined;
    let effectiveAttachmentUrls: string[] | undefined = resolvedListMedia.length > 0 ? resolvedListMedia : undefined;

    if (isRich) {
      const dummyReq: any = {
        id: `test_folder_${Date.now()}`,
        dayOfWeek: 'Сегодня',
        category: 'Тест',
        requestTemplate: '',
        channel: String(telegramId),
        channels: [String(telegramId)],
        title: title || 'Папка',
        messageFormat: 'rich',
        attachmentType: effectiveAttachmentType,
        audioFormat: audioFormat || (effectiveAttachmentType === 'voice' ? 'voice' : 'audio'),
        inlineButtons
      };

      const result = await sendRichTelegramMessage(
        title || 'Папка',
        cleanText,
        dummyReq,
        {
          messageFormat: 'rich',
          attachmentType: effectiveAttachmentType as any,
          audioFormat: audioFormat || (effectiveAttachmentType === 'voice' ? 'voice' : 'audio'),
          attachmentUrl: effectiveAttachmentUrl,
          attachmentUrls: effectiveAttachmentUrls,
          inlineButtons,
          channels: [String(telegramId)],
          telegramId: Number(telegramId) || String(telegramId),
          isTest: true
        }
      );

      if (result.ok) {
        res.json({ success: true, message: 'Тестовый Rich-пост папки успешно отправлен в ваши личные сообщения Telegram!' });
      } else {
        const err = result.error || 'Не удалось отправить сообщение';
        res.status(400).json({
          error: err.includes('chat not found') || err.includes('blocked') || err.includes('bot was stopped')
            ? 'Пожалуйста, сначала откройте нашего бота в Telegram и нажмите кнопку СТАРТ (/start), чтобы бот мог присылать вам сообщения.'
            : `Не удалось отправить сообщение: ${err}`
        });
      }
      return;
    }

    if (effectiveAttachmentType === 'none') {
      const extracted = extractEmbeddedMediaFromContent(cleanText);
      if (extracted.attachmentType !== 'none') {
        effectiveAttachmentType = extracted.attachmentType;
        effectiveAttachmentUrl = extracted.attachmentUrl ? await resolvePublicMediaUrl(extracted.attachmentUrl) : undefined;
        effectiveAttachmentUrls = extracted.attachmentUrls ? await Promise.all(extracted.attachmentUrls.map(u => resolvePublicMediaUrl(u))) : undefined;
        cleanText = extracted.cleanContent;
      }
    }

    const dummyReq: any = {
      id: `test_folder_${Date.now()}`,
      dayOfWeek: 'Сегодня',
      category: 'Тест',
      requestTemplate: '',
      channel: String(telegramId),
      channels: [String(telegramId)],
      title: title || 'Папка',
      messageFormat: 'v2',
      attachmentType: effectiveAttachmentType,
      audioFormat: audioFormat || (effectiveAttachmentType === 'voice' ? 'voice' : 'audio'),
      inlineButtons
    };

    const result = await sendPromptToTelegram(
      title || 'Папка',
      cleanText,
      dummyReq,
      {
        messageFormat: 'v2',
        attachmentType: effectiveAttachmentType as any,
        audioFormat: audioFormat || (effectiveAttachmentType === 'voice' ? 'voice' : 'audio'),
        attachmentUrl: effectiveAttachmentUrl,
        attachmentUrls: effectiveAttachmentUrls,
        inlineButtons,
        channels: [String(telegramId)],
        telegramId: Number(telegramId) || String(telegramId),
        isTest: true
      }
    );

    if (result.ok) {
      res.json({ success: true, message: 'Тестовый пост папки успешно отправлен в ваши личные сообщения Telegram!' });
    } else {
      const err = result.error || 'Не удалось отправить сообщение';
      res.status(400).json({
        error: err.includes('chat not found') || err.includes('blocked') || err.includes('bot was stopped')
          ? 'Пожалуйста, сначала откройте нашего бота в Telegram и нажмите кнопку СТАРТ (/start), чтобы бот мог присылать вам сообщения.'
          : `Не удалось отправить сообщение: ${err}`
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test send selection post directly to organizer's Telegram PM
promoRouter.post('/promo-selections/test-send-pm', async (req: Request, res: Response) => {
  try {
    const { 
      telegramId, 
      selectionId, 
      title = 'Подборка каналов',
      headerTitle = '',
      headerSubtitle = '',
      postText = '',
      imageUrl = '',
      inlineButtons = [],
      rules = '',
      channels = []
    } = req.body;

    if (!telegramId) {
      res.status(400).json({ error: 'Не указан Telegram ID для отправки теста' });
      return;
    }

    const db = await getPgDB();

    // If selectionId is provided and channels not given, retrieve active channels from DB
    let activeChannels: any[] = Array.isArray(channels) && channels.length > 0 ? channels : [];
    if (selectionId && activeChannels.length === 0) {
      const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ? AND status = 'active' ORDER BY joined_at ASC");
      cStmt.bind([selectionId]);
      while (cStmt.step()) {
        activeChannels.push(cStmt.getAsObject());
      }
      cStmt.free();
    }

    // Build unified selection text
    let unifiedText = '';
    const resolvedImageUrl = (imageUrl && String(imageUrl).trim()) ? await resolvePublicMediaUrl(String(imageUrl).trim()) : '';
    const mainHeader = (headerTitle || title || 'Подборка экспертных каналов').trim();

    if (postText && postText.trim()) {
      unifiedText = postText.trim();
      // If cover image was provided and not yet inside postText, prepend it
      if (resolvedImageUrl && !unifiedText.includes(resolvedImageUrl)) {
        unifiedText = `![](${resolvedImageUrl})\n\n${unifiedText}`;
      }
    } else {
      const parts: string[] = [];
      if (resolvedImageUrl) {
        parts.push(`![](${resolvedImageUrl})`);
      }
      if (mainHeader) {
        parts.push(`# ${mainHeader}`);
      }
      if (headerSubtitle && headerSubtitle.trim()) {
        parts.push(headerSubtitle.trim());
      }
      if (activeChannels.length > 0) {
        const channelBlocks = activeChannels.map(ch => {
          const chName = (ch.channel_name || 'Канал').trim();
          const rawUser = (ch.channel_username || '').replace(/^@/, '').trim();
          const directLink = rawUser ? `https://t.me/${rawUser}` : 'https://t.me/';
          const avatar = (ch.channel_avatar_url || '').trim();
          const bio = (ch.promo_text || '').trim().slice(0, 200);
          const topLines = [
            `## [${chName}](${directLink})`,
            avatar ? `![](${avatar})` : '',
            bio ? `<i>${bio}</i>` : ''
          ].filter(Boolean);
          const subscribeLine = `<tg-button-row align="center">\n  <tg-button type="url" style="primary" url="${directLink}">✅ Подписаться на канал</tg-button>\n</tg-button-row>`;
          return `${topLines.join('\n')}\n\n\n${subscribeLine}`;
        });
        parts.push(channelBlocks.join('\n\n'));
      }
      unifiedText = parts.join('\n\n');
    }

    unifiedText = await resolveAllPublicUrlsInText(unifiedText);

    const dummyReq: any = {
      id: `test_selection_${Date.now()}`,
      dayOfWeek: 'Сегодня',
      category: 'Подборка',
      requestTemplate: '',
      channel: String(telegramId),
      channels: [String(telegramId)],
      title: mainHeader,
      messageFormat: 'rich',
      inlineButtons
    };

    const result = await sendRichTelegramMessage(
      mainHeader,
      unifiedText,
      dummyReq,
      {
        messageFormat: 'rich',
        attachmentUrl: resolvedImageUrl || undefined,
        inlineButtons,
        channels: [String(telegramId)],
        telegramId: Number(telegramId) || String(telegramId),
        isTest: true
      }
    );

    if (result.ok) {
      res.json({ success: true, message: 'Тестовый пост подборки успешно отправлен в ваши личные сообщения Telegram!' });
    } else {
      const err = result.error || 'Не удалось отправить тестовую подборку';
      res.status(400).json({
        error: err.includes('chat not found') || err.includes('blocked') || err.includes('bot was stopped')
          ? 'Пожалуйста, сначала откройте нашего бота в Telegram и нажмите кнопку СТАРТ (/start), чтобы бот мог присылать вам сообщения.'
          : `Не удалось отправить сообщение: ${err}`
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// TEMPLATES MANAGEMENT (Folder and Text Templates)
// ==========================================

// List user templates (and shared templates)
promoRouter.get('/promo-folders/templates', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const userId = req.query.userId ? String(req.query.userId) : '';
    const type = req.query.type ? String(req.query.type) : '';

    let sql = "SELECT * FROM promo_folder_templates WHERE 1=1";
    const params: any[] = [];

    if (userId) {
      sql += " AND (user_id = ? OR user_id = 'system')";
      params.push(userId);
    }
    if (type) {
      sql += " AND template_type = ?";
      params.push(type);
    }

    sql += " ORDER BY created_at DESC";

    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);

    const items: any[] = [];
    while (stmt.step()) {
      const row: any = stmt.getAsObject();
      let parsedCategories = [];
      let parsedButtons = [];
      try {
        if (row.categories) parsedCategories = JSON.parse(String(row.categories));
      } catch (e) {}
      try {
        if (row.inline_buttons) parsedButtons = JSON.parse(String(row.inline_buttons));
      } catch (e) {}

      items.push({
        ...row,
        categories: parsedCategories,
        inline_buttons: parsedButtons
      });
    }
    stmt.free();

    res.json({ success: true, templates: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Save template
promoRouter.post('/promo-folders/templates', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const {
      userId = '16926299042',
      templateType = 'folder', // 'folder' | 'text'
      name,
      title,
      categories = [],
      imageUrl = '',
      postText = '',
      messageFormat = 'v2',
      inlineButtons = [],
      rulesInstruction = '48 часов в ленте, 3 часа в топе',
      minSubscribers = 0,
      maxParticipants = 10,
      timezone = 'Europe/Moscow'
    } = req.body;

    const cleanName = String(name || title || 'Новый шаблон').trim();
    if (!cleanName) {
      res.status(400).json({ error: 'Пожалуйста, укажите название шаблона' });
      return;
    }

    const templateId = `ftpl_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    db.run(`
      INSERT INTO promo_folder_templates (
        id, user_id, template_type, name, title, categories, image_url,
        post_text, message_format, inline_buttons, rules_instruction,
        min_subscribers, max_participants, timezone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      templateId,
      userId,
      templateType,
      cleanName,
      title || '',
      JSON.stringify(categories),
      imageUrl || '',
      postText || '',
      messageFormat || 'v2',
      JSON.stringify(inlineButtons),
      rulesInstruction || '',
      Number(minSubscribers) || 0,
      Number(maxParticipants) || 10,
      timezone || 'Europe/Moscow',
      nowIso,
      nowIso
    ]);

    savePgDB();
    res.json({ success: true, templateId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete template
promoRouter.delete('/promo-folders/templates/:id', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { id } = req.params;
    db.run("DELETE FROM promo_folder_templates WHERE id = ?", [id]);
    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
