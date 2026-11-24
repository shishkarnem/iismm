import { getSyncPgDB } from '../pg/cache/pgMemAdapter';
import { formatChatLastMessagePreview } from '../../utils/chat/chatPreviewFormatter';
import { normalizeUserId, savePgDB } from '../repos/coreSettingsRepo';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';
import { decryptChatTextIfNeeded, getCanonicalDmChatId } from './chatGroups';

export function getChatMessagesFromPg(chatId: string, currentUserId?: string): any[] {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !chatId) return [];
  try {
    const isGroup =
      chatId === 'group-smm' || chatId === 'group-iismm' || chatId === 'gr_iismm_chat' || chatId.startsWith('gr');
    let msgsRes: any;

    if (isGroup) {
      const canonicalGroupId = chatId === 'group-iismm' || chatId === 'gr_iismm_chat' ? 'group-smm' : chatId;
      msgsRes = dbInstance.exec(
        `SELECT id, chat_id, sender, sender_name, text, time, media_url, media_type, images_json, reply_to_json, forwarded_json, file_name, file_size, message_format, created_at, reactions_json, inline_buttons_json
         FROM chat_messages
         WHERE chat_id = ? OR (chat_id IN ('group-smm', 'group-iismm', 'gr_iismm_chat') AND ? = 'group-smm')
         ORDER BY created_at ASC, id ASC`,
        [canonicalGroupId, canonicalGroupId]
      );
    } else {
      const normViewer = currentUserId ? normalizeUserId(currentUserId) : '';
      const normPartner = normalizeUserId(chatId);
      const isSaved = chatId === 'saved_messages' || chatId === 'saved' || (normViewer && normViewer === normPartner);
      const canonicalDm = normViewer
        ? isSaved
          ? getCanonicalDmChatId(normViewer, normViewer)
          : getCanonicalDmChatId(normViewer, normPartner)
        : `dm_${normPartner}`;

      msgsRes = dbInstance.exec(
        `SELECT id, chat_id, sender, sender_name, text, time, media_url, media_type, images_json, reply_to_json, forwarded_json, file_name, file_size, message_format, created_at, reactions_json, inline_buttons_json
         FROM chat_messages
         WHERE chat_id = ?
            OR chat_id = ?
            OR chat_id = ?
            OR chat_id = ?
            OR chat_id = ?
            OR (chat_id LIKE '%dm_%' AND (chat_id LIKE '%' || ? || '%' AND chat_id LIKE '%' || ? || '%'))
            OR (? = 1 AND (chat_id = 'saved_messages' OR chat_id = 'saved' OR chat_id = ? OR chat_id LIKE 'dm_%_' || ?))
         ORDER BY created_at ASC, id ASC`,
        [
          canonicalDm,
          normPartner,
          `dm_${normPartner}`,
          `dm_${normPartner}_${normViewer}`,
          `dm_${normViewer}_${normPartner}`,
          normViewer || normPartner,
          normPartner,
          isSaved ? 1 : 0,
          normViewer || normPartner,
          normViewer || normPartner
        ]
      );
    }

    if (!msgsRes[0]?.values) return [];

    const userAvatarMap = new Map<string, string>();
    try {
      const uRes = dbInstance.exec('SELECT id, telegram_id, first_name, last_name, username, photo_url FROM users');
      if (uRes[0]?.values) {
        uRes[0].values.forEach((row: any[]) => {
          const uId = String(row[0]);
          const tgId = row[1] ? String(row[1]) : '';
          const fullName = `${row[2] || ''} ${row[3] || ''}`.trim();
          const username = row[4] ? String(row[4]).toLowerCase().replace('@', '') : '';
          let photo = String(row[5] || '');
          if (photo.startsWith('http://') && photo.includes('/file/')) {
            photo = photo.replace(/^http:\/\/[^/]+(\/file\/.*)$/, '$1');
          }
          if (photo) {
            userAvatarMap.set(uId, photo);
            if (tgId) userAvatarMap.set(tgId, photo);
            if (fullName) userAvatarMap.set(fullName.toLowerCase(), photo);
            if (username) userAvatarMap.set(username, photo);
          }
        });
      }
    } catch {}

    return msgsRes[0].values.map((m: any[]) => {
      let images: string[] | undefined = undefined;
      if (m[8]) {
        try {
          const parsed = typeof m[8] === 'string' ? JSON.parse(m[8]) : m[8];
          if (Array.isArray(parsed)) {
            images = parsed
              .map((x) => (typeof x === 'string' ? x : x?.url || ''))
              .filter((x) => typeof x === 'string' && x.length > 0);
          } else if (typeof parsed === 'string' && parsed.trim().length > 0) {
            images = [parsed.trim()];
          }
        } catch {
          if (typeof m[8] === 'string' && m[8].trim().length > 0) {
            images = [m[8].trim()];
          }
        }
      }
      let replyTo: any = undefined;
      try {
        if (m[9]) replyTo = typeof m[9] === 'string' ? JSON.parse(m[9]) : m[9];
      } catch {}
      let forwardedFrom: any = undefined;
      try {
        if (m[10]) forwardedFrom = typeof m[10] === 'string' ? JSON.parse(m[10]) : m[10];
      } catch {}

      let reactions: any[] = [];
      if (m[15]) {
        try {
          const parsed = typeof m[15] === 'string' ? JSON.parse(m[15]) : m[15];
          if (Array.isArray(parsed)) reactions = parsed;
        } catch {}
      }

      let inlineButtons: any = undefined;
      if (m[16]) {
        try {
          inlineButtons = typeof m[16] === 'string' ? JSON.parse(m[16]) : m[16];
        } catch {}
      }

      const sName = m[3] ? String(m[3]) : undefined;
      const sId = String(m[2] || '');
      const avatar =
        normalizeProTalkMediaUrl(
          userAvatarMap.get(sId) || (sName ? userAvatarMap.get(sName.toLowerCase()) : undefined)
        ) || BRAND_ASSETS.heartAvatar;

      const rawText = m[4] ? String(m[4]) : '';
      const msgChatId = String(m[1]);
      let finalText = decryptChatTextIfNeeded(rawText, msgChatId, chatId);
      if (!finalText.trim() && forwardedFrom) {
        finalText = String(forwardedFrom.text || forwardedFrom.title || '');
      }
      if ((!images || images.length === 0) && Array.isArray(forwardedFrom?.images) && forwardedFrom.images.length > 0) {
        images = forwardedFrom.images.filter((u: any) => typeof u === 'string' && u.trim().length > 0);
      }
      const resolvedMediaUrl = m[6]
        ? String(m[6])
        : forwardedFrom?.mediaUrl
          ? String(forwardedFrom.mediaUrl)
          : undefined;
      const resolvedMediaType = m[7]
        ? String(m[7])
        : forwardedFrom?.mediaType
          ? String(forwardedFrom.mediaType)
          : undefined;

      return {
        id: String(m[0]),
        chatId: msgChatId,
        sender: m[2] === 'me' ? 'me' : 'them',
        senderName: sName,
        senderAvatar: avatar,
        text: finalText,
        time: m[5] ? String(m[5]) : '',
        mediaUrl: resolvedMediaUrl,
        mediaType: resolvedMediaType,
        images,
        replyTo,
        forwardedFrom,
        fileName: m[11] ? String(m[11]) : undefined,
        fileSize: m[12] ? String(m[12]) : undefined,
        messageFormat: m[13] ? String(m[13]) : 'v2',
        createdAt: m[14] ? String(m[14]) : undefined,
        reactions,
        inlineButtons
      };
    });
  } catch (e) {
    console.error('[PostgreSQL] Error fetching chat messages:', e);
    return [];
  }
}

export function saveChatMessageToPg(msg: any): any {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !msg) return null;
  try {
    const rawChatId = String(msg.chatId || msg.chat_id || 'group-smm');
    const isGroup =
      rawChatId === 'group-smm' ||
      rawChatId === 'group-iismm' ||
      rawChatId === 'gr_iismm_chat' ||
      rawChatId.startsWith('gr');

    const msgId = msg.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const sender = msg.sender === 'me' || msg.sender === 'them' || msg.sender === 'system' ? msg.sender : 'me';
    const senderName = msg.senderName || msg.sender_name || '';
    const text = msg.text || '';
    const time = msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mediaUrl = msg.mediaUrl || msg.media_url || '';
    const mediaType = msg.mediaType || msg.media_type || '';
    const imagesJson = msg.images
      ? typeof msg.images === 'string'
        ? msg.images
        : JSON.stringify(msg.images)
      : msg.images_json || null;
    const replyToJson = msg.replyTo
      ? typeof msg.replyTo === 'string'
        ? msg.replyTo
        : JSON.stringify(msg.replyTo)
      : msg.reply_to_json || null;
    const forwardedJson = msg.forwardedFrom
      ? typeof msg.forwardedFrom === 'string'
        ? msg.forwardedFrom
        : JSON.stringify(msg.forwardedFrom)
      : msg.forwarded_json || null;
    const fileName = msg.fileName || msg.file_name || null;
    const fileSize = msg.fileSize || msg.file_size || null;
    const messageFormat = msg.messageFormat || msg.message_format || 'v2';
    const reactionsJson = msg.reactions
      ? typeof msg.reactions === 'string'
        ? msg.reactions
        : JSON.stringify(msg.reactions)
      : msg.reactions_json || null;
    const inlineButtonsJson = msg.inlineButtons
      ? typeof msg.inlineButtons === 'string'
        ? msg.inlineButtons
        : JSON.stringify(msg.inlineButtons)
      : msg.inline_buttons
        ? typeof msg.inline_buttons === 'string'
          ? msg.inline_buttons
          : JSON.stringify(msg.inline_buttons)
        : msg.inline_buttons_json || null;

    let targetChatId = rawChatId;
    if (rawChatId === 'group-iismm' || rawChatId === 'gr_iismm_chat') {
      targetChatId = 'group-smm';
    } else if (!isGroup) {
      const senderUserId = String(msg.userId || msg.senderId || '16926299042');
      const normSender = normalizeUserId(senderUserId);
      const isSaved =
        rawChatId === 'saved_messages' || rawChatId === 'saved' || rawChatId === senderUserId || rawChatId === normSender;
      if (isSaved) {
        targetChatId = getCanonicalDmChatId(senderUserId, senderUserId);
      } else {
        targetChatId = getCanonicalDmChatId(senderUserId, rawChatId);
      }

      const previewSummary = formatChatLastMessagePreview({
        text: decryptChatTextIfNeeded(text, targetChatId, rawChatId),
        mediaType,
        mediaUrl,
        images: imagesJson,
        forwardedFrom: forwardedJson,
        fallback: ''
      });

      try {
        const partnerId = isSaved ? normSender : normalizeUserId(rawChatId);
        const existingChat = dbInstance.exec(
          'SELECT id FROM user_chats WHERE (user_id = ? AND partner_id = ?) OR (user_id = ? AND partner_id = ?)',
          [normSender, partnerId, partnerId, normSender]
        );
        if (!existingChat[0]?.values || existingChat[0].values.length === 0) {
          const chatIdToInsert = isSaved ? `dm_${normSender}_${normSender}` : targetChatId;
          const pName = isSaved ? 'Избранное (Чат с собой)' : msg.recipientName || 'Соавтор';
          const pUsername = isSaved ? 'saved_messages' : `@user_${partnerId.slice(-4)}`;
          dbInstance.run(
            `INSERT OR IGNORE INTO user_chats (id, user_id, partner_id, partner_name, partner_username, partner_avatar, title, is_group, last_message, last_message_time, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'), datetime('now'))`,
            [
              chatIdToInsert,
              normSender,
              partnerId,
              pName,
              pUsername,
              isSaved ? BRAND_ASSETS.heartAvatar : '',
              pName,
              previewSummary,
              time
            ]
          );
        }
      } catch {}
    }

    dbInstance.run(
      `INSERT INTO chat_messages (
        id, chat_id, sender, sender_name, text, time, media_url, media_type,
        images_json, reply_to_json, forwarded_json, file_name, file_size, message_format, created_at, reactions_json, inline_buttons_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
      [
        msgId,
        targetChatId,
        sender,
        senderName,
        text,
        time,
        mediaUrl,
        mediaType,
        imagesJson,
        replyToJson,
        forwardedJson,
        fileName,
        fileSize,
        messageFormat,
        reactionsJson,
        inlineButtonsJson
      ]
    );

    if (isGroup) {
      dbInstance.run(`UPDATE group_chats SET updated_at = datetime('now') WHERE id = ?`, [targetChatId]);
    } else {
      const dmPreviewSummary = formatChatLastMessagePreview({
        text: decryptChatTextIfNeeded(text, targetChatId, rawChatId),
        mediaType,
        mediaUrl,
        images: imagesJson,
        forwardedFrom: forwardedJson,
        fallback: ''
      });
      dbInstance.run(
        `UPDATE user_chats SET last_message = ?, last_message_time = ?, updated_at = datetime('now') WHERE id = ? OR partner_id = ?`,
        [dmPreviewSummary, time, targetChatId, rawChatId]
      );
    }

    savePgDB();

    return {
      id: msgId,
      chatId: targetChatId,
      sender,
      senderName,
      text,
      time,
      mediaUrl,
      mediaType,
      images: Array.isArray(msg.images)
        ? msg.images
        : typeof msg.images === 'string' && msg.images
          ? [msg.images]
          : undefined,
      replyTo: msg.replyTo,
      forwardedFrom: msg.forwardedFrom,
      fileName,
      fileSize,
      messageFormat,
      reactions: msg.reactions || [],
      inlineButtons: msg.inlineButtons || msg.inline_buttons,
      createdAt: new Date().toISOString()
    };
  } catch (e) {
    console.error('[PostgreSQL] Error saving chat message:', e);
    return null;
  }
}

export function toggleChatMessageReactionInPg(
  messageId: string,
  reactionData: {
    type: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    chatId?: string;
  }
): any[] {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !messageId) return [];
  try {
    const res = dbInstance.exec('SELECT id, reactions_json, chat_id FROM chat_messages WHERE id = ?', [messageId]);
    let currentReactions: any[] = [];
    let messageFound = false;

    if (res[0]?.values && res[0].values.length > 0) {
      messageFound = true;
      const rawReactions = res[0].values[0][1];
      if (rawReactions) {
        try {
          currentReactions = typeof rawReactions === 'string' ? JSON.parse(rawReactions) : rawReactions;
          if (!Array.isArray(currentReactions)) currentReactions = [];
        } catch {
          currentReactions = [];
        }
      }
    }

    currentReactions = currentReactions.map((r: any) => {
      if (typeof r === 'string') {
        return { type: r, userId: '', userName: 'Пользователь', time: new Date().toISOString() };
      }
      return r;
    });

    const existingIdx = currentReactions.findIndex(
      (r: any) => String(r.userId) === String(reactionData.userId) && r.type === reactionData.type
    );

    let newReactions: any[];
    if (existingIdx >= 0) {
      newReactions = currentReactions.filter((_, idx) => idx !== existingIdx);
    } else {
      const withoutUserOther = currentReactions.filter(
        (r: any) => String(r.userId) !== String(reactionData.userId)
      );
      const newReaction = {
        type: reactionData.type,
        userId: reactionData.userId,
        userName: reactionData.userName || 'Вы',
        userAvatar: normalizeProTalkMediaUrl(reactionData.userAvatar) || BRAND_ASSETS.heartAvatar,
        time: new Date().toISOString()
      };
      newReactions = [...withoutUserOther, newReaction];
    }

    const newJson = JSON.stringify(newReactions);
    if (messageFound) {
      dbInstance.run('UPDATE chat_messages SET reactions_json = ? WHERE id = ?', [newJson, messageId]);
      savePgDB();
    }
    return newReactions;
  } catch (e) {
    console.error('[PostgreSQL] Error toggling message reaction:', e);
    return [];
  }
}

export function deleteChatMessageFromPg(msgId: string): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !msgId) return false;
  try {
    dbInstance.run('DELETE FROM chat_messages WHERE id = ?', [msgId]);
    savePgDB();
    return true;
  } catch (e) {
    console.error('[PostgreSQL] Error deleting chat message:', e);
    return false;
  }
}
