export type CanonicalTariffName = 'Старт' | 'Разгон' | 'Отрыв' | 'Космос';

export enum TariffLevel {
  Start = 0,
  Razgon = 1,
  Otryv = 2,
  Cosmos = 3,
}

export function getNormalizedTariffName(rawTariff?: string | null, role?: string | null): CanonicalTariffName | string {
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

export function getTariffLevel(rawTariff?: string | null, role?: string | null): number {
  const cleanRole = String(role || '').trim().toLowerCase();
  if (cleanRole === 'admin') {
    return TariffLevel.Cosmos;
  }

  const raw = String(rawTariff || '').trim();
  if (!raw) return TariffLevel.Start;

  const lower = raw.toLowerCase();
  if (lower === 'cosmos' || lower === 'космос' || lower === 'vip' || lower.includes('космос')) {
    return TariffLevel.Cosmos;
  }
  if (lower === 'otryv' || lower === 'отрыв' || lower === 'business' || lower.includes('отрыв')) {
    return TariffLevel.Otryv;
  }
  if (lower === 'razgon' || lower === 'разгон' || lower === 'pro' || lower.includes('разгон')) {
    return TariffLevel.Razgon;
  }
  if (lower === 'start' || lower === 'старт' || lower === 'free' || lower === 'базовый') {
    return TariffLevel.Start;
  }

  // Custom tariffs assigned by admin operate above Start (equivalent to Otryv/Cosmos privileges)
  return TariffLevel.Cosmos;
}

export function canUseRazgon(rawTariff?: string | null, role?: string | null): boolean {
  return getTariffLevel(rawTariff, role) >= TariffLevel.Razgon;
}

export function canUseOtryv(rawTariff?: string | null, role?: string | null): boolean {
  return getTariffLevel(rawTariff, role) >= TariffLevel.Otryv;
}

export function canUseCosmos(rawTariff?: string | null, role?: string | null): boolean {
  return getTariffLevel(rawTariff, role) >= TariffLevel.Cosmos;
}

export function hasRainbowHeart(rawTariff?: string | null, role?: string | null): boolean {
  return getTariffLevel(rawTariff, role) >= TariffLevel.Razgon;
}

export function getRequiredTariffLabel(minLevel: number): CanonicalTariffName {
  if (minLevel >= TariffLevel.Cosmos) return 'Космос';
  if (minLevel >= TariffLevel.Otryv) return 'Отрыв';
  if (minLevel >= TariffLevel.Razgon) return 'Разгон';
  return 'Старт';
}
