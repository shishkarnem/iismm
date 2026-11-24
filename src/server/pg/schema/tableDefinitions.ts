import { IDENTITY_TABLES, PG_CORE_TABLES, type PgTableMeta } from './tableDefinitionsCore';
import { PG_CONTENT_TABLES } from './tableDefinitionsContent';

export { IDENTITY_TABLES };
export type { PgTableMeta };

export const PG_TABLES: PgTableMeta[] = [...PG_CORE_TABLES, ...PG_CONTENT_TABLES];

export const PG_TABLE_MAP = new Map<string, PgTableMeta>(
  PG_TABLES.map((t) => [t.name, t])
);

export function getTablePrimaryKey(tableName: string): string[] {
  const clean = tableName.replace(/"/g, '').trim().toLowerCase();
  return PG_TABLE_MAP.get(clean)?.pk || ['id'];
}
