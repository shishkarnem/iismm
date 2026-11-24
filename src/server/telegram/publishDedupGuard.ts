import crypto from 'crypto';
import { DB } from '../db';
import { getPgDB, pgQuery } from '../db/postgres';
import { interpolatePgParams } from '../pg/cache/pgHydrator';

async function runLocalDedupSql(pgSql: string, params: any[] = []): Promise<void> {
  try {
    const db = await getPgDB();
    db.mem.public.none(interpolatePgParams(pgSql, params));
  } catch {}
}

export type DedupOutcome = 'sent' | 'ambiguous_timeout' | 'definite_failure';

export interface EntitySlotClaimParams {
  slotKey: string;
  entityType: 'post' | 'pub' | 'folder' | 'folder_repeat' | 'selection' | 'scenario' | 'manual' | 'direct';
  entityId: string;
  channelKey?: string;
  contentHash?: string;
  staleProcessingMs?: number;
}

export interface ContentGuardParams {
  channel: string;
  telegramId?: number | string;
  title?: string;
  content?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
  inlineButtons?: any;
  entityType?: EntitySlotClaimParams['entityType'];
  entityId?: string;
  isTest?: boolean;
  windowMs?: number;
}

export interface DedupClaimResult {
  claimed: boolean;
  dedupKey: string;
  channelKey: string;
  contentHash?: string;
  reason?: string;
}

const DEFAULT_CHANNEL_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_TEST_WINDOW_MS = 15 * 1000;
const DEFAULT_STALE_PROCESSING_MS = 5 * 60 * 1000;
const MEMORY_RETENTION_MS = 60 * 60 * 1000;

const inFlightMemoryKeys = new Set<string>();
const recentMemoryKeys = new Map<string, { atMs: number; status: 'processing' | 'sent' }>();
const mutexQueues = new Map<string, Promise<unknown>>();
let dedupTableReadyPromise: Promise<void> | null = null;

function pruneMemoryCache(nowMs: number) {
  if (recentMemoryKeys.size <= 2000) return;
  for (const [k, rec] of recentMemoryKeys.entries()) {
    if (nowMs - rec.atMs > MEMORY_RETENTION_MS) {
      recentMemoryKeys.delete(k);
    }
  }
}

async function withKeyMutex<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = mutexQueues.get(lockKey) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.then(() => gate, () => gate);
  mutexQueues.set(lockKey, chained);
  try {
    await prev.catch(() => null);
    return await fn();
  } finally {
    release();
    if (mutexQueues.get(lockKey) === chained) {
      mutexQueues.delete(lockKey);
    }
  }
}

export async function ensurePublishDedupTable(): Promise<void> {
  if (dedupTableReadyPromise) {
    return dedupTableReadyPromise;
  }
  dedupTableReadyPromise = (async () => {
    const ddl = `
      CREATE TABLE IF NOT EXISTS telegram_publish_dedup (
        dedup_key TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        channel_key TEXT NOT NULL,
        content_hash TEXT,
        status TEXT NOT NULL DEFAULT 'processing',
        message_id TEXT,
        created_at_ms INT8 NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `;
    const idx1 = `CREATE INDEX IF NOT EXISTS idx_tg_dedup_chan_hash ON telegram_publish_dedup(channel_key, content_hash, created_at_ms);`;
    const idx2 = `CREATE INDEX IF NOT EXISTS idx_tg_dedup_entity ON telegram_publish_dedup(entity_id, status, created_at_ms);`;

    try {
      const db = await getPgDB();
      db.mem.public.none(ddl);
      db.mem.public.none(idx1);
      db.mem.public.none(idx2);
    } catch {}

    try {
      await pgQuery(ddl, [], { safeMode: false, retries: 1 });
      await pgQuery(idx1, [], { safeMode: false, retries: 1 });
      await pgQuery(idx2, [], { safeMode: false, retries: 1 });
    } catch {
      // Allow re-attempt later if transient startup error occurs
      dedupTableReadyPromise = null;
    }
  })();
  return dedupTableReadyPromise;
}

/**
 * Canonicalizes any Telegram channel reference (@restreamsav, https://t.me/restreamsav,
 * internal DB channel ID, channel name, or numeric -100... chat ID) into ONE canonical key
 * so switching between @username and -100... never bypasses duplicate detection.
 */
export function canonicalizeTelegramTarget(
  rawChannel: string,
  telegramId?: number | string
): string {
  const raw = String(rawChannel || '').trim();
  const lowerRaw = raw.toLowerCase();

  if (
    lowerRaw === 'bot_dm' ||
    lowerRaw === '@bot_dm' ||
    lowerRaw === 'direct_message' ||
    lowerRaw === 'dm'
  ) {
    const settings = (DB.getSettings?.() || {}) as Record<string, any>;
    const targetDm = String(telegramId || settings.channelId || 'dm').trim();
    return `dm:${targetDm}`;
  }

  let normalized = raw
    .replace(/^https?:\/\/(?:t\.me|telegram\.me)\//i, '')
    .replace(/^tg:\/\/resolve\?domain=/i, '')
    .split(/[?#]/)[0]
    .trim();

  if (!normalized) {
    const settings = (DB.getSettings?.() || {}) as Record<string, any>;
    normalized = String(settings.channelId || '').trim();
  }

  const cleanNoAt = normalized.replace(/^@/, '').toLowerCase();

  try {
    const dbChannels = DB.getChannels() || [];
    const matched = dbChannels.find((c: any) => {
      const cId = String(c.id || '').toLowerCase().trim();
      const cChanId = String(c.channelId || c.channel_id || '').toLowerCase().trim();
      const cTgId = String(c.telegramId || c.telegram_id || '').toLowerCase().trim();
      const cUser = String(c.username || '').replace(/^@/, '').toLowerCase().trim();
      const cName = String(c.name || '').toLowerCase().trim();
      const cTitle = String(c.title || '').toLowerCase().trim();
      return (
        (cId && cId === cleanNoAt) ||
        (cChanId && (cChanId === lowerRaw || cChanId.replace(/^@/, '') === cleanNoAt)) ||
        (cTgId && cTgId === normalized.toLowerCase()) ||
        (cUser && cUser === cleanNoAt) ||
        (cName && cName === lowerRaw) ||
        (cTitle && cTitle === lowerRaw)
      );
    });

    if (matched) {
      const mTgId = String((matched as any).telegramId || (matched as any).telegram_id || '').trim();
      if (mTgId && /^-?\d+$/.test(mTgId)) {
        return `chan:${mTgId}`;
      }
      const mUser = String(matched.username || '').replace(/^@/, '').toLowerCase().trim();
      if (mUser) {
        return `chan:@${mUser}`;
      }
      if (matched.channelId || (matched as any).channel_id) {
        const mc = String(matched.channelId || (matched as any).channel_id).trim().toLowerCase();
        return mc.startsWith('@') || /^-?\d+$/.test(mc) ? `chan:${mc}` : `chan:@${mc}`;
      }
    }
  } catch {}

  if (/^-?\d+$/.test(normalized)) {
    return `chan:${normalized}`;
  }
  return `chan:@${cleanNoAt}`;
}

export function normalizeContentForHash(value?: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u200B/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function computePublishContentHash(params: {
  channelKey: string;
  title?: string;
  content?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
  inlineButtons?: any;
}): string {
  const normText = normalizeContentForHash(params.content);
  const normTitle = normText ? '' : normalizeContentForHash(params.title);
  const urlsList: string[] = [];
  if (params.attachmentUrl && String(params.attachmentUrl).trim()) {
    urlsList.push(String(params.attachmentUrl).trim());
  }
  if (Array.isArray(params.attachmentUrls)) {
    for (const u of params.attachmentUrls) {
      const s = String(u || '').trim();
      if (s && !urlsList.includes(s)) urlsList.push(s);
    }
  }
  const sigObj = {
    c: params.channelKey,
    t: normTitle,
    b: normText,
    m: urlsList,
    k: params.inlineButtons ? JSON.stringify(params.inlineButtons) : ''
  };
  return crypto.createHash('sha256').update(JSON.stringify(sigObj)).digest('hex');
}

export function isDefiniteClientFailure(errMsg: string): boolean {
  const s = String(errMsg || '').toLowerCase();
  if (!s) return false;
  if (
    /timeout|timed out|abort|etimedout|econnreset|econnrefused|enotfound|eai_again|socket hang up|und_err|network|fetch failed|502|503|504/.test(
      s
    )
  ) {
    return false;
  }
  return (
    s.includes('bot is not a member') ||
    s.includes('chat not found') ||
    s.includes('bot was kicked') ||
    s.includes('bot was blocked') ||
    s.includes('user is deactivated') ||
    s.includes('forbidden') ||
    s.includes('not enough rights') ||
    s.includes('have no rights to send') ||
    s.includes('chat_write_forbidden') ||
    s.includes('не является администратором') ||
    s.includes('текст публикации') ||
    s.includes('пуст') ||
    s.includes('button_url_invalid') ||
    s.includes('button_type_invalid') ||
    s.includes("can't parse entities") ||
    s.includes('message is too long') ||
    s.includes('bad request')
  );
}

/**
 * Atomically claims a persistent entity+channel execution slot in both in-process mutex,
 * local pg-mem, and Cloud PostgreSQL (fail-closed if already processing/sent).
 */
export async function acquireEntityPublishSlot(
  params: EntitySlotClaimParams
): Promise<DedupClaimResult> {
  const dedupKey = String(params.slotKey || '').trim();
  const channelKey = String(params.channelKey || 'default').trim();
  const staleMs = params.staleProcessingMs ?? DEFAULT_STALE_PROCESSING_MS;
  if (!dedupKey) {
    return { claimed: false, dedupKey: '', channelKey, reason: 'missing_slot_key' };
  }

  return withKeyMutex(`slot:${dedupKey}`, async () => {
    await ensurePublishDedupTable();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    pruneMemoryCache(nowMs);

    if (inFlightMemoryKeys.has(dedupKey)) {
      return { claimed: false, dedupKey, channelKey, reason: 'in_flight_memory' };
    }

    const memRec = recentMemoryKeys.get(dedupKey);
    if (memRec) {
      if (memRec.status === 'sent') {
        return { claimed: false, dedupKey, channelKey, reason: 'already_sent_memory' };
      }
      if (memRec.status === 'processing' && nowMs - memRec.atMs < staleMs) {
        return { claimed: false, dedupKey, channelKey, reason: 'processing_memory' };
      }
    }

    // Local pg-mem check before touching network
    try {
      const db = await getPgDB();
      const stmt = db.prepare(
        `SELECT status, created_at_ms FROM telegram_publish_dedup WHERE dedup_key = ? LIMIT 1`
      );
      stmt.bind([dedupKey]);
      if (stmt.step()) {
        const row: any = stmt.getAsObject();
        stmt.free();
        const st = String(row.status || '').toLowerCase();
        const ts = Number(row.created_at_ms || 0);
        if (st === 'sent') {
          recentMemoryKeys.set(dedupKey, { atMs: ts || nowMs, status: 'sent' });
          return { claimed: false, dedupKey, channelKey, reason: 'already_sent_local_db' };
        }
        if (st === 'processing' && nowMs - ts < staleMs) {
          return { claimed: false, dedupKey, channelKey, reason: 'processing_local_db' };
        }
      } else {
        stmt.free();
      }
    } catch {}

    // Atomic Cloud PG compare-and-set
    try {
      const insRes = await pgQuery<{ dedup_key: string }>(
        `INSERT INTO telegram_publish_dedup (
           dedup_key, entity_type, entity_id, channel_key, content_hash, status, created_at_ms, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, 'processing', $6, $7, $7)
         ON CONFLICT (dedup_key) DO NOTHING
         RETURNING dedup_key`,
        [
          dedupKey,
          params.entityType,
          params.entityId,
          channelKey,
          params.contentHash || null,
          nowMs,
          nowIso
        ],
        { safeMode: false, retries: 1 }
      );

      if ((insRes.rows || []).length === 0) {
        const existingRes = await pgQuery<{ status: string; created_at_ms: number | string }>(
          `SELECT status, created_at_ms FROM telegram_publish_dedup WHERE dedup_key = $1 LIMIT 1`,
          [dedupKey],
          { safeMode: false, retries: 1 }
        );
        const existing = existingRes.rows?.[0];
        if (!existing) {
          return { claimed: false, dedupKey, channelKey, reason: 'pg_conflict_unverified' };
        }
        const st = String(existing.status || '').toLowerCase();
        const ts = Number(existing.created_at_ms || 0);
        if (st === 'sent') {
          recentMemoryKeys.set(dedupKey, { atMs: ts || nowMs, status: 'sent' });
          return { claimed: false, dedupKey, channelKey, reason: 'already_sent_pg' };
        }
        if (st !== 'processing' || nowMs - ts < staleMs) {
          return { claimed: false, dedupKey, channelKey, reason: 'processing_pg' };
        }

        // Recover stale crashed 'processing' row only
        const takeOverRes = await pgQuery<{ dedup_key: string }>(
          `UPDATE telegram_publish_dedup
           SET created_at_ms = $1, updated_at = $2
           WHERE dedup_key = $3 AND status = 'processing' AND created_at_ms < $4
           RETURNING dedup_key`,
          [nowMs, nowIso, dedupKey, nowMs - staleMs],
          { safeMode: false, retries: 1 }
        );
        if ((takeOverRes.rows || []).length === 0) {
          return { claimed: false, dedupKey, channelKey, reason: 'stale_takeover_lost' };
        }
      }
    } catch (pgErr: any) {
      // Fall through ONLY if we held no conflicting record locally, but mark memory lock immediately;
      // fail closed on explicit conflict errors.
      const msg = String(pgErr?.message || pgErr || '');
      if (/duplicate|conflict|constraint/i.test(msg)) {
        return { claimed: false, dedupKey, channelKey, reason: 'pg_constraint' };
      }
      console.warn('[PublishDedupGuard] PG slot claim warning (continuing with local lock):', msg);
    }

    inFlightMemoryKeys.add(dedupKey);
    recentMemoryKeys.set(dedupKey, { atMs: nowMs, status: 'processing' });
    await runLocalDedupSql(
      `INSERT INTO telegram_publish_dedup (
         dedup_key, entity_type, entity_id, channel_key, content_hash, status, created_at_ms, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'processing', $6, $7, $7)
       ON CONFLICT (dedup_key) DO UPDATE SET
         status = 'processing',
         created_at_ms = EXCLUDED.created_at_ms,
         updated_at = EXCLUDED.updated_at`,
      [
        dedupKey,
        params.entityType,
        params.entityId,
        channelKey,
        params.contentHash || null,
        nowMs,
        nowIso
      ]
    );

    return {
      claimed: true,
      dedupKey,
      channelKey,
      contentHash: params.contentHash
    };
  });
}

/**
 * Prevents sending identical/near-identical content to the same canonical Telegram channel
 * (regardless of whether specified via @username or numeric -100... chat_id) within windowMs.
 */
export async function acquireContentChannelGuard(
  params: ContentGuardParams
): Promise<DedupClaimResult> {
  const channelKey = canonicalizeTelegramTarget(params.channel, params.telegramId);
  const contentHash = computePublishContentHash({
    channelKey,
    title: params.title,
    content: params.content,
    attachmentUrl: params.attachmentUrl,
    attachmentUrls: params.attachmentUrls,
    inlineButtons: params.inlineButtons
  });
  const windowMs =
    params.windowMs ?? (params.isTest ? DEFAULT_TEST_WINDOW_MS : DEFAULT_CHANNEL_WINDOW_MS);

  return withKeyMutex(`content:${channelKey}:${contentHash}`, async () => {
    await ensurePublishDedupTable();
    const nowMs = Date.now();
    const minTs = nowMs - windowMs;
    const nowIso = new Date(nowMs).toISOString();
    const bucket = Math.floor(nowMs / Math.max(5000, windowMs));
    const dedupKey = `content:${channelKey}:${contentHash.slice(0, 24)}:${bucket}`;

    // Check recent memory keys across all buckets matching same channel + hash prefix
    const memPrefix = `content:${channelKey}:${contentHash.slice(0, 24)}:`;
    for (const key of inFlightMemoryKeys) {
      if (key.startsWith(memPrefix)) {
        return { claimed: false, dedupKey, channelKey, contentHash, reason: 'content_in_flight' };
      }
    }
    for (const [key, rec] of recentMemoryKeys.entries()) {
      if (key.startsWith(memPrefix) && rec.atMs >= minTs) {
        return {
          claimed: false,
          dedupKey,
          channelKey,
          contentHash,
          reason: rec.status === 'sent' ? 'content_recently_sent_memory' : 'content_processing_memory'
        };
      }
    }

    // Check local pg-mem for ANY bucket with same channel_key + content_hash within windowMs
    try {
      const db = await getPgDB();
      const stmt = db.prepare(
        `SELECT dedup_key, status, created_at_ms
         FROM telegram_publish_dedup
         WHERE channel_key = ? AND content_hash = ? AND created_at_ms >= ?
         ORDER BY created_at_ms DESC LIMIT 1`
      );
      stmt.bind([channelKey, contentHash, minTs]);
      if (stmt.step()) {
        const row: any = stmt.getAsObject();
        stmt.free();
        return {
          claimed: false,
          dedupKey: String(row.dedup_key || dedupKey),
          channelKey,
          contentHash,
          reason: `content_duplicate_local_${row.status}`
        };
      }
      stmt.free();
    } catch {}

    // Check & claim atomically in Cloud PG
    try {
      const dupRes = await pgQuery<{ dedup_key: string; status: string; created_at_ms: number | string }>(
        `SELECT dedup_key, status, created_at_ms
         FROM telegram_publish_dedup
         WHERE channel_key = $1 AND content_hash = $2 AND created_at_ms >= $3
         ORDER BY created_at_ms DESC LIMIT 1`,
        [channelKey, contentHash, minTs],
        { safeMode: false, retries: 1 }
      );
      if ((dupRes.rows || []).length > 0) {
        const hit = dupRes.rows[0];
        recentMemoryKeys.set(String(hit.dedup_key), {
          atMs: Number(hit.created_at_ms || nowMs),
          status: hit.status === 'sent' ? 'sent' : 'processing'
        });
        return {
          claimed: false,
          dedupKey: String(hit.dedup_key),
          channelKey,
          contentHash,
          reason: `content_duplicate_pg_${hit.status}`
        };
      }

      const ins = await pgQuery<{ dedup_key: string }>(
        `INSERT INTO telegram_publish_dedup (
           dedup_key, entity_type, entity_id, channel_key, content_hash, status, created_at_ms, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, 'processing', $6, $7, $7)
         ON CONFLICT (dedup_key) DO NOTHING
         RETURNING dedup_key`,
        [
          dedupKey,
          params.entityType || (params.isTest ? 'direct' : 'post'),
          String(params.entityId || 'content'),
          channelKey,
          contentHash,
          nowMs,
          nowIso
        ],
        { safeMode: false, retries: 1 }
      );
      if ((ins.rows || []).length === 0) {
        return { claimed: false, dedupKey, channelKey, contentHash, reason: 'content_pg_conflict' };
      }
    } catch (pgErr: any) {
      const msg = String(pgErr?.message || pgErr || '');
      if (/duplicate|conflict|constraint/i.test(msg)) {
        return { claimed: false, dedupKey, channelKey, contentHash, reason: 'content_pg_constraint' };
      }
      console.warn('[PublishDedupGuard] PG content guard warning:', msg);
    }

    inFlightMemoryKeys.add(dedupKey);
    recentMemoryKeys.set(dedupKey, { atMs: nowMs, status: 'processing' });
    await runLocalDedupSql(
      `INSERT INTO telegram_publish_dedup (
         dedup_key, entity_type, entity_id, channel_key, content_hash, status, created_at_ms, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'processing', $6, $7, $7)
       ON CONFLICT (dedup_key) DO UPDATE SET
         status = 'processing',
         created_at_ms = EXCLUDED.created_at_ms,
         updated_at = EXCLUDED.updated_at`,
      [
        dedupKey,
        params.entityType || (params.isTest ? 'direct' : 'post'),
        String(params.entityId || 'content'),
        channelKey,
        contentHash,
        nowMs,
        nowIso
      ]
    );

    return { claimed: true, dedupKey, channelKey, contentHash };
  });
}

export async function finalizePublishDedup(
  keys: string[],
  outcome: DedupOutcome,
  messageId?: string
): Promise<void> {
  const uniqueKeys = [...new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean))];
  if (uniqueKeys.length === 0) return;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  for (const key of uniqueKeys) {
    try {
      if (outcome === 'sent' || outcome === 'ambiguous_timeout') {
        const prev = recentMemoryKeys.get(key);
        recentMemoryKeys.set(key, { atMs: prev?.atMs || nowMs, status: 'sent' });

        await runLocalDedupSql(
          `UPDATE telegram_publish_dedup SET status = 'sent', message_id = COALESCE($1, message_id), updated_at = $2 WHERE dedup_key = $3`,
          [messageId || null, nowIso, key]
        );

        await pgQuery(
          `UPDATE telegram_publish_dedup SET status = 'sent', message_id = COALESCE($1, message_id), updated_at = $2 WHERE dedup_key = $3`,
          [messageId || null, nowIso, key],
          { safeMode: false, retries: 1 }
        ).catch(() => null);
      } else {
        // Only clear 'processing' locks; NEVER clear a record already promoted to 'sent'
        const prev = recentMemoryKeys.get(key);
        if (prev?.status === 'sent') continue;
        recentMemoryKeys.delete(key);

        await runLocalDedupSql(
          `DELETE FROM telegram_publish_dedup WHERE dedup_key = $1 AND status = 'processing'`,
          [key]
        );

        await pgQuery(
          `DELETE FROM telegram_publish_dedup WHERE dedup_key = $1 AND status = 'processing'`,
          [key],
          { safeMode: false, retries: 1 }
        ).catch(() => null);
      }
    } finally {
      inFlightMemoryKeys.delete(key);
    }
  }
}

/**
 * Checks whether a given postId was already published very recently (across local DB + Cloud PG + dedup ledger)
 * so overlapping cron_post_ / publications / manual dispatchers never fire twice back-to-back.
 */
export async function isPostRecentlyPublished(
  postId: string,
  withinMs: number = 10 * 60 * 1000
): Promise<boolean> {
  const cleanId = String(postId || '').trim();
  if (!cleanId) return false;
  const nowMs = Date.now();

  try {
    const req = DB.getDayRequestById(cleanId);
    if (req?.publishedAt) {
      const pubMs = Date.parse(String(req.publishedAt));
      if (!Number.isNaN(pubMs) && nowMs - pubMs < withinMs && req.status !== 'ошибка') {
        return true;
      }
    }
  } catch {}

  try {
    const recentPub = DB.getPublications().find((p) => {
      const pid = String(p.promptId || p.id || '').trim();
      if (pid !== cleanId) return false;
      if (p.statusType !== 'published' || !p.status) return false;
      const tMs = Date.parse(String(p.publishedAt || ''));
      return !Number.isNaN(tMs) && nowMs - tMs < withinMs;
    });
    if (recentPub) return true;
  } catch {}

  try {
    await ensurePublishDedupTable();
    const dedupRes = await pgQuery<{ dedup_key: string }>(
      `SELECT dedup_key FROM telegram_publish_dedup
       WHERE entity_id = $1 AND status IN ('sent', 'processing') AND created_at_ms >= $2
       LIMIT 1`,
      [cleanId, nowMs - withinMs],
      { safeMode: true, retries: 1 }
    );
    if ((dedupRes.rows || []).length > 0) return true;
  } catch {}

  try {
    const postPg = await pgQuery<{ published_at: string; status: string }>(
      `SELECT published_at, status FROM posts WHERE id = $1 LIMIT 1`,
      [cleanId],
      { safeMode: true, retries: 1 }
    );
    const row = postPg.rows?.[0];
    if (row?.published_at && String(row.status || '').toLowerCase() !== 'ошибка') {
      const pubMs = Date.parse(String(row.published_at));
      if (!Number.isNaN(pubMs) && nowMs - pubMs < withinMs) {
        return true;
      }
    }
  } catch {}

  return false;
}
