import { Scenario, ScenarioLog } from './scenarioTypes';
import { getSyncPgDB, savePgDB } from '../../db/postgres';
import {
  upsertScenarioInDb,
  deleteScenarioInDb,
  getAllSceneriesFromDb,
  getScenarioByIdFromDb,
  isScenarioNameTakenInDb
} from '../../db/sceneriesTable';

let scenariosCache: Scenario[] = [];
let scenarioLogsCache: ScenarioLog[] = [];

export class ScenarioDomain {
  public static getCachedScenarios(): Scenario[] {
    return scenariosCache;
  }

  public static setCachedScenarios(scenarios: Scenario[]): void {
    scenariosCache = scenarios;
  }

  public static getScenarios(userId?: string): Scenario[] {
    try {
      const sqlDb = getSyncPgDB();
      if (sqlDb) {
        let pgScenarios = getAllSceneriesFromDb(sqlDb);
        const pgIds = new Set(pgScenarios.map((s: any) => String(s.id)));
        let migratedAny = false;
        scenariosCache.forEach((js) => {
          if (js?.id && !pgIds.has(String(js.id))) {
            upsertScenarioInDb(sqlDb, js);
            migratedAny = true;
          }
        });
        if (migratedAny) {
          savePgDB();
          pgScenarios = getAllSceneriesFromDb(sqlDb);
        }
        if (userId) {
          return pgScenarios.filter(
            (s: any) => !s.userId || String(s.userId) === String(userId)
          );
        }
        return pgScenarios;
      }
    } catch (e) {
      console.error('[ScenarioDomain] Error reading scenarios from PostgreSQL:', e);
    }
    if (userId) {
      return scenariosCache.filter((s) => !s.userId || String(s.userId) === String(userId));
    }
    return scenariosCache;
  }

  public static isScenarioNameTaken(name: string, excludeId?: string): boolean {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return false;
    try {
      const sqlDb = getSyncPgDB();
      if (sqlDb && isScenarioNameTakenInDb(sqlDb, normalized, excludeId)) {
        return true;
      }
    } catch (e) {}
    return scenariosCache.some(
      (s) =>
        String(s.name || '').trim().toLowerCase() === normalized &&
        (!excludeId || String(s.id) !== String(excludeId))
    );
  }

  public static addScenario(
    scenario: Omit<Scenario, 'id' | 'createdAt'> & { id?: string }
  ): Scenario {
    const newId =
      scenario.id && String(scenario.id).trim()
        ? String(scenario.id).trim()
        : 'scen_' + Math.random().toString(36).substring(2, 11);
    const newScenario: Scenario = {
      description: scenario.description || '',
      steps: scenario.steps || [],
      ...scenario,
      id: newId,
      name: String(scenario.name || 'Сценарий').trim(),
      testResults: scenario.testResults || {},
      createdAt: new Date().toISOString()
    };
    const existingIdx = scenariosCache.findIndex((s) => s.id === newId);
    if (existingIdx !== -1) {
      scenariosCache[existingIdx] = newScenario;
    } else {
      scenariosCache.push(newScenario);
    }

    try {
      const sqlDb = getSyncPgDB();
      if (sqlDb) {
        upsertScenarioInDb(sqlDb, newScenario);
        savePgDB();
      }
    } catch (e) {
      console.error('[ScenarioDomain] Error syncing added scenario:', e);
    }

    return newScenario;
  }

  public static updateScenario(id: string, updated: Partial<Scenario>): Scenario {
    const index = scenariosCache.findIndex((s) => s.id === id);

    let existingFromSql: any = null;
    try {
      const sqlDb = getSyncPgDB();
      if (sqlDb) {
        existingFromSql = getScenarioByIdFromDb(sqlDb, id);
      }
    } catch (e) {}

    if (index !== -1 || existingFromSql) {
      const base = index !== -1 ? scenariosCache[index] : existingFromSql;
      const merged: Scenario = {
        ...base,
        ...updated,
        id,
        testResults:
          updated.testResults !== undefined
            ? updated.testResults
            : existingFromSql?.testResults || base?.testResults || {}
      };
      if (index !== -1) {
        scenariosCache[index] = merged;
      } else {
        scenariosCache.push(merged);
      }

      try {
        const sqlDb = getSyncPgDB();
        if (sqlDb) {
          upsertScenarioInDb(sqlDb, merged);
          savePgDB();
        }
      } catch (e) {
        console.error('[ScenarioDomain] Error syncing updated scenario:', e);
      }

      return merged;
    }
    throw new Error('Сценарий не найден в базе данных');
  }

  public static deleteScenario(id: string): void {
    scenariosCache = scenariosCache.filter((s) => s.id !== id);

    try {
      const sqlDb = getSyncPgDB();
      if (sqlDb) {
        deleteScenarioInDb(sqlDb, id);
        savePgDB();
      }
    } catch (e) {
      console.error('[ScenarioDomain] Error syncing deleted scenario:', e);
    }
  }

  public static getScenarioLogs(): ScenarioLog[] {
    return scenarioLogsCache;
  }

  public static addScenarioLog(log: Omit<ScenarioLog, 'id' | 'runAt'>): ScenarioLog {
    const newLog: ScenarioLog = {
      scenarioId: log.scenarioId || '',
      scenarioName: log.scenarioName || '',
      status: log.status || 'success',
      executedSteps: log.executedSteps || [],
      ...log,
      id: 'slog_' + Math.random().toString(36).substring(2, 11),
      runAt: new Date().toISOString()
    };
    scenarioLogsCache.push(newLog);
    return newLog;
  }

  public static deleteScenarioLog(id: string): void {
    const cleanId = String(id || '').trim();
    scenarioLogsCache = scenarioLogsCache.filter((l) => String(l.id || '').trim() !== cleanId);
  }
}
