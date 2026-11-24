import * as zlib from 'zlib';
import { pgQuery } from '../client/pgHttpClient';
import { escapePgLiteral } from '../cache/pgHydrator';
import { refreshAllTablesCacheFromCloud } from '../cache/pgMemAdapter';
import { IDENTITY_TABLES, PG_TABLE_MAP } from '../schema/tableDefinitions';
import { parseRfc4180Csv } from './formatsNdjsonAndCsv';

export interface RestoreSummary {
  success: boolean;
  formatDetected: string;
  tablesRestored: number;
  rowsRestored: number;
  perTable: Record<string, number>;
  errors: string[];
}

export type PgColumnTypeMap = Map<string, string>;

export async function getCloudColumnTypesMap(tableName: string): Promise<PgColumnTypeMap> {
  const cleanName = tableName.toLowerCase() === 'tariffs' ? 'tarifs' : tableName.toLowerCase();
  const map = new Map<string, string>();
  try {
    const res = await pgQuery<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [cleanName]
    );
    for (const r of res.rows || []) {
      map.set(r.column_name, String(r.data_type || '').toLowerCase());
    }
  } catch {
    // Fallback to DDL inspection if information_schema is temporarily unavailable
  }
  if (map.size === 0) {
    const meta = PG_TABLE_MAP.get(cleanName);
    const bodyMatch = meta?.ddl?.match(/\(([\s\S]*)\)/);
    if (bodyMatch) {
      for (const rawLine of bodyMatch[1].split('\n')) {
        const line = rawLine.trim().replace(/,$/, '');
        if (!line || /^(PRIMARY\s+KEY|UNIQUE|CONSTRAINT|FOREIGN\s+KEY)/i.test(line)) continue;
        const m = line.match(/^"?([a-zA-Z0-9_]+)"?\s+([A-Z0-9_ ]+)/i);
        if (m) map.set(m[1], m[2].toLowerCase());
      }
    }
  }
  return map;
}

export function coerceValueForPgColumn(rawVal: any, dataType?: string): any {
  if (rawVal === undefined || rawVal === null) return null;
  const dt = String(dataType || '').toLowerCase();

  if (typeof rawVal === 'string') {
    const trimmed = rawVal.trim();
    if (trimmed === '' && /(int|bigint|smallint|double|real|numeric|decimal|float|bool|timestamp|date)/i.test(dt)) {
      return null;
    }
    if (/(bigint|integer|smallint|int8|int4|int2)/i.test(dt)) {
      const n = Number(trimmed);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    if (/(double|real|numeric|decimal|float)/i.test(dt)) {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    if (/bool/i.test(dt)) {
      if (['true', '1', 't', 'yes', 'да'].includes(trimmed.toLowerCase())) return true;
      if (['false', '0', 'f', 'no', 'нет'].includes(trimmed.toLowerCase())) return false;
      return null;
    }
  }

  if (typeof rawVal === 'number') {
    if (/bool/i.test(dt)) return rawVal !== 0;
    return Number.isFinite(rawVal) ? rawVal : null;
  }

  if (typeof rawVal === 'boolean') {
    if (/(int|bigint|smallint)/i.test(dt)) return rawVal ? 1 : 0;
    return rawVal;
  }

  return rawVal;
}

function maybeGunzipBuffer(input: Buffer, filename?: string): Buffer {
  const isGzMagic = input.length >= 2 && input[0] === 0x1f && input[1] === 0x8b;
  if (isGzMagic || (filename && filename.toLowerCase().endsWith('.gz'))) {
    return zlib.gunzipSync(input);
  }
  return input;
}

function splitSqlStatements(sqlContent: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;

  for (let i = 0; i < sqlContent.length; i++) {
    const ch = sqlContent[i];
    const next = sqlContent[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (!inSingle && !inDouble && ch === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === "'" && !inDouble) {
      current += ch;
      if (inSingle && next === "'") {
        current += "'";
        i++;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (ch === ';' && !inSingle && !inDouble) {
      const stmt = current.trim();
      if (stmt && !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(stmt)) {
        statements.push(stmt);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail && !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(tail)) {
    statements.push(tail);
  }
  return statements;
}

export async function upsertTableRowsIntoPostgres(
  tableName: string,
  rows: Record<string, any>[],
  mode: 'merge' | 'replace' = 'merge'
): Promise<number> {
  const cleanName = tableName.toLowerCase() === 'tariffs' ? 'tarifs' : tableName.toLowerCase();
  const meta = PG_TABLE_MAP.get(cleanName);
  if (!meta) return 0;

  if (mode === 'replace') {
    await pgQuery(`DELETE FROM "${cleanName}"`).catch(() => null);
  }
  if (!rows || rows.length === 0) return 0;

  const colTypes = await getCloudColumnTypesMap(cleanName);
  const validColsSet = colTypes.size > 0 ? new Set(colTypes.keys()) : null;

  const isIdentity = IDENTITY_TABLES.has(cleanName);
  const unionCols = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row || {}).forEach((k) => {
        if (!validColsSet || validColsSet.has(k)) set.add(k);
      });
      return set;
    }, new Set<string>())
  );

  const hasExplicitIdentityIds = isIdentity && rows.every((r) => r && r.id !== undefined && r.id !== null && String(r.id).trim() !== '');
  const rawCols = unionCols.filter((c) => !(isIdentity && !hasExplicitIdentityIds && c === 'id'));
  if (rawCols.length === 0) return 0;

  if (cleanName === 'file_storage') {
    if (!rawCols.includes('filename')) rawCols.push('filename');
    if (!rawCols.includes('url')) rawCols.push('url');
    if (!rawCols.includes('size_bytes')) rawCols.push('size_bytes');
  }

  const quotedCols = rawCols.map((c) => `"${c.replace(/"/g, '')}"`).join(', ');
  let inserted = 0;
  const chunkSize = 100;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuesBlock = chunk
      .map((row) => {
        const enriched: Record<string, any> = {};
        for (const col of rawCols) {
          enriched[col] = coerceValueForPgColumn(row?.[col], colTypes.get(col));
        }
        if (cleanName === 'file_storage') {
          if (!enriched.filename) enriched.filename = row?.name || row?.slug_name || 'file.bin';
          if (!enriched.url) enriched.url = row?.original_url || '';
          if (enriched.size_bytes === null || enriched.size_bytes === undefined) {
            enriched.size_bytes = Number(row?.file_size || 0) || 0;
          }
        }
        return `(${rawCols.map((c) => escapePgLiteral(enriched[c])).join(', ')})`;
      })
      .join(', ');

    const pkList = meta.pk.map((p) => `"${p}"`).join(', ');
    const nonPk = rawCols.filter((c) => !meta.pk.includes(c));
    const conflictSql =
      nonPk.length > 0
        ? `ON CONFLICT (${pkList}) DO UPDATE SET ${nonPk.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')}`
        : `ON CONFLICT (${pkList}) DO NOTHING`;

    if (isIdentity && hasExplicitIdentityIds) {
      await pgQuery(`INSERT INTO "${cleanName}" (${quotedCols}) OVERRIDING SYSTEM VALUE VALUES ${valuesBlock} ${conflictSql};`);
    } else if (isIdentity) {
      await pgQuery(`INSERT INTO "${cleanName}" (${quotedCols}) VALUES ${valuesBlock} ON CONFLICT DO NOTHING;`);
    } else {
      await pgQuery(`INSERT INTO "${cleanName}" (${quotedCols}) VALUES ${valuesBlock} ${conflictSql};`);
    }
    inserted += chunk.length;
  }

  if (isIdentity && hasExplicitIdentityIds) {
    await pgQuery(
      `SELECT setval(pg_get_serial_sequence('${cleanName}', 'id'), COALESCE((SELECT MAX(id) FROM "${cleanName}"), 1))`
    ).catch(() => null);
  }

  return inserted;
}

/**
 * Restores ProTalk PostgreSQL (iismm2) from .json, .json.gz, .sql, .sql.gz, .ndjson/.jsonl, or .csv.
 */
export async function restorePostgresFromBackupPayload(params: {
  buffer: Buffer;
  filename?: string;
  targetTable?: string;
  mode?: 'merge' | 'replace';
  skipCacheRefresh?: boolean;
}): Promise<RestoreSummary> {
  const errors: string[] = [];
  const perTable: Record<string, number> = {};
  let tablesRestored = 0;
  let rowsRestored = 0;
  const mode = params.mode || 'merge';

  const unzipped = maybeGunzipBuffer(params.buffer, params.filename);
  const text = unzipped.toString('utf-8').replace(/^\uFEFF/, '').trim();
  const lowerName = (params.filename || '').toLowerCase().replace(/\.gz$/, '');

  // 1. SQL Dump (.sql / .sql.gz)
  if (lowerName.endsWith('.sql') || /^--\s*ИИSMM PostgreSQL Dump|^BEGIN;|^CREATE\s+TABLE|^INSERT\s+INTO/im.test(text)) {
    const statements = splitSqlStatements(text);

    if (mode === 'replace') {
      const insertTables = new Set<string>();
      for (const s of statements) {
        const m = s.match(/^INSERT\s+INTO\s+"?([a-zA-Z0-9_]+)"?/i);
        if (m && PG_TABLE_MAP.has(m[1].toLowerCase())) {
          insertTables.add(m[1].toLowerCase());
        }
      }
      const orderedDelete = [
        ...Array.from(insertTables).filter((t) => t === 'file_folder_relations'),
        ...Array.from(insertTables).filter((t) => t === 'file_storage'),
        ...Array.from(insertTables).filter((t) => t !== 'file_folder_relations' && t !== 'file_storage')
      ];
      for (const t of orderedDelete) {
        await pgQuery(`DELETE FROM "${t}"`).catch(() => null);
      }
    }

    for (const stmt of statements) {
      const createTblMatch = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?/i);
      if (createTblMatch && PG_TABLE_MAP.has(createTblMatch[1].toLowerCase())) {
        continue;
      }
      const createIdxMatch = stmt.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[a-zA-Z0-9_"]+\s+ON\s+"?([a-zA-Z0-9_]+)"?/i);
      if (createIdxMatch && PG_TABLE_MAP.has(createIdxMatch[1].toLowerCase())) {
        continue;
      }

      try {
        const res = await pgQuery(stmt);
        const insMatch = stmt.match(/^INSERT\s+INTO\s+"?([a-zA-Z0-9_]+)"?/i);
        if (insMatch) {
          const tbl = insMatch[1].toLowerCase();
          const valuesIdx = stmt.search(/\bVALUES\b/i);
          const estimatedRows = valuesIdx >= 0 ? (stmt.slice(valuesIdx).match(/\)\s*,\s*\(/g)?.length || 0) + 1 : 0;
          const delta = Math.max(Number(res.rowCount || 0), estimatedRows);
          perTable[tbl] = (perTable[tbl] || 0) + delta;
          rowsRestored += delta;
        }
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    tablesRestored = Object.keys(perTable).length;
    if (!params.skipCacheRefresh) {
      await refreshAllTablesCacheFromCloud();
    }
    return {
      success: errors.length === 0 || rowsRestored > 0 || tablesRestored > 0,
      formatDetected: params.filename?.toLowerCase().endsWith('.gz') ? 'sql.gz' : 'sql',
      tablesRestored,
      rowsRestored,
      perTable,
      errors: errors.slice(0, 20)
    };
  }

  // 2. NDJSON / JSONL (.ndjson / .jsonl)
  if (lowerName.endsWith('.ndjson') || lowerName.endsWith('.jsonl') || text.startsWith('{"type":"meta"')) {
    const grouped: Record<string, Record<string, any>[]> = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.type === 'row' && parsed.table && parsed.row) {
          if (!grouped[parsed.table]) grouped[parsed.table] = [];
          grouped[parsed.table].push(parsed.row);
        }
      } catch (err: any) {
        errors.push(`NDJSON parse error: ${err?.message}`);
      }
    }
    for (const [tbl, rows] of Object.entries(grouped)) {
      try {
        const count = await upsertTableRowsIntoPostgres(tbl, rows, mode);
        if (count > 0 || mode === 'replace') {
          perTable[tbl] = count;
          rowsRestored += count;
          tablesRestored++;
        }
      } catch (err: any) {
        errors.push(`${tbl}: ${err?.message}`);
      }
    }
    if (!params.skipCacheRefresh) {
      await refreshAllTablesCacheFromCloud();
    }
    return {
      success: errors.length === 0 || tablesRestored > 0,
      formatDetected: 'ndjson',
      tablesRestored,
      rowsRestored,
      perTable,
      errors: errors.slice(0, 20)
    };
  }

  // 3. CSV (.csv)
  if (lowerName.endsWith('.csv') || (!text.startsWith('{') && !text.startsWith('['))) {
    const parsedCsv = parseRfc4180Csv(text);
    if (parsedCsv.length === 0) {
      throw new Error('CSV-файл не содержит строк с данными для восстановления');
    }

    if ('__table__' in parsedCsv[0] && '__row_json__' in parsedCsv[0]) {
      const grouped: Record<string, Record<string, any>[]> = {};
      for (const r of parsedCsv) {
        const tbl = r.__table__;
        if (!tbl) continue;
        try {
          const obj = JSON.parse(r.__row_json__);
          if (!grouped[tbl]) grouped[tbl] = [];
          grouped[tbl].push(obj);
        } catch {
          // Ignore malformed row
        }
      }
      for (const [tbl, rows] of Object.entries(grouped)) {
        try {
          const count = await upsertTableRowsIntoPostgres(tbl, rows, mode);
          if (count > 0 || mode === 'replace') {
            perTable[tbl] = count;
            rowsRestored += count;
            tablesRestored++;
          }
        } catch (err: any) {
          errors.push(`${tbl}: ${err?.message}`);
        }
      }
    } else {
      const tableFromFilenameMatch = lowerName.match(/^iismm2_([a-z0-9_]+)_\d{4}-\d{2}-\d{2}/i);
      const inferredTable =
        params.targetTable ||
        (tableFromFilenameMatch && PG_TABLE_MAP.has(tableFromFilenameMatch[1]) ? tableFromFilenameMatch[1] : undefined);
      if (!inferredTable || !PG_TABLE_MAP.has(inferredTable)) {
        throw new Error('Для восстановления одиночной CSV-таблицы выберите целевую таблицу в инспекторе');
      }
      const count = await upsertTableRowsIntoPostgres(inferredTable, parsedCsv, mode);
      perTable[inferredTable] = count;
      rowsRestored += count;
      tablesRestored = 1;
    }

    if (!params.skipCacheRefresh) {
      await refreshAllTablesCacheFromCloud();
    }
    return {
      success: tablesRestored > 0 && errors.length === 0,
      formatDetected: 'csv',
      tablesRestored,
      rowsRestored,
      perTable,
      errors: errors.slice(0, 20)
    };
  }

  // 4. Structured JSON (.json / .json.gz)
  const json = JSON.parse(text);
  const tablesMap: Record<string, any[]> = json?.tables || json?.data || json;
  const entries = Object.entries(tablesMap).filter(([, rows]) => Array.isArray(rows));

  // Ensure parent tables restore before child FK tables
  const sortedEntries = entries.sort(([a], [b]) => {
    const rank = (name: string) =>
      name === 'file_folders' ? 0 : name === 'file_storage' ? 1 : name === 'file_folder_relations' ? 2 : 3;
    return rank(a) - rank(b);
  });

  for (const [tbl, rows] of sortedEntries) {
    if (!PG_TABLE_MAP.has(tbl.toLowerCase() === 'tariffs' ? 'tarifs' : tbl.toLowerCase())) continue;
    try {
      const count = await upsertTableRowsIntoPostgres(tbl, rows, mode);
      if (count > 0 || mode === 'replace') {
        perTable[tbl] = count;
        rowsRestored += count;
        tablesRestored++;
      }
    } catch (err: any) {
      errors.push(`${tbl}: ${err?.message}`);
    }
  }

  if (!params.skipCacheRefresh) {
    await refreshAllTablesCacheFromCloud();
  }
  return {
    success: errors.length === 0 || tablesRestored > 0,
    formatDetected: params.filename?.toLowerCase().endsWith('.gz') ? 'json.gz' : 'json',
    tablesRestored,
    rowsRestored,
    perTable,
    errors: errors.slice(0, 20)
  };
}
