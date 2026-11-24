import type { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  createProTalkSnapshot,
  listProTalkCronJobs,
  listProTalkEdgeFunctions,
  listProTalkSnapshots,
  listProTalkTriggers,
  runProTalkNativeTelegramBackup
} from '../client/protalkPlatformApi';
import {
  buildJsonBackupBuffer,
  buildPostgresSqlDumpBuffer,
  collectFullPostgresSnapshot,
  collectSingleTableSnapshot
} from './formatsSqlAndJson';
import { buildCsvBackupBuffer, buildNdjsonBackupBuffer } from './formatsNdjsonAndCsv';
import { restorePostgresFromBackupPayload } from './restoreService';
import { executePostgresBackupToTelegram, type BackupFormatOption } from './telegramBackupService';
import { getLiveAppVersionFromPg } from '../../seo/appVersionRoutes';

const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

/**
 * Registers multi-format PostgreSQL ProTalk (iismm2) backup, restore, cloud snapshots,
 * and platform status routes on apiRouter (/api/...).
 */
export function registerPostgresBackupRoutes(router: Router): void {
  // Universal multi-format download: /api/admin/db/export?format=sql|sql.gz|json|json.gz|ndjson|csv&table=...
  router.get('/admin/db/export', async (req: Request, res: Response) => {
    try {
      const format = String(req.query.format || 'sql').toLowerCase();
      const table = req.query.table ? String(req.query.table).replace(/[^a-zA-Z0-9_]/g, '') : undefined;
      const isSingleCsv = format === 'csv' && Boolean(table) && table !== 'all';

      const snapshot = isSingleCsv
        ? await collectSingleTableSnapshot(table!, `CSV экспорт таблицы ${table}`)
        : await collectFullPostgresSnapshot(`Ручная выгрузка (${format})`);

      let out: { buffer: Buffer; filename: string; mimeType: string; sha256: string };
      if (format === 'sql.gz') {
        out = buildPostgresSqlDumpBuffer(snapshot, true);
      } else if (format === 'sql') {
        out = buildPostgresSqlDumpBuffer(snapshot, false);
      } else if (format === 'json.gz') {
        out = buildJsonBackupBuffer(snapshot, true);
      } else if (format === 'ndjson' || format === 'jsonl') {
        out = buildNdjsonBackupBuffer(snapshot);
      } else if (format === 'csv') {
        out = buildCsvBackupBuffer(snapshot, table);
      } else {
        out = buildJsonBackupBuffer(snapshot, false);
      }

      res.setHeader('Content-Type', out.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Backup-Sha256');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Backup-Sha256', out.sha256);
      res.send(out.buffer);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Ошибка экспорта базы PostgreSQL' });
    }
  });

  // Multi-format file upload restore: .sql, .sql.gz, .json, .json.gz, .ndjson, .csv
  router.post(
    '/admin/db/restore-file',
    uploadMem.single('file'),
    async (req: Request, res: Response) => {
      try {
        const file = (req as any).file as Express.Multer.File | undefined;
        let buf: Buffer | null = null;
        let fname = String(req.body?.filename || '');

        if (file && file.buffer) {
          buf = file.buffer;
          fname = file.originalname || fname;
        } else if (req.body?.content) {
          buf = Buffer.from(
            typeof req.body.content === 'string' ? req.body.content : JSON.stringify(req.body.content),
            'utf-8'
          );
        }

        if (!buf || buf.length === 0) {
          return res.status(400).json({ success: false, error: 'Не передан файл резервной копии для восстановления' });
        }

        const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
        const targetTable = req.body?.targetTable ? String(req.body.targetTable) : undefined;
        const summary = await restorePostgresFromBackupPayload({
          buffer: buf,
          filename: fname,
          targetTable,
          mode
        });

        res.json({
          ...summary,
          format: summary.formatDetected,
          restoredTables: summary.tablesRestored,
          restoredRows: summary.rowsRestored
        });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Ошибка восстановления из файла' });
      }
    }
  );

  // Send selected backup format(s) directly to Telegram
  router.post('/admin/db/telegram-backup', async (req: Request, res: Response) => {
    try {
      const format = (req.body?.format || 'bundle_gz') as BackupFormatOption;
      const reason = String(req.body?.reason || `Ручной бэкап из панели администратора (${format})`);
      const triggerNative = Boolean(req.body?.triggerNative);

      const result = await executePostgresBackupToTelegram(reason, {
        force: true,
        format,
        createCloudSnapshot: true,
        triggerProTalkNativeAutoBackup: triggerNative
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Ошибка отправки бэкапа в Telegram' });
    }
  });

  // Cloud Snapshots & ProTalk Infrastructure overview
  router.get('/admin/db/protalk-overview', async (_req: Request, res: Response) => {
    try {
      const [snapshots, triggers, cronJobs, edgeFunctions, liveVersion] = await Promise.all([
        listProTalkSnapshots().catch(() => []),
        listProTalkTriggers().catch(() => []),
        listProTalkCronJobs().catch(() => []),
        listProTalkEdgeFunctions().catch(() => []),
        getLiveAppVersionFromPg().catch(() => 'v.1.56')
      ]);
      res.json({
        success: true,
        database: 'iismm2',
        engine: 'PostgreSQL ProTalk',
        version: liveVersion,
        snapshots,
        triggers,
        cronJobs,
        edgeFunctions
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Ошибка получения сведений ProTalk DB' });
    }
  });

  router.post('/admin/db/snapshots/create', async (req: Request, res: Response) => {
    try {
      const liveVersion = await getLiveAppVersionFromPg().catch(() => 'v.1.56');
      const label = String(req.body?.label || `Облачный снимок ИИSMM ${liveVersion} (${new Date().toLocaleString('ru-RU')})`);
      const snap = await createProTalkSnapshot(label);
      res.json({ success: true, snapshot: snap });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Ошибка создания облачного снимка ProTalk' });
    }
  });

  router.post('/admin/db/protalk-native-backup', async (_req: Request, res: Response) => {
    try {
      const out = await runProTalkNativeTelegramBackup();
      res.json({ success: true, result: out });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Ошибка штатного авто-бэкапа ProTalk' });
    }
  });
}
