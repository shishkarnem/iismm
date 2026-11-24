import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { getAllTariffsFromDb, getTariffById, TariffRecord } from '../db/tariffsTable';
import { getUserByIdFromDb } from '../db/usersTable';
import { addTransactionWithBalanceUpdate } from '../db/transactionsTable';
import { createNotificationInDb } from '../db/notificationsTable';
import { saveDatabaseToDisk } from '../db/index';
import { normalizeUserId } from '../db/postgres';
import { normalizeServerTariffName } from './tariffAccess';
import { revokeUserRecurringConsentsInDb } from '../payments/recurringConsentsDb';

export interface ChangeTariffParams {
  userId: string;
  tariffId?: string;
  tariffName?: string;
  periodMonths?: number;
  paidViaRobokassaRub?: number;
}

export interface ChangeTariffResult {
  success: boolean;
  statusCode: number;
  needTopup?: boolean;
  missingAmount?: number;
  error?: string;
  tariff?: string;
  tariffId?: string;
  periodMonths?: number;
  discountPercent?: number;
  totalCost?: number;
  creditedTariffIirky?: number;
  balance?: number;
  expiresAt?: string | null;
  autoRenew?: boolean;
  user?: Record<string, any>;
  message?: string;
}

function findTargetTariff(db: Database, tariffId?: string, tariffName?: string): TariffRecord | null {
  if (tariffId) {
    const byId = getTariffById(db, String(tariffId));
    if (byId) return byId;
  }
  const search = String(tariffName || tariffId || '').trim();
  if (!search) return null;

  const byNameOrId = getTariffById(db, search);
  if (byNameOrId) return byNameOrId;

  const normalizedSearch = normalizeServerTariffName(search).toLowerCase();
  const lower = search.toLowerCase();
  const all = getAllTariffsFromDb(db);
  return (
    all.find(
      (t) =>
        t.id.toLowerCase() === lower ||
        t.name.toLowerCase() === lower ||
        t.name.toLowerCase() === normalizedSearch
    ) || null
  );
}

/**
 * Clean up non-admin users who accidentally received 'Космос' from the old registration bug
 * (where they never had an explicit admin/custom tariff assignment or payment).
 */
export function fixErroneousDefaultCosmosUsers(db: Database): void {
  try {
    db.run(`
      UPDATE users
      SET tariff = 'Старт',
          tariff_expires_at = NULL,
          tariff_duration_days = 0
      WHERE LOWER(COALESCE(role, 'user')) != 'admin'
        AND id NOT IN ('169262990', '16926299042')
        AND CAST(COALESCE(telegram_id, 0) AS TEXT) != '169262990'
        AND tariff = 'Космос'
        AND id NOT IN (
          SELECT tx.user_id FROM transactions tx
          WHERE tx.user_id IS NOT NULL
            AND (
              (tx.type = 'tarif' AND tx.amount > 300)
              OR tx.type = 'admin'
              OR tx.description LIKE '%Космос%'
            )
        );
    `);

    // Ensure Start users never carry a stale expiration date
    db.run(`
      UPDATE users
      SET tariff_expires_at = NULL,
          tariff_duration_days = 0
      WHERE (tariff IS NULL OR tariff = '' OR tariff = 'Старт')
        AND tariff_expires_at IS NOT NULL;
    `);
  } catch (e) {
    console.warn('[TariffLifecycle] Warning fixing erroneous default Cosmos users:', e);
  }
}

function getDiscountForPeriod(tariff: TariffRecord, months: number): number {
  if (months === 3) return tariff.discount_3m !== undefined ? Number(tariff.discount_3m) : 10;
  if (months === 6) return tariff.discount_6m !== undefined ? Number(tariff.discount_6m) : 15;
  if (months === 12) return tariff.discount_12m !== undefined ? Number(tariff.discount_12m) : 20;
  return 0;
}

/**
 * Activate or switch a user's tariff.
 * - Switching to 'Старт' is immediate and free (no expiration date).
 * - Connecting 'Разгон' (990) or 'Отрыв' (4900):
 *   1) If `paidViaRobokassaRub` is provided, ruble payment was completed externally: credit `monthly_iirky * months` into `balance_tarif` and set 30d * months expiry.
 *   2) Otherwise, checks paid ruble-backed balance (`balance_pay + balance_admin >= totalCost`), deducts `totalCost` from `balance_pay` (and `balance_admin` if needed), and credits `monthly_iirky * months` into `balance_tarif` so `1 рубль = 1 ИИрка` works honestly without allowing free/tariff bonus loops.
 */
export function changeUserTariffInDb(db: Database, params: ChangeTariffParams): ChangeTariffResult {
  const rawUid = String(params.userId || '').trim();
  if (!rawUid) {
    return { success: false, statusCode: 400, error: 'Не указан ID пользователя' };
  }
  const cleanUserId = normalizeUserId(rawUid);

  const userRecord = getUserByIdFromDb(db, cleanUserId) as any;
  if (!userRecord) {
    return { success: false, statusCode: 404, error: 'Пользователь не найден в базе данных' };
  }

  const targetTariff = findTargetTariff(db, params.tariffId, params.tariffName);
  if (!targetTariff) {
    return { success: false, statusCode: 404, error: 'Выбранный тариф не найден' };
  }

  const months = [1, 3, 6, 12].includes(Number(params.periodMonths)) ? Number(params.periodMonths) : 1;
  const discountPercent = getDiscountForPeriod(targetTariff, months);
  const nowIso = new Date().toISOString();

  // Case 1: Switching to 'Старт'
  if (targetTariff.id === 'start' || targetTariff.name === 'Старт') {
    db.run(
      `UPDATE users
       SET tariff = 'Старт',
           tarif_date = ?,
           tariff_assigned_at = ?,
           tariff_expires_at = NULL,
           tariff_duration_days = 0,
           tariff_warned_expires_at = NULL
       WHERE id = ?`,
      [nowIso, nowIso, String(userRecord.id)]
    );
    saveDatabaseToDisk();

    const updated = getUserByIdFromDb(db, String(userRecord.id));
    return {
      success: true,
      statusCode: 200,
      tariff: 'Старт',
      tariffId: 'start',
      periodMonths: 1,
      discountPercent: 0,
      totalCost: 0,
      creditedTariffIirky: 0,
      balance: Number(updated?.balance) || 0,
      expiresAt: null,
      autoRenew: updated?.auto_renew_tariff !== 0,
      user: {
        id: updated?.id,
        tariff: 'Старт',
        tarif_date: updated?.tarif_date,
        tariff_expires_at: null,
        tariffDurationDays: 0,
        balance: Number(updated?.balance) || 0,
        balance_pay: updated?.balance_pay || 0,
        balance_free: updated?.balance_free || 0,
        balance_tarif: updated?.balance_tarif || 0,
        auto_renew_tariff: updated?.auto_renew_tariff !== 0
      },
      message: 'Вы успешно перешли на базовый бесплатный тариф «Старт»!'
    };
  }

  // Case 2: Individual tariff 'Космос' without fixed price
  const baseMonthlyPrice = Math.max(0, Number(targetTariff.price_rub) || 0);
  const baseMonthlyIirky = Math.max(0, Number(targetTariff.monthly_iirky) || baseMonthlyPrice);

  if (targetTariff.id === 'cosmos' && baseMonthlyPrice === 0 && !params.paidViaRobokassaRub) {
    return {
      success: false,
      statusCode: 400,
      error: 'Тариф «Космос» подключается индивидуально через персонального менеджера или администратора.'
    };
  }

  const rawTotal = baseMonthlyPrice * months;
  const totalCost = Math.round(rawTotal * (1 - discountPercent / 100));
  const creditedTariffIirky = baseMonthlyIirky * months;

  // Calculate new expiration date: if extending the SAME active paid tariff that hasn't expired yet, extend from existing expiry and preserve remaining paid tariff Iirky
  let baseDateMs = Date.now();
  let isExtendingActivePaidTariff = false;
  const currentNorm = normalizeServerTariffName(userRecord.tariff);
  if (currentNorm !== 'Старт' && userRecord.tariff_expires_at) {
    const existingExpMs = new Date(userRecord.tariff_expires_at).getTime();
    if (!Number.isNaN(existingExpMs) && existingExpMs > Date.now()) {
      isExtendingActivePaidTariff = true;
      if (currentNorm === targetTariff.name) {
        baseDateMs = existingExpMs;
      }
    }
  }
  const durationDays = months * 30;
  const expiresAtIso = new Date(baseDateMs + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const preservedTarifBalance = isExtendingActivePaidTariff ? Math.max(0, Number(userRecord.balance_tarif) || 0) : 0;
  const finalTarifGrantAmount = preservedTarifBalance + creditedTariffIirky;

  if (params.paidViaRobokassaRub && params.paidViaRobokassaRub > 0) {
    // Direct external payment via Robokassa: credit tariff package into balance_tarif
    addTransactionWithBalanceUpdate(db, {
      userId: String(userRecord.id),
      type: 'tarif',
      balanceType: 'tarif',
      amount: finalTarifGrantAmount,
      description: `Начисление пакета ${creditedTariffIirky} ИИрок по тарифу «${targetTariff.name}» (${months} мес., оплата ${params.paidViaRobokassaRub} ₽)`,
      comment: `Оплата Робокасса: ${params.paidViaRobokassaRub} ₽`,
      createdAt: nowIso
    });
  } else if (totalCost > 0) {
    // Switching inside cabinet using paid ruble-backed balance (balance_pay + balance_admin)
    const availPay = Math.max(0, Number(userRecord.balance_pay) || 0);
    const availAdmin = Math.max(0, Number(userRecord.balance_admin) || 0);
    const totalPaidAvailable = availPay + availAdmin;

    if (totalPaidAvailable < totalCost) {
      return {
        success: false,
        statusCode: 402,
        needTopup: true,
        missingAmount: Math.max(1, totalCost - totalPaidAvailable),
        totalCost,
        balance: Number(userRecord.balance) || 0,
        error: `Для подключения тарифа «${targetTariff.name}» на ${months} мес. требуется ${totalCost.toLocaleString('ru-RU')} оплаченных ИИрок (доступно для оплаты тарифа: ${totalPaidAvailable.toLocaleString('ru-RU')}). Пополните счёт на недостающую сумму.`
      };
    }

    const deductFromPay = Math.min(availPay, totalCost);
    const deductFromAdmin = Math.max(0, totalCost - deductFromPay);

    if (deductFromPay > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId: String(userRecord.id),
        type: 'pay',
        balanceType: 'pay',
        amount: -deductFromPay,
        description: `Оплата тарифа «${targetTariff.name}» на ${months} мес.${discountPercent > 0 ? ` (скидка ${discountPercent}%)` : ''}`,
        comment: `Подключение тарифа ${targetTariff.name} (${durationDays} дней)`,
        createdAt: nowIso
      });
    }

    if (deductFromAdmin > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId: String(userRecord.id),
        type: 'admin',
        balanceType: 'admin',
        amount: -deductFromAdmin,
        description: `Оплата тарифа «${targetTariff.name}» на ${months} мес. с бонусного счёта`,
        comment: `Подключение тарифа ${targetTariff.name} (${durationDays} дней)`,
        createdAt: nowIso
      });
    }

    // Credit monthly_iirky * months into balance_tarif (1 рубль = 1 ИИрка)
    addTransactionWithBalanceUpdate(db, {
      userId: String(userRecord.id),
      type: 'tarif',
      balanceType: 'tarif',
      amount: finalTarifGrantAmount,
      description: `Начисление пакета ${creditedTariffIirky.toLocaleString('ru-RU')} ИИрок по тарифу «${targetTariff.name}» (${months} мес.)`,
      comment: `Тарифный пакет ${targetTariff.name}`,
      createdAt: new Date(Date.now() + 5).toISOString()
    });
  }

  db.run(
    `UPDATE users
     SET tariff = ?,
         tarif_date = ?,
         tariff_assigned_at = ?,
         tariff_expires_at = ?,
         tariff_duration_days = ?,
         tariff_accrued_at = ?,
         tariff_warned_expires_at = NULL
     WHERE id = ?`,
    [targetTariff.name, nowIso, nowIso, expiresAtIso, durationDays, nowIso, String(userRecord.id)]
  );

  try {
    createNotificationInDb(db, {
      userId: String(userRecord.id),
      type: 'system',
      category: 'balance',
      title: `Тариф «${targetTariff.name}» подключён`,
      message: `Ваш тариф «${targetTariff.name}» активен до ${new Date(expiresAtIso).toLocaleDateString('ru-RU')}. Начислено ${creditedTariffIirky.toLocaleString('ru-RU')} ИИрок на тарифный баланс.`,
      link: '/tarif'
    });
  } catch (e) {}

  saveDatabaseToDisk();

  const updatedUser = getUserByIdFromDb(db, String(userRecord.id));
  const formattedExp = new Date(expiresAtIso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return {
    success: true,
    statusCode: 200,
    tariff: targetTariff.name,
    tariffId: targetTariff.id,
    periodMonths: months,
    discountPercent,
    totalCost,
    creditedTariffIirky,
    balance: Number(updatedUser?.balance) || 0,
    expiresAt: expiresAtIso,
    autoRenew: updatedUser?.auto_renew_tariff !== 0,
    user: {
      id: updatedUser?.id,
      tariff: updatedUser?.tariff,
      tarif_date: updatedUser?.tarif_date,
      tariff_expires_at: updatedUser?.tariff_expires_at,
      tariffDurationDays: updatedUser?.tariff_duration_days,
      balance: Number(updatedUser?.balance) || 0,
      balance_pay: updatedUser?.balance_pay || 0,
      balance_free: updatedUser?.balance_free || 0,
      balance_tarif: updatedUser?.balance_tarif || 0,
      auto_renew_tariff: updatedUser?.auto_renew_tariff !== 0
    },
    message: `Тариф «${targetTariff.name}» успешно подключён до ${formattedExp}! Начислено ${creditedTariffIirky.toLocaleString('ru-RU')} ИИрок.`
  };
}

export function setAutoRenewTariffInDb(db: Database, userId: string, enabled: boolean): { success: boolean; autoRenew: boolean } {
  const rawUid = String(userId || '').trim();
  if (!rawUid) return { success: false, autoRenew: false };
  const cleanId = normalizeUserId(rawUid);
  const uRow = getUserByIdFromDb(db, cleanId);
  if (!uRow) return { success: false, autoRenew: false };

  const flag = enabled ? 1 : 0;
  db.run(`UPDATE users SET auto_renew_tariff = ? WHERE id = ?`, [flag, String(uRow.id)]);
  if (!enabled) {
    try {
      revokeUserRecurringConsentsInDb(db, String(uRow.id));
    } catch {}
  }
  saveDatabaseToDisk();
  return { success: true, autoRenew: enabled };
}

/**
 * Cron worker lifecycle for paid & custom tariffs:
 * 1) Warns users 3 days before expiration (once per expiration cycle).
 * 2) On expiration:
 *    - If auto_renew_tariff = 1 and user has enough paid balance (balance_pay + balance_admin >= price_rub) for 'Разгон' or 'Отрыв', auto-renews for 1 month and credits monthly_iirky!
 *    - Otherwise downgrades to 'Старт', clears tariff_expires_at, grants monthly Start 300 Iirky if due, and notifies the user in-app and via Telegram callback.
 */
export async function processTariffsCronLifecycle(
  db: Database,
  sendTelegramMessage?: (telegramId: string | number, htmlText: string, meta?: any) => Promise<any>
): Promise<{ renewed: number; downgraded: number; warned: number }> {
  let renewed = 0;
  let downgraded = 0;
  let warned = 0;

  const now = new Date();
  const nowIso = now.toISOString();
  const threeDaysLaterIso = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Pre-expiry warnings (within 3 days)
  try {
    const warnRes = db.exec(
      `SELECT id, telegram_id, first_name, tariff, tariff_expires_at, auto_renew_tariff, tariff_warned_expires_at
       FROM users
       WHERE status = 'Активный'
         AND tariff IS NOT NULL
         AND tariff != 'Старт'
         AND LOWER(COALESCE(role, 'user')) != 'admin'
         AND tariff_expires_at IS NOT NULL
         AND tariff_expires_at > ?
         AND tariff_expires_at <= ?`,
      [nowIso, threeDaysLaterIso]
    );

    if (warnRes[0]?.values) {
      for (const row of warnRes[0].values) {
        const userId = String(row[0]);
        const tgId = row[1];
        const firstName = String(row[2] || 'Пользователь');
        const tariffName = String(row[3] || '');
        const expiresAt = String(row[4] || '');
        const autoRenew = row[5] !== 0;
        const alreadyWarnedFor = row[6] ? String(row[6]) : '';

        if (alreadyWarnedFor === expiresAt) continue;

        const expFormatted = new Date(expiresAt).toLocaleDateString('ru-RU');
        const msgText = autoRenew
          ? `Срок действия вашего тарифа «${tariffName}» подходит к концу (${expFormatted}). При наличии оплаченных ИИрок на счёте подписка продлится автоматически.`
          : `Срок действия вашего тарифа «${tariffName}» истекает ${expFormatted}. Продлите тариф в личном кабинете, чтобы сохранить доступ к платным функциям.`;

        db.run(`UPDATE users SET tariff_warned_expires_at = ? WHERE id = ?`, [expiresAt, userId]);
        warned++;

        try {
          createNotificationInDb(db, {
            userId,
            type: 'system',
            category: 'balance',
            title: `Скоро завершится тариф «${tariffName}»`,
            message: msgText,
            link: '/tarif'
          });
        } catch (e) {}

        if (tgId && sendTelegramMessage) {
          await sendTelegramMessage(
            String(tgId),
            `⏳ <b>Напоминание о тарифе, ${firstName}!</b>\n\n${msgText}`,
            { userId, category: 'balance' }
          ).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error('[TariffLifecycle] Error checking 3-day tariff warnings:', e);
  }

  // 2. Expired tariffs: attempt auto-renewal or downgrade to 'Старт'
  try {
    const expRes = db.exec(
      `SELECT id, telegram_id, first_name, tariff, tariff_expires_at, auto_renew_tariff
       FROM users
       WHERE status = 'Активный'
         AND tariff IS NOT NULL
         AND tariff != 'Старт'
         AND LOWER(COALESCE(role, 'user')) != 'admin'
         AND tariff_expires_at IS NOT NULL
         AND tariff_expires_at <= ?`,
      [nowIso]
    );

    if (expRes[0]?.values) {
      for (const row of expRes[0].values) {
        const userId = String(row[0]);
        const tgId = row[1];
        const firstName = String(row[2] || 'Пользователь');
        const oldTariff = String(row[3] || '');
        const autoRenew = row[5] !== 0;

        // Try auto-renewal if enabled and tariff has a standard monthly price > 0
        const target = findTargetTariff(db, undefined, oldTariff);
        if (autoRenew && target && Number(target.price_rub) > 0) {
          const renewAttempt = changeUserTariffInDb(db, {
            userId,
            tariffId: target.id,
            periodMonths: 1
          });
          if (renewAttempt.success) {
            renewed++;
            if (tgId && sendTelegramMessage) {
              await sendTelegramMessage(
                String(tgId),
                `✨ <b>Автопродление тарифа «${target.name}»</b>\n\nЗдравствуйте, ${firstName}! Ваш тариф успешно продлён на 30 дней, начислено <b>${renewAttempt.creditedTariffIirky} ИИрок</b>.`
              ).catch(() => {});
            }
            continue;
          }
        }

        // Otherwise downgrade to 'Старт' and grant baseline 300 Start Iirky
        db.run(
          `UPDATE users
           SET tariff = 'Старт',
               tariff_expires_at = NULL,
               tariff_duration_days = 0,
               tariff_accrued_at = ?,
               tariff_warned_expires_at = NULL
           WHERE id = ?`,
          [nowIso, userId]
        );
        addTransactionWithBalanceUpdate(db, {
          userId,
          type: 'tarif',
          balanceType: 'tarif',
          amount: 300,
          description: `Переход на тариф «Старт» после завершения «${oldTariff}»: +300 ИИрок`,
          createdAt: nowIso
        });
        downgraded++;

        try {
          createNotificationInDb(db, {
            userId,
            type: 'system',
            category: 'balance',
            title: `Тариф «${oldTariff}» завершён`,
            message: `Срок действия тарифа «${oldTariff}» истёк. Ваш аккаунт переведён на бесплатный тариф «Старт» (300 ИИрок каждый месяц). Вы можете снова подключить платный тариф в разделе «Тарифы».`,
            link: '/tarif'
          });
        } catch (e) {}

        if (tgId && sendTelegramMessage) {
          await sendTelegramMessage(
            String(tgId),
            `🔔 <b>Уведомление о тарифе</b>\n\nЗдравствуйте, ${firstName}! Срок действия вашего тарифа <b>«${oldTariff}»</b> завершён.\nАккаунт переведён на базовый бесплатный тариф <b>«Старт»</b> (+300 ИИрок).\n\nПродлить подписку можно в личном кабинете в разделе «Тарифы».`,
            { userId, category: 'balance' }
          ).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error('[TariffLifecycle] Error processing expired tariffs:', e);
  }

  if (renewed > 0 || downgraded > 0 || warned > 0) {
    saveDatabaseToDisk();
  }

  return { renewed, downgraded, warned };
}
