import { Settings } from './settingsTypes';
import {
  getSyncPgDB,
  savePgDB,
  getModerationLogUrlFromPg,
  setModerationLogUrlInPg
} from '../../db/postgres';
import { getDefaultChannelIdentifier } from '../posts/postDomain';

let settingsCache: Settings = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  channelId: '',
  backupChannelId: '',
  autoPostSchedule: false,
  autoPostTime: '07:00',
  theme: 'light',
  protalkBotId: process.env.PROTALK_BOT_ID || '66275',
  protalkBotToken: process.env.PROTALK_BOT_TOKEN || '',
  moderationLogUrl: '',
  moderationEnabled: true,
  costPerTokenRub: 0.001,
  robokassa: {
    merchantLogin: '',
    pass1: '',
    pass2: '',
    isTest: false
  }
};

export class SettingsDomain {
  public static getCachedSettings(): Settings {
    return settingsCache;
  }

  public static setCachedSettings(s: Settings): void {
    settingsCache = s;
  }

  public static getSettings(): Settings {
    const s = { ...settingsCache };
    try {
      const modUrl = getModerationLogUrlFromPg();
      if (modUrl !== undefined) {
        s.moderationLogUrl = modUrl;
      }
      const pgDB = getSyncPgDB();
      if (pgDB) {
        const res = pgDB.exec(
          "SELECT bot_id, bot_token, cost_image_no_text_iirky, cost_image_with_text_iirky, function_621_id, function_784_id, function_784_resolution, cost_image_787_iirky, function_787_id, function_787_ai_model, function_787_size, function_787_quality, function_787_output_format, function_787_response_format, function_787_background, function_787_mode, cost_image_791_iirky, function_791_id FROM protalk_settings WHERE id = 'setting_1' LIMIT 1;"
        );
        if (res[0] && res[0].values && res[0].values[0]) {
          const row = res[0].values[0];
          if (row[0]) s.protalkBotId = String(row[0]);
          if (row[1]) s.protalkBotToken = String(row[1]);
          s.costImageNoTextIirky = row[2] !== null && row[2] !== undefined ? Number(row[2]) : 5;
          s.costImage621Iirky = s.costImageNoTextIirky;
          s.costImageWithTextIirky = row[3] !== null && row[3] !== undefined ? Number(row[3]) : 10;
          s.costImage784Iirky = s.costImageWithTextIirky;
          s.function621Id = row[4] !== null && row[4] !== undefined ? Number(row[4]) : 621;
          s.function784Id = row[5] !== null && row[5] !== undefined ? Number(row[5]) : 784;
          s.function784Resolution = row[6] ? String(row[6]) : '1K';
          s.costImage787Iirky = row[7] !== null && row[7] !== undefined ? Number(row[7]) : 0;
          s.function787Id = row[8] !== null && row[8] !== undefined ? Number(row[8]) : 787;
          s.function787AiModel = row[9] ? String(row[9]) : 'am/flux.2-klein-4b';
          s.function787Size = row[10] ? String(row[10]) : '1024x1024';
          s.function787Quality = 'auto';
          s.function787OutputFormat = row[12] ? String(row[12]) : 'png';
          s.function787ResponseFormat = 'url';
          s.function787Background = 'auto';
          s.function787Mode = 'sync';
          s.costImage791Iirky = row[16] !== null && row[16] !== undefined ? Number(row[16]) : 15;
          s.function791Id = row[17] !== null && row[17] !== undefined ? Number(row[17]) : 791;
        }
      }
    } catch (e) {}

    if (s.costImageNoTextIirky === undefined) s.costImageNoTextIirky = 5;
    if (s.costImage621Iirky === undefined) s.costImage621Iirky = 5;
    if (s.costImageWithTextIirky === undefined) s.costImageWithTextIirky = 10;
    if (s.costImage784Iirky === undefined) s.costImage784Iirky = 10;
    if (s.costImage787Iirky === undefined) s.costImage787Iirky = 0;
    if (s.costImage791Iirky === undefined) s.costImage791Iirky = 15;
    if (!s.function621Id) s.function621Id = 621;
    if (!s.function784Id) s.function784Id = 784;
    if (!s.function787Id) s.function787Id = 787;
    if (!s.function791Id) s.function791Id = 791;
    if (!s.function784Resolution) s.function784Resolution = '1K';
    if (!s.channelId || s.channelId.trim() === '' || s.channelId === '@SAV_AI') {
      s.channelId = getDefaultChannelIdentifier();
    }
    settingsCache = s;
    return s;
  }

  public static updateSettings(updated: Partial<Settings>): Settings {
    settingsCache = { ...settingsCache, ...updated };
    try {
      if (updated.moderationLogUrl !== undefined) {
        setModerationLogUrlInPg(updated.moderationLogUrl);
      }
      const pgDB = getSyncPgDB();
      if (pgDB) {
        pgDB.run(
          `UPDATE protalk_settings SET 
            bot_id = COALESCE(?, bot_id), 
            bot_token = COALESCE(?, bot_token),
            cost_image_no_text_iirky = COALESCE(?, cost_image_no_text_iirky),
            cost_image_with_text_iirky = COALESCE(?, cost_image_with_text_iirky),
            function_621_id = COALESCE(?, function_621_id),
            function_784_id = COALESCE(?, function_784_id),
            function_784_resolution = COALESCE(?, function_784_resolution),
            cost_image_787_iirky = COALESCE(?, cost_image_787_iirky),
            function_787_id = COALESCE(?, function_787_id),
            function_787_ai_model = COALESCE(?, function_787_ai_model),
            function_787_size = COALESCE(?, function_787_size),
            function_787_quality = COALESCE(?, function_787_quality),
            function_787_output_format = COALESCE(?, function_787_output_format),
            function_787_response_format = COALESCE(?, function_787_response_format),
            function_787_background = COALESCE(?, function_787_background),
            function_787_mode = COALESCE(?, function_787_mode),
            cost_image_791_iirky = COALESCE(?, cost_image_791_iirky),
            function_791_id = COALESCE(?, function_791_id)
          WHERE id = 'setting_1';`,
          [
            updated.protalkBotId || null,
            updated.protalkBotToken || null,
            updated.costImage621Iirky !== undefined
              ? Number(updated.costImage621Iirky)
              : updated.costImageNoTextIirky !== undefined
              ? Number(updated.costImageNoTextIirky)
              : null,
            updated.costImage784Iirky !== undefined
              ? Number(updated.costImage784Iirky)
              : updated.costImageWithTextIirky !== undefined
              ? Number(updated.costImageWithTextIirky)
              : null,
            updated.function621Id !== undefined ? Number(updated.function621Id) : null,
            updated.function784Id !== undefined ? Number(updated.function784Id) : null,
            updated.function784Resolution || null,
            updated.costImage787Iirky !== undefined ? Number(updated.costImage787Iirky) : null,
            updated.function787Id !== undefined ? Number(updated.function787Id) : null,
            updated.function787AiModel || null,
            updated.function787Size || null,
            updated.function787Quality || null,
            updated.function787OutputFormat || null,
            updated.function787ResponseFormat || null,
            updated.function787Background || null,
            updated.function787Mode || null,
            updated.costImage791Iirky !== undefined ? Number(updated.costImage791Iirky) : null,
            updated.function791Id !== undefined ? Number(updated.function791Id) : null
          ]
        );
        // Sync updated image model costs back into app_settings.pricing_config for two-way consistency
        const hasImageCostUpdate =
          updated.costImage787Iirky !== undefined ||
          updated.costImage621Iirky !== undefined ||
          updated.costImageNoTextIirky !== undefined ||
          updated.costImage784Iirky !== undefined ||
          updated.costImageWithTextIirky !== undefined ||
          updated.costImage791Iirky !== undefined;

        if (hasImageCostUpdate) {
          try {
            let currentPricing: any = {};
            const existing = pgDB.exec(
              "SELECT setting_value FROM app_settings WHERE setting_key = 'pricing_config' LIMIT 1"
            );
            if (existing?.[0]?.values?.[0]?.[0]) {
              currentPricing = JSON.parse(String(existing[0].values[0][0]));
            }
            const nowIso = new Date().toISOString();
            const nextPricing = {
              ...currentPricing,
              imageModels: {
                ...(currentPricing.imageModels || {}),
                ...(updated.costImage787Iirky !== undefined ? { func_787: Math.max(0, Number(updated.costImage787Iirky) || 0) } : {}),
                ...(updated.costImage621Iirky !== undefined
                  ? { func_621: Math.max(0, Number(updated.costImage621Iirky) || 0) }
                  : updated.costImageNoTextIirky !== undefined
                  ? { func_621: Math.max(0, Number(updated.costImageNoTextIirky) || 0) }
                  : {}),
                ...(updated.costImage784Iirky !== undefined
                  ? { func_784: Math.max(0, Number(updated.costImage784Iirky) || 0) }
                  : updated.costImageWithTextIirky !== undefined
                  ? { func_784: Math.max(0, Number(updated.costImageWithTextIirky) || 0) }
                  : {}),
                ...(updated.costImage791Iirky !== undefined ? { func_791: Math.max(0, Number(updated.costImage791Iirky) || 0) } : {})
              },
              updatedAt: nowIso
            };
            pgDB.run(
              `INSERT INTO app_settings (setting_key, setting_value, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`,
              ['pricing_config', JSON.stringify(nextPricing), nowIso]
            );
          } catch (syncErr) {
            console.warn('[SettingsDomain] Failed two-way sync to pricing_config:', syncErr);
          }
        }
        savePgDB();
      }
    } catch (e) {
      console.warn('[SettingsDomain] Could not sync settings to PostgreSQL:', e);
    }
    return settingsCache;
  }
}
