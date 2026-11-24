import { pgQuery } from '../client/pgHttpClient';
import { createProTalkSnapshot, runProTalkNativeTelegramBackup } from '../client/protalkPlatformApi';
import { getTelegramBotConfig, sendTelegramDocument, sendTelegramMessage } from '../../telegram';
import {
  buildJsonBackupBuffer,
  buildPostgresSqlDumpBuffer,
  collectFullPostgresSnapshot
} from './formatsSqlAndJson';
import { buildCsvBackupBuffer, buildNdjsonBackupBuffer } from './formatsNdjsonAndCsv';
import { getLiveAppVersionFromPg } from '../../seo/appVersionRoutes';

export type BackupFormatOption = 'bundle_gz' | 'sql.gz' | 'sql' | 'json.gz' | 'json' | 'ndjson' | 'csv';

let isBackupInProgress = false;
let lastAutoBackupSentAt = 0;
const AUTO_BACKUP_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export async function executePostgresBackupToTelegram(
  reason: string = 'Автоматический ежедневный бэкап',
  options?: {
    force?: boolean;
    format?: BackupFormatOption;
    createCloudSnapshot?: boolean;
    triggerProTalkNativeAutoBackup?: boolean;
  }
): Promise<{
  success: boolean;
  skipped?: boolean;
  totalRows: number;
  tablesCount: number;
  filename: string;
  filenames?: string[];
  sha256?: string;
  error?: string;
}> {
  const isManual = Boolean(options?.force);
  const chosenFormat: BackupFormatOption = options?.format || 'bundle_gz';

  if (isBackupInProgress) {
    return {
      success: false,
      skipped: true,
      totalRows: 0,
      tablesCount: 0,
      filename: '',
      error: 'Создание резервной копии уже выполняется'
    };
  }

  if (!isManual && lastAutoBackupSentAt > 0 && Date.now() - lastAutoBackupSentAt < AUTO_BACKUP_COOLDOWN_MS) {
    return {
      success: true,
      skipped: true,
      totalRows: 0,
      tablesCount: 0,
      filename: ''
    };
  }

  isBackupInProgress = true;

  try {
    const now = new Date();

    // Check persistent last_run in PostgreSQL cron table for automated runs
    if (!isManual) {
      try {
        const cronRes = await pgQuery<{ last_run: string }>(
          `SELECT last_run FROM cron WHERE id = 'cron_backup_daily_0600_msk' LIMIT 1`
        );
        const rawLastRun = cronRes.rows?.[0]?.last_run;
        if (rawLastRun) {
          const parsedLast = new Date(
            String(rawLastRun).includes('T') ? String(rawLastRun) : `${String(rawLastRun).replace(' ', 'T')}Z`
          ).getTime();
          if (!isNaN(parsedLast) && now.getTime() - parsedLast < AUTO_BACKUP_COOLDOWN_MS) {
            lastAutoBackupSentAt = parsedLast;
            return {
              success: true,
              skipped: true,
              totalRows: 0,
              tablesCount: 0,
              filename: ''
            };
          }
        }
      } catch {
        // Continue backup if cron lookup fails
      }
    }

    const liveVersion = await getLiveAppVersionFromPg().catch(() => 'v.1.56');

    // 1. Create cloud snapshot in ProTalk DB snapshots registry
    if (options?.createCloudSnapshot !== false) {
      await createProTalkSnapshot(`${reason} (${liveVersion})`).catch(() => null);
    }

    // Optional ProTalk native auto-backup trigger
    if (options?.triggerProTalkNativeAutoBackup) {
      await runProTalkNativeTelegramBackup().catch(() => null);
    }

    // 2. Collect full snapshot from ProTalk PostgreSQL (iismm2)
    const snapshot = await collectFullPostgresSnapshot(reason);

    const artifacts: Array<{ buffer: Buffer; filename: string; sha256: string; label: string }> = [];

    if (chosenFormat === 'bundle_gz') {
      const sqlGz = buildPostgresSqlDumpBuffer(snapshot, true);
      const jsonGz = buildJsonBackupBuffer(snapshot, true);
      artifacts.push({ ...sqlGz, label: 'PostgreSQL SQL.GZ (DDL + данные)' });
      artifacts.push({ ...jsonGz, label: 'JSON.GZ (полный слепок)' });
    } else if (chosenFormat === 'sql.gz') {
      const sqlGz = buildPostgresSqlDumpBuffer(snapshot, true);
      artifacts.push({ ...sqlGz, label: 'PostgreSQL SQL.GZ' });
    } else if (chosenFormat === 'sql') {
      const sqlRaw = buildPostgresSqlDumpBuffer(snapshot, false);
      artifacts.push({ ...sqlRaw, label: 'PostgreSQL SQL Dump' });
    } else if (chosenFormat === 'json.gz') {
      const jsonGz = buildJsonBackupBuffer(snapshot, true);
      artifacts.push({ ...jsonGz, label: 'JSON.GZ' });
    } else if (chosenFormat === 'ndjson') {
      const ndjson = buildNdjsonBackupBuffer(snapshot);
      artifacts.push({ ...ndjson, label: 'NDJSON (потоковый)' });
    } else if (chosenFormat === 'csv') {
      const csv = buildCsvBackupBuffer(snapshot);
      artifacts.push({ ...csv, label: 'CSV (сводная таблица)' });
    } else {
      const jsonRaw = buildJsonBackupBuffer(snapshot, false);
      artifacts.push({ ...jsonRaw, label: 'JSON Snapshot' });
    }

    const config = await getTelegramBotConfig();
    const adminId = config.adminTelegramId || '169262990';
    const sentFiles: string[] = [];

    for (let idx = 0; idx < artifacts.length; idx++) {
      const item = artifacts[idx];
      const caption =
        `📦 <b>Резервная копия PostgreSQL ProTalk (iismm2)</b>\n\n` +
        `🏷 Версия: <code>${snapshot.meta.version || liveVersion}</code> · Формат: <b>${item.label}</b> (${idx + 1}/${artifacts.length})\n` +
        `📌 Причина: <i>${reason}</i>\n` +
        `🕒 Время: <code>${snapshot.meta.exportedAtMsk}</code>\n` +
        `📊 Таблиц: <b>${snapshot.meta.tablesCount}</b> (с данными: <b>${snapshot.meta.tablesWithData}</b>)\n` +
        `🗂 Записей: <b>${snapshot.meta.totalRows.toLocaleString('ru-RU')}</b>\n` +
        `💾 Размер: <b>${(item.buffer.length / 1024).toFixed(1)} KB</b>\n` +
        `🔐 SHA-256: <code>${item.sha256.slice(0, 16)}…</code>`;

      const sendRes = await sendTelegramDocument({
        chatId: adminId,
        fileBuffer: item.buffer,
        filename: item.filename,
        caption
      });

      if (!sendRes.ok) {
        await sendTelegramMessage({
          chatId: adminId,
          text: `⚠️ <b>Ошибка отправки бэкапа (${item.filename}):</b>\n${sendRes.error || 'Неизвестная ошибка'}`
        }).catch(() => null);
        return {
          success: false,
          totalRows: snapshot.meta.totalRows,
          tablesCount: snapshot.meta.tablesCount,
          filename: item.filename,
          error: sendRes.error
        };
      }
      sentFiles.push(item.filename);
    }

    if (!isManual) {
      lastAutoBackupSentAt = Date.now();
    }

    return {
      success: true,
      totalRows: snapshot.meta.totalRows,
      tablesCount: snapshot.meta.tablesCount,
      filename: sentFiles[0] || '',
      filenames: sentFiles,
      sha256: artifacts[0]?.sha256
    };
  } catch (err: any) {
    console.error('[executePostgresBackupToTelegram] Error:', err);
    return {
      success: false,
      totalRows: 0,
      tablesCount: 0,
      filename: '',
      error: err?.message || String(err)
    };
  } finally {
    isBackupInProgress = false;
  }
}
