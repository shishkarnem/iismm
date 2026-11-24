import {
  executePostgresBackupToTelegram,
  type BackupFormatOption
} from './pg/backup/telegramBackupService';

export async function executeDatabaseBackup(
  reason = 'Автоматический ежедневный бэкап PostgreSQL ProTalk',
  options?: { force?: boolean; format?: BackupFormatOption }
): Promise<{
  success: boolean;
  skipped?: boolean;
  totalRows: number;
  tablesCount: number;
  filename: string;
  sentFiles?: string[];
  error?: string;
}> {
  const result = await executePostgresBackupToTelegram(reason, {
    force: Boolean(options?.force),
    format: options?.format || 'bundle_gz',
    createCloudSnapshot: true
  });

  const sentFiles = result.filenames?.length ? result.filenames : [result.filename].filter(Boolean);
  return {
    success: result.success,
    skipped: result.skipped,
    totalRows: result.totalRows,
    tablesCount: result.tablesCount,
    filename: result.filename || sentFiles.join(', '),
    sentFiles,
    error: result.error
  };
}
