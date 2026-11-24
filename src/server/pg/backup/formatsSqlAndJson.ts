import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { pgQuery } from '../client/pgHttpClient';
import { escapePgLiteral } from '../cache/pgHydrator';
import { flushPendingPgWrites } from '../cache/pgWriteQueue';
import { IDENTITY_TABLES, PG_TABLES } from '../schema/tableDefinitions';
import { getLiveAppVersionFromPg } from '../../seo/appVersionRoutes';

export interface DatabaseSnapshotData {
  meta: {
    app: string;
    database: string;
    engine: string;
    version: string;
    exportedAt: number;
    exportedAtIso: string;
    exportedAtMsk: string;
    reason: string;
    tablesCount: number;
    tablesWithData: number;
    totalRows: number;
    sha256?: string;
  };
  tables: Record<string, Record<string, any>[]>;
}

export function getMskTimeStrings(now: Date = new Date()): { mskDisplay: string; fileStamp: string } {
  const mskTime = new Date(now.getTime() + 3 * 3600 * 1000);
  const mskDisplay = mskTime.toISOString().replace('T', ' ').substring(0, 19) + ' МСК';
  const fileStamp = mskTime.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  return { mskDisplay, fileStamp };
}

export function computeSha256(buf: Buffer | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function collectSingleTableSnapshot(
  tableName: string,
  reason: string = 'Экспорт таблицы CSV'
): Promise<DatabaseSnapshotData> {
  await flushPendingPgWrites();

  const cleanName = tableName.toLowerCase() === 'tariffs' ? 'tarifs' : tableName.replace(/[^a-zA-Z0-9_]/g, '');
  const now = new Date();
  const { mskDisplay } = getMskTimeStrings(now);
  const metaTable = PG_TABLES.find((t) => t.name === cleanName);
  const orderCol = metaTable?.pk?.[0] || 'id';

  const [rows, liveVersion] = await Promise.all([
    pgQuery(`SELECT * FROM "${cleanName}" ORDER BY "${orderCol}" ASC`)
      .then((res) => res.rows || [])
      .catch(() =>
        pgQuery(`SELECT * FROM "${cleanName}"`)
          .then((res) => res.rows || [])
          .catch(() => [] as Record<string, any>[])
      ),
    getLiveAppVersionFromPg().catch(() => 'v.1.56')
  ]);

  const tablesData: Record<string, Record<string, any>[]> = { [cleanName]: rows };
  const snapshot: DatabaseSnapshotData = {
    meta: {
      app: 'ИИSMM Telegram Automation',
      database: 'iismm2',
      engine: 'PostgreSQL ProTalk',
      version: liveVersion,
      exportedAt: now.getTime(),
      exportedAtIso: now.toISOString(),
      exportedAtMsk: mskDisplay,
      reason,
      tablesCount: 1,
      tablesWithData: rows.length > 0 ? 1 : 0,
      totalRows: rows.length
    },
    tables: tablesData
  };
  snapshot.meta.sha256 = computeSha256(JSON.stringify(snapshot.tables));
  return snapshot;
}

/**
 * Fetches a complete live snapshot of all 50 tables directly from ProTalk PostgreSQL (iismm2).
 */
export async function collectFullPostgresSnapshot(reason: string = 'Экспорт базы данных'): Promise<DatabaseSnapshotData> {
  await flushPendingPgWrites();

  const now = new Date();
  const { mskDisplay } = getMskTimeStrings(now);
  const tablesData: Record<string, Record<string, any>[]> = {};
  const liveVersion = await getLiveAppVersionFromPg().catch(() => 'v.1.56');

  let totalRows = 0;
  let tablesWithData = 0;

  const batchSize = 12;
  for (let i = 0; i < PG_TABLES.length; i += batchSize) {
    const slice = PG_TABLES.slice(i, i + batchSize);
    await Promise.all(
      slice.map(async (tbl) => {
        try {
          const orderCol = tbl.pk[0] || 'id';
          const res = await pgQuery(`SELECT * FROM "${tbl.name}" ORDER BY "${orderCol}" ASC`);
          const rows = res.rows || [];
          tablesData[tbl.name] = rows;
          totalRows += rows.length;
          if (rows.length > 0) tablesWithData++;
        } catch {
          tablesData[tbl.name] = [];
        }
      })
    );
  }

  const snapshot: DatabaseSnapshotData = {
    meta: {
      app: 'ИИSMM Telegram Automation',
      database: 'iismm2',
      engine: 'PostgreSQL ProTalk',
      version: liveVersion,
      exportedAt: now.getTime(),
      exportedAtIso: now.toISOString(),
      exportedAtMsk: mskDisplay,
      reason,
      tablesCount: PG_TABLES.length,
      tablesWithData,
      totalRows
    },
    tables: tablesData
  };

  const checksum = computeSha256(JSON.stringify(snapshot.tables));
  snapshot.meta.sha256 = checksum;
  return snapshot;
}

/**
 * Generates a structured JSON buffer (plain or gzip-compressed).
 */
export function buildJsonBackupBuffer(
  snapshot: DatabaseSnapshotData,
  compressGzip: boolean = false
): { buffer: Buffer; filename: string; mimeType: string; sha256: string } {
  const { fileStamp } = getMskTimeStrings(new Date(snapshot.meta.exportedAt));
  const rawBuffer = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf-8');
  if (compressGzip) {
    const gz = zlib.gzipSync(rawBuffer, { level: 9 });
    return {
      buffer: gz,
      filename: `iismm2_pg_backup_${fileStamp}.json.gz`,
      mimeType: 'application/gzip',
      sha256: computeSha256(gz)
    };
  }
  return {
    buffer: rawBuffer,
    filename: `iismm2_pg_backup_${fileStamp}.json`,
    mimeType: 'application/json; charset=utf-8',
    sha256: computeSha256(rawBuffer)
  };
}

/**
 * Generates a full PostgreSQL-compatible .sql or .sql.gz dump with DDL, indexes, and transactional INSERTs.
 */
export function buildPostgresSqlDumpBuffer(
  snapshot: DatabaseSnapshotData,
  compressGzip: boolean = false
): { buffer: Buffer; filename: string; mimeType: string; sha256: string } {
  const { fileStamp } = getMskTimeStrings(new Date(snapshot.meta.exportedAt));
  const lines: string[] = [];

  lines.push(`-- ИИSMM PostgreSQL Dump (${snapshot.meta.version})`);
  lines.push(`-- Database: ${snapshot.meta.database} (PostgreSQL ProTalk)`);
  lines.push(`-- Exported At: ${snapshot.meta.exportedAtMsk} (${snapshot.meta.exportedAtIso})`);
  lines.push(`-- Tables: ${snapshot.meta.tablesCount}, Rows: ${snapshot.meta.totalRows}`);
  lines.push(`-- Reason: ${snapshot.meta.reason}`);
  lines.push(`BEGIN;`);
  lines.push(``);

  for (const tbl of PG_TABLES) {
    lines.push(`-- Table: ${tbl.name}`);
    lines.push(tbl.ddl);
    if (tbl.indexes) {
      for (const idx of tbl.indexes) {
        lines.push(idx);
      }
    }

    const rows = snapshot.tables[tbl.name] || [];
    if (rows.length > 0) {
      const isIdentity = IDENTITY_TABLES.has(tbl.name);
      const rawCols = Object.keys(rows[0]);
      const quotedCols = rawCols.map((c) => `"${c.replace(/"/g, '')}"`).join(', ');

      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const valuesBlock = chunk
          .map((row) => `(${rawCols.map((c) => escapePgLiteral(row[c])).join(', ')})`)
          .join(',\n  ');

        const pkList = tbl.pk.map((p) => `"${p}"`).join(', ');
        const nonPk = rawCols.filter((c) => !tbl.pk.includes(c));
        const conflictClause =
          nonPk.length > 0
            ? `ON CONFLICT (${pkList}) DO UPDATE SET ${nonPk.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')}`
            : `ON CONFLICT (${pkList}) DO NOTHING`;

        if (isIdentity && rawCols.includes('id')) {
          lines.push(
            `INSERT INTO "${tbl.name}" (${quotedCols}) OVERRIDING SYSTEM VALUE VALUES\n  ${valuesBlock}\n${conflictClause};`
          );
        } else {
          lines.push(`INSERT INTO "${tbl.name}" (${quotedCols}) VALUES\n  ${valuesBlock}\n${conflictClause};`);
        }
      }

      if (isIdentity && rawCols.includes('id')) {
        lines.push(
          `SELECT setval(pg_get_serial_sequence('${tbl.name}', 'id'), COALESCE((SELECT MAX(id) FROM "${tbl.name}"), 1));`
        );
      }
    }
    lines.push(``);
  }

  lines.push(`COMMIT;`);

  const rawBuffer = Buffer.from(lines.join('\n'), 'utf-8');
  if (compressGzip) {
    const gz = zlib.gzipSync(rawBuffer, { level: 9 });
    return {
      buffer: gz,
      filename: `iismm2_pg_dump_${fileStamp}.sql.gz`,
      mimeType: 'application/gzip',
      sha256: computeSha256(gz)
    };
  }

  return {
    buffer: rawBuffer,
    filename: `iismm2_pg_dump_${fileStamp}.sql`,
    mimeType: 'application/sql; charset=utf-8',
    sha256: computeSha256(rawBuffer)
  };
}
