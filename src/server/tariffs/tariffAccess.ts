import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { getUserByIdFromDb } from '../db/usersTable';
import { normalizeUserId } from '../db/postgres';
import { getAllTariffsFromDb } from '../db/tariffsTable';

export enum ServerTariffLevel {
  Start = 0,
  Razgon = 1,
  Otryv = 2,
  Cosmos = 3,
}

export interface ResolvedUserTariff {
  userId: string;
  tariffId: string;
  tariffName: string;
  level: number;
  isAdmin: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  autoRenew: boolean;
}

export function normalizeServerTariffName(rawTariff?: string | null, role?: string | null): string {
  const cleanRole = String(role || '').trim().toLowerCase();
  if (cleanRole === 'admin') {
    return 'Космос';
  }
  const raw = String(rawTariff || '').trim();
  if (!raw) return 'Старт';

  const lower = raw.toLowerCase();
  if (lower === 'cosmos' || lower === 'космос' || lower === 'vip' || lower.includes('космос')) {
    return 'Космос';
  }
  if (lower === 'otryv' || lower === 'отрыв' || lower === 'business' || lower.includes('отрыв')) {
    return 'Отрыв';
  }
  if (lower === 'razgon' || lower === 'разгон' || lower === 'pro' || lower.includes('разгон')) {
    return 'Разгон';
  }
  if (lower === 'start' || lower === 'старт' || lower === 'free' || lower === 'базовый') {
    return 'Старт';
  }
  return raw;
}

export function getServerTariffLevel(rawTariff?: string | null, role?: string | null): number {
  const cleanRole = String(role || '').trim().toLowerCase();
  if (cleanRole === 'admin') {
    return ServerTariffLevel.Cosmos;
  }
  const raw = String(rawTariff || '').trim();
  if (!raw) return ServerTariffLevel.Start;

  const lower = raw.toLowerCase();
  if (lower === 'cosmos' || lower === 'космос' || lower === 'vip' || lower.includes('космос')) {
    return ServerTariffLevel.Cosmos;
  }
  if (lower === 'otryv' || lower === 'отрыв' || lower === 'business' || lower.includes('отрыв')) {
    return ServerTariffLevel.Otryv;
  }
  if (lower === 'razgon' || lower === 'разгон' || lower === 'pro' || lower.includes('разгон')) {
    return ServerTariffLevel.Razgon;
  }
  if (lower === 'start' || lower === 'старт' || lower === 'free' || lower === 'базовый') {
    return ServerTariffLevel.Start;
  }
  // Custom personal tariffs created by admin grant full access
  return ServerTariffLevel.Cosmos;
}

export function getRequiredTariffNameByLevel(minLevel: number): 'Старт' | 'Разгон' | 'Отрыв' | 'Космос' {
  if (minLevel >= ServerTariffLevel.Cosmos) return 'Космос';
  if (minLevel >= ServerTariffLevel.Otryv) return 'Отрыв';
  if (minLevel >= ServerTariffLevel.Razgon) return 'Разгон';
  return 'Старт';
}

export function resolveUserTariffInDb(db: Database, rawUserId?: string | number | null): ResolvedUserTariff {
  const rawStr = String(rawUserId ?? '').trim();
  if (!rawStr) {
    return {
      userId: '',
      tariffId: 'start',
      tariffName: 'Старт',
      level: ServerTariffLevel.Start,
      isAdmin: false,
      isExpired: false,
      expiresAt: null,
      autoRenew: true,
    };
  }
  const cleanId = normalizeUserId(rawStr);

  // Master developer/admin IDs always get full access
  if (cleanId === '169262990' || cleanId === '16926299042') {
    const adminRow = getUserByIdFromDb(db, cleanId) || getUserByIdFromDb(db, '16926299042') || getUserByIdFromDb(db, '169262990');
    return {
      userId: String(adminRow?.id || cleanId),
      tariffId: 'cosmos',
      tariffName: String(adminRow?.tariff || 'Космос'),
      level: ServerTariffLevel.Cosmos,
      isAdmin: true,
      isExpired: false,
      expiresAt: adminRow?.tariff_expires_at || null,
      autoRenew: adminRow?.auto_renew_tariff !== 0,
    };
  }

  const uRow = getUserByIdFromDb(db, cleanId) as any;
  if (!uRow) {
    return {
      userId: cleanId,
      tariffId: 'start',
      tariffName: 'Старт',
      level: ServerTariffLevel.Start,
      isAdmin: false,
      isExpired: false,
      expiresAt: null,
      autoRenew: true,
    };
  }

  const isAdmin = String(uRow.role || '').toLowerCase() === 'admin' || String(uRow.telegram_id || '') === '169262990';
  if (isAdmin) {
    return {
      userId: String(uRow.id),
      tariffId: 'cosmos',
      tariffName: normalizeServerTariffName(uRow.tariff || 'Космос', 'admin'),
      level: ServerTariffLevel.Cosmos,
      isAdmin: true,
      isExpired: false,
      expiresAt: uRow.tariff_expires_at || null,
      autoRenew: uRow.auto_renew_tariff !== 0,
    };
  }

  let effectiveRawTariff = String(uRow.tariff || 'Старт').trim() || 'Старт';
  let expiresAt: string | null = uRow.tariff_expires_at ? String(uRow.tariff_expires_at) : null;
  let isExpired = false;

  // Check if non-Start tariff has already expired
  const initialLevel = getServerTariffLevel(effectiveRawTariff, uRow.role);
  if (initialLevel > ServerTariffLevel.Start && expiresAt) {
    const expTime = new Date(expiresAt).getTime();
    if (!Number.isNaN(expTime) && expTime <= Date.now()) {
      isExpired = true;
      effectiveRawTariff = 'Старт';
      expiresAt = null;
    }
  }

  const normalizedName = normalizeServerTariffName(effectiveRawTariff, uRow.role);
  const allTariffs = getAllTariffsFromDb(db);
  const matchedTariff = allTariffs.find(
    (t) =>
      t.id.toLowerCase() === effectiveRawTariff.toLowerCase() ||
      t.name.toLowerCase() === normalizedName.toLowerCase()
  );

  return {
    userId: String(uRow.id),
    tariffId: matchedTariff?.id || 'start',
    tariffName: matchedTariff?.name || normalizedName,
    level: getServerTariffLevel(matchedTariff?.name || normalizedName, uRow.role),
    isAdmin: false,
    isExpired,
    expiresAt,
    autoRenew: uRow.auto_renew_tariff !== 0,
  };
}

export function checkTariffPermission(
  db: Database,
  rawUserId: string | number | null | undefined,
  minLevel: ServerTariffLevel,
  featureTitle: string
): {
  allowed: boolean;
  statusCode: number;
  payload?: {
    success: false;
    error: string;
    needUpgrade: true;
    requiredTariff: string;
    currentTariff: string;
  };
  resolved: ResolvedUserTariff;
} {
  const resolved = resolveUserTariffInDb(db, rawUserId);
  if (resolved.level >= minLevel) {
    return { allowed: true, statusCode: 200, resolved };
  }

  const requiredTariff = getRequiredTariffNameByLevel(minLevel);
  return {
    allowed: false,
    statusCode: 403,
    resolved,
    payload: {
      success: false,
      needUpgrade: true,
      requiredTariff,
      currentTariff: resolved.tariffName,
      error: `Функция «${featureTitle}» доступна начиная с тарифа «${requiredTariff}». Ваш текущий тариф: «${resolved.tariffName}».`,
    },
  };
}
