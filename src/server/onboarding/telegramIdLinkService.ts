import * as crypto from 'crypto';
import { DB } from '../db';
import { getBotTokenFromPg, savePgDB } from '../db/postgres';
import { getDatabase, saveDatabaseToDisk } from '../db/index';
import {
  checkAndApplyStartRegistrationBonus,
  format11DigitUserId
} from '../db/usersTable';
import { ensureUserTelegramAvatarInGallery } from '../channelAvatarService';
import { ensureUserJoinedIismmChat } from '../social/autoJoinGroupService';
import { getTelegramBotConfig } from '../telegram';
import { fetchTelegramBotApi } from '../telegram/apiEndpointFallback';

export interface LinkTelegramByIdParams {
  rawUserId: string;
  rawTelegramId: string;
  password: string;
  confirmPassword: string;
}

export interface LinkTelegramByIdResult {
  ok: boolean;
  status: number;
  error?: string;
  bonusApplied?: boolean;
  bonusAmount?: number;
  balance?: number;
  telegramId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  photoUrl?: string;
  message?: string;
}

function hashPasswordSha256(pwd: string): string {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

export async function linkTelegramAccountByIdWithVerification(
  params: LinkTelegramByIdParams
): Promise<LinkTelegramByIdResult> {
  const rawUserId = String(params.rawUserId || '').trim();
  const rawTgStr = String(params.rawTelegramId || '').trim();
  const password = String(params.password || '').trim();
  const confirmPassword = String(params.confirmPassword || '').trim();

  if (!rawUserId) {
    return { ok: false, status: 400, error: 'Не удалось определить ваш личный кабинет. Перезайдите в аккаунт по почте.' };
  }

  // Reject negative channel/group IDs explicitly
  if (rawTgStr.startsWith('-')) {
    return {
      ok: false,
      status: 400,
      error: 'Указан идентификатор канала или группы (начинается с минуса). Введите личный числовой идентификатор вашего аккаунта из бота @my_id_bot.'
    };
  }

  const digitsOnly = rawTgStr.replace(/\s+/g, '');
  if (!/^\d{5,15}$/.test(digitsOnly)) {
    return {
      ok: false,
      status: 400,
      error: 'Введите корректный числовой идентификатор вашего аккаунта Telegram (только цифры, например: 169262990).'
    };
  }

  const parsedTgId = parseInt(digitsOnly, 10);
  if (!parsedTgId || isNaN(parsedTgId) || parsedTgId < 10000) {
    return {
      ok: false,
      status: 400,
      error: 'Укажите корректный числовой идентификатор вашего профиля Telegram.'
    };
  }

  // Validate password & password confirmation
  if (!password || !confirmPassword) {
    return {
      ok: false,
      status: 400,
      error: 'Пожалуйста, введите свой пароль от личного кабинета и повторите пароль для подтверждения привязки.'
    };
  }

  if (password.length < 4) {
    return {
      ok: false,
      status: 400,
      error: 'Пароль должен содержать минимум 4 символа.'
    };
  }

  if (password !== confirmPassword) {
    return {
      ok: false,
      status: 400,
      error: 'Введенные пароли не совпадают. Проверьте правильность ввода пароля и его повтора.'
    };
  }

  const db = await getDatabase();
  const cleanId = format11DigitUserId(rawUserId);
  const tgLookup = parseInt(rawUserId, 10) || 0;

  const userStmt = db.prepare(
    'SELECT * FROM users WHERE id = ? OR telegram_id = ? LIMIT 1'
  );
  userStmt.bind([cleanId, tgLookup]);
  let sqlUser: any = null;
  if (userStmt.step()) {
    sqlUser = userStmt.getAsObject();
  }
  userStmt.free();

  const legacyUser =
    DB.getUserById(rawUserId) ||
    DB.getUserById(cleanId) ||
    (tgLookup > 0 ? DB.getUserByTelegramId(tgLookup) : undefined);

  const canonicalId = sqlUser?.id ? String(sqlUser.id) : legacyUser?.id || cleanId;

  // Verify password matches current cabinet password if already set
  const existingHash = String(sqlUser?.password_hash || legacyUser?.passwordHash || '').trim();
  const candidateHash = hashPasswordSha256(password);
  if (existingHash && existingHash !== candidateHash && existingHash !== password) {
    return {
      ok: false,
      status: 403,
      error: 'Введен неверный текущий пароль от вашего личного кабинета. Укажите пароль, с которым вы входите по почте.'
    };
  }

  // Strict uniqueness check across both legacy DB and PostgreSQL users table
  const existingLegacyTg = DB.getUserByTelegramId(parsedTgId);
  if (
    existingLegacyTg &&
    existingLegacyTg.id !== canonicalId &&
    existingLegacyTg.id !== rawUserId
  ) {
    return {
      ok: false,
      status: 409,
      error: 'В базе данных уже зарегистрирован другой аккаунт с таким идентификатором Telegram. Привязать чужой или занятый идентификатор нельзя.'
    };
  }

  const dupStmt = db.prepare(
    'SELECT id, email, username FROM users WHERE telegram_id = ? AND id != ? LIMIT 1'
  );
  dupStmt.bind([parsedTgId, canonicalId]);
  const hasDup = dupStmt.step();
  dupStmt.free();

  if (hasDup) {
    return {
      ok: false,
      status: 409,
      error: 'В базе данных уже есть зарегистрированный профиль с таким идентификатором Telegram. Проверьте номер в боте @my_id_bot.'
    };
  }

  // Verify account via our Telegram bot (@IIrkiBot) and parse user info
  const settings = DB.getSettings();
  const botToken =
    getBotTokenFromPg() ||
    settings.telegramBotToken ||
    '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

  const tgConfig = await getTelegramBotConfig().catch(() => null);
  let botUsername = 'IIrkiBot';
  try {
    const meData = await fetchTelegramBotApi({
      primaryBase: tgConfig?.apiBaseUrl,
      proxyType: tgConfig?.proxyType,
      token: botToken,
      endpoint: 'getMe',
      timeoutMs: 7000
    });
    if (meData?.ok && meData?.result?.username) {
      botUsername = String(meData.result.username).replace(/^@/, '');
    }
  } catch {}

  let chatInfo: any = null;
  try {
    const chatData = await fetchTelegramBotApi({
      primaryBase: tgConfig?.apiBaseUrl,
      proxyType: tgConfig?.proxyType,
      token: botToken,
      endpoint: `getChat?chat_id=${parsedTgId}`,
      timeoutMs: 8000
    });
    if (!chatData?.ok || !chatData?.result) {
      return {
        ok: false,
        status: 400,
        error: `Наш бот @${botUsername} пока не видит ваш аккаунт. Сначала откройте https://t.me/${botUsername} в Telegram, нажмите кнопку «Запустить», а затем повторите привязку.`
      };
    }
    chatInfo = chatData.result;
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'Не удалось связаться с сервером Telegram для проверки идентификатора. Повторите попытку через пару секунд.'
    };
  }

  if (chatInfo.type && chatInfo.type !== 'private') {
    return {
      ok: false,
      status: 400,
      error: 'Указанный идентификатор принадлежит каналу или группе, а не личному профилю пользователя.'
    };
  }

  // Also verify active bot chat state via sendChatAction so we confirm user pressed /start and didn't block the bot
  try {
    const actData = await fetchTelegramBotApi({
      primaryBase: tgConfig?.apiBaseUrl,
      proxyType: tgConfig?.proxyType,
      token: botToken,
      endpoint: `sendChatAction?chat_id=${parsedTgId}&action=typing`,
      timeoutMs: 7000
    });
    if (!actData?.ok) {
      const desc = String(actData?.description || '').toLowerCase();
      if (desc.includes('blocked') || desc.includes('forbidden') || desc.includes('chat not found')) {
        return {
          ok: false,
          status: 400,
          error: `Диалог с нашим ботом @${botUsername} не запущен или остановлен. Откройте https://t.me/${botUsername}, нажмите «Запустить» и попробуйте снова.`
        };
      }
    }
  } catch {}

  const parsedFirstName = String(chatInfo.first_name || '').trim();
  const parsedLastName = String(chatInfo.last_name || '').trim();
  const parsedUsername = chatInfo.username
    ? `@${String(chatInfo.username).replace(/^@/, '')}`
    : '';
  const parsedBio = String(chatInfo.bio || '').trim();

  // Upload user's Telegram profile photo directly into our ProTalk media gallery with a full direct URL
  let fullGalleryPhotoUrl = '';
  try {
    fullGalleryPhotoUrl = await ensureUserTelegramAvatarInGallery(
      parsedTgId,
      canonicalId,
      '',
      true
    );
  } catch {}

  const currentFirstName = String(sqlUser?.first_name || legacyUser?.firstName || '').trim();
  const isPlaceholderName =
    !currentFirstName ||
    currentFirstName === 'Пользователь' ||
    currentFirstName.includes('@') ||
    currentFirstName.startsWith('User_');

  const finalFirstName = isPlaceholderName && parsedFirstName ? parsedFirstName : (currentFirstName || parsedFirstName || 'Пользователь');
  const finalLastName = parsedLastName || String(sqlUser?.last_name || legacyUser?.lastName || '').trim();
  const finalUsername = parsedUsername || String(sqlUser?.username || legacyUser?.username || '').trim();
  const finalBio = parsedBio || String(sqlUser?.bio || '').trim();
  const finalPasswordHash = existingHash || candidateHash;
  const finalPhotoUrl =
    fullGalleryPhotoUrl ||
    String(sqlUser?.photo_url || legacyUser?.photoUrl || '').trim();

  const existingCustomAvatar = String(sqlUser?.user_avatar || legacyUser?.userAvatar || '').trim();
  const shouldSetUserAvatar =
    Boolean(fullGalleryPhotoUrl) &&
    (!existingCustomAvatar ||
      existingCustomAvatar.startsWith('/f/') ||
      existingCustomAvatar.includes('/file/') ||
      existingCustomAvatar.includes('/api/avatar/') ||
      existingCustomAvatar.includes('unsplash.com'));

  const finalUserAvatar = shouldSetUserAvatar ? fullGalleryPhotoUrl : (existingCustomAvatar || finalPhotoUrl);

  if (!sqlUser) {
    db.run(
      `INSERT OR IGNORE INTO users (
        id, email, password_hash, telegram_id, username, first_name, last_name,
        bio, photo_url, user_avatar, status, balance, tariff, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Активный', ?, ?, ?)`,
      [
        canonicalId,
        legacyUser?.email || '',
        finalPasswordHash,
        parsedTgId,
        finalUsername,
        finalFirstName,
        finalLastName,
        finalBio,
        finalPhotoUrl,
        finalUserAvatar,
        Number(legacyUser?.balance ?? 300),
        String((legacyUser as any)?.tariff || 'Старт'),
        new Date().toISOString()
      ]
    );
  } else {
    db.run(
      `UPDATE users
       SET telegram_id = ?,
           password_hash = ?,
           username = ?,
           first_name = ?,
           last_name = ?,
           bio = ?,
           photo_url = ?,
           user_avatar = ?,
           status = 'Активный'
       WHERE id = ?`,
      [
        parsedTgId,
        finalPasswordHash,
        finalUsername,
        finalFirstName,
        finalLastName,
        finalBio,
        finalPhotoUrl,
        finalUserAvatar,
        canonicalId
      ]
    );
  }

  // Apply +300 Iirki start bonus for Telegram linking if not yet granted
  const bonusRes = checkAndApplyStartRegistrationBonus(db, canonicalId, 'telegram');

  let finalBalance = Number(sqlUser?.balance ?? legacyUser?.balance ?? 300);
  try {
    const balQuery = db.exec('SELECT balance FROM users WHERE id = ? LIMIT 1', [canonicalId]);
    if (balQuery[0]?.values?.[0]?.[0] !== undefined) {
      finalBalance = Number(balQuery[0].values[0][0]);
    }
  } catch {}

  try {
    if (legacyUser) {
      DB.updateUser(legacyUser.id, {
        telegramId: parsedTgId,
        passwordHash: finalPasswordHash,
        firstName: finalFirstName,
        lastName: finalLastName,
        ...(finalUsername ? { username: finalUsername } : {}),
        ...(finalPhotoUrl ? { photoUrl: finalPhotoUrl } : {}),
        ...(finalUserAvatar ? { userAvatar: finalUserAvatar } : {}),
        balance: finalBalance
      });
    }
  } catch {}

  // Ensure user is added to official @iismm_chat group and persist PostgreSQL database on disk
  await ensureUserJoinedIismmChat(canonicalId, { clearLeftStatus: true, db });
  saveDatabaseToDisk();
  savePgDB();

  // Send non-blocking confirmation message in Telegram
  const emailLabel = String(sqlUser?.email || legacyUser?.email || '').trim();
  fetchTelegramBotApi({
    primaryBase: tgConfig?.apiBaseUrl,
    proxyType: tgConfig?.proxyType,
    token: botToken,
    endpoint: 'sendMessage',
    buildInit: () => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: parsedTgId,
        text: `🎉 Ваш аккаунт Telegram успешно привязан к личному кабинету${emailLabel ? ` (${emailLabel})` : ''}!\n${
          bonusRes.applied ? '✨ На ваш баланс начислен бонус +300 Иирок.' : '✅ Профиль и аватар синхронизированы.'
        }`
      })
    }),
    timeoutMs: 6000
  }).catch(() => null);

  return {
    ok: true,
    status: 200,
    bonusApplied: bonusRes.applied,
    bonusAmount: bonusRes.applied ? 300 : 0,
    balance: finalBalance,
    telegramId: parsedTgId,
    username: finalUsername,
    firstName: finalFirstName,
    lastName: finalLastName,
    bio: finalBio,
    photoUrl: finalUserAvatar || finalPhotoUrl,
    message: bonusRes.applied
      ? 'Аккаунт Telegram проверен через бота, данные и фото загружены в галерею, начислено +300 Иирок!'
      : 'Аккаунт Telegram успешно проверен через бота и привязан к вашему личному кабинету!'
  };
}
