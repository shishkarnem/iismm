import * as crypto from 'crypto';
import { Request } from 'express';
import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import {
  SystemConfigRow,
  RobokassaInvoiceRow,
  getAllSystemConfigsFromDb,
  getSystemConfigByDomainFromDb,
  allocateNextRobokassaInvId,
  getRobokassaInvoiceByInvId
} from './systemConfigsDb';
import { normalizeUserId, savePgDB } from '../db/postgres';
import { changeUserTariffInDb } from '../tariffs/tariffLifecycle';
import { addTransactionWithBalanceUpdate } from '../db/transactionsTable';
import { DB } from '../db';
import { getPricingConfigFromDb } from '../pricing/pricingService';
import { computeTopupIirkyAmount } from '../../shared/pricingConfig';

export interface ReceiptItem54Fz {
  name: string;
  quantity: number;
  sum: number;
  tax: string | null;
}

export interface RobokassaReceipt54Fz {
  items: ReceiptItem54Fz[];
}

export interface CreateRobokassaPaymentParams {
  db: Database;
  req: Request;
  explicitDomain?: string;
  userId?: string;
  email?: string;
  amountRub: number;
  tariffName?: string;
  periodMonths?: number;
  paymentType?: 'tariff' | 'topup';
  recurring?: boolean;
}

export interface CreateRobokassaPaymentResult {
  paymentUrl: string;
  invId: number;
  outSum: string;
  domain: string;
  merchantLogin: string;
  paymentType: 'tariff' | 'topup';
  normalizedTariff: string | null;
  periodMonths: number;
  iirkyQuantity: number;
  receipt: RobokassaReceipt54Fz;
  receiptJson: string;
  signature: string;
  isRecurring: boolean;
  isTest: boolean;
}

function md5Hex(input: string): string {
  return crypto.createHash('md5').update(input, 'utf8').digest('hex');
}

export function extractDomainFromRequest(req: Request, explicitDomain?: string): string {
  const candidates = [
    explicitDomain,
    req.body?.domain,
    req.query?.domain,
    req.headers['x-forwarded-host'],
    req.headers.origin,
    req.headers.referer,
    req.headers.host
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const str = Array.isArray(raw) ? raw[0] : String(raw);
    const cleaned = str
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .split(':')[0]
      .replace(/^www\./, '');
    if (cleaned.includes('iismm.online')) return 'iismm.online';
    if (cleaned.includes('iismm.ru')) return 'iismm.ru';
  }

  // Fallback to raw host so getSystemConfigByDomainFromDb resolves strictly from DB
  const fallbackHost = String(explicitDomain || req.headers['x-forwarded-host'] || req.headers.host || '')
    .trim()
    .toLowerCase();
  return fallbackHost;
}

export function classifyPaymentAndTariff(rawTariffName?: string, explicitType?: string): {
  paymentType: 'tariff' | 'topup';
  normalizedTariff: string | null;
  asciiPlanCode: string;
} {
  const cleanName = String(rawTariffName || '').trim();
  const lower = cleanName.toLowerCase();

  if (explicitType === 'topup' || !cleanName || lower.includes('пополнение') || lower === 'custom' || lower === 'topup' || lower.includes('иирок')) {
    return { paymentType: 'topup', normalizedTariff: null, asciiPlanCode: 'topup' };
  }

  if (lower.includes('разгон') || lower === 'razgon' || lower === 'pro') {
    return { paymentType: 'tariff', normalizedTariff: 'Разгон', asciiPlanCode: 'razgon' };
  }
  if (lower.includes('отрыв') || lower === 'otryv' || lower === 'vip') {
    return { paymentType: 'tariff', normalizedTariff: 'Отрыв', asciiPlanCode: 'otryv' };
  }
  if (lower.includes('космос') || lower === 'cosmos' || lower === 'kosmos') {
    return { paymentType: 'tariff', normalizedTariff: 'Космос', asciiPlanCode: 'cosmos' };
  }

  if (explicitType === 'tariff') {
    return { paymentType: 'tariff', normalizedTariff: cleanName, asciiPlanCode: 'custom_tariff' };
  }

  return { paymentType: 'topup', normalizedTariff: null, asciiPlanCode: 'topup' };
}

export function buildFiscalReceipt54Fz(params: {
  cfg: SystemConfigRow;
  paymentType: 'tariff' | 'topup';
  normalizedTariff: string | null;
  periodMonths: number;
  numAmount: number;
  isRecurring: boolean;
  topupIirkyOverride?: number;
}): {
  receipt: RobokassaReceipt54Fz;
  receiptJson: string;
  description: string;
  iirkyQuantity: number;
} {
  const roundedSum = Math.round(params.numAmount * 100) / 100;
  const iirkyCount =
    params.paymentType === 'topup' && params.topupIirkyOverride && params.topupIirkyOverride > 0
      ? Math.max(1, Math.round(params.topupIirkyOverride))
      : Math.max(1, Math.round(roundedSum));

  if (params.paymentType === 'tariff' && params.normalizedTariff) {
    const months = [1, 3, 6, 12].includes(Number(params.periodMonths)) ? Number(params.periodMonths) : 1;
    // Literal nomenclature matching Public Offer word-for-word
    const itemName =
      months === 1
        ? `Ежемесячная подписка на тариф «${params.normalizedTariff}» сервиса ИИSMM`
        : `Подписка на тариф «${params.normalizedTariff}» сервиса ИИSMM`;

    const receipt: RobokassaReceipt54Fz = {
      items: [
        {
          name: itemName,
          quantity: months,
          sum: roundedSum,
          tax: params.cfg.tariff_vat_rate || 'vat5'
        }
      ]
    };
    const receiptJson = JSON.stringify(receipt);
    const description =
      months === 1
        ? `Ежемесячная подписка на тариф «${params.normalizedTariff}» сервиса ИИSMM`
        : `Подписка на тариф «${params.normalizedTariff}» сервиса ИИSMM (${months} мес.)`;

    return {
      receipt,
      receiptJson,
      description,
      iirkyQuantity: iirkyCount
    };
  }

  // Top-up of virtual units Iirky: literal Offer wording + tax: null + quantity = Iirky count
  const receipt: RobokassaReceipt54Fz = {
    items: [
      {
        name: 'Виртуальные единицы ИИрки',
        quantity: iirkyCount,
        sum: roundedSum,
        tax: params.cfg.topup_vat_rate ?? null
      }
    ]
  };
  const receiptJson = JSON.stringify(receipt);
  const description = `Пополнение баланса сервиса ИИSMM: Виртуальные единицы ИИрки (${iirkyCount} шт.)`;

  return {
    receipt,
    receiptJson,
    description,
    iirkyQuantity: iirkyCount
  };
}

/**
 * Formats Shp_ parameters sorted strictly alphabetically by parameter name for Robokassa MD5 signature.
 */
export function buildSortedShpSignaturePart(shpMap: Record<string, string | number>): {
  signatureSuffix: string;
  queryStringPart: string;
} {
  const keys = Object.keys(shpMap)
    .filter((k) => k.toLowerCase().startsWith('shp_') && shpMap[k] !== undefined && shpMap[k] !== null && String(shpMap[k]) !== '')
    .sort((a, b) => a.localeCompare(b, 'en'));

  const sigPairs = keys.map((k) => `${k}=${String(shpMap[k])}`);
  const queryPairs = keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(shpMap[k]))}`);

  return {
    signatureSuffix: sigPairs.join(':'),
    queryStringPart: queryPairs.join('&')
  };
}

export function resolveUserIdByIdentifier(db: Database, rawIdentifier?: string): string {
  const raw = String(rawIdentifier || '').trim();
  if (!raw) return '16926299042';

  if (raw.includes('@') && raw.includes('.')) {
    const cleanEmail = raw.toLowerCase();
    const res = db.exec("SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1", [cleanEmail]);
    if (res[0]?.values?.[0]?.[0]) {
      return normalizeUserId(String(res[0].values[0][0]));
    }
  }

  const cleanHandle = raw.startsWith('@') ? raw : `@${raw}`;
  if (raw.startsWith('@')) {
    const res = db.exec("SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1", [cleanHandle]);
    if (res[0]?.values?.[0]?.[0]) {
      return normalizeUserId(String(res[0].values[0][0]));
    }
  }

  return normalizeUserId(raw);
}

export function createRobokassaPaymentLink(params: CreateRobokassaPaymentParams): CreateRobokassaPaymentResult {
  const detectedDomain = extractDomainFromRequest(params.req, params.explicitDomain);
  const cfg = getSystemConfigByDomainFromDb(params.db, detectedDomain);

  const numAmount = Math.round((Number(params.amountRub) || 0) * 100) / 100;
  if (numAmount < 10) {
    throw new Error('Минимальная сумма оплаты составляет 10 рублей');
  }

  const outSum = numAmount.toFixed(2);
  const invId = allocateNextRobokassaInvId(params.db);
  const resolvedUserId = resolveUserIdByIdentifier(params.db, params.userId);
  const safeAsciiUserId = resolvedUserId.replace(/[^a-zA-Z0-9._-]/g, '');

  const { paymentType, normalizedTariff, asciiPlanCode } = classifyPaymentAndTariff(
    params.tariffName,
    params.paymentType
  );
  const periodMonths = paymentType === 'tariff' && [1, 3, 6, 12].includes(Number(params.periodMonths))
    ? Number(params.periodMonths)
    : 1;

  // Enable recurring monthly subscription only when explicitly requested on a 1-month tariff
  const isRecurring = Boolean(params.recurring && paymentType === 'tariff' && periodMonths === 1);

  const pricing = getPricingConfigFromDb(params.db);
  const topupIirkyOverride = paymentType === 'topup' ? computeTopupIirkyAmount(numAmount, pricing) : undefined;

  const { receipt, receiptJson, description, iirkyQuantity } = buildFiscalReceipt54Fz({
    cfg,
    paymentType,
    normalizedTariff,
    periodMonths,
    numAmount,
    isRecurring,
    topupIirkyOverride
  });

  // Pure ASCII Shp_ parameters sorted alphabetically to eliminate any UTF-8/CP1251 encoding mismatch
  const shpMap: Record<string, string | number> = {
    shp_domain: cfg.domain,
    shp_months: periodMonths,
    shp_plan: asciiPlanCode,
    shp_type: paymentType,
    shp_user_id: safeAsciiUserId || '16926299042'
  };

  const { signatureSuffix, queryStringPart } = buildSortedShpSignaturePart(shpMap);

  // Robokassa 54-FZ MD5 signature: MerchantLogin:OutSum:InvId:Receipt:Pass1[:shp_...]
  // IMPORTANT: Receipt JSON goes into signature UNENCODED (raw JSON), and into URL encoded ONCE!
  const signatureRaw = signatureSuffix
    ? `${cfg.merchant_login}:${outSum}:${invId}:${receiptJson}:${cfg.pass1}:${signatureSuffix}`
    : `${cfg.merchant_login}:${outSum}:${invId}:${receiptJson}:${cfg.pass1}`;

  const signature = md5Hex(signatureRaw);
  const isTest = Number(cfg.is_test) === 1;

  // Resolve optional user email for Robokassa receipt prefill
  let userEmail = String(params.email || '').trim();
  if (!userEmail && params.userId && String(params.userId).includes('@') && String(params.userId).includes('.')) {
    userEmail = String(params.userId).trim();
  }
  if (!userEmail) {
    try {
      const emailRes = params.db.exec("SELECT email FROM users WHERE id = ? LIMIT 1", [resolvedUserId]);
      const dbEmail = String(emailRes[0]?.values?.[0]?.[0] || '').trim();
      if (dbEmail && dbEmail.includes('@')) userEmail = dbEmail;
    } catch (e) {}
  }

  const queryParts: string[] = [
    `MerchantLogin=${encodeURIComponent(cfg.merchant_login)}`,
    `OutSum=${outSum}`,
    `InvId=${invId}`,
    `Description=${encodeURIComponent(description)}`,
    `Receipt=${encodeURIComponent(receiptJson)}`,
    `SignatureValue=${signature}`
  ];

  if (userEmail) {
    queryParts.push(`Email=${encodeURIComponent(userEmail)}`);
  }
  if (queryStringPart) {
    queryParts.push(queryStringPart);
  }
  if (isRecurring) {
    queryParts.push('Recurring=true');
  }
  if (isTest) {
    queryParts.push('IsTest=1');
  }

  const paymentUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${queryParts.join('&')}`;
  const nowIso = new Date().toISOString();

  params.db.run(
    `INSERT INTO robokassa_invoices (
      id, inv_id, domain, merchant_login, user_id, payment_type,
      tariff_name, period_months, iirky_quantity, out_sum, receipt_json,
      is_recurring, parent_inv_id, status, paid_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, ?)`,
    [
      `rk_inv_${invId}`,
      invId,
      cfg.domain,
      cfg.merchant_login,
      resolvedUserId,
      paymentType,
      normalizedTariff,
      periodMonths,
      iirkyQuantity,
      outSum,
      receiptJson,
      isRecurring ? 1 : 0,
      nowIso
    ]
  );

  savePgDB();

  return {
    paymentUrl,
    invId,
    outSum,
    domain: cfg.domain,
    merchantLogin: cfg.merchant_login,
    paymentType,
    normalizedTariff,
    periodMonths,
    iirkyQuantity,
    receipt,
    receiptJson,
    signature,
    isRecurring,
    isTest
  };
}

function extractIncomingParams(req: Request): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const src of [req.query, req.body]) {
    if (src && typeof src === 'object') {
      for (const [k, v] of Object.entries(src)) {
        if (v !== undefined && v !== null) {
          merged[k] = Array.isArray(v) ? String(v[0]) : String(v);
        }
      }
    }
  }
  return merged;
}

function collectSortedShpFromIncoming(incoming: Record<string, string>): string {
  const shpKeys = Object.keys(incoming)
    .filter((k) => k.toLowerCase().startsWith('shp_'))
    .sort((a, b) => a.localeCompare(b, 'en'));
  return shpKeys.map((k) => `${k}=${incoming[k]}`).join(':');
}

function findMatchingConfigForSignature(
  db: Database,
  outSum: string,
  invId: string,
  incomingSignature: string,
  shpSorted: string,
  passField: 'pass1' | 'pass2',
  hintDomain?: string
): SystemConfigRow | null {
  const allConfigs = getAllSystemConfigsFromDb(db).filter((c) => Number(c.enabled) !== 0);
  const ordered = hintDomain
    ? [
        ...allConfigs.filter((c) => c.domain.toLowerCase() === hintDomain.toLowerCase()),
        ...allConfigs.filter((c) => c.domain.toLowerCase() !== hintDomain.toLowerCase())
      ]
    : allConfigs;

  const cleanSig = incomingSignature.trim().toLowerCase();

  for (const cfg of ordered) {
    const pass = cfg[passField];
    const baseStr = shpSorted ? `${outSum}:${invId}:${pass}:${shpSorted}` : `${outSum}:${invId}:${pass}`;
    const expected = md5Hex(baseStr).toLowerCase();
    if (expected === cleanSig) {
      return cfg;
    }
  }

  return null;
}

function resolveTariffFromInvoiceOrShp(invoice: RobokassaInvoiceRow | null, shpPlan?: string): string | null {
  if (invoice?.payment_type === 'tariff' && invoice.tariff_name) {
    return invoice.tariff_name;
  }
  const code = String(shpPlan || '').toLowerCase();
  if (code === 'razgon') return 'Разгон';
  if (code === 'otryv') return 'Отрыв';
  if (code === 'cosmos') return 'Космос';
  return null;
}

export function processRobokassaResultCallback(db: Database, req: Request): {
  ok: boolean;
  responseText: string;
  statusCode: number;
  alreadyProcessed?: boolean;
} {
  const incoming = extractIncomingParams(req);
  const outSum = incoming.OutSum || incoming.out_sum || '';
  const invIdRaw = incoming.InvId || incoming.inv_id || '';
  const signatureValue = incoming.SignatureValue || incoming.crc || '';

  if (!outSum || !invIdRaw || !signatureValue) {
    return { ok: false, responseText: 'bad request: missing OutSum, InvId or SignatureValue', statusCode: 400 };
  }

  const invId = Number(invIdRaw);
  const invoice = Number.isFinite(invId) && invId > 0 ? getRobokassaInvoiceByInvId(db, invId) : null;
  const shpSorted = collectSortedShpFromIncoming(incoming);
  const hintDomain = incoming.shp_domain || invoice?.domain || extractDomainFromRequest(req);

  const matchedCfg = findMatchingConfigForSignature(
    db,
    outSum,
    invIdRaw,
    signatureValue,
    shpSorted,
    'pass2',
    hintDomain
  );

  if (!matchedCfg) {
    console.error(`[Robokassa Result] Invalid SignatureValue for InvId=${invIdRaw}, OutSum=${outSum}`);
    return { ok: false, responseText: 'bad sign', statusCode: 400 };
  }

  // Idempotency guard: if invoice was already paid, return OK{InvId} without double-crediting
  if (invoice && invoice.status === 'paid') {
    return { ok: true, responseText: `OK${invIdRaw}`, statusCode: 200, alreadyProcessed: true };
  }

  const numAmount = Math.round((parseFloat(outSum) || 0) * 100) / 100;
  const userId = normalizeUserId(invoice?.user_id || incoming.shp_user_id || '16926299042');
  const paymentType = (invoice?.payment_type || incoming.shp_type || 'topup') as 'tariff' | 'topup';
  const periodMonths = Number(invoice?.period_months || incoming.shp_months || 1) || 1;
  const targetTariff = paymentType === 'tariff' ? resolveTariffFromInvoiceOrShp(invoice, incoming.shp_plan) : null;
  const nowIso = new Date().toISOString();

  if (targetTariff) {
    const tariffRes = changeUserTariffInDb(db, {
      userId,
      tariffName: targetTariff,
      periodMonths,
      paidViaRobokassaRub: numAmount
    });
    if (tariffRes.success && tariffRes.tariff) {
      try {
        DB.updateUser(userId, { tariff: tariffRes.tariff, balance: tariffRes.balance });
      } catch (e) {}
    } else {
      // Fallback: if user or custom tariff had an issue, never lose user's paid money — credit paid Iirky
      addTransactionWithBalanceUpdate(db, {
        userId,
        type: 'pay',
        balanceType: 'pay',
        amount: Math.round(numAmount),
        description: `Оплата через Робокассу #${invIdRaw} (+${Math.round(numAmount)} ИИрок)`,
        createdAt: nowIso
      });
    }
  } else {
    const iirkyCount = invoice?.iirky_quantity || Math.max(1, Math.round(numAmount));
    const txRes = addTransactionWithBalanceUpdate(db, {
      userId,
      type: 'pay',
      balanceType: 'pay',
      amount: iirkyCount,
      description: `Пополнение через Робокассу (${matchedCfg.domain}, счёт #${invIdRaw}): +${iirkyCount} ИИрок`,
      createdAt: nowIso
    });
    try {
      DB.updateUser(userId, { balance: txRes.newBalances.balance });
    } catch (e) {}
  }

  if (invoice) {
    db.run(
      "UPDATE robokassa_invoices SET status = 'paid', paid_at = ? WHERE inv_id = ?",
      [nowIso, invId]
    );
  } else if (Number.isFinite(invId) && invId > 0) {
    db.run(
      `INSERT OR REPLACE INTO robokassa_invoices (
        id, inv_id, domain, merchant_login, user_id, payment_type,
        tariff_name, period_months, iirky_quantity, out_sum, receipt_json,
        is_recurring, parent_inv_id, status, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 0, NULL, 'paid', ?, ?)`,
      [
        `rk_inv_${invId}`,
        invId,
        matchedCfg.domain,
        matchedCfg.merchant_login,
        userId,
        paymentType,
        targetTariff,
        periodMonths,
        Math.max(1, Math.round(numAmount)),
        outSum,
        nowIso,
        nowIso
      ]
    );
  }

  savePgDB();
  return { ok: true, responseText: `OK${invIdRaw}`, statusCode: 200 };
}

export function verifyRobokassaSuccessRedirect(db: Database, req: Request): {
  verified: boolean;
  invId?: string;
  outSum?: string;
  domain?: string;
  paymentType?: string;
  tariffName?: string | null;
  iirkyQuantity?: number;
  status?: string;
} {
  const incoming = extractIncomingParams(req);
  const outSum = incoming.OutSum || incoming.out_sum || '';
  const invIdRaw = incoming.InvId || incoming.inv_id || '';
  const signatureValue = incoming.SignatureValue || incoming.crc || '';

  const invIdNum = Number(invIdRaw);
  const invoice = Number.isFinite(invIdNum) && invIdNum > 0 ? getRobokassaInvoiceByInvId(db, invIdNum) : null;

  if (!outSum || !invIdRaw || !signatureValue) {
    return {
      verified: Boolean(invoice && invoice.status === 'paid'),
      invId: invIdRaw || undefined,
      outSum: outSum || invoice?.out_sum,
      domain: invoice?.domain,
      paymentType: invoice?.payment_type,
      tariffName: invoice?.tariff_name,
      iirkyQuantity: invoice?.iirky_quantity,
      status: invoice?.status
    };
  }

  const shpSorted = collectSortedShpFromIncoming(incoming);
  const hintDomain = incoming.shp_domain || invoice?.domain || extractDomainFromRequest(req);
  const matchedCfg = findMatchingConfigForSignature(
    db,
    outSum,
    invIdRaw,
    signatureValue,
    shpSorted,
    'pass1',
    hintDomain
  );

  return {
    verified: Boolean(matchedCfg),
    invId: invIdRaw,
    outSum,
    domain: matchedCfg?.domain || invoice?.domain,
    paymentType: invoice?.payment_type || incoming.shp_type,
    tariffName: invoice?.tariff_name || resolveTariffFromInvoiceOrShp(invoice, incoming.shp_plan),
    iirkyQuantity: invoice?.iirky_quantity || Math.round(parseFloat(outSum) || 0),
    status: invoice?.status || (matchedCfg ? 'verified' : 'pending')
  };
}

/**
 * Triggers subsequent recurring monthly charge via Robokassa /Merchant/Recurring
 * using the exact same 54-FZ Receipt JSON with tariff name and vat5.
 */
export async function triggerRobokassaRecurringCharge(db: Database, parentInvId: number): Promise<{
  success: boolean;
  newInvId?: number;
  responseBody?: string;
  error?: string;
}> {
  const parent = getRobokassaInvoiceByInvId(db, parentInvId);
  if (!parent || !parent.is_recurring || parent.status !== 'paid') {
    return { success: false, error: 'Родительский рекуррентный счет не найден или не оплачен' };
  }

  const cfg = getSystemConfigByDomainFromDb(db, parent.domain);
  const newInvId = allocateNextRobokassaInvId(db);
  const numAmount = parseFloat(parent.out_sum) || 0;
  const outSum = numAmount.toFixed(2);

  const { receiptJson, description, iirkyQuantity } = buildFiscalReceipt54Fz({
    cfg,
    paymentType: 'tariff',
    normalizedTariff: parent.tariff_name || 'Разгон',
    periodMonths: 1,
    numAmount,
    isRecurring: true
  });

  const { asciiPlanCode } = classifyPaymentAndTariff(parent.tariff_name || 'Разгон', 'tariff');
  const shpMap: Record<string, string | number> = {
    shp_domain: cfg.domain,
    shp_months: 1,
    shp_plan: asciiPlanCode,
    shp_type: 'tariff',
    shp_user_id: parent.user_id.replace(/[^a-zA-Z0-9._-]/g, '')
  };
  const { signatureSuffix } = buildSortedShpSignaturePart(shpMap);

  const sigRaw = `${cfg.merchant_login}:${outSum}:${newInvId}:${receiptJson}:${cfg.pass1}:${signatureSuffix}`;
  const signature = md5Hex(sigRaw);
  const nowIso = new Date().toISOString();

  db.run(
    `INSERT INTO robokassa_invoices (
      id, inv_id, domain, merchant_login, user_id, payment_type,
      tariff_name, period_months, iirky_quantity, out_sum, receipt_json,
      is_recurring, parent_inv_id, status, paid_at, created_at
    ) VALUES (?, ?, ?, ?, ?, 'tariff', ?, 1, ?, ?, ?, 1, ?, 'pending', NULL, ?)`,
    [
      `rk_inv_${newInvId}`,
      newInvId,
      cfg.domain,
      cfg.merchant_login,
      parent.user_id,
      parent.tariff_name || 'Разгон',
      iirkyQuantity,
      outSum,
      receiptJson,
      parentInvId,
      nowIso
    ]
  );
  savePgDB();

  const formParams = new URLSearchParams();
  formParams.set('MerchantLogin', cfg.merchant_login);
  formParams.set('OutSum', outSum);
  formParams.set('InvoiceID', String(newInvId));
  formParams.set('PreviousInvoiceID', String(parentInvId));
  formParams.set('Description', description);
  formParams.set('Receipt', receiptJson);
  formParams.set('SignatureValue', signature);
  for (const [k, v] of Object.entries(shpMap)) {
    formParams.set(k, String(v));
  }

  const resp = await fetch('https://auth.robokassa.ru/Merchant/Recurring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formParams.toString()
  });
  const text = await resp.text();
  return {
    success: resp.ok && text.toUpperCase().includes(`OK${newInvId}`),
    newInvId,
    responseBody: text
  };
}
