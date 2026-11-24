import { Prompt, PublicationLog } from './postTypes';

let promptsCache: Prompt[] = [];
let publicationLogsCache: PublicationLog[] = [];

export class PromptDomain {
  public static getPrompts(): Prompt[] {
    return promptsCache;
  }

  public static addPrompt(prompt: Omit<Prompt, 'id' | 'createdAt'>): Prompt {
    const newPrompt: Prompt = {
      ...prompt,
      id: 'prompt_' + Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString()
    };
    promptsCache.push(newPrompt);
    return newPrompt;
  }

  public static updatePrompt(id: string, updated: Partial<Prompt>): Prompt {
    const index = promptsCache.findIndex((p) => p.id === id);
    if (index !== -1) {
      promptsCache[index] = { ...promptsCache[index], ...updated };
      return promptsCache[index];
    }
    throw new Error('Prompt not found');
  }

  public static deletePrompt(id: string): void {
    const cleanId = String(id || '').trim();
    promptsCache = promptsCache.filter((p) => String(p.id || '').trim() !== cleanId);
  }

  public static getLogs(): PublicationLog[] {
    return publicationLogsCache;
  }

  public static addLog(log: Omit<PublicationLog, 'id' | 'timestamp'>): PublicationLog {
    const newLog: PublicationLog = {
      promptTitle: log.promptTitle || '',
      channel: log.channel || '',
      status: log.status !== undefined ? log.status : true,
      ...log,
      id: 'log_' + Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString()
    };
    publicationLogsCache.push(newLog);
    return newLog;
  }

  public static deletePublicationLog(id: string): void {
    const cleanId = String(id || '').trim();
    publicationLogsCache = publicationLogsCache.filter((l) => String(l.id || '').trim() !== cleanId);
  }
}
