import { Router, Request, Response } from 'express';
import { getPgDB, savePgDB } from './db/postgres';
import { createNotificationInDb } from './db/notificationsTable';
import { sendPrivateTelegramNotification } from './telegram';
import { DB } from './db';

export const promoArchiveRouter = Router();

// Resolve public HTTPS base URL for Telegram inline button links (Telegram rejects localhost/127.0.0.1 URLs)
export function resolvePublicAppBaseUrl(req?: any): string {
  const envUrl = String(process.env.APP_URL || process.env.PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  const originHost = String(req?.headers?.origin || req?.headers?.host || '').trim();
  if (originHost) {
    const normalized = originHost.startsWith('http') ? originHost : `https://${originHost}`;
    if (!/localhost|127\.0\.0\.1/i.test(normalized)) {
      return normalized.replace(/\/+$/, '');
    }
  }
  if (envUrl && !/localhost|127\.0\.0\.1/i.test(envUrl)) {
    return envUrl;
  }
  return 'https://iismm.ru';
}

// Helper to format date/time
function formatPubDate(isoStr?: string | null): { dateStr: string; timeStr: string } {
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

export function notifyPromoDeletionByOrganizer(
  db: any,
  type: 'folder' | 'selection',
  item: any,
  participants: any[],
  baseUrl: string = resolvePublicAppBaseUrl()
): number {
  if (!db || !item || !Array.isArray(participants) || participants.length === 0) return 0;

  const cleanTitle = String(item.title || item.header_title || (type === 'folder' ? 'Папка' : 'Подборка')).trim();
  const authorName = String(item.author_name || 'Организатор').trim();
  const { dateStr, timeStr } = formatPubDate(item.scheduled_at);
  const dateReadable = item.scheduled_at ? `${dateStr} в ${timeStr} (МСК)` : 'не указано';
  const joinedPath = `/folders?tab=${type === 'folder' ? 'folders' : 'selections'}&scope=joined`;
  const joinedFullUrl = `${baseUrl}${joinedPath}`;
  const btnText = type === 'folder' ? '📁 Открыть «Где я участвую»' : '📚 Открыть «Где я участвую»';
  const entityGenitive = type === 'folder' ? 'папки' : 'подборки';
  const entityAccusative = type === 'folder' ? 'папку' : 'подборку';
  const entityTitleCap = type === 'folder' ? 'Папка' : 'Подборка';
  const entityEmoji = type === 'folder' ? '📁' : '📚';

  // Group participants by user_id to prevent duplicate messages to the same user
  const userChannelsMap = new Map<string, string[]>();
  for (const p of participants) {
    const uid = String(p.user_id || '').trim();
    if (!uid) continue;
    if (!userChannelsMap.has(uid)) userChannelsMap.set(uid, []);
    const chLabel = String(p.channel_name || p.channel_username || 'Канал').trim();
    if (!userChannelsMap.get(uid)!.includes(chLabel)) {
      userChannelsMap.get(uid)!.push(chLabel);
    }
  }

  const notifiedTgIds = new Set<number>();
  let notifiedUsersCount = 0;

  for (const [uid, channelNames] of userChannelsMap.entries()) {
    const channelsList = channelNames.join(', ');
    notifiedUsersCount++;

    createNotificationInDb(db, {
      userId: uid,
      title: `${entityTitleCap} удалена организатором`,
      message: `Организатор удалил ${entityAccusative} «${cleanTitle}» (выход планировался ${dateReadable}). Ваши каналы: ${channelsList}.`,
      type: 'publish',
      link: joinedPath
    });

    try {
      const uStmt = db.prepare('SELECT telegram_id FROM users WHERE id = ? LIMIT 1');
      uStmt.bind([uid]);
      if (uStmt.step()) {
        const tgId = uStmt.getAsObject().telegram_id;
        if (tgId && !notifiedTgIds.has(Number(tgId))) {
          notifiedTgIds.add(Number(tgId));
          const msg =
            `🗑 <b>${entityTitleCap} удалена организатором</b>\n\n` +
            `${entityEmoji} <b>${entityTitleCap}:</b> «${cleanTitle}»\n` +
            `👤 <b>Организатор:</b> ${authorName}\n` +
            `📅 <b>Планируемый выход был:</b> ${dateReadable}\n` +
            `📢 <b>Ваши каналы:</b> ${channelsList}\n\n` +
            `Размещение ${entityGenitive} отменено, публикация выполняться не будет.`;

          sendPrivateTelegramNotification(Number(tgId), msg, {
            inline_keyboard: [[{ text: btnText, url: joinedFullUrl }]]
          }).catch((e) => console.error(`[Delete Promo] Telegram notify error for user ${uid}:`, e));
        }
      }
      uStmt.free();
    } catch (e) {
      console.warn('[Delete Promo] User lookup warning:', e);
    }
  }

  return notifiedUsersCount;
}

function canActorManagePromo(db: any, actorUserId: string, item: any): boolean {
  const actor = String(actorUserId || '').trim();
  if (!actor) return true;
  const authorId = String(item.author_id || '').trim();
  const authorTgId = String(item.author_telegram_id || '').trim();
  if (actor === authorId || (authorTgId && actor === authorTgId)) return true;
  if (['16926299042', '169262990', '1', 'admin'].includes(actor)) return true;
  try {
    const uStmt = db.prepare('SELECT id, telegram_id, role FROM users WHERE id = ? OR CAST(telegram_id AS TEXT) = ? LIMIT 1');
    uStmt.bind([actor, actor]);
    if (uStmt.step()) {
      const uObj: any = uStmt.getAsObject();
      uStmt.free();
      const role = String(uObj.role || '').toLowerCase();
      if (role === 'admin' || role === 'superadmin') return true;
      if (uObj.telegram_id && authorTgId && String(uObj.telegram_id) === authorTgId) return true;
      if (uObj.id && authorId && String(uObj.id) === authorId) return true;
    } else {
      uStmt.free();
    }
  } catch {}
  return !authorId;
}

// 1. Manually archive Folder
promoArchiveRouter.post('/promo-folders/:id/archive', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const folderId = req.params.id;
    const nowIso = new Date().toISOString();

    db.run("UPDATE promo_folders SET status = 'archived', updated_at = ? WHERE id = ?", [nowIso, folderId]);
    savePgDB();
    res.json({ success: true, message: 'Папка перемещена в архив' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Manually archive Selection
promoArchiveRouter.post('/promo-selections/:id/archive', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const selId = req.params.id;
    const nowIso = new Date().toISOString();

    db.run("UPDATE promo_selections SET status = 'archived', results_collected_at = COALESCE(results_collected_at, ?), updated_at = ? WHERE id = ?", [nowIso, nowIso, selId]);
    savePgDB();
    res.json({ success: true, message: 'Подборка перемещена в архив' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Reanimate Folder
promoArchiveRouter.post('/promo-folders/:id/reanimate', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const folderId = req.params.id;
    const actorUserId = req.body?.userId || (req.headers['x-user-id'] as string) || '';

    const stmt = db.prepare("SELECT * FROM promo_folders WHERE id = ? LIMIT 1");
    stmt.bind([folderId]);
    if (!stmt.step()) {
      stmt.free();
      return res.status(404).json({ error: 'Папка не найдена' });
    }
    const folder: any = stmt.getAsObject();
    stmt.free();

    // Verification: actor must be organizer or authorized
    if (actorUserId && folder.author_id && String(actorUserId) !== String(folder.author_id)) {
      return res.status(403).json({ error: 'Только организатор может реанимировать эту папку' });
    }

    const {
      title,
      scheduledAt,
      repeatPostEnabled,
      repeatScheduledAt,
      postText,
      imageUrl,
      telegramFolderLink,
      categories,
      minSubscribers,
      maxParticipants,
      rulesInstruction
    } = req.body;

    const newScheduledAt = scheduledAt || folder.scheduled_at;
    const newTitle = (title && String(title).trim()) || folder.title;
    const nowIso = new Date().toISOString();

    // 3a. Update folder details and reset status to 'recruiting'
    db.run(`
      UPDATE promo_folders SET 
        title = ?,
        scheduled_at = ?,
        repeat_post_enabled = ?,
        repeat_scheduled_at = ?,
        post_text = COALESCE(?, post_text),
        image_url = COALESCE(?, image_url),
        telegram_folder_link = COALESCE(?, telegram_folder_link),
        categories = COALESCE(?, categories),
        min_subscribers = COALESCE(?, min_subscribers),
        max_participants = COALESCE(?, max_participants),
        rules_instruction = COALESCE(?, rules_instruction),
        status = 'recruiting',
        reminder_sent = 0,
        updated_at = ?
      WHERE id = ?
    `, [
      newTitle,
      newScheduledAt,
      repeatPostEnabled ? 1 : 0,
      repeatScheduledAt || null,
      postText !== undefined ? postText : null,
      imageUrl !== undefined ? imageUrl : null,
      telegramFolderLink !== undefined ? telegramFolderLink : null,
      categories ? (typeof categories === 'string' ? categories : JSON.stringify(categories)) : null,
      minSubscribers !== undefined ? Number(minSubscribers) : null,
      maxParticipants !== undefined ? Number(maxParticipants) : null,
      rulesInstruction !== undefined ? rulesInstruction : null,
      nowIso,
      folderId
    ]);

    // 3b. Fetch all previous participants and set their status to 'invited'
    const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ?");
    pStmt.bind([folderId]);
    const participants: any[] = [];
    while (pStmt.step()) {
      participants.push(pStmt.getAsObject());
    }
    pStmt.free();

    // Reset participant publication states and mark as 'invited'
    db.run(`
      UPDATE promo_folder_participants 
      SET status = 'invited', post_published = 0, repeat_post_published = 0
      WHERE folder_id = ?
    `, [folderId]);

    // 3c. Send PM invitations to participants
    const { dateStr, timeStr } = formatPubDate(newScheduledAt);
    const originHost = req.headers.origin || req.headers.host || 'https://iismm.ru';
    const baseUrl = originHost.startsWith('http') ? originHost : `https://${originHost}`;

    for (const p of participants) {
      // Find participant user telegram ID
      let partTgId: any = null;
      let partDisplayName = p.channel_name || 'Участник';
      if (p.user_id) {
        try {
          const uStmt = db.prepare("SELECT telegram_id, first_name, last_name, username FROM users WHERE id = ? LIMIT 1");
          uStmt.bind([p.user_id]);
          if (uStmt.step()) {
            const uObj: any = uStmt.getAsObject();
            partTgId = uObj.telegram_id;
            const fullUName = [uObj.first_name, uObj.last_name].filter(Boolean).join(' ').trim();
            partDisplayName = fullUName || uObj.username || partDisplayName;
          }
          uStmt.free();
        } catch (uErr) {
          console.warn('[Reanimate Folder] User lookup warning:', uErr);
        }
      }

      const inviteConfirmUrl = `${baseUrl}/folders?confirmFolderId=${folderId}&pId=${p.id}`;

      // Telegram notification
      if (partTgId) {
        const inviteMsg = `🔄 <b>Папка «${newTitle}» реанимирована организатором!</b>\n\n` +
          `Организатор (${folder.author_name || 'Организатор'}) запустил новый сбор для совместной папки.\n\n` +
          `📁 <b>Папка:</b> «${newTitle}»\n` +
          `📅 <b>Новая дата публикации:</b> ${dateStr}\n` +
          `⏰ <b>Время публикации:</b> ${timeStr} (МСК)\n` +
          `📢 <b>Ваш канал:</b> ${p.channel_name}\n\n` +
          `Статус: ⏳ <b>Приглашен (ожидает подтверждения)</b>\n\n` +
          `Нажмите кнопку ниже, чтобы подтвердить повторное участие вашего канала:`;

        const inlineRows = [
          [{ text: '➕ Подтвердить участие в папке', url: inviteConfirmUrl }],
          [{ text: '📁 Открыть папки на платформе', url: `${baseUrl}/folders` }]
        ];

        sendPrivateTelegramNotification(Number(partTgId), inviteMsg, { inline_keyboard: inlineRows })
          .catch(e => console.error(`[Reanimate Folder] Telegram notify error for ${p.id}:`, e));
      }

      // In-app notification
      if (p.user_id) {
        createNotificationInDb(db, {
          userId: p.user_id,
          title: 'Приглашение в реанимированную папку',
          message: `Папка «${newTitle}» реанимирована. Новая дата публикации: ${dateStr} в ${timeStr} (МСК). Подтвердите участие для канала «${p.channel_name}».`,
          type: 'social',
          link: `/folders?confirmFolderId=${folderId}&pId=${p.id}`
        });
      }
    }

    savePgDB();
    res.json({ 
      success: true, 
      message: `Папка успешно реанимирована. Приглашения разосланы ${participants.length} участникам.`,
      invitedCount: participants.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Reanimate Selection
promoArchiveRouter.post('/promo-selections/:id/reanimate', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const selId = req.params.id;
    const actorUserId = req.body?.userId || (req.headers['x-user-id'] as string) || '';

    const stmt = db.prepare("SELECT * FROM promo_selections WHERE id = ? LIMIT 1");
    stmt.bind([selId]);
    if (!stmt.step()) {
      stmt.free();
      return res.status(404).json({ error: 'Подборка не найдена' });
    }
    const selection: any = stmt.getAsObject();
    stmt.free();

    if (actorUserId && selection.author_id && String(actorUserId) !== String(selection.author_id)) {
      return res.status(403).json({ error: 'Только организатор может реанимировать эту подборку' });
    }

    const {
      title,
      headerTitle,
      headerSubtitle,
      categories,
      scheduledAt,
      imageUrl,
      postText,
      messageFormat,
      inlineButtons,
      maxParticipants,
      minSubscribers,
      rules
    } = req.body;

    const newScheduledAt = scheduledAt || selection.scheduled_at;
    const newTitle = (title && String(title).trim()) || selection.title;
    const nowIso = new Date().toISOString();

    // 4a. Update selection and reset status to 'recruiting'
    db.run(`
      UPDATE promo_selections SET
        title = ?,
        header_title = COALESCE(?, header_title),
        header_subtitle = COALESCE(?, header_subtitle),
        categories = COALESCE(?, categories),
        scheduled_at = ?,
        image_url = COALESCE(?, image_url),
        post_text = COALESCE(?, post_text),
        message_format = COALESCE(?, message_format),
        inline_buttons = COALESCE(?, inline_buttons),
        max_participants = COALESCE(?, max_participants),
        min_subscribers = COALESCE(?, min_subscribers),
        rules = COALESCE(?, rules),
        status = 'recruiting',
        results_collected_at = NULL,
        updated_at = ?
      WHERE id = ?
    `, [
      newTitle,
      headerTitle || null,
      headerSubtitle || null,
      categories ? (typeof categories === 'string' ? categories : JSON.stringify(categories)) : null,
      newScheduledAt,
      imageUrl !== undefined ? imageUrl : null,
      postText !== undefined ? postText : null,
      messageFormat || null,
      inlineButtons ? (typeof inlineButtons === 'string' ? inlineButtons : JSON.stringify(inlineButtons)) : null,
      maxParticipants !== undefined ? Math.min(50, Math.max(2, Number(maxParticipants))) : null,
      minSubscribers !== undefined ? Number(minSubscribers) : null,
      rules !== undefined ? rules : null,
      nowIso,
      selId
    ]);

    // 4b. Fetch existing participating channels and mark as 'invited'
    const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ?");
    cStmt.bind([selId]);
    const channels: any[] = [];
    while (cStmt.step()) {
      channels.push(cStmt.getAsObject());
    }
    cStmt.free();

    db.run(`
      UPDATE promo_selection_channels
      SET status = 'invited', post_published = 0
      WHERE selection_id = ?
    `, [selId]);

    // 4c. Send PM invitations to participants
    const { dateStr, timeStr } = formatPubDate(newScheduledAt);
    const originHost = req.headers.origin || req.headers.host || 'https://iismm.ru';
    const baseUrl = originHost.startsWith('http') ? originHost : `https://${originHost}`;

    for (const ch of channels) {
      let partTgId: any = null;
      let partDisplayName = ch.channel_name || 'Участник';
      if (ch.user_id) {
        try {
          const uStmt = db.prepare("SELECT telegram_id, first_name, last_name, username FROM users WHERE id = ? LIMIT 1");
          uStmt.bind([ch.user_id]);
          if (uStmt.step()) {
            const uObj: any = uStmt.getAsObject();
            partTgId = uObj.telegram_id;
            const fullUName = [uObj.first_name, uObj.last_name].filter(Boolean).join(' ').trim();
            partDisplayName = fullUName || uObj.username || partDisplayName;
          }
          uStmt.free();
        } catch (uErr) {
          console.warn('[Reanimate Selection] User lookup warning:', uErr);
        }
      }

      const inviteConfirmUrl = `${baseUrl}/folders?confirmSelectionId=${selId}&chanId=${ch.id}`;

      if (partTgId) {
        const inviteMsg = `🔄 <b>Подборка «${newTitle}» реанимирована организатором!</b>\n\n` +
          `Организатор (${selection.author_name || 'Организатор'}) запустил новый раунд для подборки каналов.\n\n` +
          `📚 <b>Подборка:</b> «${newTitle}»\n` +
          `📅 <b>Новая дата публикации:</b> ${dateStr}\n` +
          `⏰ <b>Время публикации:</b> ${timeStr} (МСК)\n` +
          `📢 <b>Ваш канал:</b> ${ch.channel_name}\n\n` +
          `Статус: ⏳ <b>Приглашен (ожидает подтверждения)</b>\n\n` +
          `Нажмите кнопку ниже, чтобы подтвердить повторное участие вашего канала:`;

        const inlineRows = [
          [{ text: '➕ Подтвердить участие в подборке', url: inviteConfirmUrl }],
          [{ text: '📚 Открыть подборку на платформе', url: `${baseUrl}/folders?selectionId=${selId}` }]
        ];

        sendPrivateTelegramNotification(Number(partTgId), inviteMsg, { inline_keyboard: inlineRows })
          .catch(e => console.error(`[Reanimate Selection] Telegram notify error for ${ch.id}:`, e));
      }

      if (ch.user_id) {
        createNotificationInDb(db, {
          userId: ch.user_id,
          title: 'Приглашение в реанимированную подборку',
          message: `Подборка «${newTitle}» реанимирована. Новая дата публикации: ${dateStr} в ${timeStr} (МСК). Подтвердите участие для канала «${ch.channel_name}».`,
          type: 'social',
          link: `/folders?confirmSelectionId=${selId}&chanId=${ch.id}`
        });
      }
    }

    savePgDB();
    res.json({
      success: true,
      message: `Подборка успешно реанимирована. Приглашения высланы ${channels.length} каналам.`,
      invitedCount: channels.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Confirm Invitation in Folder
promoArchiveRouter.post('/promo-folders/:id/confirm-invitation', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const folderId = req.params.id;
    const actorUserId = req.body?.userId || (req.headers['x-user-id'] as string) || '';
    const { participantId, channelId } = req.body;

    const fStmt = db.prepare("SELECT * FROM promo_folders WHERE id = ? LIMIT 1");
    fStmt.bind([folderId]);
    if (!fStmt.step()) {
      fStmt.free();
      return res.status(404).json({ error: 'Папка не найдена' });
    }
    const folder: any = fStmt.getAsObject();
    fStmt.free();

    // Find the participant record
    let pRecord: any = null;
    if (participantId) {
      const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE id = ? AND folder_id = ? LIMIT 1");
      pStmt.bind([participantId, folderId]);
      if (pStmt.step()) pRecord = pStmt.getAsObject();
      pStmt.free();
    } else if (actorUserId && channelId) {
      const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE user_id = ? AND channel_id = ? AND folder_id = ? LIMIT 1");
      pStmt.bind([actorUserId, channelId, folderId]);
      if (pStmt.step()) pRecord = pStmt.getAsObject();
      pStmt.free();
    } else if (actorUserId) {
      const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE user_id = ? AND folder_id = ? LIMIT 1");
      pStmt.bind([actorUserId, folderId]);
      if (pStmt.step()) pRecord = pStmt.getAsObject();
      pStmt.free();
    }

    if (!pRecord) {
      return res.status(404).json({ error: 'Запись участника не найдена в этой папке' });
    }

    // Update status to 'accepted'
    db.run("UPDATE promo_folder_participants SET status = 'accepted', joined_at = ? WHERE id = ?", [
      new Date().toISOString(),
      pRecord.id
    ]);

    // Notify organizer
    const { dateStr, timeStr } = formatPubDate(folder.scheduled_at);
    let authorTgId = folder.author_telegram_id;
    if (!authorTgId && folder.author_id) {
      const aStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
      aStmt.bind([folder.author_id]);
      if (aStmt.step()) authorTgId = aStmt.getAsObject().telegram_id;
      aStmt.free();
    }

    if (authorTgId) {
      const cleanUser = pRecord.channel_username ? String(pRecord.channel_username).replace(/^@/, '') : '';
      const orgMsg = `➕ <b>Участник подтвердил участие в реанимированной папке!</b>\n\n` +
        `📁 <b>Папка:</b> «${folder.title}»\n` +
        `📅 <b>Дата публикации:</b> ${dateStr}\n` +
        `⏰ <b>Время публикации:</b> ${timeStr} (МСК)\n` +
        `📢 <b>Канал:</b> ${pRecord.channel_name} ${cleanUser ? `(@${cleanUser})` : ''}\n` +
        `Статус: ✅ <b>Активен (подтвержден)</b>`;

      sendPrivateTelegramNotification(Number(authorTgId), orgMsg).catch(() => null);
    }

    if (folder.author_id) {
      createNotificationInDb(db, {
        userId: folder.author_id,
        title: 'Участник подтвердил участие в папке',
        message: `Канал «${pRecord.channel_name}» подтвердил участие в реанимированной папке «${folder.title}». Дата выхода: ${dateStr} в ${timeStr} (МСК).`,
        type: 'social',
        link: `/folders?folderId=${folderId}`
      });
    }

    savePgDB();
    res.json({ success: true, message: 'Участие успешно подтверждено! Канал активен в папке.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Confirm Invitation in Selection
promoArchiveRouter.post('/promo-selections/:id/confirm-invitation', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const selId = req.params.id;
    const actorUserId = req.body?.userId || (req.headers['x-user-id'] as string) || '';
    const { chanId, channelId } = req.body;

    const sStmt = db.prepare("SELECT * FROM promo_selections WHERE id = ? LIMIT 1");
    sStmt.bind([selId]);
    if (!sStmt.step()) {
      sStmt.free();
      return res.status(404).json({ error: 'Подборка не найдена' });
    }
    const selection: any = sStmt.getAsObject();
    sStmt.free();

    let chanRecord: any = null;
    if (chanId) {
      const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE id = ? AND selection_id = ? LIMIT 1");
      cStmt.bind([chanId, selId]);
      if (cStmt.step()) chanRecord = cStmt.getAsObject();
      cStmt.free();
    } else if (actorUserId && channelId) {
      const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE user_id = ? AND channel_id = ? AND selection_id = ? LIMIT 1");
      cStmt.bind([actorUserId, channelId, selId]);
      if (cStmt.step()) chanRecord = cStmt.getAsObject();
      cStmt.free();
    } else if (actorUserId) {
      const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE user_id = ? AND selection_id = ? LIMIT 1");
      cStmt.bind([actorUserId, selId]);
      if (cStmt.step()) chanRecord = cStmt.getAsObject();
      cStmt.free();
    }

    if (!chanRecord) {
      return res.status(404).json({ error: 'Канал участника не найден в этой подборке' });
    }

    // Update status to 'active'
    db.run("UPDATE promo_selection_channels SET status = 'active', joined_at = ? WHERE id = ?", [
      new Date().toISOString(),
      chanRecord.id
    ]);

    // Update selection post_text to include this confirmed channel
    try {
      const curPost = selection.post_text || '';
      const cleanUser = chanRecord.channel_username ? String(chanRecord.channel_username).replace(/^@/, '') : '';
      const chDirectLink = cleanUser ? `https://t.me/${cleanUser}` : `https://t.me/IIrkiBot`;
      
      const topLines = [
        `## [${chanRecord.channel_name}](${chDirectLink})`,
        chanRecord.channel_avatar_url ? `![](${chanRecord.channel_avatar_url})` : '',
        chanRecord.promo_text && chanRecord.promo_text.trim() ? `<i>${chanRecord.promo_text.trim()}</i>` : ''
      ].filter(Boolean);
      const subLine = `<tg-button-row align="center">\n  <tg-button type="url" style="primary" url="${chDirectLink}">✅ Подписаться на канал</tg-button>\n</tg-button-row>`;
      // Extra blank line before subscribeLine
      const newBlock = `${topLines.join('\n')}\n\n\n${subLine}`;

      // Check if channel block already exists in post_text
      const chNameEsc = chanRecord.channel_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hasBlock = new RegExp(`##\\s*\\[${chNameEsc}\\]`, 'i').test(curPost);

      let updatedPost = curPost;
      if (!hasBlock) {
        updatedPost = curPost && curPost.trim()
          ? `${curPost.trim()}\n\n${newBlock}`
          : newBlock;
      }

      db.run("UPDATE promo_selections SET post_text = ?, updated_at = ? WHERE id = ?", [
        updatedPost,
        new Date().toISOString(),
        selId
      ]);
    } catch (e) {
      console.warn('[Confirm Invitation] post_text update error:', e);
    }

    // Notify organizer
    const { dateStr, timeStr } = formatPubDate(selection.scheduled_at);
    let authorTgId = selection.author_telegram_id;
    if (!authorTgId && selection.author_id) {
      const aStmt = db.prepare("SELECT telegram_id FROM users WHERE id = ? LIMIT 1");
      aStmt.bind([selection.author_id]);
      if (aStmt.step()) authorTgId = aStmt.getAsObject().telegram_id;
      aStmt.free();
    }

    if (authorTgId) {
      const cleanUser = chanRecord.channel_username ? String(chanRecord.channel_username).replace(/^@/, '') : '';
      const orgMsg = `➕ <b>Участник подтвердил участие в реанимированной подборке!</b>\n\n` +
        `📚 <b>Подборка:</b> «${selection.title}»\n` +
        `📅 <b>Дата публикации:</b> ${dateStr}\n` +
        `⏰ <b>Время публикации:</b> ${timeStr} (МСК)\n` +
        `📢 <b>Канал:</b> ${chanRecord.channel_name} ${cleanUser ? `(@${cleanUser})` : ''}\n` +
        `Статус: ✅ <b>Активен (подтвержден)</b>`;

      sendPrivateTelegramNotification(Number(authorTgId), orgMsg).catch(() => null);
    }

    if (selection.author_id) {
      createNotificationInDb(db, {
        userId: selection.author_id,
        title: 'Канал подтвердил участие в подборке',
        message: `Канал «${chanRecord.channel_name}» подтвердил участие в реанимированной подборке «${selection.title}». Дата выхода: ${dateStr} в ${timeStr} (МСК).`,
        type: 'social',
        link: `/folders?selectionId=${selId}`
      });
    }

    savePgDB();
    res.json({ success: true, message: 'Участие успешно подтверждено! Канал активен в подборке.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get pending invitations for user
promoArchiveRouter.get('/promo-invitations', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
    if (!userId) {
      return res.json({ folders: [], selections: [] });
    }

    // Pending folder invitations
    const fStmt = db.prepare(`
      SELECT f.id as folder_id, f.title, f.scheduled_at, f.author_name, p.id as participant_id, p.channel_name, p.channel_id
      FROM promo_folder_participants p
      JOIN promo_folders f ON p.folder_id = f.id
      WHERE p.user_id = ? AND p.status = 'invited'
    `);
    fStmt.bind([userId]);
    const folders: any[] = [];
    while (fStmt.step()) {
      folders.push(fStmt.getAsObject());
    }
    fStmt.free();

    // Pending selection invitations
    const sStmt = db.prepare(`
      SELECT s.id as selection_id, s.title, s.scheduled_at, s.author_name, c.id as chan_id, c.channel_name, c.channel_id
      FROM promo_selection_channels c
      JOIN promo_selections s ON c.selection_id = s.id
      WHERE c.user_id = ? AND c.status = 'invited'
    `);
    sStmt.bind([userId]);
    const selections: any[] = [];
    while (sStmt.step()) {
      selections.push(sStmt.getAsObject());
    }
    sStmt.free();

    res.json({ folders, selections });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Delete Folder by Organizer (with participant notifications)
promoArchiveRouter.delete('/promo-folders/:id', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const folderId = req.params.id;
    const actorUserId = String(req.body?.userId || req.query?.userId || req.headers['x-user-id'] || '').trim();

    const fStmt = db.prepare('SELECT * FROM promo_folders WHERE id = ? LIMIT 1');
    fStmt.bind([folderId]);
    if (!fStmt.step()) {
      fStmt.free();
      return res.status(404).json({ error: 'Папка не найдена' });
    }
    const folder: any = fStmt.getAsObject();
    fStmt.free();

    if (actorUserId && !canActorManagePromo(db, actorUserId, folder)) {
      return res.status(403).json({ error: 'Только организатор может удалить эту папку' });
    }

    const pStmt = db.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND status IN ('accepted', 'pending', 'invited')");
    pStmt.bind([folderId]);
    const participants: any[] = [];
    while (pStmt.step()) {
      participants.push(pStmt.getAsObject());
    }
    pStmt.free();

    db.run('DELETE FROM promo_folder_participants WHERE folder_id = ?', [folderId]);
    db.run('DELETE FROM promo_folders WHERE id = ?', [folderId]);

    const baseUrl = resolvePublicAppBaseUrl(req);
    const notifiedCount = notifyPromoDeletionByOrganizer(db, 'folder', folder, participants, baseUrl);
    savePgDB();

    res.json({
      success: true,
      message: 'Папка удалена, участникам отправлено уведомление',
      notifiedCount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Delete Selection by Organizer (with participant notifications)
promoArchiveRouter.delete('/promo-selections/:id', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const selId = req.params.id;
    const actorUserId = String(req.body?.userId || req.query?.userId || req.headers['x-user-id'] || '').trim();

    const sStmt = db.prepare('SELECT * FROM promo_selections WHERE id = ? LIMIT 1');
    sStmt.bind([selId]);
    if (!sStmt.step()) {
      sStmt.free();
      return res.status(404).json({ error: 'Подборка не найдена' });
    }
    const selection: any = sStmt.getAsObject();
    sStmt.free();

    if (actorUserId && !canActorManagePromo(db, actorUserId, selection)) {
      return res.status(403).json({ error: 'Только организатор может удалить эту подборку' });
    }

    const cStmt = db.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ? AND status IN ('active', 'pending', 'invited')");
    cStmt.bind([selId]);
    const participants: any[] = [];
    while (cStmt.step()) {
      participants.push(cStmt.getAsObject());
    }
    cStmt.free();

    db.run('DELETE FROM promo_selection_channels WHERE selection_id = ?', [selId]);
    db.run('DELETE FROM promo_selections WHERE id = ?', [selId]);

    const baseUrl = resolvePublicAppBaseUrl(req);
    const notifiedCount = notifyPromoDeletionByOrganizer(db, 'selection', selection, participants, baseUrl);
    savePgDB();

    res.json({
      success: true,
      message: 'Подборка удалена, участникам отправлено уведомление',
      notifiedCount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
