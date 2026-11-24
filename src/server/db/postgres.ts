/**
 * ProTalk Cloud PostgreSQL (iismm2) Centralized Data Access Layer.
 * Provides unified, typed access to all 50 PostgreSQL tables and projections.
 */
export * from '../pg/cache/pgMemAdapter';
export * from '../pg/cache/pgWriteQueue';
export * from '../pg/client/pgHttpClient';
export * from '../pg/client/protalkConfig';
export * from '../pg/client/protalkPlatformApi';
export * from '../repos/coreSettingsRepo';
export * from '../repos/tableAdminRepo';
export * from '../repos/blogPostsRepo';
export * from '../repos/socialSubscriptionsRepo';
export * from '../repos/chatMessagesRepo';
