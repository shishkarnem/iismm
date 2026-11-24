/**
 * Local device Date/Time helpers for datetime-local inputs & schedule display.
 * Device clock already reflects the user's local timezone; no synthetic timezone shift is applied here.
 */

export function formatLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function getDefaultLocalPlusOneHour(): string {
  return formatLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000));
}

export function getCurrentLocalMinDateTime(): string {
  return formatLocalDateTimeInput(new Date());
}

export function parseLocalDateTimeInput(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Bare datetime-local: YYYY-MM-DDTHH:mm (or with space / seconds)
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const dt = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] || 0),
      0
    );
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeToLocalDateTimeInput(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const bare = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (bare) {
    return `${bare[1]}-${bare[2]}-${bare[3]}T${bare[4]}:${bare[5]}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatLocalDateTimeInput(parsed);
}

export function isPastLocalDateTime(value?: string | null, referenceNowMs: number = Date.now()): boolean {
  const parsed = parseLocalDateTimeInput(value);
  if (!parsed) return false;
  return parsed.getTime() <= referenceNowMs;
}

export function formatCollapsedExactDateTime(value?: string | null): string {
  if (!value || typeof value !== 'string') return 'Дата не выбрана';
  const trimmed = value.trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    return `${m[3]}.${m[2]}.${m[1]} в ${m[4]}:${m[5]}`;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return 'Дата не выбрана';
  const datePart = d.toLocaleDateString('ru-RU');
  const timePart = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} в ${timePart}`;
}
