import type { Express, Request, Response } from 'express';
import { getDatabase, saveDatabaseToDisk } from '../db/index';
import {
  getAiButtonPromptConfigFromDb,
  getDefaultAiButtonsPromptFromDb,
  resetAiButtonPromptConfigInDb,
  saveAiButtonPromptConfigToDb
} from '../db/promptsTable';

export function registerInlineButtonsRoutes(app: Express): void {
  app.get('/api/inline-buttons/prompt', async (req: Request, res: Response) => {
    try {
      const userId = String(req.query.userId || req.headers['x-user-id'] || '16926299042').trim();
      const db = await getDatabase();
      const [config, defaultPrompt] = await Promise.all([
        getAiButtonPromptConfigFromDb(db, userId),
        getDefaultAiButtonsPromptFromDb()
      ]);
      res.json({
        success: true,
        ...config,
        defaultPrompt
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Ошибка чтения промпта кнопок из базы данных' });
    }
  });

  app.post('/api/inline-buttons/prompt', async (req: Request, res: Response) => {
    try {
      const { userId, promptText, layoutRule, customInstruction } = req.body || {};
      const cleanUserId = String(userId || req.headers['x-user-id'] || '16926299042').trim();
      const db = await getDatabase();
      const saved = await saveAiButtonPromptConfigToDb(db, {
        userId: cleanUserId,
        promptText: String(promptText || ''),
        layoutRule,
        customInstruction
      });
      const defaultPrompt = await getDefaultAiButtonsPromptFromDb();
      saveDatabaseToDisk();
      res.json({
        success: true,
        ...saved,
        defaultPrompt,
        message: 'Промпт генератора кнопок сохранен в базу данных на сервере'
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Ошибка сохранения промпта кнопок в базу данных' });
    }
  });

  app.post('/api/inline-buttons/reset-prompt', async (req: Request, res: Response) => {
    try {
      const { userId } = req.body || {};
      const cleanUserId = String(userId || req.headers['x-user-id'] || '16926299042').trim();
      const db = await getDatabase();
      const resetRecord = await resetAiButtonPromptConfigInDb(db, cleanUserId);
      const defaultPrompt = await getDefaultAiButtonsPromptFromDb();
      saveDatabaseToDisk();
      res.json({
        success: true,
        ...resetRecord,
        defaultPrompt,
        message: 'Стандартный промпт генератора кнопок из БД восстановлен'
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Ошибка сброса промпта кнопок' });
    }
  });
}
