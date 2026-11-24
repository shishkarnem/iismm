import { fetchAllChannelsFromPg, getSyncPgDB, normalizeUserId, savePgDB } from '../db/postgres';
import { getTeamsByOwnerOrMember } from '../db/teamsTable';
import { resolveUserTariffInDb, ServerTariffLevel } from '../tariffs/tariffAccess';
import type { Channel } from '../db';

function normalizeChannelLookupKey(raw: string | undefined | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^-?\d+$/.test(s)) return s;
  return `@${s.replace(/^@+/, '').toLowerCase()}`;
}

export function isLegacyDefaultPlaceholderChannel(raw: string | undefined | null): boolean {
  const clean = String(raw || '').trim().replace(/^@+/, '').toLowerCase();
  return clean === 'sav_ai' || clean === 'iirkibot';
}

function mapPgRowToChannel(row: Record<string, any>): Channel {
  return {
    id: String(row.id),
    userId: normalizeUserId(row.user_id || ''),
    name: row.name || 'Telegram канал',
    username: row.username || '',
    telegramId: row.telegram_id ? String(row.telegram_id) : '',
    isActive: row.is_active === 1 || row.is_active === true,
    subscribersCount: Number(row.subscribers_count || 0),
    inviteLink: row.invite_link || '',
    description: row.description || '',
    photoUrl: row.photo_url || row.photoUrl || '',
    status: row.is_active === 1 || row.is_active === true ? 'connected' : 'disconnected'
  };
}

/**
 * Returns ONLY channels explicitly owned by the user in PostgreSQL `channels` table,
 * PLUS channels belonging to the user's active team IF the user's tariff or the team
 * owner's tariff supports team collaboration (Отрыв / Космос).
 * Never returns unowned default channels like @SAV_AI or @IIrkiBot.
 */
export function getUserAllowedChannelsFromDb(rawUserId?: string): Channel[] {
  const pgRows = fetchAllChannelsFromPg() || [];
  if (pgRows.length === 0) return [];

  const allDbChannels = pgRows.map(mapPgRowToChannel);
  if (!rawUserId || !String(rawUserId).trim()) {
    return allDbChannels;
  }

  const canonicalUserId = normalizeUserId(rawUserId);
  const allowedOwnerIds = new Set<string>([canonicalUserId]);
  if (canonicalUserId === '16926299042') {
    allowedOwnerIds.add('169262990');
  }
  const rawTrimmed = String(rawUserId).trim();
  if (rawTrimmed) {
    allowedOwnerIds.add(rawTrimmed);
  }

  const extraExplicitChannelKeys = new Set<string>();
  const pgDb = getSyncPgDB();

  if (pgDb) {
    try {
      const userTariff = resolveUserTariffInDb(pgDb, canonicalUserId);
      const userTeams = getTeamsByOwnerOrMember(pgDb, canonicalUserId);

      for (const team of userTeams) {
        const ownerTariff = resolveUserTariffInDb(pgDb, team.ownerId);
        const teamTariffSupported =
          userTariff.level >= ServerTariffLevel.Otryv ||
          ownerTariff.level >= ServerTariffLevel.Otryv;

        if (!teamTariffSupported) continue;

        if (team.ownerId) {
          const normOwner = normalizeUserId(team.ownerId);
          allowedOwnerIds.add(normOwner);
          if (normOwner === '16926299042') allowedOwnerIds.add('169262990');
        }

        if (Array.isArray(team.members)) {
          for (const m of team.members as Array<any>) {
            const mId = typeof m === 'string' ? m : m?.userId || m?.telegramId;
            if (mId) {
              const normM = normalizeUserId(String(mId));
              allowedOwnerIds.add(normM);
              if (normM === '16926299042') allowedOwnerIds.add('169262990');
            }
          }
        }

        if (Array.isArray(team.channels)) {
          for (const ch of team.channels as Array<any>) {
            const chKey = normalizeChannelLookupKey(
              typeof ch === 'string' ? ch : ch?.username || ch?.telegramId || ch?.id
            );
            if (chKey && !isLegacyDefaultPlaceholderChannel(chKey)) {
              extraExplicitChannelKeys.add(chKey);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Channels] Failed checking team channels:', err);
    }
  }

  const seenIds = new Set<string>();
  const result: Channel[] = [];

  for (const ch of allDbChannels) {
    const chOwnerNorm = normalizeUserId(ch.userId || '');
    const chUsernameKey = normalizeChannelLookupKey(ch.username);
    const chTgIdKey = normalizeChannelLookupKey(ch.telegramId);
    const isOwnedOrTeamMember =
      allowedOwnerIds.has(chOwnerNorm) ||
      (ch.userId ? allowedOwnerIds.has(String(ch.userId)) : false) ||
      (chUsernameKey && extraExplicitChannelKeys.has(chUsernameKey)) ||
      (chTgIdKey && extraExplicitChannelKeys.has(chTgIdKey));

    if (isOwnedOrTeamMember && !seenIds.has(ch.id)) {
      seenIds.add(ch.id);
      result.push(ch);
    }
  }

  return result;
}

/**
 * Filters a draft/post's channel list against the user's allowed channels.
 * Removes default @SAV_AI / @IIrkiBot unless that channel actually exists in the user's DB channels.
 */
export function filterDraftChannelsToAllowed(
  rawChannels: string[] | undefined,
  rawSingleChannel: string | undefined,
  allowedChannels: Channel[]
): string[] {
  const allowedLookup = new Map<string, string>();
  for (const ch of allowedChannels) {
    const preferredValue = ch.username || (ch.telegramId ? String(ch.telegramId) : ch.id);
    if (!preferredValue) continue;
    const uKey = normalizeChannelLookupKey(ch.username);
    const tKey = normalizeChannelLookupKey(ch.telegramId);
    const idKey = normalizeChannelLookupKey(ch.id);
    if (uKey) allowedLookup.set(uKey, preferredValue);
    if (tKey) allowedLookup.set(tKey, preferredValue);
    if (idKey) allowedLookup.set(idKey, preferredValue);
  }

  const candidates: string[] = [];
  if (Array.isArray(rawChannels)) {
    for (const c of rawChannels) {
      if (typeof c === 'string' && c.trim()) candidates.push(c.trim());
    }
  }
  if (candidates.length === 0 && rawSingleChannel && rawSingleChannel.trim()) {
    candidates.push(rawSingleChannel.trim());
  }

  const resolved: string[] = [];
  for (const cand of candidates) {
    const key = normalizeChannelLookupKey(cand);
    const matched = key ? allowedLookup.get(key) : undefined;
    if (matched && !resolved.includes(matched)) {
      resolved.push(matched);
    }
  }

  return resolved;
}

let didCleanupLegacySavAi = false;

/**
 * Cleans up legacy default @SAV_AI / @IIrkiBot placeholders in PostgreSQL `posts` table
 * for users who do not own @SAV_AI in `channels` table, and persists to disk.
 */
export function cleanupUnownedDefaultChannelsInPosts(): void {
  if (didCleanupLegacySavAi) return;
  didCleanupLegacySavAi = true;

  try {
    const db = getSyncPgDB();
    if (!db) return;

    const res = db.exec('SELECT id, user_id, channel, channels FROM posts');
    if (!res || !res[0] || !res[0].values) return;

    let changed = false;
    for (const row of res[0].values) {
      const postId = String(row[0] || '');
      const postUserId = String(row[1] || '16926299042');
      const rawChannel = String(row[2] || '').trim();
      const rawChannelsJson = String(row[3] || '').trim();

      if (!postId || postId.startsWith('sched_') || rawChannel.startsWith('DM:')) continue;

      let parsedList: string[] = [];
      if (rawChannelsJson) {
        try {
          const p = JSON.parse(rawChannelsJson);
          if (Array.isArray(p)) parsedList = p.map(String);
        } catch {
          parsedList = [rawChannelsJson];
        }
      }

      const hasPlaceholder =
        isLegacyDefaultPlaceholderChannel(rawChannel) ||
        parsedList.some((c) => isLegacyDefaultPlaceholderChannel(c));

      if (!hasPlaceholder) continue;

      const allowed = getUserAllowedChannelsFromDb(postUserId);
      const cleanedList = filterDraftChannelsToAllowed(parsedList, rawChannel, allowed);
      const nextPrimary = cleanedList[0] || '';
      const nextJson = JSON.stringify(cleanedList);

      if (nextPrimary !== rawChannel || nextJson !== rawChannelsJson) {
        db.run('UPDATE posts SET channel = ?, channels = ? WHERE id = ?', [
          nextPrimary,
          nextJson,
          postId
        ]);
        changed = true;
      }
    }

    if (changed) {
      savePgDB();
    }
  } catch (err) {
    console.warn('[Channels] Failed cleaning legacy @SAV_AI in posts:', err);
  }
}
