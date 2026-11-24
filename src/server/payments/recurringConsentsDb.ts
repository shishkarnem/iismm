import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { Request } from 'express';
import { saveDatabaseToDisk } from '../db/index';

export const RECURRING_CONSENT_TEXT =
  'Я согласен на автоматические списания согласно условиям оферты';

export interface RecurringConsentRecord {
  id: string;
  user_id: string;
  email: string;
  domain: string;
  tariff_name: string;
  amount_rub: number;
  period_days: number;
  next_charge_at: string;
  consent_checked: number;
  consent_text: string;
  oferta_url: string;
  ip_address: string;
  user_agent: string;
  inv_id: number | null;
  status: 'active' | 'revoked';
  agreed_at: string;
  revoked_at: string | null;
  created_at: string;
}

export function initRecurringConsentsTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS recurring_consents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT,
      domain TEXT,
      tariff_name TEXT,
      amount_rub REAL DEFAULT 0,
      period_days INTEGER DEFAULT 30,
      next_charge_at TEXT,
      consent_checked INTEGER DEFAULT 1,
      consent_text TEXT NOT NULL,
      oferta_url TEXT,
      ip_address TEXT,
      user_agent TEXT,
      inv_id INTEGER,
      status TEXT DEFAULT 'active',
      agreed_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function extractClientMetaFromReq(req?: Request): { ipAddress: string; userAgent: string } {
  if (!req) {
    return { ipAddress: '127.0.0.1', userAgent: 'server' };
  }
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const ua = String(req.headers['user-agent'] || 'web-client').slice(0, 500);
  return {
    ipAddress: String(rawIp || '127.0.0.1').slice(0, 120),
    userAgent: ua
  };
}

export function recordRecurringConsentInDb(
  db: Database,
  params: {
    userId: string;
    email?: string;
    domain: string;
    tariffName: string;
    amountRub: number;
    periodDays?: number;
    consentText?: string;
    ofertaUrl?: string;
    invId?: number;
    req?: Request;
  }
): RecurringConsentRecord {
  initRecurringConsentsTable(db);
  const now = new Date();
  const nowIso = now.toISOString();
  const periodDays = Math.max(1, Number(params.periodDays) || 30);
  const nextChargeIso = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000).toISOString();
  const { ipAddress, userAgent } = extractClientMetaFromReq(params.req);
  const id = `rc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cleanDomain = (params.domain || 'iismm.online').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const ofertaUrl = params.ofertaUrl || `https://${cleanDomain}/oferta`;
  const consentText = (params.consentText || RECURRING_CONSENT_TEXT).trim();

  db.run(
    `INSERT INTO recurring_consents (
      id, user_id, email, domain, tariff_name, amount_rub, period_days,
      next_charge_at, consent_checked, consent_text, oferta_url,
      ip_address, user_agent, inv_id, status, agreed_at, revoked_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'active', ?, NULL, ?)`,
    [
      id,
      String(params.userId || ''),
      String(params.email || ''),
      cleanDomain,
      String(params.tariffName || 'Разгон'),
      Number(params.amountRub) || 0,
      periodDays,
      nextChargeIso,
      consentText,
      ofertaUrl,
      ipAddress,
      userAgent,
      params.invId ?? null,
      nowIso,
      nowIso
    ]
  );

  saveDatabaseToDisk();

  return {
    id,
    user_id: String(params.userId || ''),
    email: String(params.email || ''),
    domain: cleanDomain,
    tariff_name: String(params.tariffName || 'Разгон'),
    amount_rub: Number(params.amountRub) || 0,
    period_days: periodDays,
    next_charge_at: nextChargeIso,
    consent_checked: 1,
    consent_text: consentText,
    oferta_url: ofertaUrl,
    ip_address: ipAddress,
    user_agent: userAgent,
    inv_id: params.invId ?? null,
    status: 'active',
    agreed_at: nowIso,
    revoked_at: null,
    created_at: nowIso
  };
}

export function revokeUserRecurringConsentsInDb(db: Database, userId: string): number {
  initRecurringConsentsTable(db);
  const cleanUid = String(userId || '').trim();
  if (!cleanUid) return 0;
  const nowIso = new Date().toISOString();

  db.run(
    `UPDATE recurring_consents
     SET status = 'revoked', revoked_at = ?
     WHERE user_id = ? AND status = 'active'`,
    [nowIso, cleanUid]
  );
  saveDatabaseToDisk();
  return 1;
}

export function getUserRecurringConsentsFromDb(db: Database, userId: string): RecurringConsentRecord[] {
  initRecurringConsentsTable(db);
  const cleanUid = String(userId || '').trim();
  if (!cleanUid) return [];
  const res = db.exec(
    'SELECT * FROM recurring_consents WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [cleanUid]
  );
  if (!res[0]) return [];
  const cols = res[0].columns;
  return res[0].values.map((vals) => {
    const obj: any = {};
    cols.forEach((c, idx) => {
      obj[c] = vals[idx];
    });
    return obj as RecurringConsentRecord;
  });
}
