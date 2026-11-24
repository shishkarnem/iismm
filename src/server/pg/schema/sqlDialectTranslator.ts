import { IDENTITY_TABLES, getTablePrimaryKey } from './tableDefinitions';

export interface TranslatedPgQuery {
  sql: string;
  params: any[];
  isMutation: boolean;
  isIgnoredDDL: boolean;
  isSelectChanges?: boolean;
  targetTable?: string;
}

function replaceQuestionPlaceholders(sql: string): string {
  let out = '';
  let inSingle = false;
  let inDouble = false;
  let paramIdx = 1;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      out += ch;
      if (inSingle && sql[i + 1] === "'") {
        out += "'";
        i++;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += ch;
      continue;
    }
    if (ch === '?' && !inSingle && !inDouble) {
      out += `$${paramIdx++}`;
      continue;
    }
    out += ch;
  }
  return out;
}

function quoteReservedDescColumn(sql: string): string {
  return sql
    .replace(/(\bSELECT|,)(\s*)desc(\s*)(?=,|\bFROM\b)/gi, '$1$2"desc"$3')
    .replace(/(\(\s*[^)]*?)\bdesc\b(?=\s*[,)])/gi, (match) => {
      if (/ORDER\s+BY/i.test(match)) return match;
      return match.replace(/\bdesc\b/gi, '"desc"');
    })
    .replace(/\bSET\s+([^;]*?)\bdesc\s*=/gi, (m) => m.replace(/\bdesc(?=\s*=)/i, '"desc"'))
    .replace(/,\s*desc\s*=/gi, ', "desc" =');
}

function splitTopLevelCsv(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inDouble) {
      current += ch;
      if (inSingle && str[i + 1] === "'") {
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
    if (!inSingle && !inDouble) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Normalizes and translates SQL statements to native PostgreSQL syntax
 * compatible with both ProTalk PostgreSQL (iismm2) and pg-mem.
 */
export function translateSqlToPostgres(rawSql: string, rawParams: any[] = []): TranslatedPgQuery {
  const trimmed = (rawSql || '').trim();
  const params = Array.isArray(rawParams) ? [...rawParams] : [];

  if (!trimmed) {
    return { sql: '', params: [], isMutation: false, isIgnoredDDL: true };
  }

  // Handle SELECT changes()
  if (/^SELECT\s+changes\(\s*\)\s*;?$/i.test(trimmed)) {
    return { sql: '', params: [], isMutation: false, isIgnoredDDL: false, isSelectChanges: true };
  }

  // Handle PRAGMA table_info(tableName)
  const pragmaTableInfo = trimmed.match(/^PRAGMA\s+table_info\(\s*["']?([a-zA-Z0-9_]+)["']?\s*\)\s*;?$/i);
  if (pragmaTableInfo) {
    const tName = pragmaTableInfo[1].toLowerCase() === 'tariffs' ? 'tarifs' : pragmaTableInfo[1].toLowerCase();
    return {
      sql: `SELECT (ordinal_position - 1) AS cid, column_name AS name, UPPER(data_type) AS type, CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END AS "notnull", column_default AS dflt_value, 0 AS pk FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position ASC`,
      params: [tName],
      isMutation: false,
      isIgnoredDDL: false
    };
  }

  // Ignore legacy PRAGMAs and runtime CREATE/ALTER/DROP (schema is managed centrally in PostgreSQL)
  if (/^(PRAGMA|BEGIN\s+TRANSACTION|BEGIN|COMMIT|ROLLBACK)\b/i.test(trimmed)) {
    return { sql: '', params: [], isMutation: false, isIgnoredDDL: true };
  }
  if (
    /^(CREATE\s+(?:OR\s+REPLACE\s+)?(TABLE|UNIQUE\s+INDEX|INDEX|VIEW|TRIGGER)|ALTER\s+TABLE|DROP\s+(TABLE|VIEW|TRIGGER|INDEX))\b/i.test(
      trimmed
    )
  ) {
    return { sql: '', params: [], isMutation: false, isIgnoredDDL: true };
  }

  let sql = trimmed;

  // Map legacy table aliases
  sql = sql.replace(/\b(FROM|INTO|UPDATE)\s+"?tariffs"?\b/gi, '$1 tarifs');
  sql = sql.replace(/\b(FROM|INTO|UPDATE)\s+"?scenarios"?\b/gi, '$1 sceneries');

  // Map system table inspection queries -> PostgreSQL information_schema.tables
  if (/(?:information_schema\.tables|pg_tables|pg_catalog\.pg_tables)\b/i.test(sql)) {
    const specificMatch = sql.match(/(?:table_name|tablename|name)\s*=\s*'([^']+)'/i);
    if (specificMatch) {
      return {
        sql: `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        params: [specificMatch[1]],
        isMutation: false,
        isIgnoredDDL: false
      };
    }
    return {
      sql: `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC`,
      params: [],
      isMutation: false,
      isIgnoredDDL: false
    };
  }

  // Convert legacy ORDER BY rowid -> ORDER BY 1
  sql = sql.replace(/\bORDER\s+BY\s+rowid\b/gi, 'ORDER BY 1');

  // Prevent bigint cast errors when comparing telegram_id or user_id with string user IDs (e.g. 'admin')
  sql = sql.replace(
    /\b(WHERE|OR|AND)\s+(\(\s*)?(telegram_id|user_id)\s*=\s*\?/gi,
    (_, kw, paren, col) => `${kw} ${paren || ''}CAST(${col} AS TEXT) = CAST(? AS TEXT)`
  );
  sql = sql.replace(
    /\b(WHERE|OR|AND)\s+(\(\s*)?(telegram_id|user_id)\s*=\s*'([^']*)'/gi,
    (_, kw, paren, col, lit) => `${kw} ${paren || ''}CAST(${col} AS TEXT) = '${lit}'`
  );

  // Convert date functions datetime('now', '[+-]N unit'), datetime('now'), and date('now')
  // into UTC ISO string literals compatible with both pg-mem and cloud PostgreSQL (iismm2)
  sql = sql.replace(
    /datetime\(\s*'now'\s*,\s*'([+-]?\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days|month|months|year|years)'\s*\)/gi,
    (_, numStr, rawUnit) => {
      const n = Number(numStr) || 0;
      const u = String(rawUnit).toLowerCase();
      const d = new Date();
      if (u.startsWith('sec')) d.setUTCSeconds(d.getUTCSeconds() + n);
      else if (u.startsWith('min')) d.setUTCMinutes(d.getUTCMinutes() + n);
      else if (u.startsWith('hour')) d.setUTCHours(d.getUTCHours() + n);
      else if (u.startsWith('day')) d.setUTCDate(d.getUTCDate() + n);
      else if (u.startsWith('month')) d.setUTCMonth(d.getUTCMonth() + n);
      else if (u.startsWith('year')) d.setUTCFullYear(d.getUTCFullYear() + n);
      return `'${d.toISOString()}'`;
    }
  );
  sql = sql.replace(/datetime\(\s*'now'\s*\)/gi, () => `'${new Date().toISOString()}'`);
  sql = sql.replace(/date\(\s*'now'\s*\)/gi, () => `'${new Date().toISOString().slice(0, 10)}'`);

  // Convert UPDATE OR IGNORE -> UPDATE
  sql = sql.replace(/^UPDATE\s+OR\s+IGNORE\s+/i, 'UPDATE ');

  // Handle INSERT [OR REPLACE | OR IGNORE] INTO <table> (...) VALUES (...)
  const insertMatch = sql.match(
    /^INSERT\s+(?:(OR\s+REPLACE|OR\s+IGNORE)\s+)?INTO\s+"?([a-zA-Z0-9_]+)"?\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)\s*;?$/i
  );

  if (insertMatch) {
    const conflictDirective = (insertMatch[1] || '').toUpperCase().replace(/\s+/g, ' ');
    const tableName = insertMatch[2].toLowerCase() === 'tariffs' ? 'tarifs' : insertMatch[2].toLowerCase();
    let cols = splitTopLevelCsv(insertMatch[3]).map((c) => {
      const raw = c.replace(/"/g, '').trim();
      return raw.toLowerCase() === 'desc' ? '"desc"' : raw;
    });
    let vals = splitTopLevelCsv(insertMatch[4]);

    if (IDENTITY_TABLES.has(tableName)) {
      const idIdx = cols.findIndex((c) => c.toLowerCase() === 'id');
      if (idIdx !== -1) {
        const valExpr = vals[idIdx];
        if (valExpr === '?') {
          let paramPos = 0;
          for (let k = 0; k < idIdx; k++) {
            paramPos += (vals[k].match(/\?/g) || []).length;
          }
          const removedIdVal = params.splice(paramPos, 1)[0];
          if (!cols.some((c) => c.toLowerCase() === 'legacy_id') && removedIdVal !== undefined && removedIdVal !== null) {
            cols.push('legacy_id');
            vals.push('?');
            params.push(Number(removedIdVal) || null);
          }
        }
        cols.splice(idIdx, 1);
        vals.splice(idIdx, 1);
      }

      if (tableName === 'file_storage') {
        const lowerCols = cols.map((c) => c.toLowerCase());
        const nameIdx = lowerCols.indexOf('name');
        const origUrlIdx = lowerCols.indexOf('original_url');
        const fileSizeIdx = lowerCols.indexOf('file_size');

        const duplicateColIfMissing = (targetCol: string, sourceIdx: number, fallbackLiteral: string) => {
          if (lowerCols.includes(targetCol)) return;
          if (sourceIdx !== -1 && vals[sourceIdx] === '?') {
            let pIdx = 0;
            for (let k = 0; k < sourceIdx; k++) {
              pIdx += (vals[k].match(/\?/g) || []).length;
            }
            cols.push(targetCol);
            vals.push('?');
            params.push(params[pIdx]);
          } else if (sourceIdx !== -1) {
            cols.push(targetCol);
            vals.push(vals[sourceIdx]);
          } else {
            cols.push(targetCol);
            vals.push(fallbackLiteral);
          }
        };

        duplicateColIfMissing('filename', nameIdx, "'file.bin'");
        duplicateColIfMissing('url', origUrlIdx, "''");
        duplicateColIfMissing('size_bytes', fileSizeIdx, '0');
      }
    }

    let rebuilt = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;

    if (tableName === 'app_settings') {
      rebuilt += ` ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = '${new Date().toISOString()}'`;
    } else if (conflictDirective === 'OR IGNORE' && !IDENTITY_TABLES.has(tableName)) {
      rebuilt += ` ON CONFLICT DO NOTHING`;
    } else if (conflictDirective === 'OR REPLACE' && !IDENTITY_TABLES.has(tableName)) {
      const pkCols = getTablePrimaryKey(tableName);
      const nonPkCols = cols.filter((c) => !pkCols.includes(c.replace(/"/g, '').toLowerCase()));
      if (nonPkCols.length > 0) {
        const setClause = nonPkCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
        rebuilt += ` ON CONFLICT (${pkCols.join(', ')}) DO UPDATE SET ${setClause}`;
      } else {
        rebuilt += ` ON CONFLICT (${pkCols.join(', ')}) DO NOTHING`;
      }
    }

    const finalSql = replaceQuestionPlaceholders(rebuilt);
    return {
      sql: finalSql,
      params,
      isMutation: true,
      isIgnoredDDL: false,
      targetTable: tableName
    };
  }

  sql = quoteReservedDescColumn(sql);
  const finalSql = replaceQuestionPlaceholders(sql);
  const isMutation = /^(INSERT|UPDATE|DELETE)\b/i.test(finalSql);
  const tableMatch = finalSql.match(/^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?([a-zA-Z0-9_]+)"?/i);

  return {
    sql: finalSql,
    params,
    isMutation,
    isIgnoredDDL: false,
    targetTable: tableMatch ? tableMatch[1].toLowerCase() : undefined
  };
}
