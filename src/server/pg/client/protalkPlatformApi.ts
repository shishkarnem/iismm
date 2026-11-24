import { PROTALK_DB_CONFIG, getProTalkDbApiUrl, getProTalkDbHeaders } from './protalkConfig';

export interface ProTalkTriggerSpec {
  name: string;
  schema?: string;
  table: string;
  timing: 'BEFORE' | 'AFTER';
  events: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  plpgsqlBody: string;
}

export interface ProTalkCronSpec {
  id?: string | number;
  name: string;
  cronExpression: string;
  actionType: 'sql' | 'http' | 'function';
  actionPayload: string;
  enabled: boolean;
}

export interface ProTalkEdgeFunctionSpec {
  name: string;
  slug: string;
  runtime?: 'edge' | 'express';
  methods: string[];
  code: string;
  enabled: boolean;
}

async function requestJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...getProTalkDbHeaders(),
      ...(init?.headers || {})
    }
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return data as T;
}

// 1. Triggers
export async function listProTalkTriggers(): Promise<any[]> {
  const data = await requestJson<any>(getProTalkDbApiUrl('triggers'));
  return Array.isArray(data) ? data : data?.triggers || [];
}

export async function createProTalkTrigger(spec: ProTalkTriggerSpec): Promise<any> {
  return requestJson(getProTalkDbApiUrl('triggers'), {
    method: 'POST',
    body: JSON.stringify({
      schema: 'public',
      ...spec
    })
  });
}

export async function deleteProTalkTrigger(schema: string, table: string, trigger: string): Promise<any> {
  return requestJson(
    getProTalkDbApiUrl(`triggers/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/${encodeURIComponent(trigger)}`),
    { method: 'DELETE' }
  );
}

// 2. Cron Jobs
export async function listProTalkCronJobs(): Promise<any[]> {
  const data = await requestJson<any>(getProTalkDbApiUrl('cron'));
  return Array.isArray(data) ? data : data?.jobs || data?.cron || [];
}

export async function upsertProTalkCronJob(spec: ProTalkCronSpec): Promise<any> {
  return requestJson(getProTalkDbApiUrl('cron'), {
    method: 'POST',
    body: JSON.stringify(spec)
  });
}

export async function runProTalkCronJobNow(id: string | number): Promise<any> {
  return requestJson(getProTalkDbApiUrl(`cron/${encodeURIComponent(String(id))}/run`), {
    method: 'POST',
    body: JSON.stringify({})
  });
}

// 3. Edge / Express Functions
export async function listProTalkEdgeFunctions(): Promise<any[]> {
  const data = await requestJson<any>(getProTalkDbApiUrl('functions'));
  return Array.isArray(data) ? data : data?.functions || [];
}

export async function deployProTalkEdgeFunction(spec: ProTalkEdgeFunctionSpec): Promise<any> {
  return requestJson(getProTalkDbApiUrl('functions'), {
    method: 'POST',
    body: JSON.stringify({
      runtime: 'edge',
      ...spec
    })
  });
}

export function getPublicEdgeFunctionUrl(slug: string): string {
  return `${PROTALK_DB_CONFIG.baseUrl}/api/functions/${PROTALK_DB_CONFIG.database}/${slug}`;
}

// 4. Snapshots & Native Auto-Backup
export async function listProTalkSnapshots(): Promise<any[]> {
  const data = await requestJson<any>(getProTalkDbApiUrl('snapshots'));
  return Array.isArray(data) ? data : data?.snapshots || [];
}

export async function createProTalkSnapshot(label?: string): Promise<any> {
  const desc = label || `Снимок ИИSMM (${new Date().toISOString()})`;
  try {
    return await requestJson(getProTalkDbApiUrl('snapshots'), {
      method: 'POST',
      body: JSON.stringify({ description: desc })
    });
  } catch (err: any) {
    // Fallback to MCP run_backup_now / native auto-backup when user-scoped key has no raw pg_dump admin role
    const { callProTalkMcpTool } = await import('./pgHttpClient');
    try {
      return await callProTalkMcpTool('run_backup_now', { description: desc });
    } catch {
      return await runProTalkNativeTelegramBackup();
    }
  }
}

export async function fetchProTalkNativeBackupJson(): Promise<any> {
  return requestJson(getProTalkDbApiUrl('backup-json'));
}

export async function runProTalkNativeTelegramBackup(): Promise<any> {
  return requestJson(getProTalkDbApiUrl('auto-backup/run'), {
    method: 'POST',
    body: JSON.stringify({})
  });
}
