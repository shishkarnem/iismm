import type { Express, Request, Response } from 'express';
import { getPgDB } from '../../db/postgres';
import { getScenarioByIdFromDb, ScenarioNodeTestRecord } from '../../db/sceneriesTable';
import {
  listUserPostStylesFromDb,
  upsertUserPostStyleInDb,
  deleteUserPostStyleFromDb
} from '../styling/postStylesDb';

export interface LiveScenarioStepStatus {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  stepPercent: number;
  cost?: number;
  message?: string;
}

export interface LiveScenarioRunSnapshot {
  scenarioId: string;
  isRunning: boolean;
  mode: 'single' | 'chain' | 'full';
  percent: number;
  activeNodeId: string;
  activeNodeTitle: string;
  statusText: string;
  steps: LiveScenarioStepStatus[];
  stepRecords: Record<string, ScenarioNodeTestRecord>;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

const liveRunsMap = new Map<string, LiveScenarioRunSnapshot>();

export function applyEventToLiveScenarioRun(scenarioId: string, evt: Record<string, any>) {
  if (!scenarioId || !evt || typeof evt !== 'object') return;
  const nowIso = new Date().toISOString();

  if (evt.type === 'init') {
    liveRunsMap.set(scenarioId, {
      scenarioId,
      isRunning: true,
      mode: evt.mode === 'single' ? 'single' : evt.mode === 'chain' ? 'chain' : 'full',
      percent: Number(evt.percent || 2),
      activeNodeId: evt.steps?.[0]?.nodeId || '',
      activeNodeTitle: evt.steps?.[0]?.nodeTitle || '',
      statusText: 'Подготовка и запуск этапов сценария...',
      steps: Array.isArray(evt.steps) ? evt.steps : [],
      stepRecords: {},
      startedAt: nowIso,
      updatedAt: nowIso
    });
    return;
  }

  const prev = liveRunsMap.get(scenarioId);
  if (!prev) return;

  if (evt.type === 'step_start') {
    prev.isRunning = true;
    prev.percent = Math.max(prev.percent, Number(evt.percent || prev.percent));
    prev.activeNodeId = evt.nodeId || prev.activeNodeId;
    prev.activeNodeTitle = evt.nodeTitle || prev.activeNodeTitle;
    prev.statusText = evt.detail || `Работает: ${evt.nodeTitle}`;
    prev.steps = prev.steps.map((s) =>
      s.nodeId === evt.nodeId
        ? {
            ...s,
            status: 'running',
            stepPercent: Math.max(s.stepPercent || 0, Number(evt.stepPercent || 10))
          }
        : s
    );
    prev.updatedAt = nowIso;
  } else if (evt.type === 'step_progress') {
    prev.isRunning = true;
    prev.percent = Math.max(prev.percent, Number(evt.percent || prev.percent));
    prev.activeNodeId = evt.nodeId || prev.activeNodeId;
    prev.activeNodeTitle = evt.nodeTitle || prev.activeNodeTitle;
    prev.statusText = evt.detail || prev.statusText;
    prev.steps = prev.steps.map((s) =>
      s.nodeId === evt.nodeId
        ? {
            ...s,
            status: 'running',
            stepPercent: Math.max(s.stepPercent || 0, Number(evt.stepPercent || s.stepPercent))
          }
        : s
    );
    prev.updatedAt = nowIso;
  } else if (evt.type === 'step_done') {
    prev.percent = Math.max(prev.percent, Number(evt.percent || prev.percent));
    prev.statusText = evt.message || `Готово: ${evt.nodeTitle}`;
    if (evt.record && evt.nodeId) {
      prev.stepRecords[evt.nodeId] = evt.record;
    }
    prev.steps = prev.steps.map((s) =>
      s.nodeId === evt.nodeId
        ? { ...s, status: 'done', stepPercent: 100, cost: evt.cost, message: evt.message }
        : s
    );
    prev.updatedAt = nowIso;
  } else if (evt.type === 'step_skipped' && Array.isArray(evt.skippedIds)) {
    prev.statusText = evt.detail || prev.statusText;
    prev.steps = prev.steps.map((s) =>
      evt.skippedIds.includes(s.nodeId) ? { ...s, status: 'skipped', message: evt.detail } : s
    );
    prev.updatedAt = nowIso;
  } else if (evt.type === 'complete') {
    prev.isRunning = false;
    prev.percent = 100;
    prev.statusText = 'Выполнение всех этапов завершено';
    if (evt.result?.testResults && typeof evt.result.testResults === 'object') {
      prev.stepRecords = { ...prev.stepRecords, ...evt.result.testResults };
    }
    prev.updatedAt = nowIso;
  } else if (evt.type === 'error') {
    prev.isRunning = false;
    prev.error = evt.error || 'Ошибка выполнения';
    prev.statusText = prev.error;
    prev.updatedAt = nowIso;
  }
}

/**
 * Unbuffered NDJSON writer: pads each JSON event line with trailing spaces (>2KB)
 * so reverse proxies (Cloud Run / Envoy / Nginx) immediately flush every step event
 * in real time without waiting for res.end().
 */
export function createUnbufferedStreamWriter(res: Response, scenarioId?: string) {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }
  if ((res as any).socket && typeof (res as any).socket.setNoDelay === 'function') {
    (res as any).socket.setNoDelay(true);
  }

  const padding = ' '.repeat(2048);

  return (evt: Record<string, any>) => {
    if (scenarioId) {
      applyEventToLiveScenarioRun(scenarioId, evt);
    }
    try {
      res.write(`${JSON.stringify(evt)}${padding}\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch {}
  };
}

/**
 * Emits smooth intermediate sub-progress ticks while an async AI or image generation step is awaiting response,
 * preventing steps from appearing frozen or jumping straight from 8% to 100%.
 */
export function startSmoothStepTicker(
  onTick: (fraction: number, detail: string) => void,
  nodeTitle: string,
  nodeType: string
): () => void {
  const isFastInstant =
    nodeType === 'trigger_schedule' ||
    nodeType === 'trigger_manual' ||
    nodeType === 'format_signature' ||
    nodeType === 'logic_filter';
  if (isFastInstant) {
    return () => {};
  }

  let currentFrac = 0.14;
  const timer = setInterval(() => {
    if (currentFrac < 0.88) {
      const increment = currentFrac < 0.5 ? 0.11 : currentFrac < 0.75 ? 0.06 : 0.03;
      currentFrac = Math.min(0.88, Number((currentFrac + increment).toFixed(2)));
      onTick(currentFrac, `Выполняется блок «${nodeTitle}»...`);
    }
  }, 950);

  return () => clearInterval(timer);
}

export function registerScenarioLiveAndStylesRoutes(app: Express) {
  // Real-time live execution status & step-by-step DB results endpoint
  app.get('/api/scenarios/:id/live-status', async (req: Request, res: Response) => {
    try {
      const scenarioId = String(req.params.id || '').trim();
      const live = liveRunsMap.get(scenarioId) || null;
      const sqlDb = await getPgDB();
      const dbScen = scenarioId ? getScenarioByIdFromDb(sqlDb, scenarioId) : null;
      const mergedResults: Record<string, ScenarioNodeTestRecord> = {
        ...(dbScen?.testResults || {}),
        ...(live?.stepRecords || {})
      };

      res.json({
        scenarioId,
        isRunning: Boolean(live?.isRunning),
        liveProgress: live,
        testResults: mergedResults
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Ошибка чтения статуса запуска' });
    }
  });

  // PostgreSQL-backed Custom Post & Channel Styles API (shared between Post Constructor and Scenarios)
  app.get('/api/post-styles', async (req: Request, res: Response) => {
    try {
      const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
      const customStyles = await listUserPostStylesFromDb(userId);
      res.json({ styles: customStyles });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Ошибка загрузки стилей' });
    }
  });

  app.post('/api/post-styles', async (req: Request, res: Response) => {
    try {
      const { id, userId, title, desc, prompt } = req.body || {};
      if (!prompt || !String(prompt).trim()) {
        res.status(400).json({ error: 'Текст правил стиля не может быть пустым' });
        return;
      }
      const saved = await upsertUserPostStyleInDb({
        id,
        userId: String(userId || req.headers['x-user-id'] || 'global'),
        title: String(title || 'Фирменный стиль'),
        desc: String(desc || 'Авторский стиль оформления постов'),
        prompt: String(prompt)
      });
      res.json({ success: true, style: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Ошибка сохранения стиля' });
    }
  });

  app.delete('/api/post-styles/:id', async (req: Request, res: Response) => {
    try {
      const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
      await deleteUserPostStyleFromDb(String(req.params.id || ''), userId || undefined);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Ошибка удаления стиля' });
    }
  });
}
