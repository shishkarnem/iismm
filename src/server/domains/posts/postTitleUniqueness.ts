import { DayRequest, Publication } from './postTypes';
import { getSyncPgDB, updateRow } from '../../db/postgres';
import { isNonDraftSystemPostRow } from './postStatusHelpers';

export function ensureUniquePostTitleHelper(
  candidateTitle: string,
  dayRequestsCache: DayRequest[],
  publicationsCache: Publication[],
  excludeId?: string
): string {
  const baseTitle = String(candidateTitle || '').trim() || 'Новый пост';
  const existingTitles = new Set<string>();

  const stripAnyPrefix = (raw: string) =>
    String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^(sched_|req_|pub_|pos_|p_|np_|imp_|post-)/, '');

  const rawExcludeLower = excludeId ? String(excludeId).trim().toLowerCase() : '';
  const normExclude = excludeId ? stripAnyPrefix(excludeId) : null;

  const isSamePostRecord = (recordId?: string, promptId?: string) => {
    if (!normExclude) return false;
    const rLower = String(recordId || '').trim().toLowerCase();
    const pLower = String(promptId || '').trim().toLowerCase();
    if (rLower === rawExcludeLower || (pLower && pLower === rawExcludeLower)) return true;
    if (stripAnyPrefix(rLower) === normExclude) return true;
    if (pLower && stripAnyPrefix(pLower) === normExclude) return true;
    if (
      rLower.startsWith(`sched_${rawExcludeLower}_`) ||
      rLower.startsWith(`sched_${normExclude}_`)
    ) {
      return true;
    }
    return false;
  };

  dayRequestsCache.forEach((r) => {
    if (isSamePostRecord(r.id)) return;
    if (r.title && r.title.trim() && !r.title.trim().startsWith('[Тест в личку')) {
      existingTitles.add(r.title.trim().toLowerCase());
    }
  });

  try {
    const pgDb = getSyncPgDB();
    if (pgDb) {
      const res = pgDb.exec('SELECT id, title, channel, author_name, status FROM posts');
      if (res && res[0] && res[0].values) {
        res[0].values.forEach((row: any[]) => {
          const pId = String(row[0] || '');
          const pTitle = String(row[1] || '').trim();
          const pChan = String(row[2] || '').trim();
          if (
            isNonDraftSystemPostRow({
              id: pId,
              title: pTitle,
              channel: pChan,
              author_name: row[3],
              status: row[4]
            })
          ) {
            return;
          }
          if (isSamePostRecord(pId)) return;
          if (pTitle) {
            existingTitles.add(pTitle.toLowerCase());
          }
        });
      }
    }
  } catch {}

  publicationsCache.forEach((p: any) => {
    const pubId = String(p.id || '');
    const pubChan = String(p.channel || '');
    if (
      pubId.startsWith('sched_') ||
      pubId.startsWith('pub_cron_') ||
      pubId.startsWith('pub_') ||
      pubChan.startsWith('DM:')
    ) {
      return;
    }
    if (isSamePostRecord(pubId, p.promptId)) return;
    if (p.promptTitle && p.promptTitle.trim() && !p.promptTitle.trim().startsWith('[Тест в личку')) {
      existingTitles.add(p.promptTitle.trim().toLowerCase());
    }
  });

  if (!existingTitles.has(baseTitle.toLowerCase())) {
    return baseTitle;
  }

  const match = baseTitle.match(/^(.*?)\s*\((\d+)\)$/);
  const cleanPrefix = match ? match[1].trim() : baseTitle;
  let counter = match ? parseInt(match[2], 10) + 1 : 2;

  while (existingTitles.has(`${cleanPrefix} (${counter})`.toLowerCase())) {
    counter++;
  }

  return `${cleanPrefix} (${counter})`;
}

export function deduplicateExistingPostTitlesHelper(dayRequestsCache: DayRequest[]): void {
  const seenTitles = new Map<string, number>();

  dayRequestsCache.forEach((req) => {
    const rawTitle = String(req.title || 'Пост без названия').trim();
    const lower = rawTitle.toLowerCase();
    if (seenTitles.has(lower)) {
      const count = (seenTitles.get(lower) || 1) + 1;
      seenTitles.set(lower, count);
      const match = rawTitle.match(/^(.*?)\s*\((\d+)\)$/);
      const base = match ? match[1].trim() : rawTitle;
      req.title = `${base} (${count})`;
      void updateRow('posts', req.id, { title: req.title }).catch(() => null);
    } else {
      seenTitles.set(lower, 1);
    }
  });

  try {
    const pgDb = getSyncPgDB();
    if (pgDb) {
      const res = pgDb.exec('SELECT id, title FROM posts ORDER BY created_at ASC');
      if (res && res[0] && res[0].values) {
        const pgSeen = new Map<string, number>();
        res[0].values.forEach((row: any[]) => {
          const pId = String(row[0]);
          const pTitle = String(row[1] || 'Пост').trim();
          const lower = pTitle.toLowerCase();
          if (pgSeen.has(lower)) {
            const count = (pgSeen.get(lower) || 1) + 1;
            pgSeen.set(lower, count);
            const match = pTitle.match(/^(.*?)\s*\((\d+)\)$/);
            const base = match ? match[1].trim() : pTitle;
            const newTitle = `${base} (${count})`;
            pgDb.run('UPDATE posts SET title = ? WHERE id = ?', [newTitle, pId]);
          } else {
            pgSeen.set(lower, 1);
          }
        });
      }
    }
  } catch (e) {
    console.warn('[PostDomain] Deduplication error in PostgreSQL:', e);
  }
}
