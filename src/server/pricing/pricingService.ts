import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { getPgDB, getSyncPgDB, savePgDB } from '../db/postgres';
import { DB } from '../db';
import {
  DEFAULT_PRICING_CONFIG,
  PricingConfig,
  sanitizePricingConfig
} from '../../shared/pricingConfig';

const PRICING_SETTING_KEY = 'pricing_config';
let cachedPricingConfig: PricingConfig | null = null;

function readImageCostsFromProTalkSettingsRow(db: Database): Partial<PricingConfig['imageModels']> {
  try {
    const res = db.exec(
      "SELECT cost_image_no_text_iirky, cost_image_with_text_iirky, cost_image_787_iirky, cost_image_791_iirky FROM protalk_settings WHERE id = 'setting_1' LIMIT 1"
    );
    const row = res?.[0]?.values?.[0];
    if (!row) return {};
    return {
      func_621: row[0] !== null && row[0] !== undefined ? Number(row[0]) : undefined,
      func_784: row[1] !== null && row[1] !== undefined ? Number(row[1]) : undefined,
      func_787: row[2] !== null && row[2] !== undefined ? Number(row[2]) : undefined,
      func_791: row[3] !== null && row[3] !== undefined ? Number(row[3]) : undefined
    };
  } catch {
    return {};
  }
}

export function getPricingConfigFromDb(db?: Database | null): PricingConfig {
  const targetDb = db || getSyncPgDB();
  if (!targetDb) {
    if (cachedPricingConfig) return cachedPricingConfig;
    const settings = DB.getSettings();
    return sanitizePricingConfig({
      ...DEFAULT_PRICING_CONFIG,
      imageModels: {
        ...DEFAULT_PRICING_CONFIG.imageModels,
        func_787: settings?.costImage787Iirky ?? DEFAULT_PRICING_CONFIG.imageModels.func_787,
        func_621: settings?.costImage621Iirky ?? settings?.costImageNoTextIirky ?? DEFAULT_PRICING_CONFIG.imageModels.func_621,
        func_784: settings?.costImage784Iirky ?? settings?.costImageWithTextIirky ?? DEFAULT_PRICING_CONFIG.imageModels.func_784,
        func_791: settings?.costImage791Iirky ?? DEFAULT_PRICING_CONFIG.imageModels.func_791
      }
    });
  }

  let parsedRaw: any = null;
  try {
    const res = targetDb.exec(
      'SELECT setting_value, updated_at FROM app_settings WHERE setting_key = ? LIMIT 1',
      [PRICING_SETTING_KEY]
    );
    const row = res?.[0]?.values?.[0];
    if (row && row[0]) {
      parsedRaw = JSON.parse(String(row[0]));
      if (row[1] && !parsedRaw.updatedAt) parsedRaw.updatedAt = String(row[1]);
    }
  } catch {}

  const ptImg = readImageCostsFromProTalkSettingsRow(targetDb);
  const merged = sanitizePricingConfig({
    ...DEFAULT_PRICING_CONFIG,
    ...(parsedRaw || {}),
    imageModels: {
      ...DEFAULT_PRICING_CONFIG.imageModels,
      ...(ptImg.func_787 !== undefined ? { func_787: ptImg.func_787 } : {}),
      ...(ptImg.func_621 !== undefined ? { func_621: ptImg.func_621 } : {}),
      ...(ptImg.func_784 !== undefined ? { func_784: ptImg.func_784 } : {}),
      ...(ptImg.func_791 !== undefined ? { func_791: ptImg.func_791 } : {}),
      ...(parsedRaw?.imageModels || {})
    }
  });

  cachedPricingConfig = merged;
  return merged;
}

export async function getPricingConfig(db?: Database | null): Promise<PricingConfig> {
  const targetDb = db || getSyncPgDB() || (await getPgDB());
  return getPricingConfigFromDb(targetDb);
}

export function updatePricingConfigInDb(
  db: Database,
  partial: Partial<PricingConfig>
): PricingConfig {
  const current = getPricingConfigFromDb(db);
  const nowIso = new Date().toISOString();

  const merged = sanitizePricingConfig({
    textAi: { ...current.textAi, ...(partial.textAi || {}) },
    imageModels: { ...current.imageModels, ...(partial.imageModels || {}) },
    scenarioAi: { ...current.scenarioAi, ...(partial.scenarioAi || {}) },
    promoAndFolders: { ...current.promoAndFolders, ...(partial.promoAndFolders || {}) },
    topup: { ...current.topup, ...(partial.topup || {}) },
    updatedAt: nowIso
  });

  const jsonVal = JSON.stringify(merged);
  db.run(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`,
    [PRICING_SETTING_KEY, jsonVal, nowIso]
  );

  // Sync image model costs into protalk_settings so existing image billing/admin settings remain consistent
  try {
    db.run(
      `UPDATE protalk_settings
       SET cost_image_no_text_iirky = ?,
           cost_image_with_text_iirky = ?,
           cost_image_787_iirky = ?,
           cost_image_791_iirky = ?
       WHERE id = 'setting_1'`,
      [
        merged.imageModels.func_621,
        merged.imageModels.func_784,
        merged.imageModels.func_787,
        merged.imageModels.func_791
      ]
    );
  } catch {}

  try {
    DB.updateSettings({
      costImage787Iirky: merged.imageModels.func_787,
      costImage621Iirky: merged.imageModels.func_621,
      costImageNoTextIirky: merged.imageModels.func_621,
      costImage784Iirky: merged.imageModels.func_784,
      costImageWithTextIirky: merged.imageModels.func_784,
      costImage791Iirky: merged.imageModels.func_791
    });
  } catch {}

  cachedPricingConfig = merged;
  savePgDB();
  return merged;
}

export function buildPricingScenarioCostsObject(cfg: PricingConfig) {
  return {
    cost787: cfg.imageModels.func_787,
    cost621: cfg.imageModels.func_621,
    cost784: cfg.imageModels.func_784,
    cost791: cfg.imageModels.func_791,
    pricingConfig: cfg
  };
}

export function invalidatePricingConfigCache(): void {
  cachedPricingConfig = null;
}
