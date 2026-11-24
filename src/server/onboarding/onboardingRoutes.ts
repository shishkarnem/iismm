import type { Express, Request, Response } from 'express';
import * as crypto from 'crypto';
import { DB } from '../db';
import { getDatabase, saveDatabaseToDisk } from '../db/index';
import {
  checkAndApplyStartRegistrationBonus,
  format11DigitUserId
} from '../db/usersTable';
import { getUserAllowedChannelsFromDb } from '../channels/userAllowedChannels';
import { linkTelegramAccountByIdWithVerification } from './telegramIdLinkService';
import { ensureUserJoinedIismmChat } from '../social/autoJoinGroupService';

export interface UserOnboardingStateRecord {
  userId: string;
  currentStep: number;
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
  step4Done: boolean;
  tourCompleted: boolean;
  dismissed: boolean;
  selectedChannelId: string;
  createdPostId: string;
  createdScenarioId: string;
  updatedAt: string;
}

function hashPasswordSha256(pwd: string): string {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

async function ensureOnboardingTable() {
  const db = await getDatabase();
  db.run(`
    CREATE TABLE IF NOT EXISTS user_onboarding_tour (
      user_id TEXT PRIMARY KEY,
      current_step INTEGER DEFAULT 1,
      step1_done INTEGER DEFAULT 0,
      step2_done INTEGER DEFAULT 0,
      step3_done INTEGER DEFAULT 0,
      step4_done INTEGER DEFAULT 0,
      tour_completed INTEGER DEFAULT 0,
      dismissed INTEGER DEFAULT 0,
      selected_channel_id TEXT DEFAULT '',
      created_post_id TEXT DEFAULT '',
      created_scenario_id TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

function readOnboardingRow(db: any, canonicalId: string): UserOnboardingStateRecord {
  const stmt = db.prepare('SELECT * FROM user_onboarding_tour WHERE user_id = ? LIMIT 1');
  stmt.bind([canonicalId]);
  let row: any = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();

  if (!row) {
    const now = new Date().toISOString();
    db.run(
      `INSERT OR IGNORE INTO user_onboarding_tour (
        user_id, current_step, step1_done, step2_done, step3_done, step4_done,
        tour_completed, dismissed, selected_channel_id, created_post_id, created_scenario_id, updated_at
      ) VALUES (?, 1, 0, 0, 0, 0, 0, 0, '', '', '', ?)`,
      [canonicalId, now]
    );
    saveDatabaseToDisk();
    return {
      userId: canonicalId,
      currentStep: 1,
      step1Done: false,
      step2Done: false,
      step3Done: false,
      step4Done: false,
      tourCompleted: false,
      dismissed: false,
      selectedChannelId: '',
      createdPostId: '',
      createdScenarioId: '',
      updatedAt: now
    };
  }

  return {
    userId: String(row.user_id),
    currentStep: Math.min(5, Math.max(1, Number(row.current_step || 1))),
    step1Done: Boolean(row.step1_done),
    step2Done: Boolean(row.step2_done),
    step3Done: Boolean(row.step3_done),
    step4Done: Boolean(row.step4_done),
    tourCompleted: Boolean(row.tour_completed),
    dismissed: Boolean(row.dismissed),
    selectedChannelId: String(row.selected_channel_id || ''),
    createdPostId: String(row.created_post_id || ''),
    createdScenarioId: String(row.created_scenario_id || ''),
    updatedAt: String(row.updated_at || new Date().toISOString())
  };
}

function resolveUserSnapshot(db: any, rawUserId: string) {
  const cleanId = format11DigitUserId(rawUserId);
  const tgNum = parseInt(rawUserId, 10) || 0;

  const stmt = db.prepare(
    'SELECT id, email, password_hash, telegram_id, username, first_name, last_name, balance, tariff FROM users WHERE id = ? OR telegram_id = ? LIMIT 1'
  );
  stmt.bind([cleanId, tgNum]);
  let sqlUser: any = null;
  if (stmt.step()) {
    sqlUser = stmt.getAsObject();
  }
  stmt.free();

  const legacyUser =
    DB.getUserById(rawUserId) ||
    DB.getUserById(cleanId) ||
    (tgNum > 0 ? DB.getUserByTelegramId(tgNum) : undefined);

  const canonicalId = sqlUser?.id ? String(sqlUser.id) : legacyUser?.id || cleanId;
  const email = String(sqlUser?.email || legacyUser?.email || '').trim();
  const telegramId = Number(sqlUser?.telegram_id || legacyUser?.telegramId || 0);
  const username = String(sqlUser?.username || legacyUser?.username || '').trim();
  const balance =
    sqlUser?.balance !== undefined && sqlUser?.balance !== null
      ? Number(sqlUser.balance)
      : Number(legacyUser?.balance ?? 300);
  const tariff = String(sqlUser?.tariff || (legacyUser as any)?.tariff || 'Старт');

  // Check granted bonuses in transactions
  let startEmailGranted = false;
  let startTmaGranted = false;
  try {
    const txStmt = db.prepare(
      "SELECT type FROM transactions WHERE user_id = ? AND type IN ('start_email', 'start_tma')"
    );
    txStmt.bind([canonicalId]);
    while (txStmt.step()) {
      const r = txStmt.getAsObject() as any;
      if (r.type === 'start_email') startEmailGranted = true;
      if (r.type === 'start_tma') startTmaGranted = true;
    }
    txStmt.free();
  } catch {}

  const allowedChannels = getUserAllowedChannelsFromDb(canonicalId);
  const userDrafts = DB.getDayRequests(canonicalId);
  const userPublications = DB.getPublications().filter(
    (p) => String(p.userId || '') === canonicalId || (telegramId > 0 && String(p.userId || '') === String(telegramId))
  );

  let sqlPostsCount = 0;
  try {
    const pRes = db.exec('SELECT COUNT(*) FROM posts WHERE user_id = ? OR user_id = ?', [
      canonicalId,
      String(telegramId || canonicalId)
    ]);
    if (pRes[0]?.values?.[0]?.[0] !== undefined) {
      sqlPostsCount = Number(pRes[0].values[0][0]) || 0;
    }
  } catch {}

  const postsCount = Math.max(userDrafts.length, userPublications.length, sqlPostsCount);

  let sceneriesSqlCount = 0;
  try {
    const scRes = db.exec(
      'SELECT COUNT(*) FROM sceneries WHERE user_id = ? OR user_id = ?',
      [canonicalId, String(telegramId || canonicalId)]
    );
    if (scRes[0]?.values?.[0]?.[0] !== undefined) {
      sceneriesSqlCount = Number(scRes[0].values[0][0]) || 0;
    }
  } catch {}

  let memoryScenariosCount = 0;
  try {
    memoryScenariosCount = DB.getScenarios().filter(
      (s) =>
        String(s.userId || '') === canonicalId ||
        (telegramId > 0 && String(s.userId || '') === String(telegramId))
    ).length;
  } catch {}

  const scenariosCount = Math.max(
    sceneriesSqlCount,
    memoryScenariosCount
  );

  const isRegistered = Boolean(sqlUser || legacyUser || email || telegramId > 0);

  return {
    canonicalId,
    sqlUser,
    legacyUser,
    isRegistered,
    hasEmail: Boolean(email),
    hasTelegram: telegramId > 0,
    email,
    telegramId: telegramId > 0 ? telegramId : undefined,
    username,
    balance,
    tariff,
    startEmailGranted,
    startTmaGranted,
    channelsCount: allowedChannels.length,
    firstChannelId: allowedChannels[0]?.id ? String(allowedChannels[0].id) : '',
    postsCount,
    scenariosCount
  };
}

function reconcileEffectiveOnboardingState(
  db: any,
  rawState: UserOnboardingStateRecord,
  snapshot: ReturnType<typeof resolveUserSnapshot>
): UserOnboardingStateRecord {
  const step1Done = Boolean(
    rawState.step1Done || snapshot.isRegistered || snapshot.hasEmail || snapshot.hasTelegram
  );
  const step2Done = Boolean(rawState.step2Done || snapshot.channelsCount > 0);
  const step3Done = Boolean(
    rawState.step3Done || Boolean(rawState.createdPostId) || snapshot.postsCount > 0
  );
  const step4Done = Boolean(
    rawState.step4Done || Boolean(rawState.createdScenarioId) || snapshot.scenariosCount > 0
  );
  const allFourDone = step1Done && step2Done && step3Done && step4Done;
  const tourCompleted = Boolean(rawState.tourCompleted || allFourDone);

  let derivedCurrentStep = rawState.currentStep;
  if (allFourDone) {
    derivedCurrentStep = 5;
  } else if (!step1Done) {
    derivedCurrentStep = Math.max(derivedCurrentStep, 1);
  } else if (!step2Done && derivedCurrentStep < 2) {
    derivedCurrentStep = 2;
  } else if (step1Done && step2Done && !step3Done && derivedCurrentStep < 3) {
    derivedCurrentStep = 3;
  } else if (step1Done && step2Done && step3Done && !step4Done && derivedCurrentStep < 4) {
    derivedCurrentStep = 4;
  }

  const selectedChannelId = rawState.selectedChannelId || snapshot.firstChannelId || '';

  const changed =
    step1Done !== rawState.step1Done ||
    step2Done !== rawState.step2Done ||
    step3Done !== rawState.step3Done ||
    step4Done !== rawState.step4Done ||
    tourCompleted !== rawState.tourCompleted ||
    derivedCurrentStep !== rawState.currentStep ||
    selectedChannelId !== rawState.selectedChannelId;

  const updated: UserOnboardingStateRecord = {
    ...rawState,
    currentStep: derivedCurrentStep,
    step1Done,
    step2Done,
    step3Done,
    step4Done,
    tourCompleted,
    selectedChannelId,
    updatedAt: changed ? new Date().toISOString() : rawState.updatedAt
  };

  if (changed) {
    try {
      db.run(
        `UPDATE user_onboarding_tour
         SET current_step = ?,
             step1_done = ?,
             step2_done = ?,
             step3_done = ?,
             step4_done = ?,
             tour_completed = ?,
             selected_channel_id = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          updated.currentStep,
          updated.step1Done ? 1 : 0,
          updated.step2Done ? 1 : 0,
          updated.step3Done ? 1 : 0,
          updated.step4Done ? 1 : 0,
          updated.tourCompleted ? 1 : 0,
          updated.selectedChannelId,
          updated.updatedAt,
          updated.userId
        ]
      );
      saveDatabaseToDisk();
    } catch {}
  }

  return updated;
}

export function registerOnboardingRoutes(app: Express): void {
  ensureOnboardingTable()
    .then(() => saveDatabaseToDisk())
    .catch((err) => {
      console.warn('[OnboardingTour] Failed to init table:', err?.message);
    });

  // Get onboarding state + live account/bonus status
  app.get('/api/onboarding/state', async (req: Request, res: Response) => {
    try {
      const rawUserId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
      if (!rawUserId) {
        res.status(400).json({ error: 'Не указан идентификатор пользователя' });
        return;
      }

      const db = await ensureOnboardingTable();
      const snapshot = resolveUserSnapshot(db, rawUserId);
      const rawState = readOnboardingRow(db, snapshot.canonicalId);
      const state = reconcileEffectiveOnboardingState(db, rawState, snapshot);

      res.json({
        success: true,
        state,
        account: {
          userId: snapshot.canonicalId,
          hasEmail: snapshot.hasEmail,
          hasTelegram: snapshot.hasTelegram,
          email: snapshot.email,
          telegramId: snapshot.telegramId,
          username: snapshot.username,
          balance: snapshot.balance,
          tariff: snapshot.tariff,
          startEmailGranted: snapshot.startEmailGranted,
          startTmaGranted: snapshot.startTmaGranted,
          channelsCount: snapshot.channelsCount,
          postsCount: snapshot.postsCount,
          scenariosCount: snapshot.scenariosCount
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Ошибка чтения прогресса вводного тура' });
    }
  });

  // Save onboarding state progress
  app.post('/api/onboarding/state', async (req: Request, res: Response) => {
    try {
      const rawUserId = String(req.body?.userId || req.headers['x-user-id'] || '').trim();
      if (!rawUserId) {
        res.status(400).json({ error: 'Не указан идентификатор пользователя' });
        return;
      }

      const db = await ensureOnboardingTable();
      const snapshot = resolveUserSnapshot(db, rawUserId);
      const prev = readOnboardingRow(db, snapshot.canonicalId);

      const next: UserOnboardingStateRecord = {
        userId: snapshot.canonicalId,
        currentStep:
          req.body?.currentStep !== undefined
            ? Math.min(5, Math.max(1, Number(req.body.currentStep) || 1))
            : prev.currentStep,
        step1Done: req.body?.step1Done !== undefined ? Boolean(req.body.step1Done) : prev.step1Done,
        step2Done: req.body?.step2Done !== undefined ? Boolean(req.body.step2Done) : prev.step2Done,
        step3Done: req.body?.step3Done !== undefined ? Boolean(req.body.step3Done) : prev.step3Done,
        step4Done: req.body?.step4Done !== undefined ? Boolean(req.body.step4Done) : prev.step4Done,
        tourCompleted:
          req.body?.tourCompleted !== undefined ? Boolean(req.body.tourCompleted) : prev.tourCompleted,
        dismissed: req.body?.dismissed !== undefined ? Boolean(req.body.dismissed) : prev.dismissed,
        selectedChannelId:
          req.body?.selectedChannelId !== undefined
            ? String(req.body.selectedChannelId || '')
            : prev.selectedChannelId,
        createdPostId:
          req.body?.createdPostId !== undefined
            ? String(req.body.createdPostId || '')
            : prev.createdPostId,
        createdScenarioId:
          req.body?.createdScenarioId !== undefined
            ? String(req.body.createdScenarioId || '')
            : prev.createdScenarioId,
        updatedAt: new Date().toISOString()
      };

      db.run(
        `INSERT INTO user_onboarding_tour (
          user_id, current_step, step1_done, step2_done, step3_done, step4_done,
          tour_completed, dismissed, selected_channel_id, created_post_id, created_scenario_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          current_step = excluded.current_step,
          step1_done = excluded.step1_done,
          step2_done = excluded.step2_done,
          step3_done = excluded.step3_done,
          step4_done = excluded.step4_done,
          tour_completed = excluded.tour_completed,
          dismissed = excluded.dismissed,
          selected_channel_id = excluded.selected_channel_id,
          created_post_id = excluded.created_post_id,
          created_scenario_id = excluded.created_scenario_id,
          updated_at = excluded.updated_at`,
        [
          next.userId,
          next.currentStep,
          next.step1Done ? 1 : 0,
          next.step2Done ? 1 : 0,
          next.step3Done ? 1 : 0,
          next.step4Done ? 1 : 0,
          next.tourCompleted ? 1 : 0,
          next.dismissed ? 1 : 0,
          next.selectedChannelId,
          next.createdPostId,
          next.createdScenarioId,
          next.updatedAt
        ]
      );

      saveDatabaseToDisk();

      const freshSnapshot = resolveUserSnapshot(db, snapshot.canonicalId);
      const reconciledNext = reconcileEffectiveOnboardingState(db, next, freshSnapshot);
      res.json({
        success: true,
        state: reconciledNext,
        account: {
          userId: freshSnapshot.canonicalId,
          hasEmail: freshSnapshot.hasEmail,
          hasTelegram: freshSnapshot.hasTelegram,
          email: freshSnapshot.email,
          telegramId: freshSnapshot.telegramId,
          username: freshSnapshot.username,
          balance: freshSnapshot.balance,
          tariff: freshSnapshot.tariff,
          startEmailGranted: freshSnapshot.startEmailGranted,
          startTmaGranted: freshSnapshot.startTmaGranted,
          channelsCount: freshSnapshot.channelsCount,
          postsCount: freshSnapshot.postsCount,
          scenariosCount: freshSnapshot.scenariosCount
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Ошибка сохранения шага вводного тура' });
    }
  });

  // Step 1 action: link Email (+300 Iirki) or link Telegram (+300 Iirki) or stay on Email
  app.post('/api/onboarding/link-contact', async (req: Request, res: Response) => {
    try {
      const rawUserId = String(req.body?.userId || req.headers['x-user-id'] || '').trim();
      const mode = String(req.body?.mode || '').trim() as 'email' | 'telegram' | 'stay_email';

      if (!rawUserId) {
        res.status(400).json({ error: 'Не указан пользователь' });
        return;
      }

      const db = await ensureOnboardingTable();
      const snapshot = resolveUserSnapshot(db, rawUserId);
      const canonicalId = snapshot.canonicalId;

      if (mode === 'stay_email') {
        const prev = readOnboardingRow(db, canonicalId);
        db.run(
          `UPDATE user_onboarding_tour SET step1_done = 1, current_step = ?, updated_at = ? WHERE user_id = ?`,
          [Math.max(2, prev.currentStep), new Date().toISOString(), canonicalId]
        );
        saveDatabaseToDisk();
        res.json({
          success: true,
          bonusApplied: false,
          bonusAmount: 0,
          message: 'Продолжаем работу с привязанной почтой. Привязать Telegram можно в любой момент.'
        });
        return;
      }

      if (mode === 'email') {
        const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
        const rawPassword = String(req.body?.password || '').trim();

        if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
          res.status(400).json({ error: 'Введите корректный адрес электронной почты' });
          return;
        }
        if (rawPassword.length < 4) {
          res.status(400).json({ error: 'Пароль должен содержать минимум 4 символа' });
          return;
        }

        const existingLegacy = DB.getUserByEmail(cleanEmail);
        if (existingLegacy && existingLegacy.id !== canonicalId && existingLegacy.id !== rawUserId) {
          res.status(409).json({
            error: 'Эта почта уже привязана к другому аккаунту. Укажите другой адрес почты.'
          });
          return;
        }

        const dupCheck = db.exec(
          'SELECT id FROM users WHERE LOWER(email) = ? AND id != ? LIMIT 1',
          [cleanEmail, canonicalId]
        );
        if (dupCheck[0]?.values?.length) {
          res.status(409).json({
            error: 'Эта почта уже используется в другом профиле.'
          });
          return;
        }

        const pwdHash = hashPasswordSha256(rawPassword);

        // Ensure PostgreSQL row exists before updating
        if (!snapshot.sqlUser) {
          db.run(
            `INSERT OR IGNORE INTO users (id, email, password_hash, telegram_id, username, first_name, balance, tariff, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              canonicalId,
              cleanEmail,
              pwdHash,
              snapshot.telegramId || null,
              snapshot.username || cleanEmail.split('@')[0],
              snapshot.legacyUser?.firstName || cleanEmail.split('@')[0],
              snapshot.balance,
              snapshot.tariff,
              new Date().toISOString()
            ]
          );
        } else {
          db.run('UPDATE users SET email = ?, password_hash = ? WHERE id = ?', [
            cleanEmail,
            pwdHash,
            canonicalId
          ]);
        }

        try {
          if (snapshot.legacyUser) {
            DB.updateUser(snapshot.legacyUser.id, {
              email: cleanEmail,
              passwordHash: pwdHash
            });
          }
        } catch {}

        const bonusRes = checkAndApplyStartRegistrationBonus(db, canonicalId, 'email');
        const updatedSnap = resolveUserSnapshot(db, canonicalId);

        try {
          if (snapshot.legacyUser) {
            DB.updateUser(snapshot.legacyUser.id, {
              email: cleanEmail,
              passwordHash: pwdHash,
              balance: updatedSnap.balance
            });
          }
        } catch {}

        const prevTour = readOnboardingRow(db, canonicalId);
        db.run(
          `UPDATE user_onboarding_tour SET step1_done = 1, current_step = ?, updated_at = ? WHERE user_id = ?`,
          [Math.max(2, prevTour.currentStep), new Date().toISOString(), canonicalId]
        );

        await ensureUserJoinedIismmChat(canonicalId, { clearLeftStatus: true, db });
        saveDatabaseToDisk();

        res.json({
          success: true,
          bonusApplied: bonusRes.applied,
          bonusAmount: bonusRes.applied ? 300 : 0,
          balance: updatedSnap.balance,
          email: cleanEmail,
          message: bonusRes.applied
            ? 'Почта успешно привязана! На ваш баланс начислено +300 Иирок.'
            : 'Почта успешно сохранена в вашем профиле.'
        });
        return;
      }

      if (mode === 'telegram') {
        const result = await linkTelegramAccountByIdWithVerification({
          rawUserId,
          rawTelegramId: String(req.body?.telegramId || ''),
          password: String(req.body?.password || ''),
          confirmPassword: String(req.body?.confirmPassword || '')
        });

        if (!result.ok) {
          res.status(result.status || 400).json({ error: result.error });
          return;
        }

        const prevTour = readOnboardingRow(db, canonicalId);
        db.run(
          `UPDATE user_onboarding_tour SET step1_done = 1, current_step = ?, updated_at = ? WHERE user_id = ?`,
          [Math.max(2, prevTour.currentStep), new Date().toISOString(), canonicalId]
        );
        saveDatabaseToDisk();

        res.json({
          success: true,
          bonusApplied: result.bonusApplied,
          bonusAmount: result.bonusAmount,
          balance: result.balance,
          telegramId: result.telegramId,
          username: result.username,
          firstName: result.firstName,
          lastName: result.lastName,
          bio: result.bio,
          photoUrl: result.photoUrl,
          message: result.message
        });
        return;
      }

      res.status(400).json({ error: 'Неизвестный режим привязки контакта' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Ошибка привязки контакта' });
    }
  });

  // Dedicated endpoint for linking Telegram account by ID from Profile cabinet (3rd registration/link method)
  app.post('/api/account/link-telegram-by-id', async (req: Request, res: Response) => {
    try {
      const rawUserId = String(req.body?.userId || req.headers['x-user-id'] || '').trim();
      const result = await linkTelegramAccountByIdWithVerification({
        rawUserId,
        rawTelegramId: String(req.body?.telegramId || ''),
        password: String(req.body?.password || ''),
        confirmPassword: String(req.body?.confirmPassword || '')
      });

      if (!result.ok) {
        res.status(result.status || 400).json({ error: result.error });
        return;
      }

      try {
        const db = await ensureOnboardingTable();
        const prevTour = readOnboardingRow(db, format11DigitUserId(rawUserId));
        db.run(
          `UPDATE user_onboarding_tour SET step1_done = 1, current_step = ?, updated_at = ? WHERE user_id = ?`,
          [Math.max(2, prevTour.currentStep), new Date().toISOString(), prevTour.userId]
        );
        saveDatabaseToDisk();
      } catch {}

      res.json({
        success: true,
        bonusApplied: result.bonusApplied,
        bonusAmount: result.bonusAmount,
        balance: result.balance,
        telegramId: result.telegramId,
        username: result.username,
        firstName: result.firstName,
        lastName: result.lastName,
        bio: result.bio,
        photoUrl: result.photoUrl,
        message: result.message
      });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Ошибка при привязке аккаунта Telegram по идентификатору'
      });
    }
  });
}
