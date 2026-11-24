import { DB, DayRequest, Publication, detectMessageFormat } from './db';
import {
  isOneOffScheduleFrequency,
  isPublishedPostStatus,
  parseScheduleDateTimeInTimezone
} from './domains/posts/postStatusHelpers';

/**
 * Calculates local Date/Time in a specific IANA timezone
 */
function getZonedDate(date: Date, timeZone: string = 'Europe/Moscow'): {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hours: number; // 0-23
  minutes: number; // 0-59
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
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
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let hours = date.getHours();
    let minutes = date.getMinutes();
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
      'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    };
    const dayOfWeek = dayMap[weekdayStr.slice(0, 3)] !== undefined ? dayMap[weekdayStr.slice(0, 3)] : date.getDay();

    return { year, month, day, hours, minutes, dayOfWeek };
  } catch (e) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
      dayOfWeek: date.getDay()
    };
  }
}

/**
 * Creates a UTC Date representing a specific year, month, day, hours, minutes in the target timezone
 */
function createDateInTimezone(
  year: number,
  month: number, // 1-12
  day: number,
  hours: number,
  minutes: number,
  timeZone: string = 'Europe/Moscow'
): Date {
  // Approximate with UTC then refine
  const pad = (n: number) => String(n).padStart(2, '0');
  const targetIso = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
  
  // Create an initial date object assuming UTC
  const testDate = new Date(`${targetIso}Z`);
  
  try {
    // Determine offset in ms
    const zoned = getZonedDate(testDate, timeZone);
    const targetMs = Date.UTC(year, month - 1, day, hours, minutes, 0);
    const zonedMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hours, zoned.minutes, 0);
    const diff = targetMs - zonedMs;
    return new Date(testDate.getTime() + diff);
  } catch (e) {
    return new Date(targetIso);
  }
}

/**
 * Checks if a specific hour/minute falls within user's sleep window (e.g. 23:00 to 08:00)
 */
function isTimeInSleepWindow(hours: number, minutes: number, sleepStart: string, sleepEnd: string): boolean {
  const currentTotal = hours * 60 + minutes;
  const [sHours, sMin] = sleepStart.split(':').map(Number);
  const [eHours, eMin] = sleepEnd.split(':').map(Number);
  const startTotal = (sHours || 23) * 60 + (sMin || 0);
  const endTotal = (eHours || 8) * 60 + (eMin || 0);

  if (startTotal <= endTotal) {
    // E.g. 01:00 to 06:00 (same day)
    return currentTotal >= startTotal && currentTotal < endTotal;
  } else {
    // E.g. 23:00 to 08:00 (overnight)
    return currentTotal >= startTotal || currentTotal < endTotal;
  }
}

/**
 * Generate future scheduled slots for the upcoming 31 days (1 month horizon)
 */
export function generateScheduleSlotsForPost(post: DayRequest, daysForward: number = 31): Date[] {
  const sched: any = post.triggerSchedule;
  if (!sched || sched.enabled === false) return [];

  const frequency = String(sched.frequency || 'daily').toLowerCase().trim();
  if (isPublishedPostStatus(post.status) && isOneOffScheduleFrequency(frequency)) {
    return [];
  }

  const now = new Date();
  const timezone = sched.timezone || 'Europe/Moscow';
  const triggerTime = sched.time || '12:00';
  const [tHours, tMin] = triggerTime.split(':').map(Number);
  const sleepEnabled = !!sched.sleepModeEnabled;
  const sleepStart = sched.sleepStartTime || '23:00';
  const sleepEnd = sched.sleepEndTime || '08:00';

  const slots: Date[] = [];
  const maxHorizon = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000);

  // 1. EXACT DATE & TIME ('once' | 'exact_date')
  if (isOneOffScheduleFrequency(frequency)) {
    if (sched.exactDateTime) {
      const dt = parseScheduleDateTimeInTimezone(String(sched.exactDateTime), timezone);
      if (dt && dt.getTime() > now.getTime() && dt.getTime() <= maxHorizon.getTime()) {
        slots.push(dt);
      }
    }
    return slots;
  }

  // 2. DAILY
  if (frequency === 'daily') {
    for (let d = 0; d <= daysForward; d++) {
      const targetDate = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const z = getZonedDate(targetDate, timezone);
      const slot = createDateInTimezone(z.year, z.month, z.day, Number.isNaN(tHours) ? 12 : tHours, Number.isNaN(tMin) ? 0 : tMin, timezone);
      if (slot.getTime() > now.getTime() && slot.getTime() <= maxHorizon.getTime()) {
        slots.push(slot);
      }
    }
    return slots;
  }

  // 3. DAY OF WEEK / WEEKLY
  if (frequency === 'dayofweek' || frequency === 'weekly') {
    const daysOfWeek: string[] = Array.isArray(sched.daysOfWeek) ? sched.daysOfWeek : ['monday', 'friday'];
    const dayMapRu: Record<string, number> = {
      'воскресенье': 0, 'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4, 'пятница': 5, 'суббота': 6,
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6,
      'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    };
    const targetDays = daysOfWeek.map(d => dayMapRu[String(d).toLowerCase()] !== undefined ? dayMapRu[String(d).toLowerCase()] : -1);

    for (let d = 0; d <= daysForward; d++) {
      const targetDate = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const z = getZonedDate(targetDate, timezone);
      if (targetDays.includes(z.dayOfWeek)) {
        const slot = createDateInTimezone(z.year, z.month, z.day, Number.isNaN(tHours) ? 12 : tHours, Number.isNaN(tMin) ? 0 : tMin, timezone);
        if (slot.getTime() > now.getTime() && slot.getTime() <= maxHorizon.getTime()) {
          slots.push(slot);
        }
      }
    }
    return slots;
  }

  // 4. MONTHLY
  if (frequency === 'monthly') {
    const targetDayOfMonth = Number(sched.dayOfMonth || 1);
    const currentZoned = getZonedDate(now, timezone);

    for (let mOffset = 0; mOffset <= 2; mOffset++) {
      let targetMonth = currentZoned.month + mOffset;
      let targetYear = currentZoned.year;
      if (targetMonth > 12) {
        targetMonth -= 12;
        targetYear += 1;
      }
      const slot = createDateInTimezone(targetYear, targetMonth, targetDayOfMonth, Number.isNaN(tHours) ? 12 : tHours, Number.isNaN(tMin) ? 0 : tMin, timezone);
      if (slot.getTime() > now.getTime() && slot.getTime() <= maxHorizon.getTime()) {
        slots.push(slot);
      }
    }
    return slots;
  }

  // 5. INTERVAL MINUTES / HOURS
  if (frequency === 'interval_minutes' || frequency === 'minutes' || frequency === 'interval_hours' || frequency === 'hours') {
    const stepMin = (frequency === 'interval_hours' || frequency === 'hours')
      ? Math.max(1, Number(sched.intervalHours || 1)) * 60
      : Math.max(5, Number(sched.intervalMinutes || 15));

    let cursor = new Date(now.getTime() + stepMin * 60 * 1000);

    while (cursor.getTime() <= maxHorizon.getTime()) {
      const z = getZonedDate(cursor, timezone);
      if (sleepEnabled && isTimeInSleepWindow(z.hours, z.minutes, sleepStart, sleepEnd)) {
        cursor = new Date(cursor.getTime() + stepMin * 60 * 1000);
        continue;
      }

      slots.push(new Date(cursor.getTime()));
      cursor = new Date(cursor.getTime() + stepMin * 60 * 1000);

      if (slots.length >= 300) break;
    }
    return slots;
  }

  return slots;
}

/**
 * Synchronize scheduled publications table/database with post trigger schedule
 */
export function syncScheduledPublicationsForPost(post: DayRequest) {
  try {
    const postId = String(post.id || '').trim();
    if (
      !postId ||
      postId.startsWith('pub_cron_') ||
      postId.startsWith('pub_') ||
      postId.startsWith('sched_') ||
      postId.startsWith('blog_')
    ) {
      return;
    }

    const allPubs = DB.getPublications();
    const now = new Date();
    const freq = post.triggerSchedule?.frequency;
    const isOneOffOrDisabled =
      !post.triggerSchedule ||
      !post.triggerSchedule.enabled ||
      isOneOffScheduleFrequency(freq) ||
      isPublishedPostStatus(post.status);

    // If disabled, one-off, or published: remove stale future sched_ rows (cron_post_ owns execution)
    if (isOneOffOrDisabled) {
      const remainingPubs = allPubs.filter(p => {
        if (String(p.id).startsWith(`sched_${postId}_`) && p.statusType === 'scheduled') {
          return false;
        }
        return true;
      });
      if (remainingPubs.length !== allPubs.length) {
        const db = DB.load();
        db.publications = remainingPubs;
        DB.save(db);
      }
      return;
    }

    // Generate slots for the next month
    const futureSlots = generateScheduleSlotsForPost(post, 31);
    const targetChannels = (post.channels && post.channels.length > 0) ? post.channels : [post.channel || '@SAV_AI'];
    const channelStr = targetChannels.join(', ');

    // Existing scheduled slots for this post
    const existingPostScheduled = allPubs.filter(
      p => p.promptId === postId && p.statusType === 'scheduled'
    );

    // Remove any future scheduled slots that don't match the new slot times (or if schedule changed)
    const slotTimesSet = new Set(futureSlots.map(s => s.getTime()));

    let updatedPubs = allPubs.filter(p => {
      if (p.promptId === postId && p.statusType === 'scheduled') {
        const pTime = new Date(p.scheduledFor || p.publishedAt).getTime();
        // If it's in the future and not in the new slots list, remove it
        if (pTime > now.getTime() && !slotTimesSet.has(pTime)) {
          return false;
        }
      }
      return true;
    });

    // Add missing future slots
    const existingTimes = new Set(
      updatedPubs
        .filter(p => p.promptId === postId)
        .map(p => new Date(p.scheduledFor || p.publishedAt).getTime())
    );

    for (const slot of futureSlots) {
      const sTime = slot.getTime();
      if (!existingTimes.has(sTime)) {
        const text = post.postText || post.requestTemplate || '';
        const msgFormat = detectMessageFormat(text, post.messageFormat);
        const newSchedPub: Publication = {
          id: `sched_${postId}_${sTime}`,
          userId: post.userId || '',
          promptId: postId,
          promptTitle: post.title || 'Пост по расписанию',
          category: post.category || 'общее',
          text,
          channel: channelStr,
          status: false,
          statusType: 'scheduled',
          scheduledFor: slot.toISOString(),
          publishedAt: slot.toISOString(),
          response: 'Отложено в расписание',
          messageFormat: msgFormat,
          attachmentType: (post.attachmentType as any) || 'none',
          attachmentUrl: post.attachmentUrl,
          attachmentUrls: post.attachmentUrls,
          inlineButtons: post.inlineButtons,
          signature: post.signature,
          uppercaseHeader: post.uppercaseHeader !== false
        };
        updatedPubs.unshift(newSchedPub);
        existingTimes.add(sTime);
      }
    }

    const db = DB.load();
    db.publications = updatedPubs;
    DB.save(db);
  } catch (err) {
    console.error(`[ScheduleSync] Error syncing schedule for post ${post.id}:`, err);
  }
}

/**
 * Monthly Cron Auto-renewal: checks all active posts and extends schedule horizon to next 30 days
 */
export function renewAllActiveSchedules() {
  try {
    const posts = DB.getDayRequests();
    for (const post of posts) {
      if (post.triggerSchedule && post.triggerSchedule.enabled) {
        syncScheduledPublicationsForPost(post);
      }
    }
  } catch (err) {
    console.error('[ScheduleRenew] Error renewing active schedules:', err);
  }
}
