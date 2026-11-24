import { Channel, DayRequest, Publication } from '../../types';
import { parseLocalDateTimeInput } from '../schedule/localDateTime';

export type CalendarNormStatus = 'creating' | 'scheduled' | 'published' | 'failed' | 'cancelled';

export interface UnifiedPublicationItem {
  id: string;
  postId: string;
  promptId: string;
  promptTitle: string;
  text: string;
  channel: string;
  channels?: string[];
  displayDate: string; // ISO string
  createdAt?: string;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  status: string;
  normStatus: CalendarNormStatus;
  messageFormat?: 'v2' | 'rich' | 'html' | 'markdown';
  attachmentType?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
  inlineButtons?: any[];
  signature?: string;
  uppercaseHeader?: boolean;
  category?: string;
  response?: string;
  isAuto?: boolean;
}

export function parseTriggerScheduleClient(raw: any): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? raw : null;
}

function isRecurringFrequency(freq?: string): boolean {
  return Boolean(
    freq &&
      freq !== 'once' &&
      freq !== 'exact_date'
  );
}

function resolveScheduleDateIso(post: any, sched: Record<string, any> | null): string | null {
  const candidates = [
    sched?.exactDateTime,
    post?.scheduledTime,
    post?.scheduledFor
  ];

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    if (raw.trim().startsWith('{')) continue;
    const parsed = parseLocalDateTimeInput(raw);
    if (parsed) return parsed.toISOString();
  }

  if (sched?.enabled && sched?.time) {
    const [hh, mm] = String(sched.time).split(':').map(Number);
    if (!Number.isNaN(hh)) {
      const next = new Date();
      next.setHours(hh, Number.isNaN(mm) ? 0 : mm, 0, 0);
      if (next.getTime() <= Date.now()) {
        next.setDate(next.getDate() + 1);
      }
      return next.toISOString();
    }
  }

  return null;
}

export function normalizeDayRequestCalendarStatus(post: any, sched: Record<string, any> | null): CalendarNormStatus {
  const rawStatus = String(post?.status || '').toLowerCase().trim();
  const hasPublishedAt = Boolean(post?.publishedAt || post?.published_at);

  if (rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'ошибка') {
    return 'failed';
  }
  if (rawStatus === 'cancelled' || rawStatus === 'отменено' || rawStatus === 'paused') {
    return 'cancelled';
  }
  if (
    rawStatus === 'published' ||
    rawStatus === 'опубликован' ||
    rawStatus === 'опубликовано' ||
    rawStatus === 'отправлено' ||
    rawStatus === 'отправлен' ||
    rawStatus === 'sent' ||
    rawStatus === 'успешно'
  ) {
    return 'published';
  }
  if (
    rawStatus === 'scheduled' ||
    rawStatus === 'отложено' ||
    rawStatus === 'запланировано' ||
    rawStatus === 'запланирован' ||
    rawStatus === 'pending'
  ) {
    return 'scheduled';
  }
  if (sched?.enabled) {
    return 'scheduled';
  }
  if (
    rawStatus === 'создается' ||
    rawStatus === 'draft' ||
    rawStatus === 'черновик' ||
    rawStatus === 'creating' ||
    rawStatus === 'новый'
  ) {
    return 'creating';
  }
  return hasPublishedAt ? 'published' : 'creating';
}

export function normalizePubRecordCalendarStatus(pub: any): CalendarNormStatus {
  const rawType = String(pub?.statusType || '').toLowerCase().trim();
  const rawStatus = typeof pub?.status === 'string' ? pub.status.toLowerCase().trim() : '';
  const combined = rawType || rawStatus;

  if (combined === 'failed' || combined === 'error' || combined === 'ошибка') return 'failed';
  if (combined === 'cancelled' || combined === 'отменено') return 'cancelled';
  if (
    combined === 'scheduled' ||
    combined === 'отложено' ||
    combined === 'запланирован' ||
    combined === 'запланировано'
  ) {
    return 'scheduled';
  }
  if (
    combined === 'draft' ||
    combined === 'черновик' ||
    combined === 'создается' ||
    combined === 'creating'
  ) {
    return 'creating';
  }
  if (
    combined === 'published' ||
    combined === 'опубликован' ||
    combined === 'опубликовано' ||
    combined === 'отправлено' ||
    combined === 'отправлен' ||
    combined === 'sent'
  ) {
    return 'published';
  }
  return pub?.status === false ? 'failed' : 'published';
}

export function getCalendarStatusRuLabel(status: CalendarNormStatus): string {
  switch (status) {
    case 'creating':
      return 'Создается';
    case 'scheduled':
      return 'Запланирован';
    case 'published':
      return 'Отправлено';
    case 'failed':
      return 'Ошибка';
    case 'cancelled':
      return 'Отменено';
    default:
      return 'Создается';
  }
}

export function buildUnifiedCalendarItems(
  safeDayRequests: DayRequest[],
  safePublications: Publication[],
  channels: Channel[]
): UnifiedPublicationItem[] {
  const itemsMap = new Map<string, UnifiedPublicationItem>();
  const defaultChan = channels[0]?.username || '@IIrkiBot';

  safeDayRequests.forEach((post: any) => {
    const postId = String(post.id || '');
    if (!postId) return;

    const sched = parseTriggerScheduleClient(post.triggerSchedule || post.trigger_schedule);
    const normStatus = normalizeDayRequestCalendarStatus(post, sched);
    const scheduledIso = resolveScheduleDateIso(post, sched);
    const publishedIso = post.publishedAt || post.published_at || null;
    const createdIso = post.createdAt || post.created_at || new Date().toISOString();

    let displayDate = createdIso;
    if (normStatus === 'published') {
      displayDate = publishedIso || createdIso;
    } else if (normStatus === 'scheduled') {
      displayDate = scheduledIso || createdIso;
    }

    itemsMap.set(postId, {
      id: `post-${postId}`,
      postId,
      promptId: postId,
      promptTitle: post.title || post.postTitle || 'Пост без названия',
      text: post.postText || post.requestTemplate || '',
      channel: post.channel || (post.channels && post.channels[0]) || defaultChan,
      channels: post.channels || [post.channel || defaultChan],
      displayDate,
      createdAt: createdIso,
      publishedAt: publishedIso,
      scheduledFor: scheduledIso,
      status: getCalendarStatusRuLabel(normStatus),
      normStatus,
      messageFormat: (post.messageFormat as any) || 'v2',
      attachmentType: post.attachmentType || 'none',
      attachmentUrl: post.attachmentUrl || '',
      attachmentUrls: post.attachmentUrls || [],
      inlineButtons: post.inlineButtons || [],
      signature: post.signature || '',
      uppercaseHeader: post.uppercaseHeader !== false,
      category: post.category || 'общее',
      isAuto: Boolean(sched?.enabled || post.scheduledTime)
    });
  });

  safePublications.forEach((pub: any) => {
    const pubId = String(pub.id || '');
    const pubPostId = String(pub.promptId || pub.id || '');
    const normStatus = normalizePubRecordCalendarStatus(pub);
    const existing = itemsMap.get(pubPostId);

    const safeSched =
      pub.scheduledFor && typeof pub.scheduledFor === 'string' && !pub.scheduledFor.trim().startsWith('{')
        ? pub.scheduledFor
        : null;
    const pubDisplayDate =
      normStatus === 'scheduled'
        ? safeSched || pub.publishedAt || pub.createdAt || new Date().toISOString()
        : pub.publishedAt || safeSched || pub.createdAt || new Date().toISOString();

    if (existing) {
      if (pub.response) existing.response = pub.response;

      const isDifferentHistoryRow = pubId && pubId !== existing.postId && pubId.startsWith('pub_cron_');
      const existingReq = safeDayRequests.find((r) => String(r.id) === existing.postId);
      const existingSched = parseTriggerScheduleClient(existingReq?.triggerSchedule);
      const recurring = isRecurringFrequency(existingSched?.frequency);

      if (isDifferentHistoryRow && recurring && normStatus === 'published') {
        // Keep active recurring schedule card and show individual past execution on calendar
        itemsMap.set(pubId, {
          id: pubId,
          postId: existing.postId,
          promptId: existing.postId,
          promptTitle: pub.promptTitle || existing.promptTitle,
          text: pub.text || existing.text,
          channel: pub.channel || existing.channel,
          channels: existing.channels,
          displayDate: pubDisplayDate,
          createdAt: pub.createdAt || existing.createdAt,
          publishedAt: pub.publishedAt || pubDisplayDate,
          scheduledFor: safeSched,
          status: getCalendarStatusRuLabel(normStatus),
          normStatus,
          messageFormat: (pub.messageFormat as any) || existing.messageFormat,
          attachmentType: pub.attachmentType || existing.attachmentType,
          attachmentUrl: pub.attachmentUrl || existing.attachmentUrl,
          attachmentUrls: pub.attachmentUrls || existing.attachmentUrls,
          inlineButtons: pub.inlineButtons || existing.inlineButtons,
          signature: pub.signature || existing.signature,
          uppercaseHeader: pub.uppercaseHeader ?? existing.uppercaseHeader,
          category: pub.category || existing.category,
          response: pub.response,
          isAuto: true
        });
        return;
      }

      if (normStatus === 'published' && existing.normStatus !== 'published') {
        existing.normStatus = 'published';
        existing.status = getCalendarStatusRuLabel('published');
        existing.publishedAt = pub.publishedAt || existing.publishedAt || pubDisplayDate;
        existing.displayDate = existing.publishedAt || pubDisplayDate;
      } else if (normStatus === 'scheduled' && existing.normStatus === 'creating') {
        existing.normStatus = 'scheduled';
        existing.status = getCalendarStatusRuLabel('scheduled');
        if (safeSched) {
          existing.scheduledFor = safeSched;
          existing.displayDate = safeSched;
        }
      } else if (normStatus === 'failed' && existing.normStatus !== 'published') {
        existing.normStatus = 'failed';
        existing.status = getCalendarStatusRuLabel('failed');
      }
      return;
    }

    const itemKey = pubId || pubPostId;
    itemsMap.set(itemKey, {
      id: pubId || pubPostId,
      postId: pubPostId,
      promptId: pubPostId,
      promptTitle: pub.promptTitle || 'Публикация',
      text: pub.text || '',
      channel: pub.channel || defaultChan,
      displayDate: pubDisplayDate,
      createdAt: pub.createdAt,
      publishedAt: normStatus === 'published' ? (pub.publishedAt || pubDisplayDate) : null,
      scheduledFor: safeSched,
      status: getCalendarStatusRuLabel(normStatus),
      normStatus,
      messageFormat: (pub.messageFormat as any) || 'v2',
      attachmentType: pub.attachmentType,
      attachmentUrl: pub.attachmentUrl,
      attachmentUrls: pub.attachmentUrls,
      inlineButtons: pub.inlineButtons,
      signature: pub.signature,
      uppercaseHeader: pub.uppercaseHeader,
      category: pub.category || 'общее',
      response: pub.response,
      isAuto: Boolean(safeSched)
    });
  });

  return Array.from(itemsMap.values());
}
