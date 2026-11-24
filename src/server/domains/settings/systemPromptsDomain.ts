import { SystemPrompt, PostTemplate } from './settingsTypes';
import { getPgDB, getSyncPgDB, savePgDB } from '../../db/postgres';
import { pgQuery } from '../../pg/client/pgHttpClient';
import { interpolatePgParams } from '../../pg/cache/pgHydrator';

function runLocalSystemMemOnly(pgDB: any, pgSql: string, params: any[] = []): void {
  if (!pgDB?.mem?.public) return;
  try {
    pgDB.mem.public.none(interpolatePgParams(pgSql, params));
  } catch (err) {
    console.warn('[SystemPromptsDomain] Local pg-mem projection warning:', err);
  }
}

let templatesCache: PostTemplate[] = [];

export class SystemPromptsDomain {
  public static getTemplates(): PostTemplate[] {
    return templatesCache;
  }

  public static addTemplate(
    template: Omit<PostTemplate, 'id' | 'createdAt'>
  ): PostTemplate {
    const newTpl: PostTemplate = {
      title: template.title || '',
      content: template.content || '',
      category: template.category || 'Общее',
      ...template,
      id: 'tpl_' + Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString()
    };
    templatesCache.push(newTpl);
    return newTpl;
  }

  public static deleteTemplate(id: string): void {
    templatesCache = templatesCache.filter((t) => t.id !== id);
  }

  public static getSystemPrompts(): SystemPrompt[] {
    const pgDB = getSyncPgDB();
    if (pgDB) {
      try {
        const rows = pgDB.exec('SELECT id, scenario_key, title, prompt_text, description, created_at FROM system_prompts ORDER BY rowid ASC');
        if (rows && rows[0] && rows[0].values) {
          return rows[0].values.map((v: any) => ({
            id: String(v[0]),
            scenarioKey: String(v[1]),
            title: String(v[2]),
            promptText: String(v[3]),
            description: String(v[4] || ''),
            createdAt: String(v[5] || new Date().toISOString())
          }));
        }
      } catch (e) {
        console.warn('[SystemPromptsDomain] getSystemPrompts error:', e);
      }
    }
    return [];
  }

  public static async syncSystemPromptsFromCloudDb(): Promise<SystemPrompt[]> {
    const pgDB = await getPgDB();
    try {
      const cloudRes = await pgQuery<{
        id: string;
        scenario_key: string;
        title: string;
        prompt_text: string;
        description?: string;
        created_at?: string;
      }>(
        `SELECT id, scenario_key, title, prompt_text, description, created_at FROM system_prompts ORDER BY id ASC`,
        [],
        { safeMode: true }
      );
      if (Array.isArray(cloudRes?.rows) && cloudRes.rows.length > 0) {
        runLocalSystemMemOnly(pgDB, `DELETE FROM system_prompts`);
        for (const r of cloudRes.rows) {
          runLocalSystemMemOnly(
            pgDB,
            `INSERT INTO system_prompts (id, scenario_key, title, prompt_text, description, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              String(r.id),
              String(r.scenario_key),
              String(r.title || ''),
              String(r.prompt_text || ''),
              String(r.description || ''),
              String(r.created_at || new Date().toISOString())
            ]
          );
        }
        return cloudRes.rows.map((r) => ({
          id: String(r.id),
          scenarioKey: String(r.scenario_key),
          title: String(r.title || ''),
          promptText: String(r.prompt_text || ''),
          description: String(r.description || ''),
          createdAt: String(r.created_at || new Date().toISOString())
        }));
      }
    } catch (e) {
      console.warn('[SystemPromptsDomain] Cloud sync warning:', e);
    }
    return this.getSystemPrompts();
  }

  public static getSystemPromptByKey(key: string): SystemPrompt | undefined {
    const prompts = this.getSystemPrompts();
    return prompts.find((p) => p.scenarioKey === key || p.id === key);
  }

  public static updateSystemPrompt(
    idOrKey: string,
    promptText: string,
    title?: string
  ): SystemPrompt | undefined {
    const pgDB = getSyncPgDB();
    const prompts = this.getSystemPrompts();
    const target = prompts.find((p) => p.id === idOrKey || p.scenarioKey === idOrKey);
    if (!target) return undefined;

    target.promptText = promptText;
    if (title !== undefined) target.title = title;

    if (pgDB) {
      try {
        pgDB.run(
          'UPDATE system_prompts SET prompt_text = ?, title = ? WHERE id = ? OR scenario_key = ?',
          [target.promptText, target.title, target.id, target.scenarioKey]
        );
        savePgDB();
      } catch (e) {
        console.error('[SystemPromptsDomain] updateSystemPrompt error:', e);
      }
    }
    return target;
  }

  public static async updateSystemPromptAsync(
    idOrKey: string,
    promptText: string,
    title?: string,
    description?: string
  ): Promise<SystemPrompt | undefined> {
    const pgDB = await getPgDB();
    let target = this.getSystemPromptByKey(idOrKey);
    if (!target) {
      const fresh = await this.syncSystemPromptsFromCloudDb();
      target = fresh.find((p) => p.id === idOrKey || p.scenarioKey === idOrKey);
    }
    if (!target) return undefined;

    const nextTitle = title !== undefined && title.trim() ? title.trim() : target.title;
    const nextDescription = description !== undefined ? description : target.description;
    const nextPromptText = String(promptText || '');

    await pgQuery(
      `UPDATE system_prompts
       SET prompt_text = $1, title = $2, description = $3
       WHERE id = $4 OR scenario_key = $5`,
      [nextPromptText, nextTitle, nextDescription, target.id, target.scenarioKey]
    );

    runLocalSystemMemOnly(
      pgDB,
      'UPDATE system_prompts SET prompt_text = $1, title = $2, description = $3 WHERE id = $4 OR scenario_key = $5',
      [nextPromptText, nextTitle, nextDescription, target.id, target.scenarioKey]
    );

    return {
      ...target,
      title: nextTitle,
      description: nextDescription,
      promptText: nextPromptText
    };
  }
}
