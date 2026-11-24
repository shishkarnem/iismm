import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';
import { getRequiredScenarioPrompt } from '../scenarios/prompts/scenarioPromptsRepo';

export type InlineButtonsLayoutRule =
  | '1_per_row'
  | '2_per_row'
  | '3_per_row'
  | '1_then_2'
  | '2_then_1';

export interface AiButtonPromptConfigRecord {
  promptText: string;
  layoutRule: InlineButtonsLayoutRule;
  customInstruction: string;
  isCustom: boolean;
  updatedAt: string;
}

export async function getDefaultAiButtonsPromptFromDb(): Promise<string> {
  const row = await getRequiredScenarioPrompt('format_inline_buttons', 'ai_from_post');
  const tpl = String(row.user_prompt_template || row.system_prompt || '').trim();
  if (!tpl) {
    throw new Error(
      'Шаблон user_prompt_template для (format_inline_buttons, ai_from_post) пуст в таблице scenario_block_prompts.'
    );
  }
  return tpl;
}

export function normalizeLayoutRule(raw?: string | number | null): InlineButtonsLayoutRule {
  if (raw === '2_per_row' || raw === 2 || raw === '2') return '2_per_row';
  if (raw === '3_per_row' || raw === 3 || raw === '3') return '3_per_row';
  if (raw === '1_then_2') return '1_then_2';
  if (raw === '2_then_1') return '2_then_1';
  return '1_per_row';
}

export function initPromptsTable(_db: Database) {
  // Prompts, ai_button_prompts, and scenario_block_prompts live in cloud PostgreSQL ProTalk (iismm2)
}

export function getAllPromptsFromDb(db: Database) {
  try {
    const stmt = db.prepare('SELECT * FROM prompts ORDER BY created_at DESC');
    const res: any[] = [];
    while (stmt.step()) {
      res.push(stmt.getAsObject());
    }
    stmt.free();
    return res;
  } catch {
    return [];
  }
}

export async function getAiButtonPromptConfigFromDb(
  db: Database,
  userId?: string
): Promise<AiButtonPromptConfigRecord> {
  const cleanUserId = String(userId || '').trim();
  const nowIso = new Date().toISOString();
  const basePrompt = await getDefaultAiButtonsPromptFromDb();

  if (cleanUserId) {
    const userStmt = db.prepare('SELECT * FROM ai_button_prompts WHERE id = ?');
    userStmt.bind([`user_${cleanUserId}`]);
    if (userStmt.step()) {
      const row = userStmt.getAsObject() as any;
      userStmt.free();
      const customText = String(row.prompt_text || '').trim();
      if (customText) {
        return {
          promptText: customText,
          layoutRule: normalizeLayoutRule(row.layout_rule),
          customInstruction: String(row.custom_instruction || ''),
          isCustom: customText !== basePrompt.trim(),
          updatedAt: String(row.updated_at || nowIso)
        };
      }
      return {
        promptText: basePrompt,
        layoutRule: normalizeLayoutRule(row.layout_rule),
        customInstruction: String(row.custom_instruction || ''),
        isCustom: false,
        updatedAt: String(row.updated_at || nowIso)
      };
    }
    userStmt.free();
  }

  const defStmt = db.prepare("SELECT * FROM ai_button_prompts WHERE id = 'default'");
  if (defStmt.step()) {
    const row = defStmt.getAsObject() as any;
    defStmt.free();
    const promptText = String(row.prompt_text || '').trim() || basePrompt;
    return {
      promptText,
      layoutRule: normalizeLayoutRule(row.layout_rule),
      customInstruction: String(row.custom_instruction || ''),
      isCustom: promptText.trim() !== basePrompt.trim(),
      updatedAt: String(row.updated_at || nowIso)
    };
  }
  defStmt.free();

  return {
    promptText: basePrompt,
    layoutRule: '1_per_row',
    customInstruction: '',
    isCustom: false,
    updatedAt: nowIso
  };
}

export async function saveAiButtonPromptConfigToDb(
  db: Database,
  params: {
    userId?: string;
    promptText: string;
    layoutRule?: string;
    customInstruction?: string;
  }
): Promise<AiButtonPromptConfigRecord> {
  const cleanUserId = String(params.userId || '').trim();
  const basePrompt = await getDefaultAiButtonsPromptFromDb();
  const promptText = String(params.promptText || '').trim() || basePrompt;
  const layoutRule = normalizeLayoutRule(params.layoutRule);
  const customInstruction = String(params.customInstruction || '').trim();
  const nowIso = new Date().toISOString();

  const recordId = cleanUserId ? `user_${cleanUserId}` : 'default';

  db.run(
    `INSERT OR REPLACE INTO ai_button_prompts (id, user_id, prompt_text, layout_rule, custom_instruction, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [recordId, cleanUserId || 'system', promptText, layoutRule, customInstruction, nowIso]
  );

  if (!cleanUserId || cleanUserId === '16926299042') {
    db.run(
      `INSERT OR REPLACE INTO ai_button_prompts (id, user_id, prompt_text, layout_rule, custom_instruction, updated_at)
       VALUES ('default', 'system', ?, ?, ?, ?)`,
      [promptText, layoutRule, customInstruction, nowIso]
    );
  }

  return {
    promptText,
    layoutRule,
    customInstruction,
    isCustom: promptText.trim() !== basePrompt.trim(),
    updatedAt: nowIso
  };
}

export async function resetAiButtonPromptConfigInDb(
  db: Database,
  userId?: string
): Promise<AiButtonPromptConfigRecord> {
  const cleanUserId = String(userId || '').trim();
  const nowIso = new Date().toISOString();
  const basePrompt = await getDefaultAiButtonsPromptFromDb();

  if (cleanUserId) {
    db.run('DELETE FROM ai_button_prompts WHERE id = ?', [`user_${cleanUserId}`]);
  }
  db.run(
    `INSERT OR REPLACE INTO ai_button_prompts (id, user_id, prompt_text, layout_rule, custom_instruction, updated_at)
     VALUES ('default', 'system', ?, '1_per_row', '', ?)`,
    [basePrompt, nowIso]
  );

  return {
    promptText: basePrompt,
    layoutRule: '1_per_row',
    customInstruction: '',
    isCustom: false,
    updatedAt: nowIso
  };
}
