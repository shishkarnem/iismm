import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';

export interface ScenarioNodeTestRecord {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  output: Record<string, any>;
  cost: number;
  mode: 'single' | 'chain' | 'full';
  testedAt: string;
}

export function initSceneriesTable(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS sceneries (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      category TEXT,
      description TEXT,
      topic_category TEXT,
      target_channels TEXT,
      message_format TEXT,
      enabled INTEGER DEFAULT 1,
      schedule TEXT,
      steps TEXT,
      nodes TEXT,
      edges TEXT,
      workflow_layout TEXT,
      test_results TEXT,
      last_run_at TEXT,
      next_run_at TEXT,
      last_sent_at TEXT,
      last_run_slot TEXT,
      is_sent INTEGER DEFAULT 0,
      runs_count INTEGER DEFAULT 0,
      last_status TEXT,
      last_error TEXT,
      created_at TEXT
    );
  `);
  try { db.run("ALTER TABLE sceneries ADD COLUMN user_id TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE sceneries ADD COLUMN category TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE sceneries ADD COLUMN nodes TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE sceneries ADD COLUMN edges TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE sceneries ADD COLUMN workflow_layout TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE sceneries ADD COLUMN test_results TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE sceneries ADD COLUMN last_sent_at TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE sceneries ADD COLUMN last_run_slot TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE sceneries ADD COLUMN is_sent INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.run("ALTER TABLE sceneries ADD COLUMN runs_count INTEGER DEFAULT 0;"); } catch (e) {}

  // Backfill completion/delivery state for scenarios that already executed previously
  try {
    db.run(`
      UPDATE sceneries
      SET is_sent = 1,
          last_sent_at = COALESCE(last_sent_at, last_run_at),
          runs_count = CASE WHEN runs_count IS NULL OR runs_count = 0 THEN 1 ELSE runs_count END
      WHERE last_run_at IS NOT NULL
        AND last_status IN ('success', 'completed')
        AND (is_sent IS NULL OR is_sent = 0);
    `);
  } catch (e) {}
}

function safeJsonParse<T>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

export function parseScenarioRow(row: any): any {
  if (!row) return null;
  const parsedSchedule = safeJsonParse<any>(row.schedule, row.schedule || 'Ежедневно в 10:00');
  const rawNodes = safeJsonParse<any[]>(row.nodes, []);
  // Ensure test outputs are not duplicated locally inside node objects
  const cleanNodes = Array.isArray(rawNodes)
    ? rawNodes.map((n) => {
        if (!n || typeof n !== 'object') return n;
        const { lastOutput: _legacyOut, ...rest } = n;
        return rest;
      })
    : [];

  // Migrate any legacy per-node lastOutput into row-level testResults if test_results was empty
  const rowTestResults = safeJsonParse<Record<string, ScenarioNodeTestRecord>>(row.test_results, {});
  if (Array.isArray(rawNodes)) {
    rawNodes.forEach((n) => {
      if (n?.id && n?.lastOutput && !rowTestResults[n.id]) {
        rowTestResults[n.id] = {
          nodeId: n.id,
          nodeTitle: n.title || 'Шаг сценария',
          nodeType: n.type || 'unknown',
          output: n.lastOutput,
          cost: Number(n.cost || 0),
          mode: 'single',
          testedAt: row.last_run_at || row.created_at || new Date().toISOString()
        };
      }
    });
  }

  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    name: String(row.name || 'Сценарий'),
    category: String(row.category || row.topic_category || 'Автопостинг'),
    description: String(row.description || ''),
    topicCategory: String(row.topic_category || row.category || 'Технологии и ИИ'),
    targetChannels: safeJsonParse<string[]>(row.target_channels, ['@SAV_AI']),
    messageFormat: (row.message_format === 'rich' ? 'rich' : 'v2') as 'v2' | 'rich',
    enabled: row.enabled !== 0 && row.enabled !== false,
    schedule: parsedSchedule,
    steps: safeJsonParse<any[]>(row.steps, []),
    nodes: cleanNodes,
    edges: safeJsonParse<any[]>(row.edges, []),
    workflowLayout: (row.workflow_layout === 'list' ? 'list' : 'canvas') as 'canvas' | 'list',
    testResults: rowTestResults,
    lastRunAt: row.last_run_at || undefined,
    nextRunAt: row.next_run_at || undefined,
    lastSentAt: row.last_sent_at || undefined,
    lastRunSlot: row.last_run_slot || undefined,
    isSent: row.is_sent === 1 || row.is_sent === true,
    runsCount: Number(row.runs_count || 0),
    lastStatus: row.last_status || undefined,
    lastError: row.last_error || undefined,
    createdAt: row.created_at || new Date().toISOString()
  };
}

export function getAllSceneriesFromDb(db: Database, userId?: string): any[] {
  try {
    const stmt = db.prepare("SELECT * FROM sceneries ORDER BY created_at DESC");
    const res: any[] = [];
    while (stmt.step()) {
      const parsed = parseScenarioRow(stmt.getAsObject());
      if (parsed) {
        if (!userId || !parsed.userId || String(parsed.userId) === String(userId)) {
          res.push(parsed);
        }
      }
    }
    stmt.free();
    return res;
  } catch (e) {
    return [];
  }
}

export function getScenarioByIdFromDb(db: Database, id: string): any | null {
  try {
    const stmt = db.prepare("SELECT * FROM sceneries WHERE id = ? LIMIT 1");
    stmt.bind([id]);
    let found: any = null;
    if (stmt.step()) {
      found = parseScenarioRow(stmt.getAsObject());
    }
    stmt.free();
    return found;
  } catch (e) {
    return null;
  }
}

export function isScenarioNameTakenInDb(db: Database, name: string, excludeId?: string): boolean {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) return false;
  try {
    const stmt = db.prepare("SELECT id, name FROM sceneries");
    let taken = false;
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      const rowId = String(row.id || '');
      const rowName = String(row.name || '').trim().toLowerCase();
      if (rowName === normalized && (!excludeId || rowId !== String(excludeId))) {
        taken = true;
        break;
      }
    }
    stmt.free();
    return taken;
  } catch {
    return false;
  }
}

export function upsertScenarioInDb(db: Database, scen: any) {
  try {
    const existing = scen?.id ? getScenarioByIdFromDb(db, String(scen.id)) : null;
    const merged = existing ? { ...existing, ...scen } : scen;

    const targetChannelsStr = Array.isArray(merged.targetChannels)
      ? JSON.stringify(merged.targetChannels)
      : typeof merged.targetChannels === 'string'
      ? merged.targetChannels
      : '[]';

    const scheduleStr =
      typeof merged.schedule === 'object' && merged.schedule !== null
        ? JSON.stringify(merged.schedule)
        : String(merged.schedule || '');

    const stepsStr = Array.isArray(merged.steps) ? JSON.stringify(merged.steps) : '[]';

    const cleanedNodes = Array.isArray(merged.nodes)
      ? merged.nodes.map((n: any) => {
          if (!n || typeof n !== 'object') return n;
          const { lastOutput: _dropLocalOutput, ...rest } = n;
          return rest;
        })
      : [];
    const nodesStr = JSON.stringify(cleanedNodes);
    const edgesStr = Array.isArray(merged.edges) ? JSON.stringify(merged.edges) : '[]';

    const testResultsObj: Record<string, ScenarioNodeTestRecord> =
      merged.testResults && typeof merged.testResults === 'object'
        ? merged.testResults
        : existing?.testResults || {};
    const testResultsStr = JSON.stringify(testResultsObj);

    db.run(
      `INSERT OR REPLACE INTO sceneries (
        id, user_id, name, category, description, topic_category, target_channels,
        message_format, enabled, schedule, steps, nodes, edges, workflow_layout,
        test_results, last_run_at, next_run_at, last_sent_at, last_run_slot,
        is_sent, runs_count, last_status, last_error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        merged.id,
        merged.userId || existing?.userId || null,
        String(merged.name || 'Сценарий').trim(),
        merged.category || merged.topicCategory || 'Автопостинг',
        merged.description || '',
        merged.topicCategory || merged.category || '',
        targetChannelsStr,
        merged.messageFormat || 'v2',
        merged.enabled !== false ? 1 : 0,
        scheduleStr,
        stepsStr,
        nodesStr,
        edgesStr,
        merged.workflowLayout || 'canvas',
        testResultsStr,
        merged.lastRunAt ?? existing?.lastRunAt ?? null,
        merged.nextRunAt !== undefined ? merged.nextRunAt : (existing?.nextRunAt ?? null),
        merged.lastSentAt ?? existing?.lastSentAt ?? null,
        merged.lastRunSlot ?? existing?.lastRunSlot ?? null,
        (merged.isSent ?? existing?.isSent) ? 1 : 0,
        Number(merged.runsCount ?? existing?.runsCount ?? 0),
        merged.lastStatus ?? existing?.lastStatus ?? null,
        merged.lastError !== undefined ? merged.lastError : null,
        merged.createdAt || existing?.createdAt || new Date().toISOString()
      ]
    );
  } catch (e) {
    console.error('[PostgreSQL] Error upserting scenario in db:', e);
  }
}

export function saveScenarioTestResultsInDb(
  db: Database,
  scenarioId: string,
  resultsPatch: Record<string, ScenarioNodeTestRecord>,
  fallbackScenario?: any
): Record<string, ScenarioNodeTestRecord> {
  let existing = getScenarioByIdFromDb(db, scenarioId);
  if (!existing && fallbackScenario) {
    upsertScenarioInDb(db, { ...fallbackScenario, id: scenarioId });
    existing = getScenarioByIdFromDb(db, scenarioId);
  }

  const currentMap: Record<string, ScenarioNodeTestRecord> =
    existing?.testResults && typeof existing.testResults === 'object'
      ? { ...existing.testResults }
      : {};

  // Overwrite test results in the exact same row in sceneries
  Object.entries(resultsPatch).forEach(([nodeId, record]) => {
    currentMap[nodeId] = record;
  });

  if (existing) {
    db.run(`UPDATE sceneries SET test_results = ? WHERE id = ?`, [
      JSON.stringify(currentMap),
      scenarioId
    ]);
  } else {
    upsertScenarioInDb(db, {
      id: scenarioId,
      name: fallbackScenario?.name || `Сценарий ${scenarioId.slice(-4)}`,
      nodes: fallbackScenario?.nodes || [],
      edges: fallbackScenario?.edges || [],
      testResults: currentMap,
      createdAt: new Date().toISOString()
    });
  }

  return currentMap;
}

export function deleteScenarioInDb(db: Database, id: string) {
  try {
    db.run("DELETE FROM sceneries WHERE id = ?", [id]);
  } catch (e) {
    console.error('[PostgreSQL] Error deleting scenario from db:', e);
  }
}
