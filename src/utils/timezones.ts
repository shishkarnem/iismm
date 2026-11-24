/**
 * Comprehensive World Timezones Database
 * Supports all official IANA timezones grouped by region with precise UTC offsets and city/country names.
 */

export interface TimezoneOption {
  value: string;       // IANA timezone identifier, e.g. "Europe/Moscow"
  label: string;       // Human readable display label with UTC offset
  offset: string;      // UTC offset string, e.g. "UTC+03:00"
  region: string;      // Region group name
  city: string;        // Primary city / territory
}

// Major and common global timezones with Russian/English descriptions
export const POPULAR_TIMEZONES: TimezoneOption[] = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2 / МСК-1)', offset: 'UTC+02:00', region: 'Россия и СНГ', city: 'Калининград' },
  { value: 'Europe/Moscow', label: 'Москва, Санкт-Петербург (UTC+3 / МСК)', offset: 'UTC+03:00', region: 'Россия и СНГ', city: 'Москва' },
  { value: 'Europe/Minsk', label: 'Минск, Беларусь (UTC+3 / МСК)', offset: 'UTC+03:00', region: 'Россия и СНГ', city: 'Минск' },
  { value: 'Europe/Samara', label: 'Самара, Тольятти (UTC+4 / МСК+1)', offset: 'UTC+04:00', region: 'Россия и СНГ', city: 'Самара' },
  { value: 'Asia/Baku', label: 'Баку, Азербайджан (UTC+4)', offset: 'UTC+04:00', region: 'Россия и СНГ', city: 'Баку' },
  { value: 'Asia/Tbilisi', label: 'Тбилиси, Грузия (UTC+4)', offset: 'UTC+04:00', region: 'Россия и СНГ', city: 'Тбилиси' },
  { value: 'Asia/Yerevan', label: 'Ереван, Армения (UTC+4)', offset: 'UTC+04:00', region: 'Россия и СНГ', city: 'Ереван' },
  { value: 'Asia/Dubai', label: 'Дубай, ОАЭ (UTC+4)', offset: 'UTC+04:00', region: 'Ближний Восток', city: 'Дубай' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург, Уфа, Тюмень (UTC+5 / МСК+2)', offset: 'UTC+05:00', region: 'Россия и СНГ', city: 'Екатеринбург' },
  { value: 'Asia/Tashkent', label: 'Ташкент, Узбекистан (UTC+5)', offset: 'UTC+05:00', region: 'Россия и СНГ', city: 'Ташкент' },
  { value: 'Asia/Almaty', label: 'Алматы, Астана, Казахстан (UTC+5)', offset: 'UTC+05:00', region: 'Россия и СНГ', city: 'Алматы' },
  { value: 'Asia/Bishkek', label: 'Бишкек, Кыргызстан (UTC+6)', offset: 'UTC+06:00', region: 'Россия и СНГ', city: 'Бишкек' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6 / МСК+3)', offset: 'UTC+06:00', region: 'Россия и СНГ', city: 'Омск' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск, Академгородок (UTC+7 / МСК+4)', offset: 'UTC+07:00', region: 'Россия и СНГ', city: 'Новосибирск' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск, Норильск (UTC+7 / МСК+4)', offset: 'UTC+07:00', region: 'Россия и СНГ', city: 'Красноярск' },
  { value: 'Asia/Tomsk', label: 'Томск (UTC+7 / МСК+4)', offset: 'UTC+07:00', region: 'Россия и СНГ', city: 'Томск' },
  { value: 'Asia/Barnaul', label: 'Барнаул, Алтай (UTC+7 / МСК+4)', offset: 'UTC+07:00', region: 'Россия и СНГ', city: 'Барнаул' },
  { value: 'Asia/Irkutsk', label: 'Иркутск, Байкал (UTC+8 / МСК+5)', offset: 'UTC+08:00', region: 'Россия и СНГ', city: 'Иркутск' },
  { value: 'Asia/Chita', label: 'Чита, Забайкалье (UTC+9 / МСК+6)', offset: 'UTC+09:00', region: 'Россия и СНГ', city: 'Чита' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9 / МСК+6)', offset: 'UTC+09:00', region: 'Россия и СНГ', city: 'Якутск' },
  { value: 'Asia/Vladivostok', label: 'Владивосток, Хабаровск (UTC+10 / МСК+7)', offset: 'UTC+10:00', region: 'Россия и СНГ', city: 'Владивосток' },
  { value: 'Asia/Sakhalin', label: 'Южно-Сахалинск (UTC+11 / МСК+8)', offset: 'UTC+11:00', region: 'Россия и СНГ', city: 'Сахалин' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11 / МСК+8)', offset: 'UTC+11:00', region: 'Россия и СНГ', city: 'Магадан' },
  { value: 'Asia/Kamchatka', label: 'Петропавловск-Камчатский (UTC+12 / МСК+9)', offset: 'UTC+12:00', region: 'Россия и СНГ', city: 'Камчатка' },
  { value: 'Asia/Anadyr', label: 'Анадырь, Чукотка (UTC+12 / МСК+9)', offset: 'UTC+12:00', region: 'Россия и СНГ', city: 'Анадырь' },

  // Europe & Americas & Global
  { value: 'UTC', label: 'UTC (Всемирное координированное время, UTC+0)', offset: 'UTC+00:00', region: 'Международные', city: 'UTC' },
  { value: 'Europe/London', label: 'Лондон, Дублин, Эдинбург (UTC+0 / UTC+1)', offset: 'UTC+00:00', region: 'Европа', city: 'Лондон' },
  { value: 'Europe/Berlin', label: 'Берлин, Франкфурт, Мюнхен (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Берлин' },
  { value: 'Europe/Paris', label: 'Париж, Марсель, Лион (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Париж' },
  { value: 'Europe/Rome', label: 'Рим, Милан (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Рим' },
  { value: 'Europe/Madrid', label: 'Мадрид, Барселона (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Мадрид' },
  { value: 'Europe/Warsaw', label: 'Варшава, Краков (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Варшава' },
  { value: 'Europe/Prague', label: 'Прага, Чехия (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Прага' },
  { value: 'Europe/Vienna', label: 'Вена, Австрия (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Вена' },
  { value: 'Europe/Amsterdam', label: 'Амстердам, Нидерланды (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Амстердам' },
  { value: 'Europe/Brussels', label: 'Брюссель, Бельгия (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Брюссель' },
  { value: 'Europe/Zurich', label: 'Цюрих, Женева (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Цюрих' },
  { value: 'Europe/Stockholm', label: 'Стокгольм, Швеция (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Стокгольм' },
  { value: 'Europe/Oslo', label: 'Осло, Норвегия (UTC+1 / UTC+2)', offset: 'UTC+01:00', region: 'Европа', city: 'Осло' },
  { value: 'Europe/Helsinki', label: 'Хельсинки, Финляндия (UTC+2 / UTC+3)', offset: 'UTC+02:00', region: 'Европа', city: 'Хельсинки' },
  { value: 'Europe/Athens', label: 'Афины, Греция (UTC+2 / UTC+3)', offset: 'UTC+02:00', region: 'Европа', city: 'Афины' },
  { value: 'Europe/Bucharest', label: 'Бухарест, Румыния (UTC+2 / UTC+3)', offset: 'UTC+02:00', region: 'Европа', city: 'Бухарест' },
  { value: 'Europe/Kiev', label: 'Киев, Украина (UTC+2 / UTC+3)', offset: 'UTC+02:00', region: 'Европа', city: 'Киев' },
  { value: 'Europe/Istanbul', label: 'Стамбул, Анкара, Турция (UTC+3)', offset: 'UTC+03:00', region: 'Европа', city: 'Стамбул' },
  { value: 'Asia/Jerusalem', label: 'Иерусалим, Тель-Авив, Израиль (UTC+2 / UTC+3)', offset: 'UTC+02:00', region: 'Ближний Восток', city: 'Иерусалим' },
  { value: 'Asia/Riyadh', label: 'Эр-Рияд, Саудовская Аравия (UTC+3)', offset: 'UTC+03:00', region: 'Ближний Восток', city: 'Эр-Рияд' },
  { value: 'Asia/Tehran', label: 'Тегеран, Иран (UTC+3:30)', offset: 'UTC+03:30', region: 'Ближний Восток', city: 'Тегеран' },
  { value: 'Asia/Kolkata', label: 'Дели, Мумбаи, Индия (UTC+5:30)', offset: 'UTC+05:30', region: 'Азия', city: 'Нью-Дели' },
  { value: 'Asia/Dhaka', label: 'Дакка, Бангладеш (UTC+6)', offset: 'UTC+06:00', region: 'Азия', city: 'Дакка' },
  { value: 'Asia/Bangkok', label: 'Бангкок, Пхукет, Таиланд (UTC+7)', offset: 'UTC+07:00', region: 'Азия', city: 'Бангкок' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Хошимин, Вьетнам (UTC+7)', offset: 'UTC+07:00', region: 'Азия', city: 'Хошимин' },
  { value: 'Asia/Jakarta', label: 'Джакарта, Бали, Индонезия (UTC+7)', offset: 'UTC+07:00', region: 'Азия', city: 'Джакарта' },
  { value: 'Asia/Singapore', label: 'Сингапур (UTC+8)', offset: 'UTC+08:00', region: 'Азия', city: 'Сингапур' },
  { value: 'Asia/Kuala_Lumpur', label: 'Куала-Лумпур, Малайзия (UTC+8)', offset: 'UTC+08:00', region: 'Азия', city: 'Куала-Лумпур' },
  { value: 'Asia/Shanghai', label: 'Пекин, Шанхай, Китай (UTC+8)', offset: 'UTC+08:00', region: 'Азия', city: 'Пекин' },
  { value: 'Asia/Hong_Kong', label: 'Гонконг (UTC+8)', offset: 'UTC+08:00', region: 'Азия', city: 'Гонконг' },
  { value: 'Asia/Taipei', label: 'Тайбэй, Тайвань (UTC+8)', offset: 'UTC+08:00', region: 'Азия', city: 'Тайбэй' },
  { value: 'Asia/Seoul', label: 'Сеул, Южная Корея (UTC+9)', offset: 'UTC+09:00', region: 'Азия', city: 'Сеул' },
  { value: 'Asia/Tokyo', label: 'Токио, Киото, Япония (UTC+9)', offset: 'UTC+09:00', region: 'Азия', city: 'Токио' },
  { value: 'Australia/Perth', label: 'Перт, Западная Австралия (UTC+8)', offset: 'UTC+08:00', region: 'Австралия и Океания', city: 'Перт' },
  { value: 'Australia/Adelaide', label: 'Аделаида (UTC+9:30)', offset: 'UTC+09:30', region: 'Австралия и Океания', city: 'Аделаида' },
  { value: 'Australia/Sydney', label: 'Сидней, Мельбурн, Канберра (UTC+10 / UTC+11)', offset: 'UTC+10:00', region: 'Австралия и Океания', city: 'Сидней' },
  { value: 'Pacific/Auckland', label: 'Окленд, Новая Зеландия (UTC+12 / UTC+13)', offset: 'UTC+12:00', region: 'Австралия и Океания', city: 'Окленд' },

  // Americas
  { value: 'America/New_York', label: 'Нью-Йорк, Вашингтон, Майами (UTC-5 / UTC-4)', offset: 'UTC-05:00', region: 'Северная Америка', city: 'Нью-Йорк' },
  { value: 'America/Chicago', label: 'Чикаго, Даллас, Хьюстон (UTC-6 / UTC-5)', offset: 'UTC-06:00', region: 'Северная Америка', city: 'Чикаго' },
  { value: 'America/Denver', label: 'Денвер, Солт-Лейк-Сити (UTC-7 / UTC-6)', offset: 'UTC-07:00', region: 'Северная Америка', city: 'Денвер' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес, Сан-Франциско, Сиэтл (UTC-8 / UTC-7)', offset: 'UTC-08:00', region: 'Северная Америка', city: 'Лос-Анджелес' },
  { value: 'America/Anchorage', label: 'Анкоридж, Аляска (UTC-9 / UTC-8)', offset: 'UTC-09:00', region: 'Северная Америка', city: 'Анкоридж' },
  { value: 'Pacific/Honolulu', label: 'Гонолулу, Гавайи (UTC-10)', offset: 'UTC-10:00', region: 'Северная Америка', city: 'Гонолулу' },
  { value: 'America/Toronto', label: 'Торонто, Монреаль, Канада (UTC-5 / UTC-4)', offset: 'UTC-05:00', region: 'Северная Америка', city: 'Торонто' },
  { value: 'America/Vancouver', label: 'Ванкувер, Канада (UTC-8 / UTC-7)', offset: 'UTC-08:00', region: 'Северная Америка', city: 'Ванкувер' },
  { value: 'America/Mexico_City', label: 'Мехико, Мексика (UTC-6)', offset: 'UTC-06:00', region: 'Северная Америка', city: 'Мехико' },
  { value: 'America/Bogota', label: 'Богота, Колумбия (UTC-5)', offset: 'UTC-05:00', region: 'Южная Америка', city: 'Богота' },
  { value: 'America/Lima', label: 'Лима, Перу (UTC-5)', offset: 'UTC-05:00', region: 'Южная Америка', city: 'Лима' },
  { value: 'America/Sao_Paulo', label: 'Сан-Паулу, Рио-де-Жанейро, Бразилия (UTC-3)', offset: 'UTC-03:00', region: 'Южная Америка', city: 'Сан-Паулу' },
  { value: 'America/Buenos_Aires', label: 'Буэнос-Айрес, Аргентина (UTC-3)', offset: 'UTC-03:00', region: 'Южная Америка', city: 'Буэнос-Айрес' },
  { value: 'America/Santiago', label: 'Сантьяго, Чили (UTC-4 / UTC-3)', offset: 'UTC-04:00', region: 'Южная Америка', city: 'Сантьяго' },

  // Africa
  { value: 'Africa/Cairo', label: 'Каир, Египет (UTC+2 / UTC+3)', offset: 'UTC+02:00', region: 'Африка', city: 'Каир' },
  { value: 'Africa/Johannesburg', label: 'Йоханнесбург, Кейптаун, ЮАР (UTC+2)', offset: 'UTC+02:00', region: 'Африка', city: 'Йоханнесбург' },
  { value: 'Africa/Nairobi', label: 'Найроби, Кения (UTC+3)', offset: 'UTC+03:00', region: 'Африка', city: 'Найроби' },
  { value: 'Africa/Lagos', label: 'Лагос, Нигерия (UTC+1)', offset: 'UTC+01:00', region: 'Африка', city: 'Лагос' },
  { value: 'Africa/Casablanca', label: 'Касабланка, Марокко (UTC+1)', offset: 'UTC+01:00', region: 'Африка', city: 'Касабланка' }
];

/**
 * Calculates current UTC offset string for any IANA timezone identifier
 */
export function getUtcOffset(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart && tzPart.value) {
      const match = tzPart.value.match(/GMT([+-]\d+(:?\d+)?)/i);
      if (match) {
        let off = match[1];
        if (!off.includes(':')) {
          off = off + ':00';
        }
        return `UTC${off}`;
      }
      if (tzPart.value === 'GMT' || tzPart.value === 'UTC') return 'UTC+00:00';
    }
  } catch (e) {
    // fallback
  }
  return 'UTC';
}

/**
 * Returns complete list of all supported timezones in browser/Node
 */
export function getAllWorldTimezones(): TimezoneOption[] {
  const map = new Map<string, TimezoneOption>();

  // Add all pre-configured popular timezones first
  POPULAR_TIMEZONES.forEach(tz => {
    map.set(tz.value, tz);
  });

  // Dynamically load all system/browser IANA timezones
  try {
    if (typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function') {
      const systemTimezones: string[] = (Intl as any).supportedValuesOf('timeZone');
      systemTimezones.forEach((tzName: string) => {
        if (!map.has(tzName)) {
          const regionPart = tzName.includes('/') ? tzName.split('/')[0] : 'Другие';
          const cityPart = tzName.includes('/') ? tzName.split('/')[1].replace(/_/g, ' ') : tzName;
          const offset = getUtcOffset(tzName);
          map.set(tzName, {
            value: tzName,
            label: `${tzName.replace(/_/g, ' ')} (${offset})`,
            offset,
            region: regionPart,
            city: cityPart
          });
        }
      });
    }
  } catch (e) {
    // Ignore if not supported in older runtime
  }

  return Array.from(map.values());
}

/**
 * Groups timezones by region for structured selects
 */
export function getGroupedTimezones(): Record<string, TimezoneOption[]> {
  const all = getAllWorldTimezones();
  const groups: Record<string, TimezoneOption[]> = {
    'Россия и СНГ': [],
    'Европа': [],
    'Азия': [],
    'Ближний Восток': [],
    'Северная Америка': [],
    'Южная Америка': [],
    'Австралия и Океания': [],
    'Африка': [],
    'Международные': [],
    'Все остальные': []
  };

  all.forEach(tz => {
    if (groups[tz.region]) {
      groups[tz.region].push(tz);
    } else if (tz.region.startsWith('Europe')) {
      groups['Европа'].push(tz);
    } else if (tz.region.startsWith('Asia')) {
      groups['Азия'].push(tz);
    } else if (tz.region.startsWith('America')) {
      groups['Северная Америка'].push(tz);
    } else if (tz.region.startsWith('Africa')) {
      groups['Африка'].push(tz);
    } else if (tz.region.startsWith('Pacific') || tz.region.startsWith('Australia')) {
      groups['Австралия и Океания'].push(tz);
    } else {
      groups['Все остальные'].push(tz);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

/**
 * Formats date/ISO string into YYYY-MM-DDTHH:mm representation in Europe/Moscow timezone for datetime-local inputs
 */
export function toMskInputString(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // If it's already a 16-char datetime-local format without timezone (e.g. 2026-10-17T13:08)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}`;
  } catch (e) {
    return d.toISOString().slice(0, 16);
  }
}

/**
 * Converts a datetime-local input string (assumed to be in Moscow UTC+3 timezone) to a UTC ISO string
 */
export function fromMskInputString(inputValue?: string | null): string {
  if (!inputValue) return new Date().toISOString();
  try {
    const trimmed = String(inputValue).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const clean = trimmed.length === 16 ? `${trimmed}:00+03:00` : `${trimmed}+03:00`;
      return new Date(clean).toISOString();
    }
    return new Date(trimmed).toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

/**
 * Formats a Date/ISO string to Russian readable date & time in Europe/Moscow timezone
 */
export function formatMskDateDisplay(dateVal: string | Date | number | null | undefined): { dateStr: string; timeStr: string; fullStr: string } {
  if (!dateVal) return { dateStr: 'Не указана', timeStr: 'Не указано', fullStr: 'Не указано' };
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return { dateStr: String(dateVal), timeStr: '', fullStr: String(dateVal) };
    const dateStr = d.toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('ru-RU', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit'
    });
    return {
      dateStr,
      timeStr,
      fullStr: `${dateStr} в ${timeStr} (МСК)`
    };
  } catch (e) {
    return { dateStr: String(dateVal), timeStr: '', fullStr: String(dateVal) };
  }
}
