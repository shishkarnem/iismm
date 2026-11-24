import { pgQuery } from '../client/pgHttpClient';
import {
  createProTalkTrigger,
  deployProTalkEdgeFunction,
  listProTalkCronJobs,
  listProTalkEdgeFunctions,
  listProTalkTriggers,
  upsertProTalkCronJob
} from '../client/protalkPlatformApi';
import { PG_TABLES } from './tableDefinitions';
import { SCENARIO_PROMPTS_SEED } from '../../scenarios/prompts/scenarioPromptsSeed';

/**
 * Ensures all 50 application tables, extended columns on file_folders / file_storage,
 * and indexes exist in ProTalk PostgreSQL (iismm2).
 */
export async function ensurePostgresSchemaInCloud(): Promise<void> {
  let existingTables = new Set<string>();
  let existingFileStorageCols = new Set<string>();

  try {
    const [tablesRes, fsColsRes] = await Promise.all([
      pgQuery<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
        [],
        { safeMode: true }
      ),
      pgQuery<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'file_storage'`,
        [],
        { safeMode: true }
      )
    ]);

    existingTables = new Set((tablesRes.rows || []).map((r) => String(r.table_name).toLowerCase()));
    existingFileStorageCols = new Set((fsColsRes.rows || []).map((r) => String(r.column_name).toLowerCase()));
  } catch {
    // If information_schema inspection is restricted or unavailable,
    // trust that the 50 cloud tables are already provisioned and avoid destructive DDL
  }

  // If inspection did not return table names (or all tables already exist), do not attempt DDL
  if (existingTables.size === 0) {
    return;
  }

  const allTablesPresent = PG_TABLES.every((t) => existingTables.has(t.name.toLowerCase()));
  const identityExtended = existingFileStorageCols.has('file_key') && existingFileStorageCols.has('user_id');

  // Fast path: all 50 tables and extended identity columns already exist in cloud PostgreSQL
  if (!allTablesPresent || !identityExtended) {
    const ffMeta = PG_TABLES.find((t) => t.name === 'file_folders');
    const fsMeta = PG_TABLES.find((t) => t.name === 'file_storage');

    if (ffMeta && !existingTables.has('file_folders')) {
      await pgQuery(ffMeta.ddl).catch(() => null);
      existingTables.add('file_folders');
    }
    if (fsMeta && !existingTables.has('file_storage')) {
      await pgQuery(fsMeta.ddl).catch(() => null);
      existingTables.add('file_storage');
    }

    if (!identityExtended && existingTables.has('file_folders') && existingTables.has('file_storage')) {
      await pgQuery(`
        ALTER TABLE file_folders
          ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'admin',
          ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#0284c7',
          ADD COLUMN IF NOT EXISTS folder_type TEXT DEFAULT 'custom',
          ADD COLUMN IF NOT EXISTS legacy_id INT8;
      `).catch(() => null);

      await pgQuery(`DROP INDEX IF EXISTS idx_file_folders_parent_name;`).catch(() => null);
      await pgQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_file_folders_user_parent_name
        ON file_folders (COALESCE(user_id, 'admin'), COALESCE(parent_id, 0), lower(name));
      `).catch(() => null);

      await pgQuery(`
        ALTER TABLE file_storage
          DROP CONSTRAINT IF EXISTS file_storage_url_key;
      `).catch(() => null);
      await pgQuery(`DROP INDEX IF EXISTS file_storage_url_key;`).catch(() => null);

      await pgQuery(`
        ALTER TABLE file_storage
          ADD COLUMN IF NOT EXISTS file_key TEXT,
          ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'admin',
          ADD COLUMN IF NOT EXISTS name TEXT,
          ADD COLUMN IF NOT EXISTS slug_name TEXT,
          ADD COLUMN IF NOT EXISTS original_url TEXT,
          ADD COLUMN IF NOT EXISTS short_url TEXT,
          ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'photo',
          ADD COLUMN IF NOT EXISTS file_size INT8 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS width INT4 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS height INT4 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS aspect_ratio DOUBLE PRECISION DEFAULT 1,
          ADD COLUMN IF NOT EXISTS legacy_id INT8;
      `).catch(() => null);
    }

    const missingNonIdentity = PG_TABLES.filter(
      (t) => !t.isIdentity && !existingTables.has(t.name.toLowerCase())
    );
    const batchSize = 8;

    for (let i = 0; i < missingNonIdentity.length; i += batchSize) {
      const slice = missingNonIdentity.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (tbl) => {
          await pgQuery(tbl.ddl).catch(() => null);
          if (tbl.indexes && tbl.indexes.length > 0) {
            for (const idxSql of tbl.indexes) {
              await pgQuery(idxSql).catch(() => null);
            }
          }
        })
      );
    }

    for (const tbl of PG_TABLES.filter((t) => t.isIdentity)) {
      if (tbl.indexes) {
        for (const idxSql of tbl.indexes) {
          await pgQuery(idxSql).catch(() => null);
        }
      }
    }
  }

  // Ensure extended posts columns for audio/protection/link preview exist in Cloud PG
  if (existingTables.has('posts')) {
    try {
      const postsColsRes = await pgQuery<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'posts'`,
        [],
        { safeMode: true }
      );
      const existingPostsCols = new Set((postsColsRes.rows || []).map((r) => String(r.column_name).toLowerCase()));
      if (!existingPostsCols.has('audio_format') || !existingPostsCols.has('protect_content') || !existingPostsCols.has('link_preview_enabled')) {
        await pgQuery(`
          ALTER TABLE posts
            ADD COLUMN IF NOT EXISTS audio_format TEXT DEFAULT 'audio',
            ADD COLUMN IF NOT EXISTS audio_title TEXT,
            ADD COLUMN IF NOT EXISTS audio_performer TEXT,
            ADD COLUMN IF NOT EXISTS protect_content INT4 DEFAULT 0,
            ADD COLUMN IF NOT EXISTS link_preview_enabled INT4 DEFAULT 1;
        `).catch(() => null);
      }
    } catch {}
  }

  // Ensure extended promo_folders columns exist in Cloud PG
  if (existingTables.has('promo_folders')) {
    try {
      const pfColsRes = await pgQuery<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promo_folders'`,
        [],
        { safeMode: true }
      );
      const existingPfCols = new Set((pfColsRes.rows || []).map((r) => String(r.column_name).toLowerCase()));
      if (
        !existingPfCols.has('attachment_type') ||
        !existingPfCols.has('attachment_urls') ||
        !existingPfCols.has('repeat_message_format') ||
        !existingPfCols.has('audio_format') ||
        !existingPfCols.has('reminder_sent') ||
        !existingPfCols.has('reminder_before_minutes')
      ) {
        await pgQuery(`
          ALTER TABLE promo_folders
            ADD COLUMN IF NOT EXISTS attachment_type TEXT,
            ADD COLUMN IF NOT EXISTS attachment_urls TEXT,
            ADD COLUMN IF NOT EXISTS audio_format TEXT DEFAULT 'audio',
            ADD COLUMN IF NOT EXISTS repeat_message_format TEXT DEFAULT 'rich',
            ADD COLUMN IF NOT EXISTS repeat_attachment_type TEXT,
            ADD COLUMN IF NOT EXISTS repeat_attachment_urls TEXT,
            ADD COLUMN IF NOT EXISTS reminder_before_minutes INT4 DEFAULT 60,
            ADD COLUMN IF NOT EXISTS reminder_sent INT4 DEFAULT 0;
        `).catch(() => null);
      }
    } catch {}
  }

  // Ensure reminder columns exist on promo_selections in Cloud PG
  if (existingTables.has('promo_selections')) {
    try {
      const psColsRes = await pgQuery<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promo_selections'`,
        [],
        { safeMode: true }
      );
      const existingPsCols = new Set((psColsRes.rows || []).map((r) => String(r.column_name).toLowerCase()));
      if (!existingPsCols.has('reminder_sent') || !existingPsCols.has('reminder_before_minutes')) {
        await pgQuery(`
          ALTER TABLE promo_selections
            ADD COLUMN IF NOT EXISTS reminder_before_minutes INT4 DEFAULT 60,
            ADD COLUMN IF NOT EXISTS reminder_sent INT4 DEFAULT 0;
        `).catch(() => null);
      }
    } catch {}
  }

  // Ensure unified Telegram + Bell notification channel columns exist on push_notification_settings in Cloud PG
  if (existingTables.has('push_notification_settings')) {
    try {
      const pnsColsRes = await pgQuery<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'push_notification_settings'`,
        [],
        { safeMode: true }
      );
      const existingPnsCols = new Set((pnsColsRes.rows || []).map((r) => String(r.column_name).toLowerCase()));
      if (!existingPnsCols.has('telegram_enabled') || !existingPnsCols.has('bell_enabled')) {
        await pgQuery(`
          ALTER TABLE push_notification_settings
            ADD COLUMN IF NOT EXISTS telegram_enabled INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS tg_cat_publish INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS tg_cat_folders INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS tg_cat_balance INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS tg_cat_social INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS tg_cat_ai INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS tg_cat_system INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS bell_enabled INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS bell_cat_publish INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS bell_cat_folders INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS bell_cat_balance INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS bell_cat_social INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS bell_cat_ai INT4 DEFAULT 1,
            ADD COLUMN IF NOT EXISTS bell_cat_system INT4 DEFAULT 1;
        `).catch(() => null);
      }
    } catch {}
  }

  // Ensure app_version = v.1.56 in app_settings if missing
  const nowIso = new Date().toISOString();
  await pgQuery(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES ('app_version', 'v.1.56', $1)
     ON CONFLICT (setting_key) DO NOTHING`,
    [nowIso]
  ).catch(() => null);

  // One-time additive seed migration (v3) of scenario_block_prompts (never overwrites existing rows or manual edits)
  try {
    const markerRes = await pgQuery<{ setting_value: string }>(
      `SELECT setting_value FROM app_settings WHERE setting_key = 'scenario_block_prompts_seeded_v3' LIMIT 1`,
      [],
      { safeMode: true }
    );
    const alreadySeededV3 = Boolean(markerRes?.rows && markerRes.rows.length > 0);
    if (!alreadySeededV3) {
      const existingRowsRes = await pgQuery<{ node_type: string; prompt_type: string }>(
        `SELECT node_type, prompt_type FROM scenario_block_prompts`,
        [],
        { safeMode: true }
      ).catch(() => ({ rows: [] } as any));
      const existingKeys = new Set(
        (existingRowsRes?.rows || []).map((r: any) => `${String(r.node_type)}::${String(r.prompt_type)}`)
      );

      let failedCount = 0;
      for (const item of SCENARIO_PROMPTS_SEED) {
        const key = `${item.node_type}::${item.prompt_type}`;
        if (existingKeys.has(key)) continue;
        const sql = `INSERT INTO scenario_block_prompts (
             id, node_type, prompt_type, title, description,
             system_prompt, user_prompt_template, variables_hint, output_contract,
             is_active, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (node_type, prompt_type) DO NOTHING`;
        const args = [
          item.id,
          item.node_type,
          item.prompt_type,
          item.title,
          item.description,
          item.system_prompt,
          item.user_prompt_template,
          item.variables_hint,
          item.output_contract,
          item.is_active,
          nowIso,
          nowIso
        ];
        try {
          await pgQuery(sql, args);
        } catch {
          try {
            await new Promise((r) => setTimeout(r, 250));
            await pgQuery(sql, args);
          } catch (insertErr) {
            failedCount++;
            console.warn(`[PostgreSQL ProTalk] Prompt seed failed for ${key}:`, insertErr);
          }
        }
      }

      if (failedCount === 0) {
        await pgQuery(
          `INSERT INTO app_settings (setting_key, setting_value, updated_at)
           VALUES ('scenario_block_prompts_seeded_v3', '1', $1)
           ON CONFLICT (setting_key) DO NOTHING`,
          [nowIso]
        ).catch(() => null);
      }
    }

    const v4MarkerRes = await pgQuery<{ setting_value: string }>(
      `SELECT setting_value FROM app_settings WHERE setting_key = 'scenario_prompts_v4_no_caps_v2_unified' LIMIT 1`,
      [],
      { safeMode: true }
    );
    const alreadySyncedV4 = Boolean(v4MarkerRes?.rows && v4MarkerRes.rows.length > 0);
    if (!alreadySyncedV4) {
      let failedV4 = 0;
      for (const item of SCENARIO_PROMPTS_SEED) {
        const sql = `INSERT INTO scenario_block_prompts (
             id, node_type, prompt_type, title, description,
             system_prompt, user_prompt_template, variables_hint, output_contract,
             is_active, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (node_type, prompt_type) DO UPDATE SET
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             system_prompt = EXCLUDED.system_prompt,
             user_prompt_template = EXCLUDED.user_prompt_template,
             variables_hint = EXCLUDED.variables_hint,
             output_contract = EXCLUDED.output_contract,
             updated_at = EXCLUDED.updated_at`;
        const args = [
          item.id,
          item.node_type,
          item.prompt_type,
          item.title,
          item.description,
          item.system_prompt,
          item.user_prompt_template,
          item.variables_hint,
          item.output_contract,
          item.is_active,
          nowIso,
          nowIso
        ];
        try {
          await pgQuery(sql, args);
        } catch (syncErr) {
          failedV4++;
          console.warn(`[PostgreSQL ProTalk] v4 prompt sync failed for ${item.node_type}::${item.prompt_type}:`, syncErr);
        }
      }
      if (failedV4 === 0) {
        await pgQuery(
          `INSERT INTO app_settings (setting_key, setting_value, updated_at)
           VALUES ('scenario_prompts_v4_no_caps_v2_unified', '1', $1)
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at`,
          [nowIso]
        ).catch(() => null);
      }
    }
  } catch (seedErr) {
    console.warn('[PostgreSQL ProTalk] Non-fatal scenario_block_prompts seed warning:', seedErr);
  }
}

/**
 * Sets up lightweight, performance-oriented PostgreSQL Triggers, SQL Cron cleanup tasks,
 * and a health/backup Edge Function on ProTalk DB (only where beneficial for optimization).
 */
export async function setupProTalkTriggersCronAndEdge(): Promise<{
  triggersCreated: number;
  cronCreated: number;
  edgeDeployed: boolean;
}> {
  let triggersCreated = 0;
  let cronCreated = 0;
  let edgeDeployed = false;

  // 1. Lightweight BEFORE UPDATE updated_at triggers
  try {
    const existingTriggers = await listProTalkTriggers().catch(() => []);
    const existingNames = new Set(
      existingTriggers.map((t: any) => String(t.name || t.trigger_name || ''))
    );

    const triggerTables = [
      'users',
      'posts',
      'sceneries',
      'group_chats',
      'user_chats',
      'promo_folders',
      'promo_selections',
      'app_settings',
      'system_configs',
      'push_subscriptions',
      'push_notification_settings'
    ];

    for (const table of triggerTables) {
      const trgName = `trg_${table}_updated_at`;
      if (existingNames.has(trgName)) continue;
      try {
        await createProTalkTrigger({
          name: trgName,
          schema: 'public',
          table,
          timing: 'BEFORE',
          events: ['UPDATE'],
          plpgsqlBody: `NEW.updated_at = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); RETURN NEW;`
        });
        triggersCreated++;
      } catch {
        // Ignore if trigger already exists in pg_trigger
      }
    }
  } catch {
    // Non-fatal if platform triggers API is unavailable or already established
  }

  // 2. Native PostgreSQL SQL Cron jobs for autonomous DB hygiene
  try {
    const existingCron = await listProTalkCronJobs().catch(() => []);
    const cronNames = new Set(existingCron.map((c: any) => String(c.name || '')));

    if (!cronNames.has('iismm2_cleanup_old_logs')) {
      await upsertProTalkCronJob({
        name: 'iismm2_cleanup_old_logs',
        cronExpression: '15 3 * * *',
        actionType: 'sql',
        actionPayload: `DELETE FROM logs WHERE created_at IS NOT NULL AND created_at < to_char(NOW() - INTERVAL '30 days', 'YYYY-MM-DD');`,
        enabled: true
      }).catch(() => null);
      cronCreated++;
    }

    if (!cronNames.has('iismm2_cleanup_empty_chat_messages')) {
      await upsertProTalkCronJob({
        name: 'iismm2_cleanup_empty_chat_messages',
        cronExpression: '30 3 * * *',
        actionType: 'sql',
        actionPayload: `DELETE FROM chat_messages WHERE TRIM(COALESCE(text, '')) = '' AND TRIM(COALESCE(media_url, '')) = '' AND TRIM(COALESCE(images_json, '')) IN ('', 'null', '[]') AND TRIM(COALESCE(forwarded_json, '')) IN ('', 'null');`,
        enabled: true
      }).catch(() => null);
      cronCreated++;
    }
  } catch {
    // Non-fatal if platform cron API is unavailable or already established
  }

  // 3. Deploy lightweight Edge Function for DB status & autonomous snapshot trigger
  try {
    const existingFns = await listProTalkEdgeFunctions().catch(() => []);
    const hasHook = existingFns.some((f: any) => f.slug === 'db-health-backup-hook' && String(f.code || '').includes('proxy/query'));
    if (!hasHook) {
      await deployProTalkEdgeFunction({
        name: 'ИИSMM DB Health & Backup Hook',
        slug: 'db-health-backup-hook',
        runtime: 'edge',
        methods: ['GET', 'POST'],
        code: `export default async function handler(req) {
  const start = Date.now();
  const headers = { "Content-Type": "application/json", "X-User-Id": "recTWyxN1GrSPlSxc" };
  const q = async (query) => {
    const r = await fetch("https://db.pro-talk.ru/api/proxy/query", {
      method: "POST",
      headers,
      body: JSON.stringify({ database: "iismm2", query, params: [], safeMode: true })
    });
    return r.json();
  };
  const [ver, usersCnt, postsCnt] = await Promise.all([
    q("SELECT setting_value FROM app_settings WHERE setting_key = 'app_version' LIMIT 1"),
    q("SELECT COUNT(*)::int AS cnt FROM users"),
    q("SELECT COUNT(*)::int AS cnt FROM posts")
  ]);
  return {
    ok: true,
    database: "iismm2",
    engine: "PostgreSQL ProTalk",
    version: ver?.rows?.[0]?.setting_value || "v.1.56",
    users: usersCnt?.rows?.[0]?.cnt || 0,
    posts: postsCnt?.rows?.[0]?.cnt || 0,
    latencyMs: Date.now() - start,
    checkedAt: new Date().toISOString()
  };
}`,
        enabled: true
      }).catch(() => null);
      edgeDeployed = true;
    }
  } catch (err) {
    console.warn('[PostgreSQL ProTalk] Edge function setup warning:', err);
  }

  return { triggersCreated, cronCreated, edgeDeployed };
}
