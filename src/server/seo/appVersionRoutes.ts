import type { Express, Request, Response } from 'express';
import type { PgCloudDatabase } from '../pg/cache/pgMemAdapter';
import { getPgDB, refreshTableCacheFromCloud, savePgDB } from '../db/postgres';
import { pgQuery } from '../pg/client/pgHttpClient';
import { saveDatabaseToDisk } from '../db/index';

export const DEFAULT_APP_VERSION = 'v.1.56';
const LEGACY_PLACEHOLDER_VERSIONS = new Set([
  '',
  'v.1.53',
  'v1.53',
  '1.53',
  'v.1.54',
  'v1.54',
  '1.54',
  'v.1.55',
  'v1.55',
  '1.55'
]);

export function normalizeAppVersionInput(raw: unknown): string {
  const trimmed = String(raw ?? '').trim().slice(0, 40);
  if (!trimmed) return DEFAULT_APP_VERSION;
  if (/^\d/.test(trimmed)) {
    return `v.${trimmed}`;
  }
  return trimmed;
}

export function initAppSettingsTable(db: PgCloudDatabase): void {
  try {
    let existingValue: string | null = null;
    const stmt = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'app_version' LIMIT 1");
    if (stmt.step()) {
      const row = stmt.getAsObject() as { setting_value?: string };
      existingValue = typeof row.setting_value === 'string' ? row.setting_value.trim() : '';
    }
    stmt.free();

    if (!existingValue || (existingValue !== DEFAULT_APP_VERSION && LEGACY_PLACEHOLDER_VERSIONS.has(existingValue))) {
      const nowIso = new Date().toISOString();
      db.run(
        `INSERT OR REPLACE INTO app_settings (setting_key, setting_value, updated_at)
         VALUES ('app_version', ?, ?)`,
        [DEFAULT_APP_VERSION, nowIso]
      );
      saveDatabaseToDisk();
    }
  } catch (err) {
    console.error('[AppVersion] Ошибка инициализации таблицы app_settings:', err);
  }
}

export async function getStoredAppVersion(): Promise<{ version: string; updatedAt: string }> {
  try {
    const cloudRes = await pgQuery<{ setting_value?: string; updated_at?: string }>(
      "SELECT setting_value, updated_at FROM app_settings WHERE setting_key = 'app_version' LIMIT 1"
    ).catch(() => null);
    const cloudRow = cloudRes?.rows?.[0];
    if (cloudRow?.setting_value && String(cloudRow.setting_value).trim()) {
      return {
        version: String(cloudRow.setting_value).trim(),
        updatedAt: cloudRow.updated_at ? String(cloudRow.updated_at) : new Date().toISOString()
      };
    }

    const db = await getPgDB();
    initAppSettingsTable(db);
    const stmt = db.prepare(
      "SELECT setting_value, updated_at FROM app_settings WHERE setting_key = 'app_version' LIMIT 1"
    );
    let version = DEFAULT_APP_VERSION;
    let updatedAt = new Date().toISOString();
    if (stmt.step()) {
      const row = stmt.getAsObject() as { setting_value?: string; updated_at?: string };
      if (row.setting_value && row.setting_value.trim()) {
        version = row.setting_value.trim();
      }
      if (row.updated_at) {
        updatedAt = String(row.updated_at);
      }
    }
    stmt.free();
    return { version, updatedAt };
  } catch (err) {
    console.error('[AppVersion] Ошибка чтения версии сборки:', err);
    return { version: DEFAULT_APP_VERSION, updatedAt: new Date().toISOString() };
  }
}

export async function getLiveAppVersionFromPg(): Promise<string> {
  const { version } = await getStoredAppVersion();
  return version || DEFAULT_APP_VERSION;
}

export function registerAppVersionRoutes(app: Express): void {
  app.get('/api/app-version', async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const data = await getStoredAppVersion();
    res.json({
      success: true,
      version: data.version,
      updatedAt: data.updatedAt
    });
  });

  const handleUpdateVersion = async (req: Request, res: Response) => {
    try {
      const rawVersion = req.body?.version;
      if (typeof rawVersion !== 'string' || !rawVersion.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Укажите корректное обозначение версии сборки (например, v.1.58)'
        });
      }

      const normalizedVersion = normalizeAppVersionInput(rawVersion);
      const nowIso = new Date().toISOString();

      await pgQuery(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at)
         VALUES ('app_version', $1, $2)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at`,
        [normalizedVersion, nowIso]
      );

      const db = await getPgDB();
      initAppSettingsTable(db);
      db.run(
        `INSERT OR REPLACE INTO app_settings (setting_key, setting_value, updated_at)
         VALUES ('app_version', ?, ?)`,
        [normalizedVersion, nowIso]
      );
      await refreshTableCacheFromCloud('app_settings').catch(() => null);
      savePgDB();

      res.json({
        success: true,
        version: normalizedVersion,
        updatedAt: nowIso
      });
    } catch (err: any) {
      console.error('[AppVersion] Ошибка сохранения версии сборки:', err);
      res.status(500).json({
        success: false,
        error: 'Не удалось сохранить версию сборки в базе данных PostgreSQL'
      });
    }
  };

  app.put('/api/admin/app-version', handleUpdateVersion);
  app.post('/api/admin/app-version', handleUpdateVersion);
}
