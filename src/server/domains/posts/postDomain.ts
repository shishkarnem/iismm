import { DayRequest, Publication, buildDayRequestSqlFields, detectMessageFormat } from './postTypes';
import {
  fetchAllPostsFromPg,
  getSyncPgDB,
  insertRow,
  updateRow,
  deleteRow,
  savePgDB,
  normalizeUserId
} from '../../db/postgres';
import { syncPostCronTask } from '../../repos/blogPostsRepo';
import {
  cleanupUnownedDefaultChannelsInPosts,
  filterDraftChannelsToAllowed,
  getUserAllowedChannelsFromDb
} from '../../channels/userAllowedChannels';
import { Channel } from '../channels/channelTypes';
import {
  deletePromoFromPublicationPg,
  fetchPromoPublicationsFromPg,
  isNonDraftSystemPostRow,
  isPublishedPostStatus,
  normalizePostStatus,
  parseTriggerScheduleSafe,
  resolveScheduledIsoFromSchedule
} from './postStatusHelpers';
import {
  deduplicateExistingPostTitlesHelper,
  ensureUniquePostTitleHelper
} from './postTitleUniqueness';

let dayRequestsCache: DayRequest[] = [];
let publicationsCache: Publication[] = [];

export function getDefaultChannelIdentifier(): string {
  try {
    const db = getSyncPgDB();
    if (db) {
      const res = db.exec(
        "SELECT username, telegram_id, id FROM channels WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1;"
      );
      if (res && res[0] && res[0].values && res[0].values.length > 0) {
        const row = res[0].values[0];
        const username = row[0] ? String(row[0]).trim() : '';
        const tgId = row[1] ? String(row[1]).trim() : '';
        const id = row[2] ? String(row[2]).trim() : '';
        if (username) return username.startsWith('@') ? username : `@${username}`;
        if (tgId) return tgId;
        if (id) return id;
      }
    }
  } catch (e) {
    console.warn('[PostDomain] Error resolving default channel from PostgreSQL:', e);
  }
  return '';
}

export class PostDomain {
  public static getCachedDayRequests(): DayRequest[] {
    return dayRequestsCache;
  }

  public static setCachedDayRequests(requests: DayRequest[]): void {
    dayRequestsCache = requests;
  }

  public static getCachedPublications(): Publication[] {
    return publicationsCache;
  }

  public static setCachedPublications(pubs: Publication[]): void {
    publicationsCache = pubs;
  }

  public static getDayRequests(userId?: string): DayRequest[] {
    const pgRows = fetchAllPostsFromPg();
    if (pgRows && pgRows.length > 0) {
      const normUser = userId ? normalizeUserId(userId) : '';
      let filteredRows = pgRows.filter((row) => !isNonDraftSystemPostRow(row));

      if (normUser) {
        filteredRows = filteredRows.filter((row) => {
          const rowUser = row.user_id ? normalizeUserId(row.user_id) : '';
          return !rowUser || rowUser === normUser || rowUser === '16926299042';
        });
      }

      const seenIds = new Set<string>();
      filteredRows = filteredRows.filter((row) => {
        const cid = String(row.id || '').trim();
        if (seenIds.has(cid)) return false;
        seenIds.add(cid);
        return true;
      });

      cleanupUnownedDefaultChannelsInPosts();
      const allowedForUserCache = new Map<string, Channel[]>();
      const getAllowedCached = (uid: string) => {
        if (!allowedForUserCache.has(uid)) {
          allowedForUserCache.set(uid, getUserAllowedChannelsFromDb(uid) as Channel[]);
        }
        return allowedForUserCache.get(uid) || [];
      };

      const mapped = filteredRows.map((row) => {
        const ownerUid = row.user_id ? normalizeUserId(row.user_id) : (normUser || '16926299042');
        return this.mapSinglePgRowToDayRequest(row, ownerUid, getAllowedCached(ownerUid));
      });

      mapped.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (!Number.isNaN(tb) && !Number.isNaN(ta) && tb !== ta) return tb - ta;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      // Preserve freshly created local drafts if cloud refresh hasn't landed yet
      const mappedIds = new Set(mapped.map((m) => m.id));
      const nowMs = Date.now();
      for (const cachedItem of dayRequestsCache) {
        if (!cachedItem?.id || mappedIds.has(cachedItem.id)) continue;
        const createdMs = cachedItem.createdAt ? new Date(cachedItem.createdAt).getTime() : 0;
        if (nowMs - createdMs < 60000) {
          if (normUser && cachedItem.userId && normalizeUserId(cachedItem.userId) !== normUser && normalizeUserId(cachedItem.userId) !== '16926299042') {
            continue;
          }
          mapped.unshift(cachedItem);
          mappedIds.add(cachedItem.id);
        }
      }

      dayRequestsCache = mapped;
      return mapped;
    }

    let allPosts = dayRequestsCache;
    if (userId) {
      const normUser = normalizeUserId(userId);
      allPosts = allPosts.filter(
        (p) =>
          !p.userId ||
          normalizeUserId(p.userId) === normUser ||
          normalizeUserId(p.userId) === '16926299042'
      );
    }
    return [...allPosts].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (!Number.isNaN(tb) && !Number.isNaN(ta) && tb !== ta) return tb - ta;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  private static mapSinglePgRowToDayRequest(
    row: Record<string, any>,
    ownerUid: string,
    allowedChannels: Channel[]
  ): DayRequest {
    let rawChannels: string[] = [];
    if (row.channels) {
      try {
        const parsed = typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels;
        if (Array.isArray(parsed) && parsed.length > 0) rawChannels = parsed;
      } catch {
        if (typeof row.channels === 'string' && row.channels.trim()) rawChannels = [row.channels.trim()];
      }
    } else if (row.channel && String(row.channel).trim()) {
      rawChannels = [String(row.channel).trim()];
    }

    const channels = filterDraftChannelsToAllowed(
      rawChannels,
      row.channel ? String(row.channel) : '',
      allowedChannels
    );

    let attachmentUrls: string[] = [];
    if (row.attachment_urls) {
      try {
        const parsed =
          typeof row.attachment_urls === 'string'
            ? JSON.parse(row.attachment_urls)
            : row.attachment_urls;
        if (Array.isArray(parsed)) attachmentUrls = parsed;
      } catch {
        attachmentUrls = [];
      }
    }

    const triggerSchedule = parseTriggerScheduleSafe(row.trigger_schedule);
    const publishToSocialFeed =
      triggerSchedule.publishToSocialFeed !== undefined
        ? Boolean(triggerSchedule.publishToSocialFeed)
        : true;
    const resolvedStatus = normalizePostStatus(row.status, {
      triggerSchedule,
      publishedAt: row.published_at || null
    });
    const resolvedSchedTime = resolveScheduledIsoFromSchedule(triggerSchedule);

    let inlineButtons: any[] = [];
    if (row.inline_buttons_json) {
      try {
        const parsed =
          typeof row.inline_buttons_json === 'string'
            ? JSON.parse(row.inline_buttons_json)
            : row.inline_buttons_json;
        if (Array.isArray(parsed)) inlineButtons = parsed;
      } catch {}
    }

    return {
      id: String(row.id || ''),
      userId: ownerUid,
      title: row.title || 'Новый пост без названия',
      category: row.category || 'общее',
      dayOfWeek: row.day_of_week || '',
      requestTemplate: row.request_template || row.desc || '',
      postText: row.post_text || row.content || '',
      channel: channels[0] || '',
      channels,
      signature: row.signature !== null && row.signature !== undefined ? String(row.signature) : '',
      messageFormat: row.message_format || 'v2',
      uppercaseHeader: row.uppercase_header !== 0 && row.uppercase_header !== false,
      attachmentType: row.attachment_type || 'none',
      attachmentUrl: row.attachment_url || row.image_url || '',
      attachmentUrls,
      audioFormat: row.audio_format || 'audio',
      audioTitle: row.audio_title || '',
      audioPerformer: row.audio_performer || '',
      protectContent: Boolean(row.protect_content),
      linkPreviewEnabled: row.link_preview_enabled !== 0 && row.link_preview_enabled !== false,
      publishToSocialFeed,
      inlineButtons,
      uniquenessMemoryCount: 0,
      triggerSchedule: triggerSchedule as any,
      scheduledTime: resolvedSchedTime,
      status: resolvedStatus,
      createdAt: row.created_at || new Date().toISOString(),
      publishedAt: row.published_at || null
    } as DayRequest;
  }

  public static getDayRequestById(id: string, userId?: string): DayRequest | undefined {
    const cleanId = String(id || '').trim();
    if (!cleanId) return undefined;
    const mappedReqId = cleanId.startsWith('blog_') ? `req_${cleanId.slice(5)}` : cleanId;
    const all = this.getDayRequests(userId);
    const found = all.find((p) => {
      const pid = String(p.id || '').trim();
      return pid === cleanId || pid === mappedReqId;
    });
    if (found) return found;
    const globalFound = this.getDayRequests().find((p) => {
      const pid = String(p.id || '').trim();
      return pid === cleanId || pid === mappedReqId;
    });
    if (globalFound) return globalFound;

    try {
      const pgDb = getSyncPgDB();
      if (pgDb) {
        const res = pgDb.exec(
          `SELECT * FROM posts WHERE id = ? OR id = ? OR slug = ? LIMIT 1`,
          [cleanId, mappedReqId, cleanId]
        );
        const vals = res?.[0]?.values?.[0];
        const cols = res?.[0]?.columns;
        if (vals && cols) {
          const row: any = {};
          cols.forEach((c: string, idx: number) => {
            row[c] = vals[idx];
          });
          if (!String(row.id || '').startsWith('sched_')) {
            const ownerUid = row.user_id
              ? normalizeUserId(row.user_id)
              : userId
              ? normalizeUserId(userId)
              : '16926299042';
            return this.mapSinglePgRowToDayRequest(
              row,
              ownerUid,
              getUserAllowedChannelsFromDb(ownerUid) as Channel[]
            );
          }
        }
      }
    } catch {}
    return undefined;
  }

  public static buildPgPostRow(newReq: DayRequest): Record<string, any> {
    const effectiveUserId = normalizeUserId(newReq.userId || '16926299042');
    const cleanedChannels = Array.isArray(newReq.channels)
      ? newReq.channels
      : newReq.channel
      ? [newReq.channel]
      : [];
    const primaryChannel = cleanedChannels[0] || newReq.channel || '';

    const schedulePayload = {
      ...parseTriggerScheduleSafe(newReq.triggerSchedule),
      ...(newReq.publishToSocialFeed !== undefined
        ? { publishToSocialFeed: Boolean(newReq.publishToSocialFeed) }
        : {})
    };
    const resolvedStatus = normalizePostStatus(newReq.status, {
      triggerSchedule: schedulePayload,
      publishedAt: newReq.publishedAt || null
    });

    return {
      id: newReq.id,
      user_id: effectiveUserId,
      title: newReq.title || 'Новый пост без названия',
      category: newReq.category || 'общее',
      request_template: newReq.requestTemplate || '',
      post_text: newReq.postText || '',
      channel: primaryChannel,
      channels: JSON.stringify(cleanedChannels),
      message_format: newReq.messageFormat || 'v2',
      signature: newReq.signature || '',
      attachment_type: newReq.attachmentType || 'none',
      attachment_url: newReq.attachmentUrl || '',
      attachment_urls: newReq.attachmentUrls ? JSON.stringify(newReq.attachmentUrls) : '[]',
      audio_format: (newReq as any).audioFormat || 'audio',
      audio_title: (newReq as any).audioTitle || '',
      audio_performer: (newReq as any).audioPerformer || '',
      protect_content: (newReq as any).protectContent ? 1 : 0,
      link_preview_enabled: newReq.linkPreviewEnabled === false ? 0 : 1,
      inline_buttons_json: newReq.inlineButtons ? JSON.stringify(newReq.inlineButtons) : '[]',
      status: resolvedStatus,
      trigger_schedule: JSON.stringify(schedulePayload),
      published_at: newReq.publishedAt !== undefined ? newReq.publishedAt : null,
      created_at: newReq.createdAt || new Date().toISOString()
    };
  }

  public static addDayRequest(req: any, options?: { skipPgInsert?: boolean }): DayRequest {
    const incomingId = req?.id ? String(req.id).trim() : '';
    if (incomingId) {
      const existsInMem = dayRequestsCache.some((r) => String(r.id || '').trim() === incomingId);
      let existsInSql = false;
      try {
        const pgDb = getSyncPgDB();
        if (pgDb) {
          const res = pgDb.exec('SELECT id FROM posts WHERE id = ? LIMIT 1', [incomingId]);
          existsInSql = Boolean(res[0]?.values?.length);
        }
      } catch (e) {}

      if (existsInMem || existsInSql) {
        return this.updateDayRequest(incomingId, req);
      }
    }

    const effectiveUserId = normalizeUserId(req.userId || '16926299042');
    const assignedId = incomingId || 'req_' + Math.random().toString(36).substring(2, 10);
    const rawTitle = req.title || 'Новый пост без названия';
    const uniqueTitle = this.ensureUniquePostTitle(rawTitle, assignedId);
    const allowedUserChannels = getUserAllowedChannelsFromDb(effectiveUserId) as Channel[];
    const cleanedChannels = filterDraftChannelsToAllowed(
      Array.isArray(req.channels) ? req.channels : undefined,
      req.channel,
      allowedUserChannels
    );
    const primaryChannel = cleanedChannels[0] || '';
    const createdAtIso = req.createdAt || new Date().toISOString();
    const publishToSocialFeed =
      req.publishToSocialFeed !== undefined
        ? Boolean(req.publishToSocialFeed)
        : req.triggerSchedule?.publishToSocialFeed !== undefined
        ? Boolean(req.triggerSchedule.publishToSocialFeed)
        : true;
    const triggerSchedule = {
      ...parseTriggerScheduleSafe(req.triggerSchedule),
      publishToSocialFeed
    };
    const resolvedStatus = normalizePostStatus(req.status, {
      triggerSchedule,
      publishedAt: req.publishedAt || null
    });

    const newReq: DayRequest = {
      category: req.category || 'общее',
      requestTemplate: req.requestTemplate || '',
      signature: req.signature || '',
      userId: effectiveUserId,
      ...req,
      publishToSocialFeed,
      triggerSchedule,
      scheduledTime: resolveScheduledIsoFromSchedule(triggerSchedule),
      status: resolvedStatus,
      channel: primaryChannel,
      channels: cleanedChannels,
      id: assignedId,
      title: uniqueTitle,
      createdAt: createdAtIso
    };

    dayRequestsCache.unshift(newReq);

    if (!options?.skipPgInsert) {
      void insertRow('posts', this.buildPgPostRow(newReq)).catch(() => null);
    }

    syncPostCronTask(newReq.id, newReq, effectiveUserId);

    return newReq;
  }

  public static async addDayRequestAsync(req: any): Promise<DayRequest> {
    const incomingId = req?.id ? String(req.id).trim() : '';
    if (incomingId) {
      const existsInMem = dayRequestsCache.some((r) => String(r.id || '').trim() === incomingId);
      let existsInSql = false;
      try {
        const pgDb = getSyncPgDB();
        if (pgDb) {
          const res = pgDb.exec('SELECT id FROM posts WHERE id = ? LIMIT 1', [incomingId]);
          existsInSql = Boolean(res[0]?.values?.length);
        }
      } catch {}
      if (existsInMem || existsInSql) {
        return await this.updateDayRequestAsync(incomingId, req);
      }
    }
    const created = this.addDayRequest(req, { skipPgInsert: true });
    await insertRow('posts', this.buildPgPostRow(created)).catch(() => null);
    return created;
  }

  public static updateDayRequest(
    id: string,
    updated: Partial<DayRequest>,
    options?: { skipPgUpdate?: boolean }
  ): DayRequest {
    const { resultReq, sqlFields } = this.applyDayRequestMemoryUpdate(id, updated);
    if (!options?.skipPgUpdate) {
      void updateRow('posts', resultReq.id, sqlFields).catch(() => null);
    }
    syncPostCronTask(resultReq.id, resultReq, resultReq.userId);
    return resultReq;
  }

  public static async updateDayRequestAsync(id: string, updated: Partial<DayRequest>): Promise<DayRequest> {
    const { resultReq, sqlFields } = this.applyDayRequestMemoryUpdate(id, updated);
    await updateRow('posts', resultReq.id, sqlFields).catch(() => null);
    syncPostCronTask(resultReq.id, resultReq, resultReq.userId);
    return resultReq;
  }

  private static applyDayRequestMemoryUpdate(
    id: string,
    updated: Partial<DayRequest>
  ): { resultReq: DayRequest; sqlFields: Record<string, any> } {
    const cleanId = String(id || '').trim();
    const strippedId = cleanId.replace(/^(req_|pub_|pos_|p_|np_|imp_|post-)/, '');

    let existingSqlTitle = '';
    let existingSqlId = '';
    try {
      const pgDb = getSyncPgDB();
      if (pgDb) {
        const res = pgDb.exec('SELECT id, title FROM posts WHERE id = ? OR id = ? LIMIT 1', [
          cleanId,
          'req_' + strippedId
        ]);
        if (res[0]?.values?.[0]) {
          existingSqlId = String(res[0].values[0][0] || '');
          existingSqlTitle = String(res[0].values[0][1] || '').trim();
        }
      }
    } catch (e) {}

    const index = dayRequestsCache.findIndex((r) => {
      const rid = String(r.id || '').trim();
      return (
        rid === cleanId ||
        rid === existingSqlId ||
        rid === strippedId ||
        'req_' + rid === cleanId ||
        rid.replace(/^(req_|pub_|pos_|p_|np_|imp_|post-)/, '') === strippedId
      );
    });

    const currentTitle = (
      existingSqlTitle ||
      (index !== -1 ? String(dayRequestsCache[index].title || '').trim() : '')
    ).trim();

    if (updated.title && updated.title.trim()) {
      const candidate = updated.title.trim();
      if (currentTitle && currentTitle.toLowerCase() === candidate.toLowerCase()) {
        updated.title = candidate;
      } else {
        updated.title = this.ensureUniquePostTitle(candidate, existingSqlId || cleanId);
      }
    }

    let resultReq: DayRequest;
    if (index !== -1) {
      dayRequestsCache[index] = { ...dayRequestsCache[index], ...updated, id: existingSqlId || dayRequestsCache[index].id };
      resultReq = dayRequestsCache[index];
    } else {
      const newReq: DayRequest = {
        dayOfWeek: updated.dayOfWeek || 'Сегодня',
        category: updated.category || 'Общее',
        requestTemplate: updated.requestTemplate !== undefined ? updated.requestTemplate : '',
        channel: updated.channel || '',
        title: updated.title || currentTitle || 'Новый пост',
        signature: updated.signature || '',
        ...updated,
        id: existingSqlId || cleanId
      };
      dayRequestsCache.push(newReq);
      resultReq = newReq;
    }

    if (updated.publishToSocialFeed !== undefined || updated.triggerSchedule !== undefined) {
      const mergedSched = {
        ...parseTriggerScheduleSafe(resultReq.triggerSchedule),
        ...(resultReq.publishToSocialFeed !== undefined
          ? { publishToSocialFeed: Boolean(resultReq.publishToSocialFeed) }
          : {})
      };
      resultReq.triggerSchedule = mergedSched as any;
      resultReq.publishToSocialFeed =
        mergedSched.publishToSocialFeed !== undefined ? Boolean(mergedSched.publishToSocialFeed) : true;
    }

    // Reconcile status cleanly when schedule or publication changes
    if (updated.status !== undefined || updated.triggerSchedule !== undefined || updated.publishedAt !== undefined) {
      const explicitPublished = updated.status && isPublishedPostStatus(updated.status);
      const explicitFailedOrCancelled =
        updated.status && ['ошибка', 'failed', 'error', 'отменено', 'cancelled'].includes(String(updated.status).toLowerCase().trim());

      if (explicitPublished) {
        resultReq.status = 'опубликован';
      } else if (explicitFailedOrCancelled) {
        resultReq.status = updated.status;
      } else if (resultReq.triggerSchedule?.enabled) {
        resultReq.status = 'запланирован';
      } else {
        resultReq.status = normalizePostStatus(updated.status ?? resultReq.status, {
          triggerSchedule: resultReq.triggerSchedule,
          publishedAt: resultReq.publishedAt
        });
      }
      resultReq.scheduledTime = resolveScheduledIsoFromSchedule(resultReq.triggerSchedule);
    }

    if (updated.channels !== undefined || updated.channel !== undefined) {
      const ownerForFilter = resultReq.userId ? normalizeUserId(resultReq.userId) : '16926299042';
      const allowedList = getUserAllowedChannelsFromDb(ownerForFilter) as Channel[];
      const validChs = filterDraftChannelsToAllowed(
        Array.isArray(resultReq.channels) ? resultReq.channels : undefined,
        resultReq.channel,
        allowedList
      );
      resultReq.channels = validChs;
      resultReq.channel = validChs[0] || '';
    }

    return { resultReq, sqlFields: buildDayRequestSqlFields(resultReq) };
  }

  public static deleteDayRequest(id: string): void {
    const cleanId = String(id || '').trim();
    const strippedId = cleanId.replace(/^req_/, '');

    void deleteRow('posts', cleanId).catch(() => null);
    void deleteRow('prompts', cleanId).catch(() => null);

    try {
      const pgDb = getSyncPgDB();
      if (pgDb) {
        pgDb.run('DELETE FROM posts WHERE id = ? OR id = ?', [cleanId, strippedId]);
      }
    } catch (e) {}

    dayRequestsCache = dayRequestsCache.filter((r) => {
      const rid = String(r.id || '').trim();
      return (
        rid !== cleanId &&
        rid !== strippedId &&
        'req_' + rid !== cleanId &&
        rid.replace(/^req_/, '') !== strippedId
      );
    });

    publicationsCache = publicationsCache.filter((pub) => {
      const pbid = String(pub.id || '').trim();
      return (
        pbid !== cleanId &&
        pbid !== strippedId &&
        'pub_' + pbid !== cleanId &&
        pbid.replace(/^pub_/, '') !== strippedId
      );
    });
  }

  public static deletePostOrPublication(id: string): void {
    const cleanId = String(id || '').trim();
    const strippedPost = cleanId.replace(/^post-/, '');
    const strippedReq = cleanId.replace(/^req_/, '');
    const strippedPub = cleanId.replace(/^pub_/, '');

    this.deleteDayRequest(cleanId);
    if (strippedPost !== cleanId) this.deleteDayRequest(strippedPost);
    if (strippedReq !== cleanId) this.deleteDayRequest(strippedReq);
    if (strippedPub !== cleanId) this.deleteDayRequest(strippedPub);

    this.deletePublication(cleanId);
    if (strippedPost !== cleanId) this.deletePublication(strippedPost);
    if (strippedPub !== cleanId) this.deletePublication(strippedPub);
  }

  public static deleteManyPosts(ids: string[]): number {
    let count = 0;
    if (Array.isArray(ids)) {
      ids.forEach((id) => {
        if (id) {
          this.deletePostOrPublication(id);
          count++;
        }
      });
    }
    return count;
  }

  public static ensureUniquePostTitle(candidateTitle: string, excludeId?: string): string {
    return ensureUniquePostTitleHelper(
      candidateTitle,
      dayRequestsCache,
      publicationsCache,
      excludeId
    );
  }

  public static deduplicateExistingPostTitles(): void {
    deduplicateExistingPostTitlesHelper(dayRequestsCache);
  }

  public static getPublications(userId?: string): Publication[] {
    try {
      const pgDb = getSyncPgDB();
      if (pgDb) {
        const query = userId
          ? 'SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC'
          : 'SELECT * FROM posts ORDER BY created_at DESC';
        const params = userId ? [String(userId)] : [];
        const res = pgDb.exec(query, params);
        if (res && res[0] && res[0].values) {
          const cols = res[0].columns;
          const postsList: Publication[] = res[0].values
            .map((valArr: any[]) => {
              const row: any = {};
              cols.forEach((c: string, i: number) => {
                row[c] = valArr[i];
              });
              return row;
            })
            .filter((row: any) => {
              const rawId = String(row.id || '').trim();
              if (!rawId || rawId.startsWith('sched_')) return false;
              const hasAuthorName = Boolean(row.author_name && String(row.author_name).trim());
              if (hasAuthorName && !rawId.startsWith('req_') && !rawId.startsWith('pub_')) {
                return false;
              }
              return true;
            })
            .map((row: any) => {
              const parsedSched = parseTriggerScheduleSafe(row.trigger_schedule);
              const rawId = String(row.id || '').trim();
              const isExecutionLog = rawId.startsWith('pub_cron_') || rawId.startsWith('pub_');
              const norm = normalizePostStatus(row.status, {
                triggerSchedule: isExecutionLog ? { enabled: false } : parsedSched,
                publishedAt: row.published_at || null
              });
              const statusType: Publication['statusType'] =
                norm === 'опубликован'
                  ? 'published'
                  : norm === 'запланирован'
                  ? 'scheduled'
                  : norm === 'ошибка'
                  ? 'failed'
                  : norm === 'отменено'
                  ? 'cancelled'
                  : 'draft';
              const isPublished = statusType === 'published';
              const safeScheduledFor =
                resolveScheduledIsoFromSchedule(
                  isExecutionLog ? { enabled: false } : parsedSched,
                  row.scheduled_for && !String(row.scheduled_for).trim().startsWith('{')
                    ? String(row.scheduled_for)
                    : null
                ) ||
                (isPublished || statusType === 'scheduled'
                  ? row.published_at || row.created_at
                  : row.created_at);

              let attUrls: string[] = [];
              try {
                if (row.attachment_urls) {
                  attUrls =
                    typeof row.attachment_urls === 'string'
                      ? JSON.parse(row.attachment_urls)
                      : row.attachment_urls;
                } else if (row.album_json) {
                  attUrls =
                    typeof row.album_json === 'string'
                      ? JSON.parse(row.album_json)
                      : row.album_json;
                }
              } catch (e) {}

              return {
                id: rawId,
                userId: row.user_id ? String(row.user_id) : undefined,
                promptId: rawId.startsWith('pub_cron_')
                  ? rawId.replace(/^pub_cron_/, '').replace(/_\d+$/, '')
                  : rawId,
                promptTitle: row.title || row.request_template || 'Без названия',
                category: row.category || 'Общее',
                text: row.post_text || row.content || '',
                channel: row.channel || getDefaultChannelIdentifier(),
                status: isPublished,
                statusType,
                scheduledFor: safeScheduledFor,
                publishedAt: row.published_at || row.created_at || new Date().toISOString(),
                attachmentType: row.attachment_type || row.format || 'none',
                attachmentUrl: row.attachment_url || row.image_url || row.video_url || '',
                attachmentUrls: attUrls,
                audioFormat: row.audio_format || 'audio',
                audioTitle: row.audio_title || '',
                audioPerformer: row.audio_performer || '',
                protectContent: Boolean(row.protect_content),
                linkPreviewEnabled: row.link_preview_enabled !== 0 && row.link_preview_enabled !== false,
                messageFormat: row.message_format || 'rich'
              };
            });

          const promoItems = fetchPromoPublicationsFromPg(pgDb, userId);
          return [...postsList, ...promoItems];
        }
      }
    } catch (e) {
      console.warn('[PostDomain] Error querying publications from PostgreSQL:', e);
    }
    return [];
  }

  public static addPublication(pub: any): Publication {
    const text = pub.text || '';
    const computedFormat = detectMessageFormat(text, pub.messageFormat);
    const statusType = pub.statusType || (pub.status !== false ? 'published' : 'failed');
    const isDmTest = Boolean(pub.skipPostsTable) || String(pub.channel || '').startsWith('DM:');

    let existingPostRow: Record<string, any> | null = null;
    const candidatePromptId = pub.promptId ? String(pub.promptId).trim() : '';

    if (!isDmTest && candidatePromptId && candidatePromptId !== 'test_send') {
      try {
        const pgDb = getSyncPgDB();
        if (pgDb) {
          const res = pgDb.exec('SELECT * FROM posts WHERE id = ? LIMIT 1', [candidatePromptId]);
          if (res[0]?.values?.[0]) {
            const cols = res[0].columns;
            existingPostRow = {};
            cols.forEach((col, idx) => {
              existingPostRow![col] = res[0].values[0][idx];
            });
          }
        }
      } catch (e) {}
    }

    const targetId =
      pub.id ||
      (existingPostRow ? String(existingPostRow.id) : '') ||
      (candidatePromptId && candidatePromptId.startsWith('req_') && candidatePromptId !== 'req_1'
        ? candidatePromptId
        : '') ||
      'pub_' + Math.random().toString(36).substring(2, 11);

    const rawTitle = pub.promptTitle || 'Без названия';
    const uniqueTitle = isDmTest
      ? rawTitle
      : existingPostRow &&
        String(existingPostRow.title || '').trim().toLowerCase() === rawTitle.trim().toLowerCase()
      ? rawTitle.trim()
      : this.ensureUniquePostTitle(rawTitle, targetId);

    const newPub: Publication = {
      text,
      channel: pub.channel || getDefaultChannelIdentifier(),
      status: pub.status !== undefined ? Boolean(pub.status) : true,
      statusType,
      messageFormat: computedFormat,
      ...pub,
      promptTitle: uniqueTitle,
      id: targetId,
      publishedAt: pub.publishedAt || new Date().toISOString()
    };

    if (!isDmTest) {
      try {
        const attUrlsJson = Array.isArray(newPub.attachmentUrls)
          ? JSON.stringify(newPub.attachmentUrls)
          : existingPostRow?.attachment_urls
          ? String(existingPostRow.attachment_urls)
          : '[]';
        const btnsJson = Array.isArray(newPub.inlineButtons)
          ? JSON.stringify(newPub.inlineButtons)
          : existingPostRow?.inline_buttons_json
          ? String(existingPostRow.inline_buttons_json)
          : '[]';
        const preservedCreatedAt = existingPostRow?.created_at
          ? String(existingPostRow.created_at)
          : newPub.publishedAt;
        const preservedTemplate = existingPostRow?.request_template
          ? String(existingPostRow.request_template)
          : '';
        const safeStatusRu =
          newPub.statusType === 'published'
            ? 'опубликован'
            : newPub.statusType === 'scheduled'
            ? 'запланирован'
            : newPub.statusType === 'failed'
            ? 'ошибка'
            : newPub.statusType === 'cancelled'
            ? 'отменено'
            : 'создается';
        const isLogRow =
          String(newPub.id).startsWith('pub_cron_') || String(newPub.id).startsWith('pub_');
        const existingSched = existingPostRow?.trigger_schedule
          ? parseTriggerScheduleSafe(existingPostRow.trigger_schedule)
          : { enabled: false };
        const incomingSched = (newPub as any).triggerSchedule
          ? parseTriggerScheduleSafe((newPub as any).triggerSchedule)
          : null;
        const resolvedScheduleObj = isLogRow
          ? { enabled: false }
          : newPub.statusType === 'scheduled'
          ? {
              ...existingSched,
              ...(incomingSched || {}),
              enabled: true,
              frequency: (incomingSched?.frequency || existingSched?.frequency || 'once'),
              exactDateTime:
                incomingSched?.exactDateTime ||
                existingSched?.exactDateTime ||
                newPub.scheduledFor ||
                newPub.publishedAt,
              timezone: incomingSched?.timezone || existingSched?.timezone || 'Europe/Moscow',
              publishToSocialFeed:
                (newPub as any).publishToSocialFeed !== undefined
                  ? Boolean((newPub as any).publishToSocialFeed)
                  : existingSched?.publishToSocialFeed !== false
            }
          : {
              ...existingSched,
              ...(incomingSched || {}),
              enabled: false
            };
        const preservedSchedule = JSON.stringify(resolvedScheduleObj);
        const preservedChannels = existingPostRow?.channels
          ? String(existingPostRow.channels)
          : JSON.stringify([newPub.channel]);

        void insertRow('posts', {
          id: newPub.id,
          user_id: newPub.userId || existingPostRow?.user_id || '',
          title: newPub.promptTitle,
          category: newPub.category || existingPostRow?.category || 'Общее',
          request_template: preservedTemplate,
          post_text: newPub.text,
          content: newPub.text,
          message_format: computedFormat,
          channel: newPub.channel,
          channels: preservedChannels,
          status: safeStatusRu,
          trigger_schedule: preservedSchedule,
          published_at: newPub.publishedAt,
          created_at: preservedCreatedAt,
          attachment_type: newPub.attachmentType || existingPostRow?.attachment_type || 'none',
          attachment_url: newPub.attachmentUrl || existingPostRow?.attachment_url || '',
          attachment_urls: attUrlsJson,
          audio_format: (newPub as any).audioFormat || existingPostRow?.audio_format || 'audio',
          audio_title: (newPub as any).audioTitle || existingPostRow?.audio_title || '',
          audio_performer: (newPub as any).audioPerformer || existingPostRow?.audio_performer || '',
          protect_content: (newPub as any).protectContent !== undefined ? ((newPub as any).protectContent ? 1 : 0) : (existingPostRow?.protect_content || 0),
          link_preview_enabled: (newPub as any).linkPreviewEnabled !== undefined ? ((newPub as any).linkPreviewEnabled === false ? 0 : 1) : (existingPostRow?.link_preview_enabled ?? 1),
          inline_buttons_json: btnsJson,
          signature: newPub.signature || existingPostRow?.signature || ''
        }).catch(() => null);
      } catch (e) {
        console.warn('[PostDomain] Error inserting publication into posts table:', e);
      }
    }

    return newPub;
  }

  public static updatePublication(id: string, updated: Partial<Publication>): Publication | null {
    const cleanId = String(id || '').trim();
    try {
      const pgDb = getSyncPgDB();
      if (pgDb) {
        const mappedStatus = updated.statusType
          ? updated.statusType === 'published'
            ? 'опубликован'
            : updated.statusType === 'scheduled'
            ? 'запланирован'
            : updated.statusType === 'failed'
            ? 'ошибка'
            : updated.statusType === 'cancelled'
            ? 'отменено'
            : 'создается'
          : null;
        if (mappedStatus || updated.text || updated.promptTitle || updated.publishedAt) {
          pgDb.run(
            `UPDATE posts SET status = COALESCE(?, status), post_text = COALESCE(?, post_text), title = COALESCE(?, title), published_at = COALESCE(?, published_at) WHERE id = ?`,
            [mappedStatus, updated.text || null, updated.promptTitle || null, updated.publishedAt || null, cleanId]
          );
          savePgDB();
        }
      }
    } catch (e) {}
    return null;
  }

  public static deletePublication(id: string, userId?: string): void {
    const cleanId = String(id || '').trim();
    const strippedId = cleanId.replace(/^pub_/, '');
    const strippedPost = cleanId.replace(/^post-/, '');
    try {
      const pgDb = getSyncPgDB();
      if (pgDb) {
        pgDb.run('DELETE FROM posts WHERE id = ? OR id = ? OR id = ?', [
          cleanId,
          strippedId,
          strippedPost
        ]);
        deletePromoFromPublicationPg(pgDb, cleanId, userId);
        savePgDB();
      }
    } catch (e) {
      console.warn('[PostDomain] Error deleting publication from posts table:', e);
    }

    publicationsCache = publicationsCache.filter((p) => {
      const pid = String(p.id || '').trim();
      const pPromptId = String(p.promptId || '').trim();
      return (
        pid !== cleanId &&
        pid !== strippedId &&
        pid !== strippedPost &&
        pPromptId !== cleanId &&
        pPromptId !== strippedId &&
        pPromptId !== strippedPost
      );
    });
  }
}
