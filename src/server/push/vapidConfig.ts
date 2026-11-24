import * as webPushModule from 'web-push';
import { getPgDB, pgQuery, refreshTableCacheFromCloud } from '../db/postgres';

const webPush = ((webPushModule as any).default || webPushModule) as typeof import('web-push');

export interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
  subject: string;
}

const APP_SETTINGS_VAPID_KEY = 'web_push_vapid_keys';
const DEFAULT_VAPID_SUBJECT = 'mailto:support@iismm.ru';
let cachedVapid: VapidKeyPair | null = null;
let initPromise: Promise<VapidKeyPair> | null = null;

function configureWebPush(keys: VapidKeyPair): void {
  webPush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
}

export async function getOrInitVapidKeys(): Promise<VapidKeyPair> {
  if (cachedVapid) return cachedVapid;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const subject = DEFAULT_VAPID_SUBJECT;

    // Read persisted VAPID keypair from Cloud PostgreSQL app_settings
    try {
      const cloudRes = await pgQuery<{ setting_value?: string }>(
        'SELECT setting_value FROM app_settings WHERE setting_key = $1 LIMIT 1',
        [APP_SETTINGS_VAPID_KEY],
        { safeMode: true }
      ).catch(() => null);

      const rawVal = cloudRes?.rows?.[0]?.setting_value;
      if (rawVal) {
        const parsed = JSON.parse(rawVal);
        if (parsed?.publicKey && parsed?.privateKey) {
          const pair: VapidKeyPair = {
            publicKey: String(parsed.publicKey),
            privateKey: String(parsed.privateKey),
            subject: String(parsed.subject || subject),
          };
          configureWebPush(pair);
          cachedVapid = pair;
          return pair;
        }
      }
    } catch (err) {
      console.warn('[WebPush VAPID] Warning reading keys from Cloud PG:', err);
    }

    // Fallback check local hydrated cache before generating
    try {
      const db = await getPgDB();
      const stmt = db.prepare('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1');
      stmt.bind([APP_SETTINGS_VAPID_KEY]);
      if (stmt.step()) {
        const row = stmt.getAsObject() as { setting_value?: string };
        stmt.free();
        if (row?.setting_value) {
          const parsed = JSON.parse(row.setting_value);
          if (parsed?.publicKey && parsed?.privateKey) {
            const pair: VapidKeyPair = {
              publicKey: String(parsed.publicKey),
              privateKey: String(parsed.privateKey),
              subject: String(parsed.subject || subject),
            };
            configureWebPush(pair);
            cachedVapid = pair;
            return pair;
          }
        }
      } else {
        stmt.free();
      }
    } catch {}

    // Generate a fresh VAPID keypair once and persist in Cloud PostgreSQL
    const generated = webPush.generateVAPIDKeys();
    const newPair: VapidKeyPair = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject,
    };
    const nowIso = new Date().toISOString();
    const serialized = JSON.stringify(newPair);

    try {
      await pgQuery(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (setting_key) DO NOTHING`,
        [APP_SETTINGS_VAPID_KEY, serialized, nowIso]
      );

      // Re-read in case of concurrent boot race so all instances share the exact same keypair
      const verifyRes = await pgQuery<{ setting_value?: string }>(
        'SELECT setting_value FROM app_settings WHERE setting_key = $1 LIMIT 1',
        [APP_SETTINGS_VAPID_KEY]
      ).catch(() => null);
      const savedRaw = verifyRes?.rows?.[0]?.setting_value;
      if (savedRaw) {
        const savedParsed = JSON.parse(savedRaw);
        if (savedParsed?.publicKey && savedParsed?.privateKey) {
          newPair.publicKey = String(savedParsed.publicKey);
          newPair.privateKey = String(savedParsed.privateKey);
        }
      }

      const db = await getPgDB();
      db.run(
        `INSERT OR REPLACE INTO app_settings (setting_key, setting_value, updated_at)
         VALUES (?, ?, ?)`,
        [APP_SETTINGS_VAPID_KEY, JSON.stringify(newPair), nowIso]
      );
      await refreshTableCacheFromCloud('app_settings').catch(() => null);
    } catch (persistErr) {
      console.warn('[WebPush VAPID] Failed saving generated VAPID keys to PG:', persistErr);
    }

    configureWebPush(newPair);
    cachedVapid = newPair;
    return newPair;
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}
