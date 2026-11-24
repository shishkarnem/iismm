import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { saveDatabaseToDisk } from '../db/index';

export interface SystemConfigRow {
  id: string;
  domain: string;
  provider: string;
  merchant_login: string;
  pass1: string;
  pass2: string;
  result_url: string;
  result_method: string;
  success_url: string;
  success_method: string;
  fail_url: string;
  fail_method: string;
  oferta_url: string;
  hash_algo: string;
  tax_system: string;
  tariff_vat_rate: string;
  topup_vat_rate: string | null;
  is_test: number;
  enabled: number;
  updated_at: string;
  created_at: string;
}

export interface RobokassaInvoiceRow {
  id: string;
  inv_id: number;
  domain: string;
  merchant_login: string;
  user_id: string;
  payment_type: 'tariff' | 'topup';
  tariff_name: string | null;
  period_months: number;
  iirky_quantity: number;
  out_sum: string;
  receipt_json: string;
  is_recurring: number;
  parent_inv_id: number | null;
  status: 'pending' | 'paid' | 'failed';
  paid_at: string | null;
  created_at: string;
}

export function initSystemConfigsTable(_db: Database): void {
  // Payment configs are stored in cloud PostgreSQL ProTalk (iismm2); hardcoded credential seeds removed
}

function mapRowsToObjects<T>(res: any[]): T[] {
  if (!res || !res[0] || !res[0].values) return [];
  const cols: string[] = res[0].columns;
  return res[0].values.map((vals: any[]) => {
    const obj: Record<string, any> = {};
    cols.forEach((c, idx) => {
      obj[c] = vals[idx];
    });
    return obj as T;
  });
}

export function getAllSystemConfigsFromDb(db: Database): SystemConfigRow[] {
  initSystemConfigsTable(db);
  const res = db.exec("SELECT * FROM system_configs WHERE provider = 'robokassa' ORDER BY domain ASC");
  return mapRowsToObjects<SystemConfigRow>(res);
}

export function getSystemConfigByDomainFromDb(db: Database, rawDomainOrHost?: string | null): SystemConfigRow {
  initSystemConfigsTable(db);
  const configs = getAllSystemConfigsFromDb(db).filter((c) => Number(c.enabled) !== 0);
  if (configs.length === 0) {
    throw new Error('В таблице system_configs отсутствуют активные настройки Робокассы');
  }

  const clean = String(rawDomainOrHost || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '');

  if (clean) {
    const exactMatch = configs.find((c) => c.domain.toLowerCase() === clean);
    if (exactMatch) return exactMatch;

    const suffixMatch = configs.find((c) => clean.endsWith(`.${c.domain.toLowerCase()}`) || clean.includes(c.domain.toLowerCase()));
    if (suffixMatch) return suffixMatch;
  }

  // Fallback for preview/localhost testing: strictly return 'iismm.online' or first active row from DB
  const onlineRow = configs.find((c) => c.domain.toLowerCase() === 'iismm.online');
  return onlineRow || configs[0];
}

export function updateSystemConfigInDb(
  db: Database,
  domain: string,
  patch: Partial<Pick<SystemConfigRow, 'merchant_login' | 'pass1' | 'pass2' | 'result_url' | 'success_url' | 'fail_url' | 'oferta_url' | 'tariff_vat_rate' | 'topup_vat_rate' | 'is_test' | 'enabled'>>
): SystemConfigRow {
  initSystemConfigsTable(db);
  const target = getSystemConfigByDomainFromDb(db, domain);
  const nowIso = new Date().toISOString();

  const nextMerchant = patch.merchant_login !== undefined ? String(patch.merchant_login).trim() : target.merchant_login;
  const nextPass1 = patch.pass1 !== undefined && patch.pass1 !== '********' ? String(patch.pass1).trim() : target.pass1;
  const nextPass2 = patch.pass2 !== undefined && patch.pass2 !== '********' ? String(patch.pass2).trim() : target.pass2;
  const nextResultUrl = patch.result_url !== undefined ? String(patch.result_url).trim() : target.result_url;
  const nextSuccessUrl = patch.success_url !== undefined ? String(patch.success_url).trim() : target.success_url;
  const nextFailUrl = patch.fail_url !== undefined ? String(patch.fail_url).trim() : target.fail_url;
  const nextOfertaUrl = patch.oferta_url !== undefined ? String(patch.oferta_url).trim() : target.oferta_url;
  const nextTariffVat = patch.tariff_vat_rate !== undefined ? String(patch.tariff_vat_rate).trim() : target.tariff_vat_rate;
  const nextTopupVat = patch.topup_vat_rate !== undefined ? patch.topup_vat_rate : target.topup_vat_rate;
  const nextIsTest = patch.is_test !== undefined ? (patch.is_test ? 1 : 0) : target.is_test;
  const nextEnabled = patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : target.enabled;

  db.run(
    `UPDATE system_configs
     SET merchant_login = ?, pass1 = ?, pass2 = ?,
         result_url = ?, success_url = ?, fail_url = ?, oferta_url = ?,
         tariff_vat_rate = ?, topup_vat_rate = ?, is_test = ?, enabled = ?, updated_at = ?
     WHERE id = ?`,
    [
      nextMerchant, nextPass1, nextPass2,
      nextResultUrl, nextSuccessUrl, nextFailUrl, nextOfertaUrl,
      nextTariffVat, nextTopupVat, nextIsTest, nextEnabled, nowIso,
      target.id
    ]
  );

  saveDatabaseToDisk();
  return getSystemConfigByDomainFromDb(db, target.domain);
}

export function allocateNextRobokassaInvId(db: Database): number {
  initSystemConfigsTable(db);
  // Robokassa requires InvId in [1 .. 2147483647]
  const baseEpoch = Math.min(2147000000, Math.max(100000, Math.floor(Date.now() / 1000)));
  const maxRes = db.exec("SELECT MAX(inv_id) FROM robokassa_invoices");
  const currentMax = Number(maxRes[0]?.values?.[0]?.[0] || 0);
  if (currentMax >= baseEpoch) {
    return Math.min(2147483647, currentMax + 1);
  }
  return baseEpoch;
}

export function getRobokassaInvoiceByInvId(db: Database, invId: number): RobokassaInvoiceRow | null {
  initSystemConfigsTable(db);
  const res = db.exec("SELECT * FROM robokassa_invoices WHERE inv_id = ? LIMIT 1", [invId]);
  const rows = mapRowsToObjects<RobokassaInvoiceRow>(res);
  return rows[0] || null;
}
