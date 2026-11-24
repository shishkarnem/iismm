import { DataType, newDb, type IMemoryDb } from 'pg-mem';
import { ensurePostgresSchemaInCloud, setupProTalkTriggersCronAndEdge } from '../schema/schemaInitializer';
import { translateSqlToPostgres } from '../schema/sqlDialectTranslator';
import { IDENTITY_TABLES, PG_TABLES } from '../schema/tableDefinitions';
import { hydrateAllTablesFromCloud, hydrateSingleTableFromCloud, interpolatePgParams } from './pgHydrator';
import { enqueuePgWrite, flushPendingPgWrites } from './pgWriteQueue';

export interface PgCompatStatement {
  bind(params?: any[]): boolean;
  step(): boolean;
  run(params?: any[]): boolean;
  getAsObject(): Record<string, any>;
  get(): any[];
  free(): boolean;
}

export interface PgCompatExecResult {
  columns: string[];
  values: any[][];
}

/**
 * Pure PostgreSQL adapter backed by cloud ProTalk PostgreSQL (iismm2) + hydrated pg-mem projection.
 * Manages database operations completely in PostgreSQL while keeping synchronous read/prepare compatibility
 * and writing every mutation directly to cloud PostgreSQL (iismm2).
 */
export class PgCloudDatabase {
  public readonly mem: IMemoryDb;
  private lastAffectedRows: number = 0;

  constructor(mem: IMemoryDb) {
    this.mem = mem;
  }

  public exec(rawSql: string, rawParams?: any[]): PgCompatExecResult[] {
    const translated = translateSqlToPostgres(rawSql, rawParams || []);
    if (translated.isSelectChanges) {
      return [{ columns: ['changes()'], values: [[this.lastAffectedRows]] }];
    }
    if (translated.isIgnoredDDL || !translated.sql) {
      return [];
    }

    const formattedSql = interpolatePgParams(translated.sql, translated.params);

    if (translated.isMutation) {
      try {
        const res = this.mem.public.query(formattedSql);
        this.lastAffectedRows = typeof res.rowCount === 'number' ? res.rowCount : 1;
      } catch (err: any) {
        this.lastAffectedRows = 0;
        console.warn(`[PgCloudDatabase.exec] Local projection warning: ${err?.message || err}`);
      }
      this.dispatchCloudWrite(translated.sql, translated.params, translated.targetTable);
      return [];
    }

    try {
      const qRes = this.mem.public.query(formattedSql);
      const rows = qRes.rows || [];
      if (rows.length === 0) {
        return [];
      }
      const columns = qRes.fields?.map((f) => f.name) || Object.keys(rows[0]);
      const values = rows.map((r) => columns.map((c) => (r[c] === undefined ? null : r[c])));
      return [{ columns, values }];
    } catch (err: any) {
      console.warn(`[PgCloudDatabase.exec] Query warning: ${err?.message || err}\nSQL: ${formattedSql.slice(0, 220)}`);
      return [];
    }
  }

  public run(rawSql: string, rawParams?: any[]): this {
    const translated = translateSqlToPostgres(rawSql, rawParams || []);
    if (translated.isIgnoredDDL || !translated.sql) {
      return this;
    }

    const formattedSql = interpolatePgParams(translated.sql, translated.params);
    let localAssignedId: number | null = null;

    try {
      if (
        translated.isMutation &&
        translated.targetTable &&
        IDENTITY_TABLES.has(translated.targetTable) &&
        /^INSERT\s+INTO/i.test(formattedSql)
      ) {
        try {
          const rows = this.mem.public.many(`${formattedSql.replace(/;$/, '')} RETURNING id;`);
          this.lastAffectedRows = rows.length || 1;
          if (rows?.[0]?.id !== undefined) {
            localAssignedId = Number(rows[0].id);
          }
        } catch (firstErr: any) {
          if (/duplicate key.*pkey/i.test(firstErr?.message || '')) {
            // Auto-heal sequence desync on identity tables
            const maxRow = this.mem.public.many(`SELECT COALESCE(MAX(id), 0) AS max_id FROM "${translated.targetTable}";`);
            const maxId = Number(maxRow[0]?.max_id) || 0;
            const tbl = (this.mem.public as any).getTable(translated.targetTable, true);
            if (tbl && tbl.serialsId) {
              const currentMap = (this.mem as any).data.getMap(tbl.serialsId) || new Map();
              (this.mem as any).data.set(tbl.serialsId, currentMap.set('id', maxId));
            }
            const rows = this.mem.public.many(`${formattedSql.replace(/;$/, '')} RETURNING id;`);
            this.lastAffectedRows = rows.length || 1;
            if (rows?.[0]?.id !== undefined) {
              localAssignedId = Number(rows[0].id);
            }
          } else {
            throw firstErr;
          }
        }
      } else {
        const qRes = this.mem.public.query(formattedSql);
        this.lastAffectedRows = typeof qRes.rowCount === 'number' ? qRes.rowCount : 1;
      }
    } catch (err: any) {
      this.lastAffectedRows = 0;
      console.warn(`[PgCloudDatabase.run] Local projection warning: ${err?.message || err}\nSQL: ${formattedSql.slice(0, 220)}`);
    }

    if (translated.isMutation) {
      this.dispatchCloudWrite(translated.sql, translated.params, translated.targetTable, localAssignedId);
    }

    return this;
  }

  public prepare(rawSql: string, initialParams?: any[]): PgCompatStatement {
    const self = this;
    let boundParams: any[] = Array.isArray(initialParams) ? [...initialParams] : [];
    let executed = false;
    let rows: Record<string, any>[] = [];
    let columns: string[] = [];
    let cursor = -1;

    const executePrepared = () => {
      if (executed) return;
      executed = true;
      const translated = translateSqlToPostgres(rawSql, boundParams);
      if (translated.isIgnoredDDL || !translated.sql) {
        rows = [];
        columns = [];
        return;
      }

      const formattedSql = interpolatePgParams(translated.sql, translated.params);

      if (translated.isMutation) {
        self.run(rawSql, boundParams);
        rows = [];
        columns = [];
        return;
      }

      try {
        const qRes = self.mem.public.query(formattedSql);
        rows = qRes.rows || [];
        columns = qRes.fields?.map((f) => f.name) || (rows[0] ? Object.keys(rows[0]) : []);
      } catch (err: any) {
        console.warn(`[PgCloudDatabase.prepare] Query warning: ${err?.message || err}\nSQL: ${formattedSql.slice(0, 220)}`);
        rows = [];
        columns = [];
      }
    };

    return {
      bind(params?: any[]): boolean {
        boundParams = Array.isArray(params) ? [...params] : [];
        executed = false;
        cursor = -1;
        return true;
      },
      step(): boolean {
        executePrepared();
        cursor++;
        return cursor < rows.length;
      },
      run(params?: any[]): boolean {
        const p = Array.isArray(params) ? params : boundParams;
        self.run(rawSql, p);
        return true;
      },
      getAsObject(): Record<string, any> {
        if (cursor < 0 || cursor >= rows.length) return {};
        return { ...rows[cursor] };
      },
      get(): any[] {
        if (cursor < 0 || cursor >= rows.length) return [];
        const r = rows[cursor];
        return columns.map((c) => r[c]);
      },
      free(): boolean {
        rows = [];
        return true;
      }
    };
  }

  private dispatchCloudWrite(
    pgSql: string,
    params: any[],
    targetTable?: string,
    localAssignedId?: number | null
  ): void {
    let cloudSql = pgSql;
    const isIdentityInsert =
      Boolean(targetTable && IDENTITY_TABLES.has(targetTable)) && /^INSERT\s+INTO/i.test(pgSql);

    if (isIdentityInsert && !/\bRETURNING\b/i.test(cloudSql)) {
      cloudSql = `${cloudSql.replace(/;$/, '')} RETURNING id`;
    }

    void enqueuePgWrite(cloudSql, params, targetTable, (returnedRows) => {
      if (isIdentityInsert && targetTable && localAssignedId && returnedRows?.[0]?.id !== undefined) {
        const cloudId = Number(returnedRows[0].id);
        if (cloudId && cloudId !== localAssignedId) {
          try {
            this.mem.public.none(`UPDATE "${targetTable}" SET id = ${cloudId} WHERE id = ${localAssignedId};`);
          } catch {
            // Ignore if already aligned
          }
        }
      }
    });
  }
}

let pgCloudInstance: PgCloudDatabase | null = null;
let initPromise: Promise<PgCloudDatabase> | null = null;

function registerStandardPgMemFunctions(mem: IMemoryDb): void {
  mem.public.registerFunction({
    name: 'to_char',
    args: [DataType.timestamptz, DataType.text],
    returns: DataType.text,
    implementation: (d: Date) => (d instanceof Date ? d.toISOString() : new Date().toISOString())
  });

  mem.public.registerFunction({
    name: 'to_char',
    args: [DataType.timestamp, DataType.text],
    returns: DataType.text,
    implementation: (d: Date) => (d instanceof Date ? d.toISOString() : new Date().toISOString())
  });

  mem.public.registerFunction({
    name: 'trim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (s: string | null) => (s === null || s === undefined ? '' : String(s).trim())
  });

  mem.public.registerFunction({
    name: 'btrim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (s: string | null) => (s === null || s === undefined ? '' : String(s).trim())
  });

  mem.public.registerFunction({
    name: 'ltrim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (s: string | null) => (s === null || s === undefined ? '' : String(s).trimStart())
  });

  mem.public.registerFunction({
    name: 'rtrim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (s: string | null) => (s === null || s === undefined ? '' : String(s).trimEnd())
  });

  mem.public.registerFunction({
    name: 'replace',
    args: [DataType.text, DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (source: string | null, search: string | null, replacement: string | null) => {
      if (source === null || source === undefined) return null as any;
      const needle = search === null || search === undefined ? '' : String(search);
      const repl = replacement === null || replacement === undefined ? '' : String(replacement);
      if (!needle) return String(source);
      return String(source).split(needle).join(repl);
    }
  });

  mem.public.registerFunction({
    name: 'substr',
    args: [DataType.text, DataType.integer, DataType.integer],
    returns: DataType.text,
    implementation: (s: string | null, start: number, len: number) => {
      if (s === null || s === undefined) return null as any;
      const idx = Math.max(0, (Number(start) || 1) - 1);
      return String(s).slice(idx, idx + Math.max(0, Number(len) || 0));
    }
  });

  mem.public.registerFunction({
    name: 'substr',
    args: [DataType.text, DataType.integer],
    returns: DataType.text,
    implementation: (s: string | null, start: number) => {
      if (s === null || s === undefined) return null as any;
      const idx = Math.max(0, (Number(start) || 1) - 1);
      return String(s).slice(idx);
    }
  });

  mem.public.registerFunction({
    name: 'instr',
    args: [DataType.text, DataType.text],
    returns: DataType.integer,
    implementation: (s: string | null, sub: string | null) => {
      if (s === null || s === undefined || sub === null || sub === undefined) return 0;
      return String(s).indexOf(String(sub)) + 1;
    }
  });

  mem.public.registerFunction({
    name: 'strpos',
    args: [DataType.text, DataType.text],
    returns: DataType.integer,
    implementation: (s: string | null, sub: string | null) => {
      if (s === null || s === undefined || sub === null || sub === undefined) return 0;
      return String(s).indexOf(String(sub)) + 1;
    }
  });

  mem.public.registerFunction({
    name: 'split_part',
    args: [DataType.text, DataType.text, DataType.integer],
    returns: DataType.text,
    implementation: (s: string | null, delim: string | null, field: number) => {
      if (s === null || s === undefined) return null as any;
      const parts = String(s).split(String(delim ?? ''));
      const i = (Number(field) || 1) - 1;
      return i >= 0 && i < parts.length ? parts[i] : '';
    }
  });

  mem.public.registerFunction({
    name: 'ifnull',
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (a: string | null, b: string | null) => (a !== null && a !== undefined ? a : (b as any))
  });

  mem.public.registerFunction({
    name: 'datetime',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (val: string | null) => {
      if (!val || String(val).toLowerCase() === 'now') return new Date().toISOString();
      const parsed = new Date(val);
      return Number.isNaN(parsed.getTime()) ? String(val) : parsed.toISOString();
    }
  });

  mem.public.registerFunction({
    name: 'datetime',
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (baseVal: string | null, modVal: string | null) => {
      const base =
        !baseVal || String(baseVal).toLowerCase() === 'now' ? new Date() : new Date(String(baseVal));
      const d = Number.isNaN(base.getTime()) ? new Date() : new Date(base.getTime());
      const m = String(modVal || '')
        .trim()
        .match(/^([+-]?\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days|month|months|year|years)$/i);
      if (m) {
        const n = Number(m[1]) || 0;
        const u = m[2].toLowerCase();
        if (u.startsWith('sec')) d.setUTCSeconds(d.getUTCSeconds() + n);
        else if (u.startsWith('min')) d.setUTCMinutes(d.getUTCMinutes() + n);
        else if (u.startsWith('hour')) d.setUTCHours(d.getUTCHours() + n);
        else if (u.startsWith('day')) d.setUTCDate(d.getUTCDate() + n);
        else if (u.startsWith('month')) d.setUTCMonth(d.getUTCMonth() + n);
        else if (u.startsWith('year')) d.setUTCFullYear(d.getUTCFullYear() + n);
      }
      return d.toISOString();
    }
  });
}

function buildLocalPgMemSchema(): IMemoryDb {
  const mem = newDb({ autoCreateForeignKeyIndices: true });

  registerStandardPgMemFunctions(mem);

  for (const tbl of PG_TABLES) {
    // Use SERIAL in pg-mem for identity tables and let cloud PostgreSQL enforce FK types
    const memDdl = tbl.ddl
      .replace(/INT8\s+GENERATED\s+ALWAYS\s+AS\s+IDENTITY/gi, 'SERIAL')
      .replace(/REFERENCES\s+file_folders\(id\)\s+ON\s+DELETE\s+SET\s+NULL/gi, '');
    mem.public.none(memDdl);
    if (tbl.indexes) {
      for (const idx of tbl.indexes) {
        try {
          mem.public.none(idx);
        } catch {
          // Ignore duplicate index
        }
      }
    }
  }

  return mem;
}

let isHydrated = false;

export function getSyncPgDB(): PgCloudDatabase | null {
  if (pgCloudInstance) return pgCloudInstance;
  const mem = buildLocalPgMemSchema();
  pgCloudInstance = new PgCloudDatabase(mem);
  if (!initPromise) {
    void getPgDB();
  }
  return pgCloudInstance;
}

export async function getPgDB(): Promise<PgCloudDatabase> {
  if (pgCloudInstance && isHydrated) return pgCloudInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await ensurePostgresSchemaInCloud();
    } catch (schemaErr: any) {
      console.warn(
        `[PostgreSQL ProTalk iismm2] Non-fatal schema check warning: ${schemaErr?.message || schemaErr}`
      );
    }

    const mem = pgCloudInstance ? (pgCloudInstance as any).mem : buildLocalPgMemSchema();
    if (!pgCloudInstance) {
      pgCloudInstance = new PgCloudDatabase(mem);
    }

    const { tablesLoaded, totalRows } = await hydrateAllTablesFromCloud(mem);
    isHydrated = true;
    console.log(
      `[PostgreSQL ProTalk iismm2] Hydrated ${tablesLoaded} tables (${totalRows} rows) from cloud PostgreSQL.`
    );

    // Provision ProTalk triggers, cron & edge non-blockingly
    setupProTalkTriggersCronAndEdge().catch(() => null);

    return pgCloudInstance;
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

export async function refreshTableCacheFromCloud(tableName: string): Promise<void> {
  if (!pgCloudInstance) return;
  await hydrateSingleTableFromCloud(pgCloudInstance.mem, tableName);
}

export async function refreshAllTablesCacheFromCloud(): Promise<void> {
  if (!pgCloudInstance) return;
  await hydrateAllTablesFromCloud(pgCloudInstance.mem);
}

export { flushPendingPgWrites };
