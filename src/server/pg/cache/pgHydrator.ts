import type { IMemoryDb } from 'pg-mem';
import { pgQuery } from '../client/pgHttpClient';
import { PG_TABLES } from '../schema/tableDefinitions';

export function escapePgLiteral(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : 'NULL';
  }
  if (val instanceof Date) {
    return `'${val.toISOString().replace(/'/g, "''")}'`;
  }
  if (typeof val === 'object') {
    const json = JSON.stringify(val).replace(/'/g, "''");
    return `'${json}'`;
  }
  const str = String(val).replace(/\0/g, '').replace(/'/g, "''");
  return `'${str}'`;
}

export function interpolatePgParams(sql: string, params: any[] = []): string {
  if (!params || params.length === 0) return sql;
  return sql.replace(/\$(\d+)\b/g, (match, numStr) => {
    const idx = parseInt(numStr, 10) - 1;
    if (idx < 0 || idx >= params.length) return match;
    return escapePgLiteral(params[idx]);
  });
}

/**
 * Hydrates a single table in pg-mem directly from ProTalk PostgreSQL (iismm2).
 */
export async function hydrateSingleTableFromCloud(memDb: IMemoryDb, tableName: string): Promise<number> {
  const res = await pgQuery(`SELECT * FROM "${tableName}"`, [], { safeMode: false });
  const rows = res.rows || [];

  memDb.public.none(`DELETE FROM "${tableName}";`);
  if (rows.length === 0) return 0;

  let memTable: any = null;
  try {
    memTable = memDb.public.getTable(tableName, true);
  } catch {}
  const validColSet = memTable ? new Set(memTable.columns.map((c: any) => c.id)) : null;
  const cols = validColSet ? Object.keys(rows[0]).filter((c) => validColSet.has(c)) : Object.keys(rows[0]);
  if (cols.length === 0) return 0;
  const quotedCols = cols.map((c) => `"${c.replace(/"/g, '')}"`).join(', ');

  // Insert in chunks of 100 rows for speed
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuesSql = chunk
      .map((row) => `(${cols.map((c) => escapePgLiteral(row[c])).join(', ')})`)
      .join(', ');
    memDb.public.none(`INSERT INTO "${tableName}" (${quotedCols}) VALUES ${valuesSql} ON CONFLICT DO NOTHING;`);
  }

  // Advance sequence on identity tables so local inserts never collide with existing IDs
  if (tableName === 'file_folders' || tableName === 'file_storage') {
    try {
      const maxId = rows.reduce((acc, r) => Math.max(acc, Number(r.id) || 0), 0);
      if (maxId > 0) {
        const tbl = (memDb.public as any).getTable(tableName, true);
        if (tbl && tbl.serialsId) {
          const currentMap = (memDb as any).data.getMap(tbl.serialsId) || new Map();
          (memDb as any).data.set(tbl.serialsId, currentMap.set('id', maxId));
        }
      }
    } catch {
      // Ignore if table metadata unavailable
    }
  }

  return rows.length;
}

/**
 * Hydrates all 50 tables from ProTalk PostgreSQL (iismm2) into pg-mem in parallel batches.
 * Order ensures file_folders loads before file_storage due to foreign key reference.
 */
export async function hydrateAllTablesFromCloud(memDb: IMemoryDb): Promise<{
  tablesLoaded: number;
  totalRows: number;
}> {
  let totalRows = 0;
  let tablesLoaded = 0;

  // 1. Hydrate file_folders first, then file_storage (FK parent -> child)
  try {
    totalRows += await hydrateSingleTableFromCloud(memDb, 'file_folders');
    tablesLoaded++;
  } catch (err) {
    console.warn('[PostgreSQL Hydrator] Warning hydrating file_folders:', err);
  }

  try {
    totalRows += await hydrateSingleTableFromCloud(memDb, 'file_storage');
    tablesLoaded++;
  } catch (err) {
    console.warn('[PostgreSQL Hydrator] Warning hydrating file_storage:', err);
  }

  // 2. Hydrate remaining tables in parallel batches of 8
  const others = PG_TABLES.filter((t) => t.name !== 'file_folders' && t.name !== 'file_storage');
  const batchSize = 8;

  for (let i = 0; i < others.length; i += batchSize) {
    const slice = others.slice(i, i + batchSize);
    const counts = await Promise.all(
      slice.map(async (tbl) => {
        try {
          const c = await hydrateSingleTableFromCloud(memDb, tbl.name);
          tablesLoaded++;
          return c;
        } catch (err: any) {
          console.warn(`[PostgreSQL Hydrator] Warning hydrating ${tbl.name}: ${err?.message || err}`);
          return 0;
        }
      })
    );
    totalRows += counts.reduce((a, b) => a + b, 0);
  }

  return { tablesLoaded, totalRows };
}
