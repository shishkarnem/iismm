import { getPgDB, normalizeUserId, savePgDB } from '../db/postgres';
import { BRAND_ASSETS } from '../../constants/proTalkStorage';

export const OFFICIAL_IISMM_GROUP_ID = 'group-smm';
export const OFFICIAL_IISMM_GROUP_HANDLE = '@iismm_chat';

/**
 * Автоматически добавляет пользователя при регистрации (или привязке аккаунта)
 * в официальную группу соцсети @iismm_chat (group-smm) и фиксирует базу на диске.
 */
export async function ensureUserJoinedIismmChat(
  rawUserId: string | number | undefined | null,
  options?: { clearLeftStatus?: boolean; db?: any }
): Promise<void> {
  if (!rawUserId) return;
  const normId = normalizeUserId(rawUserId);
  if (!normId) return;

  try {
    const db = options?.db || (await getPgDB());
    if (!db) return;

    if (options?.clearLeftStatus !== false) {
      try {
        db.run(
          "DELETE FROM left_groups WHERE user_id = ? AND group_id IN ('group-smm', 'group-iismm', 'gr_iismm_chat')",
          [normId]
        );
      } catch {}
    }

    const grRes = db.exec(
      "SELECT id, members_json, admins_json FROM group_chats WHERE id = 'group-smm' LIMIT 1"
    );

    if (!grRes[0]?.values || grRes[0].values.length === 0) {
      const initialMembers = Array.from(new Set(['16926299042', normId]));
      db.run(
        `INSERT INTO group_chats (
          id, title, description, avatar_url, creator_id, admins_json, members_json, is_default, created_at, updated_at
        ) VALUES (
          'group-smm',
          'ИИSMM',
          'Официальная группа сообщества платформы @iismm_chat',
          ?,
          '16926299042',
          ?,
          ?,
          1,
          datetime('now'),
          datetime('now')
        )`,
        [BRAND_ASSETS.logo, JSON.stringify(['16926299042']), JSON.stringify(initialMembers)]
      );
      savePgDB();
      return;
    }

    let members: string[] = [];
    try {
      members = JSON.parse(String(grRes[0].values[0][1] || '[]'));
      if (!Array.isArray(members)) members = [];
    } catch {
      members = [];
    }

    const normalizedSet = new Set(members.map((m) => normalizeUserId(m)).filter(Boolean));
    normalizedSet.add('16926299042');

    if (!normalizedSet.has(normId)) {
      normalizedSet.add(normId);
      db.run(
        `UPDATE group_chats
         SET members_json = ?,
             title = 'ИИSMM',
             is_default = 1,
             updated_at = datetime('now')
         WHERE id = 'group-smm'`,
        [JSON.stringify(Array.from(normalizedSet))]
      );
      savePgDB();
    }
  } catch (err) {
    console.warn('[AutoJoin @iismm_chat] Warning:', err);
  }
}
