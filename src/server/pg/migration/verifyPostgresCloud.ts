import { pgQuery } from '../client/pgHttpClient';
import { ensurePostgresSchemaInCloud, setupProTalkTriggersCronAndEdge } from '../schema/schemaInitializer';
import { PG_TABLES } from '../schema/tableDefinitions';

/**
 * Cloud PostgreSQL ProTalk (iismm2) verification & platform sync helper.
 * Validates and synchronizes the 50 cloud tables, triggers, and state on ProTalk PostgreSQL.
 */
export async function verifyPostgresCloudState(): Promise<{
  verifiedTables: number;
  totalRows: number;
  tableCounts: Record<string, number>;
}> {
  await ensurePostgresSchemaInCloud();
  await setupProTalkTriggersCronAndEdge();

  const tableCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const tbl of PG_TABLES) {
    const cntRes = await pgQuery<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM "${tbl.name}"`);
    const cnt = Number(cntRes.rows[0]?.cnt || 0);
    tableCounts[tbl.name] = cnt;
    totalRows += cnt;
  }

  return {
    verifiedTables: PG_TABLES.length,
    totalRows,
    tableCounts
  };
}
