import { decryptMessageWithEmoji, isEmojiEncrypted } from '../cryptoEmoji';
import { PgCloudDatabase, getSyncPgDB } from '../pg/cache/pgMemAdapter';
import { formatChatLastMessagePreview } from '../../utils/chat/chatPreviewFormatter';
import { cleanAuthorName, getUserFromPg, normalizeUserId, savePgDB } from '../repos/coreSettingsRepo';
import { BANNED_BOT_NAMES } from '../repos/socialSubscriptionsRepo';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';

export function syncDefaultGroupChat(db?: PgCloudDatabase | null): void {
  const dbInstance = db || getSyncPgDB();
  if (!dbInstance) return;
  try {
    const allUsersRes = dbInstance.exec('SELECT id FROM users');
    const allUserIds: string[] = [];
    if (allUsersRes[0]?.values) {
      allUsersRes[0].values.forEach((r: any[]) => {
        const uid = normalizeUserId(r[0]);
        if (uid && !allUserIds.includes(uid)) {
          allUserIds.push(uid);
        }
      });
    }
    if (!allUserIds.includes('16926299042')) {
      allUserIds.push('16926299042');
    }

    const leftRes = dbInstance.exec("SELECT user_id FROM left_groups WHERE group_id = 'group-smm'");
    const leftSet = new Set<string>();
    if (leftRes[0]?.values) {
      leftRes[0].values.forEach((r: any[]) => leftSet.add(normalizeUserId(r[0])));
    }
    const finalMembers = allUserIds.filter((uid) => !leftSet.has(uid));

    const grRes = dbInstance.exec("SELECT id, members_json, admins_json FROM group_chats WHERE id = 'group-smm'");
    if (!grRes[0]?.values || grRes[0].values.length === 0) {
      dbInstance.run(
        `INSERT INTO group_chats (id, title, description, avatar_url, creator_id, admins_json, members_json, is_default, created_at, updated_at)
         VALUES ('group-smm', 'ИИSMM', 'Единый официальный групповой чат соавторов платформы ИИSMM', ?, '16926299042', ?, ?, 1, datetime('now'), datetime('now'))`,
        [BRAND_ASSETS.logo, JSON.stringify(['16926299042']), JSON.stringify(finalMembers)]
      );
    } else {
      let existingMembers: string[] = [];
      try {
        existingMembers = JSON.parse(String(grRes[0].values[0][1] || '[]'));
      } catch {
        existingMembers = [];
      }
      const mergedMembers = Array.from(new Set([...existingMembers.map(normalizeUserId), ...finalMembers])).filter(
        (uid) => !leftSet.has(uid)
      );
      dbInstance.run(
        `UPDATE group_chats SET members_json = ?, title = 'ИИSMM', is_default = 1, updated_at = datetime('now') WHERE id = 'group-smm'`,
        [JSON.stringify(mergedMembers)]
      );
    }
  } catch (e) {
    console.error('[PostgreSQL] Error syncing default group chat:', e);
  }
}

export function ensureUserInDefaultGroupChat(userId: string): void {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !userId) return;
  try {
    const normUser = normalizeUserId(userId);
    const leftRes = dbInstance.exec(`SELECT id FROM left_groups WHERE user_id = ? AND group_id = 'group-smm'`, [
      normUser
    ]);
    if (leftRes[0]?.values && leftRes[0].values.length > 0) {
      return;
    }

    const grRes = dbInstance.exec(`SELECT members_json FROM group_chats WHERE id = 'group-smm'`);
    if (!grRes[0]?.values || grRes[0].values.length === 0) {
      syncDefaultGroupChat(dbInstance);
      return;
    }

    let members: string[] = [];
    try {
      members = JSON.parse(String(grRes[0].values[0][0] || '[]'));
    } catch {
      members = [];
    }
    if (!members.includes(normUser)) {
      members.push(normUser);
      dbInstance.run(`UPDATE group_chats SET members_json = ?, updated_at = datetime('now') WHERE id = 'group-smm'`, [
        JSON.stringify(members)
      ]);
      savePgDB();
    }
  } catch (e) {
    console.error('[PostgreSQL] Error in ensureUserInDefaultGroupChat:', e);
  }
}

export function getCanonicalDmChatId(u1: string, u2: string): string {
  const norm1 = normalizeUserId(u1);
  const norm2 = normalizeUserId(u2);
  if (norm1 === norm2) return `dm_${norm1}_${norm1}`;
  return norm1 < norm2 ? `dm_${norm1}_${norm2}` : `dm_${norm2}_${norm1}`;
}

export function createOrGetDirectChatInPg(
  userId: string,
  partnerId: string,
  partnerName?: string,
  partnerUsername?: string,
  partnerAvatar?: string
): any {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !userId || !partnerId) return null;
  const normUser = normalizeUserId(userId);
  const normPartner = normalizeUserId(partnerId);
  const isSelf = normUser === normPartner;
  const canonicalDm = isSelf ? `dm_${normUser}_${normUser}` : getCanonicalDmChatId(normUser, normPartner);

  try {
    const existing = dbInstance.exec(
      'SELECT id, user_id, partner_id, partner_name, partner_username, partner_avatar, title, is_group, last_message, last_message_time FROM user_chats WHERE (user_id = ? AND partner_id = ?) OR (user_id = ? AND partner_id = ?)',
      [normUser, normPartner, normPartner, normUser]
    );

    let pName = isSelf ? 'Избранное' : partnerName || 'Соавтор';
    let pUsername = isSelf ? '@saved_messages' : partnerUsername || `@user_${normPartner.slice(-4)}`;
    let pAvatar = isSelf ? BRAND_ASSETS.logo : normalizeProTalkMediaUrl(partnerAvatar) || BRAND_ASSETS.heartAvatar;

    if (existing[0]?.values && existing[0].values.length > 0) {
      const row = existing[0].values[0];
      return {
        id: normPartner,
        chatId: canonicalDm,
        name: String(row[3] || pName),
        username: String(row[4] || pUsername),
        avatar: normalizeProTalkMediaUrl(String(row[5] || '')) || pAvatar,
        isGroup: false,
        isSelf
      };
    }

    dbInstance.run(
      `INSERT OR IGNORE INTO user_chats (id, user_id, partner_id, partner_name, partner_username, partner_avatar, title, is_group, last_message, last_message_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Диалог начат', datetime('now'), datetime('now'), datetime('now'))`,
      [canonicalDm, normUser, normPartner, pName, pUsername, pAvatar, pName]
    );
    savePgDB();

    return {
      id: normPartner,
      chatId: canonicalDm,
      name: pName,
      username: pUsername,
      avatar: pAvatar,
      isGroup: false,
      isSelf
    };
  } catch (e) {
    console.error('[PostgreSQL] Error in createOrGetDirectChatInPg:', e);
    return null;
  }
}



export function decryptChatTextIfNeeded(rawText: string, msgChatId: string, requestedChatId?: string): string {
  if (!rawText || !isEmojiEncrypted(rawText)) return rawText || '';
  const parts = String(msgChatId || '')
    .replace(/^dm_/, '')
    .split('_')
    .filter(Boolean);
  const candidateKeys = [
    ...parts.map((p) => `iismm_${p}_secret`),
    `iismm_${msgChatId}_secret`,
    ...(requestedChatId ? [`iismm_${requestedChatId}_secret`] : []),
    'iismm_secure_chat',
    'iismm_group-smm_secret',
    'iismm_saved_messages_secret',
    'iismm_16926299042_secret'
  ];
  for (const k of candidateKeys) {
    try {
      const dec = decryptMessageWithEmoji(rawText, k);
      if (!dec.includes('\uFFFD') && dec.length > 0 && !dec.startsWith('🔐')) {
        return dec;
      }
    } catch {}
  }
  return rawText;
}

export function getUserChatsFromPg(userId: string): any[] {
  const dbInstance = getSyncPgDB();
  if (!dbInstance) return [];
  try {
    const normId = normalizeUserId(userId);
    ensureUserInDefaultGroupChat(normId);

    const chats: any[] = [];
    const seenChatIds = new Set<string>();

    const grRes = dbInstance.exec(`
      SELECT id, title, description, avatar_url, creator_id, admins_json, members_json, is_default, updated_at
      FROM group_chats
      ORDER BY is_default DESC, updated_at DESC
    `);
    if (grRes[0]?.values) {
      grRes[0].values.forEach((row: any[]) => {
        const grId = String(row[0]);
        let members: string[] = [];
        try {
          members = JSON.parse(String(row[6] || '[]'));
        } catch {
          members = [];
        }

        if (members.includes(normId)) {
          seenChatIds.add(grId);

          let lastMsg = String(row[2] || 'Групповой чат сообщества @iismm_chat');
          let lastTime = '';
          const msgRes = dbInstance.exec(
            `SELECT text, time, media_type, media_url, images_json, forwarded_json, chat_id
             FROM chat_messages
             WHERE (chat_id = ? OR (chat_id IN ('group-smm', 'group-iismm', 'gr_iismm_chat') AND ? = 'group-smm'))
               AND NOT (
                 TRIM(COALESCE(text, '')) = ''
                 AND TRIM(COALESCE(media_url, '')) = ''
                 AND TRIM(COALESCE(images_json, '')) IN ('', 'null', '[]')
                 AND TRIM(COALESCE(forwarded_json, '')) IN ('', 'null')
               )
             ORDER BY created_at DESC, id DESC LIMIT 1`,
            [grId, grId]
          );
          if (msgRes[0]?.values && msgRes[0].values.length > 0) {
            const mRow = msgRes[0].values[0];
            const rawTxt = String(mRow[0] || '');
            const decTxt = decryptChatTextIfNeeded(rawTxt, String(mRow[6] || grId), grId);
            lastMsg = formatChatLastMessagePreview({
              text: decTxt,
              mediaType: String(mRow[2] || ''),
              mediaUrl: String(mRow[3] || ''),
              images: mRow[4],
              forwardedFrom: mRow[5],
              fallback: String(row[2] || 'Групповой чат сообщества @iismm_chat')
            });
            lastTime = String(mRow[1] || '');
          }

          chats.push({
            id: grId,
            name: String(row[1] || 'ИИSMM'),
            username: grId === 'group-smm' ? '@iismm_chat' : `@${grId}`,
            avatar: normalizeProTalkMediaUrl(String(row[3] || '')) || BRAND_ASSETS.logo,
            status: 'offline',
            bio: String(row[2] || 'Единый групповой чат соавторов'),
            description: String(row[2] || ''),
            isGroup: true,
            isFriend: true,
            isDefault: Number(row[7]) === 1,
            creatorId: String(row[4] || ''),
            lastMessage: lastMsg,
            lastTime: lastTime || 'Сегодня'
          });
        }
      });
    }

    const hiddenRes = dbInstance.exec('SELECT chat_id FROM hidden_chats WHERE user_id = ?', [normId]);
    const hiddenSet = new Set<string>();
    if (hiddenRes[0]?.values) {
      hiddenRes[0].values.forEach((r: any[]) => hiddenSet.add(String(r[0])));
    }

    const dmRes = dbInstance.exec(
      `SELECT id, user_id, partner_id, partner_name, partner_username, partner_avatar, title, is_group, last_message, last_message_time, updated_at
       FROM user_chats
       WHERE is_group = 0 AND (user_id = ? OR partner_id = ?)
       ORDER BY updated_at DESC`,
      [normId, normId]
    );

    if (dmRes[0]?.values) {
      dmRes[0].values.forEach((row: any[]) => {
        const rawPartnerName = String(row[3] || '');
        const u1 = String(row[1]);
        const u2 = String(row[2]);
        const otherUserId = u1 === normId ? u2 : u1;

        if (
          otherUserId === '4829104' ||
          otherUserId.startsWith('f-') ||
          rawPartnerName === 'Соавтор' ||
          rawPartnerName.toLowerCase().includes('синдикат') ||
          BANNED_BOT_NAMES.some(
            (b) => rawPartnerName.toLowerCase().includes(b) || String(row[6] || '').toLowerCase().includes(b)
          )
        ) {
          return;
        }

        const finalChatId =
          otherUserId && otherUserId !== 'undefined' && otherUserId !== 'null' ? otherUserId : String(row[0]);

        if (seenChatIds.has(finalChatId) || hiddenSet.has(finalChatId) || hiddenSet.has(String(row[0]))) {
          return;
        }
        seenChatIds.add(finalChatId);

        const isSelf =
          otherUserId === normId || String(row[0]).includes('_self') || String(row[0]) === `dm_${normId}_${normId}`;

        let pName = cleanAuthorName(row[3]) || 'Соавтор';
        let pUsername = row[4] ? (String(row[4]).startsWith('@') ? String(row[4]) : `@${row[4]}`) : '';
        let pAvatar =
          normalizeProTalkMediaUrl(row[5]) ||
          (finalChatId.startsWith('169262990') ? BRAND_ASSETS.ownerAvatar : BRAND_ASSETS.heartAvatar);

        if (isSelf) {
          pName = 'Избранное';
          pUsername = '@saved_messages';
          pAvatar = BRAND_ASSETS.logo;
        } else {
          const uDb = getUserFromPg(finalChatId);
          if (uDb) {
            const fn = uDb.firstName || '';
            const ln = uDb.lastName || '';
            const fullN = `${fn} ${ln}`.trim();
            if (fullN) pName = cleanAuthorName(fullN);
            if (uDb.username) pUsername = uDb.username.startsWith('@') ? uDb.username : `@${uDb.username}`;
            if (uDb.photoUrl) pAvatar = normalizeProTalkMediaUrl(uDb.photoUrl) || pAvatar;
          }
        }

        const canonicalDm = getCanonicalDmChatId(normId, otherUserId);
        let dmLastMsg = String(row[8] || 'Диалог начат');
        let dmLastTime = String(row[9] || '');

        const lastMsgRes = dbInstance.exec(
          `SELECT text, time, media_type, media_url, images_json, forwarded_json, chat_id
           FROM chat_messages
           WHERE chat_id = ? OR chat_id = ? OR chat_id = ? OR chat_id = ?
           ORDER BY created_at DESC, id DESC LIMIT 1`,
          [canonicalDm, finalChatId, `dm_${normId}_${otherUserId}`, `dm_${otherUserId}_${normId}`]
        );
        if (lastMsgRes[0]?.values && lastMsgRes[0].values.length > 0) {
          const lmRow = lastMsgRes[0].values[0];
          const rawTxt = String(lmRow[0] || '');
          const decTxt = decryptChatTextIfNeeded(rawTxt, String(lmRow[6] || canonicalDm), canonicalDm);
          dmLastMsg = formatChatLastMessagePreview({
            text: decTxt,
            mediaType: String(lmRow[2] || ''),
            mediaUrl: String(lmRow[3] || ''),
            images: lmRow[4],
            forwardedFrom: lmRow[5],
            fallback: String(row[8] || 'Диалог начат')
          });
          dmLastTime = String(lmRow[1] || '');
        }

        chats.push({
          id: finalChatId,
          name: pName,
          username: pUsername || `@user_${finalChatId.slice(-4)}`,
          avatar: pAvatar,
          status: 'offline',
          bio: isSelf ? 'Ваши сохраненные сообщения и заметки' : `Профиль соавтора ${pName}`,
          description: '',
          isGroup: false,
          isFriend: true,
          isSelf,
          lastMessage: dmLastMsg,
          lastTime: dmLastTime || 'Сегодня'
        });
      });
    }

    return chats;
  } catch (e) {
    console.error('[PostgreSQL] Error fetching user chats:', e);
    return [];
  }
}

export function createGroupChatInPg(
  creatorUserId: string,
  titleOrData:
    | string
    | {
        title: string;
        description?: string;
        avatarUrl?: string;
        members?: string[];
        admins?: string[];
      },
  memberIdsParam?: string[],
  descriptionParam?: string,
  avatarUrlParam?: string
): any {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !creatorUserId) return null;
  try {
    const normCreator = normalizeUserId(creatorUserId);
    const groupId = 'group_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

    let cleanTitle = 'Новая группа';
    let cleanDesc = '';
    let cleanAvatar: string = String(BRAND_ASSETS.logo);
    let rawMembers: string[] = [];
    let rawAdmins: string[] = [];

    if (typeof titleOrData === 'object' && titleOrData !== null) {
      cleanTitle = (titleOrData.title || 'Новая группа').trim();
      cleanDesc = (titleOrData.description || '').trim();
      cleanAvatar = normalizeProTalkMediaUrl(titleOrData.avatarUrl) || String(BRAND_ASSETS.logo);
      rawMembers = Array.isArray(titleOrData.members) ? titleOrData.members : [];
      rawAdmins = Array.isArray(titleOrData.admins) ? titleOrData.admins : [];
    } else {
      cleanTitle = (String(titleOrData || 'Новая группа')).trim();
      cleanDesc = (descriptionParam || '').trim();
      cleanAvatar = normalizeProTalkMediaUrl(avatarUrlParam) || String(BRAND_ASSETS.logo);
      rawMembers = Array.isArray(memberIdsParam) ? memberIdsParam : [];
    }

    const uniqueMembers = Array.from(new Set([normCreator, '16926299042', ...rawMembers.map(normalizeUserId)]));
    const admins = Array.from(new Set([normCreator, '16926299042', ...rawAdmins.map(normalizeUserId)]));

    dbInstance.run(
      `INSERT INTO group_chats (id, title, description, avatar_url, creator_id, admins_json, members_json, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
      [groupId, cleanTitle, cleanDesc, cleanAvatar, normCreator, JSON.stringify(admins), JSON.stringify(uniqueMembers)]
    );

    savePgDB();

    return {
      id: groupId,
      name: cleanTitle,
      username: `@${groupId}`,
      avatar: cleanAvatar,
      status: 'online',
      bio: cleanDesc,
      description: cleanDesc,
      isGroup: true,
      isFriend: true,
      creatorId: normCreator,
      admins,
      members: uniqueMembers,
      lastMessage: `Групповой чат «${cleanTitle}» создан.`,
      lastTime: 'Только что'
    };
  } catch (e) {
    console.error('[PostgreSQL] Error creating group chat:', e);
    return null;
  }
}

export function getGroupChatByIdFromPg(groupId: string, currentUserId: string): any {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !groupId) return null;
  try {
    const cleanGroupId = groupId === 'group-iismm' || groupId === 'gr_iismm_chat' ? 'group-smm' : groupId;
    const normUser = normalizeUserId(currentUserId);
    const res = dbInstance.exec(
      `SELECT id, title, description, avatar_url, creator_id, admins_json, members_json, is_default, created_at, updated_at
       FROM group_chats
       WHERE id = ?
       LIMIT 1`,
      [cleanGroupId]
    );

    if (!res[0]?.values || res[0].values.length === 0) {
      if (cleanGroupId === 'group-smm') {
        syncDefaultGroupChat(dbInstance);
        return getGroupChatByIdFromPg('group-smm', currentUserId);
      }
      return null;
    }
    const row = res[0].values[0];
    const grId = String(row[0]);
    const title = String(row[1] || 'Группа');
    const description = String(row[2] || '');
    const avatarUrl = normalizeProTalkMediaUrl(String(row[3] || '')) || BRAND_ASSETS.logo;
    const creatorId = String(row[4] || '16926299042');

    let admins: string[] = [];
    try {
      admins = JSON.parse(String(row[5] || '[]')).map(normalizeUserId);
    } catch {
      admins = [];
    }
    if (!admins.includes(creatorId)) admins.push(creatorId);

    let memberIds: string[] = [];
    try {
      memberIds = JSON.parse(String(row[6] || '[]')).map(normalizeUserId);
    } catch {
      memberIds = [];
    }

    const isDefault = Number(row[7]) === 1;
    const isCurrentUserCreator = normUser === creatorId || normUser === '16926299042';
    const isCurrentUserAdmin = isCurrentUserCreator || admins.includes(normUser);

    const allUsersRes = dbInstance.exec(`
      SELECT id, telegram_id, first_name, last_name, username, photo_url, role
      FROM users
    `);
    const usersMap = new Map<string, any>();
    if (allUsersRes[0]?.values) {
      allUsersRes[0].values.forEach((u: any[]) => {
        const uId = normalizeUserId(u[0]);
        const fn = u[2] ? String(u[2]) : '';
        const ln = u[3] ? String(u[3]) : '';
        const name = cleanAuthorName(`${fn} ${ln}`.trim() || fn || 'Соавтор');
        const rawUsername = u[4] ? String(u[4]).replace(/^@/, '') : '';
        const username = rawUsername ? `@${rawUsername}` : `@user_${uId.slice(-4)}`;
        const rawAvatar = normalizeProTalkMediaUrl(u[5] ? String(u[5]) : '');
        const avatar =
          rawAvatar && !rawAvatar.includes('dicebear') && !rawAvatar.includes('/api/avatar/')
            ? rawAvatar
            : (uId.startsWith('169262990') ? BRAND_ASSETS.ownerAvatar : BRAND_ASSETS.heartAvatar);
        usersMap.set(uId, { id: uId, name, username, avatar });
      });
    }

    const members = memberIds.map((mId) => {
      const u = usersMap.get(mId) || {
        id: mId,
        name: mId === '16926299042' ? 'Тимошенко Денис' : `Соавтор #${mId.slice(-4)}`,
        username: mId === '16926299042' ? '@timoshenkodenis' : `@user_${mId.slice(-4)}`,
        avatar: mId === '16926299042' ? BRAND_ASSETS.ownerAvatar : BRAND_ASSETS.heartAvatar
      };
      return {
        ...u,
        isAdmin: admins.includes(mId),
        isCreator: mId === creatorId
      };
    });

    const adminObjects = members.filter((m) => admins.includes(m.id));

    return {
      id: grId,
      title,
      description,
      avatarUrl,
      avatar: avatarUrl,
      creatorId,
      admins: adminObjects,
      adminIds: admins,
      memberIds,
      members,
      isDefault,
      isAdmin: isCurrentUserAdmin || isCurrentUserCreator || normUser === '16926299042',
      isCurrentUserAdmin: isCurrentUserAdmin || isCurrentUserCreator || normUser === '16926299042',
      isCurrentUserCreator,
      membersCount: memberIds.length,
      memberCount: memberIds.length,
      adminsCount: admins.length
    };
  } catch (e) {
    console.error('[PostgreSQL] Error fetching group details:', e);
    return null;
  }
}

export function updateGroupChatInPg(
  groupId: string,
  currentUserId: string,
  updates: {
    title?: string;
    description?: string;
    avatarUrl?: string;
    admins?: any[];
    members?: any[];
  }
): any {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !groupId) return null;
  try {
    const cleanGroupId = groupId === 'group-iismm' || groupId === 'gr_iismm_chat' ? 'group-smm' : groupId;
    const normUser = normalizeUserId(currentUserId);

    const existing = getGroupChatByIdFromPg(cleanGroupId, normUser);
    if (!existing) return null;

    if (!existing.isCurrentUserAdmin && !existing.isCurrentUserCreator && normUser !== '16926299042') {
      throw new Error('У вас нет прав администратора для редактирования этой группы');
    }

    const newTitle = (updates.title !== undefined ? updates.title : existing.title).trim();
    const newDesc = (updates.description !== undefined ? updates.description : existing.description).trim();
    const newAvatar = (updates.avatarUrl !== undefined ? updates.avatarUrl : existing.avatarUrl).trim();

    const extractId = (x: any) =>
      typeof x === 'object' && x ? String(x.id || x.telegramId || x.userId) : String(x);

    const newAdmins = updates.admins
      ? Array.from(new Set(updates.admins.map(extractId).map(normalizeUserId)))
      : existing.adminIds || existing.admins.map((a: any) => a.id);

    if (!newAdmins.includes(existing.creatorId)) {
      newAdmins.push(existing.creatorId);
    }

    const newMembers = updates.members
      ? Array.from(new Set(updates.members.map(extractId).map(normalizeUserId)))
      : existing.memberIds;

    for (const adm of newAdmins) {
      if (!newMembers.includes(adm)) newMembers.push(adm);
    }

    dbInstance.run(
      `UPDATE group_chats
       SET title = ?, description = ?, avatar_url = ?, admins_json = ?, members_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [newTitle, newDesc, newAvatar, JSON.stringify(newAdmins), JSON.stringify(newMembers), cleanGroupId]
    );

    savePgDB();
    return getGroupChatByIdFromPg(cleanGroupId, normUser);
  } catch (e: any) {
    console.error('[PostgreSQL] Error updating group chat:', e);
    throw e;
  }
}

export function leaveGroupChatInPg(groupId: string, currentUserId: string): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !groupId || !currentUserId) return false;
  try {
    const cleanGroupId = groupId === 'group-iismm' || groupId === 'gr_iismm_chat' ? 'group-smm' : groupId;
    const normUser = normalizeUserId(currentUserId);

    const leftId = `left_${normUser}_${cleanGroupId}`;
    dbInstance.run(
      `INSERT OR REPLACE INTO left_groups (id, user_id, group_id, left_at) VALUES (?, ?, ?, datetime('now'))`,
      [leftId, normUser, cleanGroupId]
    );

    const grRes = dbInstance.exec('SELECT members_json, admins_json FROM group_chats WHERE id = ?', [cleanGroupId]);
    if (grRes[0]?.values && grRes[0].values.length > 0) {
      let members: string[] = [];
      let admins: string[] = [];
      try {
        members = JSON.parse(String(grRes[0].values[0][0] || '[]')).map(normalizeUserId);
      } catch {}
      try {
        admins = JSON.parse(String(grRes[0].values[0][1] || '[]')).map(normalizeUserId);
      } catch {}

      const newMembers = members.filter((m) => m !== normUser);
      const newAdmins = admins.filter((a) => a !== normUser);

      dbInstance.run(
        `UPDATE group_chats SET members_json = ?, admins_json = ?, updated_at = datetime('now') WHERE id = ?`,
        [JSON.stringify(newMembers), JSON.stringify(newAdmins), cleanGroupId]
      );
    }

    savePgDB();
    return true;
  } catch (e) {
    console.error('[PostgreSQL] Error leaving group chat:', e);
    return false;
  }
}

export function leavePersonalChatInPg(userId: string, partnerId: string): boolean {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !userId || !partnerId) return false;
  try {
    const normUser = normalizeUserId(userId);
    const normPartner = normalizeUserId(partnerId);
    const canonicalDm = getCanonicalDmChatId(normUser, normPartner);

    const hid1 = `hide_${normUser}_${canonicalDm}`;
    const hid2 = `hide_${normUser}_${normPartner}`;
    dbInstance.run(
      `INSERT OR REPLACE INTO hidden_chats (id, user_id, chat_id, created_at) VALUES (?, ?, ?, datetime('now'))`,
      [hid1, normUser, canonicalDm]
    );
    dbInstance.run(
      `INSERT OR REPLACE INTO hidden_chats (id, user_id, chat_id, created_at) VALUES (?, ?, ?, datetime('now'))`,
      [hid2, normUser, normPartner]
    );

    savePgDB();
    return true;
  } catch (e) {
    console.error('[PostgreSQL] Error leaving personal chat:', e);
    return false;
  }
}

export function toggleBlockPersonalChatInPg(
  userId: string,
  partnerId: string
): { isBlocked: boolean } {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !userId || !partnerId) return { isBlocked: false };
  try {
    const normUser = normalizeUserId(userId);
    const normPartner = normalizeUserId(partnerId);
    const blId = `block_${normUser}_${normPartner}`;

    const existing = dbInstance.exec('SELECT id FROM blocked_chats WHERE user_id = ? AND partner_id = ?', [
      normUser,
      normPartner
    ]);
    if (existing[0]?.values && existing[0].values.length > 0) {
      dbInstance.run('DELETE FROM blocked_chats WHERE user_id = ? AND partner_id = ?', [normUser, normPartner]);
      savePgDB();
      return { isBlocked: false };
    } else {
      dbInstance.run(
        `INSERT INTO blocked_chats (id, user_id, partner_id, created_at) VALUES (?, ?, ?, datetime('now'))`,
        [blId, normUser, normPartner]
      );
      savePgDB();
      return { isBlocked: true };
    }
  } catch (e) {
    console.error('[PostgreSQL] Error toggling block personal chat:', e);
    return { isBlocked: false };
  }
}

export function getPersonalChatStatusFromPg(
  userId: string,
  partnerId: string
): { isBlockedByMe: boolean; isBlockedByPartner: boolean } {
  const dbInstance = getSyncPgDB();
  if (!dbInstance || !userId || !partnerId) return { isBlockedByMe: false, isBlockedByPartner: false };
  try {
    const normUser = normalizeUserId(userId);
    const normPartner = normalizeUserId(partnerId);

    const meRes = dbInstance.exec('SELECT id FROM blocked_chats WHERE user_id = ? AND partner_id = ?', [
      normUser,
      normPartner
    ]);
    const isBlockedByMe = Boolean(meRes[0]?.values && meRes[0].values.length > 0);

    const partnerRes = dbInstance.exec('SELECT id FROM blocked_chats WHERE user_id = ? AND partner_id = ?', [
      normPartner,
      normUser
    ]);
    const isBlockedByPartner = Boolean(partnerRes[0]?.values && partnerRes[0].values.length > 0);

    return { isBlockedByMe, isBlockedByPartner };
  } catch {
    return { isBlockedByMe: false, isBlockedByPartner: false };
  }
}
