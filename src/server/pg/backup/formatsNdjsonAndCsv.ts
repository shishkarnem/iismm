import { PG_TABLE_MAP } from '../schema/tableDefinitions';
import { computeSha256, getMskTimeStrings, type DatabaseSnapshotData } from './formatsSqlAndJson';

/**
 * Generates streaming NDJSON / JSON Lines (.ndjson) backup where line 1 is metadata
 * and each subsequent line is { type: "row", table, row }.
 */
export function buildNdjsonBackupBuffer(snapshot: DatabaseSnapshotData): {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  sha256: string;
} {
  const { fileStamp } = getMskTimeStrings(new Date(snapshot.meta.exportedAt));
  const lines: string[] = [];
  lines.push(JSON.stringify({ type: 'meta', ...snapshot.meta }));

  for (const [table, rows] of Object.entries(snapshot.tables)) {
    for (const row of rows || []) {
      lines.push(JSON.stringify({ type: 'row', table, row }));
    }
  }

  const buffer = Buffer.from(lines.join('\n') + '\n', 'utf-8');
  return {
    buffer,
    filename: `iismm2_pg_stream_${fileStamp}.ndjson`,
    mimeType: 'application/x-ndjson; charset=utf-8',
    sha256: computeSha256(buffer)
  };
}

export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function extractColumnsFromTableDdl(tableName: string): string[] {
  const meta = PG_TABLE_MAP.get(tableName);
  if (!meta?.ddl) return [];
  const bodyMatch = meta.ddl.match(/\(([\s\S]*)\)/);
  if (!bodyMatch) return [];
  const cols: string[] = [];
  for (const rawLine of bodyMatch[1].split('\n')) {
    const line = rawLine.trim().replace(/,$/, '');
    if (!line || /^(PRIMARY\s+KEY|UNIQUE|CONSTRAINT|FOREIGN\s+KEY)/i.test(line)) continue;
    const colMatch = line.match(/^"?([a-zA-Z0-9_]+)"?\s+/);
    if (colMatch) cols.push(colMatch[1]);
  }
  return cols;
}

/**
 * Builds RFC-4180 CSV export for either a single table or a full database bundle
 * (using `__table__` + `__row_json__` columns when exporting all tables into one CSV).
 */
export function buildCsvBackupBuffer(
  snapshot: DatabaseSnapshotData,
  specificTable?: string
): {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  sha256: string;
} {
  const { fileStamp } = getMskTimeStrings(new Date(snapshot.meta.exportedAt));

  if (specificTable && specificTable !== 'all') {
    const rows = snapshot.tables[specificTable] || [];
    const lines: string[] = [];
    const cols =
      rows.length > 0
        ? Array.from(
            rows.reduce<Set<string>>((set, r) => {
              Object.keys(r || {}).forEach((k) => set.add(k));
              return set;
            }, new Set<string>())
          )
        : extractColumnsFromTableDdl(specificTable);

    if (cols.length > 0) {
      lines.push(cols.map(escapeCsvCell).join(','));
      for (const r of rows) {
        lines.push(cols.map((c) => escapeCsvCell(r[c])).join(','));
      }
    }
    const buffer = Buffer.from('\uFEFF' + lines.join('\r\n'), 'utf-8');
    return {
      buffer,
      filename: `iismm2_${specificTable}_${fileStamp}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      sha256: computeSha256(buffer)
    };
  }

  // Full multi-table CSV bundle
  const lines: string[] = ['__table__,__primary_id__,__row_json__'];
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    for (const r of rows || []) {
      const pkVal = r.id ?? r.setting_key ?? r.user_id ?? '';
      lines.push([escapeCsvCell(table), escapeCsvCell(pkVal), escapeCsvCell(JSON.stringify(r))].join(','));
    }
  }

  const buffer = Buffer.from('\uFEFF' + lines.join('\r\n'), 'utf-8');
  return {
    buffer,
    filename: `iismm2_pg_full_${fileStamp}.csv`,
    mimeType: 'text/csv; charset=utf-8',
    sha256: computeSha256(buffer)
  };
}

/**
 * RFC-4180 compliant CSV parser supporting multiline quoted strings and escaped double-quotes.
 */
export function parseRfc4180Csv(rawCsv: string): Record<string, string>[] {
  const clean = rawCsv.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && clean[i + 1] === '\n') i++;
        currentRow.push(currentCell);
        if (currentRow.some((c) => c !== '')) {
          records.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((c) => c !== '')) {
      records.push(currentRow);
    }
  }

  if (records.length < 2) return [];
  const headers = records[0].map((h) => h.trim());
  return records.slice(1).map((vals) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] !== undefined ? vals[idx] : '';
    });
    return obj;
  });
}
