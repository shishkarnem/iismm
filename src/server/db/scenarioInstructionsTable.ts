import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';

export interface ScenarioInstructionRecord {
  id: string;
  target_type: 'block' | 'field';
  block_type?: string;
  field_name?: string;
  title: string;
  summary: string;
  instruction_text: string;
  examples?: string;
  updated_at: string;
}

export const DEFAULT_INSTRUCTIONS: ScenarioInstructionRecord[] = [];

export function initScenarioInstructionsTable(_db: Database) {
  // Instructions are stored in cloud PostgreSQL ProTalk (iismm2); startup seeding removed
}

export function getAllInstructionsFromDb(db: Database): ScenarioInstructionRecord[] {
  try {
    const stmt = db.prepare("SELECT * FROM scenario_instructions");
    const list: ScenarioInstructionRecord[] = [];
    while (stmt.step()) {
      list.push(stmt.getAsObject() as any);
    }
    stmt.free();
    return list;
  } catch (e) {
    return DEFAULT_INSTRUCTIONS;
  }
}

export function updateInstructionInDb(db: Database, id: string, data: Partial<ScenarioInstructionRecord>): ScenarioInstructionRecord | null {
  try {
    const existingStmt = db.prepare("SELECT * FROM scenario_instructions WHERE id = ?");
    existingStmt.bind([id]);
    let existing: any = null;
    if (existingStmt.step()) {
      existing = existingStmt.getAsObject();
    }
    existingStmt.free();

    if (!existing) {
      const def = DEFAULT_INSTRUCTIONS.find(i => i.id === id);
      if (!def) return null;
      existing = { ...def };
    }

    const updated: ScenarioInstructionRecord = {
      ...existing,
      ...data,
      id,
      updated_at: new Date().toISOString()
    };

    db.run(
      `INSERT OR REPLACE INTO scenario_instructions (id, target_type, block_type, field_name, title, summary, instruction_text, examples, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        updated.id,
        updated.target_type,
        updated.block_type || null,
        updated.field_name || null,
        updated.title,
        updated.summary,
        updated.instruction_text,
        updated.examples || null,
        updated.updated_at
      ]
    );

    return updated;
  } catch (e) {
    console.error('[PostgreSQL] Error updating instruction:', e);
    return null;
  }
}
