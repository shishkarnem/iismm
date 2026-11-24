import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';

export interface TariffRecord {
  id: string;
  name: string;
  price_iirky: string;
  price_rub: number;
  sub: string;
  continuation?: string;
  monthly_iirky: number;
  features: string; // JSON string of [{ title: string, desc: string }]
  is_active: number;
  sort_order: number;
  duration_days?: number;
  duration_text?: string;
  discount_3m?: number;
  discount_6m?: number;
  discount_12m?: number;
  target_user_id?: string;
  is_custom?: number;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_TARIFFS: TariffRecord[] = [];

export function initTariffsTable(_db: Database) {
  // Tariffs are persisted in cloud PostgreSQL ProTalk (iismm2); startup seeding removed
}

export function getAllTariffsFromDb(db: Database, targetUserId?: string): TariffRecord[] {
  try {
    let sql = "SELECT * FROM tarifs WHERE is_active = 1 AND (target_user_id IS NULL OR target_user_id = ''";
    if (targetUserId) {
      sql += " OR target_user_id = ?";
    }
    sql += ") ORDER BY sort_order ASC, created_at ASC";
    
    const stmt = db.prepare(sql);
    if (targetUserId) {
      stmt.bind([targetUserId]);
    }
    const list: TariffRecord[] = [];
    while (stmt.step()) {
      list.push(stmt.getAsObject() as any);
    }
    stmt.free();
    return list;
  } catch (e) {
    console.error('[TariffsTable] Error getting tariffs:', e);
    return [];
  }
}

export function getAllTariffsAdminFromDb(db: Database): TariffRecord[] {
  try {
    const stmt = db.prepare("SELECT * FROM tarifs ORDER BY sort_order ASC, created_at DESC");
    const list: TariffRecord[] = [];
    while (stmt.step()) {
      list.push(stmt.getAsObject() as any);
    }
    stmt.free();
    return list;
  } catch (e) {
    console.error('[TariffsTable] Error getting admin tariffs:', e);
    return [];
  }
}

export function getTariffById(db: Database, id: string): TariffRecord | null {
  try {
    const stmt = db.prepare("SELECT * FROM tarifs WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1");
    stmt.bind([id, id]);
    if (stmt.step()) {
      const res = stmt.getAsObject() as any;
      stmt.free();
      return res;
    }
    stmt.free();
    return null;
  } catch (e) {
    return null;
  }
}

export function createOrUpdateTariffInDb(
  db: Database,
  tariff: Partial<TariffRecord> & { name: string }
): TariffRecord {
  const now = new Date().toISOString();
  const id = tariff.id || `custom_tariff_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const name = tariff.name.trim();
  const price_rub = Number(tariff.price_rub) || 0;
  const price_iirky = tariff.price_iirky || (price_rub > 0 ? `${price_rub.toLocaleString('ru-RU')} ИИрок / мес` : 'Индивидуально');
  const sub = tariff.sub || 'Индивидуальный тариф';
  const continuation = tariff.continuation || '';
  const monthly_iirky = Number(tariff.monthly_iirky) || 0;
  const features = typeof tariff.features === 'string' ? tariff.features : JSON.stringify(tariff.features || []);
  const is_active = tariff.is_active !== undefined ? Number(tariff.is_active) : 1;
  const sort_order = Number(tariff.sort_order) || 10;
  const duration_days = Number(tariff.duration_days) || 30;
  const duration_text = tariff.duration_text || `${duration_days} дней`;
  const discount_3m = tariff.discount_3m !== undefined ? Number(tariff.discount_3m) : 10;
  const discount_6m = tariff.discount_6m !== undefined ? Number(tariff.discount_6m) : 15;
  const discount_12m = tariff.discount_12m !== undefined ? Number(tariff.discount_12m) : 20;
  const target_user_id = tariff.target_user_id || null;
  const is_custom = tariff.is_custom !== undefined ? Number(tariff.is_custom) : (['start', 'razgon', 'otryv', 'cosmos'].includes(id) ? 0 : 1);

  db.run(
    `INSERT OR REPLACE INTO tarifs (
      id, name, price_iirky, price_rub, sub, continuation, monthly_iirky, features, is_active, sort_order, duration_days, duration_text, discount_3m, discount_6m, discount_12m, target_user_id, is_custom, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM tarifs WHERE id = ?), ?), ?)`,
    [
      id, name, price_iirky, price_rub, sub, continuation, monthly_iirky, features, is_active, sort_order, duration_days, duration_text, discount_3m, discount_6m, discount_12m, target_user_id, is_custom, id, now, now
    ]
  );

  return {
    id,
    name,
    price_iirky,
    price_rub,
    sub,
    continuation,
    monthly_iirky,
    features,
    is_active,
    sort_order,
    duration_days,
    duration_text,
    discount_3m,
    discount_6m,
    discount_12m,
    target_user_id: target_user_id || undefined,
    is_custom,
    created_at: now,
    updated_at: now
  };
}

export function deleteTariffFromDb(db: Database, id: string): boolean {
  try {
    db.run("DELETE FROM tarifs WHERE id = ?", [id]);
    return true;
  } catch (e) {
    return false;
  }
}
