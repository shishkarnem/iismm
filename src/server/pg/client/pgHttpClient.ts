import dns from 'dns';
import {
  PROTALK_DB_CONFIG,
  getProTalkDbHeaders,
  getProTalkMcpUrl,
  getProTalkQueryUrl
} from './protalkConfig';

// Prefer IPv4 to prevent Node 22 undici dual-stack AAAA ConnectTimeoutError
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if unsupported in runtime
}

export interface PgQueryResult<T = Record<string, any>> {
  rows: T[];
  rowCount: number;
  fields?: Array<{ name: string; dataTypeID?: number }>;
}

export function normalizePgParams(params?: unknown[]): any[] {
  if (!params || !Array.isArray(params)) return [];
  return params.map((val) => {
    if (val === undefined) return null;
    if (val === null) return null;
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'boolean') return val;
    if (typeof val === 'object' && !Buffer.isBuffer(val)) {
      return JSON.stringify(val);
    }
    return val;
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeSqlValueForMcp(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  const str = String(val).replace(/\0/g, '').replace(/'/g, "''");
  return `'${str}'`;
}

function interpolateForMcpFallback(sql: string, params: any[] = []): string {
  if (!params.length) return sql;
  return sql.replace(/\$(\d+)\b/g, (match, numStr) => {
    const idx = parseInt(numStr, 10) - 1;
    if (idx < 0 || idx >= params.length) return match;
    return escapeSqlValueForMcp(params[idx]);
  });
}

export async function pgQuery<T = Record<string, any>>(
  query: string,
  params: unknown[] = [],
  options?: { safeMode?: boolean; retries?: number; timeoutMs?: number }
): Promise<PgQueryResult<T>> {
  const safeMode = options?.safeMode ?? false;
  const maxRetries = options?.retries ?? 3;
  const timeoutMs = options?.timeoutMs ?? 25000;
  const serializedParams = normalizePgParams(params);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(getProTalkQueryUrl(), {
        method: 'POST',
        headers: getProTalkDbHeaders(),
        body: JSON.stringify({
          database: PROTALK_DB_CONFIG.database,
          query,
          params: serializedParams,
          safeMode
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const rawText = await response.text();
      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(`Invalid JSON from ProTalk PostgreSQL (${response.status}): ${rawText.slice(0, 240)}`);
      }

      if (!response.ok || parsed?.error) {
        const msg = parsed?.error || `HTTP ${response.status}`;
        const code = parsed?.code ? ` [${parsed.code}]` : '';

        // If safeMode was enabled and ProTalk rejected with Admin privileges required, retry with safeMode = false
        if (safeMode && /admin privileges required|forbidden/i.test(msg)) {
          return pgQuery<T>(query, params, { ...options, safeMode: false });
        }

        const err = new Error(`PostgreSQL ProTalk Error${code}: ${msg}`);
        (err as any).pgCode = parsed?.code;
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw err;
        }
        lastError = err;
      } else {
        const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
        const rowCount = typeof parsed?.rowCount === 'number' ? parsed.rowCount : rows.length;
        return {
          rows,
          rowCount,
          fields: parsed?.fields
        };
      }
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if ((err as any)?.pgCode && !['53300', '57P01', '08006', '08003'].includes(String((err as any).pgCode))) {
        throw lastError;
      }
      if (/HTTP 40[0134]|Admin privileges required/i.test(lastError.message)) {
        throw lastError;
      }
    }

    if (attempt < maxRetries) {
      await sleep(300 * (attempt + 1));
    }
  }

  throw lastError || new Error('Failed to execute PostgreSQL query');
}

export async function callProTalkMcpTool<T = any>(
  toolName: string,
  args: Record<string, any> = {}
): Promise<T> {
  const response = await fetch(getProTalkMcpUrl(), {
    method: 'POST',
    headers: getProTalkDbHeaders(),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })
  });

  const data = await response.json();
  if (data?.error) {
    throw new Error(`MCP Tool ${toolName} Error: ${data.error.message || JSON.stringify(data.error)}`);
  }
  return data?.result as T;
}
