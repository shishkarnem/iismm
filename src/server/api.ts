import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import FormData from 'form-data';
import nodemailer from 'nodemailer';
import { DB, Prompt, DayRequest, Publication, Settings, User, Channel, getDefaultChannelIdentifier, detectMessageFormat } from './db';

const uploadMiddleware = multer({ storage: multer.memoryStorage() });
import { 
  generateProkhorPrompt, 
  generateImagePromptFromPost, 
  generateProTalkImage, 
  callProTalkBotApi, 
  generateTopicFromHistory, 
  runProTalkModeratorForMessage, 
  runProTalkModeratorForComment, 
  runProTalkModeratorForReview,
  callProTalkFunction621,
  analyzeChannelStyleFromPosts,
  generateNeuroplanTopics,
  removeMarkdownEscaping
} from './protalk';
import {
  sendPromptToTelegram,
  sendPrivateTelegramNotification,
  convertAudioToTelegramVoice,
  getTelegramBotConfig
} from './telegram';
import { fetchTelegramBotApi, fetchTelegramBotFileBuffer } from './telegram/apiEndpointFallback';
import { getScenarioByIdFromDb } from './db/sceneriesTable';
import { ensureUserJoinedIismmChat } from './social/autoJoinGroupService';
import { 
  getAllTablesInfo, getTableRows, insertRow, updateRow, deleteRow, deleteRows, executeRawSQL, importCSVRows, syncAllTablesFromCloud,
  fetchAllBlogPostsFromPg, fetchBlogPostByIdFromPg, fetchBlogPostBySlugOrIdFromPg,
  createBlogPostInPg, updateBlogPostInPg, deleteBlogPostFromPg,
  incrementBlogPostViewsInPg, incrementBlogPostLikesInPg, incrementBlogPostSharesInPg,
  getBotTokenFromPg, getBotDetailsFromPg,
  DEFAULT_TOKEN, getGalleryUploadTokenFromPg,
  getPgDB, fetchAllUsersFromPg, savePgDB, flushPendingPgWrites, refreshTableCacheFromCloud, normalizeUserId,
  fetchCommentsForPostFromPg, addCommentToPostInPg,
  fetchReactionsForPostFromPg, toggleReactionForPostInPg,
  getSubscriptionsFromPg, addSubscriptionInPg, removeSubscriptionInPg, isSubscribedInPg, getSubscribersCountFromPg,
  getUserChatsFromPg, createOrGetDirectChatInPg, createGroupChatInPg,
  searchUsersInPg, getAuthorsCatalogFromPg,
  getGroupChatByIdFromPg, updateGroupChatInPg, leaveGroupChatInPg,
  leavePersonalChatInPg, toggleBlockPersonalChatInPg, getPersonalChatStatusFromPg,
  getChatMessagesFromPg, saveChatMessageToPg,
  getUserAutoRespondersFromPg, saveUserAutoResponderToPg,
  updateUserLastSeenInPg, getUserLastSeenFromPg,
  fetchAllLandingReviewsFromPg, addLandingReviewToPg, deleteLandingReviewFromPg
} from './db/postgres';
import { getAllTariffsFromDb, getAllTariffsAdminFromDb, getTariffById, createOrUpdateTariffInDb, deleteTariffFromDb } from './db/tariffsTable';
import { getPricingConfig } from './pricing/pricingService';
import { registerPricingRoutes } from './pricing/pricingRoutes';
import { computeTopupIirkyAmount, formatIirkyCount } from '../shared/pricingConfig';
import { getUserByIdFromDb, getUserByTelegramIdFromDb, insertOrUpdateUserInDb, checkAndSyncReferralTransactions, reconcileAllUserBalancesFromTransactions, checkAndApplyStartRegistrationBonus } from './db/usersTable';
import { getUserNotificationsFromDb, markNotificationAsReadInDb, markAllNotificationsAsReadInDb, createNotificationInDb } from './db/notificationsTable';
import { addTransactionWithBalanceUpdate, getUserTransactionsFromDb, getAllTransactionsFromDb } from './db/transactionsTable';
import { ServerTariffLevel, resolveUserTariffInDb, checkTariffPermission } from './tariffs/tariffAccess';
import { changeUserTariffInDb, setAutoRenewTariffInDb } from './tariffs/tariffLifecycle';
import { getAllSystemConfigsFromDb, getSystemConfigByDomainFromDb, updateSystemConfigInDb } from './payments/systemConfigsDb';
import {
  extractDomainFromRequest,
  createRobokassaPaymentLink,
  processRobokassaResultCallback,
  verifyRobokassaSuccessRedirect,
  triggerRobokassaRecurringCharge
} from './payments/robokassaService';
import {
  RECURRING_CONSENT_TEXT,
  recordRecurringConsentInDb,
  revokeUserRecurringConsentsInDb,
  getUserRecurringConsentsFromDb
} from './payments/recurringConsentsDb';
import {
  generateAiReplyForReview,
  updateLandingReviewRepliesInDb
} from './reviews/reviewService';
import { 
  ensureDefaultFoldersForUser, getFoldersForUser, registerFileInStorage,
  getStorageFilesForUser, slugifyFilename, fixUtf8Filename
} from './db/filesTable';
import { 
  getTeamsByOwnerOrMember, seedDefaultTeams, addMemberToTeamInDb, 
  removeMemberFromTeamInDb, TeamMember, createTeamInDb, updateTeamInDb, 
  deleteTeamInDb, getAllTeamsFromDb, getTeamById, TeamRecord,
  findUserInDb, syncTeamChannelsFromDb 
} from './db/teamsTable';
import { syncScheduledPublicationsForPost, renewAllActiveSchedules } from './scheduleGenerator';
import {
  isOneOffScheduleFrequency,
  isPublishedPostStatus,
  normalizePostStatus,
  parseScheduleDateTimeInTimezone,
  parseTriggerScheduleSafe
} from './domains/posts/postStatusHelpers';
import * as crypto from 'crypto';
import { promoRouter } from './promoApi';
import { promoArchiveRouter } from './promoArchiveApi';
import {
  ensureChannelAvatarInGallery,
  ensureUserTelegramAvatarInGallery,
  expandShortGalleryUrlToFull,
  isFullGalleryDirectUrl,
  uploadImageBufferToGallery
} from './channelAvatarService';
import { handleUnifiedImageGeneration } from './imageBuilderService';
import {
  planCascadingCarouselPrompts,
  executeCascadingCarouselGeneration
} from './image-gen/cascadingCarouselService';
import {
  executeScenarioTestAndPersist,
  getScenarioTestResultsFromPg
} from './scenarios/runners/scenarioTesting';
import { runFullScenarioGraphExecution } from './scenarios/scenarioGraphRunner';
import {
  syncScenarioCronEntry,
  removeScenarioCronEntry,
  resolveFreshScheduledPublicationPayload,
  sharedScheduledPubLock
} from './scenarios/scenarioCronSync';
import { generateInlineButtonsFromPost1Iirka } from './scenarios/scenarioAiHelpers';
import { parseScheduleWithAi1Iirka } from './scenarios/schedule/aiScheduleParser';
import { executeIirkaScenarioAssistant } from './scenarios/runners/assistant/iirkaScenarioHandler';
import { createUnbufferedStreamWriter } from './scenarios/live/liveScenarioRoutes';
import { upsertUserPostStyleInDb } from './scenarios/styling/postStylesDb';
import {
  combineSystemAndUserPrompt,
  createScenarioPromptInDb,
  getRequiredScenarioPrompt,
  invalidateScenarioPromptsCache,
  listAllScenarioPromptsFromDb,
  renderPromptTemplate,
  resetScenarioPromptInDb,
  seedMissingScenarioPromptsInDb,
  updateScenarioPromptInDb
} from './scenarios/prompts/scenarioPromptsRepo';
import { SystemPromptsDomain } from './domains/settings/systemPromptsDomain';
import { registerAcademyRoutes } from './academy/academyRoutes';
import { registerConsultantRoutes } from './consultant/consultantRoutes';
import { registerPostgresBackupRoutes } from './pg/backup/backupAdminRoutes';
import {
  buildJsonBackupBuffer,
  buildPostgresSqlDumpBuffer,
  collectFullPostgresSnapshot,
  collectSingleTableSnapshot
} from './pg/backup/formatsSqlAndJson';
import { buildCsvBackupBuffer, escapeCsvCell, parseRfc4180Csv } from './pg/backup/formatsNdjsonAndCsv';
import { restorePostgresFromBackupPayload } from './pg/backup/restoreService';
import { createProTalkSnapshot } from './pg/client/protalkPlatformApi';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import { pushRouter } from './push/pushRoutes';

export const apiRouter = Router();
apiRouter.use(promoRouter);
apiRouter.use(promoArchiveRouter);
apiRouter.use('/push', pushRouter);
registerAcademyRoutes(apiRouter);
registerConsultantRoutes(apiRouter);
registerPostgresBackupRoutes(apiRouter);

/**
 * Automatically syncs published posts to user's Social Network profile/wall & Public Blog
 */
export function syncToSocialNetworkFeed(params: {
  sourcePostId?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  title: string;
  content: string;
  attachmentType?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
  inlineButtons?: any[];
  messageFormat?: string;
  category?: string;
  channel?: string;
  prompt?: string;
}) {
  try {
    const user = params.userId ? DB.getUsers().find(u => u.id === params.userId) : null;
    const authorName = params.userName || user?.name || user?.username || 'Команда ИИSMM (@IIrkiBot)';
    const authorAvatar =
      normalizeProTalkMediaUrl(params.userAvatar || user?.avatarUrl) ||
      BRAND_ASSETS.heartAvatar;
    const authorRole = user?.role || 'Пользователь';
    
    const created = createBlogPostInPg({
      sourcePostId: params.sourcePostId,
      userId: params.userId,
      title: params.title || 'Новая публикация',
      desc: params.prompt || (params.content ? params.content.slice(0, 150) + '...' : ''),
      content: params.content,
      category: params.category || 'news',
      format: params.attachmentType === 'video' ? 'video' : (params.attachmentType === 'album' ? 'gallery' : (params.attachmentType === 'photo' ? 'photo' : 'article')),
      attachmentType: params.attachmentType || 'none',
      attachmentUrl: params.attachmentUrl,
      attachmentUrls: params.attachmentUrls,
      inlineButtons: params.inlineButtons,
      messageFormat: params.messageFormat || 'rich',
      tag: params.channel ? `Канал ${params.channel}` : 'Telegram',
      dateStr: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      author: {
        name: authorName,
        avatar: authorAvatar,
        role: authorRole
      },
      image: params.attachmentUrl || (params.attachmentUrls && params.attachmentUrls[0]),
      album: params.attachmentUrls && params.attachmentUrls.length > 1 ? params.attachmentUrls.map((url, i) => ({ id: `img_${i}`, url, caption: '' })) : undefined
    });
    console.log(`[Social Feed & Blog] Post "${params.title}" published! Slug: /posts/${created?.slug || created?.id}`);
    return created;
  } catch (err) {
    console.error('[Social Feed Sync Error]:', err);
    return null;
  }
}

// ==========================================
// BLOG POSTS & SOCIAL FEED POSTGRESQL PROTALK API ENDPOINTS
// ==========================================

apiRouter.get('/blog/posts', (req: Request, res: Response) => {
  try {
    const tab = req.query.tab as 'recommendations' | 'yours' | 'new' | undefined;
    const userId = req.query.userId as string | undefined;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const search = (req.query.search as string || '').toLowerCase().trim();

    // Fetch all matching posts first
    let allPosts = fetchAllBlogPostsFromPg({ tab, userId });

    if (search) {
      allPosts = allPosts.filter(p => 
        (p.title && p.title.toLowerCase().includes(search)) ||
        (p.content && p.content.toLowerCase().includes(search)) ||
        (p.author?.name && p.author.name.toLowerCase().includes(search)) ||
        (p.tag && p.tag.toLowerCase().includes(search))
      );
    }

    const totalCount = allPosts.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const offset = (page - 1) * limit;
    const paginatedPosts = allPosts.slice(offset, offset + limit);

    res.json({
      success: true,
      posts: paginatedPosts,
      totalCount,
      page,
      totalPages,
      limit
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при получении постов из PostgreSQL DB: ' + err.message });
  }
});

apiRouter.get('/blog/posts/:slugOrId', (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const post = fetchBlogPostBySlugOrIdFromPg(req.params.slugOrId, userId);
    if (!post) {
      res.status(404).json({ success: false, error: 'Публикация не найдена' });
      return;
    }
    // Increment view count
    incrementBlogPostViewsInPg(req.params.slugOrId);
    res.json({ success: true, post });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения поста: ' + err.message });
  }
});

apiRouter.post('/blog/posts', (req: Request, res: Response) => {
  try {
    const post = createBlogPostInPg(req.body);
    res.json({ success: true, post });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка создания поста в PostgreSQL: ' + err.message });
  }
});

// Comments API (Registered and Anonymous users + nested replies)
apiRouter.get('/blog/posts/:slugOrId/comments', (req: Request, res: Response) => {
  try {
    const comments = fetchCommentsForPostFromPg(req.params.slugOrId);
    res.json({ success: true, comments });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка загрузки комментариев: ' + err.message });
  }
});

apiRouter.post('/blog/posts/:slugOrId/comments', async (req: Request, res: Response) => {
  try {
    const { text, authorName, authorAvatar, authorUserId, authorUsername, parentCommentId, audioUrl, audio_url } = req.body;
    
    const effectiveAuthorName = (authorName || '').trim();
    if (!effectiveAuthorName) {
      res.status(400).json({ success: false, error: 'Пожалуйста, укажите ваше имя' });
      return;
    }

    const effectiveText = (text || '').trim();
    const effectiveAudioUrl = audioUrl || audio_url || null;

    if (!effectiveText && !effectiveAudioUrl) {
      res.status(400).json({ success: false, error: 'Текст комментария или голосовое сообщение обязательно' });
      return;
    }

    // Function 763 AI Moderation for comments
    try {
      const modResult = await runProTalkModeratorForComment({
        text: effectiveText || 'Голосовой комментарий',
        authorUserId: authorUserId ? String(authorUserId) : 'guest',
        postId: req.params.slugOrId,
        authorName: effectiveAuthorName
      });
      if (!modResult.ok) {
        res.status(400).json({
          success: false,
          error: 'Комментарий отклонен модерацией ИИ (Функция 763): обнаружены недопустимые выражения или нарушения правил сообщества',
          violation: true
        });
        return;
      }
    } catch (modErr) {
      console.warn('Comment moderation warning:', modErr);
    }

    // Register voice comment in gallery database
    if (effectiveAudioUrl && typeof effectiveAudioUrl === 'string' && (effectiveAudioUrl.startsWith('http') || effectiveAudioUrl.startsWith('/uploads') || effectiveAudioUrl.startsWith('/file/'))) {
      try {
        const db = await getPgDB();
        const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        registerFileInStorage(db, {
          userId: authorUserId ? String(authorUserId) : 'admin',
          name: `Голосовой комментарий (${effectiveAuthorName}).webm`,
          originalUrl: effectiveAudioUrl,
          mimeType: 'audio/webm',
          hostProtocol: { host, protocol }
        });
        savePgDB();
      } catch (gErr) {
        console.warn('Gallery save warning for comment audio:', gErr);
      }
    }

    const comment = addCommentToPostInPg({
      postId: req.params.slugOrId,
      parentCommentId: parentCommentId || null,
      authorName: effectiveAuthorName,
      authorAvatar: authorAvatar || undefined,
      authorUserId: authorUserId ? String(authorUserId) : undefined,
      authorUsername: authorUsername || undefined,
      text: effectiveText || '🎤 Голосовой комментарий',
      audioUrl: effectiveAudioUrl || undefined
    });

    res.json({ success: true, comment });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка добавления комментария: ' + err.message });
  }
});

// Reactions API (Likes, Love, Fire, Haha, Wow)
apiRouter.post('/blog/posts/:slugOrId/reactions', (req: Request, res: Response) => {
  try {
    const { reactionType = 'like', userId } = req.body;
    const effectiveUserId = userId || req.headers['x-client-id'] || 'guest_' + req.ip;

    const result = toggleReactionForPostInPg(req.params.slugOrId, String(effectiveUserId), String(reactionType));
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка обновления реакции: ' + err.message });
  }
});

// Direct sync/publish to public blog from editor
apiRouter.post('/blog/sync', (req: Request, res: Response) => {
  try {
    const created = syncToSocialNetworkFeed(req.body);
    if (!created) {
      res.status(500).json({ success: false, error: 'Не удалось синхронизировать публикацию' });
      return;
    }
    res.json({ success: true, post: created, url: `/posts/${created.slug || created.id}` });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка синхронизации: ' + err.message });
  }
});

apiRouter.put('/blog/posts/:id', (req: Request, res: Response) => {
  try {
    const updated = updateBlogPostInPg(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Пост не найден' });
      return;
    }
    res.json({ success: true, post: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка обновления поста в PostgreSQL: ' + err.message });
  }
});

apiRouter.delete('/blog/posts/:id', async (req: Request, res: Response) => {
  try {
    const rawUserId = (req.headers['x-user-id'] as string) || (req.query.userId as string) || (req.body && req.body.userId) || '';
    const cleanUid = normalizeUserId(rawUserId);

    // Retrieve post from PostgreSQL to check author ownership
    const post = fetchBlogPostByIdFromPg(req.params.id);
    if (!post) {
      res.json({ success: true, message: 'Пост уже удален или не найден' });
      return;
    }

    const postAuthorUid = normalizeUserId(post.userId || post.authorUserId || (post.author && post.author.id) || '');
    
    // Check if user is admin
    let isAdmin = cleanUid === '16926299042' || cleanUid === '169262990';
    if (!isAdmin && cleanUid) {
      try {
        const db = await getPgDB();
        const u = getUserByIdFromDb(db, cleanUid) as any;
        if (u) {
          if (u.role === 'admin' || u.role === 'superadmin') isAdmin = true;
          if (u.email === 'airoborent@gmail.com') isAdmin = true;
        }
      } catch (e) {}
    }

    // Only allow deletion if user is author OR admin
    if (cleanUid && postAuthorUid && cleanUid !== postAuthorUid && !isAdmin) {
      res.status(403).json({ error: 'У вас нет прав на удаление этой публикации. Удалять чужие публикации могут только администраторы.' });
      return;
    }

    const success = deleteBlogPostFromPg(req.params.id);
    res.json({ success, deletedBy: isAdmin && cleanUid !== postAuthorUid ? 'admin' : 'author' });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка удаления поста: ' + err.message });
  }
});

// Landing Reviews API with Function 763 Moderation
apiRouter.get('/landing/reviews', (req: Request, res: Response) => {
  try {
    const reviews = fetchAllLandingReviewsFromPg();
    res.json({ success: true, reviews });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка загрузки отзывов: ' + err.message });
  }
});

apiRouter.post('/landing/reviews', async (req: Request, res: Response) => {
  try {
    const { name, rating, text, role, avatar, audio_url, audioUrl } = req.body;
    const effectiveText = (text || '').trim();
    const effectiveAudioUrl = audio_url || audioUrl || null;

    if (!effectiveText && !effectiveAudioUrl) {
      res.status(400).json({ success: false, error: 'Текст отзыва или голосовая запись обязательны' });
      return;
    }

    // AI Moderation via Function 763
    try {
      const modResult = await runProTalkModeratorForReview({
        text: effectiveText || 'Голосовой отзыв',
        name: name || 'Пользователь',
        rating: Number(rating) || 5
      });
      if (!modResult.ok) {
        res.status(400).json({
          success: false,
          error: 'Отзыв отклонен модерацией ИИ (Функция 763): обнаружены спам, реклама или недопустимые выражения',
          violation: true
        });
        return;
      }
    } catch (modErr) {
      console.warn('Review moderation warning:', modErr);
    }

    // Register voice review in gallery database
    if (effectiveAudioUrl && typeof effectiveAudioUrl === 'string' && (effectiveAudioUrl.startsWith('http') || effectiveAudioUrl.startsWith('/uploads') || effectiveAudioUrl.startsWith('/file/'))) {
      try {
        const db = await getPgDB();
        const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        registerFileInStorage(db, {
          userId: 'admin',
          name: `Голосовой отзыв (${(name || '').trim() || 'Пользователь'}).webm`,
          originalUrl: effectiveAudioUrl,
          mimeType: 'audio/webm',
          hostProtocol: { host, protocol }
        });
        savePgDB();
      } catch (gErr) {
        console.warn('Gallery save warning for review audio:', gErr);
      }
    }

    const cleanAuthorName = (name || '').trim() || 'Пользователь платформы';
    const cleanRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const cleanReviewText = effectiveText || '🎤 Голосовой отзыв';

    // Автоматический ответ от ИИ-ассистента платформы на прошедший модерацию отзыв
    const aiReplyText = await generateAiReplyForReview({
      name: cleanAuthorName,
      rating: cleanRating,
      text: cleanReviewText
    });

    const review = addLandingReviewToPg({
      name: cleanAuthorName,
      rating: cleanRating,
      text: cleanReviewText,
      role: (role || '').trim() || 'Пользователь ИИSMM',
      avatar: avatar || '👤',
      audio_url: effectiveAudioUrl || undefined,
      ai_reply: aiReplyText,
      ai_replied_at: new Date().toISOString(),
      moderation_status: 'approved'
    });

    res.json({ success: true, review });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка сохранения отзыва: ' + err.message });
  }
});

apiRouter.post('/landing/reviews/:id/reply', async (req: Request, res: Response) => {
  try {
    const rawUserId = String(req.headers['x-user-id'] || req.body.userId || '');
    const cleanUid = normalizeUserId(rawUserId);
    const db = await getPgDB();
    const caller = cleanUid ? getUserByIdFromDb(db, cleanUid) : null;
    const isAdmin =
      cleanUid === '16926299042' ||
      cleanUid === '169262990' ||
      caller?.role === 'admin' ||
      caller?.role === 'superadmin';

    if (!isAdmin) {
      res.status(403).json({ error: 'Ответы от администратора доступны только администраторам платформы' });
      return;
    }

    const reviewId = String(req.params.id || '').trim();
    const { adminReply, aiReply, regenerateAi } = req.body || {};

    let nextAiReply: string | null | undefined = aiReply;
    if (regenerateAi) {
      const existingRows = fetchAllLandingReviewsFromPg();
      const targetRev = existingRows.find((r: any) => r.id === reviewId);
      if (targetRev) {
        nextAiReply = await generateAiReplyForReview({
          name: targetRev.name || 'Пользователь',
          rating: Number(targetRev.rating) || 5,
          text: targetRev.text || ''
        });
      }
    }

    const updated = updateLandingReviewRepliesInDb(db, reviewId, {
      adminReply: adminReply !== undefined ? String(adminReply) : undefined,
      aiReply: nextAiReply !== undefined ? String(nextAiReply) : undefined
    });
    savePgDB();

    if (!updated) {
      res.status(404).json({ error: 'Отзыв не найден' });
      return;
    }

    res.json({ success: true, review: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка сохранения ответа на отзыв: ' + err.message });
  }
});

apiRouter.delete('/landing/reviews/:id', (req: Request, res: Response) => {
  try {
    const rawUserId = (req.headers['x-user-id'] as string) || '';
    const cleanUid = normalizeUserId(rawUserId);
    const isAdmin = cleanUid === '16926299042' || cleanUid === '169262990';
    if (!isAdmin) {
      res.status(403).json({ error: 'Удаление отзывов доступно только администраторам' });
      return;
    }
    const success = deleteLandingReviewFromPg(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка удаления отзыва: ' + err.message });
  }
});

apiRouter.post('/blog/posts/:id/view', (req: Request, res: Response) => {
  try {
    const views = incrementBlogPostViewsInPg(req.params.id);
    res.json({ success: true, views });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/blog/posts/:id/like', (req: Request, res: Response) => {
  try {
    const likes = incrementBlogPostLikesInPg(req.params.id);
    res.json({ success: true, likes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/blog/posts/:id/repost', (req: Request, res: Response) => {
  try {
    const shares = incrementBlogPostSharesInPg(req.params.id, req.body);
    res.json({ success: true, shares });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/social/posts/:id/repost', (req: Request, res: Response) => {
  try {
    const shares = incrementBlogPostSharesInPg(req.params.id, req.body);
    res.json({ success: true, shares });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SMTP Helper for sending emails (password reset, welcome email)
async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  const host = process.env.SMTP_HOST || 'mail.hosting.reg.ru';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'info@arenda-ropa.com';
  const pass = process.env.SMTP_PASS || 'pass12345';
  const from = process.env.SMTP_FROM || '"ИИSMM" <info@arenda-ropa.com>';

  if (user && pass && pass !== 'pass12345') {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });

    return await transporter.sendMail({
      from,
      to,
      subject,
      text: text || subject,
      html
    });
  } else {
    // Try sending with default auth if user is provided
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
      });

      return await transporter.sendMail({
        from,
        to,
        subject,
        text: text || subject,
        html
      });
    } catch (err) {
      console.log(`[SMTP Email Log] Fallback log for email to ${to}: ${subject}`);
      return { messageId: 'simulated-' + Date.now() };
    }
  }
}

// ==========================================
// ROBOKASSA PRODUCTION PAYMENT ENDPOINTS (STRICTLY FROM POSTGRESQL system_configs)
// ==========================================
apiRouter.get('/payments/robokassa/config', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const detectedDomain = extractDomainFromRequest(req, req.query.domain as string | undefined);
    const activeCfg = getSystemConfigByDomainFromDb(db, detectedDomain);
    const allConfigs = getAllSystemConfigsFromDb(db).map((c) => ({
      id: c.id,
      domain: c.domain,
      merchantLogin: c.merchant_login,
      pass1Set: Boolean(c.pass1),
      pass2Set: Boolean(c.pass2),
      resultUrl: c.result_url,
      resultMethod: c.result_method,
      successUrl: c.success_url,
      successMethod: c.success_method,
      failUrl: c.fail_url,
      failMethod: c.fail_method,
      ofertaUrl: c.oferta_url,
      hashAlgo: c.hash_algo,
      taxSystem: c.tax_system,
      tariffVatRate: c.tariff_vat_rate,
      topupVatRate: c.topup_vat_rate,
      isTest: Number(c.is_test) === 1,
      enabled: Number(c.enabled) !== 0
    }));

    res.json({
      success: true,
      detectedDomain: activeCfg.domain,
      config: {
        id: activeCfg.id,
        domain: activeCfg.domain,
        merchantLogin: activeCfg.merchant_login,
        pass1Set: Boolean(activeCfg.pass1),
        pass2Set: Boolean(activeCfg.pass2),
        resultUrl: activeCfg.result_url,
        successUrl: activeCfg.success_url,
        failUrl: activeCfg.fail_url,
        ofertaUrl: activeCfg.oferta_url,
        hashAlgo: activeCfg.hash_algo,
        tariffVatRate: activeCfg.tariff_vat_rate,
        topupVatRate: activeCfg.topup_vat_rate,
        isTest: Number(activeCfg.is_test) === 1
      },
      configs: allConfigs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/payments/robokassa/config', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const { domain, merchantLogin, pass1, pass2, resultUrl, successUrl, failUrl, ofertaUrl, tariffVatRate, topupVatRate, isTest, enabled } = req.body;
    const targetDomain = String(domain || extractDomainFromRequest(req) || 'iismm.online').trim();

    const updated = updateSystemConfigInDb(db, targetDomain, {
      merchant_login: merchantLogin,
      pass1,
      pass2,
      result_url: resultUrl,
      success_url: successUrl,
      fail_url: failUrl,
      oferta_url: ofertaUrl,
      tariff_vat_rate: tariffVatRate,
      topup_vat_rate: topupVatRate,
      is_test: isTest !== undefined ? (isTest ? 1 : 0) : undefined,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : undefined
    });

    res.json({
      success: true,
      message: `Настройки Робокассы для домена ${updated.domain} сохранены в таблице system_configs!`,
      domain: updated.domain
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/payments/robokassa/create', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const rawAmount = req.body.amount ?? req.body.amountRub ?? 0;
    const rawTariff = req.body.tariffName ?? req.body.planName ?? '';
    const periodMonths = Number(req.body.periodMonths || 1) || 1;
    const userId = String(req.body.userId || req.headers['x-user-id'] || '16926299042');
    const email = req.body.email ? String(req.body.email).trim() : undefined;
    const explicitDomain = req.body.domain ? String(req.body.domain).trim() : undefined;
    const paymentType = req.body.paymentType === 'tariff' || req.body.paymentType === 'topup' ? req.body.paymentType : undefined;
    const recurring = Boolean(req.body.recurring);
    const recurringConsentAccepted = Boolean(req.body.recurringConsentAccepted);

    if (recurring && !recurringConsentAccepted) {
      res.status(400).json({
        error: 'Для подключения автоматических списаний необходимо отметить согласие с условиями публичной оферты.'
      });
      return;
    }

    const created = createRobokassaPaymentLink({
      db,
      req,
      explicitDomain,
      userId,
      email,
      amountRub: Number(rawAmount) || 0,
      tariffName: String(rawTariff || ''),
      periodMonths,
      paymentType,
      recurring
    });

    let consentRecord = null;
    if (created.isRecurring && recurringConsentAccepted) {
      consentRecord = recordRecurringConsentInDb(db, {
        userId: normalizeUserId(userId) || userId,
        email,
        domain: created.domain,
        tariffName: created.normalizedTariff || String(rawTariff || 'Разгон'),
        amountRub: Number(rawAmount) || 0,
        periodDays: 30,
        consentText: req.body.consentText ? String(req.body.consentText) : RECURRING_CONSENT_TEXT,
        ofertaUrl: req.body.ofertaUrl ? String(req.body.ofertaUrl) : `https://${created.domain}/oferta`,
        invId: created.invId,
        req
      });
      savePgDB();
    }

    res.json({
      success: true,
      paymentUrl: created.paymentUrl,
      invId: created.invId,
      outSum: created.outSum,
      domain: created.domain,
      merchantLogin: created.merchantLogin,
      paymentType: created.paymentType,
      tariffName: created.normalizedTariff,
      periodMonths: created.periodMonths,
      iirkyQuantity: created.iirkyQuantity,
      receipt: created.receipt,
      isRecurring: created.isRecurring,
      isTest: created.isTest,
      recurringConsentId: consentRecord?.id || null
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Не удалось сформировать ссылку на оплату' });
  }
});

apiRouter.get('/payments/recurring-consents', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const rawUserId = String(req.query.userId || req.headers['x-user-id'] || '');
    const cleanUid = normalizeUserId(rawUserId) || rawUserId;
    const consents = getUserRecurringConsentsFromDb(db, cleanUid);
    res.json({ success: true, consents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/payments/recurring-consents/revoke', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const rawUserId = String(req.body.userId || req.headers['x-user-id'] || '');
    const cleanUid = normalizeUserId(rawUserId) || rawUserId;
    if (!cleanUid) {
      res.status(400).json({ error: 'Не указан пользователь' });
      return;
    }
    revokeUserRecurringConsentsInDb(db, cleanUid);
    setAutoRenewTariffInDb(db, cleanUid, false);
    savePgDB();
    res.json({
      success: true,
      message: 'Согласие на автоматические рекуррентные списания отозвано, автопродление отключено.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ResultURL callback from Robokassa (supports both POST and GET, verifies Pass2 MD5 from system_configs, responds OK{InvId})
apiRouter.all('/payments/robokassa/result', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const outcome = processRobokassaResultCallback(db, req);
    res.status(outcome.statusCode).type('text/plain').send(outcome.responseText);
  } catch (err: any) {
    console.error('[Robokassa Result Callback Error]', err);
    res.status(500).type('text/plain').send('internal error');
  }
});

// Verify SuccessURL redirect parameters on client arrival at /payment/success using Pass1 MD5 from system_configs
apiRouter.get('/payments/robokassa/verify-success', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const verified = verifyRobokassaSuccessRedirect(db, req);
    res.json({ success: true, ...verified });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Recurring monthly subscription charge endpoint (uses exact same 54-FZ Receipt JSON)
apiRouter.post('/payments/robokassa/recurring', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const parentInvId = Number(req.body.parentInvId || req.body.previousInvoiceId || 0);
    if (!parentInvId) {
      res.status(400).json({ error: 'Не указан parentInvId' });
      return;
    }
    const result = await triggerRobokassaRecurringCharge(db, parentInvId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// In-memory token store for password resets
const resetTokensStore = new Map<string, { userId: string; email: string; expiresAt: number }>();

// Helper for hashing password (sha256)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Authentication
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Пожалуйста, введите E-mail и пароль' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = DB.getUserByEmail(cleanEmail);

  if (!user) {
    res.status(404).json({
      error: 'Пользователь с такой почтой не найден. Регистрация нового аккаунта на сайте невозможна. Зарегистрируйтесь через Telegram Mini App по ссылке t.me/IIrkiBot/app и привяжите почту в профиле (/profile).'
    });
    return;
  }

  if (!user.passwordHash || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: 'Неверный пароль' });
    return;
  }

  // Trigger check and start bonus for Email registration
  getPgDB().then(db => {
    const resCheck = checkAndApplyStartRegistrationBonus(db, user.id, 'email');
    if (resCheck.applied) {
      savePgDB();
    }
  }).catch(() => null);

  res.json({
    success: true,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      email: user.email,
      role: user.role,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      username: user.username || '',
      photoUrl: user.photoUrl || '',
      balance: user.balance || 0,
      createdAt: user.createdAt
    }
  });
});

function handleAutoJoinTeamInvite(db: any, user: any, rawParam?: string | null) {
  if (!rawParam || !user) return;
  try {
    const code = String(rawParam).trim();
    if (!code) return;
    const team = getTeamById(db, code);
    if (team) {
      const cleanUserId = normalizeUserId(user.id || user.telegramId);
      const isAlreadyMember = Array.isArray(team.members) && team.members.some((m: any) => 
        normalizeUserId(m.userId) === cleanUserId || (m.telegramId && String(m.telegramId) === cleanUserId)
      );
      if (!isAlreadyMember && team.ownerId !== cleanUserId) {
        const newMember: TeamMember = {
          userId: String(user.id),
          telegramId: user.telegramId || user.telegram_id,
          handle: user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : `@user_${user.id}`,
          name: `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim() || user.username || 'Пользователь',
          joinedAt: new Date().toISOString(),
          status: 'active',
          role: 'Участник'
        };
        addMemberToTeamInDb(db, team.id, newMember);
        savePgDB();
      }
    }
  } catch (e) {
    console.error('[Auth AutoJoin] Team invite joining error:', e);
  }
}

function resolveReferrerForCode(
  rawCode?: string | number | null,
  excludeIds: Array<string | number | undefined | null> = []
): { referrer: User | undefined; referredByNumeric: number | null } {
  if (!rawCode && rawCode !== 0) {
    return { referrer: undefined, referredByNumeric: null };
  }
  const codeStr = String(rawCode).trim();
  if (!codeStr) {
    return { referrer: undefined, referredByNumeric: null };
  }

  let candidateStr = codeStr;
  // Handle folder/selection share params like f_<folderId>_<refCode> or s_<selectionId>_<refCode>
  const compoundMatch = codeStr.match(/^[fs]_[^_]+_(\d+)$/i);
  if (compoundMatch && compoundMatch[1]) {
    candidateStr = compoundMatch[1];
  } else if (!/^\d+$/.test(codeStr)) {
    const refEqMatch = codeStr.match(/(?:ref|startapp)=([^&\s]+)/i);
    if (refEqMatch && refEqMatch[1]) {
      candidateStr = refEqMatch[1];
    } else {
      const trailingDigits = codeStr.match(/(\d+)$/);
      if (trailingDigits && trailingDigits[1]) {
        candidateStr = trailingDigits[1];
      }
    }
  }

  const parsedNum = parseInt(candidateStr, 10);
  if (isNaN(parsedNum) || parsedNum <= 0) {
    return { referrer: undefined, referredByNumeric: null };
  }

  const users = DB.getUsers();
  const normCandidateId = normalizeUserId(candidateStr);
  const referrer =
    DB.getUserByTelegramId(parsedNum) ||
    DB.getUserById(candidateStr) ||
    DB.getUserById(normCandidateId) ||
    users.find(
      (u) =>
        String(u.telegramId || '') === candidateStr ||
        String(u.id || '') === candidateStr ||
        String(u.id || '') === normCandidateId
    );

  const excludeSet = new Set(
    excludeIds
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
      .map((v) => String(v).trim())
  );

  if (
    referrer &&
    (excludeSet.has(String(referrer.id)) ||
      (referrer.telegramId && excludeSet.has(String(referrer.telegramId))))
  ) {
    return { referrer: undefined, referredByNumeric: null };
  }

  const referredByNumeric = referrer?.telegramId
    ? Number(referrer.telegramId)
    : parsedNum;

  return { referrer, referredByNumeric };
}

async function applyReferralBonusForRegistration(
  referrer: User,
  newUser: { id: string; telegramId?: number; username?: string; telegramUsername?: string; email?: string; createdAt?: string },
  authLabel: string
): Promise<void> {
  try {
    const db = await getPgDB();
    const labelName =
      newUser.telegramUsername ||
      newUser.username ||
      newUser.email ||
      (newUser.telegramId ? `TG:${newUser.telegramId}` : newUser.id);

    const { newBalances } = addTransactionWithBalanceUpdate(db, {
      userId: referrer.id,
      type: 'ref',
      balanceType: 'ref',
      amount: 300,
      description: `Партнерское вознаграждение +300 ИИрок за приглашение (${authLabel}): ${labelName}`,
      comment: `Реферал: ${newUser.id} (TG: ${newUser.telegramId || '-'})`,
      status: 'Завершено',
      createdAt: newUser.createdAt || new Date().toISOString()
    });

    const newRefRewardBal = Math.max(
      (Number(referrer.referralRewardBalance) || 0) + 300,
      Number(newBalances?.balance_ref || 0)
    );

    db.run(
      `UPDATE users SET referral_reward_balance = ? WHERE id = ?`,
      [newRefRewardBal, referrer.id]
    );
    await flushPendingPgWrites().catch(() => null);
    await updateRow('users', referrer.id, {
      balance: newBalances?.balance ?? ((Number(referrer.balance) || 0) + 300),
      balance_free: newBalances?.balance_free,
      balance_ref: newBalances?.balance_ref ?? newRefRewardBal,
      referral_reward_balance: newRefRewardBal
    }).catch(() => null);
  } catch (err) {
    console.error('[Referral Bonus Error]:', err);
  }
}

apiRouter.post('/auth/telegram', async (req: Request, res: Response) => {
  const { telegramId, firstName, lastName, password, username, photoUrl, initData } = req.body;
  
  const botToken = DB.getSettings().telegramBotToken || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';
  let verifiedTgUser: any = null;
  let startParam: string | null = req.body.startParam || req.body.ref || null;

  // Telegram Mini App HASH verification
  if (initData && typeof initData === 'string' && initData.includes('hash=')) {
    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      if (params.get('start_param')) {
        startParam = params.get('start_param');
      }
      if (hash) {
        params.delete('hash');
        const sortedKeys = Array.from(params.keys()).sort();
        const dataCheckString = sortedKeys.map(key => `${key}=${params.get(key)}`).join('\n');
        
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        if (calculatedHash === hash) {
          const userStr = params.get('user');
          if (userStr) {
            verifiedTgUser = JSON.parse(userStr);
          }
        } else {
          console.warn('[Telegram Auth] HASH validation mismatch for initData');
        }
      }
    } catch (e) {
      console.error('[Telegram Auth] initData parsing error:', e);
    }
  }

  const rawTgId = verifiedTgUser?.id ? String(verifiedTgUser.id) : (telegramId ? String(telegramId) : '');
  if (!rawTgId) {
    res.status(400).json({ error: 'Telegram ID или авторизационные данные Telegram недоступны' });
    return;
  }

  const parsedTelegramId = parseInt(rawTgId, 10);
  if (isNaN(parsedTelegramId)) {
    res.status(400).json({ error: 'Некорректный Telegram ID' });
    return;
  }

  let user = DB.getUserByTelegramId(parsedTelegramId);
  const userRole = user ? user.role : (parsedTelegramId === 169262990 ? 'admin' : 'editor');

  const updateFields: any = {
    firstName: verifiedTgUser?.first_name || (firstName !== undefined ? firstName : (user ? user.firstName : '')),
    lastName: verifiedTgUser?.last_name || (lastName !== undefined ? lastName : (user ? user.lastName : '')),
    username: verifiedTgUser?.username || (username !== undefined ? username : (user ? user.username : '')),
    photoUrl: verifiedTgUser?.photo_url || (photoUrl !== undefined ? photoUrl : (user ? user.photoUrl : '')),
    role: userRole
  };

  if (parsedTelegramId === 169262990) {
    updateFields.role = 'admin';
  }

  if (password && password.trim() !== '') {
    updateFields.passwordHash = hashPassword(password.trim());
  }

  if (user) {
    const updated = DB.updateUser(user.id, updateFields);
    // Sync to PostgreSQL
    updateRow('users', user.id, {
      id: user.id,
      telegram_id: parsedTelegramId,
      first_name: updated.firstName,
      last_name: updated.lastName,
      username: updated.username,
      photo_url: updated.photoUrl,
      email: updated.email,
      password_hash: updated.passwordHash,
      role: updated.role
    }).catch(() => null);

    let resolvedGalleryAvatar = updated.photoUrl || '';
    try {
      const uploadedAvatar = await ensureUserTelegramAvatarInGallery(
        parsedTelegramId,
        user.id,
        updateFields.photoUrl || ''
      );
      if (uploadedAvatar) {
        resolvedGalleryAvatar = uploadedAvatar;
        updated.photoUrl = uploadedAvatar;
      }
    } catch {}

    // Trigger registration bonus check for Telegram login & ensure @iismm_chat membership
    getPgDB().then(db => {
      ensureUserJoinedIismmChat(user.id, { db }).catch(() => null);
      const resCheck = checkAndApplyStartRegistrationBonus(db, user.id, 'telegram');
      if (resCheck.applied) {
        savePgDB();
      }
    }).catch(() => null);

    res.json({
      success: true,
      user: {
        id: user.id,
        telegramId: updated.telegramId,
        firstName: updated.firstName,
        lastName: updated.lastName,
        username: updated.username,
        photoUrl: resolvedGalleryAvatar,
        email: updated.email,
        role: updated.role,
        createdAt: updated.createdAt,
        balance: updated.balance || 0
      }
    });
  } else {
    // New registration via Telegram Mini App (11-digit ID)
    const generatedId = parsedTelegramId === 169262990 ? '16926299042' : String(Math.floor(10000000000 + Math.random() * 89999999999));
    const { referrer, referredByNumeric } = resolveReferrerForCode(startParam, [generatedId, parsedTelegramId]);
    const newUser: any = {
      id: generatedId,
      telegramId: parsedTelegramId,
      firstName: updateFields.firstName || '',
      lastName: updateFields.lastName || '',
      username: updateFields.username || '',
      photoUrl: updateFields.photoUrl || '',
      email: updateFields.email || '',
      passwordHash: password && password.trim() !== '' ? hashPassword(password.trim()) : '',
      role: userRole,
      tariff: 'Старт',
      createdAt: new Date().toISOString(),
      balance: userRole === 'admin' ? 1000 : 300,
      referredBy: referredByNumeric,
      referralRewardBalance: 0
    };
    
    DB.addUser(newUser, { skipPgInsert: true });

    const initAdminBonus = parsedTelegramId === 169262990 ? 700 : 0;
    await insertRow('users', {
      id: newUser.id,
      telegram_id: newUser.telegramId,
      first_name: newUser.firstName,
      last_name: newUser.lastName,
      username: newUser.username,
      photo_url: newUser.photoUrl,
      email: newUser.email,
      password_hash: newUser.passwordHash,
      role: newUser.role,
      tariff: newUser.tariff,
      balance: initAdminBonus,
      balance_start: 0,
      balance_admin: initAdminBonus,
      balance_free: initAdminBonus,
      referred_by: newUser.referredBy,
      referral_reward_balance: 0,
      created_at: newUser.createdAt
    }).catch(() => null);

    // If referred, credit referrer +300 ИИрок in balance, balance_ref & transactions
    if (referrer) {
      await applyReferralBonusForRegistration(referrer, newUser, 'Telegram');
    }

    try {
      const uploadedNewAvatar = await ensureUserTelegramAvatarInGallery(
        parsedTelegramId,
        newUser.id,
        newUser.photoUrl || ''
      );
      if (uploadedNewAvatar) {
        newUser.photoUrl = uploadedNewAvatar;
        DB.updateUser(newUser.id, { photoUrl: uploadedNewAvatar, userAvatar: uploadedNewAvatar });
        updateRow('users', newUser.id, { photo_url: uploadedNewAvatar, user_avatar: uploadedNewAvatar }).catch(() => null);
      }
    } catch {}

    try {
      const db = await getPgDB();
      checkAndApplyStartRegistrationBonus(db, newUser.id, 'telegram');
      handleAutoJoinTeamInvite(db, newUser, startParam);
      await flushPendingPgWrites().catch(() => null);
      ensureUserJoinedIismmChat(newUser.id, { clearLeftStatus: true, db }).catch(() => null);
    } catch (e) {}

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        telegramId: newUser.telegramId,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        username: newUser.username,
        photoUrl: newUser.photoUrl,
        email: newUser.email,
        role: newUser.role,
        tariff: newUser.tariff,
        createdAt: newUser.createdAt,
        balance: newUser.balance
      }
    });
  }
});

// Telegram WebApp (TWA) Strict HMAC-SHA256 Auth & Registration Endpoint
apiRouter.post('/auth/telegram-twa', async (req: Request, res: Response) => {
  const { initData, phone, email, latitude, longitude, bio } = req.body;
  
  if (!initData || typeof initData !== 'string') {
    res.status(401).json({ error: 'Не переданы данные initData' });
    return;
  }

  const botToken = getBotTokenFromPg() || process.env.TELEGRAM_BOT_TOKEN || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';
  let isValid = false;
  let parsedUser: any = null;
  let startParam: string | null = null;

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    startParam = urlParams.get('start_param') || req.body.startParam || req.body.ref || null;

    if (hash) {
      urlParams.delete('hash');
      const sortedPairs: string[] = [];
      urlParams.forEach((val, key) => {
        sortedPairs.push(`${key}=${val}`);
      });
      sortedPairs.sort();
      const dataCheckString = sortedPairs.join('\n');

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (calculatedHash === hash) {
        isValid = true;
        const userJson = urlParams.get('user');
        if (userJson) {
          parsedUser = JSON.parse(userJson);
        }
      } else {
        console.warn('[TWA Auth] HASH mismatch for Telegram WebApp initData');
      }
    }
  } catch (err) {
    console.error('[TWA Auth] Ошибка валидации initData:', err);
  }

  if (!isValid) {
    res.status(401).json({ error: 'Invalid initData: ошибка проверки криптографического HMAC подписи' });
    return;
  }

  if (!parsedUser || !parsedUser.id) {
    res.status(400).json({ error: 'В initData отсутствует объект пользователя Telegram' });
    return;
  }

  const telegramId = parsedUser.id;
  const firstName = parsedUser.first_name || '';
  const lastName = parsedUser.last_name || '';
  const username = parsedUser.username || '';
  const photoUrl = parsedUser.photo_url || '';
  const profileLink = username ? `https://t.me/${username}` : `https://t.me/c/${telegramId}`;
  const isPremium = parsedUser.is_premium ? 1 : 0;
  const languageCode = parsedUser.language_code || 'ru';
  const allowsWriteToPm = parsedUser.allows_write_to_pm ? 1 : 0;

  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;

  if (startParam) {
    const utmMatch = startParam.match(/utm_source=([^&_]+)/);
    if (utmMatch) utmSource = utmMatch[1];
    const utmMedMatch = startParam.match(/utm_medium=([^&_]+)/);
    if (utmMedMatch) utmMedium = utmMedMatch[1];
    const utmCampMatch = startParam.match(/utm_campaign=([^&_]+)/);
    if (utmCampMatch) utmCampaign = utmCampMatch[1];
  }

  const { referrer: twaReferrer, referredByNumeric: referredBy } = resolveReferrerForCode(
    startParam,
    [telegramId]
  );

  const existingUser = DB.getUserByTelegramId(telegramId) || DB.getUserById(String(telegramId));
  const nowStr = new Date().toISOString();
  const role = telegramId === 169262990 ? 'admin' : (existingUser?.role || 'editor');

  if (existingUser) {
    const updatedUser = DB.updateUser(existingUser.id, {
      firstName: firstName || existingUser.firstName,
      lastName: lastName || existingUser.lastName,
      telegramUsername: username || existingUser.telegramUsername,
      photoUrl: existingUser.userAvatar || (existingUser as any).user_avatar || photoUrl || existingUser.photoUrl,
      profileLink,
      bio: bio || existingUser.bio,
      isPremium: !!isPremium,
      languageCode: languageCode || existingUser.languageCode,
      phone: phone || existingUser.phone,
      email: email || existingUser.email,
      allowsWriteToPm: !!allowsWriteToPm,
      latitude: latitude ?? existingUser.latitude,
      longitude: longitude ?? existingUser.longitude,
      lastLogin: nowStr,
      role
    });

    updateRow('users', existingUser.id, {
      first_name: updatedUser.firstName,
      last_name: updatedUser.lastName,
      username: updatedUser.telegramUsername,
      photo_url: updatedUser.photoUrl,
      profile_link: profileLink,
      bio: updatedUser.bio,
      is_premium: isPremium,
      language_code: languageCode,
      phone: updatedUser.phone,
      email: updatedUser.email,
      allows_write_to_pm: allowsWriteToPm,
      latitude: updatedUser.latitude,
      longitude: updatedUser.longitude,
      last_login: nowStr,
      role
    }).catch(() => null);

    // Trigger registration bonus check for TWA login & ensure @iismm_chat membership
    getPgDB().then(db => {
      ensureUserJoinedIismmChat(existingUser.id, { db }).catch(() => null);
      const resCheck = checkAndApplyStartRegistrationBonus(db, existingUser.id, 'telegram');
      if (resCheck.applied) {
        savePgDB();
      }
    }).catch(() => null);

    res.json({
      success: true,
      token: `twa_jwt_${telegramId}_${Date.now()}`,
      user: updatedUser
    });
  } else {
    const generatedId = (telegramId && telegramId === 169262990) ? '16926299042' : String(Math.floor(10000000000 + Math.random() * 89999999999));
    const newUser: any = {
      id: generatedId,
      telegramId,
      name: `${firstName} ${lastName}`.trim() || username || `User_${telegramId}`,
      firstName,
      lastName,
      telegramUsername: username,
      photoUrl,
      profileLink,
      bio: bio || '',
      isPremium: !!isPremium,
      languageCode,
      phone: phone || null,
      email: email || '',
      passwordHash: '',
      tariff: 'Старт',
      allowsWriteToPm: !!allowsWriteToPm,
      latitude: latitude || null,
      longitude: longitude || null,
      referredBy,
      utmSource,
      utmMedium,
      utmCampaign,
      referralRewardBalance: 0.0,
      balance: telegramId === 169262990 ? 1000 : 300,
      iirky: telegramId === 169262990 ? 1000 : 300,
      tokens: 100000,
      balanceRub: 0,
      earningsRub: 0,
      role,
      createdAt: nowStr,
      lastLogin: nowStr
    };

    DB.addUser(newUser, { skipPgInsert: true });

    const twaInitAdminBonus = telegramId === 169262990 ? 700 : 0;
    await insertRow('users', {
      id: newUser.id,
      telegram_id: newUser.telegramId,
      first_name: newUser.firstName,
      last_name: newUser.lastName,
      username: newUser.telegramUsername,
      photo_url: newUser.photoUrl,
      profile_link: newUser.profileLink,
      bio: newUser.bio,
      is_premium: isPremium,
      language_code: newUser.languageCode,
      phone: newUser.phone,
      email: newUser.email,
      password_hash: newUser.passwordHash,
      allows_write_to_pm: allowsWriteToPm,
      latitude: newUser.latitude,
      longitude: newUser.longitude,
      referred_by: newUser.referredBy,
      utm_source: newUser.utmSource,
      utm_medium: newUser.utmMedium,
      utm_campaign: newUser.utmCampaign,
      referral_reward_balance: 0.0,
      balance: twaInitAdminBonus,
      balance_start: 0,
      balance_admin: twaInitAdminBonus,
      balance_free: twaInitAdminBonus,
      tariff: newUser.tariff,
      role: newUser.role,
      created_at: newUser.createdAt,
      last_login: newUser.lastLogin
    }).catch(() => null);

    // Referral bonus: +300 ИИрок to referrer (credit balance, balance_ref, referral_reward_balance, and transactions)
    if (twaReferrer) {
      await applyReferralBonusForRegistration(twaReferrer, newUser, 'Telegram Mini App');
    }

    try {
      const db = await getPgDB();
      checkAndApplyStartRegistrationBonus(db, newUser.id, 'telegram');
      handleAutoJoinTeamInvite(db, newUser, startParam);
      await flushPendingPgWrites().catch(() => null);
      ensureUserJoinedIismmChat(newUser.id, { clearLeftStatus: true, db }).catch(() => null);
    } catch (e) {}

    res.status(201).json({
      success: true,
      token: `twa_jwt_${telegramId}_${Date.now()}`,
      user: newUser
    });
  }
});

// Legacy avatar endpoint: resolves Telegram profile photo into ProTalk TGF gallery URL and redirects directly
apiRouter.get(['/avatar/:telegramId', '/avatar/:telegramId.jpg', '/avatar/:telegramId.png'], async (req: Request, res: Response) => {
  const { telegramId } = req.params;
  const cleanId = (telegramId || '').replace(/[^0-9]/g, '');

  if (!cleanId) {
    res.redirect(302, BRAND_ASSETS.heartAvatar);
    return;
  }

  if (cleanId === '169262990' || cleanId === '16926299042') {
    res.redirect(302, BRAND_ASSETS.ownerAvatar);
    return;
  }

  try {
    const db = await getPgDB();
    const userRow = getUserByIdFromDb(db, cleanId) as any;
    const rawCandidate =
      userRow?.user_avatar ||
      (userRow?.photo_url && !userRow.photo_url.includes('/api/avatar/') ? userRow.photo_url : '');
    const normalizedCandidate = normalizeProTalkMediaUrl(rawCandidate);
    if (
      normalizedCandidate &&
      normalizedCandidate.startsWith('https://file.pro-talk.ru/tgf/')
    ) {
      res.redirect(302, normalizedCandidate);
      return;
    }
  } catch (e) {}

  let targetTgId = cleanId;
  if (cleanId.length > 10) {
    try {
      const db = await getPgDB();
      const userRow = getUserByIdFromDb(db, cleanId) as any;
      if (userRow && userRow.telegram_id && Number(userRow.telegram_id) > 0) {
        targetTgId = String(userRow.telegram_id);
      } else {
        targetTgId = cleanId.slice(0, -2);
      }
    } catch (e) {
      targetTgId = cleanId.slice(0, -2);
    }
  }

  try {
    const galleryUrl = await ensureUserTelegramAvatarInGallery(targetTgId, undefined, cleanId);
    if (galleryUrl && galleryUrl.startsWith('https://file.pro-talk.ru/tgf/')) {
      res.redirect(302, galleryUrl);
      return;
    }
  } catch (e) {
    console.error(`Error syncing gallery avatar for ${cleanId} (tg: ${targetTgId}):`, e);
  }

  res.redirect(302, BRAND_ASSETS.heartAvatar);
});

// Cache for channel avatars (buffer + mime type)
export const channelAvatarCache = new Map<string, { buffer: Buffer; mime: string; timestamp: number }>();

function generateChannelSvgAvatar(name: string): string {
  const initial = (name.replace(/^[@#]/, '').trim().charAt(0) || 'K').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="chanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="50%" stop-color="#ec4899"/>
        <stop offset="100%" stop-color="#f97316"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="36" fill="url(#chanGrad)"/>
    <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="56" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">${initial}</text>
  </svg>`;
}

// Proxy and serve channel avatars reliably from Telegram API or cache
apiRouter.get(['/channel-avatar/:identifier', '/channel-avatar/:identifier.jpg', '/channel-avatar/:identifier.png'], async (req: Request, res: Response) => {
  const rawId = (req.params.identifier || '').trim();
  const cleanId = rawId.replace(/\.(jpg|png|jpeg|webp)$/i, '').trim();

  if (!cleanId) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(generateChannelSvgAvatar('Канал'));
    return;
  }

  // 1. Check memory cache (6 hour TTL)
  const cached = channelAvatarCache.get(cleanId) || channelAvatarCache.get(cleanId.toLowerCase());
  if (cached && Date.now() - cached.timestamp < 3600000 * 6) {
    res.setHeader('Content-Type', cached.mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(cached.buffer);
    return;
  }

  const settings = DB.getSettings();
  const token = settings.telegramBotToken || getBotTokenFromPg() || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

  let channelName = cleanId;
  let customPhotoUrl = '';
  let telegramId = '';

  // 2. Look up channel in DB
  try {
    const db = await getPgDB();
    const rows = db.exec(
      `SELECT name, username, telegram_id, photo_url FROM channels WHERE id = ? OR username = ? OR username = ? OR telegram_id = ? LIMIT 1`,
      [cleanId, cleanId, '@' + cleanId, cleanId]
    );
    if (rows[0] && rows[0].values && rows[0].values[0]) {
      const r = rows[0].values[0];
      channelName = String(r[0] || cleanId);
      telegramId = String(r[2] || '');
      customPhotoUrl = String(r[3] || '');
    }
  } catch (e) {}

  // If custom photo is an external URL, fetch and cache it
  if (customPhotoUrl && (customPhotoUrl.startsWith('http://') || customPhotoUrl.startsWith('https://')) && !customPhotoUrl.includes('/channel-avatar/')) {
    try {
      const imgRes = await fetch(customPhotoUrl, { signal: AbortSignal.timeout(4000) });
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const mime = imgRes.headers.get('content-type') || 'image/jpeg';
        channelAvatarCache.set(cleanId, { buffer, mime, timestamp: Date.now() });
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(buffer);
        return;
      }
    } catch (e) {}
  }

  // 3. Try fetching channel info & photo via Telegram Bot API gateway
  if (token) {
    try {
      let tgChatId = telegramId || cleanId;
      if (!tgChatId.startsWith('-') && !tgChatId.startsWith('@') && !/^\d+$/.test(tgChatId)) {
        tgChatId = '@' + tgChatId;
      }

      const tgConfig = await getTelegramBotConfig().catch(() => null);
      const chatData = await fetchTelegramBotApi({
        primaryBase: tgConfig?.apiBaseUrl,
        proxyType: tgConfig?.proxyType,
        token,
        endpoint: `getChat?chat_id=${encodeURIComponent(tgChatId)}`,
        timeoutMs: 8000
      });

      if (chatData.ok && chatData.result) {
        if (chatData.result.title) {
          channelName = chatData.result.title;
        }
        const photo = chatData.result.photo;
        const fileId = photo?.small_file_id || photo?.big_file_id;
        if (fileId) {
          const fileData = await fetchTelegramBotApi({
            primaryBase: tgConfig?.apiBaseUrl,
            proxyType: tgConfig?.proxyType,
            token,
            endpoint: `getFile?file_id=${encodeURIComponent(fileId)}`,
            timeoutMs: 8000
          });

          if (fileData.ok && fileData.result?.file_path) {
            const downloaded = await fetchTelegramBotFileBuffer({
              primaryBase: tgConfig?.apiBaseUrl,
              proxyType: tgConfig?.proxyType,
              token,
              filePath: fileData.result.file_path,
              timeoutMs: 10000
            });
            if (downloaded) {
              const { buffer, mimeType: mime } = downloaded;
              channelAvatarCache.set(cleanId, { buffer, mime, timestamp: Date.now() });
              channelAvatarCache.set(cleanId.toLowerCase(), { buffer, mime, timestamp: Date.now() });
              if (chatData.result.username) {
                channelAvatarCache.set(chatData.result.username.toLowerCase(), { buffer, mime, timestamp: Date.now() });
              }

              res.setHeader('Content-Type', mime);
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.send(buffer);
              return;
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[Channel Avatar] Telegram fetch error for ${cleanId}:`, e);
    }
  }

  // 4. Return branded SVG gradient fallback
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(generateChannelSvgAvatar(channelName));
});

// Endpoint to resolve or download channel avatar to ProTalk Media Gallery (https://file.pro-talk.ru/tgf)
apiRouter.get('/channel-avatar-url/:identifier', async (req: Request, res: Response) => {
  try {
    const rawId = (req.params.identifier || '').trim();
    const fallback = (req.query.fallback as string) || '';
    const url = await ensureChannelAvatarInGallery(rawId, fallback);
    res.json({ success: true, url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/channel-avatar/upload-to-gallery', async (req: Request, res: Response) => {
  try {
    const { identifier, url } = req.body;
    const galleryUrl = await ensureChannelAvatarInGallery(identifier || '', url || '');
    res.json({ success: true, url: galleryUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync Telegram user profile photos via Telegram Bot API (getUserProfilePhotos)
apiRouter.post('/users/sync-telegram-photos', async (req: Request, res: Response) => {
  try {
    const settings = DB.getSettings();
    const token = settings.telegramBotToken || getBotTokenFromPg() || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

    if (!token) {
      res.status(400).json({ error: 'Токен Telegram бота не настроен в системе' });
      return;
    }

    const allUsers = DB.getUsers();
    let syncedCount = 0;
    let noPhotoCount = 0;
    let notStartedCount = 0;
    let errorsCount = 0;
    const details: any[] = [];

    const tgConfig = await getTelegramBotConfig().catch(() => null);

    for (const user of allUsers) {
      if (!user.telegramId) continue;
      
      try {
        const photoData: any = await fetchTelegramBotApi({
          primaryBase: tgConfig?.apiBaseUrl,
          proxyType: tgConfig?.proxyType,
          token,
          endpoint: `getUserProfilePhotos?user_id=${user.telegramId}&limit=1`,
          timeoutMs: 8000
        });

        if (photoData.ok && photoData.result && photoData.result.total_count > 0) {
          const uploadedGalleryPhoto = await ensureUserTelegramAvatarInGallery(
            user.telegramId,
            user.id,
            '',
            true
          );
          const realPhotoUrl = uploadedGalleryPhoto || user.photoUrl || '';
          if (realPhotoUrl) {
            DB.updateUser(user.id, { photoUrl: realPhotoUrl });
            updateRow('users', user.id, { photo_url: realPhotoUrl }).catch(() => null);
          }

          syncedCount++;
          details.push({ telegramId: user.telegramId, username: user.username, status: 'synced', photoUrl: realPhotoUrl });
        } else if (photoData.ok && photoData.result && photoData.result.total_count === 0) {
          noPhotoCount++;
          details.push({ telegramId: user.telegramId, username: user.username, status: 'no_photo_or_private' });
        } else {
          notStartedCount++;
          details.push({ telegramId: user.telegramId, username: user.username, status: 'not_started_or_blocked', description: photoData.description });
        }
      } catch (err: any) {
        errorsCount++;
        details.push({ telegramId: user.telegramId, username: user.username, status: 'error', error: err.message });
      }

      await new Promise(resolve => setTimeout(resolve, 30));
    }

    res.json({
      success: true,
      message: `Синхронизация завершена. Успешно обновлено: ${syncedCount}, Нет фото/приватный профиль: ${noPhotoCount}, Бот не активирован пользователем: ${notStartedCount}, Ошибок: ${errorsCount}`,
      stats: {
        totalUsers: allUsers.length,
        syncedCount,
        noPhotoCount,
        notStartedCount,
        errorsCount
      },
      details: details.slice(0, 50)
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка синхронизации аватарок: ' + err.message });
  }
});

// Referral Stats Endpoint
apiRouter.get('/referrals/stats', async (req: Request, res: Response) => {
  const telegramId = req.query.telegramId ? parseInt(String(req.query.telegramId), 10) : null;
  const userId = req.query.userId ? String(req.query.userId).trim() : null;

  const users = DB.getUsers();
  let currentUser = null;
  if (telegramId && !isNaN(telegramId)) {
    currentUser = users.find(u => u.telegramId === telegramId || String(u.id) === String(telegramId));
  }
  if (!currentUser && userId) {
    const normId = normalizeUserId(userId);
    currentUser = users.find(
      u => u.id === userId || u.id === normId || String(u.telegramId || '') === userId
    );
  }

  if (!currentUser) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }

  const currentIdStr = String(currentUser.id);
  const currentTgStr = currentUser.telegramId ? String(currentUser.telegramId) : '';

  let invitedUsers = users
    .filter(u => {
      const uIdStr = String(u.id);
      const uTgStr = u.telegramId ? String(u.telegramId) : '';
      if (uIdStr === currentIdStr || (currentTgStr && (uIdStr === currentTgStr || uTgStr === currentTgStr))) return false;

      if (!u.referredBy) return false;
      const refStr = String(u.referredBy);
      if (refStr === currentIdStr || (currentTgStr && refStr === currentTgStr)) return true;
      if ((currentIdStr === '16926299042' || currentTgStr === '169262990') && (refStr === '16926299042' || refStr === '169262990')) return true;
      if ((currentIdStr === '80926979801' || currentTgStr === '8092697980') && (refStr === '80926979801' || refStr === '8092697980')) return true;
      return false;
    })
    .map(u => ({
      id: u.id,
      telegramId: u.telegramId,
      firstName: u.firstName || u.name || `Пользователь ${u.id}`,
      username: u.telegramUsername || u.username,
      photoUrl: u.photoUrl,
      createdAt: u.createdAt || new Date().toISOString()
    }));

  let dbBalanceRef = 0;
  let txRefSum = 0;
  try {
    const db = await getPgDB();
    const rowStmt = db.prepare('SELECT balance_ref, referral_reward_balance FROM users WHERE id = ? LIMIT 1');
    rowStmt.bind([currentUser.id]);
    if (rowStmt.step()) {
      const r = rowStmt.getAsObject() as any;
      dbBalanceRef = Math.max(Number(r.balance_ref || 0), Number(r.referral_reward_balance || 0));
    }
    rowStmt.free();

    const txStmt = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS ref_sum FROM transactions WHERE user_id = ? AND (type = 'ref' OR type = 'referral_bonus')"
    );
    txStmt.bind([currentUser.id]);
    if (txStmt.step()) {
      const r = txStmt.getAsObject() as any;
      txRefSum = Number(r.ref_sum || 0);
    }
    txStmt.free();
  } catch {}

  const referralRewardBalance = Math.max(
    Number(currentUser.referralRewardBalance || 0),
    dbBalanceRef,
    txRefSum
  );

  let referrerInfo = null;
  let refCode = currentUser.referredBy;

  if (refCode) {
    const refCodeStr = String(refCode);
    const ref = users.find(u => 
      String(u.id) === refCodeStr || 
      String(u.telegramId) === refCodeStr ||
      (refCodeStr.startsWith('8092697980') && (String(u.id).startsWith('8092697980') || u.telegramId === 8092697980)) ||
      (refCodeStr.startsWith('169262990') && (String(u.id).startsWith('169262990') || u.telegramId === 169262990))
    );
    if (ref) {
      referrerInfo = {
        id: ref.id,
        telegramId: ref.telegramId || (isNaN(Number(ref.id)) ? undefined : Number(ref.id)),
        firstName: ref.firstName || ref.name || `Пользователь ${ref.id}`,
        username: ref.telegramUsername || ref.username
      };
    } else {
      referrerInfo = {
        id: refCodeStr,
        telegramId: isNaN(Number(refCodeStr)) ? undefined : Number(refCodeStr),
        firstName: `Пользователь ${refCodeStr}`,
        username: undefined
      };
    }
  }

  res.json({
    referralLink: `https://t.me/IIrkiBot/app?startapp=${currentUser.telegramId || currentUser.id || '169262990'}`,
    referralRewardBalance,
    invitedCount: invitedUsers.length,
    invitedUsers,
    referredBy: referrerInfo
  });
});

// Teams API Endpoints
apiRouter.get('/teams', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.query.userId ? String(req.query.userId) : (req.query.telegramId ? String(req.query.telegramId) : '16926299042');
    const userId = normalizeUserId(rawUserId);
    const db = await getPgDB();

    const teams = getTeamsByOwnerOrMember(db, userId);
    let team = teams[0] || null;

    if (!team && (userId === '16926299042' || userId === '169262990')) {
      const recheck = getTeamsByOwnerOrMember(db, '16926299042');
      team = recheck[0] || null;
    }

    if (team) {
      // Sync channels from 'channels' table for all participants
      const syncedChannels = syncTeamChannelsFromDb(db, team.id);
      team.channels = syncedChannels;
    }

    // Also get all distinct channels from PostgreSQL channels table
    let allTeamChannels: Channel[] = [];
    if (team) {
      const allUserIds = new Set<string>();
      if (team.ownerId) allUserIds.add(team.ownerId);
      if (Array.isArray(team.members)) {
        team.members.forEach((m: any) => {
          if (m.userId) allUserIds.add(String(m.userId));
          if (m.telegramId) allUserIds.add(String(m.telegramId));
        });
      }
      allUserIds.add('16926299042');
      allUserIds.add('169262990');

      try {
        const inClause = Array.from(allUserIds).map(id => `'${id}'`).join(',');
        const sqlRes = db.exec(`SELECT * FROM channels WHERE user_id IN (${inClause}) OR user_id IS NULL OR user_id = ''`);
        if (sqlRes && sqlRes.length > 0 && sqlRes[0].values) {
          const cols = sqlRes[0].columns;
          sqlRes[0].values.forEach(row => {
            const chObj: any = {};
            cols.forEach((col, i) => chObj[col] = row[i]);
            if (chObj.username || chObj.name) {
              allTeamChannels.push({
                id: String(chObj.id),
                userId: normalizeUserId(chObj.user_id),
                name: chObj.name || chObj.username,
                username: chObj.username || chObj.name,
                telegramId: chObj.telegram_id || '',
                subscribersCount: chObj.subscribers_count || 0,
                isActive: chObj.is_active !== undefined ? Boolean(chObj.is_active) : true,
                isPremium: true,
                inviteLink: chObj.invite_link || '',
                description: chObj.description || '',
                status: chObj.is_active ? 'connected' : 'disconnected'
              });
            }
          });
        }
      } catch (e) {}
    }

    // Deduplicate channels
    const seen = new Set<string>();
    const deduplicatedChannels: Channel[] = [];
    allTeamChannels.forEach(c => {
      const key = (c.username || c.name || c.id).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedChannels.push(c);
      }
    });

    res.json({
      success: true,
      team,
      dbChannels: deduplicatedChannels
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при получении данных команды: ' + err.message });
  }
});

// Get all teams in database
apiRouter.get('/teams/all', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const teams = getAllTeamsFromDb(db);
    res.json({ success: true, teams });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при получении списка команд: ' + err.message });
  }
});

// Create new team (requires Отрыв or higher)
apiRouter.post('/teams', async (req: Request, res: Response) => {
  try {
    const { ownerId, name, inviteCode, channels, members } = req.body;
    const rawOwner = ownerId || (req.headers['x-user-id'] as string) || '';
    const db = await getPgDB();

    const perm = checkTariffPermission(db, rawOwner, ServerTariffLevel.Otryv, 'Мультиплеер (командный доступ)');
    if (!perm.allowed) {
      res.status(perm.statusCode).json(perm.payload);
      return;
    }

    const cleanOwnerId = normalizeUserId(rawOwner || '16926299042');
    const newTeam = createTeamInDb(db, {
      ownerId: cleanOwnerId,
      name: name || 'Новая SMM Команда',
      inviteCode: inviteCode || `team_${cleanOwnerId}_${Date.now()}`,
      channels: Array.isArray(channels) ? channels : [],
      members: Array.isArray(members) ? members : []
    });

    savePgDB();
    res.status(201).json({ success: true, team: newTeam });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при создании команды: ' + err.message });
  }
});

// Update team details (requires Отрыв or higher)
apiRouter.put('/teams/:id', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.id;
    const { name, channels, members, ownerId, inviteCode } = req.body;
    const db = await getPgDB();

    const existingTeam = getTeamById(db, teamId);
    const actingUserId = ownerId || (req.headers['x-user-id'] as string) || existingTeam?.ownerId || '';
    const perm = checkTariffPermission(db, actingUserId, ServerTariffLevel.Otryv, 'Мультиплеер (командный доступ)');
    if (!perm.allowed) {
      res.status(perm.statusCode).json(perm.payload);
      return;
    }

    const updated = updateTeamInDb(db, teamId, {
      name,
      channels,
      members,
      ownerId,
      inviteCode
    });

    if (!updated) {
      res.status(404).json({ error: 'Команда не найдена' });
      return;
    }

    savePgDB();
    res.json({ success: true, team: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при обновлении команды: ' + err.message });
  }
});

// Delete team from PostgreSQL
apiRouter.delete('/teams/:id', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.id;
    const db = await getPgDB();
    const ok = deleteTeamInDb(db, teamId);
    savePgDB();
    res.json({ success: ok, id: teamId });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при удалении команды: ' + err.message });
  }
});

// Update team channels
apiRouter.put('/teams/:id/channels', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.id;
    const { channels } = req.body;
    const db = await getPgDB();

    const updated = updateTeamInDb(db, teamId, { channels: Array.isArray(channels) ? channels : [] });
    savePgDB();
    res.json({ success: true, team: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при обновлении каналов команды: ' + err.message });
  }
});

// Check user in database before adding to team
apiRouter.get('/teams/check-user', async (req: Request, res: Response) => {
  try {
    const rawHandle = String(req.query.handle || req.query.query || req.query.username || '').trim();
    if (!rawHandle) {
      return res.json({ success: true, found: false, user: null });
    }

    const db = await getPgDB();
    const matchedUser = findUserInDb(db, rawHandle);

    if (!matchedUser) {
      return res.json({ 
        success: true, 
        found: false, 
        user: null, 
        message: `Пользователь ${rawHandle.startsWith('@') ? rawHandle : '@' + rawHandle} не найден в базе данных сервиса` 
      });
    }

    // Privacy & blacklist checks
    const allowInvites = matchedUser.allow_team_invites !== 0 && matchedUser.allow_team_invites !== false && matchedUser.allow_team_invites !== '0';
    let blacklist: string[] = [];
    try {
      if (matchedUser.team_blacklist) {
        blacklist = typeof matchedUser.team_blacklist === 'string' ? JSON.parse(matchedUser.team_blacklist) : matchedUser.team_blacklist;
      }
    } catch (e) {}

    const cleanUsername = matchedUser.username ? (matchedUser.username.startsWith('@') ? matchedUser.username : `@${matchedUser.username}`) : `@user_${matchedUser.id}`;
    const displayName = `${matchedUser.first_name || ''} ${matchedUser.last_name || ''}`.trim() || matchedUser.username || `Пользователь #${matchedUser.id}`;

    return res.json({
      success: true,
      found: true,
      user: {
        id: String(matchedUser.id),
        telegramId: matchedUser.telegram_id ? Number(matchedUser.telegram_id) : undefined,
        username: cleanUsername,
        firstName: matchedUser.first_name || '',
        lastName: matchedUser.last_name || '',
        displayName,
        photoUrl: matchedUser.photo_url || null,
        tariff: matchedUser.tariff || 'Старт',
        role: matchedUser.role || 'Пользователь',
        allowInvites,
        blacklist
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка проверки пользователя: ' + err.message });
  }
});

// Add member with strict user database validation, tariff check, privacy & blacklist check
apiRouter.post('/teams/members', async (req: Request, res: Response) => {
  try {
    const { ownerId, username, handle, role, teamId } = req.body;
    const db = await getPgDB();

    const actingOwner = ownerId || (req.headers['x-user-id'] as string) || '';
    const perm = checkTariffPermission(db, actingOwner, ServerTariffLevel.Otryv, 'Мультиплеер (командный доступ)');
    if (!perm.allowed) {
      res.status(perm.statusCode).json(perm.payload);
      return;
    }

    const rawHandle = (username || handle || '').replace(/^@/, '').trim();
    if (!rawHandle) {
      res.status(400).json({ error: 'Укажите @username или ID пользователя' });
      return;
    }

    // 1. Look up user in PostgreSQL 'users' table - must exist in database!
    const matchedUser = findUserInDb(db, rawHandle);
    if (!matchedUser) {
      res.status(404).json({
        error: `Пользователь @${rawHandle} не найден в базе данных сервиса. Пользователь должен предварительно авторизоваться на сервисе или запустить Telegram-бота.`
      });
      return;
    }

    // 2. Check if user disabled team invites
    if (matchedUser.allow_team_invites === 0 || matchedUser.allow_team_invites === false || matchedUser.allow_team_invites === '0') {
      res.status(403).json({
        error: `Пользователь @${rawHandle} отключил возможность добавления себя в команды в настройках профиля.`
      });
      return;
    }

    // 3. Check if target user has blacklisted this team or owner
    let blacklist: string[] = [];
    try {
      if (matchedUser.team_blacklist) {
        blacklist = typeof matchedUser.team_blacklist === 'string' ? JSON.parse(matchedUser.team_blacklist) : matchedUser.team_blacklist;
      }
    } catch (e) {}

    const cleanOwnerId = normalizeUserId(ownerId || '16926299042');
    const cleanTeamId = teamId ? String(teamId) : `team_${cleanOwnerId}`;

    if (blacklist.includes(cleanTeamId) || blacklist.includes(cleanOwnerId)) {
      res.status(403).json({
        error: `Пользователь @${rawHandle} добавил эту команду в черный список.`
      });
      return;
    }

    const newMember: TeamMember = {
      userId: String(matchedUser.id),
      telegramId: matchedUser?.telegram_id ? Number(matchedUser.telegram_id) : undefined,
      handle: matchedUser?.username ? (matchedUser.username.startsWith('@') ? matchedUser.username : `@${matchedUser.username}`) : `@${rawHandle}`,
      name: (`${matchedUser.first_name || ''} ${matchedUser.last_name || ''}`.trim() || matchedUser.username || `@${rawHandle}`),
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: role || 'Участник'
    };

    const updatedTeam = addMemberToTeamInDb(db, cleanTeamId, newMember);
    if (!updatedTeam) {
      res.status(400).json({ error: 'Не удалось добавить участника в команду' });
      return;
    }

    savePgDB();
    res.json({ success: true, team: updatedTeam, newMember });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при добавлении участника в команду: ' + err.message });
  }
});

// Join team via invite code / link
apiRouter.post('/teams/join', async (req: Request, res: Response) => {
  try {
    const { inviteCode, userId } = req.body;
    if (!inviteCode || !userId) {
      res.status(400).json({ error: 'Не указан инвайт-код или ID пользователя' });
      return;
    }

    const cleanCode = String(inviteCode).trim();
    const cleanUserId = normalizeUserId(userId);
    const db = await getPgDB();

    // Look up team by invite_code or id
    const team = getTeamById(db, cleanCode);
    if (!team) {
      res.status(404).json({ error: 'Команда по указанному инвайт-коду не найдена' });
      return;
    }

    // Verify user in PostgreSQL
    const user = findUserInDb(db, cleanUserId);
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден в базе данных' });
      return;
    }

    // Check privacy
    if (user.allow_team_invites === 0 || user.allow_team_invites === false || user.allow_team_invites === '0') {
      res.status(403).json({ error: 'У вас в настройках включен запрет на приглашение в команды' });
      return;
    }

    // Check blacklist
    let blacklist: string[] = [];
    try {
      if (user.team_blacklist) {
        blacklist = typeof user.team_blacklist === 'string' ? JSON.parse(user.team_blacklist) : user.team_blacklist;
      }
    } catch (e) {}

    if (blacklist.includes(team.id) || blacklist.includes(team.ownerId)) {
      res.status(403).json({ error: 'Эта команда находится в вашем черном списке' });
      return;
    }

    const newMember: TeamMember = {
      userId: String(user.id),
      telegramId: user.telegram_id ? Number(user.telegram_id) : undefined,
      handle: user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : `@user_${user.id}`,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || `Пользователь`,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'Участник'
    };

    const updatedTeam = addMemberToTeamInDb(db, team.id, newMember);
    savePgDB();

    res.json({ success: true, message: `Вы успешно присоединились к команде "${team.name}"!`, team: updatedTeam });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при входе по инвайт-ссылке: ' + err.message });
  }
});

// Remove member from team
apiRouter.delete('/teams/members/:id', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.id;
    const ownerId = (req.query.ownerId as string) || (req.query.teamId as string) || '16926299042';
    const db = await getPgDB();

    const updatedTeam = removeMemberFromTeamInDb(db, ownerId, memberId);
    savePgDB();

    res.json({ success: true, team: updatedTeam });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка при удалении участника из команды: ' + err.message });
  }
});

// User Team Privacy Settings (GET / PUT)
apiRouter.get('/user/team-privacy', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.query.userId ? String(req.query.userId) : '16926299042';
    const userId = normalizeUserId(rawUserId);
    const db = await getPgDB();

    const user = findUserInDb(db, userId);
    if (!user) {
      res.json({ success: true, allowTeamInvites: true, teamBlacklist: [] });
      return;
    }

    const allowTeamInvites = user.allow_team_invites !== 0 && user.allow_team_invites !== '0' && user.allow_team_invites !== false;
    let teamBlacklist: string[] = [];
    try {
      if (user.team_blacklist) {
        teamBlacklist = typeof user.team_blacklist === 'string' ? JSON.parse(user.team_blacklist) : user.team_blacklist;
      }
    } catch (e) {}

    res.json({ success: true, allowTeamInvites, teamBlacklist: Array.isArray(teamBlacklist) ? teamBlacklist : [] });
  } catch (err: any) {
    res.json({ success: true, allowTeamInvites: true, teamBlacklist: [] });
  }
});

apiRouter.put('/user/team-privacy', async (req: Request, res: Response) => {
  try {
    const { userId, allowTeamInvites, teamBlacklist } = req.body;
    const cleanUserId = normalizeUserId(userId || '16926299042');
    const db = await getPgDB();

    const allowVal = allowTeamInvites === false || allowTeamInvites === 0 ? 0 : 1;
    const blacklistVal = JSON.stringify(Array.isArray(teamBlacklist) ? teamBlacklist : []);

    db.run(
      `UPDATE users SET allow_team_invites = ?, team_blacklist = ? WHERE id = ? OR telegram_id = ?`,
      [allowVal, blacklistVal, cleanUserId, cleanUserId]
    );

    savePgDB();
    res.json({ success: true, allowTeamInvites: allowVal === 1, teamBlacklist: Array.isArray(teamBlacklist) ? teamBlacklist : [] });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка сохранения настроек приватности: ' + err.message });
  }
});

// Blacklist team for user
apiRouter.post('/teams/blacklist', async (req: Request, res: Response) => {
  try {
    const { userId, teamId } = req.body;
    if (!userId || !teamId) {
      res.status(400).json({ error: 'Не указан userId или teamId' });
      return;
    }

    const cleanUserId = normalizeUserId(userId);
    const db = await getPgDB();
    const user = findUserInDb(db, cleanUserId);
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    let blacklist: string[] = [];
    try {
      if (user.team_blacklist) {
        blacklist = typeof user.team_blacklist === 'string' ? JSON.parse(user.team_blacklist) : user.team_blacklist;
      }
    } catch (e) {}

    if (!blacklist.includes(teamId)) {
      blacklist.push(teamId);
    }

    db.run(
      `UPDATE users SET team_blacklist = ? WHERE id = ? OR telegram_id = ?`,
      [JSON.stringify(blacklist), cleanUserId, cleanUserId]
    );

    // Also remove user from the team
    removeMemberFromTeamInDb(db, teamId, cleanUserId);

    savePgDB();
    res.json({ success: true, message: 'Команда добавлена в черный список', teamBlacklist: blacklist });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка добавления в черный список: ' + err.message });
  }
});

apiRouter.delete('/teams/blacklist/:teamId', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.teamId;
    const rawUserId = req.query.userId as string;
    if (!rawUserId) {
      res.status(400).json({ error: 'Не указан userId' });
      return;
    }

    const cleanUserId = normalizeUserId(rawUserId);
    const db = await getPgDB();
    const user = findUserInDb(db, cleanUserId);
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    let blacklist: string[] = [];
    try {
      if (user.team_blacklist) {
        blacklist = typeof user.team_blacklist === 'string' ? JSON.parse(user.team_blacklist) : user.team_blacklist;
      }
    } catch (e) {}

    blacklist = blacklist.filter(id => id !== teamId);

    db.run(
      `UPDATE users SET team_blacklist = ? WHERE id = ? OR telegram_id = ?`,
      [JSON.stringify(blacklist), cleanUserId, cleanUserId]
    );

    savePgDB();
    res.json({ success: true, message: 'Команда удалена из черного списка', teamBlacklist: blacklist });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка удаления из черного списка: ' + err.message });
  }
});

// Report Team to Admin in Telegram (16926299042)
apiRouter.post('/teams/report', async (req: Request, res: Response) => {
  try {
    const { reporterId, reporterName, teamId, teamName, ownerId, reason, details } = req.body;
    const db = await getPgDB();

    const reportId = `rep_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();

    // 1. Save report in PostgreSQL DB
    db.run(
      `INSERT INTO team_reports (id, reporter_id, reporter_name, team_id, team_name, owner_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        String(reporterId || 'Unknown'),
        String(reporterName || 'Пользователь'),
        String(teamId || 'Unknown'),
        String(teamName || 'Без названия'),
        String(ownerId || 'Unknown'),
        String(reason || 'Жалоба на команду'),
        String(details || ''),
        'pending',
        createdAt
      ]
    );

    savePgDB();

    // 2. Send Telegram notification to service administrator 16926299042
    const adminTgId = 16926299042;
    const tgMessage = `🚨 <b>ЖАЛОБА НА КОМАНДУ В СЕРВИСЕ</b> 🚨\n\n` +
      `👤 <b>Заявитель:</b> ${reporterName || 'Пользователь'} (ID: <code>${reporterId}</code>)\n` +
      `👥 <b>Команда:</b> ${teamName || 'Без названия'} (ID: <code>${teamId}</code>)\n` +
      `👑 <b>Владелец команды:</b> <code>${ownerId}</code>\n` +
      `⚠️ <b>Причина:</b> <b>${reason || 'Не указана'}</b>\n` +
      `📝 <b>Комментарий:</b> ${details || 'Нет дополнительных деталей'}\n` +
      `🕒 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}`;

    try {
      await sendPrivateTelegramNotification(adminTgId, tgMessage);
    } catch (tgErr) {
      console.error('[Teams Report] Error sending Telegram alert to admin:', tgErr);
    }

    res.json({
      success: true,
      message: 'Жалоба успешно зафиксирована и отправлена администратору сервиса в Telegram (16926299042).'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка отправки жалобы: ' + err.message });
  }
});

apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  const { email, password, firstName, username, ref, referredBy, startParam } = req.body;
  const referralCode = ref || referredBy || startParam;

  if (!email || !password) {
    res.status(400).json({ error: 'Пожалуйста, заполните E-mail и пароль' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
    res.status(400).json({ error: 'Введите корректный E-mail адрес' });
    return;
  }

  if (String(password).length < 4) {
    res.status(400).json({ error: 'Пароль должен содержать не менее 4 символов' });
    return;
  }

  const existingUser = DB.getUserByEmail(cleanEmail);
  if (existingUser) {
    res.status(400).json({ error: 'Пользователь с таким E-mail уже зарегистрирован. Воспользуйтесь входом.' });
    return;
  }

  const newId = String(Math.floor(10000000000 + Math.random() * 90000000000));
  const cleanUsername = username ? (String(username).startsWith('@') ? String(username) : `@${username}`) : `@${cleanEmail.split('@')[0]}`;
  const { referrer, referredByNumeric } = resolveReferrerForCode(referralCode, [newId]);

  const newUser: any = {
    id: newId,
    email: cleanEmail,
    passwordHash: hashPassword(String(password).trim()),
    firstName: firstName ? String(firstName).trim() : cleanEmail.split('@')[0],
    lastName: '',
    username: cleanUsername,
    role: 'editor',
    tariff: 'Старт',
    createdAt: new Date().toISOString(),
    balance: 300,
    referredBy: referredByNumeric,
    referralRewardBalance: 0
  };

  DB.addUser(newUser, { skipPgInsert: true });

  await insertRow('users', {
    id: newUser.id,
    first_name: newUser.firstName,
    last_name: newUser.lastName,
    username: newUser.username,
    email: newUser.email,
    password_hash: newUser.passwordHash,
    role: newUser.role,
    tariff: 'Старт',
    balance: 0,
    balance_start: 0,
    balance_free: 0,
    referred_by: newUser.referredBy,
    referral_reward_balance: 0,
    created_at: newUser.createdAt
  }).catch(() => null);

  // If referred, credit referrer +300 ИИрок cleanly across PG, pg-mem, and transactions ledger
  if (referrer) {
    await applyReferralBonusForRegistration(referrer, newUser, 'Email');
  }

  try {
    const db = await getPgDB();
    checkAndApplyStartRegistrationBonus(db, newUser.id, 'email');
    handleAutoJoinTeamInvite(db, newUser, referralCode);
    await flushPendingPgWrites().catch(() => null);
    ensureUserJoinedIismmChat(newUser.id, { clearLeftStatus: true, db }).catch(() => null);
  } catch (e) {}

  // Send welcome email via SMTP
  sendEmail({
    to: cleanEmail,
    subject: '🎉 Регистрация в ИИ SMM Платформе прошла успешно!',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 16px;">
        <h2 style="color: #ec4899; margin-top: 0;">Приветствуем на ИИ SMM Платформе!</h2>
        <p>Ваш аккаунт <strong>${cleanEmail}</strong> успешно зарегистрирован на тарифе «Старт» и сохранен в базе данных.</p>
        <div style="background: #ffffff; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px; color: #334155;">🎁 Вам начислено <strong>300 ИИрок</strong> на стартовый баланс + <strong>300 ИИрок каждый месяц бесплатно</strong>!</p>
        </div>
        <p style="font-size: 13px; color: #64748b;">Вы можете настраивать публикации, подключать телеграм-каналы и генерировать посты с помощью ИИ.</p>
        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">ИИ SMM Автоматизация • ProTalk API</p>
      </div>
    `
  }).catch(err => console.error('[SMTP Error]:', err));

  res.status(201).json({
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      username: newUser.username,
      role: newUser.role,
      tariff: newUser.tariff,
      referredBy: newUser.referredBy,
      createdAt: newUser.createdAt,
      balance: newUser.balance
    }
  });
});

apiRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Пожалуйста, укажите ваш E-mail' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = DB.getUserByEmail(cleanEmail);

  if (!user) {
    res.status(404).json({ error: 'Пользователь с таким E-mail не найден в базе данных' });
    return;
  }

  // Generate token for link and 6-char code as backup
  const resetToken = crypto.randomBytes(24).toString('hex');
  const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Save in store for 1 hour
  resetTokensStore.set(resetToken, {
    userId: user.id,
    email: cleanEmail,
    expiresAt: Date.now() + 3600000
  });

  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  try {
    await sendEmail({
      to: cleanEmail,
      subject: '🔑 Восстановление пароля | ИИSMM',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 16px; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <h2 style="color: #0284c7; margin-top: 0; font-size: 20px;">Сброс пароля ИИSMM</h2>
          <p style="font-size: 14px; line-height: 1.5;">Здравствуйте, <strong>${user.firstName || user.username || cleanEmail}</strong>!</p>
          <p style="font-size: 14px; line-height: 1.5; color: #475569;">Вы запросили сброс пароля для вашего аккаунта на ИИSMM Платформе.</p>
          
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(120deg, #38bdf8 0%, #0284c7 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
              🔑 Нажмите для сброса пароля ➔
            </a>
          </div>

          <div style="background: #f0f9ff; border: 1px dashed #0284c7; padding: 14px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <span style="font-size: 11px; color: #0369a1; font-weight: bold; display: block; margin-bottom: 4px;">ИЛИ ВВЕДИТЕ КОД НА СТРАНИЦЕ СБРОСА:</span>
            <strong style="font-size: 22px; color: #0284c7; letter-spacing: 2px; font-family: monospace;">${resetCode}</strong>
          </div>

          <p style="font-size: 12px; color: #64748b;">Ссылка действительна в течение 1 часа. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
          <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">ИИSMM Автоматизация • info@arenda-ropa.com</p>
        </div>
      `
    });

    res.json({
      success: true,
      resetToken,
      resetCode,
      message: `Инструкция и кнопка сброса пароля отправлены на ${cleanEmail} via SMTP!`
    });
  } catch (err: any) {
    console.error('[SMTP Reset Exception]:', err);
    res.json({
      success: true,
      resetToken,
      resetCode,
      message: `Ключ сброса сформирован. Перейдите на страницу /reset-password?token=${resetToken}`
    });
  }
});

apiRouter.get('/auth/verify-reset-token', (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ error: 'Не указан токен сброса пароля' });
    return;
  }

  const tokenData = resetTokensStore.get(token);
  if (!tokenData || tokenData.expiresAt < Date.now()) {
    res.status(400).json({ error: 'Ссылка для сброса пароля устарела или недействительна' });
    return;
  }

  res.json({
    valid: true,
    email: tokenData.email
  });
});

apiRouter.post('/auth/reset-password', (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    res.status(400).json({ error: 'Пожалуйста, укажите токен и новый пароль' });
    return;
  }

  if (String(newPassword).length < 4) {
    res.status(400).json({ error: 'Новый пароль должен содержать не менее 4 символов' });
    return;
  }

  const tokenData = resetTokensStore.get(token);
  if (!tokenData || tokenData.expiresAt < Date.now()) {
    res.status(400).json({ error: 'Токен сброса пароля устарел или недействителен. Запросите сброс повторно.' });
    return;
  }

  const user = DB.getUserById(tokenData.userId) || DB.getUserByEmail(tokenData.email);
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }

  const newPasswordHash = hashPassword(String(newPassword).trim());
  DB.updateUser(user.id, { passwordHash: newPasswordHash });
  updateRow('users', user.id, { password_hash: newPasswordHash }).catch(() => null);

  // Remove used token
  resetTokensStore.delete(token);

  res.json({
    success: true,
    message: 'Пароль успешно изменен! Выполняем вход...',
    user: {
      id: user.id,
      telegramId: user.telegramId,
      email: user.email,
      role: user.role,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      username: user.username || '',
      photoUrl: user.photoUrl || '',
      balance: user.balance || 0,
      createdAt: user.createdAt
    }
  });
});

// Users Management CRUD (System Admin)
async function fetchTelegramAvatarPhoto(telegramId: number | string): Promise<string> {
  const parsedId = typeof telegramId === 'number' ? telegramId : parseInt(String(telegramId), 10);
  if (isNaN(parsedId)) return '';
  try {
    const galleryUrl = await ensureUserTelegramAvatarInGallery(parsedId);
    if (galleryUrl) return galleryUrl;
  } catch (err) {
    console.error(`Error fetching Telegram avatar for user ${parsedId}:`, err);
  }
  return '';
}

apiRouter.get('/users', (req: Request, res: Response) => {
  res.json(DB.getUsers());
});

apiRouter.post('/users/sync-telegram-photos', async (req: Request, res: Response) => {
  try {
    const users = DB.getUsers();
    let updatedCount = 0;
    const results: any[] = [];

    for (const u of users) {
      if (u.telegramId) {
        const photo = await fetchTelegramAvatarPhoto(u.telegramId);
        if (photo) {
          DB.updateUser(u.id, { photoUrl: photo });
          updatedCount++;
          results.push({ id: u.id, telegramId: u.telegramId, photoUrl: photo });
        }
      }
    }

    res.json({
      success: true,
      updatedCount,
      results,
      message: `Успешно спарсено и обновлено ${updatedCount} аватарок пользователей из Telegram`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка спарсинга аватарок Telegram' });
  }
});

apiRouter.get('/users/:id', async (req: Request, res: Response, next) => {
  const targetId = (req.params.id || '').trim();
  if (targetId === 'me' || targetId === 'search') {
    return next();
  }
  if (!targetId || targetId === 'undefined' || targetId === 'null') {
    res.status(400).json({ error: 'ID пользователя не указан' });
    return;
  }
  const numId = Number(targetId);

  try {
    let foundUser: any = null;

    // 1. Search in DB memory
    const memoryUsers = DB.getUsers();
    foundUser = memoryUsers.find(u => 
      String(u.id) === targetId ||
      (u.telegramId && String(u.telegramId) === targetId) ||
      (u.username && u.username.toLowerCase().replace(/^@/, '') === targetId.toLowerCase().replace(/^@/, ''))
    );

    // 2. Search in PostgreSQL users table
    if (!foundUser) {
      try {
        const db = await getPgDB();
        const safeTargetId = targetId.replace(/'/g, "''");
        const safeTgId = !isNaN(numId) ? numId : -1;
        const cleanHandle = targetId.toLowerCase().replace(/^@/, '').replace(/'/g, "''");

        const resQuery = db.exec(`
          SELECT id, email, role, telegram_id, first_name, last_name, username, photo_url, profile_link, bio, balance, created_at 
          FROM users 
          WHERE id = '${safeTargetId}' 
             OR telegram_id = ${safeTgId} 
             OR LOWER(REPLACE(username, '@', '')) = '${cleanHandle}'
          LIMIT 1
        `);

        if (resQuery && resQuery[0] && resQuery[0].values && resQuery[0].values[0]) {
          const cols = resQuery[0].columns;
          const row = resQuery[0].values[0];
          const rowObj: any = {};
          cols.forEach((col, idx) => { rowObj[col] = row[idx]; });
          foundUser = {
            id: String(rowObj.id),
            telegramId: rowObj.telegram_id,
            firstName: rowObj.first_name,
            lastName: rowObj.last_name,
            username: rowObj.username,
            photoUrl: rowObj.photo_url,
            avatarUrl: rowObj.photo_url,
            bio: rowObj.bio,
            role: rowObj.role,
            balance: rowObj.balance,
            createdAt: rowObj.created_at
          };
        }
      } catch (e) {
        console.error('[API] /users/:id PostgreSQL query error:', e);
      }
    }

    // 3. Search in team members if any
    if (!foundUser) {
      try {
        const db = await getPgDB();
        const allTeams = getAllTeamsFromDb(db);
        for (const t of allTeams) {
          const mem = (t.members as any[])?.find((m: any) => 
            String(m.userId) === targetId || 
            (m.telegramId && String(m.telegramId) === targetId) ||
            (m.handle && m.handle.toLowerCase().replace(/^@/, '') === targetId.toLowerCase().replace(/^@/, ''))
          );
          if (mem) {
            const memPhoto = normalizeProTalkMediaUrl((mem as any).avatar || (mem as any).photoUrl);
            foundUser = {
              id: String(mem.userId || targetId),
              telegramId: mem.telegramId,
              firstName: mem.name,
              lastName: '',
              username: mem.handle,
              photoUrl: memPhoto || undefined,
              avatarUrl: memPhoto || undefined,
              role: mem.role || 'Участник',
              balance: 1000
            };
            break;
          }
        }
      } catch (e) {}
    }

    // 4. Fallback for numeric Telegram ID
    if (!foundUser) {
      if (!isNaN(numId) && numId > 0) {
        const syncedGalleryAvatar = await ensureUserTelegramAvatarInGallery(numId, undefined, String(numId));
        const fallbackAvatar =
          syncedGalleryAvatar ||
          (String(numId).startsWith('169262990') ? BRAND_ASSETS.ownerAvatar : BRAND_ASSETS.heartAvatar);
        foundUser = {
          id: String(numId),
          telegramId: numId,
          firstName: `Пользователь`,
          lastName: `${numId}`,
          username: `id${numId}`,
          photoUrl: fallbackAvatar,
          avatarUrl: fallbackAvatar,
          role: 'user',
          balance: 300
        };
      } else {
        res.status(404).json({ error: 'Пользователь не найден' });
        return;
      }
    }

    // Clean up first/last name to prevent duplicate surname
    const rawFirst = (foundUser.firstName || foundUser.first_name || '').trim();
    const rawLast = (foundUser.lastName || foundUser.last_name || '').trim();
    const rawName = (foundUser.name || '').trim();

    let cleanFirst = rawFirst;
    let cleanLast = rawLast;
    let displayName = '';

    if (rawFirst && rawLast) {
      if (rawFirst.toLowerCase() === rawLast.toLowerCase()) {
        cleanFirst = rawFirst;
        cleanLast = '';
        displayName = rawFirst;
      } else if (rawFirst.toLowerCase().includes(rawLast.toLowerCase())) {
        displayName = rawFirst;
        cleanLast = rawLast;
      } else if (rawLast.toLowerCase().includes(rawFirst.toLowerCase())) {
        displayName = rawLast;
        cleanFirst = rawFirst;
      } else {
        displayName = `${rawFirst} ${rawLast}`;
      }
    } else if (rawName) {
      displayName = rawName;
      if (!cleanFirst) {
        const parts = rawName.split(/\s+/);
        cleanFirst = parts[0] || rawName;
        cleanLast = parts.slice(1).join(' ');
      }
    } else {
      displayName = cleanFirst || cleanLast || (foundUser.username ? `@${foundUser.username.replace(/^@/, '')}` : `Пользователь ${targetId}`);
    }

    const rawAvatarCandidate = normalizeProTalkMediaUrl(foundUser.photoUrl || foundUser.avatarUrl);
    const isLegacyAvatar =
      !rawAvatarCandidate ||
      rawAvatarCandidate.includes('/api/avatar/') ||
      rawAvatarCandidate.includes('dicebear.com') ||
      rawAvatarCandidate.includes('unsplash.com');
    const resolvedFallbackAvatar =
      String(foundUser.id).startsWith('169262990') || String(foundUser.telegramId || '') === '169262990'
        ? BRAND_ASSETS.ownerAvatar
        : BRAND_ASSETS.heartAvatar;
    const effectiveAvatar = !isLegacyAvatar ? rawAvatarCandidate : resolvedFallbackAvatar;

    const cleanUser = {
      id: String(foundUser.id),
      telegramId: foundUser.telegramId,
      name: displayName,
      firstName: cleanFirst,
      lastName: cleanLast,
      username: foundUser.username ? foundUser.username.replace(/^@/, '') : undefined,
      telegramUsername: foundUser.username ? (foundUser.username.startsWith('@') ? foundUser.username : `@${foundUser.username}`) : undefined,
      photoUrl: effectiveAvatar,
      avatarUrl: effectiveAvatar,
      bio: foundUser.bio,
      role: foundUser.role || 'user',
      tariff: foundUser.tariff || 'Старт',
      balance: foundUser.balance || 300,
      iirky: foundUser.balance || foundUser.iirky || 300,
      createdAt: foundUser.createdAt || foundUser.created_at || new Date().toISOString()
    };

    res.json({
      success: true,
      ...cleanUser,
      user: cleanUser
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка загрузки пользователя: ' + err.message });
  }
});

// Legacy /users/me removed here so /users/me routes directly to the PostgreSQL-backed handler below.

apiRouter.post('/users', (req: Request, res: Response) => {
  const { email, password, role, telegramId, firstName, lastName, username, photoUrl, balance } = req.body;
  if (!email && !telegramId) {
    res.status(400).json({ error: 'Пожалуйста, заполните email или Telegram ID' });
    return;
  }

  if (email) {
    const existing = DB.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }
  }

  if (telegramId) {
    const parsedTgId = parseInt(telegramId, 10);
    if (!isNaN(parsedTgId)) {
      const existing = DB.getUserByTelegramId(parsedTgId);
      if (existing) {
        res.status(409).json({ error: 'Пользователь с таким Telegram ID уже существует' });
        return;
      }
    }
  }

  const newUser = {
    id: telegramId ? String(telegramId) : ('user_' + Math.random().toString(36).substr(2, 9)),
    email: email || undefined,
    passwordHash: password ? hashPassword(password) : undefined,
    role: role || 'editor',
    telegramId: telegramId ? parseInt(telegramId, 10) : undefined,
    firstName: firstName || '',
    lastName: lastName || '',
    username: username || '',
    photoUrl: photoUrl || '',
    balance: balance !== undefined ? parseInt(balance, 10) : ((role || 'editor') === 'admin' ? 1000 : 500),
    createdAt: new Date().toISOString()
  };

  DB.addUser(newUser);
  res.status(201).json({
    success: true,
    user: newUser
  });
});

apiRouter.put('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, password, role, telegramId, firstName, lastName, username, photoUrl, balance } = req.body;

  try {
    const updateData: any = {};
    if (email) {
      const existing = DB.getUserByEmail(email);
      if (existing && existing.id !== id) {
        res.status(409).json({ error: 'Пользователь с таким email уже существует' });
        return;
      }
      updateData.email = email;
    } else if (email === '') {
      updateData.email = undefined;
    }

    if (telegramId !== undefined) {
      if (telegramId === '' || telegramId === null) {
        updateData.telegramId = undefined;
      } else {
        const parsedTgId = parseInt(telegramId, 10);
        if (!isNaN(parsedTgId)) {
          const existing = DB.getUserByTelegramId(parsedTgId);
          if (existing && existing.id !== id) {
            res.status(409).json({ error: 'Пользователь с таким Telegram ID уже существует' });
            return;
          }
          updateData.telegramId = parsedTgId;
        }
      }
    }

    if (role) {
      updateData.role = role;
    }
    if (password && password.trim() !== '') {
      updateData.passwordHash = hashPassword(password);
    }
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (username !== undefined) updateData.username = username;
    if (photoUrl !== undefined) updateData.photoUrl = normalizeProTalkMediaUrl(photoUrl);
    if (req.body.userAvatar !== undefined) updateData.userAvatar = normalizeProTalkMediaUrl(req.body.userAvatar);
    if (req.body.user_avatar !== undefined) updateData.userAvatar = normalizeProTalkMediaUrl(req.body.user_avatar);
    if (req.body.avatarUrl !== undefined) {
      const normalizedBodyAvatar = normalizeProTalkMediaUrl(req.body.avatarUrl);
      updateData.userAvatar = normalizedBodyAvatar;
      updateData.photoUrl = normalizedBodyAvatar;
    }
    if (req.body.timezone !== undefined) updateData.timezone = req.body.timezone;
    if (balance !== undefined) {
      const numBal = typeof balance === 'number' ? balance : parseInt(balance, 10);
      if (!isNaN(numBal)) {
        updateData.balance = numBal;
      }
    }

    let updatedUser = DB.updateUser(id, updateData);

    getPgDB()
      .then((db) => {
        if (!db) return;
        const resolvedPhoto = updateData.photoUrl !== undefined
          ? expandShortGalleryUrlToFull(db, updateData.photoUrl) || updateData.photoUrl
          : undefined;
        const resolvedAvatar = updateData.userAvatar !== undefined
          ? expandShortGalleryUrlToFull(db, updateData.userAvatar) || updateData.userAvatar
          : undefined;

        if (resolvedPhoto !== undefined) {
          db.run('UPDATE users SET photo_url = ? WHERE id = ?', [resolvedPhoto || '', id]);
          DB.updateUser(id, { photoUrl: resolvedPhoto });
        }
        if (resolvedAvatar !== undefined) {
          db.run('UPDATE users SET user_avatar = ? WHERE id = ?', [resolvedAvatar || '', id]);
          DB.updateUser(id, { userAvatar: resolvedAvatar });
        }
        if (updateData.firstName !== undefined) {
          db.run('UPDATE users SET first_name = ? WHERE id = ?', [updateData.firstName || '', id]);
        }
        if (updateData.lastName !== undefined) {
          db.run('UPDATE users SET last_name = ? WHERE id = ?', [updateData.lastName || '', id]);
        }
        if (updateData.username !== undefined) {
          db.run('UPDATE users SET username = ? WHERE id = ?', [updateData.username || '', id]);
        }
        if (updateData.email !== undefined) {
          db.run('UPDATE users SET email = ? WHERE id = ?', [updateData.email || '', id]);
        }
        if (updateData.passwordHash) {
          db.run('UPDATE users SET password_hash = ? WHERE id = ?', [updateData.passwordHash, id]);
        }
        if (updateData.telegramId !== undefined) {
          db.run('UPDATE users SET telegram_id = ? WHERE id = ?', [
            updateData.telegramId || null,
            id
          ]);
        }
        if (updateData.email || updateData.telegramId) {
          const bonusMethod = updateData.email ? 'email' : 'telegram';
          const bonusRes = checkAndApplyStartRegistrationBonus(db, id, bonusMethod);
          if (bonusRes.applied) {
            const balRes = db.exec('SELECT balance FROM users WHERE id = ? LIMIT 1', [id]);
            const nextBal = balRes[0]?.values?.[0]?.[0];
            if (nextBal !== undefined && nextBal !== null) {
              DB.updateUser(id, { balance: Number(nextBal) });
            }
          }
        }
        savePgDB();
      })
      .catch(() => null);

    res.json({
      success: true,
      user: updatedUser
    });
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

apiRouter.delete('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Don't allow deleting the last administrator
  const users = DB.getUsers();
  const userToDelete = users.find(u => u.id === id);
  if (userToDelete && userToDelete.role === 'admin') {
    const adminCount = users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      res.status(400).json({ error: 'Нельзя удалить единственного администратора системы!' });
      return;
    }
  }

  DB.deleteUser(id);
  res.json({ success: true });
});

// Prompts CRUD
apiRouter.get('/prompts', (req: Request, res: Response) => {
  res.json(DB.getPrompts());
});

apiRouter.post('/prompts', (req: Request, res: Response) => {
  const { 
    title, 
    dayOfWeek, 
    category, 
    content, 
    authorId,
    messageFormat,
    uppercaseHeader,
    signature,
    attachmentType,
    attachmentUrl
  } = req.body;

  if (!title || !dayOfWeek || !category || !content) {
    res.status(400).json({ error: 'Не все обязательные поля заполнены' });
    return;
  }
  const prompt = DB.addPrompt({
    title,
    dayOfWeek,
    category,
    content,
    authorId: authorId || 'admin_1',
    messageFormat,
    uppercaseHeader,
    signature,
    attachmentType,
    attachmentUrl
  });
  res.status(201).json(prompt);
});

apiRouter.put('/prompts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const prompt = DB.updatePrompt(id, req.body);
    res.json(prompt);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

apiRouter.delete('/prompts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  DB.deletePrompt(id);
  res.json({ success: true });
});

// Publications (History & Trigger publishing)
apiRouter.get('/publications', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  res.json(DB.getPublications(userId));
});

apiRouter.delete('/publications/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  DB.deletePublication(id, userId);
  res.json({ success: true, message: 'Публикация удалена из базы данных' });
});

// History: Batch deletion of posts/publications
apiRouter.post('/history/batch-delete', (req: Request, res: Response) => {
  const { postIds } = req.body;
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return res.status(400).json({ error: 'Список ID для удаления пуст' });
  }
  const deletedCount = DB.deleteManyPosts(postIds);
  res.json({ success: true, count: deletedCount, message: `Успешно удалено записей: ${deletedCount}` });
});

// History: Real-time uniqueness check for post title
apiRouter.post('/history/check-title', (req: Request, res: Response) => {
  const { title, excludeId } = req.body;
  const rawTitle = String(title || '').trim();
  const suggestedTitle = DB.ensureUniquePostTitle(rawTitle, excludeId);
  const isUnique = rawTitle.toLowerCase() === suggestedTitle.toLowerCase();
  res.json({ isUnique, suggestedTitle });
});

// History: Manual single post addition
apiRouter.post('/history/posts', (req: Request, res: Response) => {
  try {
    const rawUserId = (req.body.userId as string) || (req.headers['x-user-id'] as string) || '16926299042';
    const userId = normalizeUserId(rawUserId);

    let title = String(req.body.title || '').trim();
    if (!title) {
      title = 'Пост без названия';
    }
    const uniqueTitle = DB.ensureUniquePostTitle(title, req.body.id);

    let channel = String(req.body.channel || '').trim();
    if (!channel) {
      const userChannels = DB.getChannels(userId);
      channel = userChannels[0]?.username || '@SAV_AI';
    }
    if (!channel.startsWith('@') && !channel.startsWith('https://')) {
      channel = '@' + channel;
    }

    let status = String(req.body.status || 'создается').toLowerCase().trim();
    if (status !== 'создается' && status !== 'отложено' && status !== 'опубликовано' && status !== 'ошибка') {
      status = 'создается';
    }

    let messageFormat = String(req.body.messageFormat || 'v2').toLowerCase().trim();
    if (messageFormat !== 'v2' && messageFormat !== 'rich') {
      messageFormat = 'v2';
    }

    const postId = req.body.id && String(req.body.id).trim()
      ? String(req.body.id).trim()
      : ('p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4));

    const postText = String(req.body.postText || req.body.text || uniqueTitle).trim();
    const category = String(req.body.category || 'Общее').trim();
    const signature = String(req.body.signature || '').trim();
    const displayDate = req.body.displayDate ? new Date(req.body.displayDate).toISOString() : new Date().toISOString();

    const newPost = DB.addDayRequest({
      id: postId,
      userId,
      title: uniqueTitle,
      requestTemplate: `Создано вручную: ${uniqueTitle}`,
      postText,
      channel,
      channels: [channel],
      status,
      messageFormat: messageFormat as any,
      category,
      signature,
      createdAt: displayDate,
      scheduledTime: status === 'отложено' ? displayDate : undefined,
      publishedAt: status === 'опубликовано' ? displayDate : undefined
    });

    res.json({ success: true, post: newPost, message: 'Пост успешно сохранен в базе данных' });
  } catch (err: any) {
    console.error('Error creating history post:', err);
    res.status(500).json({ error: err.message || 'Ошибка создания поста' });
  }
});

// History: Batch import from CSV
apiRouter.post('/history/import', (req: Request, res: Response) => {
  try {
    const rawUserId = (req.body.userId as string) || (req.headers['x-user-id'] as string) || '16926299042';
    const userId = normalizeUserId(rawUserId);
    const { posts } = req.body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ error: 'Список постов для импорта пуст' });
    }

    const userChannels = DB.getChannels(userId);
    const fallbackChannel = userChannels[0]?.username || '@SAV_AI';

    const createdPosts: any[] = [];
    let autoCorrectedCount = 0;

    for (let i = 0; i < posts.length; i++) {
      const row = posts[i];
      if (!row || typeof row !== 'object') continue;

      let rawTitle = String(row.title || row.Заголовок || row.name || '').trim();
      if (!rawTitle) {
        rawTitle = `Импортированный пост ${i + 1}`;
        autoCorrectedCount++;
      }
      const uniqueTitle = DB.ensureUniquePostTitle(rawTitle);

      let channel = String(row.channel || row.Канал || '').trim();
      if (!channel) {
        channel = fallbackChannel;
        autoCorrectedCount++;
      } else if (!channel.startsWith('@') && !channel.startsWith('https://')) {
        channel = '@' + channel;
      }

      let status = String(row.status || row.Статус || 'создается').toLowerCase().trim();
      if (status === 'draft' || status === 'черновик' || status === 'creating') status = 'создается';
      else if (status === 'scheduled' || status === 'план' || status === 'запланировано') status = 'отложено';
      else if (status === 'published' || status === 'sent' || status === 'готов') status = 'опубликовано';
      else if (status !== 'создается' && status !== 'отложено' && status !== 'опубликовано' && status !== 'ошибка') {
        status = 'создается';
        autoCorrectedCount++;
      }

      let format = String(row.format || row.Формат || row.messageFormat || 'v2').toLowerCase().trim();
      if (format.includes('rich') || format.includes('html')) format = 'rich';
      else format = 'v2';

      let text = String(row.text || row.Текст || row.content || '').trim();
      if (!text) {
        text = uniqueTitle;
        autoCorrectedCount++;
      }

      const category = String(row.category || row.Категория || 'Импорт').trim();
      const signature = String(row.signature || row.Подпись || '').trim();

      let dateVal = row.display_date || row.displayDate || row.date || row.Дата || '';
      let parsedDate = dateVal ? new Date(dateVal) : new Date();
      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
        autoCorrectedCount++;
      }
      const finalIsoDate = parsedDate.toISOString();

      const postId = row.id && String(row.id).trim() && !String(row.id).startsWith('p_example')
        ? String(row.id).trim()
        : ('imp_' + Date.now().toString(36) + '_' + i);

      const added = DB.addDayRequest({
        id: postId,
        userId,
        title: uniqueTitle,
        requestTemplate: `Импорт из CSV: ${uniqueTitle}`,
        postText: text,
        channel,
        channels: [channel],
        status,
        messageFormat: format as any,
        category,
        signature,
        createdAt: finalIsoDate,
        scheduledTime: status === 'отложено' ? finalIsoDate : undefined,
        publishedAt: status === 'опубликовано' ? finalIsoDate : undefined
      });

      createdPosts.push(added);
    }

    res.json({
      success: true,
      importedCount: createdPosts.length,
      autoCorrectedCount,
      posts: createdPosts,
      message: `Успешно импортировано ${createdPosts.length} постов (автоматически исправлено полей: ${autoCorrectedCount})`
    });
  } catch (err: any) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: err.message || 'Ошибка импорта CSV' });
  }
});

// History: Download CSV Template with prefilled user options
apiRouter.get('/history/csv-template', (req: Request, res: Response) => {
  const rawUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '16926299042';
  const userId = normalizeUserId(rawUserId);
  const channels = DB.getChannels(userId);
  const ch1 = channels[0]?.username || '@SAV_AI';
  const ch2 = channels[1]?.username || ch1;

  const csvRows = [
    'id,title,text,channel,status,format,category,display_date,signature',
    `p_example_1,"5 главных трендов искусственного интеллекта в 2026 году","Искусственный интеллект кардинально меняет работу с социальными сетями и аудиторией. Вот ключевые тенденции: 1. Мультимодальные модели, 2. Автономные агенты публикации, 3. Глубокая персонализация текстов, 4. Генерация видео, 5. Интеграция с мессенджерами.",${ch1},опубликовано,v2,Нейросети и ИИ,2026-09-29 10:00:00,#ии #тренды #технологии`,
    `p_example_2,"Как привлечь первые 1000 подписчиков в Telegram без бюджета","Практический гайд по запуску авторского канала: используйте взаимный пиар, уникальный контент и отложенные сценарии публикации.",${ch2},отложено,rich,Бизнес и маркетинг,2026-09-30 14:30:00,#маркетинг #telegram #бизнес`,
    `p_example_3,"Пошаговая автоматизация SMM-процессов","Разгрузите свою рутину: настройка регулярного контент-плана, проверка уникальности заголовков и автогенерация обложек для каждого поста.",${ch1},создается,v2,Технологии,2026-10-01 09:15:00,#smm #автоматизация`
  ];

  // UTF-8 BOM for Excel Cyrillic support
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="history_posts_template.csv"');
  res.send(csvContent);
});

apiRouter.delete('/publication-logs/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  DB.deletePublicationLog(id);
  res.json({ success: true, message: 'Лог публикации удален' });
});

apiRouter.delete('/scenario-logs/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  DB.deleteScenarioLog(id);
  res.json({ success: true, message: 'Лог сценария удален' });
});

apiRouter.post('/publications/publish', async (req: Request, res: Response) => {
  const { 
    title, 
    content, 
    dayRequestId,
    messageFormat,
    uppercaseHeader,
    signature,
    attachmentType,
    audioFormat,
    audioTitle,
    audioPerformer,
    attachmentUrl,
    attachmentUrls,
    inlineButtons,
    channels,
    userId,
    linkPreviewEnabled,
    protectContent
  } = req.body;
  
  const effectiveTitle = String(title || '').trim() || 'Новая публикация';

  const dayRequests = DB.getDayRequests();
  const dayRequest: any = dayRequests.find(r => r.id === dayRequestId) || dayRequests[0] || {
    id: 'req_default',
    dayOfWeek: 'Понедельник',
    category: 'общий',
    requestTemplate: '',
    channel: '@SAV_AI',
    title: effectiveTitle,
    signature: signature || '',
    linkPreviewEnabled: linkPreviewEnabled !== false
  };

  const requestedFormat = messageFormat || dayRequest.messageFormat;
  const effectiveFormat = detectMessageFormat(content || '', requestedFormat);
  const resolvedAttachmentType = attachmentType || dayRequest.attachmentType || 'none';
  const resolvedAudioFormat = audioFormat || dayRequest.audioFormat || (resolvedAttachmentType === 'voice' ? 'voice' : 'audio');
  const resolvedAudioTitle = audioTitle !== undefined ? audioTitle : dayRequest.audioTitle;
  const resolvedAudioPerformer = audioPerformer !== undefined ? audioPerformer : dayRequest.audioPerformer;
  const resolvedProtectContent = protectContent !== undefined ? Boolean(protectContent) : Boolean(dayRequest.protectContent);
  const resolvedLinkPreview = linkPreviewEnabled !== undefined ? Boolean(linkPreviewEnabled) : (dayRequest.linkPreviewEnabled !== false);

  let user: any = null;
  if (userId) {
    user = DB.getUsers().find(u => u.id === userId);
  }

  try {
    // Send to Telegram with rich formatting options & inline buttons
    const manualBucket = Math.floor(Date.now() / 15000);
    const result = await sendPromptToTelegram(effectiveTitle, content, dayRequest, {
      messageFormat: effectiveFormat,
      uppercaseHeader,
      signature,
      linkPreviewEnabled: resolvedLinkPreview,
      protectContent: resolvedProtectContent,
      attachmentType: resolvedAttachmentType,
      audioFormat: resolvedAudioFormat,
      audioTitle: resolvedAudioTitle,
      audioPerformer: resolvedAudioPerformer,
      attachmentUrl,
      attachmentUrls,
      inlineButtons,
      channels,
      telegramId: user?.telegramId || req.body.telegramId || 169262990,
      dedupKey: dayRequestId && dayRequestId !== 'req_default' ? `manual_pub:${dayRequestId}:${manualBucket}` : undefined
    });

    const updatedBalance = user ? user.balance : undefined;

    const effectiveUserId = userId || user?.id || (req.headers['x-user-id'] as string) || '';

    const nowIso = new Date().toISOString();
    // Save publication in history (never loop back into cron)
    const publication = DB.addPublication({
      userId: effectiveUserId,
      promptId: dayRequestId,
      promptTitle: effectiveTitle,
      text: content,
      channel: result.channel || dayRequest.channel || '@SAV_AI',
      messageId: result.messageId,
      status: result.ok,
      statusType: result.ok ? 'published' : 'failed',
      publishedAt: nowIso,
      response: result.error ? `Ошибка отправки. ${result.error}` : (result.simulated ? 'Имитация публикации в Telegram' : 'Опубликовано'),
      attachmentType: resolvedAttachmentType,
      audioFormat: resolvedAudioFormat,
      audioTitle: resolvedAudioTitle,
      audioPerformer: resolvedAudioPerformer,
      protectContent: resolvedProtectContent,
      linkPreviewEnabled: resolvedLinkPreview,
      attachmentUrl: attachmentUrl || dayRequest.attachmentUrl,
      attachmentUrls: attachmentUrls || dayRequest.attachmentUrls,
      inlineButtons: inlineButtons || dayRequest.inlineButtons,
      messageFormat: effectiveFormat,
      signature: signature !== undefined ? signature : dayRequest.signature,
      uppercaseHeader: uppercaseHeader !== false,
      triggerSchedule: { enabled: false }
    });

    DB.addLog({
      publicationId: publication.id,
      action: result.ok ? 'PUBLISHED' : 'FAILED',
      details: result.error || 'Публикация отправлена в Telegram'
    });

    if (result.ok) {
      // Update source draft post status & publishedAt cleanly
      if (dayRequestId && dayRequestId !== 'req_default' && dayRequests.some(r => r.id === dayRequestId)) {
        const currentSched = parseTriggerScheduleSafe(dayRequest.triggerSchedule);
        const isRecurring =
          currentSched.enabled === true && !isOneOffScheduleFrequency(currentSched.frequency);
        try {
          await DB.updateDayRequestAsync(dayRequestId, {
            status: isRecurring ? 'запланирован' : 'опубликован',
            publishedAt: nowIso
          });
          if (!isRecurring) {
            const dbPg = await getPgDB();
            dbPg.run("UPDATE cron SET status = 'paused' WHERE id = ?", [`cron_post_${dayRequestId}`]);
            savePgDB();
          }
        } catch (syncErr) {
          console.warn('[POST /publications/publish] Failed updating dayRequest status:', syncErr);
        }
      }

      let blogPost: any = null;
      const shouldSyncBlog =
        req.body.publishToSocialFeed !== undefined
          ? Boolean(req.body.publishToSocialFeed)
          : dayRequest.publishToSocialFeed !== false;
      if (shouldSyncBlog) {
        blogPost = syncToSocialNetworkFeed({
          sourcePostId: dayRequestId && dayRequestId !== 'req_default' ? dayRequestId : undefined,
          userId: effectiveUserId,
          userName: user?.name,
          userAvatar: user?.avatarUrl,
          title: effectiveTitle,
          content,
          attachmentType: attachmentType || dayRequest.attachmentType,
          attachmentUrl: attachmentUrl || dayRequest.attachmentUrl,
          attachmentUrls: attachmentUrls || dayRequest.attachmentUrls,
          category: dayRequest.category,
          channel: result.channel || dayRequest.channel || '@SAV_AI',
          inlineButtons: inlineButtons || dayRequest.inlineButtons,
          messageFormat: effectiveFormat,
          prompt: dayRequest.requestTemplate || ''
        });
      }

      res.json({
        success: true,
        publication,
        simulated: result.simulated,
        fallbackNotice: result.fallbackNotice,
        updatedBalance,
        blogPost
      });
    } else {
      res.status(400).json({
        success: false,
        publication,
        error: result.error || 'Не удалось отправить публикацию в Telegram',
        updatedBalance
      });
    }
  } catch (error: any) {
    console.error('Error in publication endpoint:', error);
    res.status(500).json({ error: error.message || 'Ошибка при публикации' });
  }
});

// DayRequests (Templates database)
apiRouter.get('/day-requests', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  res.json(DB.getDayRequests(userId));
});

apiRouter.get('/day-requests/:id', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const cleanId = decodeURIComponent(String(req.params.id || '')).trim();
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  let post = DB.getDayRequestById(cleanId, userId);
  if (!post && cleanId) {
    try {
      await refreshTableCacheFromCloud('posts').catch(() => null);
      post = DB.getDayRequestById(cleanId, userId);
    } catch {}
  }
  if (!post) {
    res.status(404).json({ error: 'Публикация не найдена в базе данных' });
    return;
  }
  res.json(post);
});

function validateScheduledDateNotInPast(body: any): string | null {
  const sched = parseTriggerScheduleSafe(body?.triggerSchedule);
  if (sched.enabled !== true || !isOneOffScheduleFrequency(sched.frequency)) return null;
  if (typeof body?.exactDateEpochMs === 'number' && !Number.isNaN(body.exactDateEpochMs)) {
    if (body.exactDateEpochMs <= Date.now() - 60000) {
      return 'Нельзя запланировать публикацию на прошедшие дату и время. Выберите время в будущем.';
    }
    return null;
  }
  const candidate = sched.exactDateTime || sched.scheduledAt || body?.scheduledTime;
  if (candidate) {
    const dt = parseScheduleDateTimeInTimezone(String(candidate), String(sched.timezone || 'Europe/Moscow'));
    if (dt && dt.getTime() <= Date.now() - 60000) {
      return 'Нельзя запланировать публикацию на прошедшие дату и время. Выберите время в будущем.';
    }
  }
  return null;
}

apiRouter.post('/day-requests', async (req: Request, res: Response) => {
  const body = req.body || {};
  const userId = body.userId || (req.headers['x-user-id'] as string) || '';
  const pastErr = validateScheduledDateNotInPast(body);
  if (pastErr) {
    res.status(400).json({ error: pastErr });
    return;
  }

  // Idempotent guard: if explicit ID already exists, update it instead of creating a duplicate
  if (body.id) {
    const existing = DB.getDayRequests().find(r => r.id === String(body.id).trim());
    if (existing) {
      const updated = await DB.updateDayRequestAsync(existing.id, body);
      syncScheduledPublicationsForPost(updated);
      res.json(updated);
      return;
    }
  }

  const normalizedStatus = normalizePostStatus(body.status, { triggerSchedule: body.triggerSchedule });
  const newReq = DB.addDayRequest(
    {
      ...(body.id ? { id: String(body.id).trim() } : {}),
      title: body.title || 'Новый пост без названия',
      category: body.category || 'общее',
      userId,
      status: normalizedStatus,
      requestTemplate: body.requestTemplate || '',
      imagePrompt: body.imagePrompt || '',
      postText: body.postText !== undefined ? body.postText : '',
      channel: body.channel || (Array.isArray(body.channels) && body.channels[0]) || '',
      channels: Array.isArray(body.channels) ? body.channels : body.channel ? [body.channel] : [],
      signature: body.signature !== undefined ? body.signature : '',
      messageFormat: body.messageFormat || 'v2',
      uppercaseHeader: body.uppercaseHeader !== false,
      linkPreviewEnabled: body.linkPreviewEnabled !== false,
      publishToSocialFeed: body.publishToSocialFeed !== false,
      attachmentType: body.attachmentType || 'none',
      audioFormat: body.audioFormat || (body.attachmentType === 'voice' ? 'voice' : 'audio'),
      audioTitle: body.audioTitle || '',
      audioPerformer: body.audioPerformer || '',
      protectContent: Boolean(body.protectContent),
      attachmentUrl: body.attachmentUrl || '',
      attachmentUrls: body.attachmentUrls || [],
      inlineButtons: body.inlineButtons || [],
      uniquenessMemoryCount: body.uniquenessMemoryCount || 0,
      triggerSchedule: body.triggerSchedule || { enabled: false }
    },
    { skipPgInsert: true }
  );

  try {
    await insertRow('posts', DB.buildPgPostRow(newReq));
  } catch (err) {
    console.warn('[POST /day-requests] PG insert warning:', err);
  }

  if (newReq.triggerSchedule?.enabled) {
    syncScheduledPublicationsForPost(newReq);
  }

  res.status(201).json(newReq);
});

apiRouter.put('/day-requests/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const pastErr = validateScheduledDateNotInPast(req.body);
  if (pastErr) {
    res.status(400).json({ error: pastErr });
    return;
  }
  try {
    const existing = DB.getDayRequestById(id);
    const nextTrigger = req.body.triggerSchedule !== undefined ? req.body.triggerSchedule : existing?.triggerSchedule;
    const rawNextStatus = req.body.status !== undefined ? req.body.status : existing?.status;
    const nextStatus =
      isPublishedPostStatus(rawNextStatus) && nextTrigger?.enabled === true
        ? 'запланирован'
        : normalizePostStatus(rawNextStatus, {
            triggerSchedule: nextTrigger,
            publishedAt: req.body.publishedAt ?? existing?.publishedAt
          });

    const updated = await DB.updateDayRequestAsync(id, {
      ...req.body,
      status: nextStatus
    });
    syncScheduledPublicationsForPost(updated);
    res.json(updated);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

apiRouter.delete('/day-requests/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  DB.deleteDayRequest(id);
  // Clean up any upcoming scheduled publications
  syncScheduledPublicationsForPost({ id, triggerSchedule: { enabled: false } } as any);
  res.json({ success: true });
});

// Channels CRUD
apiRouter.get('/channels', (req: Request, res: Response) => {
  const rawUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  const userId = normalizeUserId(rawUserId);
  res.json(DB.getChannels(userId));
});

apiRouter.post('/channels', (req: Request, res: Response) => {
  const { name, username, isActive, userId } = req.body;
  if (!name || !username) {
    res.status(400).json({ error: 'Пожалуйста, укажите название и юзернейм канала' });
    return;
  }
  const effectiveUserId = normalizeUserId(userId || (req.headers['x-user-id'] as string) || '');
  const newCh = DB.addChannel({ name, username, isActive: isActive !== false, userId: effectiveUserId });
  res.status(201).json(newCh);
});

apiRouter.put('/channels/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const updated = DB.updateChannel(id, req.body);
    res.json(updated);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

apiRouter.delete('/channels/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  DB.deleteChannel(id);
  res.json({ success: true });
});

// Channel auto-check and addition via Telegram Bot API
apiRouter.post('/channels/check', async (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username) {
    res.status(400).json({ error: 'Пожалуйста, введите юзернейм или ID канала (например, @channel_name)' });
    return;
  }

  let cleanUsername = username.trim();
  // Ensure it starts with @ if it looks like a username
  if (!cleanUsername.startsWith('-') && !cleanUsername.startsWith('@') && !/^\d+$/.test(cleanUsername)) {
    cleanUsername = '@' + cleanUsername;
  }

  const settings = DB.getSettings();
  const token = getBotTokenFromPg() || settings.telegramBotToken || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

  if (!token) {
    res.status(400).json({ error: 'В настройках системы не задан токен Telegram-бота' });
    return;
  }

  try {
    const botCfg = await getTelegramBotConfig();
    const effectiveToken = botCfg?.botToken || token;

    // 1. Get bot info (getMe)
    let botUserId: number | null = null;
    let botUsername = botCfg?.botUsername?.replace(/^@/, '') || 'IIrkiBot';
    try {
      const meData = await fetchTelegramBotApi({
        primaryBase: botCfg?.apiBaseUrl,
        proxyType: botCfg?.proxyType,
        token: effectiveToken,
        endpoint: 'getMe',
        timeoutMs: 10000
      });
      if (meData.ok && meData.result) {
        botUserId = meData.result.id;
        if (meData.result.username) {
          botUsername = meData.result.username;
        }
      }
    } catch (e) {
      console.error('Error fetching bot getMe:', e);
    }

    // 2. Fetch Chat Info (getChat)
    const data = await fetchTelegramBotApi({
      primaryBase: botCfg?.apiBaseUrl,
      proxyType: botCfg?.proxyType,
      token: effectiveToken,
      endpoint: `getChat?chat_id=${encodeURIComponent(cleanUsername)}`,
      timeoutMs: 12000
    });

    if (!data.ok) {
      const errMsg = data.description || 'Не удалось найти канал или бот не добавлен в него';
      res.status(400).json({ 
        error: `Не удалось найти канал ${cleanUsername}: ${errMsg}. Пожалуйста, убедитесь, что бот @${botUsername} добавлен в ваш канал как Администратор с правами публикации.`
      });
      return;
    }

    const chat = data.result;

    // 3. Verify Bot is a member and Administrator in the channel (getChatMember)
    if (botUserId) {
      const memberData = await fetchTelegramBotApi({
        primaryBase: botCfg?.apiBaseUrl,
        proxyType: botCfg?.proxyType,
        token: effectiveToken,
        endpoint: `getChatMember?chat_id=${encodeURIComponent(cleanUsername)}&user_id=${botUserId}`,
        timeoutMs: 12000
      });

      if (!memberData.ok || !memberData.result) {
        res.status(400).json({
          error: `Бот @${botUsername} НЕ добавлен в этот канал (${cleanUsername})! Пожалуйста, добавьте бота @${botUsername} в ваш канал как Администратора с правом публикации постов.`
        });
        return;
      }

      const memberStatus = memberData.result.status;
      if (memberStatus !== 'administrator' && memberStatus !== 'creator') {
        res.status(400).json({
          error: `Бот @${botUsername} присутствует в канале, но НЕ имеет прав Администратора (текущий статус: "${memberStatus}"). Назначьте бота @${botUsername} Администратором канала с разрешением публиковать сообщения.`
        });
        return;
      }

      if (memberData.result.can_post_messages === false) {
        res.status(400).json({
          error: `У бота @${botUsername} на канале ${cleanUsername} выключено право «Публикация сообщений» (can_post_messages). Включите разрешение на публикацию постов.`
        });
        return;
      }
    }

    // Fetch subscribers count
    let subscribersCount = 0;
    try {
      const countData = await fetchTelegramBotApi({
        primaryBase: botCfg?.apiBaseUrl,
        proxyType: botCfg?.proxyType,
        token: effectiveToken,
        endpoint: `getChatMemberCount?chat_id=${encodeURIComponent(cleanUsername)}`,
        timeoutMs: 8000
      });
      if (countData.ok) {
        subscribersCount = countData.result;
      }
    } catch (countErr) {
      console.error('Error fetching chat member count:', countErr);
    }

    const effectiveUserId = req.body.userId || (req.headers['x-user-id'] as string) || '';
    const name = chat.title || chat.username || cleanUsername;
    const inviteLink = chat.invite_link || (chat.username ? `https://t.me/${chat.username}` : '');
    const description = chat.description || 'Канал добавлен через автопроверку бота.';
    const telegramId = String(chat.id);
    const existingChannels = DB.getChannels(effectiveUserId);
    let channel = existingChannels.find(c => c.username === cleanUsername || c.telegramId === telegramId);

    const cleanHandle = cleanUsername.replace('@', '');
    let photoUrl = '';
    if (channel?.photoUrl && isFullGalleryDirectUrl(channel.photoUrl)) {
      photoUrl = channel.photoUrl;
    } else {
      photoUrl = await ensureChannelAvatarInGallery(
        cleanHandle || String(chat.id),
        channel?.photoUrl || '',
        effectiveUserId || channel?.userId || 'admin'
      );
    }

    if (channel) {
      channel = DB.updateChannel(channel.id, {
        userId: effectiveUserId || channel.userId,
        name,
        username: cleanUsername,
        subscribersCount,
        inviteLink,
        telegramId,
        description,
        photoUrl: photoUrl || channel.photoUrl || '',
        isActive: true
      });
    } else {
      channel = DB.addChannel({
        userId: effectiveUserId,
        name,
        username: cleanUsername,
        isActive: true,
        subscribersCount,
        inviteLink,
        telegramId,
        description,
        photoUrl
      });
    }

    res.json({ success: true, channel });
  } catch (err: any) {
    console.error('Error in channels check endpoint:', err);
    res.status(500).json({ 
      error: `Ошибка при подключении к Telegram API: ${err.message}. Проверьте соединение.`
    });
  }
});

// Helper to check if Telegram Bot is active & administrator in a given channel
async function checkBotInTelegramChannel(
  usernameOrId: string,
  ownerUserId?: string,
  existingPhotoUrl?: string
): Promise<{
  ok: boolean;
  name?: string;
  subscribersCount?: number;
  photoUrl?: string;
  description?: string;
  inviteLink?: string;
  error?: string;
}> {
  let cleanUsername = String(usernameOrId || '').trim();
  if (!cleanUsername.startsWith('-') && !cleanUsername.startsWith('@') && !/^\d+$/.test(cleanUsername)) {
    cleanUsername = '@' + cleanUsername;
  }

  const settings = DB.getSettings();
  const token = getBotTokenFromPg() || settings.telegramBotToken || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';
  if (!token) {
    return { ok: false, error: 'В настройках системы не задан токен Telegram-бота' };
  }

  try {
    const botCfg = await getTelegramBotConfig();
    const effectiveToken = botCfg?.botToken || token;

    let botUserId: number | null = null;
    let botUsername = botCfg?.botUsername?.replace(/^@/, '') || 'IIrkiBot';
    try {
      const meData = await fetchTelegramBotApi({
        primaryBase: botCfg?.apiBaseUrl,
        proxyType: botCfg?.proxyType,
        token: effectiveToken,
        endpoint: 'getMe',
        timeoutMs: 6000
      });
      if (meData.ok && meData.result) {
        botUserId = meData.result.id;
        botUsername = meData.result.username || botUsername;
      }
    } catch {}

    const chatData = await fetchTelegramBotApi({
      primaryBase: botCfg?.apiBaseUrl,
      proxyType: botCfg?.proxyType,
      token: effectiveToken,
      endpoint: `getChat?chat_id=${encodeURIComponent(cleanUsername)}`,
      timeoutMs: 7000
    });

    if (!chatData.ok) {
      return { ok: false, error: `Бот @${botUsername} не может найти канал ${cleanUsername} или был удален из него.` };
    }

    if (botUserId) {
      const memberData = await fetchTelegramBotApi({
        primaryBase: botCfg?.apiBaseUrl,
        proxyType: botCfg?.proxyType,
        token: effectiveToken,
        endpoint: `getChatMember?chat_id=${encodeURIComponent(cleanUsername)}&user_id=${botUserId}`,
        timeoutMs: 7000
      });

      if (!memberData.ok || !memberData.result) {
        return { ok: false, error: `Бот @${botUsername} не найден в канале ${cleanUsername}.` };
      }

      const status = memberData.result.status;
      if (status !== 'administrator' && status !== 'creator') {
        return { ok: false, error: `Бот @${botUsername} не является Администратором в канале ${cleanUsername}.` };
      }
    }

    // Fetch member count
    let subscribersCount = 0;
    try {
      const countData = await fetchTelegramBotApi({
        primaryBase: botCfg?.apiBaseUrl,
        proxyType: botCfg?.proxyType,
        token: effectiveToken,
        endpoint: `getChatMemberCount?chat_id=${encodeURIComponent(cleanUsername)}`,
        timeoutMs: 5000
      });
      if (countData.ok) {
        subscribersCount = countData.result;
      }
    } catch {}

    // Reuse existing permanent ProTalk gallery URL if already present; otherwise ensure once via deduplicated service
    const cleanHandle = cleanUsername.replace('@', '');
    let photoUrl = existingPhotoUrl && isFullGalleryDirectUrl(existingPhotoUrl) ? existingPhotoUrl : '';
    if (!photoUrl) {
      photoUrl = await ensureChannelAvatarInGallery(
        cleanHandle || String(chatData.result.id || ''),
        existingPhotoUrl || '',
        ownerUserId || 'admin'
      );
    }

    return { 
      ok: true, 
      name: chatData.result.title || cleanUsername,
      subscribersCount,
      photoUrl,
      description: chatData.result.description || '',
      inviteLink: chatData.result.invite_link || ''
    };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Ошибка сети при проверке канала' };
  }
}

// Verify all channels for a user upon login/entering cabinet
apiRouter.post('/channels/verify-all', async (req: Request, res: Response) => {
  try {
    const userId = req.body?.userId || (req.headers['x-user-id'] as string) || '';
    const db = await getPgDB();
    const channels = DB.getChannels(userId);

    const updatedChannels = [];
    for (const ch of channels) {
      if (ch.username || ch.telegramId) {
        try {
          const expandedOld = expandShortGalleryUrlToFull(db, ch.photoUrl) || (isFullGalleryDirectUrl(ch.photoUrl) ? ch.photoUrl : '');
          const checkResult = await checkBotInTelegramChannel(
            ch.username || ch.telegramId || '',
            ch.userId || userId,
            expandedOld
          );
          const newStatus = checkResult.ok;
          const nextPhoto = checkResult.photoUrl || expandedOld || ch.photoUrl || '';
          const updated = DB.updateChannel(ch.id, {
            isActive: newStatus,
            name: checkResult.name || ch.name,
            subscribersCount: checkResult.subscribersCount ?? ch.subscribersCount,
            photoUrl: nextPhoto,
            description: checkResult.description || ch.description
          });
          if (nextPhoto && nextPhoto !== ch.photoUrl) {
            try { db.run('UPDATE channels SET photo_url = ? WHERE id = ?', [nextPhoto, ch.id]); } catch {}
          }
          updatedChannels.push(updated);
        } catch (err) {
          updatedChannels.push(ch);
        }
      } else {
        updatedChannels.push(ch);
      }
    }
    savePgDB();

    res.json({ success: true, channels: updatedChannels });
  } catch (err: any) {
    res.json({ success: true, channels: [] });
  }
});

// Re-verify a single channel by ID via Telegram Bot check button
apiRouter.post('/channels/:id/verify', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.body.userId || (req.headers['x-user-id'] as string) || '';
  const db = await getPgDB();
  const channels = DB.getChannels(userId);
  const ch = channels.find(c => c.id === id);

  if (!ch) {
    res.status(404).json({ error: 'Канал не найден в базе данных' });
    return;
  }

  const expandedOld = expandShortGalleryUrlToFull(db, ch.photoUrl) || (isFullGalleryDirectUrl(ch.photoUrl) ? ch.photoUrl : '');
  const checkResult = await checkBotInTelegramChannel(
    ch.username || ch.telegramId || ch.name,
    ch.userId || userId,
    expandedOld
  );
  const resolvedFullPhoto = checkResult.photoUrl || expandedOld || ch.photoUrl || '';
  const updated = DB.updateChannel(ch.id, { 
    isActive: checkResult.ok,
    name: checkResult.name || ch.name,
    subscribersCount: checkResult.subscribersCount ?? ch.subscribersCount,
    photoUrl: resolvedFullPhoto,
    description: checkResult.description || ch.description
  });
  if (resolvedFullPhoto) {
    try {
      db.run('UPDATE channels SET photo_url = ? WHERE id = ?', [resolvedFullPhoto, ch.id]);
      savePgDB();
    } catch {}
  }

  if (checkResult.ok) {
    res.json({
      success: true,
      channel: updated,
      isActive: true,
      message: `🎉 Канал «${updated.name}» успешно проверен! Наш Telegram-бот найден и активен.`
    });
  } else {
    res.status(400).json({
      success: false,
      channel: updated,
      isActive: false,
      error: checkResult.error || `Бот не найден в канале «${ch.name}». Пожалуйста, добавьте бота @IIrkiBot администратором.`
    });
  }
});

// Settings CRUD
apiRouter.get('/settings', (req: Request, res: Response) => {
  res.json(DB.getSettings());
});

apiRouter.put('/settings', (req: Request, res: Response) => {
  const updated = DB.updateSettings(req.body);
  res.json(updated);
});

// Templates CRUD
apiRouter.get('/templates', (req: Request, res: Response) => {
  res.json(DB.getTemplates());
});

apiRouter.post('/templates', (req: Request, res: Response) => {
  const { type, name, category, content } = req.body;
  if (!name || !content || !type) {
    res.status(400).json({ error: 'Пожалуйста, укажите тип, название и содержимое шаблона' });
    return;
  }
  const newTpl = DB.addTemplate({ type, name, category: category || '', content });
  res.status(201).json(newTpl);
});

apiRouter.delete('/templates/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  DB.deleteTemplate(id);
  res.json({ success: true });
});

// Publications CRUD
apiRouter.get('/publications', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  res.json(DB.getPublications(userId));
});

apiRouter.delete('/publications/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  DB.deletePublication(id, userId);
  res.json({ success: true });
});

// System Prompts Endpoints
apiRouter.get('/system-prompts', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const items = forceRefresh
      ? await SystemPromptsDomain.syncSystemPromptsFromCloudDb()
      : DB.getSystemPrompts();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения системных промптов' });
  }
});

apiRouter.put('/system-prompts/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { promptText, title, description } = req.body || {};
    if (!String(promptText || '').trim()) {
      res.status(400).json({ error: 'Промпт не может быть пустым' });
      return;
    }
    const updated = await SystemPromptsDomain.updateSystemPromptAsync(
      key,
      String(promptText),
      title !== undefined ? String(title) : undefined,
      description !== undefined ? String(description) : undefined
    );
    if (updated) {
      res.json({ success: true, prompt: updated });
    } else {
      res.status(404).json({ error: 'Системный промпт не найден' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения системного промпта в БД' });
  }
});

// ProTalk & Gemini Prompt Generation
apiRouter.post('/protalk/generate', async (req: Request, res: Response) => {
  const { 
    dayOfWeek, 
    category, 
    requestTemplate, 
    title,
    currentText,
    maxChars,
    messageFormat,
    escapeMode,
    postStyle,
    styleDesc,
    structureFlags,
    telegramId, 
    uniquenessMemoryCount,
    userId 
  } = req.body;

  const categoryName = category || 'SMM';
  const dayName = dayOfWeek || 'Сегодня';

  if (requestTemplate && requestTemplate.length > 10000) {
    res.status(400).json({ error: 'Шаблон запроса не должен превышать 10 000 символов' });
    return;
  }

  const db = await getPgDB();
  const pricing = await getPricingConfig(db);
  const postGenCost = pricing.textAi.postGeneration;

  // 1. Check user balance (dynamic post generation cost)
  let user: any = null;
  if (userId) {
    user = DB.getUsers().find(u => u.id === userId);
    if (user && postGenCost > 0) {
      const currentBalance = user.balance || 0;
      if (currentBalance < postGenCost) {
        // Send PM Telegram notification if telegramId exists
        const notifyTgId = telegramId || user.telegramId;
        if (notifyTgId) {
          await sendPrivateTelegramNotification(
            notifyTgId,
            `⚠️ <b>Недостаточно ИИрок на балансе!</b>\n\nНе удалось запустить генерацию поста по теме "<b>${categoryName}</b>".\nСтоимость генерации: ${formatIirkyCount(postGenCost)}.\nВаш текущий баланс: ${formatIirkyCount(currentBalance)}.\n\nПожалуйста, пополните баланс в профиле!`
          );
        }
        res.status(402).json({
          error: `Недостаточно ИИрок на балансе! Стоимость генерации: ${formatIirkyCount(postGenCost)}. Ваш баланс: ${formatIirkyCount(currentBalance)}. Пополните баланс в профиле.`
        });
        return;
      }
    }
  }

  const effectiveUid = userId || (telegramId ? String(telegramId) : (req.headers['x-user-id'] as string) || '');
  const resolvedTariff = resolveUserTariffInDb(db, effectiveUid);

  // Enforce Разгон+ for custom brand styles
  if (postStyle && String(postStyle).startsWith('custom_') && resolvedTariff.level < ServerTariffLevel.Razgon) {
    const perm = checkTariffPermission(db, effectiveUid, ServerTariffLevel.Razgon, 'Настраиваемые стили');
    res.status(perm.statusCode).json(perm.payload);
    return;
  }

  // 2. Fetch uniqueness memory (Память прошлых постов и серийность — active from Разгон+)
  let recentPostsText: string[] = [];
  const requestedDepth = Math.min(30, Math.max(0, Number(uniquenessMemoryCount) || 0));
  const memoryDepth = resolvedTariff.level >= ServerTariffLevel.Razgon ? requestedDepth : 0;
  if (memoryDepth > 0) {
    const publications = DB.getPublications(effectiveUid || undefined);
    const dayRequests = DB.getDayRequests(effectiveUid || undefined);
    const allTitles: string[] = [];
    publications.forEach(p => {
      if (p.promptTitle && p.promptTitle.trim()) allTitles.push(p.promptTitle.trim());
    });
    dayRequests.forEach(d => {
      if (d.title && d.title.trim()) allTitles.push(d.title.trim());
    });
    const uniqueTitles = Array.from(new Set(allTitles)).filter(t => t.length > 2);
    recentPostsText = uniqueTitles.slice(0, memoryDepth);
  }

  try {
    // Generate prompt with ProTalk & DB System Prompt
    const result = await generateProkhorPrompt(
      dayName,
      categoryName,
      requestTemplate || '',
      undefined,
      recentPostsText,
      {
        title,
        currentText,
        maxChars: maxChars ? Number(maxChars) : undefined,
        messageFormat,
        escapeMode: Boolean(escapeMode),
        postStyle,
        styleDesc,
        structureFlags,
        userId: userId || user?.id || (telegramId ? String(telegramId) : '16926299042')
      }
    );

    // Deduct dynamic postGenCost ИИрок if user identified
    let updatedBalance = user ? user.balance : undefined;
    if (user && postGenCost > 0) {
      const updatedUser = DB.updateUser(user.id, {
        balance: Math.max(0, (user.balance || 0) - postGenCost)
      });
      updatedBalance = updatedUser.balance;

      const notifyTgId = telegramId || user.telegramId;
      if (notifyTgId) {
        await sendPrivateTelegramNotification(
          notifyTgId,
          `✨ <b>ИИ-Промпт успешно сгенерирован!</b>\n\nТема: "<b>${category}</b>"\nСписано: ${formatIirkyCount(postGenCost)}\nОстаток баланса: ${formatIirkyCount(updatedBalance || 0)}.`
        );
      }
    }

    res.json({
      title: result.title,
      content: result.content,
      imagePrompt: result.imagePrompt,
      updatedBalance
    });

  } catch (e: any) {
    console.error('Prompt generation error:', e);
    res.status(500).json({ error: e.message || 'Ошибка генерации промпта через ИИ' });
  }
});

// Unified Image Builder generation endpoint (4 Functions: 787 [0 Иирок], 621 [5 Иирок], 784 [10 Иирок], 791 [15 Иирок])
apiRouter.post('/ai/image-builder/generate', async (req: Request, res: Response) => {
  try {
    const {
      mode = 'func_621',
      prompt,
      aspectRatio = mode === 'func_791' ? 'auto' : '16:9',
      referenceUrl,
      userId,
      telegramId,
      ai_model,
      size,
      quality,
      output_format,
      response_format,
      images,
      images_url,
      images_urls,
      background,
      generation_mode,
      debug,
      resolution
    } = req.body;
    const cleanUserId = userId ? String(userId) : (telegramId ? String(telegramId) : (req.headers['x-user-id'] as string) || '16926299042');
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';

    const result = await handleUnifiedImageGeneration({
      mode: mode || 'func_621',
      prompt: String(prompt || '').trim(),
      aspectRatio,
      referenceUrl: referenceUrl ? String(referenceUrl).trim() : undefined,
      userId: cleanUserId,
      resolution,
      ai_model,
      size,
      quality,
      output_format,
      response_format,
      images: images ? String(images).trim() : undefined,
      images_url: images_url ? String(images_url).trim() : undefined,
      images_urls: images_urls ? String(images_urls).trim() : undefined,
      background,
      generation_mode: (generation_mode === 'async' || generation_mode === 'stream' ? generation_mode : 'sync') as any,
      debug: Boolean(debug),
      hostProtocol: { host, protocol }
    });

    if (!result.ok) {
      res.status(result.status || 500).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      imageUrl: result.imageUrl,
      originalUrl: result.originalUrl,
      cost: result.cost,
      mode: result.mode,
      aspectRatio: result.aspectRatio,
      size: result.size,
      tokensUsed: result.tokensUsed,
      costRub: result.costRub,
      model: result.model
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка генерации изображения' });
  }
});

// Plan sequential visual scenes (2-10 slides) in unified style for cascading carousel
apiRouter.post('/ai/image-builder/carousel-plan', async (req: Request, res: Response) => {
  try {
    const { storyPrompt, slideCount = 4, userId, telegramId } = req.body || {};
    const cleanUserId = userId ? String(userId) : (telegramId ? String(telegramId) : (req.headers['x-user-id'] as string) || '16926299042');
    const planned = await planCascadingCarouselPrompts({
      storyPrompt: String(storyPrompt || ''),
      slideCount: Number(slideCount || 4),
      userId: cleanUserId
    });
    res.json({
      success: true,
      prompts: planned.prompts,
      source: planned.source
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка планирования сцен карусели' });
  }
});

// Cascading unified-style carousel generator (strictly func_791 or func_784 with reference anchoring; supports SSE streaming)
apiRouter.post('/ai/image-builder/carousel-cascade', async (req: Request, res: Response) => {
  const {
    storyPrompt = '',
    slideCount = 4,
    mode,
    functionMode,
    aspectRatio = '1:1',
    referenceMode = 'first_slide_anchor',
    referenceUrl = '',
    slidePrompts,
    userId,
    telegramId,
    stream
  } = req.body || {};

  const effectiveMode = String(functionMode || mode || 'func_791').trim();
  const cleanUserId = userId ? String(userId) : (telegramId ? String(telegramId) : (req.headers['x-user-id'] as string) || '16926299042');
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const wantsSse = Boolean(
    stream ||
    req.query.stream === '1' ||
    String(req.headers.accept || '').includes('text/event-stream')
  );

  if (wantsSse) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const writeEvent = (payload: any) => {
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // client disconnected
      }
    };

    try {
      const result = await executeCascadingCarouselGeneration({
        storyPrompt: String(storyPrompt || ''),
        slideCount: Number(slideCount || 4),
        functionMode: effectiveMode,
        aspectRatio: String(aspectRatio || '1:1'),
        referenceMode: referenceMode === 'custom_ref' ? 'custom_ref' : 'first_slide_anchor',
        referenceUrl: referenceUrl ? String(referenceUrl) : '',
        slidePrompts: Array.isArray(slidePrompts) ? slidePrompts : undefined,
        userId: cleanUserId,
        hostProtocol: { host, protocol },
        onProgress: (ev) => writeEvent(ev)
      });

      if (!result.ok && result.slides.length === 0) {
        writeEvent({
          type: 'error',
          error: result.error || 'Не удалось сгенерировать карусель'
        });
      }
    } catch (err: any) {
      writeEvent({
        type: 'error',
        error: err?.message || 'Ошибка каскадной генерации карусели'
      });
    } finally {
      res.end();
    }
    return;
  }

  try {
    const result = await executeCascadingCarouselGeneration({
      storyPrompt: String(storyPrompt || ''),
      slideCount: Number(slideCount || 4),
      functionMode: effectiveMode,
      aspectRatio: String(aspectRatio || '1:1'),
      referenceMode: referenceMode === 'custom_ref' ? 'custom_ref' : 'first_slide_anchor',
      referenceUrl: referenceUrl ? String(referenceUrl) : '',
      slidePrompts: Array.isArray(slidePrompts) ? slidePrompts : undefined,
      userId: cleanUserId,
      hostProtocol: { host, protocol }
    });

    if (!result.ok) {
      res.status(result.status || 400).json({
        success: false,
        error: result.error,
        slides: result.slides,
        totalCost: result.totalCost,
        plannedPrompts: result.plannedPrompts
      });
      return;
    }

    res.json({
      success: true,
      mode: result.mode,
      slides: result.slides,
      totalCost: result.totalCost,
      plannedPrompts: result.plannedPrompts
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка каскадной генерации карусели' });
  }
});

// ProTalk Image Generation endpoint via Function 621
apiRouter.post('/protalk/generate-image', async (req: Request, res: Response) => {
  const { imagePrompt, userId, telegramId, aspectRatio = '16:9', model = 'flux' } = req.body;

  if (!imagePrompt || !imagePrompt.trim()) {
    res.status(400).json({ error: 'Пожалуйста, укажите промпт для генерации картинки' });
    return;
  }

  const cleanUserId = userId ? String(userId) : (telegramId ? String(telegramId) : '16926299042');
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';

  const db = await getPgDB();
  const pricing = await getPricingConfig(db);
  const imgCost = pricing.imageModels.legacyGenerateImage;

  // 1. Check user balance (dynamic image cost)
  let user: any = null;
  if (cleanUserId) {
    user = DB.getUsers().find(u => String(u.id) === String(cleanUserId) || String(u.telegramId) === String(cleanUserId));
    if (user && imgCost > 0) {
      const currentBalance = user.balance || 0;
      if (currentBalance < imgCost) {
        const notifyTgId = telegramId || user.telegramId;
        if (notifyTgId) {
          await sendPrivateTelegramNotification(
            notifyTgId,
            `⚠️ <b>Недостаточно ИИрок на балансе!</b>\n\nНе удалось запустить генерацию изображения через ProTalk ИИ.\nСтоимость генерации: ${formatIirkyCount(imgCost)}.\nВаш баланс: ${formatIirkyCount(currentBalance)}.`
          );
        }
        res.status(402).json({
          error: `Недостаточно ИИрок на балансе! Стоимость генерации картинки: ${formatIirkyCount(imgCost)}. Ваш баланс: ${formatIirkyCount(currentBalance)}.`
        });
        return;
      }
    }
  }

  try {
    // 2. Direct API call to ProTalk Function 621 (automatically logs img621_<uid> and persists to user gallery)
    const genResult = await callProTalkFunction621({
      prompt: imagePrompt.trim(),
      aspectRatio,
      outputFormat: 'png',
      userId: cleanUserId,
      model,
      hostProtocol: { host, protocol }
    });

    const originalUrl = genResult.originalUrl;
    const localUrl = genResult.imageUrl || originalUrl;
    const fileRecord: any = null;

    // 4. Deduct dynamic ИИрок only upon confirmed generation
    let updatedBalance = user ? user.balance : undefined;
    if (user && imgCost > 0) {
      const updatedUser = DB.updateUser(user.id, {
        balance: Math.max(0, (user.balance || 0) - imgCost)
      });
      updatedBalance = updatedUser.balance;

      const notifyTgId = telegramId || user.telegramId;
      if (notifyTgId) {
        await sendPrivateTelegramNotification(
          notifyTgId,
          `🖼️ <b>Изображение через ProTalk ИИ сгенерировано!</b>\n\nСписано: ${formatIirkyCount(imgCost)}\nОстаток баланса: ${formatIirkyCount(updatedBalance || 0)}.`
        );
      }
    }

    res.json({
      success: true,
      imageUrl: localUrl,
      originalUrl,
      downloadUrl: localUrl,
      file: fileRecord,
      updatedBalance
    });
  } catch (e: any) {
    console.error('ProTalk Image generation error:', e);
    // In case of error, NO AI coins are deducted!
    res.status(500).json({ error: e.message || 'Ошибка генерации картинки' });
  }
});

// Style Analyzer from up to 10 channel posts (Costs 10 AI coins, requires Разгон+)
apiRouter.post('/protalk/analyze-style', async (req: Request, res: Response) => {
  const { posts, styleName, userId, telegramId } = req.body;

  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    res.status(400).json({ error: 'Пожалуйста, вставьте хотя бы один пост для анализа стиля' });
    return;
  }

  const rawUid = userId ? String(userId) : (telegramId ? String(telegramId) : (req.headers['x-user-id'] as string) || '');
  const db = await getPgDB();
  const perm = checkTariffPermission(db, rawUid, ServerTariffLevel.Razgon, 'Настраиваемые стили');
  if (!perm.allowed) {
    res.status(perm.statusCode).json(perm.payload);
    return;
  }

  const pricing = await getPricingConfig(db);
  const styleCost = pricing.textAi.styleAnalysis;
  const cleanUserId = perm.resolved.userId || normalizeUserId(rawUid || '16926299042');
  const dbUser = getUserByIdFromDb(db, cleanUserId);

  // Check balance (dynamic styleAnalysis cost)
  let user: any = DB.getUsers().find(u => String(u.id) === String(cleanUserId) || String(u.telegramId) === String(cleanUserId));
  const currentBalance = dbUser ? Number(dbUser.balance || 0) : (user?.balance || 0);
  if (styleCost > 0 && currentBalance < styleCost) {
    res.status(402).json({
      error: `Недостаточно ИИрок на балансе! Создание стиля стоит ${formatIirkyCount(styleCost)}. Ваш баланс: ${formatIirkyCount(currentBalance)}.`
    });
    return;
  }

  try {
    const analysis = await analyzeChannelStyleFromPosts(posts, styleName, cleanUserId);

    let updatedBalance = Math.max(0, currentBalance - styleCost);
    if (dbUser && styleCost > 0) {
      const txRes = addTransactionWithBalanceUpdate(db, {
        userId: String(dbUser.id),
        type: 'cost',
        amount: styleCost,
        description: `Анализ и создание фирменного стиля «${analysis.title || styleName || 'Стиль'}»`
      });
      updatedBalance = txRes.newBalances.balance;
      savePgDB();
    }
    if (user && styleCost > 0) {
      DB.updateUser(user.id, { balance: updatedBalance });
    }

    const savedStyle = await upsertUserPostStyleInDb({
      userId: cleanUserId,
      title: analysis.title || styleName || 'Фирменный стиль канала',
      desc: analysis.desc || 'Фирменный стиль на основе примеров канала',
      prompt: analysis.prompt
    });

    res.json({
      success: true,
      style: savedStyle,
      updatedBalance
    });
  } catch (e: any) {
    console.error('Style analysis error:', e);
    res.status(500).json({ error: e.message || 'Ошибка анализа стиля постов' });
  }
});

// Neuroplan 15 posts generation (Costs 10 AI coins, requires Разгон+)
apiRouter.post('/protalk/neuroplan', async (req: Request, res: Response) => {
  const { topicIdea, userId, telegramId } = req.body;

  if (!topicIdea || !topicIdea.trim()) {
    res.status(400).json({ error: 'Пожалуйста, укажите идею или нишу для создания Нейроплана' });
    return;
  }

  const rawUid = userId ? String(userId) : (telegramId ? String(telegramId) : (req.headers['x-user-id'] as string) || '');
  const db = await getPgDB();
  const perm = checkTariffPermission(db, rawUid, ServerTariffLevel.Razgon, 'Нейроплан');
  if (!perm.allowed) {
    res.status(perm.statusCode).json(perm.payload);
    return;
  }

  const pricing = await getPricingConfig(db);
  const neuroplanCost = pricing.textAi.neuroplan;
  const cleanUserId = perm.resolved.userId || normalizeUserId(rawUid || '16926299042');
  const dbUser = getUserByIdFromDb(db, cleanUserId);
  let user: any = DB.getUsers().find(u => String(u.id) === String(cleanUserId) || String(u.telegramId) === String(cleanUserId));
  const currentBalance = dbUser ? Number(dbUser.balance || 0) : (user?.balance || 0);
  if (neuroplanCost > 0 && currentBalance < neuroplanCost) {
    res.status(402).json({
      error: `Недостаточно ИИрок на балансе! Генерация Нейроплана стоит ${formatIirkyCount(neuroplanCost)}. Ваш баланс: ${formatIirkyCount(currentBalance)}.`
    });
    return;
  }

  try {
    // 3. Collect author's post history from the last 30 days (Task 3)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const authorPubs = DB.getPublications(cleanUserId);
    const authorDrafts = DB.getDayRequests(cleanUserId);
    const rawHistory: string[] = [];

    // From published and scheduled publications
    (authorPubs || []).forEach(p => {
      const d = new Date(p.publishedAt || p.scheduledFor || 0);
      if (isNaN(d.getTime()) || d >= thirtyDaysAgo) {
        if (p.promptTitle && p.promptTitle.trim() && p.promptTitle !== 'Без названия') {
          rawHistory.push(p.promptTitle.trim());
        }
        if (p.category && p.category.trim() && p.category !== 'Общее' && p.category !== 'Нейроплан') {
          rawHistory.push(p.category.trim());
        }
      }
    });

    // From drafts and planned day requests
    (authorDrafts || []).forEach(d => {
      const dt = new Date(d.createdAt || d.scheduledTime || 0);
      if (isNaN(dt.getTime()) || dt >= thirtyDaysAgo) {
        if (d.title && d.title.trim()) {
          rawHistory.push(d.title.trim());
        }
        if (d.requestTemplate && d.requestTemplate.trim() && !d.requestTemplate.startsWith('Пост по теме:')) {
          rawHistory.push(d.requestTemplate.trim().slice(0, 100));
        }
      }
    });

    // Include any client-passed titles
    if (Array.isArray(req.body.historyTitles)) {
      req.body.historyTitles.forEach((t: any) => {
        if (typeof t === 'string' && t.trim()) rawHistory.push(t.trim());
      });
    }

    const uniqueHistory = Array.from(new Set(rawHistory)).filter(t => t.length > 2);

    const topics = await generateNeuroplanTopics(topicIdea, cleanUserId, uniqueHistory);

    let updatedBalance = Math.max(0, currentBalance - neuroplanCost);
    if (dbUser && neuroplanCost > 0) {
      const txRes = addTransactionWithBalanceUpdate(db, {
        userId: String(dbUser.id),
        type: 'cost',
        amount: neuroplanCost,
        description: `Генерация Нейроплана (15 постов): «${topicIdea.trim().slice(0, 60)}»`
      });
      updatedBalance = txRes.newBalances.balance;
      savePgDB();
    }
    if (user && neuroplanCost > 0) {
      DB.updateUser(user.id, { balance: updatedBalance });
    }

    res.json({
      success: true,
      topics,
      updatedBalance
    });
  } catch (e: any) {
    console.error('Neuroplan error:', e);
    res.status(500).json({ error: e.message || 'Ошибка создания Нейроплана' });
  }
});

// Neuroplan: approve topics & create drafts in PostgreSQL (requires Разгон+)
apiRouter.post('/protalk/neuroplan/create-drafts', async (req: Request, res: Response) => {
  const { topics, userId, channel } = req.body;

  if (!topics || !Array.isArray(topics) || topics.length === 0) {
    res.status(400).json({ error: 'Список тем пуст' });
    return;
  }

  try {
    const rawUid = userId ? String(userId) : (req.headers['x-user-id'] as string) || '';
    const db = await getPgDB();
    const perm = checkTariffPermission(db, rawUid, ServerTariffLevel.Razgon, 'Нейроплан');
    if (!perm.allowed) {
      res.status(perm.statusCode).json(perm.payload);
      return;
    }

    const cleanUserId = perm.resolved.userId || normalizeUserId(rawUid || '16926299042');
    const userOwnedChannels = DB.getChannels(cleanUserId);
    const targetChannel =
      channel ||
      userOwnedChannels[0]?.username ||
      (userOwnedChannels[0]?.telegramId ? String(userOwnedChannels[0].telegramId) : '');
    const createdDrafts: any[] = [];

    for (let i = 0; i < topics.length; i++) {
      const topicItem = topics[i];
      let cleanTitle = '';
      let generatedPostText = '';
      let imagePrompt = '';
      let scheduledDate = '';
      let scheduledTime = '10:00';

      if (typeof topicItem === 'object' && topicItem !== null) {
        cleanTitle = String(topicItem.title || '').trim();
        generatedPostText = String(topicItem.postText || '').trim();
        imagePrompt = String(topicItem.imagePrompt || '').trim();
        scheduledDate = String(topicItem.scheduledDate || '').trim();
        scheduledTime = String(topicItem.scheduledTime || '10:00').trim();
      } else {
        cleanTitle = String(topicItem).trim();
      }

      if (!cleanTitle) continue;

      if (!scheduledDate) {
        const d = new Date();
        d.setDate(d.getDate() + (i + 1));
        scheduledDate = d.toISOString().split('T')[0];
      }

      const exactDateTime = `${scheduledDate}T${scheduledTime}`;

      const newDraft: DayRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        category: 'Нейроплан',
        channel: targetChannel,
        channels: [targetChannel],
        signature: '',
        status: 'черновик',
        requestTemplate: `Пост по теме: "${cleanTitle}"`,
        title: cleanTitle,
        postText: generatedPostText || cleanTitle,
        imagePrompt: imagePrompt || `Качественная иллюстрация к посту "${cleanTitle}", современный стиль, 8k`,
        scheduledTime: `${exactDateTime}:00`,
        triggerSchedule: {
          enabled: true,
          frequency: 'once',
          time: scheduledTime,
          date: scheduledDate,
          exactDateTime
        },
        messageFormat: 'v2',
        isPublished: false,
        is_published_to_blog: 0,
        is_published_to_profile: 0,
        uniquenessMemoryCount: 5,
        userId: cleanUserId,
        createdAt: new Date().toISOString()
      };

      const added = DB.addDayRequest(newDraft);
      createdDrafts.push(added);
    }

    res.json({
      success: true,
      createdCount: createdDrafts.length,
      drafts: createdDrafts
    });
  } catch (e: any) {
    console.error('Create drafts error:', e);
    res.status(500).json({ error: e.message || 'Ошибка создания черновиков' });
  }
});

// Admin stats for ProTalk costs and logs table
apiRouter.get('/admin/logs-stats', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const filterUserId = (req.query.userId as string) || '';

    let query = "SELECT * FROM logs ORDER BY created_at DESC LIMIT 300";
    let params: any[] = [];

    if (filterUserId && filterUserId !== 'all') {
      query = "SELECT * FROM logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 300";
      params = [filterUserId];
    }

    const stmt = db.prepare(query);
    if (params.length > 0) stmt.bind(params);

    const logs: any[] = [];
    while (stmt.step()) {
      logs.push(stmt.getAsObject());
    }
    stmt.free();

    // Query aggregated stats across all logs
    const statsRes = db.exec(`
      SELECT 
        SUM(cost_rub) as total_cost,
        SUM(tokens_used) as total_tokens,
        COUNT(DISTINCT user_id) as users_count,
        COUNT(id) as total_requests
      FROM logs
    `);

    let totalCostRub = 0;
    let totalTokensUsed = 0;
    let usersCount = 1;
    let totalRequests = 0;

    if (statsRes[0]?.values?.[0]) {
      const [tc, tt, uc, tr] = statsRes[0].values[0];
      totalCostRub = Number(tc || 0);
      totalTokensUsed = Number(tt || 0);
      usersCount = Math.max(1, Number(uc || 1));
      totalRequests = Number(tr || 0);
    }

    const avgCostPerUser = Number((totalCostRub / usersCount).toFixed(2));

    // Get list of unique users from logs for filters
    const usersRes = db.exec("SELECT DISTINCT user_id FROM logs WHERE user_id IS NOT NULL AND user_id != ''");
    const uniqueUsers: string[] = [];
    if (usersRes[0]?.values) {
      usersRes[0].values.forEach((row: any[]) => {
        if (row[0]) uniqueUsers.push(String(row[0]));
      });
    }

    res.json({
      success: true,
      totalCostRub: Number(totalCostRub.toFixed(2)),
      totalTokensUsed,
      totalRequests,
      avgCostPerUser,
      uniqueUsers,
      logs
    });
  } catch (err: any) {
    console.error('Error fetching logs stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Stats for Dashboard
apiRouter.get('/stats', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  const prompts = DB.getPrompts();
  const publications = DB.getPublications(userId);

  const totalPrompts = prompts.length + publications.length; // all prompts ever created or published
  const publishedThisMonth = publications.filter(p => {
    const date = new Date(p.publishedAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  const successfulPublications = publications.filter(p => p.status).length;
  const engagementRate = publications.length > 0 
    ? Math.min(98.4, +( (successfulPublications / publications.length) * 85 + 10 ).toFixed(1))
    : 0;

  // Group publications by day of week for charts
  const dayStats: Record<string, number> = {
    'Понедельник': 0, 'Вторник': 0, 'Среда': 0, 'Четверг': 0, 'Пятница': 0, 'Суббота': 0, 'Воскресенье': 0
  };
  
  publications.forEach(p => {
    // try to resolve day of week from publishedAt
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const d = new Date(p.publishedAt);
    const dayName = days[d.getDay()];
    if (dayStats[dayName] !== undefined) {
      dayStats[dayName]++;
    }
  });

  const chartData = Object.keys(dayStats).map(day => ({
    name: day,
    count: dayStats[day]
  }));

  res.json({
    totalPrompts,
    publishedThisMonth,
    engagementRate,
    chartData,
    recentPublications: publications.slice(0, 5)
  });
});

// Import CSV endpoint
apiRouter.post('/import-csv', (req: Request, res: Response) => {
  const { csvText, type } = req.body;
  if (!csvText || !type) {
    res.status(400).json({ error: 'Неверные параметры импорта' });
    return;
  }

  try {
    const lines = csvText.split('\n');
    let importedCount = 0;

    if (type === 'templates') {
      // Parse day requests templates
      lines.forEach((line: string) => {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const day = parts[0].trim();
          const category = parts[1]?.trim() || '';
          const template = parts[2]?.trim() || '';
          const dayRequests = DB.getDayRequests();
          const found = dayRequests.find(r => r.dayOfWeek.toLowerCase() === day.toLowerCase());
          if (found) {
            DB.updateDayRequest(found.id, {
              category,
              requestTemplate: template
            });
            importedCount++;
          }
        }
      });
    } else if (type === 'history') {
      // Parse sent publications
      lines.forEach((line: string) => {
        const parts = line.split(',');
        if (parts.length >= 5) {
          const title = parts[1]?.trim() || 'Импортированная публикация';
          const text = parts[2]?.trim() || '';
          const channel = parts[3]?.trim() || '@SAV_AI';
          const msgId = parts[5]?.trim() || '';
          const status = parts[4]?.toUpperCase() === 'TRUE';
          const date = parts[0]?.trim() || new Date().toISOString();

          DB.addPublication({
            promptTitle: title,
            text,
            channel,
            messageId: msgId,
            status,
            response: status ? 'Опубликовано (импорт)' : 'Ошибка (импорт)'
          });
          importedCount++;
        }
      });
    }

    res.json({ success: true, importedCount });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка парсинга CSV: ' + err.message });
  }
});

// Balance Top-up
apiRouter.post('/users/:id/topup', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body;
  
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ error: 'Пожалуйста, укажите корректную сумму пополнения' });
    return;
  }

  try {
    const cleanUserId = normalizeUserId(id);
    const db = await getPgDB();

    const rubles = Number(amount);
    const coins = rubles; // 1 ruble = 1 AI-coin (ИИрка)

    const result = addTransactionWithBalanceUpdate(db, {
      userId: cleanUserId,
      type: 'pay',
      balanceType: 'pay',
      amount: coins,
      description: `Пополнение баланса (+${coins} ИИрок за ${rubles} руб.)`
    });

    savePgDB();

    res.json({
      success: true,
      balance: result.newBalances.balance,
      newBalances: result.newBalances,
      transaction: result.transaction,
      message: `Баланс успешно пополнен на ${coins} ИИрок за ${rubles} руб.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Re-parse & update Telegram status for all users in PostgreSQL database
apiRouter.post('/admin/parse-tg-users', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const rows = fetchAllUsersFromPg();

    const cfg = await getTelegramBotConfig();
    const botSettings = getBotDetailsFromPg();
    const botToken =
      cfg?.botToken ||
      (botSettings && botSettings.bot_token) ||
      '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

    let activeCount = 0;
    let blockedCount = 0;
    let deletedCount = 0;

    const chunkSize = 12;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      await Promise.all(
        slice.map(async (u: any) => {
          const tgId = u.telegram_id;
          if (!tgId) return;

          let status: 'Активный' | 'Блок' | 'Удален' = 'Удален';
          try {
            const actData = await fetchTelegramBotApi({
              primaryBase: cfg?.apiBaseUrl,
              proxyType: cfg?.proxyType,
              token: botToken,
              endpoint: `sendChatAction?chat_id=${tgId}&action=typing`,
              timeoutMs: 5000
            });
            if (actData.ok) {
              status = 'Активный';
            } else {
              const errDesc = (actData.description || '').toLowerCase();
              status =
                errDesc.includes('blocked') || errDesc.includes('forbidden')
                  ? 'Блок'
                  : 'Удален';
            }
          } catch {
            status = u.status === 'Активный' || u.status === 'Блок' ? u.status : 'Удален';
          }

          if (status === 'Активный') activeCount++;
          else if (status === 'Блок') blockedCount++;
          else deletedCount++;

          try {
            db.run('UPDATE users SET status = ? WHERE telegram_id = ?', [status, tgId]);
          } catch {}
        })
      );
    }

    savePgDB();

    res.json({
      success: true,
      total: rows.length,
      active: activeCount,
      blocked: blockedCount,
      deleted: deletedCount,
      message: `Парсер успешно выполнил проверку ${rows.length} пользователей: Активных — ${activeCount}, Заблокировали бота — ${blockedCount}, Удалены/Не найдены — ${deletedCount}.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy database.json /db/query removed — handled by PostgreSQL /db/query endpoint below.

// Telegram Send Endpoint (Used by System Admin / direct publication)
apiRouter.post('/telegram/send', async (req: Request, res: Response) => {
  const { 
    channel, 
    rawText, 
    title, 
    format, 
    signature, 
    attachmentType, 
    attachmentUrl, 
    attachmentUrls, 
    inlineButtons,
    linkPreviewEnabled
  } = req.body;

  const textToSend = rawText || req.body.content || req.body.requestTemplate || '';
  if (!textToSend || !textToSend.trim()) {
    res.status(400).json({ error: 'Пожалуйста, заполните текст сообщения для публикации' });
    return;
  }

  const dummyReq: any = {
    id: req.body.id || 'admin_send',
    dayOfWeek: 'Сегодня',
    category: 'Публикация',
    requestTemplate: textToSend,
    channel: channel || '@SAV_AI',
    channels: [channel || '@SAV_AI'],
    title: title || 'Публикация из БД',
    signature: signature || '',
    messageFormat: format || 'v2',
    linkPreviewEnabled: linkPreviewEnabled !== false
  };

  try {
    const result = await sendPromptToTelegram(
      title || 'Публикация',
      textToSend,
      dummyReq,
      {
        messageFormat: format || 'v2',
        signature,
        linkPreviewEnabled: linkPreviewEnabled !== false,
        attachmentType,
        attachmentUrl,
        attachmentUrls,
        inlineButtons,
        channels: channel ? [channel] : undefined
      }
    );

    if (result.ok) {
      // Save to publication history log
      DB.addPublication({
        promptTitle: title || 'Публикация из базы данных',
        text: textToSend,
        channel: channel || '@SAV_AI',
        messageId: result.messageId ? String(result.messageId) : undefined,
        status: true,
        messageFormat: format || 'v2',
        attachmentType: attachmentType || 'none',
        attachmentUrl,
        attachmentUrls,
        inlineButtons,
        signature,
        publishedAt: new Date().toISOString(),
        response: 'Успешно отправлено из базы данных'
      });

      res.json({ success: true, messageId: result.messageId, message: 'Сообщение успешно отправлено в Telegram!' });
    } else {
      res.status(400).json({ success: false, error: result.error || 'Ошибка отправки в Telegram' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Ошибка сервера при отправке' });
  }
});

// Telegram Test-Send Direct Endpoint (Target: DM 169262990 or passed ID)
apiRouter.post('/telegram/test-send', async (req: Request, res: Response) => {
  const { 
    telegramId = 169262990, 
    title = 'Тестовое сообщение', 
    content = 'Это тестовое сообщение от PROTALK Manager!', 
    signature = '', 
    messageFormat,
    format,
    linkPreviewEnabled = true,
    protectContent = false,
    attachmentType = 'none',
    audioFormat,
    audioTitle,
    audioPerformer,
    attachmentUrl = '',
    attachmentUrls = [],
    inlineButtons = [],
    uppercaseHeader = true
  } = req.body;

  try {
    const requestedFormat = messageFormat || format;
    const effectiveFormat = detectMessageFormat(content || '', requestedFormat);

    const dummyReq: any = {
      id: 'test_send',
      dayOfWeek: 'Сегодня',
      category: 'Тест',
      requestTemplate: '',
      channel: String(telegramId),
      channels: [String(telegramId)],
      title,
      signature: signature || '',
      messageFormat: effectiveFormat,
      linkPreviewEnabled: Boolean(linkPreviewEnabled),
      protectContent: Boolean(protectContent),
      audioFormat: audioFormat || (attachmentType === 'voice' ? 'voice' : 'audio'),
      audioTitle,
      audioPerformer
    };

    const result = await sendPromptToTelegram(title, content, dummyReq, {
      messageFormat: effectiveFormat,
      uppercaseHeader: Boolean(uppercaseHeader),
      signature,
      linkPreviewEnabled: Boolean(linkPreviewEnabled),
      protectContent: Boolean(protectContent),
      attachmentType,
      audioFormat: audioFormat || (attachmentType === 'voice' ? 'voice' : 'audio'),
      audioTitle,
      audioPerformer,
      attachmentUrl,
      attachmentUrls,
      inlineButtons,
      telegramId,
      isTest: true
    });

    // Record technical log entry without creating duplicate rows in drafts/posts table
    DB.addLog({
      publicationId: `test_dm_${Date.now()}`,
      action: result.ok ? 'PUBLISHED' : 'FAILED',
      details: result.ok 
        ? `Тестовая отправка сообщения в личные сообщения Telegram (${telegramId}): ${title || 'Без заголовка'}`
        : `Ошибка тестовой отправки в личку (${telegramId}): ${result.error}`
    });

    if (result.ok) {
      res.json({ success: true, messageId: result.messageId, message: `Сообщение успешно отправлено в личку Telegram (${telegramId})!` });
    } else {
      res.status(400).json({ error: result.error || 'Ошибка отправки в Telegram' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка тестовой отправки' });
  }
});

// Helper to extract custom_emoji_id recursively from Telegram updates
function extractCustomEmojiIds(obj: any, ids: Set<string> = new Set()): string[] {
  if (!obj) return Array.from(ids);
  
  // 1. String JSON regex search for custom_emoji_id
  try {
    const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
    const matches = jsonStr.match(/"custom_emoji_id"\s*:\s*"?(\d+)"?/g);
    if (matches) {
      for (const m of matches) {
        const idMatch = m.match(/\d+/);
        if (idMatch) ids.add(idMatch[0]);
      }
    }
  } catch (e) {
    // Ignore stringify circular issues
  }

  // 2. Recursive object property search
  if (typeof obj === 'object') {
    if (obj.type === 'custom_emoji' && obj.custom_emoji_id) {
      ids.add(String(obj.custom_emoji_id));
    }
    if (obj.custom_emoji_id) {
      ids.add(String(obj.custom_emoji_id));
    }
    if (obj.sticker && obj.sticker.custom_emoji_id) {
      ids.add(String(obj.sticker.custom_emoji_id));
    }
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        extractCustomEmojiIds(obj[key], ids);
      }
    }
  }

  return Array.from(ids);
}

// Set Webhook Endpoint for @IIrkiBot
apiRouter.get('/telegram/bot-info', (req: Request, res: Response) => {
  res.json(getBotDetailsFromPg());
});

apiRouter.post('/telegram/setup-webhook', async (req: Request, res: Response) => {
  try {
    const token = getBotTokenFromPg() || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

    const tgConfig = await getTelegramBotConfig().catch(() => null);
    const tgData = await fetchTelegramBotApi({
      primaryBase: tgConfig?.apiBaseUrl,
      proxyType: tgConfig?.proxyType,
      token,
      endpoint: 'setWebhook',
      buildInit: () => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      })
    });

    res.json({
      success: tgData.ok,
      webhookUrl,
      telegramResponse: tgData
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка настройки Webhook' });
  }
});

// Endpoint to simulate/test custom emoji recognition in webhook
apiRouter.post('/telegram/test-webhook-emoji', (req: Request, res: Response) => {
  const { customEmojiId = '5386623631980895318' } = req.body;
  const mockUpdate = {
    update_id: 12345,
    message: {
      message_id: 99,
      chat: { id: 169262990, first_name: 'Test' },
      text: '✨',
      entities: [
        {
          offset: 0,
          length: 2,
          type: 'custom_emoji',
          custom_emoji_id: customEmojiId
        }
      ]
    }
  };
  const ids = extractCustomEmojiIds(mockUpdate);
  res.json({
    success: true,
    detectedIds: ids,
    mockCode: `![✨](tg://emoji?id=${ids[0] || customEmojiId})`
  });
});

// Telegram Webhook Endpoint for Custom Emoji ID recognition
apiRouter.post('/telegram/webhook', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    const message = update?.message || update?.edited_message || update?.channel_post;

    if (message && message.chat) {
      const chatId = message.chat.id;
      const foundEmojiIds = extractCustomEmojiIds(update);

      const settings = DB.getSettings();
      const token = getBotTokenFromPg() || settings.telegramBotToken || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';

      const tgConfig = await getTelegramBotConfig().catch(() => null);

      if (foundEmojiIds.length > 0) {
        const replyText = `✨ <b>Распознанный Telegram Custom Emoji ID:</b>\n\n` +
          foundEmojiIds.map((id: string, i: number) => 
            `<b>Эмодзи #${i + 1}:</b> <code>${id}</code>\n<b>Код для вставки в пост:</b> <code>![✨](tg://emoji?id=${id})</code>`
          ).join('\n\n') +
          `\n\n<i>Скопируйте код выше и вставьте в текст вашего поста!</i>`;

        await fetchTelegramBotApi({
          primaryBase: tgConfig?.apiBaseUrl,
          proxyType: tgConfig?.proxyType,
          token,
          endpoint: 'sendMessage',
          buildInit: () => ({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: replyText, parse_mode: 'HTML' })
          })
        });
      } else {
        const helpText = `👋 <b>Бот определения ID кастомных эмодзи (@IIrkiBot)</b>\n\nПришлите сюда любой премиум (кастомный) эмодзи или стикер из Telegram, и я мгновенно пришлю его ID и готовый код для вставки в пост!`;
        await fetchTelegramBotApi({
          primaryBase: tgConfig?.apiBaseUrl,
          proxyType: tgConfig?.proxyType,
          token,
          endpoint: 'sendMessage',
          buildInit: () => ({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: helpText, parse_mode: 'HTML' })
          })
        });
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('Telegram webhook error:', err);
    res.json({ ok: true });
  }
});

// Scenarios CRUD Endpoints
apiRouter.get('/scenarios', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  res.json(DB.getScenarios(userId));
});

apiRouter.get('/scenarios/check-name', (req: Request, res: Response) => {
  const rawName = String(req.query.name || '').trim();
  const excludeId = req.query.excludeId ? String(req.query.excludeId) : undefined;
  if (!rawName) {
    res.json({ ok: true, available: false, reason: 'empty' });
    return;
  }
  const taken = DB.isScenarioNameTaken(rawName, excludeId);
  res.json({ ok: true, available: !taken });
});

// Scenario Block Prompts DB CRUD & Cache Control
apiRouter.get('/scenarios/prompts', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const prompts = await listAllScenarioPromptsFromDb(forceRefresh);
    res.json({ success: true, prompts, count: prompts.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения промптов сценариев из БД' });
  }
});

apiRouter.post('/scenarios/prompts/refresh-cache', async (_req: Request, res: Response) => {
  try {
    invalidateScenarioPromptsCache();
    const prompts = await listAllScenarioPromptsFromDb(true);
    res.json({ success: true, refreshed: true, count: prompts.length, prompts });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сброса кэша промптов сценариев' });
  }
});

apiRouter.post('/scenarios/prompts/seed-missing', async (_req: Request, res: Response) => {
  try {
    const result = await seedMissingScenarioPromptsInDb();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка дозаполнения недостающих промптов' });
  }
});

apiRouter.post('/scenarios/prompts', async (req: Request, res: Response) => {
  try {
    const created = await createScenarioPromptInDb(req.body || {});
    res.status(201).json({ success: true, prompt: created });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Ошибка создания промпта сценария в БД' });
  }
});

apiRouter.put('/scenarios/prompts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await updateScenarioPromptInDb(id, req.body || {});
    if (!updated) {
      res.status(404).json({ error: 'Запись промпта сценария не найдена в базе данных' });
      return;
    }
    res.json({ success: true, prompt: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка обновления промпта сценария в БД' });
  }
});

apiRouter.post('/scenarios/prompts/:id/reset', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const restored = await resetScenarioPromptInDb(id);
    if (!restored) {
      res.status(404).json({ error: 'Запись промпта сценария не найдена в базе данных' });
      return;
    }
    res.json({ success: true, prompt: restored });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Ошибка восстановления эталонного промпта' });
  }
});

apiRouter.post('/scenarios/ai-assistant', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.body?.userId || (req.headers['x-user-id'] as string) || '';
    const db = await getPgDB();
    const perm = checkTariffPermission(db, rawUserId, ServerTariffLevel.Otryv, 'Генератор Сценариев ИИрка');
    if (!perm.allowed) {
      res.status(perm.statusCode).json(perm.payload);
      return;
    }

    const userId = perm.resolved.userId || normalizeUserId(rawUserId || '16926299042');
    const result = await executeIirkaScenarioAssistant({
      ...(req.body || {}),
      userId
    });
    res.json(result);
  } catch (err: any) {
    const code = err?.statusCode === 402 ? 402 : (err?.statusCode === 403 ? 403 : 400);
    res.status(code).json({ error: err?.message || 'Ошибка работы помощника Иирки' });
  }
});

apiRouter.post('/scenarios/ai-assistant-stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const writeEvent = (evt: Record<string, any>) => {
    try {
      res.write(`${JSON.stringify(evt)}\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch {}
  };

  try {
    const rawUserId = req.body?.userId || (req.headers['x-user-id'] as string) || '';
    const db = await getPgDB();
    const perm = checkTariffPermission(db, rawUserId, ServerTariffLevel.Otryv, 'Генератор Сценариев ИИрка');
    if (!perm.allowed) {
      writeEvent({
        type: 'error',
        needUpgrade: true,
        requiredTariff: perm.payload?.requiredTariff || 'Отрыв',
        error: perm.payload?.error || 'Генератор Сценариев ИИрка доступен начиная с тарифа «Отрыв».'
      });
      res.end();
      return;
    }

    const userId = perm.resolved.userId || normalizeUserId(rawUserId || '16926299042');
    await executeIirkaScenarioAssistant(
      {
        ...(req.body || {}),
        userId
      },
      writeEvent
    );
    res.end();
  } catch (err: any) {
    console.error('[Iirka Stream] Error:', err);
    writeEvent({
      type: 'error',
      error: err?.message || 'Ошибка работы помощника Иирки'
    });
    res.end();
  }
});

apiRouter.post('/scenarios', async (req: Request, res: Response) => {
  const userId = req.body.userId || (req.headers['x-user-id'] as string) || '';
  const { id, name, description, topicCategory, targetChannels, messageFormat, enabled, schedule, steps, nodes, edges, workflowLayout, category, testResults } = req.body;
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    res.status(400).json({ error: 'Пожалуйста, укажите название сценария' });
    return;
  }
  if (DB.isScenarioNameTaken(cleanName, id)) {
    res.status(409).json({ error: 'Сценарий с таким названием уже существует в базе данных. Введите уникальное название.' });
    return;
  }
  const newScen = DB.addScenario({
    id,
    userId,
    name: cleanName,
    description: description || '',
    category: category || topicCategory || 'Автоматизация',
    topicCategory: topicCategory || category || 'Технологии и нейросети',
    targetChannels: targetChannels || [],
    messageFormat: messageFormat || 'v2',
    enabled: enabled !== false,
    schedule: schedule || { frequency: 'daily', time: '10:00' },
    steps: steps || [],
    nodes: nodes || [],
    edges: edges || [],
    workflowLayout: workflowLayout || 'canvas',
    testResults: testResults || {}
  });
  await syncScenarioCronEntry(newScen).catch(() => null);
  const fresh = DB.getScenarios().find((s) => s.id === newScen.id) || newScen;
  res.status(201).json(fresh);
});

apiRouter.put('/scenarios/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (req.body.name !== undefined) {
      const cleanName = String(req.body.name || '').trim();
      if (!cleanName) {
        res.status(400).json({ error: 'Название сценария не может быть пустым' });
        return;
      }
      if (DB.isScenarioNameTaken(cleanName, id)) {
        res.status(409).json({ error: 'Сценарий с таким названием уже существует в базе данных. Введите уникальное название.' });
        return;
      }
      req.body.name = cleanName;
    }
    try {
      const updated = DB.updateScenario(id, req.body);
      await syncScenarioCronEntry(updated).catch(() => null);
      const fresh = DB.getScenarios().find((s) => s.id === id) || updated;
      res.json(fresh);
    } catch {
      const fallbackName = String(req.body.name || `Сценарий ${id.slice(-4)}`).trim();
      const created = DB.addScenario({
        ...req.body,
        id,
        name: DB.isScenarioNameTaken(fallbackName, id) ? `${fallbackName} (${id.slice(-4)})` : fallbackName
      });
      await syncScenarioCronEntry(created).catch(() => null);
      const freshCreated = DB.getScenarios().find((s) => s.id === created.id) || created;
      res.json(freshCreated);
    }
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Duplicate an existing scenario with remapped node/edge IDs and unique name
apiRouter.post('/scenarios/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sqlDb = await getPgDB();
    const source =
      getScenarioByIdFromDb(sqlDb, id) ||
      DB.getScenarios().find((s) => String(s.id) === String(id));

    if (!source) {
      res.status(404).json({ error: 'Исходный сценарий не найден в базе данных.' });
      return;
    }

    const baseName = String(source.name || 'Сценарий').trim();
    let candidateName = `${baseName} (копия)`;
    let copyCounter = 2;
    while (DB.isScenarioNameTaken(candidateName)) {
      candidateName = `${baseName} (копия ${copyCounter})`;
      copyCounter++;
    }

    const idMap = new Map<string, string>();
    const tsSuffix = Date.now().toString(36);
    const clonedNodes = Array.isArray(source.nodes)
      ? source.nodes.map((node: any, idx: number) => {
          const oldId = String(node?.id || `node_${idx}`);
          const newId = `node_${tsSuffix}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
          idMap.set(oldId, newId);
          const cloned = JSON.parse(JSON.stringify(node || {}));
          delete cloned.lastOutput;
          return { ...cloned, id: newId };
        })
      : [];

    const clonedEdges = Array.isArray(source.edges)
      ? source.edges.map((edge: any, idx: number) => {
          const cloned = JSON.parse(JSON.stringify(edge || {}));
          return {
            ...cloned,
            id: `edge_${tsSuffix}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            sourceNodeId: idMap.get(String(edge?.sourceNodeId)) || edge?.sourceNodeId,
            targetNodeId: idMap.get(String(edge?.targetNodeId)) || edge?.targetNodeId
          };
        })
      : [];

    const requestUserId =
      req.body?.userId || (req.headers['x-user-id'] as string) || source.userId || '';

    const created = DB.addScenario({
      userId: requestUserId,
      name: candidateName,
      description: source.description || '',
      category: source.category || source.topicCategory || 'Автоматизация',
      topicCategory: source.topicCategory || source.category || 'Технологии и нейросети',
      targetChannels: Array.isArray(source.targetChannels) ? [...source.targetChannels] : [],
      messageFormat: source.messageFormat || 'v2',
      enabled: source.enabled !== false,
      schedule:
        source.schedule && typeof source.schedule === 'object'
          ? JSON.parse(JSON.stringify(source.schedule))
          : source.schedule || { frequency: 'daily', time: '10:00' },
      steps: Array.isArray(source.steps) ? JSON.parse(JSON.stringify(source.steps)) : [],
      nodes: clonedNodes,
      edges: clonedEdges,
      workflowLayout: source.workflowLayout || 'canvas',
      testResults: {},
      lastRunAt: undefined,
      nextRunAt: undefined,
      lastSentAt: undefined,
      lastRunSlot: undefined,
      isSent: false,
      runsCount: 0,
      lastStatus: undefined,
      lastError: undefined
    });

    await syncScenarioCronEntry(created).catch(() => null);
    savePgDB();
    await flushPendingPgWrites();

    const fresh =
      getScenarioByIdFromDb(sqlDb, created.id) ||
      DB.getScenarios().find((s) => s.id === created.id) ||
      created;
    res.status(201).json(fresh);
  } catch (err: any) {
    console.error('[scenarios/duplicate] Error:', err);
    res.status(500).json({ error: err?.message || 'Ошибка при создании копии сценария' });
  }
});

// 1-Iirka AI Natural Language Multi-Schedule Parser for Scenario Schedule Trigger
apiRouter.post('/scenarios/ai-parse-schedule', async (req: Request, res: Response) => {
  try {
    const { userId, prompt, currentTimezone } = req.body || {};
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      res.status(400).json({ error: 'Опишите желаемое расписание запусков своими словами.' });
      return;
    }

    const cleanUserId = String(userId || req.headers['x-user-id'] || '16926299042');
    const user =
      DB.getUsers().find((u) => u.id === cleanUserId) ||
      DB.getUsers().find((u) => u.role === 'admin');

    const sqlDbForCost = await getPgDB();
    const pricing = await getPricingConfig(sqlDbForCost);
    const cost = pricing.textAi.scheduleAiFill;
    if (user && cost > 0 && (user.balance || 0) < cost) {
      res.status(402).json({
        error: `Недостаточно Иирок для ИИ-заполнения расписания (требуется ${formatIirkyCount(cost)}, баланс: ${user.balance || 0}).`
      });
      return;
    }

    const parsed = await parseScheduleWithAi1Iirka({
      userPrompt: cleanPrompt,
      currentTimezone: currentTimezone || 'Europe/Moscow',
      userId: cleanUserId
    });

    let newBalance = user?.balance;
    if (user && cost > 0) {
      const updatedUser = DB.updateUser(user.id, {
        balance: Math.max(0, (user.balance || 0) - cost)
      });
      newBalance = updatedUser.balance;
      try {
        const sqlDb = await getPgDB();
        sqlDb.run(
          `INSERT INTO transactions (id, user_id, type, balance_type, amount, description, status, created_at)
           VALUES (?, ?, 'cost', 'iirky', ?, 'ИИ-заполнение расписания сценария', 'completed', ?)`,
          [`tx_sched_${Date.now()}`, user.id, -cost, new Date().toISOString()]
        );
        savePgDB();
      } catch {}
    }

    res.json({
      success: true,
      timezone: parsed.timezone,
      schedules: parsed.schedules,
      summary: parsed.summary,
      cost,
      balance: newBalance
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Ошибка ИИ-заполнения расписания' });
  }
});

apiRouter.delete('/scenarios/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  DB.deleteScenario(id);
  removeScenarioCronEntry(id).catch(() => null);
  res.json({ success: true });
});

// Interactive AI Inline Buttons Generator (1 Iirka) for Scenario & Post Inline Buttons Form
apiRouter.post('/scenarios/generate-inline-buttons', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      postTitle,
      postText,
      buttonsCount,
      buttonsPerRow,
      layoutRule,
      customInstruction,
      customPrompt,
      defaultUrl,
      targetUrls,
      aiButtonUrls,
      existingRows,
      tone
    } = req.body || {};

    const cleanUserId = String(userId || req.headers['x-user-id'] || '16926299042');
    const user =
      DB.getUsers().find((u) => u.id === cleanUserId) ||
      DB.getUsers().find((u) => u.role === 'admin');

    const sqlDbForCost = await getPgDB();
    const pricing = await getPricingConfig(sqlDbForCost);
    const cost = pricing.textAi.inlineButtons;
    if (user && cost > 0 && (user.balance || 0) < cost) {
      res.status(402).json({
        error: `Недостаточно Иирок для генерации кнопок (требуется ${formatIirkyCount(cost)}, баланс: ${user.balance || 0}).`
      });
      return;
    }

    const numericPerRow = Number(buttonsPerRow);
    const resolvedPerRow: 1 | 2 | 3 = numericPerRow === 3 ? 3 : numericPerRow === 2 ? 2 : 1;

    const generatedRows = await generateInlineButtonsFromPost1Iirka({
      postTitle,
      postText,
      buttonsCount: Number(buttonsCount || 2),
      buttonsPerRow: resolvedPerRow,
      layoutRule: layoutRule ? String(layoutRule) : undefined,
      customInstruction: customInstruction ? String(customInstruction) : undefined,
      customPrompt: customPrompt ? String(customPrompt) : undefined,
      defaultUrl: defaultUrl || 'https://t.me/IIrkiBot',
      targetUrls: Array.isArray(targetUrls) ? targetUrls : Array.isArray(aiButtonUrls) ? aiButtonUrls : undefined,
      existingRows,
      tone,
      userId: cleanUserId
    });

    let newBalance = user?.balance;
    if (user && cost > 0) {
      const updatedUser = DB.updateUser(user.id, {
        balance: Math.max(0, (user.balance || 0) - cost)
      });
      newBalance = updatedUser.balance;
      try {
        const sqlDb = await getPgDB();
        sqlDb.run(
          `INSERT INTO transactions (id, user_id, type, balance_type, amount, description, status, created_at)
           VALUES (?, ?, 'cost', 'iirky', ?, 'Генерация инлайн-кнопок по тексту поста', 'completed', ?)`,
          [`tx_btns_${Date.now()}`, user.id, -cost, new Date().toISOString()]
        );
        savePgDB();
      } catch {}
    }

    res.json({
      success: true,
      inlineButtons: generatedRows,
      cost,
      balance: newBalance,
      message: `Инлайн-кнопки сгенерированы по тексту поста (${formatIirkyCount(cost)})`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка генерации инлайн-кнопок' });
  }
});

apiRouter.get('/scenarios/:id/test-results', async (req: Request, res: Response) => {
  try {
    const nodeId = req.query.nodeId ? String(req.query.nodeId) : undefined;
    const data = await getScenarioTestResultsFromPg(req.params.id, nodeId);
    res.json({ success: true, ...data });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Ошибка чтения результатов теста из базы данных' });
  }
});

apiRouter.get('/scenarios/logs', (req: Request, res: Response) => {
  res.json(DB.getScenarioLogs());
});

// Fetch base posts for scenario selection (filtered strictly by user)
apiRouter.get('/scenarios/base-posts', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  const dayRequests = DB.getDayRequests(userId);

  const posts = dayRequests.map(d => ({
    id: d.id,
    title: d.title || d.category || 'Пост',
    category: d.category || 'Общее',
    content: d.postText !== undefined ? d.postText : (d.requestTemplate || ''),
    channel: d.channel || '@SAV_AI',
    format: d.messageFormat || 'v2',
    type: 'dayRequest'
  }));

  res.json(posts);
});

// Scenario Instructions & Truth Documentation Endpoint (Task 6)
apiRouter.get('/scenarios/instructions', async (_req: Request, res: Response) => {
  try {
    const { getSyncPgDB } = await import('./db/postgres');
    const { getAllInstructionsFromDb } = await import('./db/scenarioInstructionsTable');
    const db = getSyncPgDB();
    if (db) {
      const instructions = getAllInstructionsFromDb(db);
      return res.json(instructions);
    }
  } catch (e) {
    console.error('Failed to get instructions from PostgreSQL:', e);
  }
  const { DEFAULT_INSTRUCTIONS } = await import('./db/scenarioInstructionsTable');
  res.json(DEFAULT_INSTRUCTIONS);
});

apiRouter.put('/scenarios/instructions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { getSyncPgDB } = await import('./db/postgres');
    const { updateInstructionInDb } = await import('./db/scenarioInstructionsTable');
    const db = getSyncPgDB();
    if (db) {
      const updated = updateInstructionInDb(db, id, req.body);
      return res.json(updated);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Scenario Test Execution Endpoint (Single Node or Chain up to Target Node, persisted in DB row)
apiRouter.post('/scenarios/test-node', async (req: Request, res: Response) => {
  try {
    const result = await executeScenarioTestAndPersist(req.body || {});
    res.json(result);
  } catch (err: any) {
    console.error('Test node/chain error:', err);
    const status = err?.statusCode === 402 ? 402 : 400;
    res.status(status).json({ error: err.message || 'Ошибка тестирования сценария' });
  }
});

// Real-time NDJSON Streaming Endpoint for Scenario Node / Chain Test Progress (% and Stage Highlighting)
apiRouter.post('/scenarios/test-node-stream', async (req: Request, res: Response) => {
  const scenId = String(req.body?.scenarioId || req.body?.scenarioSnapshot?.id || '').trim();
  const writeEvent = createUnbufferedStreamWriter(res, scenId || undefined);

  try {
    await executeScenarioTestAndPersist({
      ...(req.body || {}),
      onEvent: writeEvent
    });
    res.end();
  } catch (err: any) {
    console.error('Test node/chain stream error:', err);
    writeEvent({
      type: 'error',
      statusCode: err?.statusCode === 402 ? 402 : 400,
      error: err.message || 'Ошибка тестирования сценария'
    });
    res.end();
  }
});

// Scenario Test Step Execution Endpoint (Legacy)
apiRouter.post('/scenarios/test-step', async (req: Request, res: Response) => {
  const { stepNumber, scenarioData, customAction } = req.body;
  try {
    if (stepNumber === 1) {
      // Step 1: Study history & generate new unique topic
      const memoryCount = scenarioData?.steps?.find((s: any) => s.stepNumber === 1)?.config?.memoryCount || 5;
      const recentPubs = DB.getPublications().slice(0, memoryCount).map(p => p.text);
      
      const topicCategory = scenarioData?.topicCategory || 'Технологии и ИИ';
      const newTopic = await generateTopicFromHistory(topicCategory, recentPubs);

      return res.json({
        success: true,
        stepNumber: 1,
        generatedTopic: newTopic,
        memoryCount: memoryCount,
        historyAnalyzedCount: recentPubs.length,
        message: `Изучена история ${recentPubs.length} последних постов. Сгенерирована новая уникальная тема: "${newTopic}"`
      });
    }

    if (stepNumber === 2) {
      // Step 2: Write post text
      const topic = scenarioData?.generatedTopic || scenarioData?.topicCategory || 'Технологии ИИ';
      const requestTemplate = scenarioData?.steps?.find((s: any) => s.stepNumber === 2)?.config?.requestTemplate || '';
      const templateFilled = requestTemplate.replace(/\[ТЕМА\]/gi, topic);

      let customInstructions = undefined;
      if (customAction === 'rewrite') {
        customInstructions = `Перепиши текущий пост более интересно, свежо и увлекательно, сохранив смысловую суть: "${(scenarioData?.generatedText || '').slice(0, 300)}"`;
      }

      const memoryCount = scenarioData?.steps?.find((s: any) => s.stepNumber === 1)?.config?.memoryCount || 5;
      const recentPubs = DB.getPublications().slice(0, memoryCount).map(p => p.text);

      const result = await generateProkhorPrompt(
        'Сегодня',
        topic,
        templateFilled,
        customInstructions,
        recentPubs
      );

      return res.json({
        success: true,
        stepNumber: 2,
        generatedTitle: result.title,
        generatedText: result.content,
        promptSent: templateFilled,
        message: 'Текст поста успешно сгенерирован нейросетью ProTalk.'
      });
    }

    if (stepNumber === 3) {
      // Step 3: Write image prompt
      const postTitle = scenarioData?.basePromptTitle || scenarioData?.generatedTopic || scenarioData?.topicCategory || 'Пост';
      const postText = scenarioData?.generatedText || 'Экспертный пост для Telegram';
      const stylePrompt = scenarioData?.steps?.find((s: any) => s.stepNumber === 3)?.config?.imageStylePrompt || '';

      const imgPrompt = await generateImagePromptFromPost(postTitle, postText, stylePrompt);

      return res.json({
        success: true,
        stepNumber: 3,
        generatedImagePrompt: imgPrompt,
        message: 'Промпт для генерации изображения составлен на английском языке.'
      });
    }

    if (stepNumber === 4) {
      // Step 4: Generate image in ProTalk (Album support)
      const promptToUse = scenarioData?.generatedImagePrompt || `Futuristic illustration for ${scenarioData?.topicCategory || 'AI post'}, 8k, detailed`;
      const imageUrl = await generateProTalkImage(promptToUse);

      const currentList: string[] = Array.isArray(scenarioData?.generatedImageUrls) ? [...scenarioData.generatedImageUrls] : [];
      if (customAction === 'add_image') {
        currentList.push(imageUrl);
      } else {
        if (currentList.length === 0) currentList.push(imageUrl);
        else currentList[0] = imageUrl;
      }

      return res.json({
        success: true,
        stepNumber: 4,
        generatedImageUrl: imageUrl,
        generatedImageUrls: currentList,
        message: `Изображение сгенерировано в ProTalk (всего в альбоме: ${currentList.length}).`
      });
    }

    if (stepNumber === 5) {
      // Step 5: Format post
      const format = scenarioData?.messageFormat || 'v2';
      const text = scenarioData?.generatedText || 'Текст поста';
      const imageUrls = scenarioData?.generatedImageUrls || [];

      let formattedText = text;
      if (format === 'v2') {
        formattedText = `<b>${scenarioData?.basePromptTitle || scenarioData?.generatedTopic || 'Автопост'}</b>\n\n${text}\n\n<i>⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n✍️ @IIrkiBot</i>`;
      } else {
        formattedText = `${text}\n\n<b>Наш бот:</b> @IIrkiBot`;
      }

      return res.json({
        success: true,
        stepNumber: 5,
        formattedPreview: formattedText,
        hasImages: imageUrls.length > 0,
        imageCount: imageUrls.length,
        message: imageUrls.length > 0 
          ? `Пост оформлен в формате ${format.toUpperCase()} с ${imageUrls.length} медиавложениями (альбом).` 
          : `Пост оформлен без медиавложений в текстовом формате ${format.toUpperCase()}.`
      });
    }

    if (stepNumber === 6) {
      // Step 6: Schedule calculation
      const offsetHours = scenarioData?.offsetHoursBeforePost ?? 12;
      const targetChannels = scenarioData?.targetChannels?.length ? scenarioData.targetChannels : ['@SAV_AI'];
      
      const now = new Date();
      const nextPostDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (scenarioData?.schedule?.time) {
        const [hh, mm] = scenarioData.schedule.time.split(':').map(Number);
        if (!isNaN(hh) && !isNaN(mm)) {
          nextPostDate.setHours(hh, mm, 0, 0);
        }
      }

      const scenarioRunDate = new Date(nextPostDate.getTime() - offsetHours * 60 * 60 * 1000);

      return res.json({
        success: true,
        stepNumber: 6,
        nextPostTime: nextPostDate.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        nextScenarioTime: scenarioRunDate.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        offsetHours: offsetHours,
        targetChannels: targetChannels,
        message: `Настроено: пост будет опубликован ${nextPostDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}, автосценарий запустится за ${offsetHours} часов до этого (${scenarioRunDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}).`
      });
    }

    throw new Error('Неизвестный номер шага');
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка тестирования шага' });
  }
});

// Scenario Manual Trigger Execution
apiRouter.post('/scenarios/:id/run', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, telegramId } = req.body;
  try {
    const result = await runScenarioExecution(id, userId, telegramId);
    res.json(result);
  } catch (e: any) {
    const status = e?.statusCode === 402 ? 402 : 400;
    res.status(status).json({ error: e.message || 'Ошибка запуска сценария' });
  }
});

// Scenario Manual Trigger Streaming Execution (Real-time % and block highlighting)
apiRouter.post('/scenarios/:id/run-stream', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, telegramId } = req.body || {};
  const writeEvent = createUnbufferedStreamWriter(res, id);

  try {
    await runFullScenarioGraphExecution(id, userId, telegramId, writeEvent);
    res.end();
  } catch (err: any) {
    console.error('Run scenario stream error:', err);
    writeEvent({
      type: 'error',
      statusCode: err?.statusCode === 402 ? 402 : 400,
      error: err.message || 'Ошибка запуска сценария'
    });
    res.end();
  }
});

// Helper for running scenario step by step
export async function runScenarioExecution(scenarioId: string, userId?: string, telegramId?: number) {
  return runFullScenarioGraphExecution(scenarioId, userId, telegramId);
}

// Setup Telegram Webhook endpoint
apiRouter.post('/telegram/set-webhook', async (req: Request, res: Response) => {
  try {
    const { webhookUrl } = req.body;
    const settings = DB.getSettings();
    const token = getBotTokenFromPg() || settings.telegramBotToken || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';
    const targetUrl = webhookUrl || `${req.protocol}://${req.get('host')}/api/telegram/webhook`;

    const tgConfig = await getTelegramBotConfig().catch(() => null);
    const tgData = await fetchTelegramBotApi({
      primaryBase: tgConfig?.apiBaseUrl,
      proxyType: tgConfig?.proxyType,
      token,
      endpoint: `setWebhook?url=${encodeURIComponent(targetUrl)}`
    });

    res.json({ success: tgData.ok, telegramResponse: tgData, webhookUrl: targetUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Background Scheduler for Individual Scheduled Posts & Publications
let lastRenewalCheck = 0;
const inFlightSchedulerIds = new Set<string>();

export function startPostScheduler() {
  setInterval(async () => {
    try {
      const now = new Date();
      const nowMs = now.getTime();

      // Auto-renew 30-day schedule horizon every 30 minutes
      if (nowMs - lastRenewalCheck > 30 * 60 * 1000) {
        lastRenewalCheck = nowMs;
        renewAllActiveSchedules();
      }

      // 1. Process Due Scheduled Publications in the database (synced with live Draft edits)
      const allPubs = DB.getPublications();

      for (const pub of allPubs) {
        if (pub.statusType !== 'scheduled') continue;
        if (
          String(pub.id).startsWith('folder_') ||
          String(pub.id).startsWith('sel_') ||
          String(pub.promptId).startsWith('folder_') ||
          String(pub.promptId).startsWith('sel_') ||
          pub.category === 'Подборки' ||
          pub.category === 'Папки'
        ) {
          continue;
        }

        const candidatePostId = pub.promptId || pub.id;
        if (candidatePostId && !String(pub.id).startsWith('pub_')) {
          try {
            const dbPg = await getPgDB();
            const ownCheck = dbPg.exec('SELECT status FROM cron WHERE id = ? LIMIT 1', [`cron_post_${candidatePostId}`]);
            const ownStatus = ownCheck?.[0]?.values?.[0]?.[0]
              ? String(ownCheck[0].values[0][0]).toLowerCase()
              : '';
            if (String(pub.id).startsWith('sched_') && ownCheck.length > 0 && ownCheck[0].values.length > 0) {
              continue;
            }
            if (ownStatus && ownStatus !== 'paused') {
              continue;
            }
          } catch {}
        }

        if (inFlightSchedulerIds.has(pub.id) || sharedScheduledPubLock.has(pub.id)) continue;

        const schedTime = new Date(pub.scheduledFor || pub.publishedAt).getTime();
        if (schedTime <= nowMs) {
          inFlightSchedulerIds.add(pub.id);
          sharedScheduledPubLock.add(pub.id);
          try {
            const fresh = resolveFreshScheduledPublicationPayload(pub);
            if (fresh.cancelled) {
              DB.updatePublication(pub.id, {
                status: false,
                statusType: 'cancelled',
                response: fresh.cancelReason || 'Отменено пользователем'
              });
              continue;
            }

            if (!fresh.text.trim() && !fresh.attachmentUrl.trim() && fresh.attachmentUrls.length === 0) {
              DB.updatePublication(pub.id, {
                status: false,
                statusType: 'cancelled',
                response: 'Текст публикации пуст'
              });
              continue;
            }

            console.log(`[Scheduler] Executing scheduled publication: "${fresh.title}" (${pub.id})`);

            const effectivePost = fresh.parentPost || {
              id: pub.promptId || pub.id,
              title: fresh.title,
              category: pub.category || 'общее',
              channel: fresh.targetChannels[0] || getDefaultChannelIdentifier(),
              channels: fresh.targetChannels,
              signature: fresh.signature,
              linkPreviewEnabled: true
            };

            const res = await sendPromptToTelegram(fresh.title, fresh.text, effectivePost as any, {
              messageFormat: fresh.messageFormat,
              uppercaseHeader: fresh.uppercaseHeader,
              signature: fresh.signature,
              attachmentType: fresh.attachmentType as any,
              audioFormat: fresh.audioFormat,
              attachmentUrl: fresh.attachmentUrl,
              attachmentUrls: fresh.attachmentUrls,
              inlineButtons: fresh.inlineButtons,
              channels: fresh.targetChannels
            });

            if (res.ok) {
              DB.updatePublication(pub.id, {
                promptTitle: fresh.title,
                text: fresh.text,
                channel: fresh.targetChannels.join(', '),
                status: true,
                statusType: 'published',
                publishedAt: now.toISOString(),
                messageId: res.messageId,
                response: 'Опубликовано по расписанию',
                messageFormat: fresh.messageFormat,
                attachmentType: fresh.attachmentType as any,
                attachmentUrl: fresh.attachmentUrl,
                attachmentUrls: fresh.attachmentUrls,
                inlineButtons: fresh.inlineButtons,
                signature: fresh.signature
              });

              if (fresh.publishToSocialFeed !== false) {
                syncToSocialNetworkFeed({
                  sourcePostId: fresh.parentPost?.id || pub.promptId || pub.id,
                  userId: pub.userId || fresh.parentPost?.userId,
                  title: fresh.title,
                  content: fresh.text,
                  attachmentType: fresh.attachmentType,
                  attachmentUrl: fresh.attachmentUrl,
                  attachmentUrls: fresh.attachmentUrls,
                  inlineButtons: fresh.inlineButtons,
                  messageFormat: fresh.messageFormat,
                  category: pub.category || fresh.parentPost?.category,
                  channel: fresh.targetChannels[0] || getDefaultChannelIdentifier()
                });
              }

              if (fresh.parentPost) {
                const parentFreq = fresh.parentPost.triggerSchedule?.frequency;
                const parentOneOff = !parentFreq || isOneOffScheduleFrequency(parentFreq);
                await DB.updateDayRequestAsync(fresh.parentPost.id, {
                  publishedAt: now.toISOString(),
                  status: parentOneOff ? 'опубликован' : 'запланирован'
                });
              }
            } else {
              DB.updatePublication(pub.id, {
                status: false,
                statusType: 'failed',
                publishedAt: now.toISOString(),
                response: res.error || 'Ошибка отправки в Telegram'
              });
            }
          } finally {
            inFlightSchedulerIds.delete(pub.id);
            sharedScheduledPubLock.delete(pub.id);
          }
        }
      }
    } catch (e) {
      console.error('[Scheduler] Error in scheduler loop:', e);
    }
  }, 30000);
}

// PostgreSQL ProTalk Database Management API Routes
apiRouter.get('/db/tables', async (req: Request, res: Response) => {
  try {
    const info = await getAllTablesInfo({ syncCache: true });
    res.json({ success: true, tables: info });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/db/sync', async (_req: Request, res: Response) => {
  try {
    const info = await syncAllTablesFromCloud();
    res.json({ success: true, tables: info, syncedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Ошибка синхронизации с ProTalk DB' });
  }
});

apiRouter.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.query.userId ? String(req.query.userId) : (req.headers['x-user-id'] as string) || '';
    const userId = rawUserId ? normalizeUserId(rawUserId) : '';
    const db = await getPgDB();
    let rows: any[] = [];
    try {
      const stmt = userId
        ? db.prepare('SELECT id, title, category, channel, status, message_format, trigger_schedule, published_at, created_at, post_text, signature FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000')
        : db.prepare('SELECT id, title, category, channel, status, message_format, trigger_schedule, published_at, created_at, post_text, signature FROM posts ORDER BY created_at DESC LIMIT 1000');
      if (userId) stmt.bind([userId]);
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
    } catch {
      rows = DB.getPublications(userId || undefined);
    }

    const headers = ['id', 'title', 'category', 'channel', 'status', 'message_format', 'trigger_schedule', 'published_at', 'created_at', 'post_text', 'signature'];
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escapeCsvCell(r[h] ?? '')).join(','))
    ];
    const csvBuffer = Buffer.from('\uFEFF' + lines.join('\r\n'), 'utf-8');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="publications.csv"');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'no-store');
    res.send(csvBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка экспорта публикаций в CSV' });
  }
});


apiRouter.get('/db/table/:tableName', async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const data = await getTableRows(tableName);
    res.json({ success: true, tableName, ...data });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/db/table/:tableName', async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const inserted = await insertRow(tableName, req.body);
    res.status(201).json({ success: true, row: inserted });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/db/table/:tableName/:id', async (req: Request, res: Response) => {
  try {
    const { tableName, id } = req.params;
    const updated = await updateRow(tableName, id, req.body);
    res.json({ success: true, row: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/db/table/:tableName/:id', async (req: Request, res: Response) => {
  try {
    const { tableName, id } = req.params;
    await deleteRow(tableName, id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/db/table/:tableName/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Не указан список ID для удаления' });
    }
    const result = await deleteRows(tableName, ids);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CSV Table Import endpoint (supports bulk rows insertion/replace into any PostgreSQL table)
apiRouter.post('/db/table/:tableName/import-csv', async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const { rows, csvText } = req.body;

    let parsedRows: Record<string, any>[] = [];

    if (Array.isArray(rows) && rows.length > 0) {
      parsedRows = rows;
    } else if (typeof csvText === 'string' && csvText.trim()) {
      parsedRows = parseRfc4180Csv(csvText);
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({ error: 'Не найдены корректные строки для импорта из CSV' });
    }

    const result = await importCSVRows(tableName, parsedRows);
    res.json({ success: true, tableName, importedCount: result.importedCount });
  } catch (err: any) {
    res.status(400).json({ error: 'Ошибка импорта CSV: ' + err.message });
  }
});

// High Performance Media Caching Proxy for Gallery and Browser Persistence
apiRouter.get('/media-proxy', async (req: Request, res: Response) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))) {
      return res.status(400).json({ error: 'Некорректный URL медиафайла' });
    }

    const normalized = normalizeProTalkMediaUrl(rawUrl) || rawUrl;
    const candidates = [normalized];
    if (normalized !== rawUrl) {
      candidates.push(rawUrl);
    }
    if (/^https?:\/\/file\.pro-talk\.ru\/tgf\//i.test(normalized)) {
      const hash = normalized.replace(/^https?:\/\/file\.pro-talk\.ru\/tgf\//i, '');
      candidates.push(`https://filestore.pro-talk.ru/${hash}`);
    }

    let upstreamRes: globalThis.Response | null = null;
    for (const candidateUrl of candidates) {
      try {
        const attempt = await fetch(candidateUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; IISMM-MediaProxy/1.0)',
            Accept: 'image/*,video/*,audio/*,*/*;q=0.8'
          },
          signal: AbortSignal.timeout(20000)
        });
        if (attempt.ok) {
          upstreamRes = attempt;
          break;
        }
        if (!upstreamRes) upstreamRes = attempt;
      } catch {}
    }

    if (!upstreamRes || !upstreamRes.ok) {
      return res.status(upstreamRes?.status || 502).send('Ошибка загрузки медиафайла с удалённого сервера');
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка медиа-прокси: ' + err.message });
  }
});

apiRouter.post('/db/query', async (req: Request, res: Response) => {
  try {
    const sql = req.body?.sql || req.body?.query;
    if (!sql) {
      return res.status(400).json({ error: 'SQL запрос не передан' });
    }
    const result = await executeRawSQL(sql);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Scheduled publications & horizon renewals are handled by startCentralizedCronWorker in cronWorker.ts

// CRON API Endpoints
apiRouter.get('/cron', async (req: Request, res: Response) => {
  try {
    const data = await getTableRows('cron');
    res.json({ success: true, items: data.rows || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/cron', async (req: Request, res: Response) => {
  try {
    const { item_type, item_id, title, cron_expression, schedule_human } = req.body;
    const newCron = {
      id: `cron_${Date.now()}`,
      item_type: item_type || 'post',
      item_id: item_id || '1',
      title: title || 'Запланированный запуск',
      cron_expression: cron_expression || '0 12 * * *',
      schedule_human: schedule_human || 'Ежедневно в 12:00 MSK',
      next_run: new Date(Date.now() + 86400000).toISOString(),
      last_run: new Date().toISOString(),
      status: 'active',
      created_at: new Date().toISOString()
    };
    await insertRow('cron', newCron);
    res.status(201).json({ success: true, cron: newCron });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/cron/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await updateRow('cron', id, req.body);
    res.json({ success: true, cron: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/cron/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteRow('cron', id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/cron/:id/run', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cronData = await getTableRows('cron');
    const item = cronData.rows.find((r: any) => r.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Задача Крон не найдена' });
    }

    let executionResult: any = { message: 'Успешно запущено по расписанию Cron' };
    if (item.item_type === 'backup' || item.id === 'cron_backup_daily_0600_msk') {
      const { executeDatabaseBackup } = await import('./backup');
      const backupRes = await executeDatabaseBackup('Ручной запуск из панели управления Cron', { force: true });
      executionResult = { message: 'Бэкап базы данных успешно создан и отправлен администратору в Telegram!', backup: backupRes };
    } else if (item.item_type === 'tariffs' || item.id === 'cron_tariffs_checker') {
      const { processDueTariffsTask } = await import('./cronWorker');
      executionResult = await processDueTariffsTask(item);
    } else if (item.item_type === 'autopost' || item.id === 'cron_autopost_dispatcher') {
      const { tickCentralizedCronWorker } = await import('./cronWorker');
      await tickCentralizedCronWorker();
      executionResult = { message: 'Очередь отложенных публикаций проверена и обработана.' };
    } else if (item.item_type === 'scenery') {
      executionResult = await runScenarioExecution(item.item_id);
    } else {
      // Execute Post publication trigger
      const postsData = await getTableRows('posts');
      const targetPost = postsData.rows.find((p: any) => p.id === item.item_id) || postsData.rows[0];
      if (targetPost) {
        await updateRow('posts', targetPost.id, {
          status: 'sent',
          published_at: new Date().toISOString()
        });
        executionResult = { message: `Пост "${targetPost.title}" успешно выгружен в Telegram!` };
      }
    }

    // Update last_run
    const { getNextMsk0600Iso } = await import('./db/cronTable');
    const nextRun = (item.item_type === 'backup' || item.id === 'cron_backup_daily_0600_msk')
      ? getNextMsk0600Iso()
      : new Date(Date.now() + 86400000).toISOString();

    await updateRow('cron', id, {
      last_run: new Date().toISOString(),
      next_run: nextRun
    });

    res.json({ success: true, result: executionResult });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Chat Messages CRUD for Protalk & Social Messaging (Database is single source of truth)
apiRouter.get('/chat/messages', async (req: Request, res: Response) => {
  try {
    const { chatId, userId } = req.query;
    if (!chatId) {
      res.json([]);
      return;
    }
    const msgs = getChatMessagesFromPg(String(chatId), userId ? String(userId) : undefined);
    res.json(msgs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/chat/messages', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const rawText = body.text || '';
    const sender = body.sender || 'me';
    const userId = body.userId || body.senderId || '16926299042';
    const chatId = body.chatId || 'group-smm';
    const msgId = body.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // 1. Moderator-First Flow: Check message with AI Moderator BEFORE saving to DB
    if (sender === 'me' && rawText.trim().length > 0) {
      const isApproved = await runProTalkModeratorForMessage({
        id: msgId,
        userId: String(userId),
        sender,
        text: rawText,
        chatId: String(chatId)
      });

      if (!isApproved) {
        // Message violated rules and was rejected by AI Moderator before saving
        res.status(403).json({
          id: msgId,
          error: 'Сообщение отклонено ИИ-модератором за нарушение правил',
          status: 'violation',
          deleted: true
        });
        return;
      }
    }

    // 2. Clean UTF-8 storage: preserve original plaintext without cipher corruption
    const textToStore = rawText;

    // 3. Save to database
    const messageToSave = {
      ...body,
      id: msgId,
      text: textToStore
    };

    const saved = saveChatMessageToPg(messageToSave);
    if (!saved) {
      res.status(500).json({ error: 'Failed to save message' });
      return;
    }

    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/chat/messages/:id/moderate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const msg = {
      id: String(id),
      userId: body.userId || '16926299042',
      sender: body.sender || 'me',
      text: body.text || '',
      chatId: body.chatId
    };

    const passed = await runProTalkModeratorForMessage(msg);
    if (!passed) {
      const { deleteChatMessageFromPg } = await import('./db/postgres');
      deleteChatMessageFromPg(msg.id);
      res.json({ id: msg.id, passed: false, status: 'violation', deleted: true });
      return;
    }

    res.json({ id: msg.id, passed: true, status: 'approved' });
  } catch (err: any) {
    res.status(500).json({ error: err.message, passed: true, status: 'approved' });
  }
});

apiRouter.delete('/chat/messages/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteRow('chat_messages', id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Chat message reactions in real time
apiRouter.post('/chat/messages/:id/reactions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const type = body.type;
    const userId = body.userId || '16926299042';
    const userName = body.userName || 'Вы';
    const userAvatar = body.userAvatar;
    const chatId = body.chatId;

    if (!id || !type) {
      res.status(400).json({ error: 'id and type are required' });
      return;
    }

    const { toggleChatMessageReactionInPg } = await import('./db/postgres');
    const updated = toggleChatMessageReactionInPg(String(id), {
      type: String(type),
      userId: String(userId),
      userName: String(userName),
      userAvatar: userAvatar ? String(userAvatar) : undefined,
      chatId: chatId ? String(chatId) : undefined
    });

    res.json({ success: true, reactions: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Subscriptions API (Подписки на соавторов)
apiRouter.get('/subscriptions', (req: Request, res: Response) => {
  try {
    const { followerId } = req.query;
    if (!followerId) {
      res.status(400).json({ error: 'followerId is required' });
      return;
    }
    const list = getSubscriptionsFromPg(String(followerId));
    res.json({ success: true, subscriptions: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/subscriptions/count', (req: Request, res: Response) => {
  try {
    const { targetId, targetTelegramId } = req.query;
    if (!targetId) {
      res.json({ success: true, subscribersCount: 0 });
      return;
    }
    const count = getSubscribersCountFromPg(String(targetId), targetTelegramId ? String(targetTelegramId) : undefined);
    res.json({ success: true, subscribersCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/subscriptions/check', (req: Request, res: Response) => {
  try {
    const { followerId, targetId, targetTelegramId } = req.query;
    if (!followerId || !targetId) {
      res.json({ success: true, isSubscribed: false, subscribersCount: 0 });
      return;
    }
    const isSub = isSubscribedInPg(String(followerId), String(targetId), targetTelegramId ? String(targetTelegramId) : undefined);
    const count = getSubscribersCountFromPg(String(targetId), targetTelegramId ? String(targetTelegramId) : undefined);
    res.json({ success: true, isSubscribed: isSub, subscribersCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/subscriptions', (req: Request, res: Response) => {
  try {
    const { followerId, targetId, targetTelegramId, targetName, targetUsername, targetAvatar, action } = req.body || {};
    if (!followerId || !targetId) {
      res.status(400).json({ error: 'followerId and targetId are required' });
      return;
    }

    if (action === 'unsubscribe') {
      const success = removeSubscriptionInPg(String(followerId), String(targetId), targetTelegramId ? String(targetTelegramId) : undefined);
      const count = getSubscribersCountFromPg(String(targetId), targetTelegramId ? String(targetTelegramId) : undefined);
      res.json({ success, isSubscribed: false, subscribersCount: count });
      return;
    }

    const success = addSubscriptionInPg(String(followerId), String(targetId), targetName, targetUsername, targetAvatar);
    const count = getSubscribersCountFromPg(String(targetId), targetTelegramId ? String(targetTelegramId) : undefined);
    res.json({ success, isSubscribed: true, subscribersCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/subscriptions', (req: Request, res: Response) => {
  try {
    const followerId = req.query.followerId || req.body?.followerId;
    const targetId = req.query.targetId || req.body?.targetId;
    const targetTelegramId = req.query.targetTelegramId || req.body?.targetTelegramId;
    if (!followerId || !targetId) {
      res.status(400).json({ error: 'followerId and targetId are required' });
      return;
    }
    const success = removeSubscriptionInPg(String(followerId), String(targetId), targetTelegramId ? String(targetTelegramId) : undefined);
    const count = getSubscribersCountFromPg(String(targetId), targetTelegramId ? String(targetTelegramId) : undefined);
    res.json({ success, isSubscribed: false, subscribersCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Search API (Поиск авторов по имени, ID, почте, username)
apiRouter.get('/users/search', (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const users = searchUsersInPg(q);
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Chats API (Список чатов и создание личных чатов)
apiRouter.get('/user/chats', (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    const chats = getUserChatsFromPg(String(userId || '16926299042'));
    res.json({ success: true, chats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Authors Catalog API (Для страницы /social/users со списком всех авторов, поиском, пагинацией и статусом подписки)
apiRouter.get('/authors/catalog', (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : 50;
    const currentUserId = (req.query.currentUserId as string) || (req.query.userId as string) || '16926299042';
    const filter = (req.query.filter as 'all' | 'subscribed' | 'unsubscribed') || 'all';

    const result = getAuthorsCatalogFromPg({
      query: q,
      page,
      limit,
      currentUserId,
      filter
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Group Chat Creation API (Создание группового чата с выбранными авторами)
apiRouter.post('/user/chats/group', (req: Request, res: Response) => {
  try {
    const { creatorId, title, memberIds, description, avatarUrl } = req.body || {};
    if (!creatorId || !title || !Array.isArray(memberIds)) {
      res.status(400).json({ error: 'creatorId, title, and memberIds array are required' });
      return;
    }
    const groupChat = createGroupChatInPg(
      String(creatorId),
      String(title),
      memberIds,
      description ? String(description) : undefined,
      avatarUrl ? String(avatarUrl) : undefined
    );
    if (!groupChat) {
      res.status(500).json({ error: 'Failed to create group chat' });
      return;
    }
    res.json({ success: true, chat: groupChat });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Group Chat Details API (Получение подробностей группы, участников и админов)
apiRouter.get('/user/chats/group/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = String(req.query.userId || req.query.currentUserId || '16926299042');
    const group = getGroupChatByIdFromPg(id, currentUserId);
    if (!group) {
      res.status(404).json({ error: 'Group chat not found' });
      return;
    }
    res.json({ success: true, group });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Group Chat Update API (Редактирование группы админом: название, описание, аватар, участники, админы)
apiRouter.put('/user/chats/group/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { currentUserId, userId, title, description, avatarUrl, admins, members } = req.body || {};
    const normUser = String(currentUserId || userId || '16926299042');
    const updated = updateGroupChatInPg(id, normUser, {
      title,
      description,
      avatarUrl,
      admins,
      members
    });
    res.json({ success: true, group: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Group Chat Leave API (Выход пользователя из группы)
apiRouter.post('/user/chats/group/:id/leave', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { currentUserId, userId } = req.body || {};
    const normUser = String(currentUserId || userId || '16926299042');
    const ok = leaveGroupChatInPg(id, normUser);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Personal Chat Leave / Hide API (Скрытие / выход из личного диалога)
apiRouter.post('/user/chats/personal/leave', (req: Request, res: Response) => {
  try {
    const { userId, partnerId } = req.body || {};
    if (!userId || !partnerId) {
      res.status(400).json({ error: 'userId and partnerId are required' });
      return;
    }
    const ok = leavePersonalChatInPg(String(userId), String(partnerId));
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Personal Chat Block Toggle API (Блокировка / разблокировка личного чата)
apiRouter.post('/user/chats/personal/block', (req: Request, res: Response) => {
  try {
    const { userId, partnerId } = req.body || {};
    if (!userId || !partnerId) {
      res.status(400).json({ error: 'userId and partnerId are required' });
      return;
    }
    const result = toggleBlockPersonalChatInPg(String(userId), String(partnerId));
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Personal Chat Status API (Проверка статуса блокировки)
apiRouter.get('/user/chats/personal/status', (req: Request, res: Response) => {
  try {
    const { userId, partnerId } = req.query;
    if (!userId || !partnerId) {
      res.status(400).json({ error: 'userId and partnerId are required' });
      return;
    }
    const status = getPersonalChatStatusFromPg(String(userId), String(partnerId));
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/user/chats', (req: Request, res: Response) => {
  try {
    const { userId, partnerId, partnerName, partnerUsername, partnerAvatar, user1Id, user2Id, user2Name, user2Username, user2Avatar } = req.body || {};
    const finalUserId = String(userId || user1Id || '');
    const finalPartnerId = String(partnerId || user2Id || '');
    if (!finalUserId || !finalPartnerId) {
      res.status(400).json({ error: 'userId and partnerId are required' });
      return;
    }
    const chat = createOrGetDirectChatInPg(
      finalUserId,
      finalPartnerId,
      partnerName || user2Name,
      partnerUsername || user2Username,
      partnerAvatar || user2Avatar
    );
    res.json({ success: true, chat });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/chat/direct', (req: Request, res: Response) => {
  try {
    const { userId, partnerId, partnerName, partnerUsername, partnerAvatar, user1Id, user2Id, user2Name, user2Username, user2Avatar } = req.body || {};
    const finalUserId = String(userId || user1Id || '');
    const finalPartnerId = String(partnerId || user2Id || '');
    if (!finalUserId || !finalPartnerId) {
      res.status(400).json({ error: 'userId and partnerId are required' });
      return;
    }
    const chat = createOrGetDirectChatInPg(
      finalUserId,
      finalPartnerId,
      partnerName || user2Name,
      partnerUsername || user2Username,
      partnerAvatar || user2Avatar
    );
    res.json({ success: true, chat });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-responder settings endpoints (GET / POST)
apiRouter.get('/auto-responder', async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId || '');
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const data = getUserAutoRespondersFromPg(userId);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/auto-responder', async (req: Request, res: Response) => {
  try {
    const { userId, chatId, enabled, prompt, mode } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const safeMode = (mode === 'offline' || mode === 'online') ? mode : 'always';
    const success = saveUserAutoResponderToPg(
      String(userId),
      String(chatId || 'all'),
      Boolean(enabled),
      String(prompt || ''),
      safeMode
    );
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User online status & heartbeat endpoints
apiRouter.post('/user/heartbeat', async (req: Request, res: Response) => {
  try {
    const userId = String(req.body?.userId || req.query.userId || '');
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const success = updateUserLastSeenInPg(userId);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/user/online-status', async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId || '');
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const status = getUserLastSeenFromPg(userId);
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ProTalk Chat AI Response Endpoint (controlled by user autoresponder settings and 'Отрыв' tariff)
apiRouter.post('/protalk/chat-reply', async (req: Request, res: Response) => {
  try {
    const { userText, userName, chatId, responderName, responderId, isGroupChat, chatContext } = req.body || {};
    const textToProcess = userText && userText.trim() ? userText.trim() : 'Привет!';
    const sender = userName || 'Пользователь';
    const isGroup = Boolean(
      isGroupChat || 
      (chatId && (
        String(chatId).toLowerCase().startsWith('group') || 
        String(chatId).toLowerCase().startsWith('gr_') || 
        String(chatId).toLowerCase().startsWith('gr-') ||
        String(chatId).toLowerCase() === 'group-smm' ||
        String(chatId).toLowerCase() === 'group-iismm'
      ))
    );
    const isSaved = Boolean(
      chatId === 'saved_messages' ||
      chatId === 'saved' ||
      (chatId && chatId.startsWith('dm_') && chatId.replace('dm_', '').split('_')[0] === chatId.replace('dm_', '').split('_')[1])
    );

    // NEVER auto-reply in group chats or in saved messages (Избранное)
    if (isGroup) {
      return res.json({ success: false, reason: 'group_chat_disabled' });
    }
    if (isSaved) {
      return res.json({ success: false, reason: 'saved_messages_disabled' });
    }

    // Check if responder has an autoresponder configured
    let responderUserId = responderId ? String(responderId) : '';
    if (!responderUserId && chatId && chatId.startsWith('dm_')) {
      const parts = chatId.replace('dm_', '').split('_');
      // Look for the other user in the DM
      if (parts.length >= 2) {
        responderUserId = parts[1] || parts[0];
      }
    }

    // Verify auto-responder settings if we know the responder
    let customPrompt = '';
    if (responderUserId) {
      try {
        const db = await getPgDB();
        const uRow = getUserByIdFromDb(db, responderUserId) as any;
        const tariff = String(uRow?.tariff || '').toLowerCase();
        const isOtryv = tariff.includes('otryv') || tariff.includes('отрыв') || uRow?.role === 'admin';
        
        if (!isOtryv) {
          return res.json({ success: false, reason: 'responder_tariff_not_otryv' });
        }

        const responderConfigs = getUserAutoRespondersFromPg(responderUserId);
        const specificConfig = responderConfigs.personal[chatId];
        const globalConfig = responderConfigs.global;

        let chosenConfig: { enabled: boolean; prompt: string; mode: 'always' | 'offline' | 'online' } | null = null;
        if (specificConfig && specificConfig.enabled) {
          chosenConfig = specificConfig;
        } else if (globalConfig && globalConfig.enabled) {
          chosenConfig = globalConfig;
        }

        if (!chosenConfig) {
          // Auto-responder is disabled for this responder!
          return res.json({ success: false, reason: 'auto_responder_disabled' });
        }

        // Check online / offline trigger mode
        const { isOnline } = getUserLastSeenFromPg(responderUserId);
        if (chosenConfig.mode === 'offline' && isOnline) {
          return res.json({ success: false, reason: 'responder_is_online_skipped' });
        }
        if (chosenConfig.mode === 'online' && !isOnline) {
          return res.json({ success: false, reason: 'responder_is_offline_skipped' });
        }

        customPrompt = chosenConfig.prompt;
      } catch (e) {
        return res.json({ success: false, reason: 'lookup_error' });
      }
    }

    // Read credentials from DB settings
    const settings = DB.getSettings();
    const botId = settings.protalkBotId || '66275';
    const botToken = settings.protalkBotToken || 'GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE';

    const autoRespPrompt = await getRequiredScenarioPrompt('social_autoresponder', 'default');
    const renderedAutoRespUser = renderPromptTemplate(autoRespPrompt.user_prompt_template, {
      responder_name: responderName || 'соавтор',
      sender,
      custom_prompt: customPrompt ? customPrompt.trim() : '',
      message_text: textToProcess
    });
    const compiledPrompt = combineSystemAndUserPrompt(autoRespPrompt.system_prompt, renderedAutoRespUser);

    let replyText = '';
    try {
      replyText = await callProTalkBotApi(compiledPrompt, botId, botToken);
    } catch (err: any) {
      console.warn('[Autoresponder Chat Reply Warning]:', err?.message);
      if (customPrompt && customPrompt.trim()) {
        replyText = customPrompt.trim();
      } else {
        replyText = `Привет, ${sender}! Спасибо за сообщение, сейчас занят, отвечу при первой возможности.`;
      }
    }

    res.json({ success: true, text: replyText });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ProTalk Voice Audio Upload & STT Speech Recognition Endpoint
apiRouter.post('/protalk-stt', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  try {
    let audioBuffer: Buffer | null = null;
    let fileName = 'voice_message.webm';
    let mimeType = 'audio/webm';

    if (req.file) {
      audioBuffer = req.file.buffer;
      fileName = req.file.originalname || fileName;
      mimeType = req.file.mimetype || mimeType;
    } else if (req.body && req.body.audioBase64) {
      audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
      if (req.body.fileName) fileName = req.body.fileName;
      if (req.body.mimeType) mimeType = req.body.mimeType;
    }

    if (!audioBuffer) {
      return res.status(400).json({ success: false, error: 'Файл аудио не передан' });
    }

    let uploadedFileUrl = '';
    let localSavedUrl = '';

    // Step 1: Upload directly to https://file.pro-talk.ru/tgf with X-Upload-Token & X-Preserve-Alpha: true
    try {
      const blob = new Blob([audioBuffer], { type: mimeType });
      const webFormData = new globalThis.FormData();
      webFormData.append('file', blob, fileName);

      const uploadRes = await fetch('https://file.pro-talk.ru/tgf', {
        method: 'POST',
        headers: {
          'X-Upload-Token': getGalleryUploadTokenFromPg(DEFAULT_TOKEN),
          'X-Preserve-Alpha': 'true'
        },
        body: webFormData as any,
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        const remoteTgfUrl = uploadData?.url || uploadData?.data?.url;
        if (remoteTgfUrl) {
          uploadedFileUrl = String(remoteTgfUrl).trim();
        }
      } else {
        const errBody = await uploadRes.text().catch(() => '');
        console.warn(`[ProTalk tgf voice warning] HTTP ${uploadRes.status}:`, errBody);
      }
    } catch (uErr) {
      console.warn('[ProTalk tgf voice fetch error]:', uErr);
    }

    // Register canonical ProTalk TGF URL in gallery database (no local disk /uploads fallback)
    if (uploadedFileUrl) {
      try {
        const db = await getPgDB();
        const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        registerFileInStorage(db, {
          userId: 'admin',
          name: `voice_${Date.now()}.webm`,
          originalUrl: normalizeProTalkMediaUrl(uploadedFileUrl),
          mimeType: 'audio/webm',
          fileSize: audioBuffer.length,
          hostProtocol: { host, protocol }
        });
        savePgDB();
      } catch (dbErr) {
        console.warn('ProTalk STT gallery register warning:', dbErr);
      }
    }

    // Step 2: Transcribe audio using ProTalk STT endpoint if remote URL available
    let transcribedText = '';
    if (uploadedFileUrl && uploadedFileUrl.startsWith('http')) {
      try {
        const encodedUrl = encodeURIComponent(uploadedFileUrl);
        const sttUrl = `https://api.pro-talk.ru/api/v1.0/stt_from_widget?url=${encodedUrl}`;
        console.log('[ProTalk STT Requesting]:', sttUrl);
        const sttRes = await fetch(sttUrl);
        if (sttRes.ok) {
          const sttData = await sttRes.json();
          console.log('[ProTalk STT Response]:', sttData);
          transcribedText = sttData.text || (sttData.data && sttData.data.text) || (typeof sttData === 'string' ? sttData : '');
        } else {
          console.warn('[ProTalk STT status warning]:', sttRes.status);
        }
      } catch (sttErr) {
        console.warn('[ProTalk STT fetch error]:', sttErr);
      }
    }

    res.json({
      success: true,
      url: uploadedFileUrl,
      text: transcribedText
    });
  } catch (err: any) {
    console.error('ProTalk STT route error:', err);
    res.status(500).json({ success: false, error: err.message || 'Ошибка обработки голосового сообщения' });
  }
});

// Posts / DayRequests direct API endpoint aliases
apiRouter.get('/posts', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  res.json(DB.getDayRequests(userId));
});

apiRouter.post('/posts', (req: Request, res: Response) => {
  const body = req.body || {};
  const userId = body.userId || (req.headers['x-user-id'] as string) || '';
  const newReq = DB.addDayRequest({
    title: body.title || 'Новый пост',
    category: body.category || 'общее',
    userId,
    requestTemplate: body.requestTemplate || '',
    postText: body.postText !== undefined ? body.postText : '',
    channel: body.channel || (Array.isArray(body.channels) && body.channels[0]) || '',
    channels: Array.isArray(body.channels) ? body.channels : body.channel ? [body.channel] : [],
    signature: body.signature !== undefined ? body.signature : '',
    messageFormat: body.messageFormat || 'markdown',
    uppercaseHeader: body.uppercaseHeader !== false,
    attachmentType: body.attachmentType || 'none',
    attachmentUrl: body.attachmentUrl || '',
    attachmentUrls: body.attachmentUrls || [],
    inlineButtons: body.inlineButtons || [],
    uniquenessMemoryCount: body.uniquenessMemoryCount || 0,
    triggerSchedule: body.triggerSchedule || { enabled: false }
  });
  res.status(201).json(newReq);
});

// Helpers for file processing & tagging
function generate11CharShortKey(): string {
  return crypto.randomBytes(8).toString('base64url').slice(0, 11).replace(/[^a-zA-Z0-9]/g, 'x');
}

function detectFileType(fileNameOrUrl: string, mimeType?: string): 'photo' | 'video' | 'audio' | 'document' | 'video_note' {
  const lower = (fileNameOrUrl || '').toLowerCase();
  if (lower.includes('video_note') || lower.includes('circle')) return 'video_note';
  const extMatch = lower.match(/\.([a-z0-9]+)(\?.*)?$/);
  const ext = extMatch ? extMatch[1] : '';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext) || mimeType?.startsWith('image/')) {
    return 'photo';
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp'].includes(ext) || mimeType?.startsWith('video/')) {
    return 'video';
  }
  if (['mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac', 'opus'].includes(ext) || mimeType?.startsWith('audio/')) {
    return 'audio';
  }
  return 'document';
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Tariffs List API
apiRouter.get(['/tariffs', '/admin/tariffs'], async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const reqUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
    const cleanUserId = reqUserId ? normalizeUserId(reqUserId) : '';
    const isAdmin = req.path.includes('/admin/') || req.query.admin === 'true';

    const rows = isAdmin ? getAllTariffsAdminFromDb(db) : getAllTariffsFromDb(db, cleanUserId || undefined);
    if (rows && rows.length > 0) {
      const parsed = rows.map(r => ({
        ...r,
        is_custom: Number(r.is_custom || 0),
        is_active: Number(r.is_active ?? 1),
        duration_days: Number(r.duration_days || 30),
        features: typeof r.features === 'string' ? JSON.parse(r.features || '[]') : r.features
      }));

      // Filter: if user is not admin, show standard tariffs + custom tariffs assigned to this user
      const filtered = isAdmin 
        ? parsed 
        : parsed.filter(t => !t.is_custom || !t.target_user_id || t.target_user_id === cleanUserId);

      return res.json({ 
        success: true, 
        tariffs: filtered
      });
    }
  } catch (e) {
    console.error('[API /tariffs] Error reading tariffs from DB:', e);
  }
  res.json({
    success: true,
    tariffs: [
      { id: 'start', name: 'Старт', price_iirky: '0 ИИрок', price_rub: 0, sub: 'Старт без вложений', monthly_iirky: 300, features: [], is_custom: 0, duration_days: 30, duration_text: '30 дней' },
      { id: 'razgon', name: 'Разгон', price_iirky: '990 ИИрок / мес', price_rub: 990, sub: 'Хватит на несколько каналов', monthly_iirky: 990, features: [], is_custom: 0, duration_days: 30, duration_text: '30 дней' },
      { id: 'otryv', name: 'Отрыв', price_iirky: '4,900 ИИрок / мес', price_rub: 4900, sub: 'Хватит на десяток каналов', monthly_iirky: 4900, features: [], is_custom: 0, duration_days: 30, duration_text: '30 дней' },
      { id: 'cosmos', name: 'Космос', price_iirky: 'Индивидуально', price_rub: 15000, sub: 'Индивидуальная разработка', monthly_iirky: 15000, features: [], is_custom: 0, duration_days: 30, duration_text: 'Индивидуально' }
    ]
  });
});

// Create or update tariff (standard or custom)
apiRouter.post(['/tariffs', '/admin/tariffs'], async (req: Request, res: Response) => {
  try {
    const { id, name, price_iirky, price_rub, sub, continuation, monthly_iirky, features, is_active, sort_order, duration_days, duration_text, discount_3m, discount_6m, discount_12m, target_user_id, is_custom } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Название тарифа обязательно' });
    }

    const db = await getPgDB();
    const tariffId = id || `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const saved = createOrUpdateTariffInDb(db, {
      id: tariffId,
      name: String(name),
      price_iirky: price_iirky !== undefined ? String(price_iirky) : `${monthly_iirky || 0} ИИрок`,
      price_rub: Number(price_rub || 0),
      sub: sub ? String(sub) : 'Индивидуальный тариф',
      continuation: continuation !== undefined ? String(continuation) : undefined,
      monthly_iirky: Number(monthly_iirky || 0),
      features: features || [],
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1,
      sort_order: sort_order !== undefined ? Number(sort_order) : undefined,
      duration_days: Number(duration_days || 30),
      duration_text: duration_text ? String(duration_text) : `${duration_days || 30} дней`,
      discount_3m: discount_3m !== undefined ? Number(discount_3m) : undefined,
      discount_6m: discount_6m !== undefined ? Number(discount_6m) : undefined,
      discount_12m: discount_12m !== undefined ? Number(discount_12m) : undefined,
      target_user_id: target_user_id ? normalizeUserId(String(target_user_id)) : null,
      is_custom: is_custom !== undefined ? (is_custom ? 1 : 0) : 1
    });

    // If target_user_id is provided, automatically assign tariff to that user
    if (target_user_id) {
      const cleanTargetId = normalizeUserId(String(target_user_id));
      const targetUser = findUserInDb(db, cleanTargetId);
      if (targetUser) {
        const duration = Number(duration_days || 30);
        const assignedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();

        db.run(
          `UPDATE users SET tariff = ?, tariff_assigned_at = ?, tariff_expires_at = ?, tariff_duration_days = ? WHERE id = ? OR telegram_id = ?`,
          [name, assignedAt, expiresAt, duration, targetUser.id, targetUser.telegram_id]
        );

        // If tariff gives monthly iirky, add transaction and update balance_tarif + balance_free
        if (Number(monthly_iirky || 0) > 0) {
          addTransactionWithBalanceUpdate(db, {
            userId: targetUser.id,
            type: 'tarif',
            balanceType: 'tarif',
            amount: Number(monthly_iirky),
            description: `Начисление по индивидуальному тарифу "${name}" (${duration} дней)`,
            createdAt: assignedAt
          });
        }
      }
    }

    savePgDB();
    res.json({ success: true, tariff: saved });
  } catch (err: any) {
    console.error('[API /tariffs POST] Error saving tariff:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete custom tariff
apiRouter.delete(['/tariffs/:id', '/admin/tariffs/:id'], async (req: Request, res: Response) => {
  try {
    const tariffId = req.params.id;
    const db = await getPgDB();
    const deleted = deleteTariffFromDb(db, tariffId);
    if (deleted) {
      savePgDB();
      res.json({ success: true, message: 'Тариф успешно удален' });
    } else {
      res.status(404).json({ success: false, error: 'Тариф не найден' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// (Removed legacy duplicate /tariffs/change handler; the unified handler below handles validation, discounts, balance deduction with balance_cost, and dates)

// Cosmos Tariff Contact Request endpoint
apiRouter.post('/tariffs/cosmos-request', async (req: Request, res: Response) => {
  try {
    const { userId, name, telegram, email, phone, message } = req.body;
    const db = await getPgDB();
    const cleanUserId = userId ? normalizeUserId(String(userId)) : '16926299042';

    const title = `🚀 Новая заявка на тариф «Космос»`;
    const details = `Имя: ${name || 'Пользователь'}\nTelegram: ${telegram || 'не указан'}\nE-mail: ${email || 'не указан'}\nТелефон: ${phone || 'не указан'}\nЗапрос: ${message || 'Индивидуальная разработка'}`;

    // Insert admin notification for ID 16926299042 / 169262990
    try {
      db.run(
        `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
         VALUES (?, ?, ?, 'admin', 0, ?)`,
        ['16926299042', title, details, new Date().toISOString()]
      );
      savePgDB();
    } catch (e) {
      console.warn('Error adding cosmos notification to DB:', e);
    }

    // Send Telegram message to admin telegram_id 169262990 using bot token from DB
    const botToken = getBotTokenFromPg() || DB.getSettings().telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '8142466188:AAHmgvq2mvwvKl4v1IOsSkFxE3FxPmfXn_o';
    if (botToken) {
      try {
        const tgConfig = await getTelegramBotConfig().catch(() => null);
        const tgText = `🚀 <b>Новая заявка на тариф «Космос»</b>\n\n👤 <b>Имя:</b> ${name || 'Пользователь'}\n📱 <b>Telegram:</b> ${telegram || 'не указан'}\n📧 <b>E-mail:</b> ${email || 'не указан'}\n📞 <b>Телефон:</b> ${phone || 'не указан'}\n🆔 <b>User ID:</b> <code>${cleanUserId}</code>\n💬 <b>Запрос:</b> ${message || 'Индивидуальная разработка под ключ'}`;
        await fetchTelegramBotApi({
          primaryBase: tgConfig?.apiBaseUrl,
          proxyType: tgConfig?.proxyType,
          token: botToken,
          endpoint: 'sendMessage',
          buildInit: () => ({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: 169262990,
              text: tgText,
              parse_mode: 'HTML'
            })
          })
        });
      } catch (tgErr) {
        console.error('[Cosmos TG Notification Error]:', tgErr);
      }
    }

    console.log(`[Cosmos Request Received for TG ID 169262990]:\n${details}`);

    res.json({
      success: true,
      message: 'Заявка на индивидуальный тариф «Космос» успешно принята! Наш специалист свяжется с вами в Telegram.'
    });
  } catch (err: any) {
    console.error('[API /tariffs/cosmos-request] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Ошибка отправки заявки' });
  }
});

// Assign tariff to user with custom duration
apiRouter.post('/admin/users/assign-tariff', async (req: Request, res: Response) => {
  try {
    const { userId, tariffName, durationDays, addMonthlyIirky } = req.body;
    if (!userId || !tariffName) {
      return res.status(400).json({ success: false, error: 'userId и tariffName обязательны' });
    }

    const db = await getPgDB();
    const cleanUserId = normalizeUserId(String(userId));
    const targetUser = findUserInDb(db, cleanUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    const duration = Number(durationDays || 30);
    const assignedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();

    db.run(
      `UPDATE users SET tariff = ?, tariff_assigned_at = ?, tariff_expires_at = ?, tariff_duration_days = ? WHERE id = ? OR telegram_id = ?`,
      [tariffName, assignedAt, expiresAt, duration, targetUser.id, targetUser.telegram_id]
    );

    // If addMonthlyIirky requested, find tariff info or credit specified amount
    let iirkyAmount = Number(addMonthlyIirky || 0);
    if (iirkyAmount === 0) {
      const allTariffs = getAllTariffsFromDb(db);
      const matched = allTariffs.find(t => t.name.toLowerCase() === tariffName.toLowerCase() || t.id.toLowerCase() === tariffName.toLowerCase());
      if (matched && matched.monthly_iirky > 0) {
        iirkyAmount = matched.monthly_iirky;
      }
    }

    if (iirkyAmount > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId: targetUser.id,
        type: 'tarif',
        balanceType: 'tarif',
        amount: iirkyAmount,
        description: `Начисление по тарифу "${tariffName}" на срок ${duration} дн.`,
        createdAt: assignedAt
      });
    }

    savePgDB();
    const updatedUser = getUserByIdFromDb(db, targetUser.id);
    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger referral check and backfill
apiRouter.post('/admin/sync-referrals', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const addedCount = checkAndSyncReferralTransactions(db);
    savePgDB();
    res.json({ success: true, addedCount, message: `Синхронизировано ${addedCount} реферальных начислений` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// PROTALK FILE STORAGE & FOLDERS API
// ==========================================

function cleanupOrphanFileFolderRelations(db: any): void {
  try {
    const fsRes = db.exec('SELECT id FROM file_storage');
    const relRes = db.exec('SELECT DISTINCT file_id FROM file_folder_relations');
    const validIds = new Set<number>((fsRes[0]?.values || []).map((v: any[]) => Number(v[0])));
    const orphanIds = (relRes[0]?.values || [])
      .map((v: any[]) => Number(v[0]))
      .filter((fid: number) => Number.isFinite(fid) && !validIds.has(fid));
    for (const orphanId of orphanIds) {
      db.run('DELETE FROM file_folder_relations WHERE file_id = ?', [orphanId]);
    }
  } catch {}
}

// 1. Folders API (Ensures 4 default folders exist for user trigger)
apiRouter.get(['/file-folders', '/admin/file-folders'], async (req: Request, res: Response) => {
  try {
    const isAdminRoute = req.path.includes('/admin/');
    const reqUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
    const userId = isAdminRoute ? (reqUserId || 'admin') : (reqUserId || 'admin');

    const db = await getPgDB();

    // Clean up any orphan relations before counting
    cleanupOrphanFileFolderRelations(db);

    const folders = ensureDefaultFoldersForUser(db, userId);

    const enriched = folders.map((f: any) => {
      let count = 0;
      try {
        const stmt = db.prepare(`
          SELECT COUNT(DISTINCT ffr.file_id) as cnt 
          FROM file_folder_relations ffr
          JOIN file_storage fs ON ffr.file_id = fs.id
          WHERE ffr.folder_id = ?
        `);
        stmt.bind([f.id]);
        if (stmt.step()) count = Number(stmt.getAsObject().cnt || 0);
        stmt.free();
      } catch (e) {}
      return { ...f, fileCount: count };
    });

    res.json({ success: true, folders: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post(['/file-folders', '/admin/file-folders'], async (req: Request, res: Response) => {
  try {
    const { name, color, userId: bodyUserId } = req.body;
    const userId = bodyUserId || (req.headers['x-user-id'] as string) || 'admin';
    if (!name) return res.status(400).json({ error: 'Название папки обязательно' });

    const db = await getPgDB();
    db.run("INSERT INTO file_folders (user_id, name, color, folder_type) VALUES (?, ?, ?, ?)", [
      userId, name.trim(), color || '#ec4899', 'custom'
    ]);
    savePgDB();

    const folders = getFoldersForUser(db, userId);
    const created = folders.find((f: any) => f.name === name.trim());
    res.json({ success: true, folder: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete(['/file-folders/:id', '/admin/file-folders/:id'], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getPgDB();
    db.run("DELETE FROM file_folders WHERE id = ?", [id]);
    db.run("DELETE FROM file_folder_relations WHERE folder_id = ?", [id]);
    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Files CRUD API
apiRouter.get(['/files', '/admin/files'], async (req: Request, res: Response) => {
  try {
    const isAdminRoute = req.path.includes('/admin/') || req.query.admin === 'true';
    const reqUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
    const userId = isAdminRoute ? (reqUserId || 'admin') : (reqUserId || 'admin');
    const folderId = req.query.folderId ? Number(req.query.folderId) : undefined;
    const search = req.query.search as string;

    const db = await getPgDB();
    const storageFiles = getStorageFilesForUser(db, userId, { folderId, search });

    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';

    const formatted = storageFiles.map((f: any) => {
      const origUrl = String(f.original_url || f.url || '').replace(
        /^https?:\/\/filestore\.pro-talk\.ru\//i,
        'https://file.pro-talk.ru/tgf/'
      );
      const fullOrigUrl = origUrl.startsWith('/') ? `${protocol}://${host}${origUrl}` : origUrl;
      return {
        id: String(f.id),
        fileKey: f.file_key,
        userId: f.user_id,
        folderId: f.folder_id || (f.folderIds && f.folderIds[0]) || null,
        folder_id: f.folder_id || (f.folderIds && f.folderIds[0]) || null,
        name: f.name,
        slugName: f.slug_name,
        originalName: f.name,
        originalUrl: fullOrigUrl,
        fullUrl: fullOrigUrl,
        url: fullOrigUrl,
        proxyUrl: fullOrigUrl,
        shortKey: f.file_key,
        shortUrl: fullOrigUrl,
        mimeType: f.mime_type,
        fileType: f.file_type,
        fileSize: f.file_size,
        sizeFormatted: formatFileSize(f.file_size),
        width: f.width,
        height: f.height,
        folderIds: f.folderIds || [],
        createdAt: f.created_at
      };
    });

    res.json({ success: true, files: formatted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post(['/files/register', '/admin/files/register'], async (req: Request, res: Response) => {
  try {
    const { name, original_url, fullUrl, mime_type, file_size, folder_ids, folder_id, userId, width, height } = req.body;
    const targetUrl = original_url || fullUrl;
    if (!targetUrl) return res.status(400).json({ error: 'Не указан URL файла' });

    const normUserId = userId || (req.headers['x-user-id'] as string) || 'admin';
    const db = await getPgDB();

    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';

    const folderIdsArr = Array.isArray(folder_ids) ? folder_ids : (folder_id ? [folder_id] : []);

    const created = registerFileInStorage(db, {
      userId: normUserId,
      name: name || targetUrl.split('/').pop()?.split('?')[0] || 'file.bin',
      originalUrl: targetUrl,
      mimeType: mime_type || 'image/png',
      fileSize: file_size || 0,
      width: width || 0,
      height: height || 0,
      folderIds: folderIdsArr,
      hostProtocol: { host, protocol }
    });

    savePgDB();
    res.json({ success: true, file: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch move files to folder(s)
apiRouter.post(['/files/batch-move', '/admin/files/batch-move'], async (req: Request, res: Response) => {
  try {
    const { file_ids, folder_ids, mode = 'add' } = req.body;
    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({ error: 'Не выбраны файлы' });
    }
    const folderIds = Array.isArray(folder_ids) ? folder_ids.map(Number) : [];

    const db = await getPgDB();

    for (const fId of file_ids) {
      const numericId = Number(fId);
      if (isNaN(numericId)) continue;

      if (mode === 'set') {
        db.run("DELETE FROM file_folder_relations WHERE file_id = ?", [numericId]);
      }

      for (const folderId of folderIds) {
        try {
          db.run("INSERT OR IGNORE INTO file_folder_relations (file_id, folder_id) VALUES (?, ?)", [numericId, folderId]);
        } catch (e) {}
      }

      if (folderIds.length > 0) {
        db.run("UPDATE file_storage SET folder_id = ? WHERE id = ?", [folderIds[0], numericId]);
      }
    }

    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch delete files
apiRouter.post(['/files/batch-delete', '/admin/files/batch-delete'], async (req: Request, res: Response) => {
  try {
    const { file_ids } = req.body;
    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({ error: 'Не выбраны файлы для удаления' });
    }

    const db = await getPgDB();

    for (const fId of file_ids) {
      const numericId = Number(fId);
      if (!isNaN(numericId)) {
        db.run("DELETE FROM file_storage WHERE id = ?", [numericId]);
        db.run("DELETE FROM file_folder_relations WHERE file_id = ?", [numericId]);
      } else {
        const key = String(fId);
        // Find numeric id first if any
        try {
          const stmt = db.prepare("SELECT id FROM file_storage WHERE file_key = ?");
          stmt.bind([key]);
          while (stmt.step()) {
            const foundId = stmt.getAsObject().id;
            if (foundId) {
              db.run("DELETE FROM file_folder_relations WHERE file_id = ?", [foundId]);
            }
          }
          stmt.free();
        } catch (e) {}

        db.run("DELETE FROM file_storage WHERE file_key = ?", [key]);
        DB.deleteFile(key);
      }
    }

    // Cleanup any orphaned relations
    cleanupOrphanFileFolderRelations(db);

    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete(['/files/:id', '/admin/files/:id'], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getPgDB();

    const numericId = Number(id);
    if (!isNaN(numericId)) {
      db.run("DELETE FROM file_storage WHERE id = ?", [numericId]);
      db.run("DELETE FROM file_folder_relations WHERE file_id = ?", [numericId]);
    } else {
      try {
        const stmt = db.prepare("SELECT id FROM file_storage WHERE file_key = ?");
        stmt.bind([id]);
        while (stmt.step()) {
          const foundId = stmt.getAsObject().id;
          if (foundId) {
            db.run("DELETE FROM file_folder_relations WHERE file_id = ?", [foundId]);
          }
        }
        stmt.free();
      } catch (e) {}

      db.run("DELETE FROM file_storage WHERE file_key = ?", [id]);
      DB.deleteFile(id);
    }

    // Cleanup any orphaned relations
    cleanupOrphanFileFolderRelations(db);

    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ProTalk File Upload Proxy endpoint (with PNG X-Preserve-Alpha and Voice OGG Opus conversion support)
apiRouter.post('/upload', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  try {
    const defaultToken = DEFAULT_TOKEN;
    const uploadToken = getGalleryUploadTokenFromPg(
      (req.headers['x-upload-token'] as string) || req.body?.token || defaultToken
    );
    const userId = (req.headers['x-user-id'] as string) || req.body?.userId || 'admin';
    const folderIds = req.body?.folderIds ? (Array.isArray(req.body.folderIds) ? req.body.folderIds : [req.body.folderIds]) : (req.body?.folderId ? [req.body.folderId] : []);
    const convertVoiceOgg = req.body?.convertVoiceOgg === 'true' || req.body?.convertVoiceOgg === true || req.headers['x-convert-voice-ogg'] === 'true';

    let uploadedUrl = '';
    let uploadedKey = '';
    let originalFilename = 'file.bin';
    let mimeType = '';
    let fileSize = 0;
    let width = Number(req.body?.width) || 0;
    let height = Number(req.body?.height) || 0;

    if (req.file) {
      originalFilename = fixUtf8Filename(req.file.originalname) || 'file.bin';
      mimeType = req.file.mimetype || '';
      fileSize = req.file.size || req.file.buffer.length || 0;
      let uploadBuffer = req.file.buffer;

      // If user requested voice OGG conversion for audio file
      if (convertVoiceOgg && (mimeType.startsWith('audio/') || originalFilename.match(/\.(mp3|wav|m4a|aac|webm|flac|wma)$/i))) {
        try {
          uploadBuffer = await convertAudioToTelegramVoice(uploadBuffer);
          const baseName = originalFilename.replace(/\.[^/.]+$/, "");
          originalFilename = `${baseName.startsWith('voice_') ? baseName : 'voice_' + baseName}.ogg`;
          mimeType = 'audio/ogg; codecs=opus';
          fileSize = uploadBuffer.length;
        } catch (convErr: any) {
          console.warn('[upload] Audio OGG conversion warning:', convErr.message);
        }
      }

      const targetUploadUrl = "https://file.pro-talk.ru/tgf";

      const formData = new FormData();
      formData.append('file', uploadBuffer, {
        filename: originalFilename,
        contentType: mimeType
      });

      const formHeaders = formData.getHeaders();
      const formBuffer = formData.getBuffer();

      let response: any = null;

      // Upload directly to ProTalk TGF storage with retry (no local disk /uploads fallback)
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          response = await fetch(targetUploadUrl, {
            method: "POST",
            headers: {
              "X-Upload-Token": uploadToken,
              "X-Preserve-Alpha": "true",
              ...formHeaders
            },
            body: formBuffer,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response && response.ok) {
            break;
          }
        } catch (err: any) {
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 700));
          } else {
            console.warn(`[upload] ProTalk TGF unavailable: ${err.message}`);
          }
        }
      }

      if (response && response.ok) {
        try {
          const resText = await response.text();
          let data: any = {};
          try {
            data = JSON.parse(resText);
          } catch (e) {
            const trimmed = resText.trim().replace(/^["']|["']$/g, '');
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
              data = { url: trimmed, key: trimmed.split('/').pop() || '' };
            }
          }
          uploadedUrl = normalizeProTalkMediaUrl(data.url || data.link || (typeof data === 'string' ? data : ''));
          uploadedKey = data.key || data.file_key || (uploadedUrl ? uploadedUrl.split('/').pop() : '');
        } catch (e) {}
      }

      if (!uploadedUrl) {
        return res.status(502).json({ error: 'Сервис хранения файлов ProTalk TGF временно не ответил. Повторите загрузку.' });
      }
    } else if (req.body && req.body.url) {
      const inputUrl = req.body.url;
      originalFilename = req.body.originalName || req.body.name || inputUrl.split('/').pop()?.split('?')[0] || 'file.bin';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const response = await fetch("https://file.pro-talk.ru/tgf", {
          method: "POST",
          headers: {
            "X-Upload-Token": uploadToken,
            "X-Preserve-Alpha": "true",
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({ url: inputUrl }).toString(),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const resText = await response.text();
          let data: any = {};
          try {
            data = JSON.parse(resText);
          } catch (e) {
            const trimmed = resText.trim().replace(/^["']|["']$/g, '');
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
              data = { url: trimmed, key: trimmed.split('/').pop() || '' };
            }
          }
          uploadedUrl = normalizeProTalkMediaUrl(data.url || data.link || (typeof data === 'string' ? data : ''));
          uploadedKey = data.key || data.file_key || (uploadedUrl ? uploadedUrl.split('/').pop() : '');
        }
      } catch (err) {}

      if (!uploadedUrl) {
        uploadedUrl = normalizeProTalkMediaUrl(inputUrl);
        uploadedKey = inputUrl.split('/').pop()?.split('?')[0] || 'file.bin';
      }
    } else {
      return res.status(400).json({ error: 'Не передан файл или URL для загрузки' });
    }

    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';

    if (uploadedUrl && typeof uploadedUrl === 'string') {
      uploadedUrl = normalizeProTalkMediaUrl(uploadedUrl);
    }

    const db = await getPgDB();
    const fileRecord = registerFileInStorage(db, {
      userId,
      name: originalFilename,
      originalUrl: uploadedUrl,
      mimeType,
      fileSize,
      width,
      height,
      folderIds,
      hostProtocol: { host, protocol }
    });

    savePgDB();

    return res.json({
      success: true,
      url: uploadedUrl,
      originalUrl: uploadedUrl,
      fullUrl: uploadedUrl,
      key: uploadedKey,
      fileKey: fileRecord?.file_key,
      shortUrl: uploadedUrl,
      proxyUrl: uploadedUrl,
      file: fileRecord
    });
  } catch (err: any) {
    console.error('ProTalk Upload error:', err);
    res.status(500).json({ error: err.message || 'Ошибка загрузки файла на ProTalk' });
  }
});

// Dedicated Audio-to-OGG (Opus Telegram Voice) Conversion Endpoint
apiRouter.post('/convert-audio-to-ogg', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  try {
    let inputBuffer: Buffer | null = null;
    let originalName = 'voice_message.ogg';
    const defaultToken = DEFAULT_TOKEN;
    const uploadToken = getGalleryUploadTokenFromPg(
      (req.headers['x-upload-token'] as string) || req.body?.token || defaultToken
    );
    const userId = (req.headers['x-user-id'] as string) || req.body?.userId || 'admin';
    const folderIds = req.body?.folderIds ? (Array.isArray(req.body.folderIds) ? req.body.folderIds : [req.body.folderIds]) : (req.body?.folderId ? [req.body.folderId] : []);

    if (req.file) {
      inputBuffer = req.file.buffer;
      originalName = fixUtf8Filename(req.file.originalname) || 'voice_message.ogg';
    } else if (req.body && (req.body.audioUrl || req.body.url)) {
      const targetUrl = req.body.audioUrl || req.body.url;
      originalName = fixUtf8Filename(decodeURIComponent(targetUrl.split('/').pop()?.split('?')[0] || '')) || 'voice_message.ogg';
      const fileRes = await fetch(targetUrl);
      if (!fileRes.ok) {
        throw new Error(`Не удалось скачать аудиофайл по URL: ${targetUrl} (HTTP ${fileRes.status})`);
      }
      const arrayBuf = await fileRes.arrayBuffer();
      inputBuffer = Buffer.from(arrayBuf);
    }

    if (!inputBuffer || inputBuffer.length === 0) {
      res.status(400).json({ error: 'Не передан аудиофайл или URL для конвертации' });
      return;
    }

    // Convert audio to Telegram Voice OGG Opus buffer using ffmpeg
    const oggBuffer = await convertAudioToTelegramVoice(inputBuffer);
    const baseName = originalName.replace(/\.[^/.]+$/, "");
    const oggFilename = `${baseName.startsWith('voice_') ? baseName : 'voice_' + baseName}_${Date.now()}.ogg`;

    // Upload converted .ogg file to ProTalk storage
    const formData = new FormData();
    formData.append('file', oggBuffer, {
      filename: oggFilename,
      contentType: 'audio/ogg; codecs=opus'
    });

    const formHeaders = formData.getHeaders();
    const formBuffer = formData.getBuffer();

    let response = await fetch("https://file.pro-talk.ru/tgf", {
      method: "POST",
      headers: {
        "X-Upload-Token": uploadToken,
        "X-Preserve-Alpha": "true",
        ...formHeaders
      },
      body: formBuffer
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки сконвертированного OGG в хранилище (HTTP ${response.status})`);
    }

    const resText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch (e) {
      const trimmed = resText.trim().replace(/^["']|["']$/g, '');
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        data = { url: trimmed, key: trimmed.split('/').pop() || '' };
      } else {
        throw new Error(`Ответ сервера хранилища: ${resText}`);
      }
    }

    const uploadedUrl = data.url || data.link || (typeof data === 'string' ? data : '');
    const uploadedKey = data.key || data.file_key || (uploadedUrl ? uploadedUrl.split('/').pop() : '');

    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';

    const db = await getPgDB();
    const fileRecord = registerFileInStorage(db, {
      userId,
      name: oggFilename,
      originalUrl: uploadedUrl,
      mimeType: 'audio/ogg; codecs=opus',
      fileSize: oggBuffer.length,
      folderIds,
      hostProtocol: { host, protocol }
    });

    savePgDB();

    res.json({
      success: true,
      url: uploadedUrl,
      originalUrl: uploadedUrl,
      fullUrl: uploadedUrl,
      key: uploadedKey,
      fileKey: fileRecord?.file_key,
      shortUrl: uploadedUrl,
      proxyUrl: uploadedUrl,
      name: oggFilename,
      format: 'ogg',
      file: fileRecord
    });
  } catch (err: any) {
    console.error('Audio conversion error:', err);
    res.status(500).json({ error: err.message || 'Ошибка конвертации аудиофайла в OGG Opus' });
  }
});

// GET AI Agents from PostgreSQL database
apiRouter.get('/ai-agents', async (req: Request, res: Response) => {
  try {
    const tableData = await getTableRows('ai_agents');
    const rows = Array.isArray(tableData) ? tableData : (tableData.rows || []);
    const formatted = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      desc: r.desc,
      tag: r.tag,
      btnText: r.btn_text || 'Запустить',
      avatarEmoji: r.avatar_emoji || '🤖',
      gradient: r.gradient || 'from-blue-500 to-indigo-600',
      welcomeMessage: r.welcome_message || 'Привет! Напишите ваш запрос.',
      systemPrompt: r.system_prompt || '',
      interactiveChat: {
        user: r.interactive_user || '',
        assistant: r.interactive_assistant || ''
      }
    }));
    res.json({ success: true, agents: formatted });
  } catch (err: any) {
    console.error('Error fetching AI agents from PostgreSQL:', err);
    res.status(500).json({ error: err.message || 'Error fetching agents' });
  }
});

// ==========================================
// POSTGRESQL PROTALK (iismm2) IMPORT, EXPORT & BACKUP ENDPOINTS
// ==========================================

// 1. Export entire PostgreSQL DB as structured JSON
apiRouter.get('/admin/db/export/json', async (_req: Request, res: Response) => {
  try {
    const snapshot = await collectFullPostgresSnapshot('Ручная выгрузка JSON');
    const out = buildJsonBackupBuffer(snapshot, false);
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Backup-Sha256');
    res.setHeader('Cache-Control', 'no-store');
    res.send(out.buffer);
  } catch (err: any) {
    console.error('DB Export JSON error:', err);
    res.status(500).json({ error: err.message || 'Failed to export PostgreSQL DB as JSON' });
  }
});

// 2. Export PostgreSQL SQL dump (/admin/db/export/postgres)
apiRouter.get('/admin/db/export/postgres', async (_req: Request, res: Response) => {
  try {
    const snapshot = await collectFullPostgresSnapshot('Ручная выгрузка SQL дампа PostgreSQL');
    const out = buildPostgresSqlDumpBuffer(snapshot, false);
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Backup-Sha256');
    res.setHeader('Cache-Control', 'no-store');
    res.send(out.buffer);
  } catch (err: any) {
    console.error('DB Export SQL error:', err);
    res.status(500).json({ error: err.message || 'Failed to export PostgreSQL SQL dump' });
  }
});

// 3. Import DB from JSON payload (supports full payload or stepwise table chunks + finalize) into PostgreSQL iismm2
apiRouter.post('/admin/db/import/json', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const skipSave = Boolean(body.skipSave);
    const finalize = Boolean(body.finalize);

    const rawTablesObj =
      body.tables && typeof body.tables === 'object' && !Array.isArray(body.tables)
        ? body.tables
        : (!finalize ? body : null);

    let importedTables = 0;
    let importedRows = 0;
    let perTable: Record<string, number> = {};

    if (rawTablesObj && typeof rawTablesObj === 'object') {
      const reservedKeys = new Set(['meta', 'version', 'exportedAt', 'skipSave', 'finalize', 'tables', 'mode']);
      const cleanTables: Record<string, any[]> = {};
      for (const [rawTable, rows] of Object.entries(rawTablesObj)) {
        if (reservedKeys.has(rawTable)) continue;
        if (Array.isArray(rows) && rows.length > 0) {
          cleanTables[rawTable] = rows;
        }
      }

      if (Object.keys(cleanTables).length > 0) {
        const buf = Buffer.from(JSON.stringify({ tables: cleanTables }), 'utf-8');
        const summary = await restorePostgresFromBackupPayload({
          buffer: buf,
          filename: 'import.json',
          mode: body.mode === 'replace' ? 'replace' : 'merge',
          skipCacheRefresh: skipSave && !finalize
        });
        importedTables = summary.tablesRestored;
        importedRows = summary.rowsRestored;
        perTable = summary.perTable;
      }
    } else if (!finalize) {
      return res.status(400).json({ error: 'Некорректная структура json файла. Ожидается объект tables.' });
    }

    if (finalize || !skipSave) {
      try {
        const { refreshAllTablesCacheFromCloud } = await import('./pg/cache/pgMemAdapter');
        await refreshAllTablesCacheFromCloud();
        const db = await getPgDB();
        const { initCronTable } = await import('./db/cronTable');
        initCronTable(db);
        savePgDB();
      } catch (e) {}
    }

    res.json({
      success: true,
      importedTables,
      importedRows,
      perTable,
      finalized: finalize || !skipSave,
      message: 'Данные базы PostgreSQL ProTalk (iismm2) успешно восстановлены и зафиксированы на сервере'
    });
  } catch (err: any) {
    console.error('DB Import JSON error:', err);
    res.status(500).json({ error: err.message || 'Ошибка восстановления в PostgreSQL из json' });
  }
});

// 3.1. Import rows into a specific PostgreSQL table from CSV parsed rows
apiRouter.post('/admin/db/import/csv', async (req: Request, res: Response) => {
  try {
    const { table, rows } = req.body || {};
    if (!table || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Необходимо указать таблицу (table) и массив строк (rows)' });
    }

    const safeTable = String(table).replace(/[^a-zA-Z0-9_]/g, '');
    const result = await importCSVRows(safeTable, rows);
    savePgDB();
    res.json({
      success: true,
      importedCount: result.importedCount,
      message: `Успешно импортировано ${result.importedCount} строк в таблицу PostgreSQL «${safeTable}»`
    });
  } catch (err: any) {
    console.error('DB Import CSV error:', err);
    res.status(500).json({ error: err.message || 'Ошибка импорта CSV в PostgreSQL' });
  }
});

// 3.2. Export a PostgreSQL table directly as CSV
apiRouter.get('/admin/db/export/csv/:table', async (req: Request, res: Response) => {
  try {
    const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
    const snapshot = await collectSingleTableSnapshot(table, `CSV экспорт таблицы ${table}`);
    if (!(table in snapshot.tables)) {
      return res.status(404).json({ error: `Таблица «${table}» не найдена в PostgreSQL iismm2` });
    }
    const out = buildCsvBackupBuffer(snapshot, table);
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Backup-Sha256');
    res.setHeader('Cache-Control', 'no-store');
    res.send(out.buffer);
  } catch (err: any) {
    console.error('DB Export CSV error:', err);
    res.status(500).json({ error: err.message || 'Ошибка экспорта CSV' });
  }
});

// 4. List DB backups on disk
apiRouter.get('/admin/db/backups', (_req: Request, res: Response) => {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const files = fs.readdirSync(backupsDir);
    const backups = files.map(file => {
      const filePath = path.join(backupsDir, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        size: stats.size,
        createdAt: stats.birthtime || stats.mtime
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error listing backups' });
  }
});

// 5. Create immediate PostgreSQL snapshot backup (.sql.gz on disk + ProTalk cloud snapshot)
apiRouter.post('/admin/db/backups/create', async (_req: Request, res: Response) => {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const snapshot = await collectFullPostgresSnapshot('Серверный снимок PostgreSQL');
    const sqlGz = buildPostgresSqlDumpBuffer(snapshot, true);
    const backupPath = path.join(backupsDir, sqlGz.filename);
    fs.writeFileSync(backupPath, sqlGz.buffer);

    await createProTalkSnapshot(`Снимок ИИSMM ${snapshot.meta.version} (${sqlGz.filename})`).catch(() => null);

    res.json({
      success: true,
      filename: sqlGz.filename,
      size: sqlGz.buffer.length,
      sha256: sqlGz.sha256,
      message: `Резервный снимок PostgreSQL (${sqlGz.filename}) успешно создан`
    });
  } catch (err: any) {
    console.error('Create Backup error:', err);
    res.status(500).json({ error: err.message || 'Failed to create PostgreSQL snapshot backup' });
  }
});

// 6. Restore PostgreSQL DB from selected server backup file (.sql, .sql.gz, .json, .json.gz, .ndjson, .csv)
apiRouter.post('/admin/db/backups/restore', async (req: Request, res: Response) => {
  try {
    const { filename, mode } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'Filename is required' });

    const backupPath = path.join(process.cwd(), 'backups', path.basename(filename));
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    const buffer = fs.readFileSync(backupPath);
    const summary = await restorePostgresFromBackupPayload({
      buffer,
      filename: path.basename(filename),
      mode: mode === 'replace' ? 'replace' : 'merge'
    });

    res.json({
      success: true,
      ...summary,
      message: `База PostgreSQL ProTalk (iismm2) успешно восстановлена из ${filename}`
    });
  } catch (err: any) {
    console.error('Restore Backup error:', err);
    res.status(500).json({ error: err.message || 'Failed to restore PostgreSQL backup' });
  }
});

// Billing & Transactions PostgreSQL Endpoints
apiRouter.get('/billing/transactions', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.query.userId ? String(req.query.userId) : '16926299042';
    const userId = normalizeUserId(rawUserId);
    const db = await getPgDB();

    const list = getUserTransactionsFromDb(db, userId, 100);
    res.json({ success: true, transactions: list });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка загрузки истории транзакций: ' + err.message });
  }
});

apiRouter.post('/billing/transactions', async (req: Request, res: Response) => {
  try {
    const { userId, amount, type, description, comment, balanceType } = req.body;
    const cleanUserId = normalizeUserId(userId || '16926299042');
    const db = await getPgDB();

    const numAmount = Number(amount) || 0;
    const txType = (type || 'cost') as any;

    const result = addTransactionWithBalanceUpdate(db, {
      userId: cleanUserId,
      type: txType,
      balanceType: balanceType,
      amount: numAmount,
      description: description || 'Транзакция',
      comment: comment || ''
    });

    savePgDB();
    res.json({ success: true, transaction: result.transaction, newBalances: result.newBalances });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка сохранения транзакции: ' + err.message });
  }
});

// Admin Balance Adjust Calculator Endpoint
apiRouter.post('/admin/user-balance-adjust', async (req: Request, res: Response) => {
  try {
    const { userId, amount, balanceType, comment, description } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'Не указан пользователь' });
      return;
    }
    const cleanUserId = normalizeUserId(userId);
    const numAmount = parseInt(String(amount), 10);
    if (isNaN(numAmount) || numAmount === 0) {
      res.status(400).json({ error: 'Укажите корректную сумму изменения (не равную 0)' });
      return;
    }
    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      res.status(400).json({ error: 'Обязательно укажите причину (комментарий) изменения баланса' });
      return;
    }

    const db = await getPgDB();
    const result = addTransactionWithBalanceUpdate(db, {
      userId: cleanUserId,
      type: 'admin',
      balanceType: balanceType || 'admin',
      amount: numAmount,
      description: description || `Корректировка администратором: ${numAmount > 0 ? '+' : ''}${numAmount} ИИрок`,
      comment: comment.trim()
    });

    savePgDB();
    res.json({ 
      success: true, 
      transaction: result.transaction, 
      newBalances: result.newBalances,
      message: `Баланс пользователя ${cleanUserId} успешно скорректирован на ${numAmount > 0 ? '+' : ''}${numAmount} ИИрок.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка корректировки баланса: ' + err.message });
  }
});

// User Notifications Endpoints
apiRouter.get('/notifications', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.query.userId ? String(req.query.userId) : '16926299042';
    const userId = normalizeUserId(rawUserId);
    const db = await getPgDB();

    const list = getUserNotificationsFromDb(db, userId, 50);
    const unreadCount = list.filter(n => !n.is_read).length;

    res.json({ success: true, notifications: list, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения уведомлений: ' + err.message });
  }
});

apiRouter.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rawUserId = req.body.userId ? String(req.body.userId) : '16926299042';
    const userId = normalizeUserId(rawUserId);
    const db = await getPgDB();

    markNotificationAsReadInDb(db, id, userId);
    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка отметки уведомления: ' + err.message });
  }
});

apiRouter.post('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.body.userId ? String(req.body.userId) : '16926299042';
    const userId = normalizeUserId(rawUserId);
    const db = await getPgDB();

    markAllNotificationsAsReadInDb(db, userId);
    savePgDB();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка отметки всех уведомлений: ' + err.message });
  }
});

apiRouter.post('/billing/exchange', async (req: Request, res: Response) => {
  try {
    const { userId, amountRub } = req.body;
    const cleanUserId = normalizeUserId(userId || '16926299042');
    const db = await getPgDB();

    const costRub = parseFloat(amountRub) || 0;
    if (costRub <= 0) {
      res.status(400).json({ error: 'Укажите корректную сумму в рублях' });
      return;
    }

    const pricing = await getPricingConfig(db);
    const iirkyToAdd = computeTopupIirkyAmount(costRub, pricing);
    const result = addTransactionWithBalanceUpdate(db, {
      userId: cleanUserId,
      type: 'pay',
      balanceType: 'pay',
      amount: iirkyToAdd,
      description: `Обмен из рублевого баланса: +${iirkyToAdd} 🪙`
    });

    savePgDB();
    res.json({ success: true, addedIirky: iirkyToAdd, transactionId: result.transaction.id, newBalances: result.newBalances });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка обмена ИИрок: ' + err.message });
  }
});

// Backward-compatible /api/user endpoint (never falls back to admin profile if no user identifier is provided)
apiRouter.get('/user', (req: Request, res: Response, next) => {
  const hasIdentity = Boolean(
    (req.query.userId as string) ||
      (req.query.id as string) ||
      (req.query.telegramId as string) ||
      (req.query.email as string) ||
      (req.headers['x-user-id'] as string)
  );
  if (!hasIdentity) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ success: true, authenticated: false, user: null });
    return;
  }
  req.url = req.url.replace(/^\/user(?=\?|$)/, '/users/me');
  next();
});

// Real-Time Direct Profile & Balances from PostgreSQL Endpoint
apiRouter.get(['/user-profile', '/user/profile', '/users/me'], async (req: Request, res: Response) => {
  try {
    const rawUserId = (req.query.userId as string) || (req.query.id as string) || (req.query.telegramId as string) || (req.headers['x-user-id'] as string) || '16926299042';
    const cleanUserId = normalizeUserId(rawUserId);
    const db = await getPgDB();

    let userRecord = getUserByIdFromDb(db, cleanUserId);
    if (!userRecord && req.query.telegramId && !isNaN(Number(req.query.telegramId))) {
      userRecord = getUserByTelegramIdFromDb(db, Number(req.query.telegramId));
    }
    if (!userRecord && !isNaN(Number(rawUserId))) {
      userRecord = getUserByTelegramIdFromDb(db, Number(rawUserId));
    }
    if (!userRecord && typeof req.query.email === 'string' && req.query.email.trim()) {
      const emailTarget = req.query.email.trim().toLowerCase();
      try {
        const emailStmt = db.prepare('SELECT id FROM users WHERE lower(email) = ? LIMIT 1');
        emailStmt.bind([emailTarget]);
        if (emailStmt.step()) {
          const emailRow = emailStmt.getAsObject() as any;
          if (emailRow?.id) userRecord = getUserByIdFromDb(db, String(emailRow.id));
        }
        emailStmt.free();
      } catch {}
    }
    if (!userRecord) {
      // Try fallback finding in users table
      userRecord = getUserByIdFromDb(db, '16926299042');
    }

    if (!userRecord) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Trigger start bonus check & migration (start -> start_tma / start_email)
    const bonusCheck = checkAndApplyStartRegistrationBonus(db, userRecord.id);
    if (bonusCheck.applied) {
      userRecord = getUserByIdFromDb(db, userRecord.id) || userRecord;
      savePgDB();
    }

    // Resolve live tariff status (immediately downgrade expired paid subscriptions to Старт)
    const resolvedTariff = resolveUserTariffInDb(db, userRecord.id);
    if (resolvedTariff.isExpired) {
      const nowIso = new Date().toISOString();
      db.run(
        `UPDATE users SET tariff = 'Старт', tariff_expires_at = NULL, tariff_duration_days = 0, tariff_warned_expires_at = NULL WHERE id = ?`,
        [String(userRecord.id)]
      );
      try { DB.updateUser(String(userRecord.id), { tariff: 'Старт' }); } catch (e) {}
      userRecord = getUserByIdFromDb(db, userRecord.id) || userRecord;
      savePgDB();
    }

    const balance_start = Number(userRecord.balance_start ?? 0);
    const balance_ref = Number(userRecord.balance_ref ?? 0);
    const balance_tarif = Number(userRecord.balance_tarif ?? 0);
    const balance_admin = Number(userRecord.balance_admin ?? 0);
    const balance_pay = Number(userRecord.balance_pay ?? 0);
    const balance_free = Math.max(0, balance_start + balance_ref + balance_tarif + balance_admin);
    const balance = Math.max(0, balance_pay + balance_free);
    const balance_cost = Number(userRecord.balance_cost ?? 0);
    const balance_time = userRecord.balance_time || null;

    // Resolve full direct gallery URL for user avatar (expand short /f/... or /file/..., or auto-upload Telegram photo)
    let resolvedPhotoUrl =
      expandShortGalleryUrlToFull(db, userRecord.user_avatar) ||
      expandShortGalleryUrlToFull(db, userRecord.photo_url) ||
      (isFullGalleryDirectUrl(userRecord.user_avatar) ? userRecord.user_avatar : '') ||
      (isFullGalleryDirectUrl(userRecord.photo_url) ? userRecord.photo_url : '');

    if (!resolvedPhotoUrl && Number(userRecord.telegram_id) > 0) {
      try {
        const syncedFull = await ensureUserTelegramAvatarInGallery(
          Number(userRecord.telegram_id),
          String(userRecord.id),
          userRecord.photo_url || ''
        );
        if (syncedFull) {
          resolvedPhotoUrl = syncedFull;
        }
      } catch {}
    }

    if (!resolvedPhotoUrl) {
      resolvedPhotoUrl = userRecord.user_avatar || userRecord.photo_url || '';
    }

    res.json({
      success: true,
      user: {
        id: userRecord.id,
        telegramId: userRecord.telegram_id,
        email: userRecord.email,
        name: `${userRecord.first_name || ''} ${userRecord.last_name || ''}`.trim() || userRecord.username || `User_${userRecord.id}`,
        firstName: userRecord.first_name,
        lastName: userRecord.last_name,
        username: userRecord.username,
        telegramUsername: userRecord.telegram_username || userRecord.username || '',
        photoUrl: resolvedPhotoUrl,
        userAvatar: resolvedPhotoUrl,
        avatarUrl: resolvedPhotoUrl,
        profileLink: userRecord.profile_link,
        bio: userRecord.bio,
        role: userRecord.role,
        tariff: resolvedTariff.tariffName || 'Старт',
        tariffLevel: resolvedTariff.level,
        hasRainbowHeart: resolvedTariff.level >= ServerTariffLevel.Razgon,
        auto_renew_tariff: resolvedTariff.autoRenew,
        autoRenewTariff: resolvedTariff.autoRenew,
        tarif_date: userRecord.tarif_date || userRecord.tariff_assigned_at || userRecord.created_at,
        tariff_date: userRecord.tarif_date || userRecord.tariff_assigned_at || userRecord.created_at,
        tariff_expires_at: resolvedTariff.expiresAt,
        tariffExpiresAt: resolvedTariff.expiresAt,
        tariffAssignedAt: userRecord.tariff_assigned_at || userRecord.tarif_date,
        tariffDurationDays: resolvedTariff.tariffName === 'Старт' ? 0 : (userRecord.tariff_duration_days || 30),
        status: userRecord.status || 'Активный',
        balance,
        balance_free,
        balance_pay,
        balance_start,
        balance_ref,
        balance_tarif,
        balance_admin,
        balance_cost,
        balance_time,
        createdAt: userRecord.created_at,
        lastLogin: userRecord.last_login
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения профиля: ' + err.message });
  }
});

// Admin endpoint to trigger full balance reconciliation against transactions
apiRouter.post('/admin/reconcile-balances', async (req: Request, res: Response) => {
  try {
    const db = await getPgDB();
    const refSync = checkAndSyncReferralTransactions(db);
    const balanceSync = reconcileAllUserBalancesFromTransactions(db);
    savePgDB();

    res.json({
      success: true,
      message: `Аудит балансов завершен. Синхронизировано рефералов: ${refSync.syncedCount}, обновлено пользователей: ${balanceSync.updatedCount}`,
      refDetails: refSync.details,
      balanceDetails: balanceSync.details
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка аудита балансов: ' + err.message });
  }
});

// (Duplicate /tariffs GET & POST routes removed — handled cleanly by the primary block above & pricingRoutes)

apiRouter.post('/tariffs/assign', async (req: Request, res: Response) => {
  try {
    const { userId, tariffName, durationDays, monthlyIirky, comment } = req.body;
    if (!userId || !tariffName) {
      res.status(400).json({ error: 'Не указан пользователь или название тарифа' });
      return;
    }

    const cleanUserId = normalizeUserId(userId);
    const db = await getPgDB();
    const days = Number(durationDays) || 30;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const assignedAt = now.toISOString();

    db.run(
      `UPDATE users 
       SET tariff = ?, tariff_assigned_at = ?, tariff_expires_at = ?, tariff_duration_days = ?
       WHERE id = ? OR telegram_id = ?`,
      [tariffName, assignedAt, expiresAt, days, cleanUserId, cleanUserId]
    );

    // If monthlyIirky > 0, credit tariff bonus transaction
    const bonus = Number(monthlyIirky) || 0;
    if (bonus > 0) {
      addTransactionWithBalanceUpdate(db, {
        userId: cleanUserId,
        type: 'tarif',
        balanceType: 'tarif',
        amount: bonus,
        description: `Начисление по тарифу "${tariffName}" (+${bonus} ИИрок)`,
        comment: comment || `Активация тарифа ${tariffName} на ${days} дней`
      });
    }

    savePgDB();
    res.json({ 
      success: true, 
      message: `Тариф "${tariffName}" успешно привязан пользователю ${cleanUserId} на ${days} дней.`,
      assignedAt,
      expiresAt
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка привязки тарифа: ' + err.message });
  }
});

// Switch/Change Tariff by User using paid ruble-backed balance (1 рубль = 1 ИИрка)
apiRouter.post('/tariffs/change', async (req: Request, res: Response) => {
  try {
    const { userId, tariffId, targetTariffName, tariffName, periodMonths = 1 } = req.body;
    const effectiveTariffName = targetTariffName || tariffName;
    if (!effectiveTariffName && !tariffId) {
      res.status(400).json({ error: 'Не указан целевой тариф' });
      return;
    }

    const rawUid = userId || (req.headers['x-user-id'] as string) || '';
    const db = await getPgDB();
    const result = changeUserTariffInDb(db, {
      userId: rawUid,
      tariffId,
      tariffName: effectiveTariffName,
      periodMonths: Number(periodMonths) || 1
    });

    if (!result.success) {
      res.status(result.statusCode || 400).json(result);
      return;
    }

    if (result.user?.id && result.tariff) {
      try { DB.updateUser(String(result.user.id), { tariff: result.tariff, balance: result.balance }); } catch (e) {}
    }
    savePgDB();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка смены тарифа: ' + err.message });
  }
});

// Toggle Tariff Auto-Renewal setting for user
apiRouter.post('/tariffs/auto-renew', async (req: Request, res: Response) => {
  try {
    const rawUid = req.body?.userId || (req.headers['x-user-id'] as string) || '';
    const enabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : Boolean(req.body?.autoRenew);
    const db = await getPgDB();
    const result = setAutoRenewTariffInDb(db, String(rawUid), enabled);
    if (!result.success) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    savePgDB();
    res.json({
      success: true,
      autoRenew: result.autoRenew,
      message: result.autoRenew
        ? 'Автопродление тарифа включено.'
        : 'Автопродление тарифа отключено.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка сохранения настройки автопродления: ' + err.message });
  }
});

// Promote / Unpromote Post in Social Network Feed (Продвижение постов в соцсети ИИрки — requires Отрыв+)
apiRouter.post('/blog/posts/:id/promote', async (req: Request, res: Response) => {
  try {
    const postId = String(req.params.id || '').trim();
    const rawUid = req.body?.userId || (req.headers['x-user-id'] as string) || '';
    const db = await getPgDB();

    const perm = checkTariffPermission(db, rawUid, ServerTariffLevel.Otryv, 'Продвижение постов в соцсети ИИрки');
    if (!perm.allowed) {
      res.status(perm.statusCode).json(perm.payload);
      return;
    }

    const postRes = db.exec(
      "SELECT id, user_id, is_promoted FROM posts WHERE id = ? OR slug = ? LIMIT 1",
      [postId, postId]
    );
    if (!postRes[0]?.values?.[0]) {
      res.status(404).json({ error: 'Публикация не найдена' });
      return;
    }

    const actualId = String(postRes[0].values[0][0]);
    const postOwnerId = String(postRes[0].values[0][1] || '');
    const currentPromoted = Number(postRes[0].values[0][2] || 0) === 1;

    if (!perm.resolved.isAdmin && postOwnerId && postOwnerId !== perm.resolved.userId) {
      res.status(403).json({ error: 'Продвигать можно только собственные публикации' });
      return;
    }

    const nextPromoted = req.body?.promoted !== undefined ? Boolean(req.body.promoted) : !currentPromoted;
    const nowIso = new Date().toISOString();
    db.run(
      "UPDATE posts SET is_promoted = ?, promoted_at = ? WHERE id = ?",
      [nextPromoted ? 1 : 0, nextPromoted ? nowIso : null, actualId]
    );
    savePgDB();

    res.json({
      success: true,
      postId: actualId,
      isPromoted: nextPromoted,
      message: nextPromoted
        ? 'Публикация поднята в приоритетный топ Ленты соцсети ИИрки!'
        : 'Приоритетное продвижение публикации отключено.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка продвижения публикации: ' + err.message });
  }
});

// ==========================================
// TELEGRAM BOT PROXY & BACKUP API ENDPOINTS
// ==========================================
apiRouter.get('/admin/bot-settings', async (req: Request, res: Response) => {
  try {
    const { getTelegramBotConfig } = await import('./telegram');
    const config = await getTelegramBotConfig();
    const rawToken = config.botToken || '';
    
    const maskedToken = rawToken.length > 12 
      ? `${rawToken.substring(0, 6)}••••••••${rawToken.substring(rawToken.length - 4)}` 
      : (rawToken ? '••••••••••••' : '');

    res.json({
      botUsername: config.botUsername,
      proxyType: config.proxyType || 'dialog_ai',
      apiBaseUrl: config.apiBaseUrl,
      adminTelegramId: config.adminTelegramId,
      isTokenConfigured: Boolean(rawToken),
      maskedToken
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка получения настроек бота: ' + err.message });
  }
});

apiRouter.post('/admin/bot-settings', async (req: Request, res: Response) => {
  try {
    const { getTelegramBotConfig, cleanTelegramBaseUrl, PROXY_PRESETS } = await import('./telegram');
    const { botToken, botUsername, proxyType, apiBaseUrl, adminTelegramId } = req.body;
    const current = await getTelegramBotConfig();

    const normalizedProxyType = proxyType === 'custom_cloudflare' ? 'custom_cloudflare' : 'dialog_ai';
    let resolvedBaseUrl = PROXY_PRESETS.dialog_ai;
    if (normalizedProxyType === 'custom_cloudflare') {
      resolvedBaseUrl = cleanTelegramBaseUrl(apiBaseUrl || '');
    }

    const finalToken = (!botToken || botToken.includes('•••')) 
      ? current.botToken 
      : botToken.trim();

    const updated = {
      ...current,
      botToken: finalToken,
      botUsername: botUsername?.trim() || current.botUsername,
      proxyType: normalizedProxyType,
      apiBaseUrl: resolvedBaseUrl,
      adminTelegramId: adminTelegramId?.trim() || current.adminTelegramId
    };

    const db = await getPgDB();
    if (db) {
      db.run(
        `INSERT INTO telegram_bot_config (id, config_json) 
         VALUES ('default', ?) 
         ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json`,
        [JSON.stringify(updated)]
      );
      savePgDB();
    }

    res.json({
      success: true,
      message: 'Настройки успешно сохранены',
      config: {
        botUsername: updated.botUsername,
        proxyType: updated.proxyType,
        apiBaseUrl: updated.apiBaseUrl,
        adminTelegramId: updated.adminTelegramId,
        isTokenConfigured: Boolean(finalToken)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка сохранения настроек бота: ' + err.message });
  }
});

apiRouter.post('/admin/backup/trigger', async (req: Request, res: Response) => {
  try {
    const { executeDatabaseBackup } = await import('./backup');
    const format = req.body?.format;
    const result = await executeDatabaseBackup('Ручной запуск из панели администратора', {
      force: true,
      format
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Ошибка запуска бэкапа: ' + err.message });
  }
});

registerPricingRoutes(apiRouter);






