import { pgQuery } from '../pg/client/pgHttpClient';
import {
  getPgDB,
  refreshAllTablesCacheFromCloud,
  refreshTableCacheFromCloud
} from '../pg/cache/pgMemAdapter';
import { flushPendingPgWrites } from '../pg/cache/pgWriteQueue';
import { IDENTITY_TABLES, PG_TABLES, PG_TABLE_MAP } from '../pg/schema/tableDefinitions';
import {
  coerceValueForPgColumn,
  getCloudColumnTypesMap,
  upsertTableRowsIntoPostgres
} from '../pg/backup/restoreService';
import { normalizeUserId } from './coreSettingsRepo';

export const ALLOWED_TABLES: string[] = PG_TABLES.map((t) => t.name);

function resolveSafeTableName(rawTable: string): string {
  const cleaned = String(rawTable || '').replace(/[^a-zA-Z0-9_]/g, '');
  if (cleaned === 'tariffs') return 'tarifs';
  return cleaned;
}

function quoteIdent(col: string): string {
  return `"${String(col).replace(/"/g, '""')}"`;
}

export async function getAllTablesInfo(options?: { syncCache?: boolean }) {
  const db = await getPgDB();
  await flushPendingPgWrites();
  const colsByTable = new Map<string, Array<{ name: string; type: string }>>();

  try {
    const schemaRes = await pgQuery<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`
    );
    for (const r of schemaRes.rows || []) {
      const list = colsByTable.get(r.table_name) || [];
      list.push({ name: r.column_name, type: r.data_type.toUpperCase() });
      colsByTable.set(r.table_name, list);
    }
  } catch {
    // Fallback to local metadata if information_schema is temporarily restricted
  }

  const allTables = Array.from(new Set([...ALLOWED_TABLES, ...Array.from(colsByTable.keys())])).filter(
    (t) => t !== 'tariffs' && t !== 'dummy_test'
  );

  // Fetch live cloud counts across all tables in a single fast UNION ALL query (~200ms)
  const cloudCountMap = new Map<string, number>();
  try {
    const unionSql = allTables
      .map((t) => `SELECT '${t}' AS table_name, COUNT(*)::int AS row_count FROM "${t}"`)
      .join(' UNION ALL ');
    if (unionSql) {
      const cntRes = await pgQuery<{ table_name: string; row_count: number }>(unionSql);
      for (const r of cntRes.rows || []) {
        cloudCountMap.set(r.table_name, Number(r.row_count || 0));
      }
    }
  } catch {
    // Fallback below if a table query fails
  }

  const countMap = new Map<string, number>();
  const driftedTables: string[] = [];

  for (const t of allTables) {
    let localCount = 0;
    if (PG_TABLE_MAP.has(t)) {
      try {
        if (!colsByTable.has(t)) {
          const sample = db.exec(`SELECT * FROM "${t}" LIMIT 1`);
          if (sample && sample[0] && sample[0].columns) {
            colsByTable.set(
              t,
              sample[0].columns.map((c) => ({ name: c, type: 'TEXT' }))
            );
          }
        }
        const countRes = db.exec(`SELECT COUNT(*) as cnt FROM "${t}"`);
        localCount = Number(countRes[0]?.values[0]?.[0] || 0);
      } catch {
        localCount = 0;
      }
    }

    if (cloudCountMap.has(t)) {
      const cloudCount = cloudCountMap.get(t)!;
      countMap.set(t, cloudCount);
      if (PG_TABLE_MAP.has(t) && cloudCount !== localCount) {
        driftedTables.push(t);
      }
    } else if (PG_TABLE_MAP.has(t)) {
      countMap.set(t, localCount);
    } else {
      try {
        const remoteCountRes = await pgQuery<{ cnt: string | number }>(`SELECT COUNT(*) as cnt FROM "${t}"`);
        countMap.set(t, Number(remoteCountRes.rows?.[0]?.cnt || 0));
      } catch {
        countMap.set(t, 0);
      }
    }
  }

  // Real-time bi-directional cache heal for tables changed directly in ProTalk DB
  if (driftedTables.length > 0 && options?.syncCache !== false) {
    await Promise.all(driftedTables.slice(0, 12).map((t) => refreshTableCacheFromCloud(t).catch(() => null)));
  }

  return allTables.map((tableName) => ({
    tableName,
    rowCount: countMap.get(tableName) ?? 0,
    columns: colsByTable.get(tableName) || []
  }));
}

export async function getTableRows(tableName: string) {
  const safeTableName = resolveSafeTableName(tableName);
  if (!safeTableName) {
    throw new Error(`Некорректное имя таблицы: ${tableName}`);
  }

  const db = await getPgDB();
  await flushPendingPgWrites();

  let columns: string[] = [];
  try {
    const schemaCols = await pgQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [safeTableName]
    );
    columns = (schemaCols.rows || []).map((r) => r.column_name);
  } catch {}

  if (columns.length === 0) {
    try {
      const sample = db.exec(`SELECT * FROM "${safeTableName}" LIMIT 1`);
      if (sample && sample[0] && sample[0].columns) {
        columns = sample[0].columns;
      }
    } catch {}
  }

  const orderCol = columns.includes('created_at')
    ? '"created_at" DESC NULLS LAST'
    : columns.includes('updated_at')
      ? '"updated_at" DESC NULLS LAST'
      : columns.length > 0
        ? `"${columns[0]}" DESC`
        : '1';

  let rows: any[] = [];
  try {
    const dataRes = await pgQuery(`SELECT * FROM "${safeTableName}" ORDER BY ${orderCol} LIMIT 500`);
    rows = dataRes.rows || [];
    if (columns.length === 0 && rows.length > 0) {
      columns = Object.keys(rows[0]);
    }
    // Keep pg-mem projection synced with live cloud rows when viewing small/medium tables
    if (PG_TABLE_MAP.has(safeTableName) && rows.length < 500) {
      await refreshTableCacheFromCloud(safeTableName).catch(() => null);
    }
  } catch (err: any) {
    console.error(`[getTableRows] pgQuery notice for ${safeTableName}:`, err?.message || err);
  }

  if (rows.length === 0 && PG_TABLE_MAP.has(safeTableName)) {
    try {
      const localRes = db.exec(`SELECT * FROM "${safeTableName}" ORDER BY ${orderCol} LIMIT 500`);
      if (localRes && localRes[0]) {
        if (columns.length === 0 && localRes[0].columns) {
          columns = localRes[0].columns;
        }
        rows = (localRes[0].values || []).map((val) => {
          const rowObj: any = {};
          (localRes[0].columns || []).forEach((col, idx) => {
            rowObj[col] = val[idx];
          });
          return rowObj;
        });
      }
    } catch {}
  }

  if (columns.length === 0 && rows.length > 0) {
    columns = Object.keys(rows[0]);
  }

  return {
    columns,
    rows
  };
}

export async function insertRow(tableName: string, rowData: Record<string, any>) {
  const safeTable = resolveSafeTableName(tableName);
  if (!PG_TABLE_MAP.has(safeTable)) {
    throw new Error(`Таблица ${safeTable} не разрешена.`);
  }

  await getPgDB();
  const isIdentity = IDENTITY_TABLES.has(safeTable);
  const meta = PG_TABLE_MAP.get(safeTable)!;
  const pkCols = meta.pk;

  const colTypes = await getCloudColumnTypesMap(safeTable);
  const fullData: Record<string, any> = {};

  for (const [k, v] of Object.entries(rowData || {})) {
    if (colTypes.has(k)) {
      fullData[k] = coerceValueForPgColumn(v, colTypes.get(k));
    }
  }

  if (isIdentity) {
    delete fullData.id;
    if (safeTable === 'file_storage') {
      if (!fullData.filename) fullData.filename = fullData.name || fullData.slug_name || 'file.bin';
      if (!fullData.url) fullData.url = fullData.original_url || fullData.short_url || '';
      if (fullData.size_bytes === null || fullData.size_bytes === undefined) fullData.size_bytes = 0;
    }
  } else if (pkCols.length === 1 && pkCols[0] === 'id' && !fullData.id) {
    fullData.id = `${safeTable.slice(0, 3)}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  if (colTypes.has('created_at') && !fullData.created_at) {
    fullData.created_at = new Date().toISOString();
  }
  if (colTypes.has('updated_at') && !fullData.updated_at) {
    fullData.updated_at = new Date().toISOString();
  }

  const keys = Object.keys(fullData).filter((k) => colTypes.has(k) && (!isIdentity || k !== 'id'));
  if (keys.length === 0) return fullData;

  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const vals = keys.map((k) =>
    fullData[k] !== null && typeof fullData[k] === 'object' ? JSON.stringify(fullData[k]) : fullData[k]
  );

  let insRes;
  if (isIdentity) {
    insRes = await pgQuery(
      `INSERT INTO "${safeTable}" (${keys.map(quoteIdent).join(', ')}) VALUES (${placeholders}) RETURNING *`,
      vals
    );
  } else {
    const pkList = pkCols.map(quoteIdent).join(', ');
    const nonPk = keys.filter((k) => !pkCols.includes(k));
    const conflictSql =
      nonPk.length > 0
        ? `ON CONFLICT (${pkList}) DO UPDATE SET ${nonPk.map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`).join(', ')}`
        : `ON CONFLICT (${pkList}) DO NOTHING`;
    insRes = await pgQuery(
      `INSERT INTO "${safeTable}" (${keys.map(quoteIdent).join(', ')}) VALUES (${placeholders}) ${conflictSql} RETURNING *`,
      vals
    );
  }

  await refreshTableCacheFromCloud(safeTable).catch(() => null);
  return insRes.rows?.[0] || fullData;
}

export async function updateRow(tableName: string, id: string, rowData: Record<string, any>) {
  const safeTable = resolveSafeTableName(tableName);
  if (!PG_TABLE_MAP.has(safeTable)) {
    throw new Error(`Таблица ${safeTable} не разрешена.`);
  }

  await getPgDB();
  const meta = PG_TABLE_MAP.get(safeTable)!;
  const pkCols = meta.pk;
  const pkCol = pkCols[0] || 'id';

  const colTypes = await getCloudColumnTypesMap(safeTable);
  const keys = Object.keys(rowData || {}).filter(
    (k) => k !== 'id' && !pkCols.includes(k) && colTypes.has(k)
  );
  if (keys.length === 0) return { [pkCol]: id, ...rowData };

  const coercedValues = keys.map((k) => {
    const v = coerceValueForPgColumn(rowData[k], colTypes.get(k));
    return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
  });

  if (colTypes.has('updated_at') && !keys.includes('updated_at')) {
    keys.push('updated_at');
    coercedValues.push(new Date().toISOString());
  }

  const cleanId = decodeURIComponent(String(id || '')).trim();
  const strippedId = cleanId.replace(/^(pub_|req_|pos_|p_|np_|imp_|post-|ch_|user_|scen_)/, '');
  const prefixedId = cleanId.startsWith('req_') ? cleanId : 'req_' + strippedId;

  // Composite primary key (e.g. file_folder_relations: "fileId::folderId")
  if (pkCols.length > 1 && cleanId.includes('::')) {
    const parts = cleanId.split('::');
    const setSql = keys.map((k, idx) => `${quoteIdent(k)} = $${idx + 1}`).join(', ');
    const whereSql = pkCols
      .map((p, idx) => `${quoteIdent(p)} = $${keys.length + idx + 1}`)
      .join(' AND ');
    const pkVals = pkCols.map((p, idx) => coerceValueForPgColumn(parts[idx], colTypes.get(p)));
    await pgQuery(`UPDATE "${safeTable}" SET ${setSql} WHERE ${whereSql}`, [...coercedValues, ...pkVals]);
    await refreshTableCacheFromCloud(safeTable).catch(() => null);
    return { ...rowData };
  }

  if (safeTable === 'users') {
    const canonicalId = normalizeUserId(cleanId);
    const numTg =
      !isNaN(Number(cleanId)) && Number(cleanId) < 10000000000
        ? Number(cleanId)
        : Number(rowData.telegram_id) || 0;
    const setSql = keys.map((k, idx) => `${quoteIdent(k)} = $${idx + 1}`).join(', ');
    const base = keys.length;
    const updRes = await pgQuery(
      `UPDATE users SET ${setSql} WHERE id = $${base + 1} OR id = $${base + 2} OR id = $${base + 3} OR id = $${base + 4} OR (telegram_id = $${base + 5} AND telegram_id != 0) RETURNING *`,
      [...coercedValues, cleanId, canonicalId, strippedId, prefixedId, numTg]
    );
    if ((updRes.rowCount || 0) === 0) {
      return insertRow('users', { ...rowData, id: canonicalId });
    }
    await refreshTableCacheFromCloud('users').catch(() => null);
    return updRes.rows?.[0] || { id: canonicalId, ...rowData };
  }

  if (IDENTITY_TABLES.has(safeTable)) {
    const setSql = keys.map((k, idx) => `${quoteIdent(k)} = $${idx + 2}`).join(', ');
    const updRes = await pgQuery(
      `UPDATE "${safeTable}" SET ${setSql} WHERE id = $1 RETURNING *`,
      [Number(cleanId), ...coercedValues]
    );
    await refreshTableCacheFromCloud(safeTable).catch(() => null);
    return updRes.rows?.[0] || { id: Number(cleanId), ...rowData };
  }

  if (pkCol !== 'id') {
    const setSql = keys.map((k, idx) => `${quoteIdent(k)} = $${idx + 2}`).join(', ');
    const updRes = await pgQuery(
      `UPDATE "${safeTable}" SET ${setSql} WHERE ${quoteIdent(pkCol)} = $1 RETURNING *`,
      [cleanId, ...coercedValues]
    );
    if ((updRes.rowCount || 0) === 0) {
      return insertRow(safeTable, { ...rowData, [pkCol]: cleanId });
    }
    await refreshTableCacheFromCloud(safeTable).catch(() => null);
    return updRes.rows?.[0] || { [pkCol]: cleanId, ...rowData };
  }

  const setSql = keys.map((k, idx) => `${quoteIdent(k)} = $${idx + 1}`).join(', ');
  const base = keys.length;
  const updRes = await pgQuery(
    `UPDATE "${safeTable}" SET ${setSql} WHERE id = $${base + 1} OR id = $${base + 2} OR id = $${base + 3} RETURNING *`,
    [...coercedValues, cleanId, strippedId, prefixedId]
  );
  if ((updRes.rowCount || 0) === 0) {
    return insertRow(safeTable, { ...rowData, id: cleanId });
  }
  await refreshTableCacheFromCloud(safeTable).catch(() => null);
  return updRes.rows?.[0] || { id: cleanId, ...rowData };
}

export async function deleteRow(tableName: string, id: string) {
  const safeTable = resolveSafeTableName(tableName);
  if (!PG_TABLE_MAP.has(safeTable)) {
    throw new Error(`Таблица ${safeTable} не разрешена.`);
  }

  await getPgDB();
  const meta = PG_TABLE_MAP.get(safeTable)!;
  const pkCols = meta.pk;
  const pkCol = pkCols[0] || 'id';
  const cleanId = decodeURIComponent(String(id || '')).trim();
  const colTypes = await getCloudColumnTypesMap(safeTable);

  if (pkCols.length > 1 && cleanId.includes('::')) {
    const parts = cleanId.split('::');
    const whereSql = pkCols.map((p, idx) => `${quoteIdent(p)} = $${idx + 1}`).join(' AND ');
    const pkVals = pkCols.map((p, idx) => coerceValueForPgColumn(parts[idx], colTypes.get(p)));
    await pgQuery(`DELETE FROM "${safeTable}" WHERE ${whereSql}`, pkVals);
    await refreshTableCacheFromCloud(safeTable).catch(() => null);
    return true;
  }

  if (IDENTITY_TABLES.has(safeTable)) {
    await pgQuery(`DELETE FROM "${safeTable}" WHERE id = $1`, [Number(cleanId)]);
    await refreshTableCacheFromCloud(safeTable).catch(() => null);
    return true;
  }

  if (pkCol !== 'id') {
    await pgQuery(`DELETE FROM "${safeTable}" WHERE ${quoteIdent(pkCol)} = $1`, [cleanId]);
    await refreshTableCacheFromCloud(safeTable).catch(() => null);
    return true;
  }

  const strippedId = cleanId.replace(/^(pub_|req_|ch_|user_|scen_)/, '');
  const prefixedId = cleanId.startsWith('req_') ? cleanId : 'req_' + cleanId;
  await pgQuery(`DELETE FROM "${safeTable}" WHERE id = $1 OR id = $2 OR id = $3`, [
    cleanId,
    strippedId,
    prefixedId
  ]);
  await refreshTableCacheFromCloud(safeTable).catch(() => null);
  return true;
}

export async function deleteRows(tableName: string, ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: true, count: 0 };
  }
  let deletedCount = 0;
  for (const id of ids) {
    if (!String(id || '').trim()) continue;
    await deleteRow(tableName, String(id));
    deletedCount++;
  }
  return { success: true, count: deletedCount };
}

export async function importCSVRows(tableName: string, rows: Record<string, any>[]) {
  const safeTable = resolveSafeTableName(tableName);
  if (!PG_TABLE_MAP.has(safeTable)) {
    throw new Error(`Таблица ${safeTable} не разрешена.`);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: true, importedCount: 0 };
  }

  const importedCount = await upsertTableRowsIntoPostgres(safeTable, rows, 'merge');
  await refreshTableCacheFromCloud(safeTable).catch(() => null);
  return { success: true, importedCount };
}

export async function syncAllTablesFromCloud() {
  await flushPendingPgWrites();
  await refreshAllTablesCacheFromCloud();
  return getAllTablesInfo({ syncCache: false });
}

export async function executeRawSQL(sqlStatement: string) {
  await getPgDB();
  const trimmed = String(sqlStatement || '').trim();
  if (!trimmed) {
    throw new Error('Пустой SQL-запрос');
  }

  const isSelect = /^(SELECT|WITH|SHOW|EXPLAIN)\b/i.test(trimmed);
  const res = await pgQuery(trimmed, [], { safeMode: false });

  if (isSelect) {
    const rows = res.rows || [];
    const columns =
      res.fields?.map((f) => f.name) || (rows.length > 0 ? Object.keys(rows[0]) : []);
    return { columns, rows, type: 'select' };
  }

  await refreshAllTablesCacheFromCloud();
  return {
    success: true,
    rowCount: res.rowCount ?? 0,
    message: `Запрос успешно выполнен в PostgreSQL (затронуто строк: ${res.rowCount ?? 0})`,
    type: 'mutation'
  };
}
