/**
 * Universal online / offline status formatting utility for Iirky Social Network.
 * Checks last seen timestamp and provides friendly Russian status representation.
 */

export interface FormattedUserStatus {
  isOnline: boolean;
  text: string;
}

export function formatUserOnlineStatus(
  lastSeen?: string | Date | number | null,
  isOnlineDirect?: boolean
): FormattedUserStatus {
  if (isOnlineDirect) {
    return { isOnline: true, text: 'В сети' };
  }

  if (!lastSeen) {
    // Return friendly default for existing profiles
    return { isOnline: false, text: 'Был(а) в сети недавно' };
  }

  const date = typeof lastSeen === 'string' || typeof lastSeen === 'number'
    ? new Date(lastSeen)
    : lastSeen;

  if (isNaN(date.getTime())) {
    return { isOnline: false, text: 'Был(а) в сети недавно' };
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Active within last 4 minutes is considered online
  if (diffMs >= 0 && diffMs <= 4 * 60 * 1000) {
    return { isOnline: true, text: 'В сети' };
  }

  const isToday = now.toDateString() === date.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) {
    return { isOnline: false, text: `Был(а) в сети сегодня в ${timeStr}` };
  }

  if (isYesterday) {
    return { isOnline: false, text: `Был(а) в сети вчера в ${timeStr}` };
  }

  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const isCurrentYear = now.getFullYear() === date.getFullYear();

  if (isCurrentYear) {
    return { isOnline: false, text: `Был(а) в сети ${day} ${month} в ${timeStr}` };
  }

  return { isOnline: false, text: `Был(а) в сети ${day}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} в ${timeStr}` };
}
