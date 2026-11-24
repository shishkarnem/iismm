import type { PgCloudDatabase as Database } from '../pg/cache/pgMemAdapter';

export const PROMO_CATEGORIES = [
  'Бизнес и стартапы',
  'Маркетинг и PR',
  'Технологии и ИИ',
  'Новости и медиа',
  'Криптовалюта и финансы',
  'Образование и саморазвитие',
  'Психология и лайфстайл',
  'Развлечения и юмор',
  'Дизайн и творчество',
  'Экспертные блоги'
] as const;

export type PromoCategory = typeof PROMO_CATEGORIES[number];

export interface PromoFolderRecord {
  id: string;
  author_id: string;
  author_telegram_id?: number;
  author_username?: string;
  author_name?: string;
  title: string;
  categories: string; // JSON array
  image_url?: string;
  post_text: string;
  message_format: 'v2' | 'rich';
  inline_buttons?: string; // JSON array
  max_participants: number;
  min_subscribers: number;
  scheduled_at: string;
  rules_instruction?: string;
  repeat_post_enabled: number;
  repeat_scheduled_at?: string;
  repeat_image_url?: string;
  repeat_post_text?: string;
  repeat_inline_buttons?: string;
  telegram_folder_link?: string;
  status: 'recruiting' | 'confirmed' | 'bot_checking' | 'published' | 'completed' | 'cancelled';
  reminder_before_minutes?: number;
  bot_check_before_minutes?: number;
  timezone?: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface PromoFolderParticipantRecord {
  id: string;
  folder_id: string;
  user_id: string;
  channel_id: string;
  channel_name: string;
  channel_username?: string;
  subscribers_count: number;
  avatar_url?: string;
  joined_at: string;
  custom_publish_time?: string;
  custom_repeat_publish_time?: string;
  status: 'pending' | 'accepted' | 'declined' | 'left';
  reject_reason?: string;
  is_paid_entry: number;
  bot_verified: number;
  is_sponsor?: number;
  sponsor_skip_posting?: number;
}

export interface PromoSelectionRecord {
  id: string;
  author_id: string;
  author_telegram_id?: number;
  author_username?: string;
  author_name?: string;
  title: string;
  categories: string; // JSON array
  min_subscribers: number;
  max_participants: number;
  scheduled_at: string;
  header_title: string;
  header_subtitle?: string;
  rules?: string;
  status: 'recruiting' | 'confirmed' | 'bot_checking' | 'published' | 'results' | 'cancelled';
  invite_code: string;
  results_collected_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PromoSelectionChannelRecord {
  id: string;
  selection_id: string;
  user_id: string;
  channel_id: string;
  channel_name: string;
  channel_username?: string;
  channel_avatar_url?: string;
  promo_text: string;
  promo_images?: string; // JSON or url
  subscribers_initial: number;
  subscribers_final: number;
  views_count: number;
  likes_count: number;
  reposts_count: number;
  comments_count: number;
  moderation_status: 'pending' | 'approved' | 'rejected';
  moderation_comment?: string;
  custom_publish_time?: string;
  status: 'active' | 'declined' | 'left';
  reject_reason?: string;
  bot_verified: number;
  joined_at: string;
}

export function initPromoFoldersTable(_db: Database) {
  // Schema and data managed in cloud PostgreSQL ProTalk (iismm2); demo seeds removed
}

