import { notifyPromoDeletionByOrganizer } from '../../promoArchiveApi';

export function parseTriggerScheduleSafe(raw: any): Record<string, any> {
  if (!raw) return { enabled: false };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : { enabled: false };
    } catch {
      return { enabled: false };
    }
  }
  return typeof raw === 'object' ? { ...raw } : { enabled: false };
}

export function isOneOffScheduleFrequency(frequency?: string | null): boolean {
  const f = String(frequency || '').toLowerCase().trim();
  return f === 'once' || f === 'exact_date';
}

export function getZonedPartsInTimezone(date: Date, timeZone: string = 'Europe/Moscow'): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  dayOfWeek: number;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      weekday: 'short'
    });
    const parts = formatter.formatToParts(date);
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth() + 1;
    let day = date.getUTCDate();
    let hours = date.getUTCHours();
    let minutes = date.getUTCMinutes();
    let weekdayStr = '';
    for (const p of parts) {
      if (p.type === 'year') year = Number(p.value);
      if (p.type === 'month') month = Number(p.value);
      if (p.type === 'day') day = Number(p.value);
      if (p.type === 'hour') hours = Number(p.value) % 24;
      if (p.type === 'minute') minutes = Number(p.value);
      if (p.type === 'weekday') weekdayStr = p.value.toLowerCase();
    }
    const dayMap: Record<string, number> = {
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
    };
    const dayOfWeek = dayMap[weekdayStr.slice(0, 3)] ?? date.getUTCDay();
    return { year, month, day, hours, minutes, dayOfWeek };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hours: date.getUTCHours(),
      minutes: date.getUTCMinutes(),
      dayOfWeek: date.getUTCDay()
    };
  }
}

export function parseScheduleDateTimeInTimezone(
  rawDateTime?: string | null,
  timeZone: string = 'Europe/Moscow'
): Date | null {
  if (!rawDateTime || typeof rawDateTime !== 'string') return null;
  const trimmed = rawDateTime.trim();
  if (!trimmed) return null;

  if (/(Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hours = Number(m[4]);
    const minutes = Number(m[5]);
    const seconds = Number(m[6] || 0);

    const pad = (n: number) => String(n).padStart(2, '0');
    const approxUtc = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}Z`);
    const zoned = getZonedPartsInTimezone(approxUtc, timeZone || 'Europe/Moscow');
    const targetMs = Date.UTC(year, month - 1, day, hours, minutes, seconds);
    const zonedMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hours, zoned.minutes, seconds);
    return new Date(approxUtc.getTime() + (targetMs - zonedMs));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveScheduledIsoFromSchedule(
  rawSchedule: any,
  fallbackIso?: string | null
): string | undefined {
  const sched = parseTriggerScheduleSafe(rawSchedule);
  if (!sched || !sched.enabled) {
    if (fallbackIso && typeof fallbackIso === 'string' && !fallbackIso.trim().startsWith('{')) {
      return fallbackIso;
    }
    return undefined;
  }

  const tz = String(sched.timezone || 'Europe/Moscow');
  if (sched.exactDateTime && isOneOffScheduleFrequency(sched.frequency)) {
    const dt = parseScheduleDateTimeInTimezone(String(sched.exactDateTime), tz);
    if (dt) return dt.toISOString();
  }

  if (sched.time && typeof sched.time === 'string') {
    const [hh, mm] = sched.time.split(':').map(Number);
    if (!Number.isNaN(hh)) {
      const now = new Date();
      const zonedNow = getZonedPartsInTimezone(now, tz);
      const pad = (n: number) => String(n).padStart(2, '0');
      let dt = parseScheduleDateTimeInTimezone(
        `${zonedNow.year}-${pad(zonedNow.month)}-${pad(zonedNow.day)}T${pad(hh)}:${pad(Number.isNaN(mm) ? 0 : mm)}`,
        tz
      );
      if (dt && dt.getTime() <= now.getTime()) {
        dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
      }
      if (dt) return dt.toISOString();
    }
  }

  if (fallbackIso && typeof fallbackIso === 'string' && !fallbackIso.trim().startsWith('{')) {
    return fallbackIso;
  }
  return undefined;
}

export function isPublishedPostStatus(rawStatus: any): boolean {
  const s = String(rawStatus || '').toLowerCase().trim();
  return (
    s === 'опубликован' ||
    s === 'опубликовано' ||
    s === 'отправлен' ||
    s === 'отправлено' ||
    s === 'published' ||
    s === 'sent' ||
    s === 'успешно'
  );
}

export function isScheduledPostStatus(rawStatus: any): boolean {
  const s = String(rawStatus || '').toLowerCase().trim();
  return (
    s === 'запланирован' ||
    s === 'запланировано' ||
    s === 'отложено' ||
    s === 'scheduled' ||
    s === 'pending'
  );
}

export function normalizePostStatus(
  rawStatus: any,
  opts?: { triggerSchedule?: any; publishedAt?: string | null }
): 'создается' | 'запланирован' | 'опубликован' | 'ошибка' | 'отменено' {
  const s = String(rawStatus || '').toLowerCase().trim();
  if (s === 'ошибка' || s === 'failed' || s === 'error') return 'ошибка';
  if (s === 'отменено' || s === 'cancelled' || s === 'paused') return 'отменено';
  if (isPublishedPostStatus(s)) return 'опубликован';

  const sched = parseTriggerScheduleSafe(opts?.triggerSchedule);
  if (isScheduledPostStatus(s) || sched.enabled === true) {
    return 'запланирован';
  }
  if (opts?.publishedAt && s !== 'создается' && s !== 'draft' && s !== 'черновик') {
    return 'опубликован';
  }
  return 'создается';
}

export function isNonDraftSystemPostRow(row: {
  id?: any;
  channel?: any;
  title?: any;
  author_name?: any;
  status?: any;
}): boolean {
  const rawId = String(row.id || '').trim();
  const rawChan = String(row.channel || '').trim();
  const rawTitle = String(row.title || '').trim();

  if (!rawId) return true;
  if (
    rawId.startsWith('sched_') ||
    rawId.startsWith('pub_cron_') ||
    rawId.startsWith('pub_') ||
    rawId.startsWith('blog_')
  ) {
    return true;
  }
  if (rawChan.startsWith('DM:') || rawTitle.startsWith('[Тест в личку')) {
    return true;
  }
  const hasAuthorName = Boolean(row.author_name && String(row.author_name).trim());
  const isNumericBlogId = /^\d{12,}$/.test(rawId);
  if ((hasAuthorName || isNumericBlogId) && isPublishedPostStatus(row.status)) {
    return true;
  }
  return false;
}

export function fetchPromoPublicationsFromPg(pgDb: any, userId?: string): any[] {
  const promoItems: any[] = [];
  if (!pgDb) return promoItems;
  try {
    const fQuery = userId
      ? `SELECT DISTINCT f.*, p.channel_name as user_channel_name, p.channel_username as user_channel_username
         FROM promo_folders f
         INNER JOIN promo_folder_participants p ON f.id = p.folder_id
         WHERE p.user_id = ? AND p.status IN ('accepted', 'confirmed', 'active')
         ORDER BY f.scheduled_at DESC`
      : `SELECT f.* FROM promo_folders f ORDER BY f.scheduled_at DESC`;
    const fRes = pgDb.exec(fQuery, userId ? [String(userId)] : []);
    if (fRes?.[0]?.values) {
      const fCols = fRes[0].columns;
      fRes[0].values.forEach((vArr: any[]) => {
        const fRow: any = {};
        fCols.forEach((c: string, idx: number) => { fRow[c] = vArr[idx]; });
        const isPub = fRow.status === 'published' || fRow.status === 'archived' || fRow.status === 'results';
        const chanDisplay = fRow.user_channel_username
          ? `@${fRow.user_channel_username.replace(/^@/, '')}`
          : fRow.user_channel_name || fRow.title;
        promoItems.push({
          id: `folder_${fRow.id}`,
          userId: fRow.author_id,
          promptId: `folder_${fRow.id}`,
          promptTitle: `📁 [Папка] ${fRow.title}`,
          category: 'Папки',
          text: fRow.post_text || '',
          channel: chanDisplay,
          status: isPub,
          statusType: isPub ? 'published' : 'scheduled',
          scheduledFor: fRow.scheduled_at,
          publishedAt: fRow.scheduled_at,
          attachmentType: fRow.image_url ? 'photo' : 'none',
          attachmentUrl: fRow.image_url || '',
          attachmentUrls: fRow.image_url ? [fRow.image_url] : [],
          messageFormat: fRow.message_format || 'rich'
        });
      });
    }
  } catch {}

  try {
    const sQuery = userId
      ? `SELECT DISTINCT s.*, sc.channel_name as user_channel_name, sc.channel_username as user_channel_username
         FROM promo_selections s
         INNER JOIN promo_selection_channels sc ON s.id = sc.selection_id
         WHERE sc.user_id = ? AND sc.status = 'active'
         ORDER BY s.scheduled_at DESC`
      : `SELECT s.* FROM promo_selections s ORDER BY s.scheduled_at DESC`;
    const sRes = pgDb.exec(sQuery, userId ? [String(userId)] : []);
    if (sRes?.[0]?.values) {
      const sCols = sRes[0].columns;
      sRes[0].values.forEach((vArr: any[]) => {
        const sRow: any = {};
        sCols.forEach((c: string, idx: number) => { sRow[c] = vArr[idx]; });
        const isPub = sRow.status === 'published' || sRow.status === 'archived' || sRow.status === 'results';
        const chanDisplay = sRow.user_channel_username
          ? `@${sRow.user_channel_username.replace(/^@/, '')}`
          : sRow.user_channel_name || sRow.title;
        promoItems.push({
          id: `sel_${sRow.id}`,
          userId: sRow.author_id,
          promptId: `sel_${sRow.id}`,
          promptTitle: `📚 [Подборка] ${sRow.header_title || sRow.title}`,
          category: 'Подборки',
          text: sRow.post_text || '',
          channel: chanDisplay,
          status: isPub,
          statusType: isPub ? 'published' : 'scheduled',
          scheduledFor: sRow.scheduled_at,
          publishedAt: sRow.scheduled_at,
          attachmentType: sRow.image_url ? 'photo' : 'none',
          attachmentUrl: sRow.image_url || '',
          attachmentUrls: sRow.image_url ? [sRow.image_url] : [],
          messageFormat: sRow.message_format || 'rich'
        });
      });
    }
  } catch {}
  return promoItems;
}

export function deletePromoFromPublicationPg(pgDb: any, cleanId: string, userId?: string): void {
  if (!pgDb) return;
  if (cleanId.startsWith('folder_')) {
    const folderId = cleanId.replace(/^folder_/, '');
    if (userId) {
      pgDb.run('DELETE FROM promo_folder_participants WHERE folder_id = ? AND user_id = ?', [folderId, String(userId)]);
    } else {
      try {
        const fStmt = pgDb.prepare('SELECT * FROM promo_folders WHERE id = ? LIMIT 1');
        fStmt.bind([folderId]);
        const folderObj = fStmt.step() ? fStmt.getAsObject() : null;
        fStmt.free();
        if (folderObj) {
          const pStmt = pgDb.prepare("SELECT * FROM promo_folder_participants WHERE folder_id = ? AND status IN ('accepted', 'pending', 'invited')");
          pStmt.bind([folderId]);
          const parts: any[] = [];
          while (pStmt.step()) parts.push(pStmt.getAsObject());
          pStmt.free();
          notifyPromoDeletionByOrganizer(pgDb, 'folder', folderObj, parts);
        }
      } catch {}
      pgDb.run('DELETE FROM promo_folder_participants WHERE folder_id = ?', [folderId]);
      pgDb.run('DELETE FROM promo_folders WHERE id = ?', [folderId]);
    }
  }
  if (cleanId.startsWith('sel_')) {
    const selId = cleanId.replace(/^sel_/, '');
    if (userId) {
      pgDb.run('DELETE FROM promo_selection_channels WHERE selection_id = ? AND user_id = ?', [selId, String(userId)]);
    } else {
      try {
        const sStmt = pgDb.prepare('SELECT * FROM promo_selections WHERE id = ? LIMIT 1');
        sStmt.bind([selId]);
        const selObj = sStmt.step() ? sStmt.getAsObject() : null;
        sStmt.free();
        if (selObj) {
          const cStmt = pgDb.prepare("SELECT * FROM promo_selection_channels WHERE selection_id = ? AND status IN ('active', 'pending', 'invited')");
          cStmt.bind([selId]);
          const chans: any[] = [];
          while (cStmt.step()) chans.push(cStmt.getAsObject());
          cStmt.free();
          notifyPromoDeletionByOrganizer(pgDb, 'selection', selObj, chans);
        }
      } catch {}
      pgDb.run('DELETE FROM promo_selection_channels WHERE selection_id = ?', [selId]);
      pgDb.run('DELETE FROM promo_selections WHERE id = ?', [selId]);
    }
  }
}

