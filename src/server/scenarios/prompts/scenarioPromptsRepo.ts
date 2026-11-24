import { getPgDB } from '../../db/postgres';
import { pgQuery } from '../../pg/client/pgHttpClient';
import { interpolatePgParams } from '../../pg/cache/pgHydrator';
import { SCENARIO_PROMPTS_SEED } from './scenarioPromptsSeed';

function runLocalMemOnly(db: any, pgSql: string, params: any[] = []): void {
  if (!db?.mem?.public) return;
  try {
    db.mem.public.none(interpolatePgParams(pgSql, params));
  } catch (err) {
    console.warn('[ScenarioPromptsRepo] Local pg-mem projection warning:', err);
  }
}

export interface ScenarioBlockPromptRecord {
  id: string;
  node_type: string;
  prompt_type: string;
  title: string;
  description: string;
  system_prompt: string;
  user_prompt_template: string;
  variables_hint: string;
  output_contract: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const CACHE_TTL_MS = 15_000;
let cachedRows: ScenarioBlockPromptRecord[] | null = null;
let cacheLoadedAt = 0;
let lastLocalMutationAt = 0;

function normalizePromptRow(raw: any): ScenarioBlockPromptRecord {
  const nowIso = new Date().toISOString();
  return {
    id: String(raw?.id || '').trim(),
    node_type: String(raw?.node_type || '').trim(),
    prompt_type: String(raw?.prompt_type || 'default').trim(),
    title: String(raw?.title || '').trim(),
    description: String(raw?.description || ''),
    system_prompt: String(raw?.system_prompt || ''),
    user_prompt_template: String(raw?.user_prompt_template || ''),
    variables_hint: String(raw?.variables_hint || ''),
    output_contract: String(raw?.output_contract || ''),
    is_active: raw?.is_active === undefined || raw?.is_active === null ? 1 : Number(raw.is_active),
    created_at: String(raw?.created_at || nowIso),
    updated_at: String(raw?.updated_at || nowIso)
  };
}

export function invalidateScenarioPromptsCache(): void {
  cachedRows = null;
  cacheLoadedAt = 0;
}

/**
 * Fallback one-time seed into local pg-mem ONLY when running without Cloud PostgreSQL
 * (guarded by app_settings marker `scenario_block_prompts_seeded_v1` and zero rows).
 * Existing rows or user edits are NEVER overwritten.
 */
export function seedScenarioPromptsInMemIfNeeded(db: any): number {
  if (!db?.mem?.public) return 0;
  try {
    const existingRows = readAllRowsFromMem(db);
    if (existingRows.length > 0) return 0;

    const nowIso = new Date().toISOString();
    let inserted = 0;
    for (const item of SCENARIO_PROMPTS_SEED) {
      runLocalMemOnly(
        db,
        `INSERT INTO scenario_block_prompts (
           id, node_type, prompt_type, title, description,
           system_prompt, user_prompt_template, variables_hint, output_contract,
           is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (node_type, prompt_type) DO NOTHING`,
        [
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
        ]
      );
      inserted++;
    }
    return inserted;
  } catch (err) {
    console.warn('[ScenarioPromptsRepo] seedScenarioPromptsInMemIfNeeded warning:', err);
    return 0;
  }
}

function readAllRowsFromMem(db: any): ScenarioBlockPromptRecord[] {
  const stmt = db.prepare(
    `SELECT * FROM scenario_block_prompts ORDER BY node_type ASC, prompt_type ASC`
  );
  const rows: ScenarioBlockPromptRecord[] = [];
  while (stmt.step()) {
    rows.push(normalizePromptRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}

function syncCloudRowsIntoMem(db: any, cloudRows: ScenarioBlockPromptRecord[]): void {
  try {
    runLocalMemOnly(db, `DELETE FROM scenario_block_prompts`);
    for (const r of cloudRows) {
      runLocalMemOnly(
        db,
        `INSERT INTO scenario_block_prompts (
           id, node_type, prompt_type, title, description,
           system_prompt, user_prompt_template, variables_hint, output_contract,
           is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (node_type, prompt_type) DO NOTHING`,
        [
          r.id,
          r.node_type,
          r.prompt_type,
          r.title,
          r.description,
          r.system_prompt,
          r.user_prompt_template,
          r.variables_hint,
          r.output_contract,
          r.is_active,
          r.created_at,
          r.updated_at
        ]
      );
    }
  } catch (err) {
    console.warn('[ScenarioPromptsRepo] Failed syncing cloud rows to pg-mem:', err);
  }
}

async function loadAllScenarioPrompts(forceRefresh = false): Promise<ScenarioBlockPromptRecord[]> {
  const now = Date.now();
  if (!forceRefresh && cachedRows && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedRows;
  }

  const db = await getPgDB();
  seedScenarioPromptsInMemIfNeeded(db);

  // Pull directly from Cloud PostgreSQL when cache expires (and no local edit happened in last 5s)
  // so manual SQL edits in ProTalk DB apply automatically without server restart.
  const recentlyMutatedLocally = now - lastLocalMutationAt < 5_000;
  if (!recentlyMutatedLocally) {
    try {
      const cloudRes = await pgQuery<ScenarioBlockPromptRecord>(
        `SELECT * FROM scenario_block_prompts ORDER BY node_type ASC, prompt_type ASC`,
        [],
        { safeMode: true }
      );
      if (Array.isArray(cloudRes?.rows)) {
        const normalized = cloudRes.rows.map(normalizePromptRow);
        if (normalized.length > 0) {
          syncCloudRowsIntoMem(db, normalized);
          cachedRows = normalized;
          cacheLoadedAt = Date.now();
          return normalized;
        }
      }
    } catch {
      // Cloud PG unreachable (e.g. offline/local unit tests): read local pg-mem below
    }
  }

  const memRows = readAllRowsFromMem(db);
  cachedRows = memRows;
  cacheLoadedAt = Date.now();
  return memRows;
}

/**
 * STRICT DB lookup: PostgreSQL table `scenario_block_prompts` is the single source of truth.
 * Throws explicit error when the row is missing, disabled (`is_active = 0`), or empty.
 * Zero hardcoded fallback prompts are allowed at runtime.
 */
export async function getRequiredScenarioPrompt(
  nodeType: string,
  promptType: string = 'default'
): Promise<ScenarioBlockPromptRecord> {
  const targetNode = String(nodeType || '').trim();
  const targetType = String(promptType || 'default').trim();
  const rows = await loadAllScenarioPrompts(false);

  const match = rows.find(
    (r) => r.node_type === targetNode && r.prompt_type === targetType
  );

  if (!match) {
    throw new Error(
      `Промпт сценария не найден в БД (scenario_block_prompts): node_type="${targetNode}", prompt_type="${targetType}". Добавьте или восстановите запись в базе данных.`
    );
  }

  if (Number(match.is_active) === 0) {
    throw new Error(
      `Промпт сценария отключен в БД (is_active = 0): node_type="${targetNode}", prompt_type="${targetType}". Включите промпт в таблице scenario_block_prompts.`
    );
  }

  if (!match.system_prompt.trim() && !match.user_prompt_template.trim()) {
    throw new Error(
      `Промпт сценария пуст в БД (scenario_block_prompts): node_type="${targetNode}", prompt_type="${targetType}". Заполните system_prompt или user_prompt_template.`
    );
  }

  return match;
}

export async function listAllScenarioPromptsFromDb(forceRefresh = false): Promise<ScenarioBlockPromptRecord[]> {
  return loadAllScenarioPrompts(forceRefresh);
}

export async function updateScenarioPromptInDb(
  id: string,
  patch: Partial<
    Pick<
      ScenarioBlockPromptRecord,
      'title' | 'description' | 'system_prompt' | 'user_prompt_template' | 'variables_hint' | 'output_contract' | 'is_active'
    >
  >
): Promise<ScenarioBlockPromptRecord | null> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;

  const db = await getPgDB();
  let current: ScenarioBlockPromptRecord | null = null;
  const existingStmt = db.prepare(`SELECT * FROM scenario_block_prompts WHERE id = ? LIMIT 1`);
  existingStmt.bind([cleanId]);
  if (existingStmt.step()) {
    current = normalizePromptRow(existingStmt.getAsObject());
  }
  existingStmt.free();

  if (!current) {
    const freshRows = await loadAllScenarioPrompts(true);
    current = freshRows.find((r) => r.id === cleanId) || null;
  }
  if (!current) return null;

  const nowIso = new Date().toISOString();
  const next: ScenarioBlockPromptRecord = {
    ...current,
    title: patch.title !== undefined ? String(patch.title) : current.title,
    description: patch.description !== undefined ? String(patch.description) : current.description,
    system_prompt: patch.system_prompt !== undefined ? String(patch.system_prompt) : current.system_prompt,
    user_prompt_template:
      patch.user_prompt_template !== undefined
        ? String(patch.user_prompt_template)
        : current.user_prompt_template,
    variables_hint: patch.variables_hint !== undefined ? String(patch.variables_hint) : current.variables_hint,
    output_contract: patch.output_contract !== undefined ? String(patch.output_contract) : current.output_contract,
    is_active: patch.is_active !== undefined ? Number(patch.is_active ? 1 : 0) : current.is_active,
    updated_at: nowIso
  };

  if (!next.system_prompt.trim() && !next.user_prompt_template.trim()) {
    throw new Error('Промпт не может быть полностью пустым: заполните системную роль или шаблон запроса.');
  }

  await pgQuery(
    `UPDATE scenario_block_prompts
     SET title = $1,
         description = $2,
         system_prompt = $3,
         user_prompt_template = $4,
         variables_hint = $5,
         output_contract = $6,
         is_active = $7,
         updated_at = $8
     WHERE id = $9`,
    [
      next.title,
      next.description,
      next.system_prompt,
      next.user_prompt_template,
      next.variables_hint,
      next.output_contract,
      next.is_active,
      next.updated_at,
      cleanId
    ]
  );

  runLocalMemOnly(
    db,
    `UPDATE scenario_block_prompts
     SET title = $1,
         description = $2,
         system_prompt = $3,
         user_prompt_template = $4,
         variables_hint = $5,
         output_contract = $6,
         is_active = $7,
         updated_at = $8
     WHERE id = $9`,
    [
      next.title,
      next.description,
      next.system_prompt,
      next.user_prompt_template,
      next.variables_hint,
      next.output_contract,
      next.is_active,
      next.updated_at,
      cleanId
    ]
  );

  lastLocalMutationAt = Date.now();
  invalidateScenarioPromptsCache();
  return next;
}

export async function resetScenarioPromptInDb(id: string): Promise<ScenarioBlockPromptRecord | null> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;

  const rows = await loadAllScenarioPrompts(true);
  const current = rows.find((r) => r.id === cleanId);
  const seedMatch = current
    ? SCENARIO_PROMPTS_SEED.find(
        (s) =>
          (s.node_type === current.node_type && s.prompt_type === current.prompt_type) ||
          s.id === current.id
      )
    : SCENARIO_PROMPTS_SEED.find((s) => s.id === cleanId);

  if (!seedMatch) {
    throw new Error('Для этого промпта нет эталонного заводского шаблона.');
  }

  return updateScenarioPromptInDb(current?.id || cleanId, {
    title: seedMatch.title,
    description: seedMatch.description,
    system_prompt: seedMatch.system_prompt,
    user_prompt_template: seedMatch.user_prompt_template,
    variables_hint: seedMatch.variables_hint,
    output_contract: seedMatch.output_contract,
    is_active: 1
  });
}

export async function createScenarioPromptInDb(input: {
  node_type: string;
  prompt_type: string;
  title: string;
  description?: string;
  system_prompt?: string;
  user_prompt_template?: string;
  variables_hint?: string;
  output_contract?: string;
  is_active?: number;
}): Promise<ScenarioBlockPromptRecord> {
  const nodeType = String(input.node_type || '').trim();
  const promptType = String(input.prompt_type || 'default').trim() || 'default';
  const title = String(input.title || '').trim();
  const systemPrompt = String(input.system_prompt || '');
  const userTemplate = String(input.user_prompt_template || '');

  if (!nodeType || !title) {
    throw new Error('Укажите тип блока (node_type) и название промпта.');
  }
  if (!systemPrompt.trim() && !userTemplate.trim()) {
    throw new Error('Заполните системный промпт или шаблон запроса.');
  }

  const nowIso = new Date().toISOString();
  const id = `sbp_${nodeType}_${promptType}_${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9_]/g, '_');
  const record: ScenarioBlockPromptRecord = {
    id,
    node_type: nodeType,
    prompt_type: promptType,
    title,
    description: String(input.description || ''),
    system_prompt: systemPrompt,
    user_prompt_template: userTemplate,
    variables_hint: String(input.variables_hint || ''),
    output_contract: String(input.output_contract || ''),
    is_active: input.is_active === 0 ? 0 : 1,
    created_at: nowIso,
    updated_at: nowIso
  };

  await pgQuery(
    `INSERT INTO scenario_block_prompts (
       id, node_type, prompt_type, title, description,
       system_prompt, user_prompt_template, variables_hint, output_contract,
       is_active, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      record.id,
      record.node_type,
      record.prompt_type,
      record.title,
      record.description,
      record.system_prompt,
      record.user_prompt_template,
      record.variables_hint,
      record.output_contract,
      record.is_active,
      record.created_at,
      record.updated_at
    ]
  );

  const db = await getPgDB();
  runLocalMemOnly(
    db,
    `INSERT INTO scenario_block_prompts (
       id, node_type, prompt_type, title, description,
       system_prompt, user_prompt_template, variables_hint, output_contract,
       is_active, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      record.id,
      record.node_type,
      record.prompt_type,
      record.title,
      record.description,
      record.system_prompt,
      record.user_prompt_template,
      record.variables_hint,
      record.output_contract,
      record.is_active,
      record.created_at,
      record.updated_at
    ]
  );

  lastLocalMutationAt = Date.now();
  invalidateScenarioPromptsCache();
  return record;
}

export async function seedMissingScenarioPromptsInDb(): Promise<{ inserted: number; total: number }> {
  const db = await getPgDB();
  let existing = readAllRowsFromMem(db);
  try {
    const cloudRes = await pgQuery<ScenarioBlockPromptRecord>(
      `SELECT * FROM scenario_block_prompts`,
      [],
      { safeMode: true }
    );
    if (Array.isArray(cloudRes?.rows)) {
      existing = cloudRes.rows.map(normalizePromptRow);
    }
  } catch {}
  const existingKeys = new Set(existing.map((r) => `${r.node_type}::${r.prompt_type}`));
  const nowIso = new Date().toISOString();
  let inserted = 0;

  for (const item of SCENARIO_PROMPTS_SEED) {
    const k = `${item.node_type}::${item.prompt_type}`;
    if (existingKeys.has(k)) continue;
    await pgQuery(
      `INSERT INTO scenario_block_prompts (
         id, node_type, prompt_type, title, description,
         system_prompt, user_prompt_template, variables_hint, output_contract,
         is_active, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (node_type, prompt_type) DO NOTHING`,
      [
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
      ]
    );
    runLocalMemOnly(
      db,
      `INSERT INTO scenario_block_prompts (
         id, node_type, prompt_type, title, description,
         system_prompt, user_prompt_template, variables_hint, output_contract,
         is_active, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (node_type, prompt_type) DO NOTHING`,
      [
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
      ]
    );
    inserted++;
  }

  await pgQuery(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES ('scenario_block_prompts_seeded_v3', '1', $1)
     ON CONFLICT (setting_key) DO NOTHING`,
    [nowIso],
    { safeMode: true }
  ).catch(() => null);

  lastLocalMutationAt = Date.now();
  invalidateScenarioPromptsCache();
  return { inserted, total: existing.length + inserted };
}

function isTemplateTruthy(val: unknown): boolean {
  if (val === undefined || val === null || val === false || val === 0) return false;
  if (typeof val === 'string') {
    const t = val.trim().toLowerCase();
    return t.length > 0 && t !== 'false' && t !== '0';
  }
  return Boolean(val);
}

/**
 * Renders DB prompt templates supporting:
 * - {{#if key}}...{{else}}...{{/if}} and {{#unless key}}...{{else}}...{{/unless}} (nested inside-out)
 * - {{key}} placeholders
 * - Legacy single-brace {key} ONLY when key explicitly exists in vars (leaves JSON braces intact)
 */
export function renderPromptTemplate(
  template: string,
  vars: Record<string, string | number | boolean | undefined | null>
): string {
  if (!template) return '';
  let out = String(template);

  // Resolve innermost {{#if ...}} and {{#unless ...}} blocks iteratively
  for (let pass = 0; pass < 25; pass++) {
    let changed = false;

    out = out.replace(
      /\{\{#(if|unless)\s+([a-zA-Z0-9_]+)\}\}((?:(?!\{\{#(?:if|unless)\b)[\s\S])*?)\{\{\/\1\}\}/g,
      (_full, kind: 'if' | 'unless', key: string, body: string) => {
        changed = true;
        const truthy = isTemplateTruthy(vars[key]);
        const takeTrueBranch = kind === 'if' ? truthy : !truthy;
        const elseIdx = body.indexOf('{{else}}');
        if (elseIdx >= 0) {
          const truePart = body.slice(0, elseIdx);
          const falsePart = body.slice(elseIdx + '{{else}}'.length);
          return takeTrueBranch ? truePart : falsePart;
        }
        return takeTrueBranch ? body : '';
      }
    );

    if (!changed) break;
  }

  // Replace {{key}} placeholders
  out = out.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_full, key: string) => {
    const val = vars[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });

  // Replace legacy {key} ONLY when key is explicitly defined in vars
  out = out.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return full;
    const val = vars[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function combineSystemAndUserPrompt(systemPrompt: string, userPrompt: string): string {
  const sys = String(systemPrompt || '').trim();
  const usr = String(userPrompt || '').trim();
  if (sys && usr) return `${sys}\n\n${usr}`;
  return sys || usr;
}
